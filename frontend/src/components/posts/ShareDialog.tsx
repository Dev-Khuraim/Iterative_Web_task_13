import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { usePostStore } from '@/stores/postStore';
import { useChatStore } from '@/stores/chatStore';
import { api } from '@/lib/api';
import { getInitials } from '@/lib/utils';
import type { Post, Friendship } from '@/types';
import {
  Send,
  Copy,
  Repeat,
  Users,
  Check,
  Loader2,
  Link as LinkIcon,
} from 'lucide-react';

interface ShareDialogProps {
  post: Post;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ShareTab = 'friends' | 'groups' | 'link' | 'repost';

export function ShareDialog({ post, open, onOpenChange }: ShareDialogProps) {
  const navigate = useNavigate();
  const { sharePost } = usePostStore();
  const { conversations, fetchConversations, openConversation } = useChatStore();

  const [activeTab, setActiveTab] = useState<ShareTab>('friends');
  const [friends, setFriends] = useState<Friendship[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [reposted, setReposted] = useState(false);
  const [sentTo, setSentTo] = useState<Set<string>>(new Set());
  const [repostComment, setRepostComment] = useState('');

  const groupConversations = conversations.filter((c) => c.is_group);

  useEffect(() => {
    if (open) {
      loadFriends();
      fetchConversations();
      setSentTo(new Set());
      setCopied(false);
      setReposted(false);
      setRepostComment('');
    }
  }, [open, fetchConversations]);

  const loadFriends = async () => {
    try {
      const { friends } = await api.getFriends();
      setFriends(friends);
    } catch {
      // Silently handle
    }
  };

  const handleSendToFriend = async (friendId: string) => {
    if (sentTo.has(friendId)) return;
    setIsLoading(true);
    try {
      const conversation = await openConversation([friendId]);
      await api.sendMessage(conversation.id, {
        content: `Check out this track: ${post.title || 'Untitled Track'}`,
        message_type: 'track_share',
        shared_post_id: post.id,
      });
      setSentTo((prev) => new Set(prev).add(friendId));
    } finally {
      setIsLoading(false);
    }
  };

  const handleShareInGroup = async (conversationId: string) => {
    if (sentTo.has(conversationId)) return;
    setIsLoading(true);
    try {
      await api.sendMessage(conversationId, {
        content: `Check out this track: ${post.title || 'Untitled Track'}`,
        message_type: 'track_share',
        shared_post_id: post.id,
      });
      setSentTo((prev) => new Set(prev).add(conversationId));
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyLink = async () => {
    const link = `${window.location.origin}/post/${post.id}`;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRepost = async () => {
    if (reposted) return;
    setIsLoading(true);
    try {
      await sharePost(post.id, repostComment || undefined);
      setReposted(true);
    } finally {
      setIsLoading(false);
    }
  };

  const tabs: { id: ShareTab; label: string; icon: React.ReactNode }[] = [
    { id: 'friends', label: 'Friends', icon: <Send className="w-4 h-4" /> },
    { id: 'groups', label: 'Groups', icon: <Users className="w-4 h-4" /> },
    { id: 'link', label: 'Copy Link', icon: <LinkIcon className="w-4 h-4" /> },
    { id: 'repost', label: 'Repost', icon: <Repeat className="w-4 h-4" /> },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share Track</DialogTitle>
          <DialogDescription>
            Share "{post.title || 'Untitled Track'}" with friends, groups, or repost it.
          </DialogDescription>
        </DialogHeader>

        {/* Tab Navigation */}
        <div className="flex gap-1 p-1 bg-secondary rounded-lg">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.icon}
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="min-h-[200px]">
          {/* Send to Friends */}
          {activeTab === 'friends' && (
            <ScrollArea className="h-[250px]">
              {friends.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Send className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No friends yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {friends.map((friendship) => {
                    const friend = friendship.friend;
                    if (!friend) return null;
                    const isSent = sentTo.has(friend.id);
                    return (
                      <div
                        key={friendship.id}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary transition-colors"
                      >
                        <Avatar className="w-10 h-10">
                          <AvatarImage src={friend.avatar_url || undefined} />
                          <AvatarFallback>
                            {getInitials(friend.display_name || friend.username)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">
                            {friend.display_name || friend.username}
                          </p>
                          <p className="text-sm text-muted-foreground truncate">
                            @{friend.username}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant={isSent ? 'secondary' : 'default'}
                          onClick={() => handleSendToFriend(friend.id)}
                          disabled={isSent || isLoading}
                        >
                          {isSent ? (
                            <>
                              <Check className="w-4 h-4 mr-1" />
                              Sent
                            </>
                          ) : (
                            <>
                              <Send className="w-4 h-4 mr-1" />
                              Send
                            </>
                          )}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          )}

          {/* Share in Groups */}
          {activeTab === 'groups' && (
            <ScrollArea className="h-[250px]">
              {groupConversations.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No groups yet</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={() => {
                      onOpenChange(false);
                      navigate('/messages');
                    }}
                  >
                    Create a Group
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {groupConversations.map((conversation) => {
                    const isSent = sentTo.has(conversation.id);
                    return (
                      <div
                        key={conversation.id}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary transition-colors"
                      >
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-beat-purple to-beat-pink flex items-center justify-center">
                          <Users className="w-5 h-5 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{conversation.name || 'Unnamed Group'}</p>
                          <p className="text-sm text-muted-foreground">
                            {conversation.participants?.length || 0} members
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant={isSent ? 'secondary' : 'default'}
                          onClick={() => handleShareInGroup(conversation.id)}
                          disabled={isSent || isLoading}
                        >
                          {isSent ? (
                            <>
                              <Check className="w-4 h-4 mr-1" />
                              Sent
                            </>
                          ) : (
                            <>
                              <Send className="w-4 h-4 mr-1" />
                              Share
                            </>
                          )}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          )}

          {/* Copy Link */}
          {activeTab === 'link' && (
            <div className="py-8 flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-beat-purple to-beat-pink flex items-center justify-center">
                <LinkIcon className="w-8 h-8 text-white" />
              </div>
              <p className="text-sm text-muted-foreground text-center">
                Copy the link to share this track anywhere
              </p>
              <div className="flex gap-2 w-full">
                <Input
                  readOnly
                  value={`${window.location.origin}/post/${post.id}`}
                  className="flex-1 text-sm"
                />
                <Button onClick={handleCopyLink} variant={copied ? 'secondary' : 'default'}>
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 mr-1" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 mr-1" />
                      Copy
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Repost */}
          {activeTab === 'repost' && (
            <div className="py-4 flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-beat-cyan to-beat-purple flex items-center justify-center">
                  <Repeat className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="font-medium">Repost to your profile</p>
                  <p className="text-sm text-muted-foreground">
                    This track will appear on your profile with a "reposted" tag
                  </p>
                </div>
              </div>
              <Input
                value={repostComment}
                onChange={(e) => setRepostComment(e.target.value)}
                placeholder="Add a comment (optional)"
              />
              <Button
                onClick={handleRepost}
                disabled={reposted || isLoading}
                className="w-full"
                variant={reposted ? 'secondary' : 'default'}
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : reposted ? (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Reposted!
                  </>
                ) : (
                  <>
                    <Repeat className="w-4 h-4 mr-2" />
                    Repost
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
