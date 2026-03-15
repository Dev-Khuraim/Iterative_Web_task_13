import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { api } from '@/lib/api';
import { socketClient } from '@/lib/socket';
import { useAuthStore } from '@/stores/authStore';
import { useWebRTC } from '@/hooks/useWebRTC';
import { getInitials, cn } from '@/lib/utils';
import type { VoiceRoom } from '@/types';
import { Mic, MicOff, Phone, PhoneOff, Plus, Users, Loader2 } from 'lucide-react';

export function VoiceRooms() {
  const { user } = useAuthStore();
  const [rooms, setRooms] = useState<VoiceRoom[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentRoom, setCurrentRoom] = useState<VoiceRoom | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    genre: '',
    description: '',
    max_participants: 10,
  });
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  const handleSpeakingChange = useCallback(
    (isSpeaking: boolean) => {
      if (currentRoom) {
        socketClient.setSpeaking(currentRoom.id, isSpeaking);
        setCurrentRoom((prev) =>
          prev
            ? {
                ...prev,
                participants: (prev.participants || []).map((p) =>
                  p.user_id === user?.id ? { ...p, is_speaking: isSpeaking } : p
                ),
              }
            : prev
        );
      }
    },
    [currentRoom, user?.id]
  );

  const { start: startWebRTC, stop: stopWebRTC, connectToPeer, disconnectFromPeer } = useWebRTC({
    roomId: currentRoom?.id ?? null,
    isMuted,
    onSpeakingChange: handleSpeakingChange,
  });

  useEffect(() => {
    loadRooms();
  }, []);

  // Listen for voice events while in a room
  useEffect(() => {
    if (!currentRoom) return;

    const handleVoiceJoined = async (data: unknown) => {
      const { roomId, userId } = data as { roomId: string; userId: string };
      if (roomId !== currentRoom.id) return;
      // Refresh participant list for display, then send them an offer
      api.getVoiceRoom(currentRoom.id).then(({ room }) => setCurrentRoom(room));
      await connectToPeer(userId);
    };

    const handleVoiceLeft = (data: unknown) => {
      const { roomId, userId } = data as { roomId: string; userId: string };
      if (roomId !== currentRoom.id) return;
      setCurrentRoom((prev) =>
        prev
          ? { ...prev, participants: (prev.participants || []).filter((p) => p.user_id !== userId) }
          : prev
      );
      disconnectFromPeer(userId);
    };

    const handleVoiceMuted = (data: unknown) => {
      const { roomId, userId, isMuted: muted } = data as { roomId: string; userId: string; isMuted: boolean };
      if (roomId !== currentRoom.id) return;
      setCurrentRoom((prev) =>
        prev
          ? {
              ...prev,
              participants: (prev.participants || []).map((p) =>
                p.user_id === userId ? { ...p, is_muted: muted } : p
              ),
            }
          : prev
      );
    };

    const handleVoiceSpeaking = (data: unknown) => {
      const { roomId, userId, isSpeaking } = data as { roomId: string; userId: string; isSpeaking: boolean };
      if (roomId !== currentRoom.id) return;
      setCurrentRoom((prev) =>
        prev
          ? {
              ...prev,
              participants: (prev.participants || []).map((p) =>
                p.user_id === userId ? { ...p, is_speaking: isSpeaking } : p
              ),
            }
          : prev
      );
    };

    const u1 = socketClient.on('voice:joined', handleVoiceJoined as (...args: unknown[]) => void);
    const u2 = socketClient.on('voice:left', handleVoiceLeft as (...args: unknown[]) => void);
    const u3 = socketClient.on('voice:muted', handleVoiceMuted as (...args: unknown[]) => void);
    const u4 = socketClient.on('voice:speaking', handleVoiceSpeaking as (...args: unknown[]) => void);

    return () => { u1?.(); u2?.(); u3?.(); u4?.(); };
  }, [currentRoom?.id, connectToPeer, disconnectFromPeer]);

  const loadRooms = async () => {
    setIsLoading(true);
    try {
      const { rooms } = await api.getVoiceRooms();
      setRooms(rooms);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { room } = await api.createVoiceRoom({
        name: createForm.name,
        genre: createForm.genre || undefined,
        description: createForm.description || undefined,
        max_participants: createForm.max_participants,
      });
      // Acquire mic BEFORE joining socket room so existing participants have our stream
      await startWebRTC();
      const { room: fullRoom } = await api.getVoiceRoom(room.id);
      setCurrentRoom(fullRoom);
      setRooms([room, ...rooms]);
      setIsCreateDialogOpen(false);
      setCreateForm({ name: '', genre: '', description: '', max_participants: 10 });
      socketClient.joinVoiceRoom(room.id);
    } catch (error) {
      console.error('Failed to create room:', error);
    }
  };

  const handleJoinRoom = async (room: VoiceRoom) => {
    try {
      await api.joinVoiceRoom(room.id);
      // Acquire mic BEFORE joining socket room so existing participants can receive our audio
      await startWebRTC();
      const { room: fullRoom } = await api.getVoiceRoom(room.id);
      setCurrentRoom(fullRoom);
      socketClient.joinVoiceRoom(room.id);
    } catch (error) {
      console.error('Failed to join room:', error);
    }
  };

  const handleLeaveRoom = async () => {
    if (!currentRoom) return;
    try {
      stopWebRTC();
      socketClient.setSpeaking(currentRoom.id, false);
      await api.leaveVoiceRoom(currentRoom.id);
      socketClient.leaveVoiceRoom(currentRoom.id);
      setCurrentRoom(null);
      setIsMuted(false);
      loadRooms();
    } catch (error) {
      console.error('Failed to leave room:', error);
    }
  };

  const toggleMute = () => {
    if (!currentRoom) return;
    const next = !isMuted;
    setIsMuted(next);
    socketClient.toggleMute(currentRoom.id, next);
    if (next) {
      socketClient.setSpeaking(currentRoom.id, false);
      setCurrentRoom((prev) =>
        prev
          ? {
              ...prev,
              participants: (prev.participants || []).map((p) =>
                p.user_id === user?.id ? { ...p, is_speaking: false } : p
              ),
            }
          : prev
      );
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-beat-purple" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Voice Rooms</h1>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Create Room
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Voice Room</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateRoom} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Room Name</label>
                <Input
                  placeholder="Beat Session"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Genre (Optional)</label>
                <Input
                  placeholder="Hip-Hop, EDM, etc."
                  value={createForm.genre}
                  onChange={(e) => setCreateForm({ ...createForm, genre: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Description (Optional)</label>
                <Input
                  placeholder="What's this room about?"
                  value={createForm.description}
                  onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Max Participants</label>
                <Input
                  type="number"
                  min={2}
                  max={50}
                  value={createForm.max_participants}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, max_participants: parseInt(e.target.value) })
                  }
                />
              </div>
              <Button type="submit" className="w-full">
                Create Room
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Current Room */}
      {currentRoom && (
        <Card className="mb-6 border-beat-purple">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span>{currentRoom.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant={isMuted ? 'destructive' : 'outline'}
                  size="icon"
                  onClick={toggleMute}
                >
                  {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                </Button>
                <Button variant="destructive" size="icon" onClick={handleLeaveRoom}>
                  <PhoneOff className="w-5 h-5" />
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {currentRoom.description && (
              <p className="text-muted-foreground mb-4">{currentRoom.description}</p>
            )}
            <div className="grid grid-cols-4 gap-4">
              {currentRoom.participants?.map((participant) => (
                <div key={participant.id} className="flex flex-col items-center gap-2">
                  <div className="relative">
                    <Avatar
                      className={cn(
                        'w-16 h-16',
                        participant.is_speaking && 'ring-4 ring-green-500'
                      )}
                    >
                      <AvatarImage src={participant.user?.avatar_url || undefined} />
                      <AvatarFallback>
                        {getInitials(participant.user?.display_name || null)}
                      </AvatarFallback>
                    </Avatar>
                    {participant.is_muted && (
                      <span className="absolute -bottom-1 -right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
                        <MicOff className="w-3 h-3 text-white" />
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-medium truncate w-full text-center">
                    {participant.user?.display_name || participant.user?.username}
                    {participant.user_id === currentRoom.host_id && ' (Host)'}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Room List */}
      {rooms.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-beat-purple to-beat-pink flex items-center justify-center">
            <Mic className="w-10 h-10 text-white" />
          </div>
          <h3 className="text-xl font-semibold mb-2">No active voice rooms</h3>
          <p className="text-muted-foreground mb-4">
            Create a room to start talking with other producers
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {rooms
            .filter((room) => room.id !== currentRoom?.id)
            .map((room) => (
              <Card
                key={room.id}
                className="cursor-pointer hover:border-beat-purple/50 transition-colors"
                onClick={() => handleJoinRoom(room)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold">{room.name}</h3>
                      {room.genre && (
                        <span className="text-sm text-beat-purple">{room.genre}</span>
                      )}
                      {room.description && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          {room.description}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Users className="w-4 h-4" />
                      {room.participant_count}/{room.max_participants}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mt-4">
                    <Avatar className="w-8 h-8">
                      <AvatarImage src={room.host?.avatar_url || undefined} />
                      <AvatarFallback>
                        {getInitials(room.host?.display_name || null)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm">
                      Hosted by {room.host?.display_name || room.host?.username}
                    </span>
                  </div>

                  <Button className="w-full mt-4" variant="secondary">
                    <Phone className="w-4 h-4 mr-2" />
                    Join Room
                  </Button>
                </CardContent>
              </Card>
            ))}
        </div>
      )}
    </div>
  );
}
