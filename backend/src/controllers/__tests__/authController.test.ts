import { register, login, getMe, googleAuth, logout } from '../authController';
import { query } from '../../database/db';
import bcrypt from 'bcryptjs';
import https from 'https';
import type { Response } from 'express';
import type { AuthenticatedRequest } from '../../middleware/auth';

jest.mock('../../database/db', () => ({
  query: jest.fn(),
}));

jest.mock('bcryptjs', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

jest.mock('../../middleware/auth', () => ({
  generateToken: jest.fn().mockReturnValue('mock-token'),
}));

jest.mock('https', () => ({
  get: jest.fn(),
}));

const mockQuery = query as jest.MockedFunction<typeof query>;
const mockBcryptHash = bcrypt.hash as jest.MockedFunction<typeof bcrypt.hash>;
const mockBcryptCompare = bcrypt.compare as jest.MockedFunction<typeof bcrypt.compare>;
const mockHttpsGet = https.get as jest.MockedFunction<typeof https.get>;

function makeRes() {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response;
  return res;
}

function makeReq(overrides: Partial<AuthenticatedRequest> = {}): AuthenticatedRequest {
  return {
    query: {},
    params: {},
    body: {},
    headers: {},
    user: undefined,
    ...overrides,
  } as unknown as AuthenticatedRequest;
}

const sampleUser = {
  id: 'user-1',
  username: 'testuser',
  email: 'test@example.com',
  display_name: 'Test User',
  password_hash: 'hashed-password',
  bio: null,
  avatar_url: null,
  cover_image_url: null,
  producer_type: 'Beat Maker',
  genres: [],
  website: null,
  soundcloud_url: null,
  spotify_url: null,
  is_online: true,
  created_at: new Date().toISOString(),
};

const authUser = { userId: 'user-1', username: 'testuser', email: 'test@example.com' };

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  (console.error as jest.Mock).mockRestore();
});

// ─── register ─────────────────────────────────────────────────────────────────

describe('register', () => {
  it('registers a user successfully', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any) // Check existing user
      .mockResolvedValueOnce({ rows: [sampleUser], rowCount: 1 } as any); // Insert user
    mockBcryptHash.mockResolvedValueOnce('hashed-password' as never);

    const req = makeReq({
      body: {
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123',
        display_name: 'Test User',
        producer_type: 'Beat Maker',
      },
    });
    const res = makeRes();
    await register(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        user: expect.objectContaining({ id: 'user-1' }),
        token: 'mock-token',
      })
    );
  });

  it('registers a user without optional fields', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)
      .mockResolvedValueOnce({ rows: [sampleUser], rowCount: 1 } as any);
    mockBcryptHash.mockResolvedValueOnce('hashed-password' as never);

    const req = makeReq({
      body: {
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123',
      },
    });
    const res = makeRes();
    await register(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('returns 400 when user already exists', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'existing' }], rowCount: 1 } as any);

    const req = makeReq({
      body: {
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123',
      },
    });
    const res = makeRes();
    await register(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'User with this email or username already exists',
    });
  });

  it('returns 500 when user creation fails', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any); // No user returned
    mockBcryptHash.mockResolvedValueOnce('hashed-password' as never);

    const req = makeReq({
      body: {
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123',
      },
    });
    const res = makeRes();
    await register(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Failed to create user' });
  });

  it('returns 400 on Zod validation error', async () => {
    const req = makeReq({
      body: {
        username: 'ab', // too short
        email: 'invalid-email',
        password: '123',
      },
    });
    const res = makeRes();
    await register(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 400 on invalid username characters', async () => {
    const req = makeReq({
      body: {
        username: 'test user!',
        email: 'test@example.com',
        password: 'password123',
      },
    });
    const res = makeRes();
    await register(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 500 on database error', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB error'));

    const req = makeReq({
      body: {
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123',
      },
    });
    const res = makeRes();
    await register(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
  });
});

// ─── login ────────────────────────────────────────────────────────────────────

