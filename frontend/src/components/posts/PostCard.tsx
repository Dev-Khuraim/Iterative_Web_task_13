import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Slider } from '@/components/ui/slider';
import { ShareDialog } from '@/components/posts/ShareDialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { usePostStore } from '@/stores/postStore';
import { useAuthStore } from '@/stores/authStore';
import { cn, formatDuration, formatTimeAgo, getInitials, generateWaveformData } from '@/lib/utils';
import type { Post } from '@/types';
import {
  Heart,
  MessageCircle,
  Share2,
  Play,
  Pause,
  Volume2,
  VolumeX,
  MoreHorizontal,
  Music,
  Repeat,
  Pencil,
  Loader2,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface PostCardProps {
  post: Post;
  isRepost?: boolean;
  repostedBy?: string;
}

export function PostCard({ post, isRepost, repostedBy }: PostCardProps) {
  const { user } = useAuthStore();
  const { likePost, unlikePost, deletePost, editPost } = usePostStore();

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(post.audio_duration || 0);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState({ content: post.content || '', title: post.title || '', genre: post.genre || '', tags: (post.tags || []).join(', ') });
  const [isEditing, setIsEditing] = useState(false);
  const [waveformData] = useState(() => post.waveform_data || generateWaveformData(50));

  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleLoadedMetadata = () => setDuration(audio.duration);
    const handleEnded = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
    };
  }, []);

  const togglePlay = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (value: number[]) => {
    if (!audioRef.current || !value[0]) return;
    audioRef.current.currentTime = value[0];
    setCurrentTime(value[0]);
  };

  const handleVolumeChange = (value: number[]) => {
    if (!audioRef.current || !value[0]) return;
    const newVolume = value[0];
    audioRef.current.volume = newVolume;
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
  };

  const toggleMute = () => {
    if (!audioRef.current) return;
    if (isMuted) {
      audioRef.current.volume = volume || 0.8;
      setIsMuted(false);
    } else {
      audioRef.current.volume = 0;
      setIsMuted(true);
    }
  };

  const handleLike = async () => {
    if (post.is_liked) {
      await unlikePost(post.id);
    } else {
      await likePost(post.id);
    }
  };

  const handleShare = () => {
    setShareDialogOpen(true);
  };

  const handleDelete = async () => {
    if (confirm('Are you sure you want to delete this post?')) {
      await deletePost(post.id);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsEditing(true);
    try {
      const tags = editForm.tags.split(',').map((t) => t.trim()).filter(Boolean);
      await editPost(post.id, {
        content: editForm.content || undefined,
        title: editForm.title || undefined,
        genre: editForm.genre || undefined,
        tags: tags.length > 0 ? tags : undefined,
      });
      setEditDialogOpen(false);
    } finally {
      setIsEditing(false);
    }
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <Card className="overflow-hidden hover:border-beat-purple/50 transition-colors">
      <CardContent className="p-0">
        {/* Repost Banner */}
        {isRepost && repostedBy && (
          <div className="px-4 pt-3 pb-1 flex items-center gap-2 text-sm text-muted-foreground">
            <Repeat className="w-4 h-4 text-beat-cyan" />
            <span><span className="font-medium text-beat-cyan">{repostedBy}</span> reposted</span>
          </div>
        )}

        {/* Header */}
        <div className="p-4 flex items-center gap-3">
          <Link to={`/profile/${post.user?.id}`}>
            <Avatar className="w-12 h-12">
              <AvatarImage src={post.user?.avatar_url || undefined} />
              <AvatarFallback>{getInitials(post.user?.display_name || null)}</AvatarFallback>
            </Avatar>
          </Link>
          <div className="flex-1">
            <Link to={`/profile/${post.user?.id}`} className="hover:underline">
              <p className="font-semibold">{post.user?.display_name || post.user?.username}</p>
            </Link>
            <p className="text-sm text-muted-foreground">
              {post.user?.producer_type && <span className="text-beat-purple">{post.user.producer_type}</span>}
              {post.user?.producer_type && ' · '}
              {formatTimeAgo(post.created_at)}
              {post.is_edited && <span className="ml-1 text-xs text-muted-foreground">(edited)</span>}
            </p>
          </div>
          {user?.id === post.user_id && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreHorizontal className="w-5 h-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setEditDialogOpen(true)}>
                  <Pencil className="w-4 h-4 mr-2" />
                  Edit Post
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleDelete} className="text-destructive">
                  Delete Post
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Content */}
        {post.content && (
          <div className="px-4 pb-3">
            <p className="whitespace-pre-wrap">{post.content}</p>
          </div>
        )}

        {/* Audio Player */}
        {post.audio_url && (
          <div className="mx-4 mb-4 p-4 rounded-xl bg-vinyl-gray border border-vinyl-light">
            <audio ref={audioRef} src={post.audio_url} preload="metadata" />

            {/* Track Info */}
            <div className="flex items-center gap-4 mb-4">
              {/* Cover Art / Vinyl */}
              <div className="relative w-20 h-20 flex-shrink-0">
                {post.cover_image_url ? (
                  <img
                    src={post.cover_image_url}
                    alt={post.title || 'Track cover'}
                    className={cn(
                      'w-full h-full rounded-lg object-cover',
                      isPlaying && 'vinyl-spin'
                    )}
                  />
                ) : (
                  <div
                    className={cn(
                      'w-full h-full rounded-full vinyl-record',
                      isPlaying && 'vinyl-spin'
                    )}
                  />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <h3 className="font-semibold truncate">{post.title || 'Untitled Track'}</h3>
                <div className="flex flex-wrap gap-2 mt-1 text-sm text-muted-foreground">
                  {post.genre && (
                    <span className="px-2 py-0.5 rounded-full bg-beat-purple/20 text-beat-purple">
                      {post.genre}
                    </span>
                  )}
                  {post.bpm && <span>{post.bpm} BPM</span>}
                  {post.key_signature && <span>{post.key_signature}</span>}
                </div>
              </div>
            </div>

            {/* Waveform Visualization */}
            <div className="flex items-center gap-[2px] h-12 mb-3">
              {waveformData.map((height, i) => {
                const barProgress = (i / waveformData.length) * 100;
                const isPlayed = barProgress <= progress;
                return (
                  <div
                    key={i}
                    className={cn(
                      'flex-1 rounded-full transition-all duration-150',
                      isPlayed
                        ? 'bg-gradient-to-t from-beat-purple to-beat-pink'
                        : 'bg-vinyl-light'
                    )}
                    style={{ height: `${height * 100}%` }}
                  />
                );
              })}
            </div>

            {/* Progress Bar */}
            <Slider
              value={[currentTime]}
              max={duration || 100}
              step={0.1}
              onValueChange={handleSeek}
              className="mb-3"
            />

            {/* Controls */}
            <div className="flex items-center gap-4">
              <Button
                variant="default"
                size="icon"
                className="w-12 h-12 rounded-full"
                onClick={togglePlay}
              >
                {isPlaying ? (
                  <Pause className="w-6 h-6" />
                ) : (
                  <Play className="w-6 h-6 ml-1" />
                )}
              </Button>

              <div className="flex-1 flex items-center gap-2 text-sm text-muted-foreground">
                <span>{formatDuration(currentTime)}</span>
                <span>/</span>
                <span>{formatDuration(duration)}</span>
              </div>

              {/* Volume */}
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={toggleMute}>
                  {isMuted ? (
                    <VolumeX className="w-5 h-5" />
                  ) : (
                    <Volume2 className="w-5 h-5" />
                  )}
                </Button>
                <Slider
                  value={[isMuted ? 0 : volume]}
                  max={1}
                  step={0.01}
                  onValueChange={handleVolumeChange}
                  className="w-20"
                />
              </div>

              {/* Play count */}
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Music className="w-4 h-4" />
                {post.play_count}
              </div>
            </div>
          </div>
        )}

        {/* Tags */}
        {post.tags && post.tags.length > 0 && (
          <div className="px-4 pb-3 flex flex-wrap gap-2">
            {post.tags.map((tag) => (
              <span
                key={tag}
                className="px-2 py-1 text-sm rounded-full bg-secondary text-secondary-foreground"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="px-4 py-3 border-t border-border flex items-center gap-6">
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              'gap-2',
              post.is_liked && 'text-beat-pink'
            )}
            onClick={handleLike}
          >
            <Heart className={cn('w-5 h-5', post.is_liked && 'fill-current')} />
            {post.likes_count || 0}
          </Button>

          <Link to={`/post/${post.id}`}>
            <Button variant="ghost" size="sm" className="gap-2">
              <MessageCircle className="w-5 h-5" />
              {post.comments_count || 0}
            </Button>
          </Link>

          <Button
            variant="ghost"
            size="sm"
            className={cn('gap-2', post.is_shared && 'text-beat-cyan')}
            onClick={handleShare}
          >
            <Share2 className={cn('w-5 h-5', post.is_shared && 'fill-current')} />
            {post.shares_count || 0}
          </Button>
        </div>

        {/* Share Dialog */}
        <ShareDialog
          post={post}
          open={shareDialogOpen}
          onOpenChange={setShareDialogOpen}
        />

        {/* Edit Post Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Edit Post</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Caption</label>
                <textarea
                  value={editForm.content}
                  onChange={(e) => setEditForm({ ...editForm, content: e.target.value })}
                  placeholder="What's on your mind?"
                  rows={3}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Title</label>
                <Input
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  placeholder="Track title"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Genre</label>
                <Input
                  value={editForm.genre}
                  onChange={(e) => setEditForm({ ...editForm, genre: e.target.value })}
                  placeholder="e.g. Hip-Hop, EDM"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Tags (comma-separated)</label>
                <Input
                  value={editForm.tags}
                  onChange={(e) => setEditForm({ ...editForm, tags: e.target.value })}
                  placeholder="e.g. chill, vibes, 808s"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isEditing}>
                  {isEditing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Save
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
