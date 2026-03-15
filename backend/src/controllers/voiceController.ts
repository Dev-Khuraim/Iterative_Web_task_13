import { Response } from 'express';
import { z } from 'zod';
import { query } from '../database/db.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import type { VoiceRoom, VoiceRoomParticipant, User } from '../types/index.js';

const createRoomSchema = z.object({
  name: z.string().min(1).max(100),
  is_private: z.boolean().default(false),
  max_participants: z.number().int().min(2).max(50).default(10),
  genre: z.string().max(100).optional(),
  description: z.string().max(500).optional(),
});

export const getVoiceRooms = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const result = await query<VoiceRoom & { host: User; participant_count: number }>(
      `SELECT vr.*,
              row_to_json(u.*) as host,
              (SELECT COUNT(*) FROM voice_room_participants WHERE room_id = vr.id) as participant_count
       FROM voice_rooms vr
       JOIN users u ON vr.host_id = u.id
       WHERE vr.is_active = true AND (vr.is_private = false OR vr.host_id = $1)
       ORDER BY vr.created_at DESC`,
      [req.user?.userId || null]
    );

    res.json({ rooms: result.rows });
  } catch (error) {
    console.error('GetVoiceRooms error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createVoiceRoom = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const validated = createRoomSchema.parse(req.body);

    const result = await query<VoiceRoom>(
      `INSERT INTO voice_rooms (name, host_id, is_private, max_participants, genre, description)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        validated.name,
        req.user.userId,
        validated.is_private,
        validated.max_participants,
        validated.genre,
        validated.description,
      ]
    );

    const room = result.rows[0];
    if (!room) {
      res.status(500).json({ error: 'Failed to create room' });
      return;
    }

    // Add host as participant
    await query(
      `INSERT INTO voice_room_participants (room_id, user_id)
       VALUES ($1, $2)`,
      [room.id, req.user.userId]
    );

    // Get host info
    const hostResult = await query<User>(
      'SELECT id, username, display_name, avatar_url FROM users WHERE id = $1',
      [req.user.userId]
    );

    res.status(201).json({
      room: {
        ...room,
        host: hostResult.rows[0],
        participant_count: 1,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors });
      return;
    }
    console.error('CreateVoiceRoom error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getVoiceRoom = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { roomId } = req.params;

    const roomResult = await query<VoiceRoom & { host: User }>(
      `SELECT vr.*, row_to_json(u.*) as host
       FROM voice_rooms vr
       JOIN users u ON vr.host_id = u.id
       WHERE vr.id = $1`,
      [roomId]
    );

    if (roomResult.rows.length === 0) {
      res.status(404).json({ error: 'Room not found' });
      return;
    }

    const participantsResult = await query<VoiceRoomParticipant & { user: User }>(
      `SELECT vrp.*, row_to_json(u.*) as user
       FROM voice_room_participants vrp
       JOIN users u ON vrp.user_id = u.id
       WHERE vrp.room_id = $1`,
      [roomId]
    );

    res.json({
      room: {
        ...roomResult.rows[0],
        participants: participantsResult.rows,
      },
    });
  } catch (error) {
    console.error('GetVoiceRoom error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const joinVoiceRoom = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { roomId } = req.params;

    // Check if room exists and is active
    const roomResult = await query<VoiceRoom>(
      'SELECT * FROM voice_rooms WHERE id = $1 AND is_active = true',
      [roomId]
    );

    if (roomResult.rows.length === 0) {
      res.status(404).json({ error: 'Room not found or inactive' });
      return;
    }

    const room = roomResult.rows[0];
    if (!room) {
      res.status(404).json({ error: 'Room not found' });
      return;
    }

    // Check participant count
    const countResult = await query<{ count: string }>(
      'SELECT COUNT(*) FROM voice_room_participants WHERE room_id = $1',
      [roomId]
    );

    if (parseInt(countResult.rows[0]?.count || '0') >= room.max_participants) {
      res.status(400).json({ error: 'Room is full' });
      return;
    }

    // Add participant
    await query(
      `INSERT INTO voice_room_participants (room_id, user_id)
       VALUES ($1, $2)
       ON CONFLICT (room_id, user_id) DO UPDATE SET joined_at = NOW()`,
      [roomId, req.user.userId]
    );

    // Get user info
    const userResult = await query<User>(
      'SELECT id, username, display_name, avatar_url FROM users WHERE id = $1',
      [req.user.userId]
    );

    res.json({
      participant: {
        room_id: roomId,
        user_id: req.user.userId,
        is_muted: false,
        is_speaking: false,
        user: userResult.rows[0],
      },
    });
  } catch (error) {
    console.error('JoinVoiceRoom error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const leaveVoiceRoom = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { roomId } = req.params;

    await query('DELETE FROM voice_room_participants WHERE room_id = $1 AND user_id = $2', [
      roomId,
      req.user.userId,
    ]);

    // Check if host left and close room if so
    const roomResult = await query<VoiceRoom>('SELECT * FROM voice_rooms WHERE id = $1', [roomId]);
    if (roomResult.rows[0]?.host_id === req.user.userId) {
      await query('UPDATE voice_rooms SET is_active = false WHERE id = $1', [roomId]);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('LeaveVoiceRoom error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const closeVoiceRoom = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { roomId } = req.params;

    const result = await query(
      'UPDATE voice_rooms SET is_active = false WHERE id = $1 AND host_id = $2 RETURNING id',
      [roomId, req.user.userId]
    );

    if (result.rowCount === 0) {
      res.status(404).json({ error: 'Room not found or unauthorized' });
      return;
    }

    // Remove all participants
    await query('DELETE FROM voice_room_participants WHERE room_id = $1', [roomId]);

    res.json({ success: true });
  } catch (error) {
    console.error('CloseVoiceRoom error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