describe('login', () => {
  it('logs in a user successfully', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [sampleUser], rowCount: 1 } as any) // Find user
      .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any); // Update online status
    mockBcryptCompare.mockResolvedValueOnce(true as never);

    const req = makeReq({
      body: {
        email: 'test@example.com',
        password: 'password123',
      },
    });
    const res = makeRes();
    await login(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        user: expect.objectContaining({ id: 'user-1' }),
        token: 'mock-token',
      })
    );
  });

  it('returns 401 when user not found', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

    const req = makeReq({
      body: {
        email: 'nonexistent@example.com',
        password: 'password123',
      },
    });
    const res = makeRes();
    await login(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid credentials' });
  });

  it('returns 401 when user has no password hash (Google user)', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ ...sampleUser, password_hash: null }],
      rowCount: 1,
    } as any);

    const req = makeReq({
      body: {
        email: 'test@example.com',
        password: 'password123',
      },
    });
    const res = makeRes();
    await login(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid credentials' });
  });

  it('returns 401 when password is invalid', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [sampleUser], rowCount: 1 } as any);
    mockBcryptCompare.mockResolvedValueOnce(false as never);

    const req = makeReq({
      body: {
        email: 'test@example.com',
        password: 'wrongpassword',
      },
    });
    const res = makeRes();
    await login(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid credentials' });
  });

  it('returns 400 on Zod validation error', async () => {
    const req = makeReq({
      body: {
        email: 'invalid-email',
        password: '',
      },
    });
    const res = makeRes();
    await login(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 500 on database error', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB error'));

    const req = makeReq({
      body: {
        email: 'test@example.com',
        password: 'password123',
      },
    });
    const res = makeRes();
    await login(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
  });
});

// ─── getMe ────────────────────────────────────────────────────────────────────

describe('getMe', () => {
  it('returns current user when authenticated', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [sampleUser], rowCount: 1 } as any);

    const req = makeReq({ user: authUser });
    const res = makeRes();
    await getMe(req, res);

    expect(res.json).toHaveBeenCalledWith({
      user: expect.objectContaining({ id: 'user-1' }),
    });
  });

  it('returns 401 when not authenticated', async () => {
    const req = makeReq({ user: undefined });
    const res = makeRes();
    await getMe(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Not authenticated' });
  });

  it('returns 404 when user not found', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

    const req = makeReq({ user: authUser });
    const res = makeRes();
    await getMe(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'User not found' });
  });

  it('returns 500 on database error', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB error'));

    const req = makeReq({ user: authUser });
    const res = makeRes();
    await getMe(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
  });
});

// ─── googleAuth ───────────────────────────────────────────────────────────────

