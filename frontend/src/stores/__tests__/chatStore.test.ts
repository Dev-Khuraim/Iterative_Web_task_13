import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock modules BEFORE importing the store
vi.mock('../../lib/api', () => ({
  api: {
    getConversations: vi.fn(),
    getOrCreateConversation: vi.fn(),
    getMessages: vi.fn(),
    sendMessage: vi.fn(),
    markAsRead: vi.fn(),
  },
}));

vi.mock('../../lib/socket', () => ({
  socketClient: {
    joinConversation: vi.fn(),
    leaveConversation: vi.fn(),
    sendMessage: vi.fn(),
    stopTyping: vi.fn(),
  },
}));

// Now import the store and get access to mocked modules
import { useChatStore } from '../chatStore';
import { api } from '../../lib/api';
import { socketClient } from '../../lib/socket';

const mockApi = api as {
  getConversations: ReturnType<typeof vi.fn>;
  getOrCreateConversation: ReturnType<typeof vi.fn>;
  getMessages: ReturnType<typeof vi.fn>;
  sendMessage: ReturnType<typeof vi.fn>;
  markAsRead: ReturnType<typeof vi.fn>;
};

const mockSocketClient = socketClient as {
  joinConversation: ReturnType<typeof vi.fn>;
  leaveConversation: ReturnType<typeof vi.fn>;
  sendMessage: ReturnType<typeof vi.fn>;
  stopTyping: ReturnType<typeof vi.fn>;
};

const sampleUser = {
  id: 'user-2',
  username: 'otheruser',
  display_name: 'Other User',
  avatar_url: null,
  is_online: true,
};

const sampleConversation = {
  id: 'conv-1',
  is_group: false,
  name: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  participants: [sampleUser],
  last_message: null,
  unread_count: 0,
};

const sampleMessage = {
  id: 'msg-1',
  conversation_id: 'conv-1',
  sender_id: 'user-1',
  content: 'Hello!',
  message_type: 'text' as const,
  created_at: new Date().toISOString(),
  sender: {
    id: 'user-1',
    username: 'testuser',
    display_name: 'Test User',
    avatar_url: null,
  },
};

