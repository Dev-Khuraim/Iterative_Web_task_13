export interface User {
  id: string;
  username: string;
  email: string;
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
  last_seen: string | null;
  created_at: string;
  followers_count?: number;
  following_count?: number;
  posts_count?: number;
  friendship_status?: 'pending' | 'accepted' | 'rejected' | null;
  is_following?: boolean;
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
  is_edited: boolean;
  created_at: string;
  updated_at: string;
  user?: User;
  likes_count?: number;
  comments_count?: number;
  shares_count?: number;
  is_liked?: boolean;
  is_shared?: boolean;
  is_repost?: boolean;
  reposted_by?: string | null;
  repost_time?: string | null;
}

export interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  parent_id: string | null;
  content: string;
  timestamp_position: number | null;
  created_at: string;
  updated_at: string;
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
  created_at: string;
  updated_at: string;
  sender?: User;
  shared_post?: Post;
}

export interface Conversation {
  id: string;
  is_group: boolean;
  name: string | null;
  created_at: string;
  updated_at: string;
  participants?: User[];
  last_message?: Message;
  unread_count?: number;
}

export interface Friendship {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
  updated_at: string;
  requester?: User;
  addressee?: User;
  friend?: User;
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
  created_at: string;
  host?: User;
  participants?: VoiceRoomParticipant[];
  participant_count?: number;
}

export interface VoiceRoomParticipant {
  id: string;
  room_id: string;
  user_id: string;
  is_muted: boolean;
  is_speaking: boolean;
  joined_at: string;
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
  created_at: string;
  actor?: User;
  post?: Post;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}
