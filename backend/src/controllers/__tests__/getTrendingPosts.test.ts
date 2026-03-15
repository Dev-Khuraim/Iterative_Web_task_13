import {
  createPost,
  getFeed,
  getPost,
  getUserPosts,
  likePost,
  unlikePost,
  sharePost,
  getComments,
  createComment,
  getLikedPosts,
  editPost,
  deletePost,
  getTrendingPosts,
  getPopularPosts,
  searchPosts,
} from '../postController';
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
  username: 'producer1',
  display_name: 'Producer One',
  avatar_url: null,
  producer_type: 'Beat Maker',
};

const samplePost = {
  id: 'post-1',
  user_id: 'user-1',
  audio_url: 'http://example.com/track1.mp3',
  title: 'Track 1',
  genre: 'Hip-Hop',
  bpm: 120,
  created_at: new Date().toISOString(),
  user: sampleUser,
  likes_count: '10',
  comments_count: '5',
  shares_count: '2',
};

const authUser = { userId: 'user-1', username: 'producer1', email: 'p@example.com' };

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  (console.error as jest.Mock).mockRestore();
});

// ─── createPost ───────────────────────────────────────────────────────────────

describe('createPost', () => {
  it('returns 401 when not authenticated', async () => {
    const req = makeReq({ user: undefined });
    const res = makeRes();
    await createPost(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Not authenticated' });
  });

  it('creates a post successfully', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [samplePost], rowCount: 1 } as any) // INSERT post
      .mockResolvedValueOnce({ rows: [sampleUser], rowCount: 1 } as any); // SELECT user

    const req = makeReq({
      user: authUser,
      body: { title: 'Track 1', audio_url: 'http://example.com/track1.mp3' },
    });
    const res = makeRes();
    await createPost(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ post: expect.objectContaining({ id: 'post-1' }) })
    );
  });

  it('creates a post with waveform_data', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [samplePost], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [sampleUser], rowCount: 1 } as any);

    const req = makeReq({
      user: authUser,
      body: {
        title: 'Track 1',
        waveform_data: [0.1, 0.5, 0.9],
        audio_url: 'http://example.com/track1.mp3',
      },
    });
    const res = makeRes();
    await createPost(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('creates a post without waveform_data (null path)', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [samplePost], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [sampleUser], rowCount: 1 } as any);

    const req = makeReq({
      user: authUser,
      body: {
        title: 'Track 1',
        is_full_track: false,
        // no waveform_data → exercises the `? : null` false branch
      },
    });
    const res = makeRes();
    await createPost(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('returns 400 on Zod validation error', async () => {
    const req = makeReq({
      user: authUser,
      body: { bpm: 999 }, // bpm too high
    });
    const res = makeRes();
    await createPost(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 500 on database error', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB error'));
    const req = makeReq({ user: authUser, body: {} });
    const res = makeRes();
    await createPost(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
  });
});

// ─── getFeed ──────────────────────────────────────────────────────────────────

