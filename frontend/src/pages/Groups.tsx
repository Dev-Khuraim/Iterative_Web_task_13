import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CreateGroupDialog } from '@/components/chat/CreateGroupDialog';
import { useChatStore } from '@/stores/chatStore';
import { useAuthStore } from '@/stores/authStore';
import { formatTimeAgo } from '@/lib/utils';
import type { Conversation } from '@/types';
import { Users, Plus, MessageCircle, Loader2 } from 'lucide-react';

export function Groups() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { conversations, fetchConversations, selectConversation } = useChatStore();
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      await fetchConversations();
      setIsLoading(false);
    };
    load();
  }, [fetchConversations]);

  const groupConversations = conversations.filter((c) => c.is_group);

  const handleOpenChat = (conversation: Conversation) => {
    selectConversation(conversation);
    navigate('/messages');
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
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Groups</h1>
        <Button onClick={() => setCreateGroupOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Create Group
        </Button>
      </div>

      <CreateGroupDialog open={createGroupOpen} onOpenChange={setCreateGroupOpen} />

      {groupConversations.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-beat-purple to-beat-pink flex items-center justify-center">
            <Users className="w-10 h-10 text-white" />
          </div>
          <h3 className="text-xl font-semibold mb-2">No groups yet</h3>
          <p className="text-muted-foreground mb-4">
            Create a group to start communicating with multiple friends
          </p>
          <Button onClick={() => setCreateGroupOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Create Your First Group
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {groupConversations.map((conversation) => (
            <Card
              key={conversation.id}
              className="hover:border-beat-purple/50 transition-colors"
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-beat-purple to-beat-pink flex items-center justify-center flex-shrink-0">
                    <Users className="w-7 h-7 text-white" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{conversation.name || 'Unnamed Group'}</p>
                    <p className="text-sm text-muted-foreground">
                      {conversation.participants
                        ? `${conversation.participants.length + 1} members`
                        : 'Group'}
                    </p>
                    {conversation.last_message && (
                      <p className="text-sm text-muted-foreground truncate mt-1">
                        {conversation.last_message.sender_id === user?.id ? 'You: ' : ''}
                        {conversation.last_message.content}
                        {' · '}
                        {formatTimeAgo(conversation.last_message.created_at)}
                      </p>
                    )}
                  </div>

                  <Button size="sm" onClick={() => handleOpenChat(conversation)}>
                    <MessageCircle className="w-4 h-4 mr-1" />
                    Chat
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
