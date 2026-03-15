import { useEffect, useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { CreateGroupDialog } from '@/components/chat/CreateGroupDialog';
import { useChatStore } from '@/stores/chatStore';
import { useAuthStore } from '@/stores/authStore';
import { cn, formatTimeAgo, getInitials } from '@/lib/utils';
import type { Conversation } from '@/types';
import { Users } from 'lucide-react';

export function ConversationList() {
  const { user } = useAuthStore();
  const { conversations, currentConversation, fetchConversations, selectConversation } = useChatStore();
  const [createGroupOpen, setCreateGroupOpen] = useState(false);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  return (
    <div className="w-80 border-r border-border flex flex-col bg-card">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <h2 className="text-xl font-bold">Messages</h2>
        <Button variant="outline" size="sm" onClick={() => setCreateGroupOpen(true)}>
          <Users className="w-4 h-4 mr-1" />
          New Group
        </Button>
      </div>

      <CreateGroupDialog open={createGroupOpen} onOpenChange={setCreateGroupOpen} />

      <ScrollArea className="flex-1">
        {conversations.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground">
            No conversations yet
          </div>
        ) : (
          <div className="p-2">
            {conversations.map((conversation) => (
              <ConversationItem
                key={conversation.id}
                conversation={conversation}
                isActive={currentConversation?.id === conversation.id}
                currentUserId={user?.id}
                onSelect={() => selectConversation(conversation)}
              />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

interface ConversationItemProps {
  conversation: Conversation;
  isActive: boolean;
  currentUserId?: string;
  onSelect: () => void;
}

function ConversationItem({ conversation, isActive, currentUserId, onSelect }: ConversationItemProps) {
  const otherParticipants = conversation.participants?.filter((p) => p.id !== currentUserId);
  const displayName = conversation.is_group
    ? conversation.name
    : otherParticipants?.[0]?.display_name || otherParticipants?.[0]?.username;
  const avatarUrl = conversation.is_group ? undefined : otherParticipants?.[0]?.avatar_url;
  const isOnline = !conversation.is_group && otherParticipants?.[0]?.is_online;

  return (
    <button
      onClick={onSelect}
      className={cn(
        'w-full p-3 rounded-lg flex items-center gap-3 transition-colors text-left',
        isActive
          ? 'bg-gradient-to-r from-beat-purple/20 to-beat-pink/20 border border-beat-purple/30'
          : 'hover:bg-secondary'
      )}
    >
      <div className="relative">
        {conversation.is_group ? (
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-beat-purple to-beat-pink flex items-center justify-center">
            <Users className="w-5 h-5 text-white" />
          </div>
        ) : (
          <>
            <Avatar>
              <AvatarImage src={avatarUrl || undefined} />
              <AvatarFallback>{getInitials(displayName || null)}</AvatarFallback>
            </Avatar>
            {isOnline && (
              <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-background rounded-full" />
            )}
          </>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <p className="font-medium truncate">{displayName}</p>
          {conversation.last_message && (
            <span className="text-xs text-muted-foreground">
              {formatTimeAgo(conversation.last_message.created_at)}
            </span>
          )}
        </div>
        {conversation.last_message && (
          <p className="text-sm text-muted-foreground truncate">
            {conversation.last_message.sender_id === currentUserId && 'You: '}
            {conversation.last_message.content}
          </p>
        )}
      </div>

      {typeof conversation.unread_count === 'number' && conversation.unread_count > 0 && (
        <span className="flex-shrink-0 w-5 h-5 bg-beat-pink text-white text-xs rounded-full flex items-center justify-center">
          {conversation.unread_count > 9 ? '9+' : conversation.unread_count}
        </span>
      )}
    </button>
  );
}
