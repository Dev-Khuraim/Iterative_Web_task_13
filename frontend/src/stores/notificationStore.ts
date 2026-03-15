import { create } from 'zustand';
import type { Notification } from '../types';
import { api } from '../lib/api';

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  friendRequestCount: number;
  messageCount: number;
  notificationOnlyCount: number;
  isLoading: boolean;
  fetchNotifications: (page?: number) => Promise<void>;
  fetchUnreadCount: () => Promise<void>;
  addNotification: (notification: Notification) => void;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  clearFriendBadge: () => void;
  clearMessageBadge: () => void;
  clearNotificationBadge: () => void;
}

function countByType(notifications: Notification[], type: Notification['type']): number {
  return notifications.filter((n) => !n.is_read && n.type === type).length;
}

function countByTypes(notifications: Notification[], types: Notification['type'][]): number {
  return notifications.filter((n) => !n.is_read && types.includes(n.type)).length;
}

const FRIEND_TYPES: Notification['type'][] = ['friend_request', 'friend_accepted'];
const NON_BADGE_TYPES: Notification['type'][] = ['friend_request', 'friend_accepted', 'message'];

function countNotificationOnly(notifications: Notification[]): number {
  return notifications.filter((n) => !n.is_read && !NON_BADGE_TYPES.includes(n.type)).length;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  friendRequestCount: 0,
  messageCount: 0,
  notificationOnlyCount: 0,
  isLoading: false,

  fetchNotifications: async (page = 1) => {
    set({ isLoading: true });
    try {
      const { notifications } = await api.getNotifications(page);
      const merged = page === 1 ? notifications : [...get().notifications, ...notifications];
      set({
        notifications: merged,
        friendRequestCount: countByTypes(merged, FRIEND_TYPES),
        messageCount: countByType(merged, 'message'),
        notificationOnlyCount: countNotificationOnly(merged),
      });
    } finally {
      set({ isLoading: false });
    }
  },

  fetchUnreadCount: async () => {
    const { count } = await api.getUnreadCount();
    set({ unreadCount: count });
  },

  addNotification: (notification) => {
    const notifications = [notification, ...get().notifications];
    set({
      notifications,
      unreadCount: get().unreadCount + 1,
      friendRequestCount: countByTypes(notifications, FRIEND_TYPES),
      messageCount: countByType(notifications, 'message'),
      notificationOnlyCount: countNotificationOnly(notifications),
    });
  },

  markAsRead: async (notificationId) => {
    await api.markNotificationAsRead(notificationId);
    const notifications = get().notifications.map((n) =>
      n.id === notificationId ? { ...n, is_read: true } : n
    );
    set({
      notifications,
      unreadCount: Math.max(0, get().unreadCount - 1),
      friendRequestCount: countByTypes(notifications, FRIEND_TYPES),
      messageCount: countByType(notifications, 'message'),
      notificationOnlyCount: countNotificationOnly(notifications),
    });
  },

  markAllAsRead: async () => {
    await api.markAllNotificationsAsRead();
    const notifications = get().notifications.map((n) => ({ ...n, is_read: true }));
    set({
      notifications,
      unreadCount: 0,
      friendRequestCount: 0,
      messageCount: 0,
      notificationOnlyCount: 0,
    });
  },

  clearFriendBadge: () => {
    set({ friendRequestCount: 0 });
  },

  clearMessageBadge: () => {
    set({ messageCount: 0 });
  },

  clearNotificationBadge: () => {
    set({ notificationOnlyCount: 0 });
  },
}));
