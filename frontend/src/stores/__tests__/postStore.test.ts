import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock modules BEFORE importing the store
vi.mock('../../lib/api', () => ({
  api: {
    getFeed: vi.fn(),
    getUserPosts: vi.fn(),
    getPost: vi.fn(),
    createPost: vi.fn(),
    editPost: vi.fn(),
    deletePost: vi.fn(),
    likePost: vi.fn(),
    unlikePost: vi.fn(),
    sharePost: vi.fn(),
    createComment: vi.fn(),
  },
}));

vi.mock('../../lib/socket', () => ({
  socketClient: {
    emitPostCreated: vi.fn(),
    emitPostLiked: vi.fn(),
    emitPostUnliked: vi.fn(),
    emitPostCommented: vi.fn(),
    emitPostShared: vi.fn(),
  },
}));

// Now import the store and get access to mocked modules
import { usePostStore } from '../postStore';
import { api } from '../../lib/api';
import { socketClient } from '../../lib/socket';

const mockApi = api as {
  getFeed: ReturnType<typeof vi.fn>;
  getUserPosts: ReturnType<typeof vi.fn>;
  getPost: ReturnType<typeof vi.fn>;
  createPost: ReturnType<typeof vi.fn>;
  editPost: ReturnType<typeof vi.fn>;
  deletePost: ReturnType<typeof vi.fn>;
  likePost: ReturnType<typeof vi.fn>;
  unlikePost: ReturnType<typeof vi.fn>;
  sharePost: ReturnType<typeof vi.fn>;
  createComment: ReturnType<typeof vi.fn>;
};

const mockSocketClient = socketClient as {
  emitPostCreated: ReturnType<typeof vi.fn>;
  emitPostLiked: ReturnType<typeof vi.fn>;
  emitPostUnliked: ReturnType<typeof vi.fn>;
  emitPostCommented: ReturnType<typeof vi.fn>;
  emitPostShared: ReturnType<typeof vi.fn>;
};

const sampleUser = {
  id: 'user-1',
  username: 'testuser',
  display_name: 'Test User',
  avatar_url: null,
};

const samplePost = {
  id: 'post-1',
  user_id: 'user-1',
  audio_url: 'http://example.com/track.mp3',
  title: 'Test Track',
  content: 'Check out my new track!',
  genre: 'Hip-Hop',
  bpm: 120,
  created_at: new Date().toISOString(),
  user: sampleUser,
  likes_count: 10,
  comments_count: 5,
  shares_count: 2,
  is_liked: false,
  is_shared: false,
};

const sampleComment = {
  id: 'comment-1',
  post_id: 'post-1',
  user_id: 'user-1',
  content: 'Great track!',
  created_at: new Date().toISOString(),
  user: sampleUser,
};

