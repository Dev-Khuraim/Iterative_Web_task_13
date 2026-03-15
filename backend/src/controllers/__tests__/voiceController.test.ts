import {
  getVoiceRooms,
  createVoiceRoom,
  getVoiceRoom,
  joinVoiceRoom,
  leaveVoiceRoom,
  closeVoiceRoom,
} from '../voiceController';
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
  display_name: 'Test User',
  avatar_url: null,
};

const sampleRoom = {
  id: 'room-1',
  name: 'Test Room',
  host_id: 'user-1',
  is_private: false,
  max_participants: 10,
  genre: 'Hip-Hop',
  description: 'A test room',
  is_active: true,
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

// ─── getVoiceRooms ────────────────────────────────────────────────────────────

describe('getVoiceRooms', () => {
  it('returns voice rooms (unauthenticated)', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ ...sampleRoom, host: sampleUser, participant_count: 5 }],
      rowCount: 1,
    } as any);

    const req = makeReq({});
    const res = makeRes();
    await getVoiceRooms(req, res);

    expect(res.json).toHaveBeenCalledWith({
      rooms: expect.arrayContaining([
        expect.objectContaining({ id: 'room-1' }),
      ]),
    });
  });

  it('returns voice rooms (authenticated)', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ ...sampleRoom, host: sampleUser, participant_count: 5 }],
      rowCount: 1,
    } as any);

    const req = makeReq({ user: authUser });
    const res = makeRes();
    await getVoiceRooms(req, res);

    // Should pass userId for private room filtering
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('SELECT'),
      [authUser.userId]
    );
    expect(res.json).toHaveBeenCalledWith({
      rooms: expect.any(Array),
    });
  });

  it('returns 500 on database error', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB error'));

    const req = makeReq({});
    const res = makeRes();
    await getVoiceRooms(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
  });
});

// ─── createVoiceRoom ──────────────────────────────────────────────────────────

describe('createVoiceRoom', () => {
  it('returns 401 when not authenticated', async () => {
    const req = makeReq({ user: undefined });
    const res = makeRes();
    await createVoiceRoom(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Not authenticated' });
  });

  it('creates voice room successfully', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [sampleRoom], rowCount: 1 } as any) // Create room
      .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any) // Add host as participant
      .mockResolvedValueOnce({ rows: [sampleUser], rowCount: 1 } as any); // Get host info

    const req = makeReq({
      user: authUser,
      body: {
        name: 'Test Room',
        is_private: false,
        max_participants: 10,
        genre: 'Hip-Hop',
        description: 'A test room',
      },
    });
    const res = makeRes();
    await createVoiceRoom(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      room: expect.objectContaining({
        id: 'room-1',
        host: sampleUser,
        participant_count: 1,
      }),
    });
  });

  it('creates voice room with defaults', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [sampleRoom], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [sampleUser], rowCount: 1 } as any);

    const req = makeReq({
      user: authUser,
      body: {
        name: 'Test Room', // Only required field
      },
    });
    const res = makeRes();
    await createVoiceRoom(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('returns 500 when room creation fails', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

    const req = makeReq({
      user: authUser,
      body: { name: 'Test Room' },
    });
    const res = makeRes();
    await createVoiceRoom(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Failed to create room' });
  });

  it('returns 400 on Zod validation error', async () => {
    const req = makeReq({
      user: authUser,
      body: {
        name: '', // Too short
      },
    });
    const res = makeRes();
    await createVoiceRoom(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 400 on invalid max_participants', async () => {
    const req = makeReq({
      user: authUser,
      body: {
        name: 'Test Room',
        max_participants: 100, // Max is 50
      },
    });
    const res = makeRes();
    await createVoiceRoom(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 500 on database error', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB error'));

    const req = makeReq({
      user: authUser,
      body: { name: 'Test Room' },
    });
    const res = makeRes();
    await createVoiceRoom(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
  });
});

// ─── getVoiceRoom ─────────────────────────────────────────────────────────────

describe('getVoiceRoom', () => {
  it('returns voice room with participants', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ ...sampleRoom, host: sampleUser }], rowCount: 1 } as any) // Get room
      .mockResolvedValueOnce({
        rows: [{ room_id: 'room-1', user_id: 'user-1', user: sampleUser }],
        rowCount: 1,
      } as any); // Get participants

    const req = makeReq({ params: { roomId: 'room-1' } });
    const res = makeRes();
    await getVoiceRoom(req, res);

    expect(res.json).toHaveBeenCalledWith({
      room: expect.objectContaining({
        id: 'room-1',
        participants: expect.any(Array),
      }),
    });
  });

  it('returns 404 when room not found', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

    const req = makeReq({ params: { roomId: 'nonexistent' } });
    const res = makeRes();
    await getVoiceRoom(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Room not found' });
  });

  it('returns 500 on database error', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB error'));

    const req = makeReq({ params: { roomId: 'room-1' } });
    const res = makeRes();
    await getVoiceRoom(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
  });
});

// ─── joinVoiceRoom ────────────────────────────────────────────────────────────

