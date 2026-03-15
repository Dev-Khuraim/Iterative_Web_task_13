import { Response } from 'express';
import { z } from 'zod';
import { query } from '../database/db.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import type { User, Friendship } from '../types/index.js';

const updateProfileSchema = z.object({
  display_name: z.string().min(1).max(100).optional(),
  bio: z.string().max(500).optional(),
  producer_type: z.string().max(100).optional(),
  genres: z.array(z.string()).optional(),
  website: z.string().url().optional().or(z.literal('')),
  soundcloud_url: z.string().url().optional().or(z.literal('')),
  spotify_url: z.string().url().optional().or(z.literal('')),
  avatar_url: z.string().url().optional().or(z.literal('')),
  cover_image_url: z.string().url().optional().or(z.literal('')),
});

export const getUser = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;

    const result = await query<User>(
      `SELECT id, username, email, display_name, bio, avatar_url, cover_image_url,
              producer_type, genres, website, soundcloud_url, spotify_url,
              is_online, last_seen, created_at
       FROM users WHERE id = $1`,
      [userId]
    );

    const user = result.rows[0];
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Get follower/following counts
    const [followersResult, followingResult, postsResult] = await Promise.all([
      query<{ count: string }>('SELECT COUNT(*) FROM followers WHERE following_id = $1', [userId]),
      query<{ count: string }>('SELECT COUNT(*) FROM followers WHERE follower_id = $1', [userId]),
      query<{ count: string }>('SELECT COUNT(*) FROM posts WHERE user_id = $1', [userId]),
    ]);

    // Check friendship status if authenticated
    let friendshipStatus = null;
    let isFollowing = false;

    if (req.user && req.user.userId !== userId) {
      const friendshipResult = await query<Friendship>(
        `SELECT * FROM friendships
         WHERE (requester_id = $1 AND addressee_id = $2)
            OR (requester_id = $2 AND addressee_id = $1)`,
        [req.user.userId, userId]
      );
      friendshipStatus = friendshipResult.rows[0]?.status || null;

      const followResult = await query<{ id: string }>(
        'SELECT id FROM followers WHERE follower_id = $1 AND following_id = $2',
        [req.user.userId, userId]
      );
      isFollowing = followResult.rows.length > 0;
    }

    res.json({
      user: {
        ...user,
        followers_count: parseInt(followersResult.rows[0]?.count || '0'),
        following_count: parseInt(followingResult.rows[0]?.count || '0'),
        posts_count: parseInt(postsResult.rows[0]?.count || '0'),
        friendship_status: friendshipStatus,
        is_following: isFollowing,
      },
    });
  } catch (error) {
    console.error('GetUser error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateProfile = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const validated = updateProfileSchema.parse(req.body);

    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(validated)) {
      if (value !== undefined) {
        updates.push(`${key} = $${paramIndex}`);
        values.push(key === 'genres' ? value : value || null);
        paramIndex++;
      }
    }

    if (updates.length === 0) {
      res.status(400).json({ error: 'No fields to update' });
      return;
    }

    values.push(req.user.userId);

    const result = await query<User>(
      `UPDATE users SET ${updates.join(', ')}, updated_at = NOW()
       WHERE id = $${paramIndex}
       RETURNING id, username, email, display_name, bio, avatar_url, cover_image_url,
                 producer_type, genres, website, soundcloud_url, spotify_url,
                 is_online, created_at`,
      values
    );

    const user = result.rows[0];
    res.json({ user });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors });
      return;
    }
    console.error('UpdateProfile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const followUser = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { userId } = req.params;

    if (req.user.userId === userId) {
      res.status(400).json({ error: 'Cannot follow yourself' });
      return;
    }

    await query(
      `INSERT INTO followers (follower_id, following_id)
       VALUES ($1, $2)
       ON CONFLICT (follower_id, following_id) DO NOTHING`,
      [req.user.userId, userId]
    );

    res.json({ message: 'Successfully followed user' });
  } catch (error) {
    console.error('FollowUser error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const unfollowUser = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { userId } = req.params;

    await query('DELETE FROM followers WHERE follower_id = $1 AND following_id = $2', [
      req.user.userId,
      userId,
    ]);

    res.json({ message: 'Successfully unfollowed user' });
  } catch (error) {
    console.error('UnfollowUser error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const sendFriendRequest = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { userId } = req.params;

    if (req.user.userId === userId) {
      res.status(400).json({ error: 'Cannot send friend request to yourself' });
      return;
    }

    // Check if friendship already exists
    const existing = await query<Friendship>(
      `SELECT * FROM friendships
       WHERE (requester_id = $1 AND addressee_id = $2)
          OR (requester_id = $2 AND addressee_id = $1)`,
      [req.user.userId, userId]
    );

    if (existing.rows.length > 0) {
      res.status(400).json({ error: 'Friendship already exists or pending' });
      return;
    }

    const result = await query<Friendship>(
      `INSERT INTO friendships (requester_id, addressee_id, status)
       VALUES ($1, $2, 'pending')
       RETURNING *`,
      [req.user.userId, userId]
    );

    res.status(201).json({ friendship: result.rows[0] });
  } catch (error) {
    console.error('SendFriendRequest error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const respondToFriendRequest = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { friendshipId } = req.params;
    const { accept } = req.body;

    const result = await query<Friendship>(
      `UPDATE friendships
       SET status = $1, updated_at = NOW()
       WHERE id = $2 AND addressee_id = $3 AND status = 'pending'
       RETURNING *`,
      [accept ? 'accepted' : 'rejected', friendshipId, req.user.userId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Friend request not found' });
      return;
    }

    res.json({ friendship: result.rows[0] });
  } catch (error) {
    console.error('RespondToFriendRequest error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getFriends = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const result = await query<Friendship & { friend: User }>(
      `SELECT f.*,
              CASE
                WHEN f.requester_id = $1 THEN row_to_json(u2.*)
                ELSE row_to_json(u1.*)
              END as friend
       FROM friendships f
       JOIN users u1 ON f.requester_id = u1.id
       JOIN users u2 ON f.addressee_id = u2.id
       WHERE (f.requester_id = $1 OR f.addressee_id = $1) AND f.status = 'accepted'
       ORDER BY f.updated_at DESC`,
      [req.user.userId]
    );

    res.json({ friends: result.rows });
  } catch (error) {
    console.error('GetFriends error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getPendingRequests = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const result = await query<Friendship & { requester: User }>(
      `SELECT f.*, row_to_json(u.*) as requester
       FROM friendships f
       JOIN users u ON f.requester_id = u.id
       WHERE f.addressee_id = $1 AND f.status = 'pending'
       ORDER BY f.created_at DESC`,
      [req.user.userId]
    );

    res.json({ requests: result.rows });
  } catch (error) {
    console.error('GetPendingRequests error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const searchUsers = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { q, genre, producer_type } = req.query;
    const conditions: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (q && typeof q === 'string') {
      conditions.push(
        `(username ILIKE $${paramIndex} OR display_name ILIKE $${paramIndex})`
      );
      values.push(`%${q}%`);
      paramIndex++;
    }

    if (genre && typeof genre === 'string') {
      conditions.push(`$${paramIndex} = ANY(genres)`);
      values.push(genre);
      paramIndex++;
    }

    if (producer_type && typeof producer_type === 'string') {
      conditions.push(`producer_type ILIKE $${paramIndex}`);
      values.push(`%${producer_type}%`);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await query<User>(
      `SELECT id, username, display_name, bio, avatar_url, producer_type, genres, is_online
       FROM users ${whereClause}
       ORDER BY is_online DESC, created_at DESC
       LIMIT 50`,
      values
    );

    res.json({ users: result.rows });
  } catch (error) {
    console.error('SearchUsers error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
