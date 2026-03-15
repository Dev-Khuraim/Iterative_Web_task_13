import { Response } from 'express';
import { query } from '../database/db.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import type { Notification, User, Post } from '../types/index.js';

export const getNotifications = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { page = '1', limit = '20' } = req.query;
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    const result = await query<Notification & { actor: User; post: Post }>(
      `SELECT n.*,
              row_to_json(u.*) as actor,
              row_to_json(p.*) as post
       FROM notifications n
       LEFT JOIN users u ON n.actor_id = u.id
       LEFT JOIN posts p ON n.post_id = p.id
       WHERE n.user_id = $1
       ORDER BY n.created_at DESC
       LIMIT $2 OFFSET $3`,
      [req.user.userId, parseInt(limit as string), offset]
    );

    res.json({ notifications: result.rows });
  } catch (error) {
    console.error('GetNotifications error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getUnreadCount = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const result = await query<{ count: string }>(
      'SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = false',
      [req.user.userId]
    );

    res.json({ count: parseInt(result.rows[0]?.count || '0') });
  } catch (error) {
    console.error('GetUnreadCount error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const markAsRead = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { notificationId } = req.params;

    await query('UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2', [
      notificationId,
      req.user.userId,
    ]);

    res.json({ success: true });
  } catch (error) {
    console.error('MarkAsRead error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const markAllAsRead = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    await query('UPDATE notifications SET is_read = true WHERE user_id = $1', [req.user.userId]);

    res.json({ success: true });
  } catch (error) {
    console.error('MarkAllAsRead error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createNotification = async (
  userId: string,
  type: Notification['type'],
  actorId?: string,
  postId?: string,
  content?: string
): Promise<Notification | null> => {
  try {
    // Don't notify yourself
    if (actorId === userId) {
      return null;
    }

    const result = await query<Notification>(
      `INSERT INTO notifications (user_id, type, actor_id, post_id, content)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [userId, type, actorId, postId, content]
    );

    return result.rows[0] || null;
  } catch (error) {
    console.error('CreateNotification error:', error);
    return null;
  }
};