describe('chatStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset store state
    useChatStore.setState({
      conversations: [],
      currentConversation: null,
      messages: new Map(),
      typingUsers: [],
      isLoading: false,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchConversations', () => {
    it('fetches and sets conversations', async () => {
      mockApi.getConversations.mockResolvedValueOnce({
        conversations: [sampleConversation],
      });

      const { fetchConversations } = useChatStore.getState();
      await fetchConversations();

      const state = useChatStore.getState();
      expect(state.conversations).toEqual([sampleConversation]);
      expect(state.isLoading).toBe(false);
    });

    it('sets isLoading during fetch', async () => {
      let resolvePromise: (value: { conversations: typeof sampleConversation[] }) => void;
      const promise = new Promise<{ conversations: typeof sampleConversation[] }>((resolve) => {
        resolvePromise = resolve;
      });
      mockApi.getConversations.mockReturnValueOnce(promise);

      const { fetchConversations } = useChatStore.getState();
      const fetchPromise = fetchConversations();

      expect(useChatStore.getState().isLoading).toBe(true);

      resolvePromise!({ conversations: [] });
      await fetchPromise;

      expect(useChatStore.getState().isLoading).toBe(false);
    });
  });

  describe('openConversation', () => {
    it('opens new conversation', async () => {
      mockApi.getOrCreateConversation.mockResolvedValueOnce({
        conversation: sampleConversation,
      });

      const { openConversation } = useChatStore.getState();
      const result = await openConversation(['user-2']);

      expect(result).toEqual(sampleConversation);
      const state = useChatStore.getState();
      expect(state.currentConversation).toEqual(sampleConversation);
      expect(state.conversations).toContain(sampleConversation);
      expect(mockSocketClient.joinConversation).toHaveBeenCalledWith('conv-1');
    });

    it('does not duplicate existing conversation', async () => {
      useChatStore.setState({ conversations: [sampleConversation] });
      mockApi.getOrCreateConversation.mockResolvedValueOnce({
        conversation: sampleConversation,
      });

      const { openConversation } = useChatStore.getState();
      await openConversation(['user-2']);

      const state = useChatStore.getState();
      expect(state.conversations).toHaveLength(1);
    });

    it('opens group conversation', async () => {
      const groupConv = { ...sampleConversation, is_group: true, name: 'Test Group' };
      mockApi.getOrCreateConversation.mockResolvedValueOnce({ conversation: groupConv });

      const { openConversation } = useChatStore.getState();
      await openConversation(['user-2', 'user-3'], true, 'Test Group');

      expect(mockApi.getOrCreateConversation).toHaveBeenCalledWith({
        participant_ids: ['user-2', 'user-3'],
        is_group: true,
        name: 'Test Group',
      });
    });
  });

  describe('selectConversation', () => {
    it('selects conversation and joins socket room', () => {
      const { selectConversation } = useChatStore.getState();
      selectConversation(sampleConversation);

      const state = useChatStore.getState();
      expect(state.currentConversation).toEqual(sampleConversation);
      expect(mockSocketClient.joinConversation).toHaveBeenCalledWith('conv-1');
    });

    it('leaves previous conversation room', () => {
      useChatStore.setState({ currentConversation: sampleConversation });

      const newConv = { ...sampleConversation, id: 'conv-2' };
      const { selectConversation } = useChatStore.getState();
      selectConversation(newConv);

      expect(mockSocketClient.leaveConversation).toHaveBeenCalledWith('conv-1');
      expect(mockSocketClient.joinConversation).toHaveBeenCalledWith('conv-2');
    });
  });

  describe('fetchMessages', () => {
    it('fetches and sets messages', async () => {
      mockApi.getMessages.mockResolvedValueOnce({ messages: [sampleMessage] });

      const { fetchMessages } = useChatStore.getState();
      await fetchMessages('conv-1');

      const state = useChatStore.getState();
      expect(state.messages.get('conv-1')).toEqual([sampleMessage]);
    });
  });

  describe('sendMessage', () => {
    it('sends text message', async () => {
      mockApi.sendMessage.mockResolvedValueOnce({ message: sampleMessage });

      const { sendMessage } = useChatStore.getState();
      await sendMessage('conv-1', 'Hello!');

      expect(mockApi.sendMessage).toHaveBeenCalledWith('conv-1', {
        content: 'Hello!',
        message_type: 'text',
      });
      expect(mockSocketClient.sendMessage).toHaveBeenCalledWith('conv-1', sampleMessage);
      expect(mockSocketClient.stopTyping).toHaveBeenCalledWith('conv-1');
    });

    it('sends audio message', async () => {
      const audioMessage = { ...sampleMessage, message_type: 'audio' as const };
      mockApi.sendMessage.mockResolvedValueOnce({ message: audioMessage });

      const { sendMessage } = useChatStore.getState();
      await sendMessage('conv-1', 'audio-url', 'audio');

      expect(mockApi.sendMessage).toHaveBeenCalledWith('conv-1', {
        content: 'audio-url',
        message_type: 'audio',
      });
    });
  });

  describe('addMessage', () => {
    it('adds message to conversation', () => {
      const { addMessage } = useChatStore.getState();
      addMessage(sampleMessage);

      const state = useChatStore.getState();
      expect(state.messages.get('conv-1')).toContain(sampleMessage);
    });

    it('does not add duplicate message', () => {
      useChatStore.setState({
        messages: new Map([['conv-1', [sampleMessage]]]),
      });

      const { addMessage } = useChatStore.getState();
      addMessage(sampleMessage);

      const state = useChatStore.getState();
      expect(state.messages.get('conv-1')).toHaveLength(1);
    });

    it('updates conversation last message', () => {
      useChatStore.setState({ conversations: [sampleConversation] });

      const { addMessage } = useChatStore.getState();
      addMessage(sampleMessage);

      const state = useChatStore.getState();
      expect(state.conversations[0].last_message).toEqual(sampleMessage);
    });
  });

  describe('setTyping', () => {
    it('adds typing user', () => {
      const { setTyping } = useChatStore.getState();
      setTyping('conv-1', 'user-2', true);

      const state = useChatStore.getState();
      expect(state.typingUsers).toContainEqual({
        conversationId: 'conv-1',
        userId: 'user-2',
      });
    });

    it('does not add duplicate typing user', () => {
      useChatStore.setState({
        typingUsers: [{ conversationId: 'conv-1', userId: 'user-2' }],
      });

      const { setTyping } = useChatStore.getState();
      setTyping('conv-1', 'user-2', true);

      const state = useChatStore.getState();
      expect(state.typingUsers).toHaveLength(1);
    });

    it('removes typing user', () => {
      useChatStore.setState({
        typingUsers: [{ conversationId: 'conv-1', userId: 'user-2' }],
      });

      const { setTyping } = useChatStore.getState();
      setTyping('conv-1', 'user-2', false);

      const state = useChatStore.getState();
      expect(state.typingUsers).toHaveLength(0);
    });
  });

  describe('markAsRead', () => {
    it('marks conversation as read', async () => {
      useChatStore.setState({
        conversations: [{ ...sampleConversation, unread_count: 5 }],
      });
      mockApi.markAsRead.mockResolvedValueOnce({ success: true });

      const { markAsRead } = useChatStore.getState();
      await markAsRead('conv-1');

      const state = useChatStore.getState();
      expect(state.conversations[0].unread_count).toBe(0);
    });

    it('does not update unmatched conversations', async () => {
      useChatStore.setState({
        conversations: [
          { ...sampleConversation, id: 'conv-1', unread_count: 5 },
          { ...sampleConversation, id: 'conv-2', unread_count: 3 },
        ],
      });
      mockApi.markAsRead.mockResolvedValueOnce({ success: true });

      const { markAsRead } = useChatStore.getState();
      await markAsRead('conv-1');

      const state = useChatStore.getState();
      expect(state.conversations[0].unread_count).toBe(0);
      expect(state.conversations[1].unread_count).toBe(3); // unchanged
    });
  });

  describe('updateConversationLastMessage', () => {
    it('updates last message and sorts conversations', () => {
      const conv2 = {
        ...sampleConversation,
        id: 'conv-2',
        updated_at: '2024-01-02T00:00:00Z',
      };
      useChatStore.setState({
        conversations: [
          { ...sampleConversation, updated_at: '2024-01-01T00:00:00Z' },
          conv2,
        ],
      });

      const newMessage = { ...sampleMessage, created_at: '2024-01-03T00:00:00Z' };
      const { updateConversationLastMessage } = useChatStore.getState();
      updateConversationLastMessage('conv-1', newMessage);

      const state = useChatStore.getState();
      expect(state.conversations[0].id).toBe('conv-1'); // Now first due to newer message
      expect(state.conversations[0].last_message).toEqual(newMessage);
    });
  });
});
