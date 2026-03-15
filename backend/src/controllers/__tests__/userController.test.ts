import {
  getUser,
  updateProfile,
  followUser,
  unfollowUser,
  sendFriendRequest,
  respondToFriendRequest,
  getFriends,
  getPendingRequests,
  searchUsers,
} from '../userController';
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
  id: 'user-1',
  username: 'testuser',
  email: 'test@example.com',
  display_name: 'Test User',
  bio: 'A bio',
  avatar_url: null,
  cover_image_url: null,
  producer_type: 'Beat Maker',
  genres: ['Hip-Hop'],
  website: null,
  soundcloud_url: null,
  spotify_url: null,
  is_online: true,
  last_seen: new Date().toISOString(),
  created_at: new Date().toISOString(),
};

const authUser = { userId: 'user-1', username: 'testuser', email: 'test@example.com' };
const otherUser = { userId: 'user-2', username: 'otheruser', email: 'other@example.com' };

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  (console.error as jest.Mock).mockRestore();
});

// ─── getUser ──────────────────────────────────────────────────────────────────

describe('getUser', () => {
  it('returns user with stats (unauthenticated)', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [sampleUser], rowCount: 1 } as any) // Get user
      .mockResolvedValueOnce({ rows: [{ count: '100' }], rowCount: 1 } as any) // Followers
      .mockResolvedValueOnce({ rows: [{ count: '50' }], rowCount: 1 } as any) // Following
      .mockResolvedValueOnce({ rows: [{ count: '25' }], rowCount: 1 } as any); // Posts

    const req = makeReq({ params: { userId: 'user-1' } });
    const res = makeRes();
    await getUser(req, res);

    expect(res.json).toHaveBeenCalledWith({
      user: expect.objectContaining({
        id: 'user-1',
        followers_count: 100,
        following_count: 50,
        posts_count: 25,
        friendship_status: null,
        is_following: false,
      }),
    });
  });

  it('returns user with friendship status (authenticated, viewing other user)', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ ...sampleUser, id: 'user-2' }], rowCount: 1 } as any) // Get user
      .mockResolvedValueOnce({ rows: [{ count: '100' }], rowCount: 1 } as any) // Followers
      .mockResolvedValueOnce({ rows: [{ count: '50' }], rowCount: 1 } as any) // Following
      .mockResolvedValueOnce({ rows: [{ count: '25' }], rowCount: 1 } as any) // Posts
      .mockResolvedValueOnce({ rows: [{ status: 'accepted' }], rowCount: 1 } as any) // Friendship
      .mockResolvedValueOnce({ rows: [{ id: 'follow-1' }], rowCount: 1 } as any); // Is following

    const req = makeReq({ params: { userId: 'user-2' }, user: authUser });
    const res = makeRes();
    await getUser(req, res);

    expect(res.json).toHaveBeenCalledWith({
      user: expect.objectContaining({
        friendship_status: 'accepted',
        is_following: true,
      }),
    });
  });

  it('returns user without friendship check when viewing own profile', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [sampleUser], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [{ count: '100' }], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [{ count: '50' }], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [{ count: '25' }], rowCount: 1 } as any);

    const req = makeReq({ params: { userId: 'user-1' }, user: authUser });
    const res = makeRes();
    await getUser(req, res);

    // Should not query friendship/following status for own profile
    expect(mockQuery).toHaveBeenCalledTimes(4);
  });

  it('handles null friendship status', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ ...sampleUser, id: 'user-2' }], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any) // No friendship
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any); // Not following

    const req = makeReq({ params: { userId: 'user-2' }, user: authUser });
    const res = makeRes();
    await getUser(req, res);

    expect(res.json).toHaveBeenCalledWith({
      user: expect.objectContaining({
        friendship_status: null,
        is_following: false,
      }),
    });
  });

  it('handles undefined count rows', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [sampleUser], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any) // Empty followers
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any) // Empty following
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any); // Empty posts

    const req = makeReq({ params: { userId: 'user-1' } });
    const res = makeRes();
    await getUser(req, res);

    expect(res.json).toHaveBeenCalledWith({
      user: expect.objectContaining({
        followers_count: 0,
        following_count: 0,
        posts_count: 0,
      }),
    });
  });

  it('returns 404 when user not found', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

    const req = makeReq({ params: { userId: 'nonexistent' } });
    const res = makeRes();
    await getUser(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'User not found' });
  });

  it('returns 500 on database error', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB error'));

    const req = makeReq({ params: { userId: 'user-1' } });
    const res = makeRes();
    await getUser(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
  });
});