describe('googleAuth', () => {
  const mockGoogleResponse = (data: Record<string, string>) => {
    interface MockResponse {
      on: jest.Mock;
    }
    const mockResponse: MockResponse = {
      on: jest.fn((event: string, callback: (chunk?: string) => void): MockResponse => {
        if (event === 'data') {
          callback(JSON.stringify(data));
        }
        if (event === 'end') {
          callback();
        }
        return mockResponse;
      }),
    };
    mockHttpsGet.mockImplementationOnce((url, callback) => {
      (callback as (res: MockResponse) => void)(mockResponse);
      return { on: jest.fn().mockReturnThis() } as any;
    });
  };

  const mockGoogleError = (error: Error) => {
    mockHttpsGet.mockImplementationOnce((url, callback) => {
      return {
        on: jest.fn((event, cb) => {
          if (event === 'error') {
            cb(error);
          }
          return { on: jest.fn().mockReturnThis() };
        }),
      } as any;
    });
  };

  it('returns 400 when id_token is missing', async () => {
    const req = makeReq({ body: {} });
    const res = makeRes();
    await googleAuth(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'id_token is required' });
  });

  it('returns 401 when token audience is invalid', async () => {
    mockGoogleResponse({
      sub: 'google-id',
      email: 'test@gmail.com',
      name: 'Test User',
      aud: 'wrong-client-id',
    });

    const req = makeReq({ body: { id_token: 'valid-token' } });
    const res = makeRes();
    await googleAuth(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid token audience' });
  });

  it('returns 400 when Google token is missing sub or email', async () => {
    mockGoogleResponse({
      aud: '614064235673-1v5jvb3npg0i5n6946gvto96ercdc7er.apps.googleusercontent.com',
    });

    const req = makeReq({ body: { id_token: 'valid-token' } });
    const res = makeRes();
    await googleAuth(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Invalid Google token: missing sub or email',
    });
  });

  it('logs in existing user', async () => {
    mockGoogleResponse({
      sub: 'google-id',
      email: 'test@gmail.com',
      name: 'Test User',
      picture: 'http://example.com/pic.jpg',
      aud: '614064235673-1v5jvb3npg0i5n6946gvto96ercdc7er.apps.googleusercontent.com',
    });

    mockQuery
      .mockResolvedValueOnce({ rows: [sampleUser], rowCount: 1 } as any) // Find existing user
      .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any); // Update online status

    const req = makeReq({ body: { id_token: 'valid-token' } });
    const res = makeRes();
    await googleAuth(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        user: expect.objectContaining({ id: 'user-1' }),
        token: 'mock-token',
      })
    );
  });

  it('creates new user from Google profile', async () => {
    mockGoogleResponse({
      sub: 'google-id',
      email: 'newuser@gmail.com',
      name: 'New User',
      picture: 'http://example.com/pic.jpg',
      aud: '614064235673-1v5jvb3npg0i5n6946gvto96ercdc7er.apps.googleusercontent.com',
    });

    mockQuery
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any) // No existing user
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any) // Username check (unique)
      .mockResolvedValueOnce({ rows: [{ ...sampleUser, email: 'newuser@gmail.com' }], rowCount: 1 } as any) // Create user
      .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any); // Update online status

    const req = makeReq({ body: { id_token: 'valid-token' } });
    const res = makeRes();
    await googleAuth(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        user: expect.any(Object),
        token: 'mock-token',
      })
    );
  });

  it('creates new user with unique username when collision exists', async () => {
    mockGoogleResponse({
      sub: 'google-id',
      email: 'test@gmail.com',
      given_name: 'Test',
      aud: '614064235673-1v5jvb3npg0i5n6946gvto96ercdc7er.apps.googleusercontent.com',
    });

    mockQuery
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any) // No existing user
      .mockResolvedValueOnce({ rows: [{ id: 'existing' }], rowCount: 1 } as any) // Username exists
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any) // Username with suffix is unique
      .mockResolvedValueOnce({ rows: [sampleUser], rowCount: 1 } as any) // Create user
      .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any); // Update online status

    const req = makeReq({ body: { id_token: 'valid-token' } });
    const res = makeRes();
    await googleAuth(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        user: expect.any(Object),
        token: 'mock-token',
      })
    );
  });

  it('uses email prefix when name is not available', async () => {
    mockGoogleResponse({
      sub: 'google-id',
      email: 'username@gmail.com',
      aud: '614064235673-1v5jvb3npg0i5n6946gvto96ercdc7er.apps.googleusercontent.com',
    });

    mockQuery
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)
      .mockResolvedValueOnce({ rows: [sampleUser], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);

    const req = makeReq({ body: { id_token: 'valid-token' } });
    const res = makeRes();
    await googleAuth(req, res);

    expect(res.json).toHaveBeenCalled();
  });

  it('returns 500 when user creation fails', async () => {
    mockGoogleResponse({
      sub: 'google-id',
      email: 'test@gmail.com',
      name: 'Test User',
      aud: '614064235673-1v5jvb3npg0i5n6946gvto96ercdc7er.apps.googleusercontent.com',
    });

    mockQuery
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any); // User creation returns empty

    const req = makeReq({ body: { id_token: 'valid-token' } });
    const res = makeRes();
    await googleAuth(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Failed to create user' });
  });

  it('returns 401 on Google API error', async () => {
    mockGoogleError(new Error('Network error'));

    const req = makeReq({ body: { id_token: 'valid-token' } });
    const res = makeRes();
    await googleAuth(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Google authentication failed' });
  });

  it('returns 401 when Google returns error response', async () => {
    mockGoogleResponse({
      error: 'invalid_token',
      error_description: 'Token is invalid',
    });

    const req = makeReq({ body: { id_token: 'invalid-token' } });
    const res = makeRes();
    await googleAuth(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Google authentication failed' });
  });

  it('returns 401 when Google returns error without description', async () => {
    mockGoogleResponse({
      error: 'unknown_error',
    });

    const req = makeReq({ body: { id_token: 'invalid-token' } });
    const res = makeRes();
    await googleAuth(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Google authentication failed' });
  });

  it('returns 401 when Google response is not valid JSON', async () => {
    interface MockResponse {
      on: jest.Mock;
    }
    mockHttpsGet.mockImplementationOnce((url, callback) => {
      const mockResponse: MockResponse = {
        on: jest.fn((event: string, cb: (chunk?: string) => void): MockResponse => {
          if (event === 'data') {
            cb('not-valid-json');
          }
          if (event === 'end') {
            cb();
          }
          return mockResponse;
        }),
      };
      (callback as (res: MockResponse) => void)(mockResponse);
      return { on: jest.fn().mockReturnThis() } as any;
    });

    const req = makeReq({ body: { id_token: 'valid-token' } });
    const res = makeRes();
    await googleAuth(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Google authentication failed' });
  });
});

// ─── logout ───────────────────────────────────────────────────────────────────

describe('logout', () => {
  it('logs out authenticated user', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);

    const req = makeReq({ user: authUser });
    const res = makeRes();
    await logout(req, res);

    expect(mockQuery).toHaveBeenCalledWith(
      'UPDATE users SET is_online = false, last_seen = NOW() WHERE id = $1',
      ['user-1']
    );
    expect(res.json).toHaveBeenCalledWith({ message: 'Logged out successfully' });
  });

  it('logs out without user (unauthenticated)', async () => {
    const req = makeReq({ user: undefined });
    const res = makeRes();
    await logout(req, res);

    expect(mockQuery).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ message: 'Logged out successfully' });
  });

  it('returns 500 on database error', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB error'));

    const req = makeReq({ user: authUser });
    const res = makeRes();
    await logout(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
  });
});
