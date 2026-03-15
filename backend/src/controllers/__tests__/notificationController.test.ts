import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  createNotification,
} from '../notificationController';
import { query } from '../../database/db';
import type { Response } from 'express';
import type { AuthenticatedRequest } from '../../middleware/auth';

jest.mock('../../database/db', () => ({
  query: jest.fn(),
}));

const mockQuery = query as jest.MockedFunction<typeof query>;

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
  id: 'user-2',
  username: 'actor',
  display_name: 'Actor User',
  avatar_url: null,
};

const samplePost = {
  id: 'post-1',
  title: 'Test Post',
  audio_url: 'http://example.com/track.mp3',
};

const sampleNotification = {
  id: 'notif-1',
  user_id: 'user-1',
  type: 'like',
  actor_id: 'user-2',
  post_id: 'post-1',
  content: null,
  is_read: false,
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

// ─── getNotifications ─────────────────────────────────────────────────────────

describe('getNotifications', () => {
  it('returns 401 when not authenticated', async () => {
    const req = makeReq({ user: undefined });
    const res = makeRes();
    await getNotifications(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Not authenticated' });
  });

  it('returns notifications with default pagination', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ ...sampleNotification, actor: sampleUser, post: samplePost }],
      rowCount: 1,
    } as any);

    const req = makeReq({ user: authUser, query: {} });
    const res = makeRes();
    await getNotifications(req, res);

    expect(mockQuery).toHaveBeenCalledWith(
      expect.any(String),
      ['user-1', 20, 0] // default limit 20, offset 0 (page 1)
    );
    expect(res.json).toHaveBeenCalledWith({
      notifications: expect.arrayContaining([
        expect.objectContaining({ id: 'notif-1' }),
      ]),
    });
  });

  it('returns notifications with custom pagination', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

    const req = makeReq({
      user: authUser,
      query: { page: '3', limit: '10' },
    });
    const res = makeRes();
    await getNotifications(req, res);

    expect(mockQuery).toHaveBeenCalledWith(
      expect.any(String),
      ['user-1', 10, 20] // limit 10, offset 20 (page 3)
    );
    expect(res.json).toHaveBeenCalledWith({ notifications: [] });
  });

  it('returns 500 on database error', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB error'));

    const req = makeReq({ user: authUser, query: {} });
    const res = makeRes();
    await getNotifications(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
  });
});

// ─── getUnreadCount ───────────────────────────────────────────────────────────

describe('getUnreadCount', () => {
  it('returns 401 when not authenticated', async () => {
    const req = makeReq({ user: undefined });
    const res = makeRes();
    await getUnreadCount(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Not authenticated' });
  });

  it('returns unread count', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ count: '15' }],
      rowCount: 1,
    } as any);

    const req = makeReq({ user: authUser });
    const res = makeRes();
    await getUnreadCount(req, res);

    expect(res.json).toHaveBeenCalledWith({ count: 15 });
  });

  it('returns 0 when count row is undefined', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

    const req = makeReq({ user: authUser });
    const res = makeRes();
    await getUnreadCount(req, res);

    expect(res.json).toHaveBeenCalledWith({ count: 0 });
  });

  it('returns 500 on database error', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB error'));

    const req = makeReq({ user: authUser });
    const res = makeRes();
    await getUnreadCount(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
  });
});

// ─── markAsRead ───────────────────────────────────────────────────────────────

describe('markAsRead', () => {
  it('returns 401 when not authenticated', async () => {
    const req = makeReq({ user: undefined, params: { notificationId: 'notif-1' } });
    const res = makeRes();
    await markAsRead(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Not authenticated' });
  });

  it('marks notification as read', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);

    const req = makeReq({
      user: authUser,
      params: { notificationId: 'notif-1' },
    });
    const res = makeRes();
    await markAsRead(req, res);

    expect(mockQuery).toHaveBeenCalledWith(
      'UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2',
      ['notif-1', 'user-1']
    );
    expect(res.json).toHaveBeenCalledWith({ success: true });
  });

  it('returns 500 on database error', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB error'));

    const req = makeReq({
      user: authUser,
      params: { notificationId: 'notif-1' },
    });
    const res = makeRes();
    await markAsRead(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
  });
});

// ─── markAllAsRead ────────────────────────────────────────────────────────────

describe('markAllAsRead', () => {
  it('returns 401 when not authenticated', async () => {
    const req = makeReq({ user: undefined });
    const res = makeRes();
    await markAllAsRead(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Not authenticated' });
  });

  it('marks all notifications as read', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 10 } as any);

    const req = makeReq({ user: authUser });
    const res = makeRes();
    await markAllAsRead(req, res);

    expect(mockQuery).toHaveBeenCalledWith(
      'UPDATE notifications SET is_read = true WHERE user_id = $1',
      ['user-1']
    );
    expect(res.json).toHaveBeenCalledWith({ success: true });
  });

  it('returns 500 on database error', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB error'));

    const req = makeReq({ user: authUser });
    const res = makeRes();
    await markAllAsRead(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
  });
});

// ─── createNotification ───────────────────────────────────────────────────────

describe('createNotification', () => {
  it('creates notification successfully', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [sampleNotification],
      rowCount: 1,
    } as any);

    const result = await createNotification('user-1', 'like', 'user-2', 'post-1');

    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO notifications'),
      ['user-1', 'like', 'user-2', 'post-1', undefined]
    );
    expect(result).toEqual(sampleNotification);
  });

  it('creates notification with content', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ ...sampleNotification, content: 'Great track!' }],
      rowCount: 1,
    } as any);

    const result = await createNotification('user-1', 'comment', 'user-2', 'post-1', 'Great track!');

    expect(mockQuery).toHaveBeenCalledWith(
      expect.any(String),
      ['user-1', 'comment', 'user-2', 'post-1', 'Great track!']
    );
    expect(result?.content).toBe('Great track!');
  });

  it('returns null when trying to notify yourself', async () => {
    const result = await createNotification('user-1', 'like', 'user-1', 'post-1');

    expect(mockQuery).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });

  it('returns null when no notification is created', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

    const result = await createNotification('user-1', 'like', 'user-2', 'post-1');

    expect(result).toBeNull();
  });

  it('returns null on database error', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB error'));

    const result = await createNotification('user-1', 'like', 'user-2', 'post-1');

    expect(result).toBeNull();
  });
});