// ─── updateProfile ────────────────────────────────────────────────────────────

describe('updateProfile', () => {
  it('returns 401 when not authenticated', async () => {
    const req = makeReq({ user: undefined });
    const res = makeRes();
    await updateProfile(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Not authenticated' });
  });

  it('updates profile successfully', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [sampleUser], rowCount: 1 } as any);

    const req = makeReq({
      user: authUser,
      body: {
        display_name: 'New Name',
        bio: 'New bio',
        producer_type: 'Vocalist',
      },
    });
    const res = makeRes();
    await updateProfile(req, res);

    expect(res.json).toHaveBeenCalledWith({ user: sampleUser });
  });

  it('updates profile with genres array', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [sampleUser], rowCount: 1 } as any);

    const req = makeReq({
      user: authUser,
      body: {
        genres: ['Hip-Hop', 'R&B'],
      },
    });
    const res = makeRes();
    await updateProfile(req, res);

    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE users SET'),
      expect.arrayContaining([['Hip-Hop', 'R&B']])
    );
  });

  it('updates profile with URLs', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [sampleUser], rowCount: 1 } as any);

    const req = makeReq({
      user: authUser,
      body: {
        website: 'https://example.com',
        soundcloud_url: 'https://soundcloud.com/user',
        spotify_url: 'https://spotify.com/artist',
        avatar_url: 'https://example.com/avatar.jpg',
        cover_image_url: 'https://example.com/cover.jpg',
      },
    });
    const res = makeRes();
    await updateProfile(req, res);

    expect(res.json).toHaveBeenCalledWith({ user: sampleUser });
  });

  it('handles empty string URLs (clearing URLs)', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [sampleUser], rowCount: 1 } as any);

    const req = makeReq({
      user: authUser,
      body: {
        website: '',
        soundcloud_url: '',
      },
    });
    const res = makeRes();
    await updateProfile(req, res);

    // Empty strings are converted to null
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE users SET'),
      expect.arrayContaining([null, null])
    );
  });

  it('returns 400 when no fields to update', async () => {
    const req = makeReq({
      user: authUser,
      body: {},
    });
    const res = makeRes();
    await updateProfile(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'No fields to update' });
  });

  it('skips undefined values in update (covers value !== undefined branch)', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [sampleUser], rowCount: 1 } as any);

    // When Zod parses, all optional fields that are not provided are undefined
    // We need to send a request where some fields validate but others are undefined
    const req = makeReq({
      user: authUser,
      body: { display_name: 'Updated', bio: undefined },
    });
    const res = makeRes();
    await updateProfile(req, res);

    // Only display_name should be in the update, not bio
    const [sql, params] = mockQuery.mock.calls[0]!;
    expect(sql).toContain('display_name');
    expect(params).toHaveLength(2); // display_name value + userId
    expect(res.json).toHaveBeenCalledWith({ user: sampleUser });
  });

  it('returns 400 on Zod validation error', async () => {
    const req = makeReq({
      user: authUser,
      body: {
        bio: 'x'.repeat(501), // Too long
      },
    });
    const res = makeRes();
    await updateProfile(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 400 on invalid URL', async () => {
    const req = makeReq({
      user: authUser,
      body: {
        website: 'not-a-valid-url',
      },
    });
    const res = makeRes();
    await updateProfile(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 500 on database error', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB error'));

    const req = makeReq({
      user: authUser,
      body: { display_name: 'Test' },
    });
    const res = makeRes();
    await updateProfile(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
  });
});

// ─── followUser ───────────────────────────────────────────────────────────────

