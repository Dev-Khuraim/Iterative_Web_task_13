import { Response } from 'express';
import { z } from 'zod';
import { query } from '../database/db.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import type { Post, Comment, User } from '../types/index.js';

const createPostSchema = z.object({
  content: z.string().max(2000).optional(),
  title: z.string().max(200).optional(),
  genre: z.string().max(100).optional(),
  bpm: z.number().int().min(20).max(300).optional(),
  key_signature: z.string().max(20).optional(),
  tags: z.array(z.string()).optional(),
  is_full_track: z.boolean().optional(),
  audio_url: z.string().optional(),
  cover_image_url: z.string().optional(),
  audio_duration: z.number().optional(),
  waveform_data: z.array(z.number()).optional(),
});

const createCommentSchema = z.object({
  content: z.string().min(1).max(1000),
  parent_id: z.string().uuid().optional(),
  timestamp_position: z.number().int().optional(),
});

export const createPost = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const validated = createPostSchema.parse(req.body);

    const result = await query<Post>(
      `INSERT INTO posts (user_id, content, title, genre, bpm, key_signature, tags,
                          is_full_track, audio_url, cover_image_url, audio_duration, waveform_data)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [
        req.user.userId,
        validated.content,
        validated.title,
        validated.genre,
        validated.bpm,
        validated.key_signature,
        validated.tags,
        validated.is_full_track || false,
        validated.audio_url,
        validated.cover_image_url,
        validated.audio_duration,
        validated.waveform_data ? JSON.stringify(validated.waveform_data) : null,
      ]
    );

    // Get user info
    const userResult = await query<User>(
      'SELECT id, username, display_name, avatar_url, producer_type FROM users WHERE id = $1',
      [req.user.userId]
    );

    const post = {
      ...result.rows[0],
      user: userResult.rows[0],
      likes_count: 0,
      comments_count: 0,
      shares_count: 0,
      is_liked: false,
      is_shared: false,
    };

    res.status(201).json({ post });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors });
      return;
    }
    console.error('CreatePost error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getFeed = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { page = '1', limit = '20' } = req.query;
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    // Get original posts
    const postsResult = await query<Post & { user: User }>(
      `SELECT p.*,
              row_to_json(u.*) as user,
              (SELECT COUNT(*) FROM post_likes WHERE post_id = p.id) as likes_count,
              (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comments_count,
              (SELECT COUNT(*) FROM shares WHERE post_id = p.id) as shares_count,
              NULL as reposted_by, NULL as repost_time
              ${req.user ? `, EXISTS(SELECT 1 FROM post_likes WHERE post_id = p.id AND user_id = $3) as is_liked,
              EXISTS(SELECT 1 FROM shares WHERE post_id = p.id AND user_id = $3) as is_shared` : ''}
       FROM posts p
       JOIN users u ON p.user_id = u.id
       ORDER BY p.created_at DESC
       LIMIT $1 OFFSET $2`,
      req.user
        ? [parseInt(limit as string), offset, req.user.userId]
        : [parseInt(limit as string), offset]
    );

    // Get reposts
    const repostsResult = await query<Post & { user: User }>(
      `SELECT p.*,
              row_to_json(pu.*) as user,
              (SELECT COUNT(*) FROM post_likes WHERE post_id = p.id) as likes_count,
              (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comments_count,
              (SELECT COUNT(*) FROM shares WHERE post_id = p.id) as shares_count,
              su.display_name as reposted_by, s.created_at as repost_time
              ${req.user ? `, EXISTS(SELECT 1 FROM post_likes WHERE post_id = p.id AND user_id = $3) as is_liked,
              EXISTS(SELECT 1 FROM shares WHERE post_id = p.id AND user_id = $3) as is_shared` : ''}
       FROM shares s
       JOIN posts p ON s.post_id = p.id
       JOIN users pu ON p.user_id = pu.id
       JOIN users su ON s.user_id = su.id
       WHERE s.user_id != p.user_id
       ORDER BY s.created_at DESC
       LIMIT $1 OFFSET $2`,
      req.user
        ? [parseInt(limit as string), offset, req.user.userId]
        : [parseInt(limit as string), offset]
    );

    // Merge and sort by time
    const allPosts = [
      ...postsResult.rows.map(p => ({ ...p, is_repost: false })),
      ...repostsResult.rows.map(p => ({ ...p, is_repost: true })),
    ].sort((a, b) => {
      const timeA = a.is_repost && a.repost_time ? new Date(a.repost_time).getTime() : new Date(a.created_at).getTime();
      const timeB = b.is_repost && b.repost_time ? new Date(b.repost_time).getTime() : new Date(b.created_at).getTime();
      return timeB - timeA;
    });

    res.json({ posts: allPosts });
  } catch (error) {
    console.error('GetFeed error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getPost = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { postId } = req.params;

    const postResult = await query<Post & { user: User }>(
      `SELECT p.*,
              row_to_json(u.*) as user,
              (SELECT COUNT(*) FROM post_likes WHERE post_id = p.id) as likes_count,
              (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comments_count,
              (SELECT COUNT(*) FROM shares WHERE post_id = p.id) as shares_count
              ${req.user ? `, EXISTS(SELECT 1 FROM post_likes WHERE post_id = p.id AND user_id = $2) as is_liked,
              EXISTS(SELECT 1 FROM shares WHERE post_id = p.id AND user_id = $2) as is_shared` : ''}
       FROM posts p
       JOIN users u ON p.user_id = u.id
       WHERE p.id = $1`,
      req.user ? [postId, req.user.userId] : [postId]
    );

    if (postResult.rows.length === 0) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }

    // Increment play count
    await query('UPDATE posts SET play_count = play_count + 1 WHERE id = $1', [postId]);

    res.json({ post: postResult.rows[0] });
  } catch (error) {
    console.error('GetPost error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getUserPosts = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const { page = '1', limit = '20' } = req.query;
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    // Get user's own posts
    const postsResult = await query<Post & { user: User }>(
      `SELECT p.*,
              row_to_json(u.*) as user,
              (SELECT COUNT(*) FROM post_likes WHERE post_id = p.id) as likes_count,
              (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comments_count,
              (SELECT COUNT(*) FROM shares WHERE post_id = p.id) as shares_count,
              NULL as reposted_by, NULL as repost_time
              ${req.user ? `, EXISTS(SELECT 1 FROM post_likes WHERE post_id = p.id AND user_id = $4) as is_liked,
              EXISTS(SELECT 1 FROM shares WHERE post_id = p.id AND user_id = $4) as is_shared` : ''}
       FROM posts p
       JOIN users u ON p.user_id = u.id
       WHERE p.user_id = $1
       ORDER BY p.created_at DESC
       LIMIT $2 OFFSET $3`,
      req.user
        ? [userId, parseInt(limit as string), offset, req.user.userId]
        : [userId, parseInt(limit as string), offset]
    );

    // Get user's reposts
    const repostsResult = await query<Post & { user: User }>(
      `SELECT p.*,
              row_to_json(pu.*) as user,
              (SELECT COUNT(*) FROM post_likes WHERE post_id = p.id) as likes_count,
              (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comments_count,
              (SELECT COUNT(*) FROM shares WHERE post_id = p.id) as shares_count,
              su.display_name as reposted_by, s.created_at as repost_time
              ${req.user ? `, EXISTS(SELECT 1 FROM post_likes WHERE post_id = p.id AND user_id = $4) as is_liked,
              EXISTS(SELECT 1 FROM shares WHERE post_id = p.id AND user_id = $4) as is_shared` : ''}
       FROM shares s
       JOIN posts p ON s.post_id = p.id
       JOIN users pu ON p.user_id = pu.id
       JOIN users su ON s.user_id = su.id
       WHERE s.user_id = $1 AND s.user_id != p.user_id
       ORDER BY s.created_at DESC
       LIMIT $2 OFFSET $3`,
      req.user
        ? [userId, parseInt(limit as string), offset, req.user.userId]
        : [userId, parseInt(limit as string), offset]
    );

    // Merge and sort
    const allPosts = [
      ...postsResult.rows.map(p => ({ ...p, is_repost: false })),
      ...repostsResult.rows.map(p => ({ ...p, is_repost: true })),
    ].sort((a, b) => {
      const timeA = a.is_repost && a.repost_time ? new Date(a.repost_time).getTime() : new Date(a.created_at).getTime();
      const timeB = b.is_repost && b.repost_time ? new Date(b.repost_time).getTime() : new Date(b.created_at).getTime();
      return timeB - timeA;
    });

    res.json({ posts: allPosts });
  } catch (error) {
    console.error('GetUserPosts error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const likePost = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { postId } = req.params;

    await query(
      `INSERT INTO post_likes (post_id, user_id)
       VALUES ($1, $2)
       ON CONFLICT (post_id, user_id) DO NOTHING`,
      [postId, req.user.userId]
    );

    const countResult = await query<{ count: string }>(
      'SELECT COUNT(*) FROM post_likes WHERE post_id = $1',
      [postId]
    );

    res.json({
      liked: true,
      likes_count: parseInt(countResult.rows[0]?.count || '0'),
    });
  } catch (error) {
    console.error('LikePost error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const unlikePost = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { postId } = req.params;

    await query('DELETE FROM post_likes WHERE post_id = $1 AND user_id = $2', [
      postId,
      req.user.userId,
    ]);

    const countResult = await query<{ count: string }>(
      'SELECT COUNT(*) FROM post_likes WHERE post_id = $1',
      [postId]
    );

    res.json({
      liked: false,
      likes_count: parseInt(countResult.rows[0]?.count || '0'),
    });
  } catch (error) {
    console.error('UnlikePost error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const sharePost = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { postId } = req.params;
    const { comment } = req.body;

    await query(
      `INSERT INTO shares (post_id, user_id, comment)
       VALUES ($1, $2, $3)
       ON CONFLICT (post_id, user_id) DO UPDATE SET comment = $3`,
      [postId, req.user.userId, comment]
    );

    const countResult = await query<{ count: string }>(
      'SELECT COUNT(*) FROM shares WHERE post_id = $1',
      [postId]
    );

    res.json({
      shared: true,
      shares_count: parseInt(countResult.rows[0]?.count || '0'),
    });
  } catch (error) {
    console.error('SharePost error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getComments = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { postId } = req.params;

    const commentsResult = await query<Comment & { user: User }>(
      `SELECT c.*, row_to_json(u.*) as user
       FROM comments c
       JOIN users u ON c.user_id = u.id
       WHERE c.post_id = $1 AND c.parent_id IS NULL
       ORDER BY c.created_at ASC`,
      [postId]
    );

    // Get replies for each comment
    const commentsWithReplies = await Promise.all(
      commentsResult.rows.map(async (comment) => {
        const repliesResult = await query<Comment & { user: User }>(
          `SELECT c.*, row_to_json(u.*) as user
           FROM comments c
           JOIN users u ON c.user_id = u.id
           WHERE c.parent_id = $1
           ORDER BY c.created_at ASC`,
          [comment.id]
        );
        return { ...comment, replies: repliesResult.rows };
      })
    );

    res.json({ comments: commentsWithReplies });
  } catch (error) {
    console.error('GetComments error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createComment = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { postId } = req.params;
    const validated = createCommentSchema.parse(req.body);

    const result = await query<Comment>(
      `INSERT INTO comments (post_id, user_id, content, parent_id, timestamp_position)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [postId, req.user.userId, validated.content, validated.parent_id, validated.timestamp_position]
    );

    const userResult = await query<User>(
      'SELECT id, username, display_name, avatar_url FROM users WHERE id = $1',
      [req.user.userId]
    );

    const comment = {
      ...result.rows[0],
      user: userResult.rows[0],
    };

    res.status(201).json({ comment });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors });
      return;
    }
    console.error('CreateComment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getLikedPosts = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const { page = '1', limit = '20' } = req.query;
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    const result = await query<Post & { user: unknown }>(
      `SELECT p.*,
              row_to_json(u.*) as user,
              (SELECT COUNT(*) FROM post_likes WHERE post_id = p.id) as likes_count,
              (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comments_count,
              (SELECT COUNT(*) FROM shares WHERE post_id = p.id) as shares_count
              ${req.user ? `, EXISTS(SELECT 1 FROM post_likes WHERE post_id = p.id AND user_id = $4) as is_liked,
              EXISTS(SELECT 1 FROM shares WHERE post_id = p.id AND user_id = $4) as is_shared` : ''}
       FROM post_likes pl
       JOIN posts p ON pl.post_id = p.id
       JOIN users u ON p.user_id = u.id
       WHERE pl.user_id = $1
       ORDER BY pl.created_at DESC
       LIMIT $2 OFFSET $3`,
      req.user
        ? [userId, parseInt(limit as string), offset, req.user.userId]
        : [userId, parseInt(limit as string), offset]
    );

    res.json({ posts: result.rows });
  } catch (error) {
    console.error('GetLikedPosts error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const editPostSchema = z.object({
  content: z.string().max(2000).optional(),
  title: z.string().max(200).optional(),
  genre: z.string().max(100).optional(),
  tags: z.array(z.string()).optional(),
});

export const editPost = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { postId } = req.params;
    const validated = editPostSchema.parse(req.body);

    const updates: string[] = ['is_edited = true'];
    const values: unknown[] = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(validated)) {
      if (value !== undefined) {
        updates.push(`${key} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    }

    values.push(req.user.userId);
    values.push(postId);

    const result = await query<Post>(
      `UPDATE posts SET ${updates.join(', ')}, updated_at = NOW()
       WHERE id = $${paramIndex + 1} AND user_id = $${paramIndex}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Post not found or unauthorized' });
      return;
    }

    res.json({ post: result.rows[0] });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors });
      return;
    }
    console.error('EditPost error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deletePost = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { postId } = req.params;

    const result = await query('DELETE FROM posts WHERE id = $1 AND user_id = $2 RETURNING id', [
      postId,
      req.user.userId,
    ]);

    if (result.rowCount === 0) {
      res.status(404).json({ error: 'Post not found or unauthorized' });
      return;
    }

    res.json({ message: 'Post deleted successfully' });
  } catch (error) {
    console.error('DeletePost error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Trending posts: highest engagement (likes + comments + shares) in last 7 days
export const getTrendingPosts = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { limit = '20', genre } = req.query;
    const values: unknown[] = [parseInt(limit as string)];
    const genreClause = genre ? `AND p.genre ILIKE $2` : '';
    if (genre) values.push(`%${genre as string}%`);

    const result = await query<Post & { user: User }>(
      `SELECT p.*,
              row_to_json(u.*) as user,
              (SELECT COUNT(*) FROM post_likes WHERE post_id = p.id) as likes_count,
              (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comments_count,
              (SELECT COUNT(*) FROM shares WHERE post_id = p.id) as shares_count
              ${req.user ? `, EXISTS(SELECT 1 FROM post_likes WHERE post_id = p.id AND user_id = $${values.length + 1}) as is_liked,
              EXISTS(SELECT 1 FROM shares WHERE post_id = p.id AND user_id = $${values.length + 1}) as is_shared` : ''}
       FROM posts p
       JOIN users u ON p.user_id = u.id
       WHERE p.created_at >= NOW() - INTERVAL '7 days' AND p.audio_url IS NOT NULL ${genreClause}
       ORDER BY (
         (SELECT COUNT(*) FROM post_likes WHERE post_id = p.id) +
         (SELECT COUNT(*) FROM comments WHERE post_id = p.id) * 2 +
         (SELECT COUNT(*) FROM shares WHERE post_id = p.id) * 3 +
         p.play_count * 0.1
       ) DESC, p.created_at DESC
       LIMIT $1`,
      req.user ? [...values, req.user.userId] : values
    );

    res.json({ posts: result.rows });
  } catch (error) {
    console.error('GetTrendingPosts error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Popular posts: all-time most liked + played
export const getPopularPosts = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { limit = '20', genre } = req.query;
    const values: unknown[] = [parseInt(limit as string)];
    const genreClause = genre ? `AND p.genre ILIKE $2` : '';
    if (genre) values.push(`%${genre as string}%`);

    const result = await query<Post & { user: User }>(
      `SELECT p.*,
              row_to_json(u.*) as user,
              (SELECT COUNT(*) FROM post_likes WHERE post_id = p.id) as likes_count,
              (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comments_count,
              (SELECT COUNT(*) FROM shares WHERE post_id = p.id) as shares_count
              ${req.user ? `, EXISTS(SELECT 1 FROM post_likes WHERE post_id = p.id AND user_id = $${values.length + 1}) as is_liked,
              EXISTS(SELECT 1 FROM shares WHERE post_id = p.id AND user_id = $${values.length + 1}) as is_shared` : ''}
       FROM posts p
       JOIN users u ON p.user_id = u.id
       WHERE true ${genreClause}
       ORDER BY (
         (SELECT COUNT(*) FROM post_likes WHERE post_id = p.id) +
         p.play_count * 0.05
       ) DESC, p.created_at DESC
       LIMIT $1`,
      req.user ? [...values, req.user.userId] : values
    );

    res.json({ posts: result.rows });
  } catch (error) {
    console.error('GetPopularPosts error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Search posts by title, tags, genre, or user
export const searchPosts = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { q, genre, limit = '20' } = req.query;
    const conditions: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (q && typeof q === 'string') {
      conditions.push(
        `(p.title ILIKE $${idx} OR p.content ILIKE $${idx} OR $${idx + 1} = ANY(p.tags) OR u.username ILIKE $${idx} OR u.display_name ILIKE $${idx})`
      );
      values.push(`%${q}%`, q.toLowerCase());
      idx += 2;
    }

    if (genre && typeof genre === 'string') {
      conditions.push(`p.genre ILIKE $${idx}`);
      values.push(`%${genre}%`);
      idx++;
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    values.push(parseInt(limit as string));

    const result = await query<Post & { user: User }>(
      `SELECT p.*,
              row_to_json(u.*) as user,
              (SELECT COUNT(*) FROM post_likes WHERE post_id = p.id) as likes_count,
              (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comments_count,
              (SELECT COUNT(*) FROM shares WHERE post_id = p.id) as shares_count
              ${req.user ? `, EXISTS(SELECT 1 FROM post_likes WHERE post_id = p.id AND user_id = $${idx + 1}) as is_liked,
              EXISTS(SELECT 1 FROM shares WHERE post_id = p.id AND user_id = $${idx + 1}) as is_shared` : ''}
       FROM posts p
       JOIN users u ON p.user_id = u.id
       ${where}
       ORDER BY p.created_at DESC
       LIMIT $${idx}`,
      req.user ? [...values, req.user.userId] : values
    );

    res.json({ posts: result.rows });
  } catch (error) {
    console.error('SearchPosts error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