describe('postStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset store state
    usePostStore.setState({
      posts: [],
      currentPost: null,
      isLoading: false,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchFeed', () => {
    it('fetches feed and sets posts (page 1)', async () => {
      mockApi.getFeed.mockResolvedValueOnce({ posts: [samplePost] });

      const { fetchFeed } = usePostStore.getState();
      await fetchFeed(1);

      const state = usePostStore.getState();
      expect(state.posts).toEqual([samplePost]);
      expect(state.isLoading).toBe(false);
    });

    it('appends posts on subsequent pages', async () => {
      const post2 = { ...samplePost, id: 'post-2' };
      usePostStore.setState({ posts: [samplePost] });
      mockApi.getFeed.mockResolvedValueOnce({ posts: [post2] });

      const { fetchFeed } = usePostStore.getState();
      await fetchFeed(2);

      const state = usePostStore.getState();
      expect(state.posts).toHaveLength(2);
      expect(state.posts[1].id).toBe('post-2');
    });

    it('sets isLoading during fetch', async () => {
      let resolvePromise: (value: { posts: typeof samplePost[] }) => void;
      const promise = new Promise<{ posts: typeof samplePost[] }>((resolve) => {
        resolvePromise = resolve;
      });
      mockApi.getFeed.mockReturnValueOnce(promise);

      const { fetchFeed } = usePostStore.getState();
      const fetchPromise = fetchFeed(1);

      expect(usePostStore.getState().isLoading).toBe(true);

      resolvePromise!({ posts: [] });
      await fetchPromise;

      expect(usePostStore.getState().isLoading).toBe(false);
    });
  });

  describe('fetchUserPosts', () => {
    it('fetches user posts and sets posts (page 1)', async () => {
      mockApi.getUserPosts.mockResolvedValueOnce({ posts: [samplePost] });

      const { fetchUserPosts } = usePostStore.getState();
      await fetchUserPosts('user-1', 1);

      const state = usePostStore.getState();
      expect(state.posts).toEqual([samplePost]);
    });

    it('appends posts on subsequent pages', async () => {
      const post2 = { ...samplePost, id: 'post-2' };
      usePostStore.setState({ posts: [samplePost] });
      mockApi.getUserPosts.mockResolvedValueOnce({ posts: [post2] });

      const { fetchUserPosts } = usePostStore.getState();
      await fetchUserPosts('user-1', 2);

      const state = usePostStore.getState();
      expect(state.posts).toHaveLength(2);
    });
  });

  describe('fetchPost', () => {
    it('fetches single post', async () => {
      mockApi.getPost.mockResolvedValueOnce({ post: samplePost });

      const { fetchPost } = usePostStore.getState();
      await fetchPost('post-1');

      const state = usePostStore.getState();
      expect(state.currentPost).toEqual(samplePost);
    });
  });

  describe('createPost', () => {
    it('creates post and adds to list', async () => {
      mockApi.createPost.mockResolvedValueOnce({ post: samplePost });

      const { createPost } = usePostStore.getState();
      const result = await createPost({ title: 'Test Track' });

      const state = usePostStore.getState();
      expect(result).toEqual(samplePost);
      expect(state.posts[0]).toEqual(samplePost);
      expect(mockSocketClient.emitPostCreated).toHaveBeenCalledWith(samplePost);
    });
  });

  describe('editPost', () => {
    it('edits post and updates in list', async () => {
      const editedPost = { ...samplePost, title: 'Updated Title' };
      usePostStore.setState({ posts: [samplePost] });
      mockApi.editPost.mockResolvedValueOnce({ post: editedPost });

      const { editPost } = usePostStore.getState();
      await editPost('post-1', { title: 'Updated Title' });

      const state = usePostStore.getState();
      expect(state.posts[0].title).toBe('Updated Title');
      expect(state.posts[0].is_edited).toBe(true);
    });
  });

  describe('deletePost', () => {
    it('deletes post and removes from list', async () => {
      usePostStore.setState({ posts: [samplePost] });
      mockApi.deletePost.mockResolvedValueOnce({ message: 'Deleted' });

      const { deletePost } = usePostStore.getState();
      await deletePost('post-1');

      const state = usePostStore.getState();
      expect(state.posts).toHaveLength(0);
    });
  });

  describe('likePost', () => {
    it('likes post and updates count', async () => {
      usePostStore.setState({ posts: [samplePost] });
      mockApi.likePost.mockResolvedValueOnce({ liked: true, likes_count: 11 });

      const { likePost } = usePostStore.getState();
      await likePost('post-1');

      const state = usePostStore.getState();
      expect(state.posts[0].is_liked).toBe(true);
      expect(state.posts[0].likes_count).toBe(11);
      expect(mockSocketClient.emitPostLiked).toHaveBeenCalledWith(
        'post-1',
        expect.objectContaining({ likes_count: 11 })
      );
    });

    it('does not emit when post not found', async () => {
      usePostStore.setState({ posts: [] });
      mockApi.likePost.mockResolvedValueOnce({ liked: true, likes_count: 11 });

      const { likePost } = usePostStore.getState();
      await likePost('nonexistent');

      expect(mockSocketClient.emitPostLiked).not.toHaveBeenCalled();
    });
  });

  describe('unlikePost', () => {
    it('unlikes post and updates count', async () => {
      usePostStore.setState({
        posts: [{ ...samplePost, is_liked: true, likes_count: 11 }],
      });
      mockApi.unlikePost.mockResolvedValueOnce({ liked: false, likes_count: 10 });

      const { unlikePost } = usePostStore.getState();
      await unlikePost('post-1');

      const state = usePostStore.getState();
      expect(state.posts[0].is_liked).toBe(false);
      expect(state.posts[0].likes_count).toBe(10);
      expect(mockSocketClient.emitPostUnliked).toHaveBeenCalledWith('post-1', 10);
    });
  });

  describe('sharePost', () => {
    it('shares post and updates count', async () => {
      usePostStore.setState({ posts: [samplePost] });
      mockApi.sharePost.mockResolvedValueOnce({ shared: true, shares_count: 3 });

      const { sharePost } = usePostStore.getState();
      await sharePost('post-1', 'Great track!');

      const state = usePostStore.getState();
      expect(state.posts[0].is_shared).toBe(true);
      expect(state.posts[0].shares_count).toBe(3);
      expect(mockSocketClient.emitPostShared).toHaveBeenCalledWith('post-1', 3, 'user-1');
    });

    it('does not emit when post not found', async () => {
      usePostStore.setState({ posts: [] });
      mockApi.sharePost.mockResolvedValueOnce({ shared: true, shares_count: 3 });

      const { sharePost } = usePostStore.getState();
      await sharePost('nonexistent');

      expect(mockSocketClient.emitPostShared).not.toHaveBeenCalled();
    });
  });

  describe('addComment', () => {
    it('adds comment and updates count', async () => {
      usePostStore.setState({ posts: [samplePost] });
      mockApi.createComment.mockResolvedValueOnce({ comment: sampleComment });

      const { addComment } = usePostStore.getState();
      const result = await addComment('post-1', { content: 'Great track!' });

      const state = usePostStore.getState();
      expect(result).toEqual(sampleComment);
      expect(state.posts[0].comments_count).toBe(6);
      expect(mockSocketClient.emitPostCommented).toHaveBeenCalledWith(
        'post-1',
        sampleComment,
        'user-1'
      );
    });

    it('handles post not found', async () => {
      usePostStore.setState({ posts: [] });
      mockApi.createComment.mockResolvedValueOnce({ comment: sampleComment });

      const { addComment } = usePostStore.getState();
      const result = await addComment('nonexistent', { content: 'Comment' });

      expect(result).toEqual(sampleComment);
      expect(mockSocketClient.emitPostCommented).not.toHaveBeenCalled();
    });

    it('handles null comments_count', async () => {
      usePostStore.setState({
        posts: [{ ...samplePost, comments_count: null as unknown as number }],
      });
      mockApi.createComment.mockResolvedValueOnce({ comment: sampleComment });

      const { addComment } = usePostStore.getState();
      await addComment('post-1', { content: 'Comment' });

      const state = usePostStore.getState();
      expect(state.posts[0].comments_count).toBe(1);
    });
  });

  describe('updatePostInList', () => {
    it('updates post in list', () => {
      usePostStore.setState({ posts: [samplePost] });

      const { updatePostInList } = usePostStore.getState();
      updatePostInList('post-1', { title: 'New Title' });

      const state = usePostStore.getState();
      expect(state.posts[0].title).toBe('New Title');
    });

    it('updates currentPost if matching', () => {
      usePostStore.setState({
        posts: [samplePost],
        currentPost: samplePost,
      });

      const { updatePostInList } = usePostStore.getState();
      updatePostInList('post-1', { title: 'New Title' });

      const state = usePostStore.getState();
      expect(state.currentPost?.title).toBe('New Title');
    });

    it('does not update currentPost if not matching', () => {
      usePostStore.setState({
        posts: [samplePost],
        currentPost: { ...samplePost, id: 'post-2' },
      });

      const { updatePostInList } = usePostStore.getState();
      updatePostInList('post-1', { title: 'New Title' });

      const state = usePostStore.getState();
      expect(state.currentPost?.title).toBe('Test Track');
    });

    it('does not modify unmatched posts in list', () => {
      const post2 = { ...samplePost, id: 'post-2', title: 'Second Post' };
      usePostStore.setState({ posts: [samplePost, post2] });

      const { updatePostInList } = usePostStore.getState();
      updatePostInList('post-1', { title: 'New Title' });

      const state = usePostStore.getState();
      expect(state.posts[0].title).toBe('New Title');
      expect(state.posts[1].title).toBe('Second Post'); // unchanged
    });
  });

  describe('addNewPost', () => {
    it('adds new post to beginning of list', () => {
      usePostStore.setState({ posts: [] });

      const { addNewPost } = usePostStore.getState();
      addNewPost(samplePost);

      const state = usePostStore.getState();
      expect(state.posts[0]).toEqual(samplePost);
    });

    it('does not add duplicate post', () => {
      usePostStore.setState({ posts: [samplePost] });

      const { addNewPost } = usePostStore.getState();
      addNewPost(samplePost);

      const state = usePostStore.getState();
      expect(state.posts).toHaveLength(1);
    });
  });
});
