import { create } from 'zustand';
import type { Post, Comment } from '../types';
import { api } from '../lib/api';
import { socketClient } from '../lib/socket';

interface PostState {
  posts: Post[];
  currentPost: Post | null;
  isLoading: boolean;
  fetchFeed: (page?: number) => Promise<void>;
  fetchUserPosts: (userId: string, page?: number) => Promise<void>;
  fetchPost: (postId: string) => Promise<void>;
  createPost: (data: Partial<Post>) => Promise<Post>;
  editPost: (postId: string, data: { content?: string; title?: string; genre?: string; tags?: string[] }) => Promise<void>;
  deletePost: (postId: string) => Promise<void>;
  likePost: (postId: string) => Promise<void>;
  unlikePost: (postId: string) => Promise<void>;
  sharePost: (postId: string, comment?: string) => Promise<void>;
  addComment: (postId: string, data: { content: string; parent_id?: string; timestamp_position?: number }) => Promise<Comment>;
  updatePostInList: (postId: string, updates: Partial<Post>) => void;
  addNewPost: (post: Post) => void;
}

export const usePostStore = create<PostState>((set, get) => ({
  posts: [],
  currentPost: null,
  isLoading: false,

  fetchFeed: async (page = 1) => {
    set({ isLoading: true });
    try {
      const { posts } = await api.getFeed(page);
      if (page === 1) {
        set({ posts });
      } else {
        set({ posts: [...get().posts, ...posts] });
      }
    } finally {
      set({ isLoading: false });
    }
  },

  fetchUserPosts: async (userId, page = 1) => {
    set({ isLoading: true });
    try {
      const { posts } = await api.getUserPosts(userId, page);
      if (page === 1) {
        set({ posts });
      } else {
        set({ posts: [...get().posts, ...posts] });
      }
    } finally {
      set({ isLoading: false });
    }
  },

  fetchPost: async (postId) => {
    set({ isLoading: true });
    try {
      const { post } = await api.getPost(postId);
      set({ currentPost: post });
    } finally {
      set({ isLoading: false });
    }
  },

  createPost: async (data) => {
    const { post } = await api.createPost(data);
    set({ posts: [post, ...get().posts] });
    socketClient.emitPostCreated(post);
    return post;
  },

  editPost: async (postId, data) => {
    const { post } = await api.editPost(postId, data);
    get().updatePostInList(postId, { ...post, is_edited: true });
  },

  deletePost: async (postId) => {
    await api.deletePost(postId);
    set({ posts: get().posts.filter((p) => p.id !== postId) });
  },

  likePost: async (postId) => {
    const { likes_count } = await api.likePost(postId);
    const post = get().posts.find((p) => p.id === postId);
    get().updatePostInList(postId, { is_liked: true, likes_count });
    if (post) {
      socketClient.emitPostLiked(postId, { ...post, likes_count, user_id: post.user_id });
    }
  },

  unlikePost: async (postId) => {
    const { likes_count } = await api.unlikePost(postId);
    get().updatePostInList(postId, { is_liked: false, likes_count });
    socketClient.emitPostUnliked(postId, likes_count);
  },

  sharePost: async (postId, comment) => {
    const { shares_count } = await api.sharePost(postId, comment);
    const post = get().posts.find((p) => p.id === postId);
    get().updatePostInList(postId, { is_shared: true, shares_count });
    if (post) {
      socketClient.emitPostShared(postId, shares_count, post.user_id);
    }
  },

  addComment: async (postId, data) => {
    const { comment } = await api.createComment(postId, data);
    const post = get().posts.find((p) => p.id === postId);
    if (post) {
      get().updatePostInList(postId, { comments_count: Number(post.comments_count || 0) + 1 });
      socketClient.emitPostCommented(postId, comment, post.user_id);
    }
    return comment;
  },

  updatePostInList: (postId, updates) => {
    set({
      posts: get().posts.map((p) => (p.id === postId ? { ...p, ...updates } : p)),
      currentPost: get().currentPost?.id === postId ? { ...get().currentPost!, ...updates } : get().currentPost,
    });
  },

  addNewPost: (post) => {
    const exists = get().posts.some((p) => p.id === post.id);
    if (!exists) {
      set({ posts: [post, ...get().posts] });
    }
  },
}));
