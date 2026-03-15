import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { api } from '@/lib/api';
import { useChatStore } from '@/stores/chatStore';
import { socketClient } from '@/lib/socket';
import { getInitials } from '@/lib/utils';
import type { Friendship, User } from '@/types';
import { useNotificationStore } from '@/stores/notificationStore';
import { Users, UserPlus, MessageCircle, Check, X, Loader2 } from 'lucide-react';

export function Friends() {
  const { openConversation } = useChatStore();
  const { clearFriendBadge } = useNotificationStore();
  const [friends, setFriends] = useState<Friendship[]>([]);
  const [pendingRequests, setPendingRequests] = useState<Friendship[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    clearFriendBadge();
    loadData();
  }, [clearFriendBadge]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [friendsRes, pendingRes] = await Promise.all([
        api.getFriends(),
        api.getPendingRequests(),
      ]);
      setFriends(friendsRes.friends);
      setPendingRequests(pendingRes.requests);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAccept = async (friendshipId: string, requesterId: string) => {
    await api.respondToFriendRequest(friendshipId, true);
    socketClient.emitFriendAccepted(requesterId);
    loadData();
  };

  const handleReject = async (friendshipId: string) => {
    await api.respondToFriendRequest(friendshipId, false);
    loadData();
  };

  const handleMessage = async (userId: string) => {
    await openConversation([userId]);
    window.location.href = '/messages';
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-beat-purple" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Friends</h1>

      <Tabs defaultValue="friends">
        <TabsList className="mb-6">
          <TabsTrigger value="friends">
            <Users className="w-4 h-4 mr-2" />
            Friends ({friends.length})
          </TabsTrigger>
          <TabsTrigger value="requests">
            <UserPlus className="w-4 h-4 mr-2" />
            Requests ({pendingRequests.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="friends">
          {friends.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">No friends yet</h3>
              <p className="text-muted-foreground">
                Connect with other producers to grow your network
              </p>
              <Link to="/discover">
                <Button className="mt-4">Discover Producers</Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {friends.map((friendship) => {
                const friend = friendship.friend as User;
                return (
                  <FriendCard
                    key={friendship.id}
                    user={friend}
                    onMessage={() => handleMessage(friend.id)}
                  />
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="requests">
          {pendingRequests.length === 0 ? (
            <div className="text-center py-12">
              <UserPlus className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">No pending requests</h3>
              <p className="text-muted-foreground">
                Friend requests from other producers will appear here
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingRequests.map((request) => (
                <RequestCard
                  key={request.id}
                  request={request}
                  onAccept={() => handleAccept(request.id, request.requester_id)}
                  onReject={() => handleReject(request.id)}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

interface FriendCardProps {
  user: User;
  onMessage: () => void;
}

function FriendCard({ user, onMessage }: FriendCardProps) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          <Link to={`/profile/${user.id}`}>
            <div className="relative">
              <Avatar className="w-14 h-14">
                <AvatarImage src={user.avatar_url || undefined} />
                <AvatarFallback>
                  {getInitials(user.display_name || user.username)}
                </AvatarFallback>
              </Avatar>
              {user.is_online && (
                <span className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 border-2 border-background rounded-full" />
              )}
            </div>
          </Link>

          <div className="flex-1 min-w-0">
            <Link to={`/profile/${user.id}`} className="hover:underline">
              <p className="font-semibold truncate">
                {user.display_name || user.username}
              </p>
            </Link>
            <p className="text-sm text-muted-foreground truncate">@{user.username}</p>
            {user.producer_type && (
              <p className="text-sm text-beat-purple">{user.producer_type}</p>
            )}
          </div>

          <Button onClick={onMessage}>
            <MessageCircle className="w-4 h-4 mr-2" />
            Message
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

interface RequestCardProps {
  request: Friendship;
  onAccept: () => void;
  onReject: () => void;
}

function RequestCard({ request, onAccept, onReject }: RequestCardProps) {
  const requester = request.requester as User;

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          <Link to={`/profile/${requester.id}`}>
            <Avatar className="w-14 h-14">
              <AvatarImage src={requester.avatar_url || undefined} />
              <AvatarFallback>
                {getInitials(requester.display_name || requester.username)}
              </AvatarFallback>
            </Avatar>
          </Link>

          <div className="flex-1 min-w-0">
            <Link to={`/profile/${requester.id}`} className="hover:underline">
              <p className="font-semibold truncate">
                {requester.display_name || requester.username}
              </p>
            </Link>
            <p className="text-sm text-muted-foreground truncate">
              @{requester.username}
            </p>
            {requester.producer_type && (
              <p className="text-sm text-beat-purple">{requester.producer_type}</p>
            )}
          </div>

          <div className="flex gap-2">
            <Button onClick={onAccept} size="sm">
              <Check className="w-4 h-4 mr-1" />
              Accept
            </Button>
            <Button onClick={onReject} variant="outline" size="sm">
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
