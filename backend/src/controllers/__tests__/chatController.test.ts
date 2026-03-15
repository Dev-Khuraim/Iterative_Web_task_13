import {
  getConversations,
  getOrCreateConversation,
  getMessages,
  sendMessage,
  addGroupMember,
  removeGroupMember,
  getGroupMembers,
  markAsRead,
} from '../chatController';
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

// Use valid UUIDs
const USER_ID_1 = '550e8400-e29b-41d4-a716-446655440001';
const USER_ID_2 = '550e8400-e29b-41d4-a716-446655440002';
const USER_ID_3 = '550e8400-e29b-41d4-a716-446655440003';
const CONV_ID = '550e8400-e29b-41d4-a716-446655440010';
const MSG_ID = '550e8400-e29b-41d4-a716-446655440020';

const sampleUser = {
  id: USER_ID_1,
  username: 'testuser',
  display_name: 'Test User',
  avatar_url: null,
  is_online: true,
};

const sampleConversation = {
  id: CONV_ID,
  is_group: false,
  name: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const sampleMessage = {
  id: MSG_ID,
  conversation_id: CONV_ID,
  sender_id: USER_ID_1,
  content: 'Hello!',
  message_type: 'text',
  created_at: new Date().toISOString(),
};

const authUser = { userId: USER_ID_1, username: 'testuser', email: 'test@example.com' };

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  (console.error as jest.Mock).mockRestore();
});

// ─── getConversations ─────────────────────────────────────────────────────────

describe('getConversations', () => {
  it('returns 401 when not authenticated', async () => {
    const req = makeReq({ user: undefined });
    const res = makeRes();
    await getConversations(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Not authenticated' });
  });

  it('returns conversations list', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          ...sampleConversation,
          participants: [sampleUser],
          last_message: sampleMessage,
          unread_count: '3',
        },
      ],
      rowCount: 1,
    } as any);

    const req = makeReq({ user: authUser });
    const res = makeRes();
    await getConversations(req, res);

    expect(res.json).toHaveBeenCalledWith({
      conversations: expect.arrayContaining([
        expect.objectContaining({ id: CONV_ID }),
      ]),
    });
  });

  it('returns 500 on database error', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB error'));

    const req = makeReq({ user: authUser });
    const res = makeRes();
    await getConversations(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
  });
});

// ─── getOrCreateConversation ──────────────────────────────────────────────────

describe('getOrCreateConversation', () => {
  it('returns 401 when not authenticated', async () => {
    const req = makeReq({ user: undefined });
    const res = makeRes();
    await getOrCreateConversation(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Not authenticated' });
  });

  it('returns existing 1-on-1 conversation', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [sampleConversation], rowCount: 1 } as any) // Find existing
      .mockResolvedValueOnce({ rows: [sampleUser], rowCount: 1 } as any); // Get participants

    const req = makeReq({
      user: authUser,
      body: { participant_ids: [USER_ID_2] },
    });
    const res = makeRes();
    await getOrCreateConversation(req, res);

    expect(res.json).toHaveBeenCalledWith({
      conversation: expect.objectContaining({
        id: CONV_ID,
        participants: [sampleUser],
      }),
    });
  });

  it('creates new conversation when existing.rows[0] is undefined', async () => {
    // Covers the false branch of `if (conversation)` when rows has length but first element is falsy
    mockQuery
      .mockResolvedValueOnce({ rows: [undefined], rowCount: 1 } as any) // existing has length but row is undefined
      .mockResolvedValueOnce({ rows: [sampleConversation], rowCount: 1 } as any) // Create conversation
      .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any) // Add participant 1
      .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any) // Add participant 2
      .mockResolvedValueOnce({ rows: [sampleUser], rowCount: 1 } as any); // Get participants

    const req = makeReq({
      user: authUser,
      body: { participant_ids: [USER_ID_2] },
    });
    const res = makeRes();
    await getOrCreateConversation(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('creates new 1-on-1 conversation when none exists', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any) // No existing
      .mockResolvedValueOnce({ rows: [sampleConversation], rowCount: 1 } as any) // Create conversation
      .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any) // Add participant 1
      .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any) // Add participant 2
      .mockResolvedValueOnce({ rows: [sampleUser], rowCount: 1 } as any); // Get participants

    const req = makeReq({
      user: authUser,
      body: { participant_ids: [USER_ID_2] },
    });
    const res = makeRes();
    await getOrCreateConversation(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      conversation: expect.objectContaining({
        id: CONV_ID,
        participants: [sampleUser],
      }),
    });
  });

  it('creates new group conversation', async () => {
    const groupConv = { ...sampleConversation, is_group: true, name: 'Test Group' };
    mockQuery
      .mockResolvedValueOnce({ rows: [groupConv], rowCount: 1 } as any) // Create conversation
      .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any) // Add participant 1
      .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any) // Add participant 2
      .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any) // Add participant 3
      .mockResolvedValueOnce({ rows: [sampleUser], rowCount: 1 } as any); // Get participants

    const req = makeReq({
      user: authUser,
      body: { participant_ids: [USER_ID_2, USER_ID_3], is_group: true, name: 'Test Group' },
    });
    const res = makeRes();
    await getOrCreateConversation(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('returns 500 when conversation creation fails', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any) // No existing
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any); // Creation returns empty

    const req = makeReq({
      user: authUser,
      body: { participant_ids: [USER_ID_2] },
    });
    const res = makeRes();
    await getOrCreateConversation(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Failed to create conversation' });
  });

  it('returns 400 on Zod validation error', async () => {
    const req = makeReq({
      user: authUser,
      body: { participant_ids: [] }, // Empty array
    });
    const res = makeRes();
    await getOrCreateConversation(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 500 on database error', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB error'));

    const req = makeReq({
      user: authUser,
      body: { participant_ids: [USER_ID_2] },
    });
    const res = makeRes();
    await getOrCreateConversation(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
  });
});

