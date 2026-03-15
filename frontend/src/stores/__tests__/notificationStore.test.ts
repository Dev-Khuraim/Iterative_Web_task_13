import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock modules BEFORE importing the store
vi.mock('../../lib/api', () => ({
  api: {
    getNotifications: vi.fn(),
    getUnreadCount: vi.fn(),
    markNotificationAsRead: vi.fn(),
    markAllNotificationsAsRead: vi.fn(),
  },
}));

// Now import the store and get access to mocked modules
import { useNotificationStore } from '../notificationStore';
import { api } from '../../lib/api';

const mockApi = api as {
  getNotifications: ReturnType<typeof vi.fn>;
  getUnreadCount: ReturnType<typeof vi.fn>;
  markNotificationAsRead: ReturnType<typeof vi.fn>;
  markAllNotificationsAsRead: ReturnType<typeof vi.fn>;
};

const sampleNotification = {
  id: 'notif-1',
  user_id: 'user-1',
  type: 'like' as const,
  actor_id: 'user-2',
  post_id: 'post-1',
  content: null,
  is_read: false,
  created_at: new Date().toISOString(),
};

const friendRequestNotification = {
  ...sampleNotification,
  id: 'notif-2',
  type: 'friend_request' as const,
};

const friendAcceptedNotification = {
  ...sampleNotification,
  id: 'notif-3',
  type: 'friend_accepted' as const,
};

const messageNotification = {
  ...sampleNotification,
  id: 'notif-4',
  type: 'message' as const,
};

const commentNotification = {
  ...sampleNotification,
  id: 'notif-5',
  type: 'comment' as const,
};

