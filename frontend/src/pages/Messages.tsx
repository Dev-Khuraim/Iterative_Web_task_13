import { useEffect } from 'react';
import { ConversationList } from '@/components/chat/ConversationList';
import { ChatWindow } from '@/components/chat/ChatWindow';
import { useNotificationStore } from '@/stores/notificationStore';

export function Messages() {
  const { clearMessageBadge } = useNotificationStore();

  useEffect(() => {
    clearMessageBadge();
  }, [clearMessageBadge]);

  return (
    <div className="h-screen flex">
      <ConversationList />
      <ChatWindow />
    </div>
  );
}
