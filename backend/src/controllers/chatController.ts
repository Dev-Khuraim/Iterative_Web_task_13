import { Response } from 'express';
import { z } from 'zod';
import { query } from '../database/db.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import type { Conversation, Message, User } from '../types/index.js';

const createMessageSchema = z.object({
  content: z.string().max(5000).optional(),
  message_type: z.enum(['text', 'audio', 'image', 'track_share']).default('text'),
  audio_url: z.string().optional(),
  image_url: z.string().optional(),
  shared_post_id: z.string().uuid().optional(),
});

const createConversationSchema = z.object({
  participant_ids: z.array(z.string().uuid()).min(1),
  is_group: z.boolean().default(false),
  name: z.string().max(100).optional(),
});

export const getConversations = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const result = await query<Conversation>(
      `SELECT DISTINCT ON (c.id) c.*,
              (
                SELECT json_agg(json_build_object(
                  'id', u.id,
                  'username', u.username,
                  'display_name', u.display_name,
                  'avatar_url', u.avatar_url,
                  'is_online', u.is_online
                ))
                FROM conversation_participants cp2
                JOIN users u ON cp2.user_id = u.id
                WHERE cp2.conversation_id = c.id AND cp2.user_id != $1
              ) as participants,
              (
                SELECT row_to_json(m.*)
                FROM messages m
                WHERE m.conversation_id = c.id
                ORDER BY m.created_at DESC
                LIMIT 1
              ) as last_message,
              (
                SELECT COUNT(*)
                FROM messages m
                WHERE m.conversation_id = c.id
                  AND m.sender_id != $1
                  AND m.created_at > COALESCE(cp.last_read_at, '1970-01-01')
              ) as unread_count
       FROM conversations c
       JOIN conversation_participants cp ON c.id = cp.conversation_id
       WHERE cp.user_id = $1
       ORDER BY c.id, c.updated_at DESC`,
      [req.user.userId]
    );

    res.json({ conversations: result.rows });
  } catch (error) {
    console.error('GetConversations error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getOrCreateConversation = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const validated = createConversationSchema.parse(req.body);
    const allParticipants = [req.user.userId, ...validated.participant_ids];

    // For 1-on-1 conversations, check if one already exists
    if (!validated.is_group && validated.participant_ids.length === 1) {
      const existing = await query<Conversation>(
        `SELECT c.*
         FROM conversations c
         WHERE c.is_group = false
           AND (SELECT COUNT(*) FROM conversation_participants WHERE conversation_id = c.id) = 2
           AND EXISTS (SELECT 1 FROM conversation_participants WHERE conversation_id = c.id AND user_id = $1)
           AND EXISTS (SELECT 1 FROM conversation_participants WHERE conversation_id = c.id AND user_id = $2)`,
        [req.user.userId, validated.participant_ids[0]]
      );

      if (existing.rows.length > 0) {
        const conversation = existing.rows[0];
        if (conversation) {
          const participantsResult = await query<User>(
            `SELECT u.id, u.username, u.display_name, u.avatar_url, u.is_online
           FROM conversation_participants cp
           JOIN users u ON cp.user_id = u.id
           WHERE cp.conversation_id = $1 AND cp.user_id != $2`,
            [conversation.id, req.user.userId]
          );

          res.json({
            conversation: {
              ...conversation,
              participants: participantsResult.rows,
            },
          });
          return;
        }
      }
    }

    // Create new conversation
    const conversationResult = await query<Conversation>(
      `INSERT INTO conversations (is_group, name)
       VALUES ($1, $2)
       RETURNING *`,
      [validated.is_group, validated.name]
    );

    const conversation = conversationResult.rows[0];
    if (!conversation) {
      res.status(500).json({ error: 'Failed to create conversation' });
      return;
    }

    // Add participants
    for (const participantId of allParticipants) {
      await query(
        `INSERT INTO conversation_participants (conversation_id, user_id, is_admin)
         VALUES ($1, $2, $3)`,
        [conversation.id, participantId, participantId === req.user.userId]
      );
    }

    // Get participants info
    const participantsResult = await query<User>(
      `SELECT u.id, u.username, u.display_name, u.avatar_url, u.is_online
       FROM conversation_participants cp
       JOIN users u ON cp.user_id = u.id
       WHERE cp.conversation_id = $1 AND cp.user_id != $2`,
      [conversation.id, req.user.userId]
    );

    res.status(201).json({
      conversation: {
        ...conversation,
        participants: participantsResult.rows,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors });
      return;
    }
    console.error('GetOrCreateConversation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getMessages = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { conversationId } = req.params;
    const { before, limit = '50' } = req.query;

    // Verify user is part of conversation
    const participantCheck = await query(
      'SELECT id FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2',
      [conversationId, req.user.userId]
    );

    if (participantCheck.rows.length === 0) {
      res.status(403).json({ error: 'Not a participant of this conversation' });
      return;
    }

    let messagesQuery = `
      SELECT m.*,
             row_to_json(u.*) as sender
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.conversation_id = $1
    `;
    const queryParams: unknown[] = [conversationId];

    if (before) {
      messagesQuery += ` AND m.created_at < $2`;
      queryParams.push(before);
    }

    messagesQuery += ` ORDER BY m.created_at DESC LIMIT $${queryParams.length + 1}`;
    queryParams.push(parseInt(limit as string));

    const result = await query<Message & { sender: User }>(messagesQuery, queryParams);

    // Update last_read_at
    await query(
      `UPDATE conversation_participants
       SET last_read_at = NOW()
       WHERE conversation_id = $1 AND user_id = $2`,
      [conversationId, req.user.userId]
    );

    res.json({ messages: result.rows.reverse() });
  } catch (error) {
    console.error('GetMessages error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const sendMessage = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { conversationId } = req.params;
    const validated = createMessageSchema.parse(req.body);

    // Verify user is part of conversation
    const participantCheck = await query(
      'SELECT id FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2',
      [conversationId, req.user.userId]
    );

    if (participantCheck.rows.length === 0) {
      res.status(403).json({ error: 'Not a participant of this conversation' });
      return;
    }

    const result = await query<Message>(
      `INSERT INTO messages (conversation_id, sender_id, content, message_type, audio_url, image_url, shared_post_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        conversationId,
        req.user.userId,
        validated.content,
        validated.message_type,
        validated.audio_url,
        validated.image_url,
        validated.shared_post_id,
      ]
    );

    // Update conversation updated_at
    await query('UPDATE conversations SET updated_at = NOW() WHERE id = $1', [conversationId]);

    // Get sender info
    const senderResult = await query<User>(
      'SELECT id, username, display_name, avatar_url FROM users WHERE id = $1',
      [req.user.userId]
    );

    const message = {
      ...result.rows[0],
      sender: senderResult.rows[0],
    };

    res.status(201).json({ message });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors });
      return;
    }
    console.error('SendMessage error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const addGroupMember = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { conversationId } = req.params;
    const { user_id } = req.body;

    if (!user_id) {
      res.status(400).json({ error: 'user_id is required' });
      return;
    }

    // Verify conversation is a group
    const convResult = await query<Conversation>(
      'SELECT * FROM conversations WHERE id = $1 AND is_group = true',
      [conversationId]
    );

    if (convResult.rows.length === 0) {
      res.status(404).json({ error: 'Group not found' });
      return;
    }

    // Verify requester is a participant
    const participantCheck = await query(
      'SELECT id FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2',
      [conversationId, req.user.userId]
    );

    if (participantCheck.rows.length === 0) {
      res.status(403).json({ error: 'Not a participant of this group' });
      return;
    }

    // Add new member
    await query(
      `INSERT INTO conversation_participants (conversation_id, user_id, is_admin)
       VALUES ($1, $2, false)
       ON CONFLICT (conversation_id, user_id) DO NOTHING`,
      [conversationId, user_id]
    );

    // Get updated participants
    const participantsResult = await query<User>(
      `SELECT u.id, u.username, u.display_name, u.avatar_url, u.is_online
       FROM conversation_participants cp
       JOIN users u ON cp.user_id = u.id
       WHERE cp.conversation_id = $1`,
      [conversationId]
    );

    res.json({ participants: participantsResult.rows });
  } catch (error) {
    console.error('AddGroupMember error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const removeGroupMember = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { conversationId, userId } = req.params;

    // Verify conversation is a group
    const convResult = await query<Conversation>(
      'SELECT * FROM conversations WHERE id = $1 AND is_group = true',
      [conversationId]
    );

    if (convResult.rows.length === 0) {
      res.status(404).json({ error: 'Group not found' });
      return;
    }

    // Verify requester is admin or removing self
    const adminCheck = await query<{ is_admin: boolean }>(
      'SELECT is_admin FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2',
      [conversationId, req.user.userId]
    );

    if (adminCheck.rows.length === 0) {
      res.status(403).json({ error: 'Not a participant of this group' });
      return;
    }

    const isAdmin = adminCheck.rows[0]?.is_admin;
    const isRemovingSelf = userId === req.user.userId;

    if (!isAdmin && !isRemovingSelf) {
      res.status(403).json({ error: 'Only admins can remove other members' });
      return;
    }

    await query(
      'DELETE FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2',
      [conversationId, userId]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('RemoveGroupMember error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getGroupMembers = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { conversationId } = req.params;

    // Verify user is participant
    const participantCheck = await query(
      'SELECT id FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2',
      [conversationId, req.user.userId]
    );

    if (participantCheck.rows.length === 0) {
      res.status(403).json({ error: 'Not a participant of this group' });
      return;
    }

    const result = await query<User & { is_admin: boolean }>(
      `SELECT u.id, u.username, u.display_name, u.avatar_url, u.is_online, cp.is_admin
       FROM conversation_participants cp
       JOIN users u ON cp.user_id = u.id
       WHERE cp.conversation_id = $1
       ORDER BY cp.is_admin DESC, cp.joined_at ASC`,
      [conversationId]
    );

    res.json({ members: result.rows });
  } catch (error) {
    console.error('GetGroupMembers error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const markAsRead = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { conversationId } = req.params;

    await query(
      `UPDATE conversation_participants
       SET last_read_at = NOW()
       WHERE conversation_id = $1 AND user_id = $2`,
      [conversationId, req.user.userId]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('MarkAsRead error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
