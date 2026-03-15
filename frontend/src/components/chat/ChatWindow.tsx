import { useState, useRef, useEffect, useCallback } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useChatStore } from '@/stores/chatStore';
import { useAuthStore } from '@/stores/authStore';
import { socketClient } from '@/lib/socket';
import { useWebRTC } from '@/hooks/useWebRTC';
import { cn, formatTimeAgo, getInitials } from '@/lib/utils';
import type { Message, User } from '@/types';
import { Send, ArrowLeft, Phone, PhoneOff, Mic, MicOff, MoreVertical, Users } from 'lucide-react';

interface VoiceParticipantState {
  userId: string;
  user?: User;
  isMuted: boolean;
  isSpeaking: boolean;
}

export function ChatWindow() {
  const { user } = useAuthStore();
  const {
    currentConversation,
    messages,
    typingUsers,
    fetchMessages,
    sendMessage,
    markAsRead,
    selectConversation,
  } = useChatStore();

  const [messageText, setMessageText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();

  // Group voice state
  const [isInCall, setIsInCall] = useState(false);
  const [voiceParticipants, setVoiceParticipants] = useState<VoiceParticipantState[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isVoiceLoading, setIsVoiceLoading] = useState(false);
  const convIdForVoiceRef = useRef<string | null>(null);

  const handleSpeakingChange = useCallback((isSpeaking: boolean) => {
    const convId = convIdForVoiceRef.current;
    if (!convId) return;
    socketClient.setGroupVoiceSpeaking(convId, isSpeaking);
    setVoiceParticipants((prev) =>
      prev.map((p) => (p.userId === user?.id ? { ...p, isSpeaking } : p))
    );
  }, [user?.id]);

  const { start: startWebRTC, stop: stopWebRTC, connectToPeer, disconnectFromPeer } = useWebRTC({
    roomId: isInCall ? currentConversation?.id ?? null : null,
    isMuted,
    onSpeakingChange: handleSpeakingChange,
  });

  const conversationMessages = currentConversation
    ? messages.get(currentConversation.id) || []
    : [];

  const otherParticipants = currentConversation?.participants?.filter((p) => p.id !== user?.id);

  const typingInConversation = typingUsers.filter(
    (t) => t.conversationId === currentConversation?.id && t.userId !== user?.id
  );

  const resolveUser = useCallback((userId: string): User | undefined => {
    if (userId === user?.id) return user as User;
    return currentConversation?.participants?.find((p) => p.id === userId);
  }, [user, currentConversation]);

  // Fetch messages when conversation changes; end any active call
  useEffect(() => {
    if (currentConversation) {
      fetchMessages(currentConversation.id);
      markAsRead(currentConversation.id);
    }
    // End voice call if we switch conversations
    if (isInCall && convIdForVoiceRef.current && convIdForVoiceRef.current !== currentConversation?.id) {
      stopWebRTC();
      socketClient.leaveGroupVoice(convIdForVoiceRef.current);
      convIdForVoiceRef.current = null;
      setIsInCall(false);
      setVoiceParticipants([]);
      setIsMuted(false);
    }
  }, [currentConversation?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Group voice socket events
  useEffect(() => {
    if (!isInCall || !currentConversation) return;
    const convId = currentConversation.id;

    const handleParticipants = async (data: unknown) => {
      const { conversationId, participants } = data as { conversationId: string; participants: string[] };
      if (conversationId !== convId) return;
      for (const uid of participants) {
        setVoiceParticipants((prev) =>
          prev.find((p) => p.userId === uid)
            ? prev
            : [...prev, { userId: uid, user: resolveUser(uid), isMuted: false, isSpeaking: false }]
        );
        await connectToPeer(uid);
      }
    };

    const handleJoined = async (data: unknown) => {
      const { conversationId, userId } = data as { conversationId: string; userId: string };
      if (conversationId !== convId) return;
      setVoiceParticipants((prev) =>
        prev.find((p) => p.userId === userId)
          ? prev
          : [...prev, { userId, user: resolveUser(userId), isMuted: false, isSpeaking: false }]
      );
      await connectToPeer(userId);
    };

    const handleLeft = (data: unknown) => {
      const { conversationId, userId } = data as { conversationId: string; userId: string };
      if (conversationId !== convId) return;
      setVoiceParticipants((prev) => prev.filter((p) => p.userId !== userId));
      disconnectFromPeer(userId);
    };

    const handleMuted = (data: unknown) => {
      const { conversationId, userId, isMuted: muted } = data as {
        conversationId: string; userId: string; isMuted: boolean;
      };
      if (conversationId !== convId) return;
      setVoiceParticipants((prev) =>
        prev.map((p) => (p.userId === userId ? { ...p, isMuted: muted } : p))
      );
    };

    const handleSpeaking = (data: unknown) => {
      const { conversationId, userId, isSpeaking } = data as {
        conversationId: string; userId: string; isSpeaking: boolean;
      };
      if (conversationId !== convId) return;
      setVoiceParticipants((prev) =>
        prev.map((p) => (p.userId === userId ? { ...p, isSpeaking } : p))
      );
    };

    const u1 = socketClient.on('group-voice:participants', handleParticipants as (...args: unknown[]) => void);
    const u2 = socketClient.on('group-voice:joined', handleJoined as (...args: unknown[]) => void);
    const u3 = socketClient.on('group-voice:left', handleLeft as (...args: unknown[]) => void);
    const u4 = socketClient.on('group-voice:muted', handleMuted as (...args: unknown[]) => void);
    const u5 = socketClient.on('group-voice:speaking', handleSpeaking as (...args: unknown[]) => void);

    return () => { u1?.(); u2?.(); u3?.(); u4?.(); u5?.(); };
  }, [isInCall, currentConversation?.id, connectToPeer, disconnectFromPeer, resolveUser]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [conversationMessages]);

  const handleTyping = () => {
    if (!currentConversation) return;
    socketClient.startTyping(currentConversation.id);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socketClient.stopTyping(currentConversation.id);
    }, 2000);
  };

  const handleSendMessage = async () => {
    if (!messageText.trim() || !currentConversation || isSending) return;
    setIsSending(true);
    try {
      await sendMessage(currentConversation.id, messageText.trim());
      setMessageText('');
      socketClient.stopTyping(currentConversation.id);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleBack = () => {
    if (currentConversation) socketClient.leaveConversation(currentConversation.id);
    selectConversation(null as any);
  };

  const handleStartCall = async () => {
    if (!currentConversation || isInCall) return;
    setIsVoiceLoading(true);
    try {
      const ok = await startWebRTC();
      if (!ok) return;
      convIdForVoiceRef.current = currentConversation.id;
      setIsInCall(true);
      setVoiceParticipants([{
        userId: user!.id,
        user: user as User,
        isMuted: false,
        isSpeaking: false,
      }]);
      socketClient.joinGroupVoice(currentConversation.id);
    } finally {
      setIsVoiceLoading(false);
    }
  };

  const handleEndCall = () => {
    if (!isInCall || !convIdForVoiceRef.current) return;
    stopWebRTC();
    socketClient.leaveGroupVoice(convIdForVoiceRef.current);
    convIdForVoiceRef.current = null;
    setIsInCall(false);
    setVoiceParticipants([]);
    setIsMuted(false);
  };

  const toggleMute = () => {
    const convId = convIdForVoiceRef.current;
    if (!convId) return;
    const next = !isMuted;
    setIsMuted(next);
    socketClient.setGroupVoiceMute(convId, next);
    if (next) {
      socketClient.setGroupVoiceSpeaking(convId, false);
      setVoiceParticipants((prev) =>
        prev.map((p) => (p.userId === user?.id ? { ...p, isSpeaking: false } : p))
      );
    }
    setVoiceParticipants((prev) =>
      prev.map((p) => (p.userId === user?.id ? { ...p, isMuted: next } : p))
    );
  };

  if (!currentConversation) {
    return (
      <div className="flex-1 flex items-center justify-center bg-vinyl-dark">
        <div className="text-center">
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-beat-purple to-beat-pink flex items-center justify-center">
            <Send className="w-10 h-10 text-white" />
          </div>
          <h3 className="text-xl font-semibold mb-2">Your Messages</h3>
          <p className="text-muted-foreground">Select a conversation to start chatting</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-background">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={handleBack} className="md:hidden">
          <ArrowLeft className="w-5 h-5" />
        </Button>

        <div className="flex items-center gap-3 flex-1">
          {currentConversation.is_group ? (
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-beat-purple to-beat-pink flex items-center justify-center flex-shrink-0">
              <Users className="w-5 h-5 text-white" />
            </div>
          ) : (
            <Avatar>
              <AvatarImage src={otherParticipants?.[0]?.avatar_url || undefined} />
              <AvatarFallback>{getInitials(otherParticipants?.[0]?.display_name || null)}</AvatarFallback>
            </Avatar>
          )}
          <div>
            <p className="font-semibold">
              {currentConversation.is_group
                ? currentConversation.name
                : otherParticipants?.[0]?.display_name || otherParticipants?.[0]?.username}
            </p>
            <p className="text-sm text-muted-foreground">
              {currentConversation.is_group
                ? `${(otherParticipants?.length || 0) + 1} members`
                : otherParticipants?.[0]?.is_online
                  ? <span className="text-green-500">Online</span>
                  : 'Offline'}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          {isInCall ? (
            <>
              <Button
                variant={isMuted ? 'destructive' : 'outline'}
                size="icon"
                onClick={toggleMute}
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </Button>
              <Button variant="destructive" size="icon" onClick={handleEndCall} title="End call">
                <PhoneOff className="w-5 h-5" />
              </Button>
            </>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleStartCall}
              disabled={isVoiceLoading}
              title="Start voice call"
            >
              <Phone className={cn('w-5 h-5', isVoiceLoading && 'animate-pulse')} />
            </Button>
          )}
          <Button variant="ghost" size="icon">
            <MoreVertical className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Active Voice Panel */}
      {isInCall && (
        <div className="px-4 py-3 border-b border-border bg-beat-purple/5 flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 text-sm font-medium">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span>Voice call</span>
          </div>
          <div className="flex gap-3 flex-wrap">
            {voiceParticipants.map((p) => (
              <VoiceChip key={p.userId} participant={p} currentUserId={user?.id} />
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="space-y-4">
          {conversationMessages.map((message) => (
            <MessageBubble key={message.id} message={message} isOwn={message.sender_id === user?.id} />
          ))}

          {typingInConversation.length > 0 && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-beat-purple rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-beat-purple rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-beat-purple rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <span className="text-sm">typing...</span>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-4 border-t border-border">
        <div className="flex gap-2">
          <Input
            value={messageText}
            onChange={(e) => { setMessageText(e.target.value); handleTyping(); }}
            onKeyPress={handleKeyPress}
            placeholder="Type a message..."
            className="flex-1"
          />
          <Button onClick={handleSendMessage} disabled={!messageText.trim() || isSending}>
            <Send className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

interface VoiceChipProps {
  participant: VoiceParticipantState;
  currentUserId?: string;
}

function VoiceChip({ participant, currentUserId }: VoiceChipProps) {
  const isMe = participant.userId === currentUserId;
  return (
    <div className="flex items-center gap-1.5">
      <Avatar className={cn('w-7 h-7', participant.isSpeaking && 'ring-2 ring-green-500')}>
        <AvatarImage src={participant.user?.avatar_url || undefined} />
        <AvatarFallback className="text-[10px]">
          {getInitials(participant.user?.display_name || null)}
        </AvatarFallback>
      </Avatar>
      <span className="text-xs">
        {isMe ? 'You' : participant.user?.display_name || participant.user?.username}
      </span>
      {participant.isMuted && <MicOff className="w-3 h-3 text-red-500" />}
    </div>
  );
}

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
}

function MessageBubble({ message, isOwn }: MessageBubbleProps) {
  return (
    <div className={cn('flex gap-2', isOwn && 'flex-row-reverse')}>
      {!isOwn && (
        <Avatar className="w-8 h-8">
          <AvatarImage src={message.sender?.avatar_url || undefined} />
          <AvatarFallback>{getInitials(message.sender?.display_name || null)}</AvatarFallback>
        </Avatar>
      )}
      <div className={cn(
        'max-w-[70%] rounded-2xl px-4 py-2',
        isOwn ? 'bg-gradient-to-r from-beat-purple to-beat-pink text-white' : 'bg-secondary'
      )}>
        <p className="whitespace-pre-wrap break-words">{message.content}</p>
        <p className={cn('text-xs mt-1', isOwn ? 'text-white/70' : 'text-muted-foreground')}>
          {formatTimeAgo(message.created_at)}
        </p>
      </div>
    </div>
  );
}