describe('notificationStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset store state
    useNotificationStore.setState({
      notifications: [],
      unreadCount: 0,
      friendRequestCount: 0,
      messageCount: 0,
      notificationOnlyCount: 0,
      isLoading: false,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchNotifications', () => {
    it('fetches and sets notifications (page 1)', async () => {
      mockApi.getNotifications.mockResolvedValueOnce({
        notifications: [sampleNotification],
      });

      const { fetchNotifications } = useNotificationStore.getState();
      await fetchNotifications(1);

      const state = useNotificationStore.getState();
      expect(state.notifications).toEqual([sampleNotification]);
      expect(state.isLoading).toBe(false);
      expect(state.notificationOnlyCount).toBe(1); // like is not friend_request/friend_accepted/message
    });

    it('appends notifications on subsequent pages', async () => {
      useNotificationStore.setState({ notifications: [sampleNotification] });
      const notif2 = { ...sampleNotification, id: 'notif-2' };
      mockApi.getNotifications.mockResolvedValueOnce({ notifications: [notif2] });

      const { fetchNotifications } = useNotificationStore.getState();
      await fetchNotifications(2);

      const state = useNotificationStore.getState();
      expect(state.notifications).toHaveLength(2);
    });

    it('calculates friend request count', async () => {
      mockApi.getNotifications.mockResolvedValueOnce({
        notifications: [friendRequestNotification, friendAcceptedNotification],
      });

      const { fetchNotifications } = useNotificationStore.getState();
      await fetchNotifications(1);

      const state = useNotificationStore.getState();
      expect(state.friendRequestCount).toBe(2);
    });

    it('calculates message count', async () => {
      mockApi.getNotifications.mockResolvedValueOnce({
        notifications: [messageNotification],
      });

      const { fetchNotifications } = useNotificationStore.getState();
      await fetchNotifications(1);

      const state = useNotificationStore.getState();
      expect(state.messageCount).toBe(1);
    });

    it('excludes friend/message types from notificationOnlyCount', async () => {
      mockApi.getNotifications.mockResolvedValueOnce({
        notifications: [
          sampleNotification, // like - counted
          friendRequestNotification, // friend_request - excluded
          messageNotification, // message - excluded
          commentNotification, // comment - counted
        ],
      });

      const { fetchNotifications } = useNotificationStore.getState();
      await fetchNotifications(1);

      const state = useNotificationStore.getState();
      expect(state.notificationOnlyCount).toBe(2); // like + comment
    });

    it('does not count read notifications', async () => {
      mockApi.getNotifications.mockResolvedValueOnce({
        notifications: [
          { ...sampleNotification, is_read: true },
          { ...friendRequestNotification, is_read: true },
        ],
      });

      const { fetchNotifications } = useNotificationStore.getState();
      await fetchNotifications(1);

      const state = useNotificationStore.getState();
      expect(state.friendRequestCount).toBe(0);
      expect(state.notificationOnlyCount).toBe(0);
    });
  });

  describe('fetchUnreadCount', () => {
    it('fetches and sets unread count', async () => {
      mockApi.getUnreadCount.mockResolvedValueOnce({ count: 10 });

      const { fetchUnreadCount } = useNotificationStore.getState();
      await fetchUnreadCount();

      const state = useNotificationStore.getState();
      expect(state.unreadCount).toBe(10);
    });
  });

  describe('addNotification', () => {
    it('adds notification and updates counts', () => {
      const { addNotification } = useNotificationStore.getState();
      addNotification(sampleNotification);

      const state = useNotificationStore.getState();
      expect(state.notifications[0]).toEqual(sampleNotification);
      expect(state.unreadCount).toBe(1);
      expect(state.notificationOnlyCount).toBe(1);
    });

    it('adds friend notification and updates friend count', () => {
      const { addNotification } = useNotificationStore.getState();
      addNotification(friendRequestNotification);

      const state = useNotificationStore.getState();
      expect(state.friendRequestCount).toBe(1);
      expect(state.notificationOnlyCount).toBe(0);
    });

    it('adds message notification and updates message count', () => {
      const { addNotification } = useNotificationStore.getState();
      addNotification(messageNotification);

      const state = useNotificationStore.getState();
      expect(state.messageCount).toBe(1);
      expect(state.notificationOnlyCount).toBe(0);
    });
  });

  describe('markAsRead', () => {
    it('marks notification as read and updates counts', async () => {
      useNotificationStore.setState({
        notifications: [sampleNotification],
        unreadCount: 1,
        notificationOnlyCount: 1,
      });
      mockApi.markNotificationAsRead.mockResolvedValueOnce({ success: true });

      const { markAsRead } = useNotificationStore.getState();
      await markAsRead('notif-1');

      const state = useNotificationStore.getState();
      expect(state.notifications[0].is_read).toBe(true);
      expect(state.unreadCount).toBe(0);
      expect(state.notificationOnlyCount).toBe(0);
    });

    it('does not go below 0 unread', async () => {
      useNotificationStore.setState({
        notifications: [sampleNotification],
        unreadCount: 0,
      });
      mockApi.markNotificationAsRead.mockResolvedValueOnce({ success: true });

      const { markAsRead } = useNotificationStore.getState();
      await markAsRead('notif-1');

      const state = useNotificationStore.getState();
      expect(state.unreadCount).toBe(0);
    });

    it('recalculates friend count on mark read', async () => {
      useNotificationStore.setState({
        notifications: [friendRequestNotification],
        unreadCount: 1,
        friendRequestCount: 1,
      });
      mockApi.markNotificationAsRead.mockResolvedValueOnce({ success: true });

      const { markAsRead } = useNotificationStore.getState();
      await markAsRead('notif-2');

      const state = useNotificationStore.getState();
      expect(state.friendRequestCount).toBe(0);
    });

    it('does not modify unmatched notifications', async () => {
      const notif2 = { ...sampleNotification, id: 'notif-99', is_read: false };
      useNotificationStore.setState({
        notifications: [sampleNotification, notif2],
        unreadCount: 2,
        notificationOnlyCount: 2,
      });
      mockApi.markNotificationAsRead.mockResolvedValueOnce({ success: true });

      const { markAsRead } = useNotificationStore.getState();
      await markAsRead('notif-1');

      const state = useNotificationStore.getState();
      expect(state.notifications[0].is_read).toBe(true);
      expect(state.notifications[1].is_read).toBe(false); // unchanged
    });
  });

  describe('markAllAsRead', () => {
    it('marks all notifications as read', async () => {
      useNotificationStore.setState({
        notifications: [sampleNotification, friendRequestNotification, messageNotification],
        unreadCount: 3,
        friendRequestCount: 1,
        messageCount: 1,
        notificationOnlyCount: 1,
      });
      mockApi.markAllNotificationsAsRead.mockResolvedValueOnce({ success: true });

      const { markAllAsRead } = useNotificationStore.getState();
      await markAllAsRead();

      const state = useNotificationStore.getState();
      expect(state.notifications.every((n) => n.is_read)).toBe(true);
      expect(state.unreadCount).toBe(0);
      expect(state.friendRequestCount).toBe(0);
      expect(state.messageCount).toBe(0);
      expect(state.notificationOnlyCount).toBe(0);
    });
  });

  describe('clearFriendBadge', () => {
    it('clears friend badge count', () => {
      useNotificationStore.setState({ friendRequestCount: 5 });

      const { clearFriendBadge } = useNotificationStore.getState();
      clearFriendBadge();

      const state = useNotificationStore.getState();
      expect(state.friendRequestCount).toBe(0);
    });
  });

  describe('clearMessageBadge', () => {
    it('clears message badge count', () => {
      useNotificationStore.setState({ messageCount: 3 });

      const { clearMessageBadge } = useNotificationStore.getState();
      clearMessageBadge();

      const state = useNotificationStore.getState();
      expect(state.messageCount).toBe(0);
    });
  });

  describe('clearNotificationBadge', () => {
    it('clears notification badge count', () => {
      useNotificationStore.setState({ notificationOnlyCount: 7 });

      const { clearNotificationBadge } = useNotificationStore.getState();
      clearNotificationBadge();

      const state = useNotificationStore.getState();
      expect(state.notificationOnlyCount).toBe(0);
    });
  });
});
