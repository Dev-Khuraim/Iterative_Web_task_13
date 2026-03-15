import { io, Socket } from 'socket.io-client';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3001';

class SocketClient {
  private socket: Socket | null = null;
  private listeners: Map<string, Set<(...args: unknown[]) => void>> = new Map();

  connect(token?: string) {
    if (this.socket?.connected) return;

    this.socket = io(WS_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    this.socket.on('connect', () => {
      console.log('Socket connected');
      // Re-register all listeners, removing any stale duplicate bindings first
      this.listeners.forEach((callbacks, event) => {
        callbacks.forEach((callback) => {
          this.socket?.off(event, callback);
          this.socket?.on(event, callback);
        });
      });
    });

    this.socket.on('disconnect', () => {
      console.log('Socket disconnected');
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.listeners.clear();
  }

  on(event: string, callback: (...args: unknown[]) => void) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)?.add(callback);

    if (this.socket) {
      this.socket.on(event, callback);
    }

    return () => {
      this.listeners.get(event)?.delete(callback);
      this.socket?.off(event, callback);
    };
  }

  off(event: string, callback: (...args: unknown[]) => void) {
    this.listeners.get(event)?.delete(callback);
    this.socket?.off(event, callback);
  }

  emit(event: string, data?: unknown) {
    if (this.socket?.connected) {
      this.socket.emit(event, data);
    }
  }

  // Conversation methods
  joinConversation(conversationId: string) {
    this.emit('conversation:join', conversationId);
  }

  leaveConversation(conversationId: string) {
    this.emit('conversation:leave', conversationId);
  }

  sendMessage(conversationId: string, message: unknown) {
    this.emit('message:send', { conversationId, message });
  }

  startTyping(conversationId: string) {
    this.emit('typing:start', { conversationId });
  }

  stopTyping(conversationId: string) {
    this.emit('typing:stop', { conversationId });
  }

  // Voice room methods
  joinVoiceRoom(roomId: string) {
    this.emit('voice:join', roomId);
  }

  leaveVoiceRoom(roomId: string) {
    this.emit('voice:leave', roomId);
  }

  toggleMute(roomId: string, isMuted: boolean) {
    this.emit('voice:mute', { roomId, isMuted });
  }

  setSpeaking(roomId: string, isSpeaking: boolean) {
    this.emit('voice:speaking', { roomId, isSpeaking });
  }

  sendVoiceSignal(roomId: string, toUserId: string, signal: unknown) {
    this.emit('voice:signal', { roomId, toUserId, signal });
  }

  // Group voice methods (scoped to a conversation, no DB record)
  joinGroupVoice(conversationId: string) {
    this.emit('group-voice:join', conversationId);
  }

  leaveGroupVoice(conversationId: string) {
    this.emit('group-voice:leave', conversationId);
  }

  setGroupVoiceMute(conversationId: string, isMuted: boolean) {
    this.emit('group-voice:mute', { conversationId, isMuted });
  }

  setGroupVoiceSpeaking(conversationId: string, isSpeaking: boolean) {
    this.emit('group-voice:speaking', { conversationId, isSpeaking });
  }

  // Post interaction methods
  emitPostCreated(post: unknown) {
    this.emit('post:created', post);
  }

  emitPostLiked(postId: string, post: unknown) {
    this.emit('post:liked', { postId, post });
  }

  emitPostUnliked(postId: string, likesCount: number) {
    this.emit('post:unliked', { postId, likesCount });
  }

  emitPostCommented(postId: string, comment: unknown, postOwnerId: string) {
    this.emit('post:commented', { postId, comment, postOwnerId });
  }

  emitPostShared(postId: string, sharesCount: number, postOwnerId: string) {
    this.emit('post:shared', { postId, sharesCount, postOwnerId });
  }

  // Friend request methods
  emitFriendRequest(toUserId: string) {
    this.emit('friend:request', { toUserId });
  }

  emitFriendAccepted(toUserId: string) {
    this.emit('friend:accepted', { toUserId });
  }

  get connected() {
    return this.socket?.connected ?? false;
  }
}

export const socketClient = new SocketClient();