// ─── getMessages ──────────────────────────────────────────────────────────────

describe('getMessages', () => {
  it('returns 401 when not authenticated', async () => {
    const req = makeReq({ user: undefined, params: { conversationId: CONV_ID } });
    const res = makeRes();
    await getMessages(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Not authenticated' });
  });

  it('returns messages for conversation', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'participant-1' }], rowCount: 1 } as any) // Participant check
      .mockResolvedValueOnce({ rows: [{ ...sampleMessage, sender: sampleUser }], rowCount: 1 } as any) // Get messages
      .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any); // Update last_read_at

    const req = makeReq({
      user: authUser,
      params: { conversationId: CONV_ID },
      query: {},
    });
    const res = makeRes();
    await getMessages(req, res);

    expect(res.json).toHaveBeenCalledWith({
      messages: expect.arrayContaining([
        expect.objectContaining({ id: MSG_ID }),
      ]),
    });
  });

  it('returns messages with before cursor', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'participant-1' }], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)
      .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);

    const req = makeReq({
      user: authUser,
      params: { conversationId: CONV_ID },
      query: { before: '2024-01-01T00:00:00Z', limit: '20' },
    });
    const res = makeRes();
    await getMessages(req, res);

    const [sql] = mockQuery.mock.calls[1]!;
    expect(sql).toContain('created_at < $2');
    expect(res.json).toHaveBeenCalledWith({ messages: [] });
  });

  it('returns 403 when not a participant', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

    const req = makeReq({
      user: authUser,
      params: { conversationId: CONV_ID },
      query: {},
    });
    const res = makeRes();
    await getMessages(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Not a participant of this conversation' });
  });

  it('returns 500 on database error', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB error'));

    const req = makeReq({
      user: authUser,
      params: { conversationId: CONV_ID },
      query: {},
    });
    const res = makeRes();
    await getMessages(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
  });
});

// ─── sendMessage ──────────────────────────────────────────────────────────────

