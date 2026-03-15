import { Server, Socket } from 'socket.io';
import { verifyToken } from '../middleware/auth.js';
import { query } from '../database/db.js';
import { createNotification } from '../controllers/notificationController.js';
import type { AuthPayload, User, Post, Comment, Message, Notification } from '../types/index.js';

interface AuthenticatedSocket extends Socket {
  user?: AuthPayload;
}

// Store user socket mappings
const userSockets = new Map<string, Set<string>>();

// Group voice: conversationId -> Set of userIds currently in the call
const groupVoiceParticipants = new Map<string, Set<string>>();

export const setupWebSocket = (io: Server): void => {
  // Authentication middleware
  io.use((socket: AuthenticatedSocket, next) => {
    const token = socket.handshake.auth.token as string | undefined;

    if (token) {
      const user = verifyToken(token);
      if (user) {
        socket.user = user;
      }
    }

    next();
  });

  io.on('connection', (socket: AuthenticatedSocket) => {
    console.log(`Client connected: ${socket.id}`);

    if (socket.user) {
      // Track user's sockets
      if (!userSockets.has(socket.user.userId)) {
        userSockets.set(socket.user.userId, new Set());
      }
      userSockets.get(socket.user.userId)?.add(socket.id);

      // Update online status
      updateUserOnlineStatus(socket.user.userId, true);

      // Broadcast online status
      socket.broadcast.emit('user:online', { userId: socket.user.userId });

      // Join user's personal room for notifications
      socket.join(`user:${socket.user.userId}`);
    }

    // Join conversation room
    socket.on('conversation:join', (conversationId: string) => {
      socket.join(`conversation:${conversationId}`);
    });

    // Leave conversation room
    socket.on('conversation:leave', (conversationId: string) => {
      socket.leave(`conversation:${conversationId}`);
    });

    // Handle new message
    socket.on('message:send', async (data: { conversationId: string; message: Message }) => {
      if (!socket.user) return;

      // Get conversation participants
      const participants = await getConversationParticipants(data.conversationId);

      // Emit to all participants
      io.to(`conversation:${data.conversationId}`).emit('message:new', data.message);

      // Send notifications to offline participants
      for (const participant of participants) {
        if (participant.id !== socket.user.userId) {
          // Create notification
          const notification = await createNotification(
            participant.id,
            'message',
            socket.user.userId,
            undefined,
            'sent you a message'
          );

          if (notification) {
            // Get actor info for the notification
            const actorResult = await query<User>(
              'SELECT id, username, display_name, avatar_url FROM users WHERE id = $1',
              [socket.user.userId]
            );

            io.to(`user:${participant.id}`).emit('notification:new', {
              ...notification,
              actor: actorResult.rows[0],
            });
          }
        }
      }
    });

    // Typing indicators
    socket.on('typing:start', (data: { conversationId: string }) => {
      if (!socket.user) return;
      socket.to(`conversation:${data.conversationId}`).emit('typing:start', {
        conversationId: data.conversationId,
        userId: socket.user.userId,
      });
    });

    socket.on('typing:stop', (data: { conversationId: string }) => {
      if (!socket.user) return;
      socket.to(`conversation:${data.conversationId}`).emit('typing:stop', {
        conversationId: data.conversationId,
        userId: socket.user.userId,
      });
    });

    // Join voice room
    socket.on('voice:join', (roomId: string) => {
      socket.join(`voice:${roomId}`);
      if (socket.user) {
        socket.to(`voice:${roomId}`).emit('voice:joined', {
          roomId,
          userId: socket.user.userId,
        });
      }
    });

    // Leave voice room
    socket.on('voice:leave', (roomId: string) => {
      socket.leave(`voice:${roomId}`);
      if (socket.user) {
        socket.to(`voice:${roomId}`).emit('voice:left', {
          roomId,
          userId: socket.user.userId,
        });
      }
    });

    // Voice mute toggle
    socket.on('voice:mute', (data: { roomId: string; isMuted: boolean }) => {
      if (!socket.user) return;
      io.to(`voice:${data.roomId}`).emit('voice:muted', {
        roomId: data.roomId,
        userId: socket.user.userId,
        isMuted: data.isMuted,
      });
    });

    // Voice speaking indicator
    socket.on('voice:speaking', (data: { roomId: string; isSpeaking: boolean }) => {
      if (!socket.user) return;
      socket.to(`voice:${data.roomId}`).emit('voice:speaking', {
        roomId: data.roomId,
        userId: socket.user.userId,
        isSpeaking: data.isSpeaking,
      });
    });

    // Group voice chat (in-memory only, not tied to voice rooms)
    socket.on('group-voice:join', (conversationId: string) => {
      if (!socket.user) return;
      const userId = socket.user.userId;

      if (!groupVoiceParticipants.has(conversationId)) {
        groupVoiceParticipants.set(conversationId, new Set());
      }
      // Return list of existing participants to the joiner so they can initiate offers
      const existing = Array.from(groupVoiceParticipants.get(conversationId)!);
      socket.emit('group-voice:participants', { conversationId, participants: existing });

      groupVoiceParticipants.get(conversationId)!.add(userId);
      socket.join(`group-voice:${conversationId}`);

      // Notify existing participants that someone joined
      socket.to(`group-voice:${conversationId}`).emit('group-voice:joined', {
        conversationId,
        userId,
      });
    });

    socket.on('group-voice:leave', (conversationId: string) => {
      if (!socket.user) return;
      const userId = socket.user.userId;
      socket.leave(`group-voice:${conversationId}`);
      groupVoiceParticipants.get(conversationId)?.delete(userId);
      if (groupVoiceParticipants.get(conversationId)?.size === 0) {
        groupVoiceParticipants.delete(conversationId);
      }
      socket.to(`group-voice:${conversationId}`).emit('group-voice:left', {
        conversationId,
        userId,
      });
    });

    socket.on('group-voice:mute', (data: { conversationId: string; isMuted: boolean }) => {
      if (!socket.user) return;
      socket.to(`group-voice:${data.conversationId}`).emit('group-voice:muted', {
        conversationId: data.conversationId,
        userId: socket.user.userId,
        isMuted: data.isMuted,
      });
    });

    socket.on('group-voice:speaking', (data: { conversationId: string; isSpeaking: boolean }) => {
      if (!socket.user) return;
      socket.to(`group-voice:${data.conversationId}`).emit('group-voice:speaking', {
        conversationId: data.conversationId,
        userId: socket.user.userId,
        isSpeaking: data.isSpeaking,
      });
    });

    // WebRTC signaling for voice
    socket.on('voice:signal', (data: { roomId: string; toUserId: string; signal: unknown }) => {
      if (!socket.user) return;

      // Find the target user's socket
      const targetSockets = userSockets.get(data.toUserId);
      if (targetSockets) {
        targetSockets.forEach((socketId) => {
          io.to(socketId).emit('voice:signal', {
            roomId: data.roomId,
            fromUserId: socket.user!.userId,
            signal: data.signal,
          });
        });
      }
    });

    // Post interactions - broadcast to all connected clients
    socket.on('post:created', async (post: Post) => {
      socket.broadcast.emit('post:created', post);
    });

    socket.on('post:liked', async (data: { postId: string; post: Post }) => {
      if (!socket.user) return;

      // Broadcast like to all clients
      io.emit('post:liked', {
        postId: data.postId,
        userId: socket.user.userId,
        likesCount: data.post.likes_count,
      });

      // Notify post owner
      if (data.post.user_id !== socket.user.userId) {
        const notification = await createNotification(
          data.post.user_id,
          'like',
          socket.user.userId,
          data.postId,
          'liked your track'
        );

        if (notification) {
          const actorResult = await query<User>(
            'SELECT id, username, display_name, avatar_url FROM users WHERE id = $1',
            [socket.user.userId]
          );

          io.to(`user:${data.post.user_id}`).emit('notification:new', {
            ...notification,
            actor: actorResult.rows[0],
          });
        }
      }
    });

    socket.on('post:unliked', (data: { postId: string; likesCount: number }) => {
      if (!socket.user) return;
      io.emit('post:unliked', {
        postId: data.postId,
        userId: socket.user.userId,
        likesCount: data.likesCount,
      });
    });

    socket.on('post:commented', async (data: { postId: string; comment: Comment; postOwnerId: string }) => {
      if (!socket.user) return;

      // Broadcast comment to all clients
      io.emit('post:commented', {
        postId: data.postId,
        comment: data.comment,
      });

      // Notify post owner
      if (data.postOwnerId !== socket.user.userId) {
        const notification = await createNotification(
          data.postOwnerId,
          'comment',
          socket.user.userId,
          data.postId,
          'commented on your track'
        );

        if (notification) {
          const actorResult = await query<User>(
            'SELECT id, username, display_name, avatar_url FROM users WHERE id = $1',
            [socket.user.userId]
          );

          io.to(`user:${data.postOwnerId}`).emit('notification:new', {
            ...notification,
            actor: actorResult.rows[0],
          });
        }
      }
    });

    socket.on('post:shared', async (data: { postId: string; sharesCount: number; postOwnerId: string }) => {
      if (!socket.user) return;

      io.emit('post:shared', {
        postId: data.postId,
        userId: socket.user.userId,
        sharesCount: data.sharesCount,
      });

      // Notify post owner
      if (data.postOwnerId !== socket.user.userId) {
        const notification = await createNotification(
          data.postOwnerId,
          'share',
          socket.user.userId,
          data.postId,
          'shared your track'
        );

        if (notification) {
          const actorResult = await query<User>(
            'SELECT id, username, display_name, avatar_url FROM users WHERE id = $1',
            [socket.user.userId]
          );

          io.to(`user:${data.postOwnerId}`).emit('notification:new', {
            ...notification,
            actor: actorResult.rows[0],
          });
        }
      }
    });

    // Friend request notifications
    socket.on('friend:request', async (data: { toUserId: string }) => {
      if (!socket.user) return;

      const notification = await createNotification(
        data.toUserId,
        'friend_request',
        socket.user.userId,
        undefined,
        'sent you a friend request'
      );

      if (notification) {
        const actorResult = await query<User>(
          'SELECT id, username, display_name, avatar_url FROM users WHERE id = $1',
          [socket.user.userId]
        );

        io.to(`user:${data.toUserId}`).emit('notification:new', {
          ...notification,
          actor: actorResult.rows[0],
        });

        io.to(`user:${data.toUserId}`).emit('friend:request', {
          requester_id: socket.user.userId,
          requester: actorResult.rows[0],
        });
      }
    });

    socket.on('friend:accepted', async (data: { toUserId: string }) => {
      if (!socket.user) return;

      const notification = await createNotification(
        data.toUserId,
        'friend_accepted',
        socket.user.userId,
        undefined,
        'accepted your friend request'
      );

      if (notification) {
        const actorResult = await query<User>(
          'SELECT id, username, display_name, avatar_url FROM users WHERE id = $1',
          [socket.user.userId]
        );

        io.to(`user:${data.toUserId}`).emit('notification:new', {
          ...notification,
          actor: actorResult.rows[0],
        });

        io.to(`user:${data.toUserId}`).emit('friend:accepted', {
          addressee_id: socket.user.userId,
          addressee: actorResult.rows[0],
        });
      }
    });

    // Disconnect
    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`);

      if (socket.user) {
        const userId = socket.user.userId;
        const sockets = userSockets.get(userId);
        if (sockets) {
          sockets.delete(socket.id);
          if (sockets.size === 0) {
            userSockets.delete(userId);
            updateUserOnlineStatus(userId, false);
            socket.broadcast.emit('user:offline', { userId });
          }
        }

        // Clean up any group voice rooms this user was in
        groupVoiceParticipants.forEach((participants, conversationId) => {
          if (participants.has(userId)) {
            participants.delete(userId);
            if (participants.size === 0) {
              groupVoiceParticipants.delete(conversationId);
            }
            socket.to(`group-voice:${conversationId}`).emit('group-voice:left', {
              conversationId,
              userId,
            });
          }
        });
      }
    });
  });
};

async function updateUserOnlineStatus(userId: string, isOnline: boolean): Promise<void> {
  try {
    await query(
      'UPDATE users SET is_online = $1, last_seen = NOW() WHERE id = $2',
      [isOnline, userId]
    );
  } catch (error) {
    console.error('Error updating online status:', error);
  }
}

async function getConversationParticipants(conversationId: string): Promise<User[]> {
  try {
    const result = await query<User>(
      `SELECT u.id, u.username, u.display_name, u.avatar_url
       FROM conversation_participants cp
       JOIN users u ON cp.user_id = u.id
       WHERE cp.conversation_id = $1`,
      [conversationId]
    );
    return result.rows;
  } catch (error) {
    console.error('Error getting conversation participants:', error);
    return [];
  }
}

export { userSockets };
