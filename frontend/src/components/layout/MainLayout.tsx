import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { useEffect } from 'react';
import { socketClient } from '@/lib/socket';
import { useAuthStore } from '@/stores/authStore';
import { usePostStore } from '@/stores/postStore';
import { useChatStore } from '@/stores/chatStore';
import { useNotificationStore } from '@/stores/notificationStore';
import type { Post, Message, Notification } from '@/types';

export function MainLayout() {
  const { user, token } = useAuthStore();
  const { updatePostInList, addNewPost } = usePostStore();
  const { addMessage, setTyping } = useChatStore();
  const { addNotification, fetchUnreadCount, fetchNotifications } = useNotificationStore();

  useEffect(() => {
    if (token) {
      socketClient.connect(token);
      // Fetch full list to compute per-category badge counts
      fetchNotifications();
      fetchUnreadCount();
    }

    return () => {
      // Don't disconnect on unmount to maintain connection
    };
  }, [token, fetchUnreadCount, fetchNotifications]);

  useEffect(() => {
    // Post events
    const unsubPostCreated = socketClient.on('post:created', (post: unknown) => {
      const postData = post as Post;
      if (postData.user_id !== user?.id) {
        addNewPost(postData);
      }
    });

    const unsubPostLiked = socketClient.on('post:liked', (data: unknown) => {
      const { postId, likesCount } = data as { postId: string; likesCount: number };
      updatePostInList(postId, { likes_count: likesCount });
    });

    const unsubPostUnliked = socketClient.on('post:unliked', (data: unknown) => {
      const { postId, likesCount } = data as { postId: string; likesCount: number };
      updatePostInList(postId, { likes_count: likesCount });
    });

    const unsubPostCommented = socketClient.on('post:commented', (data: unknown) => {
      const { postId, comment } = data as { postId: string; comment: { user_id: string } };
      // Skip if this client is the one who commented — the store already incremented locally
      if (comment?.user_id === user?.id) return;
      const currentPost = usePostStore.getState().posts.find((p) => p.id === postId);
      if (currentPost) {
        updatePostInList(postId, { comments_count: Number(currentPost.comments_count || 0) + 1 });
      }
    });

    // Message events
    const unsubNewMessage = socketClient.on('message:new', (message: unknown) => {
      const msgData = message as Message;
      if (msgData.sender_id !== user?.id) {
        addMessage(msgData);
      }
    });

    const unsubTypingStart = socketClient.on('typing:start', (data: unknown) => {
      const { conversationId, userId } = data as { conversationId: string; userId: string };
      setTyping(conversationId, userId, true);
    });

    const unsubTypingStop = socketClient.on('typing:stop', (data: unknown) => {
      const { conversationId, userId } = data as { conversationId: string; userId: string };
      setTyping(conversationId, userId, false);
    });

    // Notification events
    const unsubNotification = socketClient.on('notification:new', (notification: unknown) => {
      addNotification(notification as Notification);
    });

    return () => {
      unsubPostCreated();
      unsubPostLiked();
      unsubPostUnliked();
      unsubPostCommented();
      unsubNewMessage();
      unsubTypingStart();
      unsubTypingStop();
      unsubNotification();
    };
  }, [user, updatePostInList, addNewPost, addMessage, setTyping, addNotification]);

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <main className="ml-64 min-h-screen">
        <Outlet />
      </main>
    </div>
  );
}