describe('getFeed', () => {
  const postsRow = { ...samplePost, is_repost: false, reposted_by: null, repost_time: null };
  const repostRow = { ...samplePost, id: 'post-2', is_repost: true, reposted_by: 'Other User', repost_time: new Date().toISOString() };

  it('returns merged feed (unauthenticated)', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [postsRow], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [repostRow], rowCount: 1 } as any);

    const req = makeReq({ query: { page: '1', limit: '20' } });
    const res = makeRes();
    await getFeed(req, res);

    expect(res.json).toHaveBeenCalledWith({ posts: expect.any(Array) });
  });

  it('returns merged feed (authenticated)', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [postsRow], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

    const req = makeReq({ user: authUser, query: {} });
    const res = makeRes();
    await getFeed(req, res);

    expect(res.json).toHaveBeenCalledWith({ posts: expect.any(Array) });
  });

  it('sorts merged posts by creation time / repost time', async () => {
    const older = { ...postsRow, created_at: '2024-01-01T00:00:00Z' };
    const newer = { ...repostRow, repost_time: '2024-06-01T00:00:00Z' };

    mockQuery
      .mockResolvedValueOnce({ rows: [older], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [newer], rowCount: 1 } as any);

    const req = makeReq({ query: {} });
    const res = makeRes();
    await getFeed(req, res);

    const { posts } = (res.json as jest.Mock).mock.calls[0][0];
    expect(posts[0].id).toBe('post-2'); // newer repost comes first
  });

  it('falls back to created_at when repost has null repost_time', async () => {
    // covers the `a.is_repost && a.repost_time` false branch (is_repost=true but repost_time=null)
    const post = { ...postsRow, created_at: '2024-03-01T00:00:00Z' };
    const repostNullTime = { ...repostRow, repost_time: null, created_at: '2024-01-01T00:00:00Z' };

    mockQuery
      .mockResolvedValueOnce({ rows: [post], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [repostNullTime], rowCount: 1 } as any);

    const req = makeReq({ query: {} });
    const res = makeRes();
    await getFeed(req, res);

    const { posts } = (res.json as jest.Mock).mock.calls[0][0];
    expect(posts[0].id).toBe('post-1'); // the normal post (March) comes first
  });

  it('sorts two reposts by their repost_time (covers b.repost_time branch)', async () => {
    const repost1 = { ...repostRow, id: 'post-r1', repost_time: '2024-05-01T00:00:00Z' };
    const repost2 = { ...repostRow, id: 'post-r2', repost_time: '2024-06-01T00:00:00Z' };

    mockQuery
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any) // no original posts
      .mockResolvedValueOnce({ rows: [repost1, repost2], rowCount: 2 } as any);

    const req = makeReq({ query: {} });
    const res = makeRes();
    await getFeed(req, res);

    const { posts } = (res.json as jest.Mock).mock.calls[0][0];
    expect(posts[0].id).toBe('post-r2'); // June comes first
  });

  it('returns 500 on error', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB error'));
    const req = makeReq({ query: {} });
    const res = makeRes();
    await getFeed(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ─── getPost ──────────────────────────────────────────────────────────────────

describe('getPost', () => {
  it('returns post and increments play count', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [samplePost], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);

    const req = makeReq({ params: { postId: 'post-1' } });
    const res = makeRes();
    await getPost(req, res);

    expect(res.json).toHaveBeenCalledWith({ post: samplePost });
    expect(mockQuery).toHaveBeenCalledTimes(2); // select + update play_count
  });

  it('returns post with is_liked/is_shared when authenticated', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [samplePost], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);

    const req = makeReq({ params: { postId: 'post-1' }, user: authUser });
    const res = makeRes();
    await getPost(req, res);

    const [sql] = mockQuery.mock.calls[0]!;
    expect(sql).toContain('is_liked');
    expect(res.json).toHaveBeenCalledWith({ post: samplePost });
  });

  it('returns 404 when post not found', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

    const req = makeReq({ params: { postId: 'nonexistent' } });
    const res = makeRes();
    await getPost(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Post not found' });
  });

  it('returns 500 on error', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB error'));
    const req = makeReq({ params: { postId: 'post-1' } });
    const res = makeRes();
    await getPost(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ─── getUserPosts ─────────────────────────────────────────────────────────────

describe('getUserPosts', () => {
  it('returns merged user posts and reposts (unauthenticated)', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [samplePost], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

    const req = makeReq({ params: { userId: 'user-1' }, query: {} });
    const res = makeRes();
    await getUserPosts(req, res);

    expect(res.json).toHaveBeenCalledWith({ posts: expect.any(Array) });
  });

  it('returns merged user posts and reposts (authenticated)', async () => {
    const repostRow = { ...samplePost, id: 'post-2', repost_time: new Date().toISOString() };
    mockQuery
      .mockResolvedValueOnce({ rows: [samplePost], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [repostRow], rowCount: 1 } as any);

    const req = makeReq({ params: { userId: 'user-1' }, query: { page: '1', limit: '10' }, user: authUser });
    const res = makeRes();
    await getUserPosts(req, res);

    expect(res.json).toHaveBeenCalledWith({ posts: expect.any(Array) });
  });

  it('falls back to created_at when repost has null repost_time', async () => {
    const repostNullTime = { ...samplePost, id: 'post-2', is_repost: true, repost_time: null, created_at: '2024-01-01T00:00:00Z' };
    const normalPost = { ...samplePost, created_at: '2024-06-01T00:00:00Z' };

    mockQuery
      .mockResolvedValueOnce({ rows: [normalPost], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [repostNullTime], rowCount: 1 } as any);

    const req = makeReq({ params: { userId: 'user-1' }, query: {} });
    const res = makeRes();
    await getUserPosts(req, res);

    const { posts } = (res.json as jest.Mock).mock.calls[0][0];
    expect(posts[0].id).toBe('post-1'); // normal post (June) comes first
  });

  it('sorts two reposts by their repost_time (covers b.repost_time branch)', async () => {
    const repost1 = { ...samplePost, id: 'post-r1', is_repost: true, repost_time: '2024-05-01T00:00:00Z' };
    const repost2 = { ...samplePost, id: 'post-r2', is_repost: true, repost_time: '2024-06-01T00:00:00Z' };

    mockQuery
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any) // no original posts
      .mockResolvedValueOnce({ rows: [repost1, repost2], rowCount: 2 } as any);

    const req = makeReq({ params: { userId: 'user-1' }, query: {} });
    const res = makeRes();
    await getUserPosts(req, res);

    const { posts } = (res.json as jest.Mock).mock.calls[0][0];
    expect(posts[0].id).toBe('post-r2'); // June comes first
  });

  it('returns 500 on error', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB error'));
    const req = makeReq({ params: { userId: 'user-1' }, query: {} });
    const res = makeRes();
    await getUserPosts(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ─── likePost ─────────────────────────────────────────────────────────────────

describe('likePost', () => {
  it('returns 401 when not authenticated', async () => {
    const req = makeReq({ user: undefined, params: { postId: 'post-1' } });
    const res = makeRes();
    await likePost(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('likes a post and returns updated count', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any) // INSERT
      .mockResolvedValueOnce({ rows: [{ count: '11' }], rowCount: 1 } as any); // SELECT COUNT

    const req = makeReq({ user: authUser, params: { postId: 'post-1' } });
    const res = makeRes();
    await likePost(req, res);

    expect(res.json).toHaveBeenCalledWith({ liked: true, likes_count: 11 });
  });

  it('defaults count to 0 when rows[0] is undefined', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any) // INSERT
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any); // SELECT COUNT returns empty

    const req = makeReq({ user: authUser, params: { postId: 'post-1' } });
    const res = makeRes();
    await likePost(req, res);

    expect(res.json).toHaveBeenCalledWith({ liked: true, likes_count: 0 });
  });

  it('returns 500 on error', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB error'));
    const req = makeReq({ user: authUser, params: { postId: 'post-1' } });
    const res = makeRes();
    await likePost(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ─── unlikePost ───────────────────────────────────────────────────────────────

describe('unlikePost', () => {
  it('returns 401 when not authenticated', async () => {
    const req = makeReq({ user: undefined, params: { postId: 'post-1' } });
    const res = makeRes();
    await unlikePost(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('unlikes a post and returns updated count', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any) // DELETE
      .mockResolvedValueOnce({ rows: [{ count: '9' }], rowCount: 1 } as any); // SELECT COUNT

    const req = makeReq({ user: authUser, params: { postId: 'post-1' } });
    const res = makeRes();
    await unlikePost(req, res);

    expect(res.json).toHaveBeenCalledWith({ liked: false, likes_count: 9 });
  });

  it('defaults count to 0 when rows[0] is undefined', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any) // DELETE
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any); // SELECT COUNT returns empty

    const req = makeReq({ user: authUser, params: { postId: 'post-1' } });
    const res = makeRes();
    await unlikePost(req, res);

    expect(res.json).toHaveBeenCalledWith({ liked: false, likes_count: 0 });
  });

  it('returns 500 on error', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB error'));
    const req = makeReq({ user: authUser, params: { postId: 'post-1' } });
    const res = makeRes();
    await unlikePost(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ─── sharePost ────────────────────────────────────────────────────────────────

describe('sharePost', () => {
  it('returns 401 when not authenticated', async () => {
    const req = makeReq({ user: undefined, params: { postId: 'post-1' } });
    const res = makeRes();
    await sharePost(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('shares a post and returns updated count', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any) // INSERT
      .mockResolvedValueOnce({ rows: [{ count: '3' }], rowCount: 1 } as any); // SELECT COUNT

    const req = makeReq({ user: authUser, params: { postId: 'post-1' }, body: { comment: 'Nice track!' } });
    const res = makeRes();
    await sharePost(req, res);

    expect(res.json).toHaveBeenCalledWith({ shared: true, shares_count: 3 });
  });

  it('defaults count to 0 when rows[0] is undefined', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any) // INSERT
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any); // SELECT COUNT returns empty

    const req = makeReq({ user: authUser, params: { postId: 'post-1' }, body: {} });
    const res = makeRes();
    await sharePost(req, res);

    expect(res.json).toHaveBeenCalledWith({ shared: true, shares_count: 0 });
  });

  it('returns 500 on error', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB error'));
    const req = makeReq({ user: authUser, params: { postId: 'post-1' }, body: {} });
    const res = makeRes();
    await sharePost(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ─── getComments ──────────────────────────────────────────────────────────────

const sampleComment = {
  id: 'comment-1',
  post_id: 'post-1',
  user_id: 'user-1',
  content: 'Great track!',
  parent_id: null,
  created_at: new Date().toISOString(),
  user: sampleUser,
};

describe('getComments', () => {
  it('returns comments with replies', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [sampleComment], rowCount: 1 } as any) // top-level comments
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any); // replies for comment-1

    const req = makeReq({ params: { postId: 'post-1' } });
    const res = makeRes();
    await getComments(req, res);

    expect(res.json).toHaveBeenCalledWith({
      comments: [{ ...sampleComment, replies: [] }],
    });
  });

  it('returns 500 on error', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB error'));
    const req = makeReq({ params: { postId: 'post-1' } });
    const res = makeRes();
    await getComments(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ─── createComment ────────────────────────────────────────────────────────────

describe('createComment', () => {
  it('returns 401 when not authenticated', async () => {
    const req = makeReq({ user: undefined, params: { postId: 'post-1' } });
    const res = makeRes();
    await createComment(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('creates a comment successfully', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [sampleComment], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [sampleUser], rowCount: 1 } as any);

    const req = makeReq({
      user: authUser,
      params: { postId: 'post-1' },
      body: { content: 'Great track!' },
    });
    const res = makeRes();
    await createComment(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ comment: expect.objectContaining({ content: 'Great track!' }) });
  });

  it('returns 400 on Zod validation error', async () => {
    const req = makeReq({
      user: authUser,
      params: { postId: 'post-1' },
      body: { content: '' }, // too short
    });
    const res = makeRes();
    await createComment(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 500 on database error', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB error'));
    const req = makeReq({
      user: authUser,
      params: { postId: 'post-1' },
      body: { content: 'Nice!' },
    });
    const res = makeRes();
    await createComment(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ─── getLikedPosts ────────────────────────────────────────────────────────────

describe('getLikedPosts', () => {
  it('returns liked posts (unauthenticated)', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [samplePost], rowCount: 1 } as any);

    const req = makeReq({ params: { userId: 'user-1' }, query: {} });
    const res = makeRes();
    await getLikedPosts(req, res);

    expect(res.json).toHaveBeenCalledWith({ posts: [samplePost] });
  });

  it('returns liked posts (authenticated)', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

    const req = makeReq({ params: { userId: 'user-1' }, query: { page: '2', limit: '5' }, user: authUser });
    const res = makeRes();
    await getLikedPosts(req, res);

    expect(res.json).toHaveBeenCalledWith({ posts: [] });
  });

  it('returns 500 on error', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB error'));
    const req = makeReq({ params: { userId: 'user-1' }, query: {} });
    const res = makeRes();
    await getLikedPosts(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ─── editPost ─────────────────────────────────────────────────────────────────

describe('editPost', () => {
  it('returns 401 when not authenticated', async () => {
    const req = makeReq({ user: undefined, params: { postId: 'post-1' } });
    const res = makeRes();
    await editPost(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('edits a post successfully', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [samplePost], rowCount: 1 } as any);

    const req = makeReq({
      user: authUser,
      params: { postId: 'post-1' },
      body: { title: 'Updated Title', genre: 'EDM' },
    });
    const res = makeRes();
    await editPost(req, res);

    expect(res.json).toHaveBeenCalledWith({ post: samplePost });
  });

  it('edits a post with no optional fields (only is_edited=true applied)', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [samplePost], rowCount: 1 } as any);

    const req = makeReq({
      user: authUser,
      params: { postId: 'post-1' },
      body: {},
    });
    const res = makeRes();
    await editPost(req, res);

    expect(res.json).toHaveBeenCalledWith({ post: samplePost });
  });

  it('skips undefined optional fields in update (covers value === undefined branch)', async () => {
    // Zod parses { content: undefined } as { content: undefined } in Object.entries
    // This exercises the `if (value !== undefined)` false branch
    mockQuery.mockResolvedValueOnce({ rows: [samplePost], rowCount: 1 } as any);

    const req = makeReq({
      user: authUser,
      params: { postId: 'post-1' },
      body: { content: undefined, title: 'Valid Title' },
    });
    const res = makeRes();
    await editPost(req, res);

    expect(res.json).toHaveBeenCalledWith({ post: samplePost });
  });

  it('returns 404 when post not found or unauthorized', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

    const req = makeReq({
      user: authUser,
      params: { postId: 'nonexistent' },
      body: { title: 'Title' },
    });
    const res = makeRes();
    await editPost(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Post not found or unauthorized' });
  });

  it('returns 400 on Zod validation error', async () => {
    const req = makeReq({
      user: authUser,
      params: { postId: 'post-1' },
      body: { content: 'x'.repeat(2001) }, // too long
    });
    const res = makeRes();
    await editPost(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 500 on database error', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB error'));
    const req = makeReq({
      user: authUser,
      params: { postId: 'post-1' },
      body: { title: 'Title' },
    });
    const res = makeRes();
    await editPost(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ─── deletePost ───────────────────────────────────────────────────────────────

describe('deletePost', () => {
  it('returns 401 when not authenticated', async () => {
    const req = makeReq({ user: undefined, params: { postId: 'post-1' } });
    const res = makeRes();
    await deletePost(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('deletes a post successfully', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'post-1' }], rowCount: 1 } as any);

    const req = makeReq({ user: authUser, params: { postId: 'post-1' } });
    const res = makeRes();
    await deletePost(req, res);

    expect(res.json).toHaveBeenCalledWith({ message: 'Post deleted successfully' });
  });

  it('returns 404 when post not found or unauthorized', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

    const req = makeReq({ user: authUser, params: { postId: 'nonexistent' } });
    const res = makeRes();
    await deletePost(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns 500 on error', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB error'));
    const req = makeReq({ user: authUser, params: { postId: 'post-1' } });
    const res = makeRes();
    await deletePost(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ─── getTrendingPosts ─────────────────────────────────────────────────────────

describe('getTrendingPosts', () => {
  it('returns only music posts with default limit (unauthenticated)', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [samplePost], rowCount: 1 } as any);

    const req = makeReq({ query: {} });
    const res = makeRes();
    await getTrendingPosts(req, res);

    const [sql, params] = mockQuery.mock.calls[0]!;
    expect(sql).toContain('audio_url IS NOT NULL');
    expect(sql).not.toContain('is_liked');
    expect(params).toEqual([20]);
    expect(res.json).toHaveBeenCalledWith({ posts: [samplePost] });
  });

  it('returns only music posts with custom limit (unauthenticated)', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

    const req = makeReq({ query: { limit: '5' } });
    const res = makeRes();
    await getTrendingPosts(req, res);

    const [, params] = mockQuery.mock.calls[0]!;
    expect(params).toEqual([5]);
  });

  it('applies genre filter when provided (unauthenticated)', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

    const req = makeReq({ query: { genre: 'Hip-Hop' } });
    const res = makeRes();
    await getTrendingPosts(req, res);

    const [sql, params] = mockQuery.mock.calls[0]!;
    expect(sql).toContain('ILIKE $2');
    expect(params).toEqual([20, '%Hip-Hop%']);
    expect(res.json).toHaveBeenCalledWith({ posts: [] });
  });

  it('includes is_liked/is_shared and passes userId when authenticated', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [samplePost], rowCount: 1 } as any);

    const req = makeReq({ query: {}, user: authUser });
    const res = makeRes();
    await getTrendingPosts(req, res);

    const [sql, params] = mockQuery.mock.calls[0]!;
    expect(sql).toContain('is_liked');
    expect(sql).toContain('is_shared');
    expect(params).toContain(authUser.userId);
    expect(res.json).toHaveBeenCalledWith({ posts: [samplePost] });
  });

  it('applies genre filter with authenticated user', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

    const req = makeReq({ query: { genre: 'EDM', limit: '10' }, user: authUser });
    const res = makeRes();
    await getTrendingPosts(req, res);

    const [sql, params] = mockQuery.mock.calls[0]!;
    expect(sql).toContain('audio_url IS NOT NULL');
    expect(params).toContain('%EDM%');
    expect(params).toContain(authUser.userId);
  });

  it('returns 500 on database error', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB connection failed'));

    const req = makeReq({ query: {} });
    const res = makeRes();
    await getTrendingPosts(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
  });
});

// ─── getPopularPosts ──────────────────────────────────────────────────────────

describe('getPopularPosts', () => {
  it('returns popular posts with default limit (unauthenticated)', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [samplePost], rowCount: 1 } as any);

    const req = makeReq({ query: {} });
    const res = makeRes();
    await getPopularPosts(req, res);

    const [, params] = mockQuery.mock.calls[0]!;
    expect(params).toEqual([20]);
    expect(res.json).toHaveBeenCalledWith({ posts: [samplePost] });
  });

  it('applies genre filter (unauthenticated)', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

    const req = makeReq({ query: { genre: 'Jazz' } });
    const res = makeRes();
    await getPopularPosts(req, res);

    const [, params] = mockQuery.mock.calls[0]!;
    expect(params).toEqual([20, '%Jazz%']);
  });

  it('includes is_liked/is_shared when authenticated', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

    const req = makeReq({ query: {}, user: authUser });
    const res = makeRes();
    await getPopularPosts(req, res);

    const [sql] = mockQuery.mock.calls[0]!;
    expect(sql).toContain('is_liked');
  });

  it('applies genre filter with authenticated user', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

    const req = makeReq({ query: { genre: 'Pop', limit: '5' }, user: authUser });
    const res = makeRes();
    await getPopularPosts(req, res);

    const [, params] = mockQuery.mock.calls[0]!;
    expect(params).toContain('%Pop%');
    expect(params).toContain(authUser.userId);
  });

  it('returns 500 on error', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB error'));
    const req = makeReq({ query: {} });
    const res = makeRes();
    await getPopularPosts(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ─── searchPosts ──────────────────────────────────────────────────────────────

describe('searchPosts', () => {
  it('returns all posts when no query params (unauthenticated)', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [samplePost], rowCount: 1 } as any);

    const req = makeReq({ query: {} });
    const res = makeRes();
    await searchPosts(req, res);

    expect(res.json).toHaveBeenCalledWith({ posts: [samplePost] });
  });

  it('searches by text query (unauthenticated)', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

    const req = makeReq({ query: { q: 'trap beat' } });
    const res = makeRes();
    await searchPosts(req, res);

    const [sql] = mockQuery.mock.calls[0]!;
    expect(sql).toContain('ILIKE');
    expect(res.json).toHaveBeenCalledWith({ posts: [] });
  });

  it('searches by genre only', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

    const req = makeReq({ query: { genre: 'EDM' } });
    const res = makeRes();
    await searchPosts(req, res);

    const [sql, params] = mockQuery.mock.calls[0]!;
    expect(sql).toContain('genre ILIKE');
    expect(params).toContain('%EDM%');
  });

  it('searches by text and genre', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

    const req = makeReq({ query: { q: 'bass', genre: 'EDM' } });
    const res = makeRes();
    await searchPosts(req, res);

    const [, params] = mockQuery.mock.calls[0]!;
    expect(params).toContain('%bass%');
    expect(params).toContain('%EDM%');
  });

  it('includes is_liked/is_shared when authenticated', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

    const req = makeReq({ query: { q: 'track' }, user: authUser });
    const res = makeRes();
    await searchPosts(req, res);

    const [sql] = mockQuery.mock.calls[0]!;
    expect(sql).toContain('is_liked');
  });

  it('returns 500 on error', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB error'));
    const req = makeReq({ query: {} });
    const res = makeRes();
    await searchPosts(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});