describe('sendMessage', () => {
  it('returns 401 when not authenticated', async () => {
    const req = makeReq({ user: undefined, params: { conversationId: CONV_ID } });
    const res = makeRes();
    await sendMessage(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Not authenticated' });
  });

  it('sends text message successfully', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'participant-1' }], rowCount: 1 } as any) // Participant check
      .mockResolvedValueOnce({ rows: [sampleMessage], rowCount: 1 } as any) // Insert message
      .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any) // Update conversation
      .mockResolvedValueOnce({ rows: [sampleUser], rowCount: 1 } as any); // Get sender

    const req = makeReq({
      user: authUser,
      params: { conversationId: CONV_ID },
      body: { content: 'Hello!' },
    });
    const res = makeRes();
    await sendMessage(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      message: expect.objectContaining({
        id: MSG_ID,
        sender: sampleUser,
      }),
    });
  });

  it('sends audio message', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'participant-1' }], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [{ ...sampleMessage, message_type: 'audio' }], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [sampleUser], rowCount: 1 } as any);

    const req = makeReq({
      user: authUser,
      params: { conversationId: CONV_ID },
      body: { message_type: 'audio', audio_url: 'http://example.com/audio.mp3' },
    });
    const res = makeRes();
    await sendMessage(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('sends image message', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'participant-1' }], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [{ ...sampleMessage, message_type: 'image' }], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [sampleUser], rowCount: 1 } as any);

    const req = makeReq({
      user: authUser,
      params: { conversationId: CONV_ID },
      body: { message_type: 'image', image_url: 'http://example.com/image.jpg' },
    });
    const res = makeRes();
    await sendMessage(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('sends track share message', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'participant-1' }], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [{ ...sampleMessage, message_type: 'track_share' }], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [sampleUser], rowCount: 1 } as any);

    const req = makeReq({
      user: authUser,
      params: { conversationId: CONV_ID },
      body: {
        message_type: 'track_share',
        shared_post_id: '550e8400-e29b-41d4-a716-446655440000',
      },
    });
    const res = makeRes();
    await sendMessage(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('returns 403 when not a participant', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

    const req = makeReq({
      user: authUser,
      params: { conversationId: CONV_ID },
      body: { content: 'Hello!' },
    });
    const res = makeRes();
    await sendMessage(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Not a participant of this conversation' });
  });

  it('returns 400 on Zod validation error', async () => {
    const req = makeReq({
      user: authUser,
      params: { conversationId: CONV_ID },
      body: { message_type: 'invalid_type' },
    });
    const res = makeRes();
    await sendMessage(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 500 on database error', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB error'));

    const req = makeReq({
      user: authUser,
      params: { conversationId: CONV_ID },
      body: { content: 'Hello!' },
    });
    const res = makeRes();
    await sendMessage(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
  });
});

// ─── addGroupMember ───────────────────────────────────────────────────────────

describe('addGroupMember', () => {
  it('returns 401 when not authenticated', async () => {
    const req = makeReq({ user: undefined, params: { conversationId: CONV_ID } });
    const res = makeRes();
    await addGroupMember(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Not authenticated' });
  });

  it('adds member to group successfully', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ ...sampleConversation, is_group: true }], rowCount: 1 } as any) // Group check
      .mockResolvedValueOnce({ rows: [{ id: 'participant-1' }], rowCount: 1 } as any) // Participant check
      .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any) // Add member
      .mockResolvedValueOnce({ rows: [sampleUser], rowCount: 1 } as any); // Get participants

    const req = makeReq({
      user: authUser,
      params: { conversationId: CONV_ID },
      body: { user_id: USER_ID_2 },
    });
    const res = makeRes();
    await addGroupMember(req, res);

    expect(res.json).toHaveBeenCalledWith({ participants: [sampleUser] });
  });

  it('returns 400 when user_id is missing', async () => {
    const req = makeReq({
      user: authUser,
      params: { conversationId: CONV_ID },
      body: {},
    });
    const res = makeRes();
    await addGroupMember(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'user_id is required' });
  });

  it('returns 404 when group not found', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

    const req = makeReq({
      user: authUser,
      params: { conversationId: CONV_ID },
      body: { user_id: USER_ID_2 },
    });
    const res = makeRes();
    await addGroupMember(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Group not found' });
  });

  it('returns 403 when not a participant', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ ...sampleConversation, is_group: true }], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any); // Not a participant

    const req = makeReq({
      user: authUser,
      params: { conversationId: CONV_ID },
      body: { user_id: USER_ID_2 },
    });
    const res = makeRes();
    await addGroupMember(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Not a participant of this group' });
  });

  it('returns 500 on database error', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB error'));

    const req = makeReq({
      user: authUser,
      params: { conversationId: CONV_ID },
      body: { user_id: USER_ID_2 },
    });
    const res = makeRes();
    await addGroupMember(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
  });
});

// ─── removeGroupMember ────────────────────────────────────────────────────────