describe('joinVoiceRoom', () => {
  it('returns 401 when not authenticated', async () => {
    const req = makeReq({ user: undefined, params: { roomId: 'room-1' } });
    const res = makeRes();
    await joinVoiceRoom(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Not authenticated' });
  });

  it('joins voice room successfully', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [sampleRoom], rowCount: 1 } as any) // Room check
      .mockResolvedValueOnce({ rows: [{ count: '5' }], rowCount: 1 } as any) // Participant count
      .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any) // Add participant
      .mockResolvedValueOnce({ rows: [sampleUser], rowCount: 1 } as any); // Get user info

    const req = makeReq({
      user: authUser,
      params: { roomId: 'room-1' },
    });
    const res = makeRes();
    await joinVoiceRoom(req, res);

    expect(res.json).toHaveBeenCalledWith({
      participant: expect.objectContaining({
        room_id: 'room-1',
        user_id: 'user-1',
        is_muted: false,
        is_speaking: false,
        user: sampleUser,
      }),
    });
  });

  it('returns 404 when room not found', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

    const req = makeReq({
      user: authUser,
      params: { roomId: 'nonexistent' },
    });
    const res = makeRes();
    await joinVoiceRoom(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Room not found or inactive' });
  });

  it('returns 404 when room row is undefined', async () => {
    // Edge case: rows exists but row is undefined
    mockQuery
      .mockResolvedValueOnce({ rows: [undefined], rowCount: 1 } as any);

    const req = makeReq({
      user: authUser,
      params: { roomId: 'room-1' },
    });
    const res = makeRes();
    await joinVoiceRoom(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Room not found' });
  });

  it('returns 400 when room is full', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ ...sampleRoom, max_participants: 5 }], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [{ count: '5' }], rowCount: 1 } as any); // Room is at capacity

    const req = makeReq({
      user: authUser,
      params: { roomId: 'room-1' },
    });
    const res = makeRes();
    await joinVoiceRoom(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Room is full' });
  });

  it('handles undefined count row', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ ...sampleRoom, max_participants: 5 }], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any) // No count row
      .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [sampleUser], rowCount: 1 } as any);

    const req = makeReq({
      user: authUser,
      params: { roomId: 'room-1' },
    });
    const res = makeRes();
    await joinVoiceRoom(req, res);

    // Should treat undefined count as 0 and allow join
    expect(res.json).toHaveBeenCalledWith({
      participant: expect.any(Object),
    });
  });

  it('returns 500 on database error', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB error'));

    const req = makeReq({
      user: authUser,
      params: { roomId: 'room-1' },
    });
    const res = makeRes();
    await joinVoiceRoom(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
  });
});

// ─── leaveVoiceRoom ───────────────────────────────────────────────────────────

describe('leaveVoiceRoom', () => {
  it('returns 401 when not authenticated', async () => {
    const req = makeReq({ user: undefined, params: { roomId: 'room-1' } });
    const res = makeRes();
    await leaveVoiceRoom(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Not authenticated' });
  });

  it('leaves voice room successfully (non-host)', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any) // Remove participant
      .mockResolvedValueOnce({ rows: [{ ...sampleRoom, host_id: 'user-2' }], rowCount: 1 } as any); // Check host

    const req = makeReq({
      user: authUser,
      params: { roomId: 'room-1' },
    });
    const res = makeRes();
    await leaveVoiceRoom(req, res);

    expect(res.json).toHaveBeenCalledWith({ success: true });
    expect(mockQuery).toHaveBeenCalledTimes(2); // Delete + check host
  });

  it('closes room when host leaves', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any) // Remove participant
      .mockResolvedValueOnce({ rows: [sampleRoom], rowCount: 1 } as any) // Check host (is host)
      .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any); // Close room

    const req = makeReq({
      user: authUser,
      params: { roomId: 'room-1' },
    });
    const res = makeRes();
    await leaveVoiceRoom(req, res);

    expect(res.json).toHaveBeenCalledWith({ success: true });
    expect(mockQuery).toHaveBeenCalledTimes(3); // Delete + check host + close
  });

  it('handles undefined room row gracefully', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any); // No room found

    const req = makeReq({
      user: authUser,
      params: { roomId: 'room-1' },
    });
    const res = makeRes();
    await leaveVoiceRoom(req, res);

    // Should still return success
    expect(res.json).toHaveBeenCalledWith({ success: true });
  });

  it('returns 500 on database error', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB error'));

    const req = makeReq({
      user: authUser,
      params: { roomId: 'room-1' },
    });
    const res = makeRes();
    await leaveVoiceRoom(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
  });
});

// ─── closeVoiceRoom ───────────────────────────────────────────────────────────

describe('closeVoiceRoom', () => {
  it('returns 401 when not authenticated', async () => {
    const req = makeReq({ user: undefined, params: { roomId: 'room-1' } });
    const res = makeRes();
    await closeVoiceRoom(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Not authenticated' });
  });

  it('closes voice room successfully', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'room-1' }], rowCount: 1 } as any) // Close room
      .mockResolvedValueOnce({ rows: [], rowCount: 5 } as any); // Remove participants

    const req = makeReq({
      user: authUser,
      params: { roomId: 'room-1' },
    });
    const res = makeRes();
    await closeVoiceRoom(req, res);

    expect(res.json).toHaveBeenCalledWith({ success: true });
  });

  it('returns 404 when room not found or unauthorized', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

    const req = makeReq({
      user: authUser,
      params: { roomId: 'nonexistent' },
    });
    const res = makeRes();
    await closeVoiceRoom(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Room not found or unauthorized' });
  });

  it('returns 500 on database error', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB error'));

    const req = makeReq({
      user: authUser,
      params: { roomId: 'room-1' },
    });
    const res = makeRes();
    await closeVoiceRoom(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
  });
});
