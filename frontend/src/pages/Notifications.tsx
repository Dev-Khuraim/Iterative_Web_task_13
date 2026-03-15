import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useNotificationStore } from '@/stores/notificationStore';
import { cn, formatTimeAgo, getInitials } from '@/lib/utils';
import type { Notification } from '@/types';
import {
  Heart,
  MessageCircle,
  UserPlus,
  Share2,
  Bell,
  CheckCheck,
  Loader2,
} from 'lucide-react';

const notificationIcons: Record<string, typeof Heart> = {
  like: Heart,
  comment: MessageCircle,
  follow: UserPlus,
  friend_request: UserPlus,
  friend_accepted: UserPlus,
  share: Share2,
  message: MessageCircle,
};

export function Notifications() {
  const { notifications, isLoading, fetchNotifications, markAsRead, markAllAsRead, clearNotificationBadge } =
    useNotificationStore();

  useEffect(() => {
    clearNotificationBadge();
    fetchNotifications();
  }, [fetchNotifications, clearNotificationBadge]);

  const handleMarkAsRead = async (notification: Notification) => {
    if (!notification.is_read) {
      await markAsRead(notification.id);
    }
  };

  const getNotificationLink = (notification: Notification): string => {
    if (notification.post_id) return `/post/${notification.post_id}`;
    if (notification.actor_id) return `/profile/${notification.actor_id}`;
    return '#';
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Notifications</h1>
        <Button variant="outline" size="sm" onClick={markAllAsRead}>
          <CheckCheck className="w-4 h-4 mr-2" />
          Mark all as read
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-beat-purple" />
        </div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-beat-purple to-beat-pink flex items-center justify-center">
            <Bell className="w-10 h-10 text-white" />
          </div>
          <h3 className="text-xl font-semibold mb-2">No notifications yet</h3>
          <p className="text-muted-foreground">
            When someone interacts with your posts, you'll see it here
          </p>
        </div>
      ) : (
        <ScrollArea className="h-[calc(100vh-200px)]">
          <div className="space-y-2">
            {notifications.map((notification) => {
              const Icon = notificationIcons[notification.type] || Bell;

              return (
                <Link
                  key={notification.id}
                  to={getNotificationLink(notification)}
                  onClick={() => handleMarkAsRead(notification)}
                  className={cn(
                    'flex items-start gap-4 p-4 rounded-lg transition-colors',
                    notification.is_read
                      ? 'bg-card hover:bg-secondary'
                      : 'bg-beat-purple/10 hover:bg-beat-purple/20'
                  )}
                >
                  <Avatar>
                    <AvatarImage src={notification.actor?.avatar_url || undefined} />
                    <AvatarFallback>
                      {getInitials(notification.actor?.display_name || null)}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <p>
                      <span className="font-semibold">
                        {notification.actor?.display_name || notification.actor?.username}
                      </span>{' '}
                      {notification.content}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {formatTimeAgo(notification.created_at)}
                    </p>
                  </div>

                  <div
                    className={cn(
                      'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0',
                      notification.type === 'like' && 'bg-beat-pink/20 text-beat-pink',
                      notification.type === 'comment' && 'bg-beat-blue/20 text-beat-blue',
                      notification.type === 'follow' && 'bg-beat-purple/20 text-beat-purple',
                      notification.type === 'friend_request' && 'bg-beat-orange/20 text-beat-orange',
                      notification.type === 'friend_accepted' && 'bg-green-500/20 text-green-500',
                      notification.type === 'share' && 'bg-beat-cyan/20 text-beat-cyan',
                      notification.type === 'message' && 'bg-beat-yellow/20 text-beat-yellow'
                    )}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                </Link>
              );
            })}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