describe('removeGroupMember', () => {
  it('returns 401 when not authenticated', async () => {
    const req = makeReq({
      user: undefined,
      params: { conversationId: CONV_ID, userId: USER_ID_2 },
    });
    const res = makeRes();
    await removeGroupMember(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Not authenticated' });
  });

  it('admin removes member successfully', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ ...sampleConversation, is_group: true }], rowCount: 1 } as any) // Group check
      .mockResolvedValueOnce({ rows: [{ is_admin: true }], rowCount: 1 } as any) // Admin check
      .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any); // Remove member

    const req = makeReq({
      user: authUser,
      params: { conversationId: CONV_ID, userId: USER_ID_2 },
    });
    const res = makeRes();
    await removeGroupMember(req, res);

    expect(res.json).toHaveBeenCalledWith({ success: true });
  });

  it('user removes self successfully', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ ...sampleConversation, is_group: true }], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [{ is_admin: false }], rowCount: 1 } as any) // Not admin
      .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);

    const req = makeReq({
      user: authUser,
      params: { conversationId: CONV_ID, userId: USER_ID_1 }, // Removing self
    });
    const res = makeRes();
    await removeGroupMember(req, res);

    expect(res.json).toHaveBeenCalledWith({ success: true });
  });

  it('returns 404 when group not found', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

    const req = makeReq({
      user: authUser,
      params: { conversationId: CONV_ID, userId: USER_ID_2 },
    });
    const res = makeRes();
    await removeGroupMember(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Group not found' });
  });

  it('returns 403 when not a participant', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ ...sampleConversation, is_group: true }], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any); // Not a participant

    const req = makeReq({
      user: authUser,
      params: { conversationId: CONV_ID, userId: USER_ID_2 },
    });
    const res = makeRes();
    await removeGroupMember(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Not a participant of this group' });
  });

  it('returns 403 when non-admin tries to remove another member', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ ...sampleConversation, is_group: true }], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [{ is_admin: false }], rowCount: 1 } as any); // Not admin

    const req = makeReq({
      user: authUser,
      params: { conversationId: CONV_ID, userId: USER_ID_2 }, // Trying to remove someone else
    });
    const res = makeRes();
    await removeGroupMember(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Only admins can remove other members' });
  });

  it('returns 500 on database error', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB error'));

    const req = makeReq({
      user: authUser,
      params: { conversationId: CONV_ID, userId: USER_ID_2 },
    });
    const res = makeRes();
    await removeGroupMember(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
  });
});

// ─── getGroupMembers ──────────────────────────────────────────────────────────

describe('getGroupMembers', () => {
  it('returns 401 when not authenticated', async () => {
    const req = makeReq({ user: undefined, params: { conversationId: CONV_ID } });
    const res = makeRes();
    await getGroupMembers(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Not authenticated' });
  });

  it('returns group members successfully', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'participant-1' }], rowCount: 1 } as any) // Participant check
      .mockResolvedValueOnce({
        rows: [{ ...sampleUser, is_admin: true }],
        rowCount: 1,
      } as any); // Get members

    const req = makeReq({
      user: authUser,
      params: { conversationId: CONV_ID },
    });
    const res = makeRes();
    await getGroupMembers(req, res);

    expect(res.json).toHaveBeenCalledWith({
      members: expect.arrayContaining([
        expect.objectContaining({ is_admin: true }),
      ]),
    });
  });

  it('returns 403 when not a participant', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

    const req = makeReq({
      user: authUser,
      params: { conversationId: CONV_ID },
    });
    const res = makeRes();
    await getGroupMembers(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Not a participant of this group' });
  });

  it('returns 500 on database error', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB error'));

    const req = makeReq({
      user: authUser,
      params: { conversationId: CONV_ID },
    });
    const res = makeRes();
    await getGroupMembers(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
  });
});

// ─── markAsRead ───────────────────────────────────────────────────────────────

describe('markAsRead', () => {
  it('returns 401 when not authenticated', async () => {
    const req = makeReq({ user: undefined, params: { conversationId: CONV_ID } });
    const res = makeRes();
    await markAsRead(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Not authenticated' });
  });

  it('marks conversation as read successfully', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);

    const req = makeReq({
      user: authUser,
      params: { conversationId: CONV_ID },
    });
    const res = makeRes();
    await markAsRead(req, res);

    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE conversation_participants'),
      [CONV_ID, USER_ID_1]
    );
    expect(res.json).toHaveBeenCalledWith({ success: true });
  });

  it('returns 500 on database error', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB error'));

    const req = makeReq({
      user: authUser,
      params: { conversationId: CONV_ID },
    });
    const res = makeRes();
    await markAsRead(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
  });
});
