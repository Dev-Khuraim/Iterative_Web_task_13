export interface User {
  id: string;
  username: string;
  email: string;
  password_hash?: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  cover_image_url: string | null;
  producer_type: string | null;
  genres: string[] | null;
  website: string | null;
  soundcloud_url: string | null;
  spotify_url: string | null;
  is_online: boolean;
  last_seen: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface Post {
  id: string;
  user_id: string;
  content: string | null;
  audio_url: string | null;
  audio_duration: number | null;
  cover_image_url: string | null;
  title: string | null;
  genre: string | null;
  bpm: number | null;
  key_signature: string | null;
  tags: string[] | null;
  is_full_track: boolean;
  waveform_data: number[] | null;
  play_count: number;
  created_at: Date;
  updated_at: Date;
  user?: User;
  likes_count?: number;
  comments_count?: number;
  shares_count?: number;
  is_liked?: boolean;
  is_shared?: boolean;
  is_repost?: boolean;
  reposted_by?: string | null;
  repost_time?: Date | null;
}

export interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  parent_id: string | null;
  content: string;
  timestamp_position: number | null;
  created_at: Date;
  updated_at: Date;
  user?: User;
  replies?: Comment[];
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string | null;
  message_type: 'text' | 'audio' | 'image' | 'track_share';
  audio_url: string | null;
  image_url: string | null;
  shared_post_id: string | null;
  is_read: boolean;
  created_at: Date;
  updated_at: Date;
  sender?: User;
  shared_post?: Post;
}

export interface Conversation {
  id: string;
  is_group: boolean;
  name: string | null;
  created_at: Date;
  updated_at: Date;
  participants?: User[];
  last_message?: Message;
  unread_count?: number;
}

export interface Friendship {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: Date;
  updated_at: Date;
  requester?: User;
  addressee?: User;
}

export interface VoiceRoom {
  id: string;
  name: string;
  host_id: string;
  is_private: boolean;
  max_participants: number;
  genre: string | null;
  description: string | null;
  is_active: boolean;
  created_at: Date;
  host?: User;
  participants?: VoiceRoomParticipant[];
}

export interface VoiceRoomParticipant {
  id: string;
  room_id: string;
  user_id: string;
  is_muted: boolean;
  is_speaking: boolean;
  joined_at: Date;
  user?: User;
}

export interface Notification {
  id: string;
  user_id: string;
  type: 'like' | 'comment' | 'follow' | 'friend_request' | 'friend_accepted' | 'message' | 'share';
  actor_id: string | null;
  post_id: string | null;
  message_id: string | null;
  content: string | null;
  is_read: boolean;
  created_at: Date;
  actor?: User;
  post?: Post;
}

export interface AuthPayload {
  userId: string;
  username: string;
  email: string;
}

export interface WebSocketEvents {
  // Posts
  'post:created': Post;
  'post:liked': { postId: string; userId: string; likesCount: number };
  'post:unliked': { postId: string; userId: string; likesCount: number };
  'post:commented': { postId: string; comment: Comment };
  'post:shared': { postId: string; userId: string; sharesCount: number };

  // Messages
  'message:new': Message;
  'message:read': { conversationId: string; userId: string };
  'typing:start': { conversationId: string; userId: string };
  'typing:stop': { conversationId: string; userId: string };

  // Voice rooms
  'voice:joined': { roomId: string; participant: VoiceRoomParticipant };
  'voice:left': { roomId: string; userId: string };
  'voice:muted': { roomId: string; userId: string; isMuted: boolean };
  'voice:speaking': { roomId: string; userId: string; isSpeaking: boolean };
  'voice:signal': { roomId: string; fromUserId: string; toUserId: string; signal: unknown };

  // Presence
  'user:online': { userId: string };
  'user:offline': { userId: string };

  // Notifications
  'notification:new': Notification;

  // Friends
  'friend:request': Friendship;
  'friend:accepted': Friendship;
}