describe('followUser', () => {
  it('returns 401 when not authenticated', async () => {
    const req = makeReq({ user: undefined, params: { userId: 'user-2' } });
    const res = makeRes();
    await followUser(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Not authenticated' });
  });

  it('follows a user successfully', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);

    const req = makeReq({ user: authUser, params: { userId: 'user-2' } });
    const res = makeRes();
    await followUser(req, res);

    expect(res.json).toHaveBeenCalledWith({ message: 'Successfully followed user' });
  });

  it('returns 400 when trying to follow yourself', async () => {
    const req = makeReq({ user: authUser, params: { userId: 'user-1' } });
    const res = makeRes();
    await followUser(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Cannot follow yourself' });
  });

  it('returns 500 on database error', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB error'));

    const req = makeReq({ user: authUser, params: { userId: 'user-2' } });
    const res = makeRes();
    await followUser(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
  });
});

// ─── unfollowUser ─────────────────────────────────────────────────────────────

describe('unfollowUser', () => {
  it('returns 401 when not authenticated', async () => {
    const req = makeReq({ user: undefined, params: { userId: 'user-2' } });
    const res = makeRes();
    await unfollowUser(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Not authenticated' });
  });

  it('unfollows a user successfully', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);

    const req = makeReq({ user: authUser, params: { userId: 'user-2' } });
    const res = makeRes();
    await unfollowUser(req, res);

    expect(res.json).toHaveBeenCalledWith({ message: 'Successfully unfollowed user' });
  });

  it('returns 500 on database error', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB error'));

    const req = makeReq({ user: authUser, params: { userId: 'user-2' } });
    const res = makeRes();
    await unfollowUser(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
  });
});

// ─── sendFriendRequest ────────────────────────────────────────────────────────

describe('sendFriendRequest', () => {
  it('returns 401 when not authenticated', async () => {
    const req = makeReq({ user: undefined, params: { userId: 'user-2' } });
    const res = makeRes();
    await sendFriendRequest(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Not authenticated' });
  });

  it('sends friend request successfully', async () => {
    const friendship = { id: 'friendship-1', requester_id: 'user-1', addressee_id: 'user-2', status: 'pending' };
    mockQuery
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any) // No existing friendship
      .mockResolvedValueOnce({ rows: [friendship], rowCount: 1 } as any); // Create friendship

    const req = makeReq({ user: authUser, params: { userId: 'user-2' } });
    const res = makeRes();
    await sendFriendRequest(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ friendship });
  });

  it('returns 400 when trying to friend yourself', async () => {
    const req = makeReq({ user: authUser, params: { userId: 'user-1' } });
    const res = makeRes();
    await sendFriendRequest(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Cannot send friend request to yourself' });
  });

  it('returns 400 when friendship already exists', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'existing', status: 'pending' }],
      rowCount: 1,
    } as any);

    const req = makeReq({ user: authUser, params: { userId: 'user-2' } });
    const res = makeRes();
    await sendFriendRequest(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Friendship already exists or pending' });
  });

  it('returns 500 on database error', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB error'));

    const req = makeReq({ user: authUser, params: { userId: 'user-2' } });
    const res = makeRes();
    await sendFriendRequest(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
  });
});

// ─── respondToFriendRequest ───────────────────────────────────────────────────

