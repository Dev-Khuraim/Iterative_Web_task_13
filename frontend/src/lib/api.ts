const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface ApiOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
}

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(endpoint: string, options: ApiOptions = {}): Promise<T> {
  const token = localStorage.getItem('token');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}/api${endpoint}`, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new ApiError(data.error || 'Request failed', response.status);
  }

  return data as T;
}

async function uploadFile(file: File): Promise<string> {
  const token = localStorage.getItem('token');
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_URL}/api/upload`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });

  const data = await response.json();
  if (!response.ok) {
    throw new ApiError(data.error || 'Upload failed', response.status);
  }
  return (data as { url: string }).url;
}

export const api = {
  // File upload
  uploadFile,

  // Auth
  register: (data: { username: string; email: string; password: string; display_name?: string; producer_type?: string }) =>
    request<{ user: import('../types').User; token: string }>('/auth/register', { method: 'POST', body: data }),

  login: (data: { email: string; password: string }) =>
    request<{ user: import('../types').User; token: string }>('/auth/login', { method: 'POST', body: data }),

  googleAuth: (idToken: string) =>
    request<{ user: import('../types').User; token: string }>('/auth/google/callback', { method: 'POST', body: { id_token: idToken } }),

  getMe: () => request<{ user: import('../types').User }>('/auth/me'),

  logout: () => request<{ message: string }>('/auth/logout', { method: 'POST' }),

  // Users
  getUser: (userId: string) => request<{ user: import('../types').User }>(`/users/${userId}`),

  updateProfile: (data: Partial<import('../types').User>) =>
    request<{ user: import('../types').User }>('/users/profile', { method: 'PUT', body: data }),

  searchUsers: (params: { q?: string; genre?: string; producer_type?: string }) => {
    const searchParams = new URLSearchParams();
    if (params.q) searchParams.set('q', params.q);
    if (params.genre) searchParams.set('genre', params.genre);
    if (params.producer_type) searchParams.set('producer_type', params.producer_type);
    return request<{ users: import('../types').User[] }>(`/users/search?${searchParams}`);
  },

  followUser: (userId: string) => request<{ message: string }>(`/users/${userId}/follow`, { method: 'POST' }),

  unfollowUser: (userId: string) => request<{ message: string }>(`/users/${userId}/follow`, { method: 'DELETE' }),

  sendFriendRequest: (userId: string) =>
    request<{ friendship: import('../types').Friendship }>(`/users/${userId}/friend-request`, { method: 'POST' }),

  respondToFriendRequest: (friendshipId: string, accept: boolean) =>
    request<{ friendship: import('../types').Friendship }>(`/friendships/${friendshipId}`, { method: 'PUT', body: { accept } }),

  getFriends: () => request<{ friends: import('../types').Friendship[] }>('/friends'),

  getPendingRequests: () => request<{ requests: import('../types').Friendship[] }>('/friends/pending'),

  // Posts
  createPost: (data: Partial<import('../types').Post>) =>
    request<{ post: import('../types').Post }>('/posts', { method: 'POST', body: data }),

  getFeed: (page = 1, limit = 20) =>
    request<{ posts: import('../types').Post[] }>(`/posts/feed?page=${page}&limit=${limit}`),

  getTrendingPosts: (limit = 20, genre?: string) => {
    const params = new URLSearchParams({ limit: limit.toString() });
    if (genre) params.set('genre', genre);
    return request<{ posts: import('../types').Post[] }>(`/posts/trending?${params}`);
  },

  getPopularPosts: (limit = 20, genre?: string) => {
    const params = new URLSearchParams({ limit: limit.toString() });
    if (genre) params.set('genre', genre);
    return request<{ posts: import('../types').Post[] }>(`/posts/popular?${params}`);
  },

  searchPosts: (params: { q?: string; genre?: string; limit?: number }) => {
    const searchParams = new URLSearchParams();
    if (params.q) searchParams.set('q', params.q);
    if (params.genre) searchParams.set('genre', params.genre);
    if (params.limit) searchParams.set('limit', params.limit.toString());
    return request<{ posts: import('../types').Post[] }>(`/posts/search?${searchParams}`);
  },

  getPost: (postId: string) => request<{ post: import('../types').Post }>(`/posts/${postId}`),

  editPost: (postId: string, data: { content?: string; title?: string; genre?: string; tags?: string[] }) =>
    request<{ post: import('../types').Post }>(`/posts/${postId}`, { method: 'PATCH', body: data }),

  deletePost: (postId: string) => request<{ message: string }>(`/posts/${postId}`, { method: 'DELETE' }),

  getUserPosts: (userId: string, page = 1, limit = 20) =>
    request<{ posts: import('../types').Post[] }>(`/users/${userId}/posts?page=${page}&limit=${limit}`),

  getLikedPosts: (userId: string, page = 1, limit = 20) =>
    request<{ posts: import('../types').Post[] }>(`/users/${userId}/likes?page=${page}&limit=${limit}`),

  likePost: (postId: string) =>
    request<{ liked: boolean; likes_count: number }>(`/posts/${postId}/like`, { method: 'POST' }),

  unlikePost: (postId: string) =>
    request<{ liked: boolean; likes_count: number }>(`/posts/${postId}/like`, { method: 'DELETE' }),

  sharePost: (postId: string, comment?: string) =>
    request<{ shared: boolean; shares_count: number }>(`/posts/${postId}/share`, { method: 'POST', body: { comment } }),

  getComments: (postId: string) =>
    request<{ comments: import('../types').Comment[] }>(`/posts/${postId}/comments`),

  createComment: (postId: string, data: { content: string; parent_id?: string; timestamp_position?: number }) =>
    request<{ comment: import('../types').Comment }>(`/posts/${postId}/comments`, { method: 'POST', body: data }),

  // Chat
  getConversations: () => request<{ conversations: import('../types').Conversation[] }>('/conversations'),

  getOrCreateConversation: (data: { participant_ids: string[]; is_group?: boolean; name?: string }) =>
    request<{ conversation: import('../types').Conversation }>('/conversations', { method: 'POST', body: data }),

  getMessages: (conversationId: string, before?: string, limit = 50) => {
    const params = new URLSearchParams();
    if (before) params.set('before', before);
    params.set('limit', limit.toString());
    return request<{ messages: import('../types').Message[] }>(`/conversations/${conversationId}/messages?${params}`);
  },

  sendMessage: (conversationId: string, data: Partial<import('../types').Message>) =>
    request<{ message: import('../types').Message }>(`/conversations/${conversationId}/messages`, { method: 'POST', body: data }),

  markAsRead: (conversationId: string) =>
    request<{ success: boolean }>(`/conversations/${conversationId}/read`, { method: 'PUT' }),

  getGroupMembers: (conversationId: string) =>
    request<{ members: (import('../types').User & { is_admin: boolean })[] }>(`/conversations/${conversationId}/members`),

  addGroupMember: (conversationId: string, userId: string) =>
    request<{ participants: import('../types').User[] }>(`/conversations/${conversationId}/members`, { method: 'POST', body: { user_id: userId } }),

  removeGroupMember: (conversationId: string, userId: string) =>
    request<{ success: boolean }>(`/conversations/${conversationId}/members/${userId}`, { method: 'DELETE' }),

  // Voice Rooms
  getVoiceRooms: () => request<{ rooms: import('../types').VoiceRoom[] }>('/voice-rooms'),

  createVoiceRoom: (data: { name: string; is_private?: boolean; max_participants?: number; genre?: string; description?: string }) =>
    request<{ room: import('../types').VoiceRoom }>('/voice-rooms', { method: 'POST', body: data }),

  getVoiceRoom: (roomId: string) => request<{ room: import('../types').VoiceRoom }>(`/voice-rooms/${roomId}`),

  joinVoiceRoom: (roomId: string) =>
    request<{ participant: import('../types').VoiceRoomParticipant }>(`/voice-rooms/${roomId}/join`, { method: 'POST' }),

  leaveVoiceRoom: (roomId: string) => request<{ success: boolean }>(`/voice-rooms/${roomId}/leave`, { method: 'POST' }),

  closeVoiceRoom: (roomId: string) => request<{ success: boolean }>(`/voice-rooms/${roomId}`, { method: 'DELETE' }),

  // Notifications
  getNotifications: (page = 1, limit = 20) =>
    request<{ notifications: import('../types').Notification[] }>(`/notifications?page=${page}&limit=${limit}`),

  getUnreadCount: () => request<{ count: number }>('/notifications/unread-count'),

  markNotificationAsRead: (notificationId: string) =>
    request<{ success: boolean }>(`/notifications/${notificationId}/read`, { method: 'PUT' }),

  markAllNotificationsAsRead: () => request<{ success: boolean }>('/notifications/read-all', { method: 'PUT' }),
};

export { ApiError };
