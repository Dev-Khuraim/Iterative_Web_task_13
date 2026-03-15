import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import https from 'https';
import { query } from '../database/db.js';
import { generateToken, AuthenticatedRequest } from '../middleware/auth.js';
import type { User } from '../types/index.js';

const GOOGLE_CLIENT_ID = '614064235673-1v5jvb3npg0i5n6946gvto96ercdc7er.apps.googleusercontent.com';

const registerSchema = z.object({
  username: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_]+$/),
  email: z.string().email(),
  password: z.string().min(6),
  display_name: z.string().min(1).max(100).optional(),
  producer_type: z.string().max(100).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const validated = registerSchema.parse(req.body);
    const { username, email, password, display_name, producer_type } = validated;

    // Check if user exists
    const existingUser = await query<User>(
      'SELECT id FROM users WHERE email = $1 OR username = $2',
      [email, username]
    );

    if (existingUser.rows.length > 0) {
      res.status(400).json({ error: 'User with this email or username already exists' });
      return;
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 12);

    // Create user
    const result = await query<User>(
      `INSERT INTO users (username, email, password_hash, display_name, producer_type)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, username, email, display_name, bio, avatar_url, cover_image_url,
                 producer_type, genres, website, soundcloud_url, spotify_url,
                 is_online, created_at`,
      [username, email, password_hash, display_name || username, producer_type]
    );

    const user = result.rows[0];
    if (!user) {
      res.status(500).json({ error: 'Failed to create user' });
      return;
    }

    const token = generateToken({
      userId: user.id,
      username: user.username,
      email: user.email,
    });

    res.status(201).json({ user, token });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors });
      return;
    }
    console.error('Register error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const validated = loginSchema.parse(req.body);
    const { email, password } = validated;

    const result = await query<User>(
      `SELECT id, username, email, password_hash, display_name, bio, avatar_url,
              cover_image_url, producer_type, genres, website, soundcloud_url,
              spotify_url, is_online, created_at
       FROM users WHERE email = $1`,
      [email]
    );

    const user = result.rows[0];
    if (!user || !user.password_hash) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    // Update online status
    await query('UPDATE users SET is_online = true, last_seen = NOW() WHERE id = $1', [user.id]);

    // Remove password_hash from response
    const { password_hash: _, ...userWithoutPassword } = user;

    const token = generateToken({
      userId: user.id,
      username: user.username,
      email: user.email,
    });

    res.json({ user: userWithoutPassword, token });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors });
      return;
    }
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getMe = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const result = await query<User>(
      `SELECT id, username, email, display_name, bio, avatar_url, cover_image_url,
              producer_type, genres, website, soundcloud_url, spotify_url,
              is_online, created_at
       FROM users WHERE id = $1`,
      [req.user.userId]
    );

    const user = result.rows[0];
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({ user });
  } catch (error) {
    console.error('GetMe error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Fetch Google token info using built-in https
function fetchGoogleTokenInfo(idToken: string): Promise<Record<string, string>> {
  return new Promise((resolve, reject) => {
    const url = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`;
    https.get(url, (resp) => {
      let data = '';
      resp.on('data', (chunk) => { data += chunk; });
      resp.on('end', () => {
        try {
          const parsed = JSON.parse(data) as Record<string, string>;
          if (parsed.error) {
            reject(new Error(parsed.error_description || parsed.error));
          } else {
            resolve(parsed);
          }
        } catch {
          reject(new Error('Failed to parse Google response'));
        }
      });
    }).on('error', reject);
  });
}

export const googleAuth = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id_token } = req.body as { id_token?: string };

    if (!id_token) {
      res.status(400).json({ error: 'id_token is required' });
      return;
    }

    // Verify token with Google
    const tokenInfo = await fetchGoogleTokenInfo(id_token);

    // Verify the client ID
    if (tokenInfo.aud !== GOOGLE_CLIENT_ID) {
      res.status(401).json({ error: 'Invalid token audience' });
      return;
    }

    const googleId = tokenInfo.sub;
    const email = tokenInfo.email;
    const name = tokenInfo.name || tokenInfo.given_name || email?.split('@')[0] || 'User';
    const picture = tokenInfo.picture;

    if (!googleId || !email) {
      res.status(400).json({ error: 'Invalid Google token: missing sub or email' });
      return;
    }

    // Find existing user by email
    let userResult = await query<User>(
      `SELECT id, username, email, display_name, bio, avatar_url, cover_image_url,
              producer_type, genres, website, soundcloud_url, spotify_url, is_online, created_at
       FROM users WHERE email = $1`,
      [email]
    );

    let user = userResult.rows[0];

    if (!user) {
      // Create new user from Google profile
      const baseUsername = email.split('@')[0]!.replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 40);
      let username = baseUsername;

      // Ensure username is unique
      let suffix = 1;
      while (true) {
        const existing = await query<{ id: string }>(
          'SELECT id FROM users WHERE username = $1',
          [username]
        );
        if (existing.rows.length === 0) break;
        username = `${baseUsername}${suffix}`;
        suffix++;
      }

      const createResult = await query<User>(
        `INSERT INTO users (username, email, password_hash, display_name, avatar_url)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, username, email, display_name, bio, avatar_url, cover_image_url,
                   producer_type, genres, website, soundcloud_url, spotify_url,
                   is_online, created_at`,
        [username, email, '', name, picture || null]
      );

      user = createResult.rows[0];
      if (!user) {
        res.status(500).json({ error: 'Failed to create user' });
        return;
      }
    }

    // Update online status
    await query('UPDATE users SET is_online = true, last_seen = NOW() WHERE id = $1', [user.id]);

    const token = generateToken({
      userId: user.id,
      username: user.username,
      email: user.email,
    });

    res.json({ user, token });
  } catch (error) {
    console.error('GoogleAuth error:', error);
    res.status(401).json({ error: 'Google authentication failed' });
  }
};

export const logout = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (req.user) {
      await query('UPDATE users SET is_online = false, last_seen = NOW() WHERE id = $1', [
        req.user.userId,
      ]);
    }
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