describe('respondToFriendRequest', () => {
  it('returns 401 when not authenticated', async () => {
    const req = makeReq({ user: undefined, params: { friendshipId: 'friendship-1' } });
    const res = makeRes();
    await respondToFriendRequest(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Not authenticated' });
  });

  it('accepts friend request successfully', async () => {
    const friendship = { id: 'friendship-1', status: 'accepted' };
    mockQuery.mockResolvedValueOnce({ rows: [friendship], rowCount: 1 } as any);

    const req = makeReq({
      user: authUser,
      params: { friendshipId: 'friendship-1' },
      body: { accept: true },
    });
    const res = makeRes();
    await respondToFriendRequest(req, res);

    expect(res.json).toHaveBeenCalledWith({ friendship });
  });

  it('rejects friend request successfully', async () => {
    const friendship = { id: 'friendship-1', status: 'rejected' };
    mockQuery.mockResolvedValueOnce({ rows: [friendship], rowCount: 1 } as any);

    const req = makeReq({
      user: authUser,
      params: { friendshipId: 'friendship-1' },
      body: { accept: false },
    });
    const res = makeRes();
    await respondToFriendRequest(req, res);

    expect(res.json).toHaveBeenCalledWith({ friendship });
  });

  it('returns 404 when friend request not found', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

    const req = makeReq({
      user: authUser,
      params: { friendshipId: 'nonexistent' },
      body: { accept: true },
    });
    const res = makeRes();
    await respondToFriendRequest(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Friend request not found' });
  });

  it('returns 500 on database error', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB error'));

    const req = makeReq({
      user: authUser,
      params: { friendshipId: 'friendship-1' },
      body: { accept: true },
    });
    const res = makeRes();
    await respondToFriendRequest(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
  });
});

// ─── getFriends ───────────────────────────────────────────────────────────────

describe('getFriends', () => {
  it('returns 401 when not authenticated', async () => {
    const req = makeReq({ user: undefined });
    const res = makeRes();
    await getFriends(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Not authenticated' });
  });

  it('returns friends list', async () => {
    const friends = [
      { id: 'friendship-1', friend: sampleUser },
    ];
    mockQuery.mockResolvedValueOnce({ rows: friends, rowCount: 1 } as any);

    const req = makeReq({ user: authUser });
    const res = makeRes();
    await getFriends(req, res);

    expect(res.json).toHaveBeenCalledWith({ friends });
  });

  it('returns 500 on database error', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB error'));

    const req = makeReq({ user: authUser });
    const res = makeRes();
    await getFriends(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
  });
});

// ─── getPendingRequests ───────────────────────────────────────────────────────

describe('getPendingRequests', () => {
  it('returns 401 when not authenticated', async () => {
    const req = makeReq({ user: undefined });
    const res = makeRes();
    await getPendingRequests(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Not authenticated' });
  });

  it('returns pending friend requests', async () => {
    const requests = [
      { id: 'friendship-1', status: 'pending', requester: sampleUser },
    ];
    mockQuery.mockResolvedValueOnce({ rows: requests, rowCount: 1 } as any);

    const req = makeReq({ user: authUser });
    const res = makeRes();
    await getPendingRequests(req, res);

    expect(res.json).toHaveBeenCalledWith({ requests });
  });

  it('returns 500 on database error', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB error'));

    const req = makeReq({ user: authUser });
    const res = makeRes();
    await getPendingRequests(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
  });
});

// ─── searchUsers ──────────────────────────────────────────────────────────────

describe('searchUsers', () => {
  it('returns all users when no filters', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [sampleUser], rowCount: 1 } as any);

    const req = makeReq({ query: {} });
    const res = makeRes();
    await searchUsers(req, res);

    expect(res.json).toHaveBeenCalledWith({ users: [sampleUser] });
  });

  it('searches by query string', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [sampleUser], rowCount: 1 } as any);

    const req = makeReq({ query: { q: 'test' } });
    const res = makeRes();
    await searchUsers(req, res);

    const [sql, params] = mockQuery.mock.calls[0]!;
    expect(sql).toContain('username ILIKE');
    expect(sql).toContain('display_name ILIKE');
    expect(params).toContain('%test%');
  });

  it('searches by genre', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [sampleUser], rowCount: 1 } as any);

    const req = makeReq({ query: { genre: 'Hip-Hop' } });
    const res = makeRes();
    await searchUsers(req, res);

    const [sql, params] = mockQuery.mock.calls[0]!;
    expect(sql).toContain('= ANY(genres)');
    expect(params).toContain('Hip-Hop');
  });

  it('searches by producer_type', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [sampleUser], rowCount: 1 } as any);

    const req = makeReq({ query: { producer_type: 'Beat Maker' } });
    const res = makeRes();
    await searchUsers(req, res);

    const [sql, params] = mockQuery.mock.calls[0]!;
    expect(sql).toContain('producer_type ILIKE');
    expect(params).toContain('%Beat Maker%');
  });

  it('combines multiple filters', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

    const req = makeReq({
      query: {
        q: 'test',
        genre: 'Hip-Hop',
        producer_type: 'Beat Maker',
      },
    });
    const res = makeRes();
    await searchUsers(req, res);

    const [sql, params] = mockQuery.mock.calls[0]!;
    expect(sql).toContain('AND');
    expect(params).toContain('%test%');
    expect(params).toContain('Hip-Hop');
    expect(params).toContain('%Beat Maker%');
  });

  it('returns 500 on database error', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB error'));

    const req = makeReq({ query: {} });
    const res = makeRes();
    await searchUsers(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
  });
});
