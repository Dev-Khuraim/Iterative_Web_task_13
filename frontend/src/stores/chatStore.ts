import { create } from 'zustand';
import type { Conversation, Message, User } from '../types';
import { api } from '../lib/api';
import { socketClient } from '../lib/socket';

interface TypingUser {
  conversationId: string;
  userId: string;
}

interface ChatState {
  conversations: Conversation[];
  currentConversation: Conversation | null;
  messages: Map<string, Message[]>;
  typingUsers: TypingUser[];
  isLoading: boolean;
  fetchConversations: () => Promise<void>;
  openConversation: (participantIds: string[], isGroup?: boolean, name?: string) => Promise<Conversation>;
  selectConversation: (conversation: Conversation) => void;
  fetchMessages: (conversationId: string) => Promise<void>;
  sendMessage: (conversationId: string, content: string, messageType?: Message['message_type']) => Promise<void>;
  addMessage: (message: Message) => void;
  setTyping: (conversationId: string, userId: string, isTyping: boolean) => void;
  markAsRead: (conversationId: string) => Promise<void>;
  updateConversationLastMessage: (conversationId: string, message: Message) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  currentConversation: null,
  messages: new Map(),
  typingUsers: [],
  isLoading: false,

  fetchConversations: async () => {
    set({ isLoading: true });
    try {
      const { conversations } = await api.getConversations();
      set({ conversations });
    } finally {
      set({ isLoading: false });
    }
  },

  openConversation: async (participantIds, isGroup = false, name) => {
    const { conversation } = await api.getOrCreateConversation({
      participant_ids: participantIds,
      is_group: isGroup,
      name,
    });

    // Add to conversations list if not exists
    const exists = get().conversations.some((c) => c.id === conversation.id);
    if (!exists) {
      set({ conversations: [conversation, ...get().conversations] });
    }

    // Join socket room
    socketClient.joinConversation(conversation.id);

    set({ currentConversation: conversation });
    return conversation;
  },

  selectConversation: (conversation) => {
    // Leave previous conversation room
    if (get().currentConversation) {
      socketClient.leaveConversation(get().currentConversation!.id);
    }

    // Join new conversation room
    socketClient.joinConversation(conversation.id);

    set({ currentConversation: conversation });
  },

  fetchMessages: async (conversationId) => {
    set({ isLoading: true });
    try {
      const { messages } = await api.getMessages(conversationId);
      const currentMessages = get().messages;
      currentMessages.set(conversationId, messages);
      set({ messages: new Map(currentMessages) });
    } finally {
      set({ isLoading: false });
    }
  },

  sendMessage: async (conversationId, content, messageType = 'text') => {
    const { message } = await api.sendMessage(conversationId, {
      content,
      message_type: messageType,
    });

    // Add to local messages
    get().addMessage(message);

    // Emit through socket
    socketClient.sendMessage(conversationId, message);

    // Stop typing indicator
    socketClient.stopTyping(conversationId);
  },

  addMessage: (message) => {
    const currentMessages = get().messages;
    const conversationMessages = currentMessages.get(message.conversation_id) || [];

    // Check if message already exists
    if (!conversationMessages.some((m) => m.id === message.id)) {
      currentMessages.set(message.conversation_id, [...conversationMessages, message]);
      set({ messages: new Map(currentMessages) });

      // Update conversation's last message
      get().updateConversationLastMessage(message.conversation_id, message);
    }
  },

  setTyping: (conversationId, userId, isTyping) => {
    if (isTyping) {
      const exists = get().typingUsers.some(
        (t) => t.conversationId === conversationId && t.userId === userId
      );
      if (!exists) {
        set({
          typingUsers: [...get().typingUsers, { conversationId, userId }],
        });
      }
    } else {
      set({
        typingUsers: get().typingUsers.filter(
          (t) => !(t.conversationId === conversationId && t.userId === userId)
        ),
      });
    }
  },

  markAsRead: async (conversationId) => {
    await api.markAsRead(conversationId);

    // Update local state
    set({
      conversations: get().conversations.map((c) =>
        c.id === conversationId ? { ...c, unread_count: 0 } : c
      ),
    });
  },

  updateConversationLastMessage: (conversationId, message) => {
    set({
      conversations: get().conversations.map((c) =>
        c.id === conversationId
          ? { ...c, last_message: message, updated_at: message.created_at }
          : c
      ).sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()),
    });
  },
}));
