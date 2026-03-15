import { useRef, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { useAuthStore } from '@/stores/authStore';
import { usePostStore } from '@/stores/postStore';
import { api } from '@/lib/api';
import { toast } from '@/hooks/useToast';
import { generateWaveformData, getInitials } from '@/lib/utils';
import { Music, FileText, Upload, X, Loader2 } from 'lucide-react';

function validate(
  postType: 'normal' | 'music',
  content: string,
  title: string,
  bpm: string,
  audioFile: File | null,
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (postType === 'normal' && !content.trim())
    errors.content = 'Post text is required.';
  if (postType === 'music') {
    if (!title.trim()) errors.title = 'Track title is required.';
    if (!audioFile) errors.audio = 'An audio file is required.';
  }
  if (bpm) {
    const n = parseInt(bpm, 10);
    if (isNaN(n) || n < 20 || n > 300) errors.bpm = 'BPM must be between 20 and 300.';
  }
  return errors;
}

export function QuickPost() {
  const { user } = useAuthStore();
  const { createPost } = usePostStore();

  const [isExpanded, setIsExpanded] = useState(false);
  const [postType, setPostType] = useState<'normal' | 'music'>('normal');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');
  const [genre, setGenre] = useState('');
  const [bpm, setBpm] = useState('');
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState('');

  const audioRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);

  const clearError = (field: string) => setErrors((p) => ({ ...p, [field]: '' }));

  const handleDiscard = () => {
    setIsExpanded(false);
    setPostType('normal');
    setContent('');
    setTitle('');
    setGenre('');
    setBpm('');
    setAudioFile(null);
    setCoverFile(null);
    setCoverPreview('');
    setErrors({});
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate(postType, content, title, bpm, audioFile);
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setIsSubmitting(true);
    try {
      let audioUrl: string | undefined;
      let coverUrl: string | undefined;

      if (audioFile) audioUrl = await api.uploadFile(audioFile);
      if (coverFile) coverUrl = await api.uploadFile(coverFile);

      await createPost({
        content: content || undefined,
        title: postType === 'music' ? (title || undefined) : undefined,
        genre: postType === 'music' ? (genre || undefined) : undefined,
        bpm: postType === 'music' && bpm ? parseInt(bpm) : undefined,
        is_full_track: false,
        audio_url: audioUrl,
        cover_image_url: coverUrl,
        audio_duration: 180,
        waveform_data: generateWaveformData(50),
      });

      toast({ title: 'Post created!', variant: 'default' });
      handleDiscard();
    } catch (error: any) {
      toast({ title: 'Failed to post', description: error.message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user) return null;

  return (
    <Card className="mb-6">
      <CardContent className="p-4">
        {!isExpanded ? (
          /* Collapsed — single-row prompt */
          <div className="flex items-center gap-3">
            <Avatar className="w-10 h-10 flex-shrink-0">
              <AvatarImage src={user.avatar_url || undefined} />
              <AvatarFallback>{getInitials(user.display_name || null)}</AvatarFallback>
            </Avatar>
            <button
              className="flex-1 text-left px-4 py-2.5 rounded-full bg-secondary text-muted-foreground text-sm hover:bg-secondary/80 transition-colors"
              onClick={() => setIsExpanded(true)}
            >
              What's on your mind, {user.display_name || user.username}?
            </button>
            <button
              className="flex items-center gap-1.5 text-sm text-beat-purple hover:text-beat-pink transition-colors font-medium"
              onClick={() => { setPostType('music'); setIsExpanded(true); }}
            >
              <Music className="w-4 h-4" />
              Share music
            </button>
          </div>
        ) : (
          /* Expanded form */
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Author row */}
            <div className="flex items-center gap-3">
              <Avatar className="w-10 h-10 flex-shrink-0">
                <AvatarImage src={user.avatar_url || undefined} />
                <AvatarFallback>{getInitials(user.display_name || null)}</AvatarFallback>
              </Avatar>
              <span className="font-medium text-sm">{user.display_name || user.username}</span>
            </div>

            {/* Post type toggle */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setPostType('normal'); setErrors({}); }}
                className={`flex items-center gap-1.5 py-1.5 px-3 rounded-full text-xs font-medium border transition-colors ${postType === 'normal' ? 'bg-beat-purple text-white border-beat-purple' : 'border-border hover:border-beat-purple/50'}`}
              >
                <FileText className="w-3 h-3" />
                Normal
              </button>
              <button
                type="button"
                onClick={() => { setPostType('music'); setErrors({}); }}
                className={`flex items-center gap-1.5 py-1.5 px-3 rounded-full text-xs font-medium border transition-colors ${postType === 'music' ? 'bg-beat-purple text-white border-beat-purple' : 'border-border hover:border-beat-purple/50'}`}
              >
                <Music className="w-3 h-3" />
                Music
              </button>
            </div>

            {/* Caption / text */}
            <div>
              <textarea
                autoFocus
                rows={3}
                placeholder={postType === 'normal' ? "What's on your mind?" : 'Add a caption for your track... (optional)'}
                value={content}
                onChange={(e) => { setContent(e.target.value); clearError('content'); }}
                className={`w-full p-3 rounded-lg bg-background border resize-none text-sm focus:ring-2 focus:ring-beat-purple focus:outline-none ${errors.content ? 'border-destructive' : 'border-input'}`}
              />
              {errors.content && <p className="text-xs text-destructive mt-1">{errors.content}</p>}
            </div>

            {/* Music-only fields */}
            {postType === 'music' && (
              <div className="space-y-3">
                {/* Audio upload */}
                <div>
                  <label className="text-xs font-medium mb-1 block">
                    Audio File <span className="text-destructive">*</span>
                  </label>
                  <input type="file" accept="audio/*" ref={audioRef} className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) { setAudioFile(f); clearError('audio'); } }} />
                  {audioFile ? (
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-secondary text-sm">
                      <Music className="w-4 h-4 text-beat-purple flex-shrink-0" />
                      <span className="flex-1 truncate">{audioFile.name}</span>
                      <button type="button" onClick={() => { setAudioFile(null); clearError('audio'); }}>
                        <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                      </button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => audioRef.current?.click()}
                      className={`w-full py-3 border-2 border-dashed rounded-lg text-sm text-muted-foreground hover:border-beat-purple/50 transition-colors flex items-center justify-center gap-2 ${errors.audio ? 'border-destructive' : 'border-border'}`}>
                      <Upload className="w-4 h-4" />
                      Upload audio (MP3, WAV…)
                    </button>
                  )}
                  {errors.audio && <p className="text-xs text-destructive mt-1">{errors.audio}</p>}
                </div>

                {/* Title + Genre row */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium mb-1 block">
                      Track Title <span className="text-destructive">*</span>
                    </label>
                    <Input
                      placeholder="My New Beat"
                      value={title}
                      onChange={(e) => { setTitle(e.target.value); clearError('title'); }}
                      className={`text-sm ${errors.title ? 'border-destructive' : ''}`}
                    />
                    {errors.title && <p className="text-xs text-destructive mt-1">{errors.title}</p>}
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1 block">Genre</label>
                    <Input
                      placeholder="Hip-Hop, EDM…"
                      value={genre}
                      onChange={(e) => setGenre(e.target.value)}
                      className="text-sm"
                    />
                  </div>
                </div>

                {/* BPM + cover row */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium mb-1 block">BPM</label>
                    <Input
                      type="number"
                      placeholder="120"
                      min={20}
                      max={300}
                      value={bpm}
                      onChange={(e) => { setBpm(e.target.value); clearError('bpm'); }}
                      className={`text-sm ${errors.bpm ? 'border-destructive' : ''}`}
                    />
                    {errors.bpm
                      ? <p className="text-xs text-destructive mt-1">{errors.bpm}</p>
                      : <p className="text-xs text-muted-foreground mt-1">20–300</p>}
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1 block">Cover Image (optional)</label>
                    <input type="file" accept="image/*" ref={coverRef} className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) { setCoverFile(f); setCoverPreview(URL.createObjectURL(f)); }
                      }} />
                    {coverPreview ? (
                      <div className="relative w-full h-10 flex items-center gap-2 p-2 rounded-lg bg-secondary text-sm">
                        <img src={coverPreview} className="w-6 h-6 rounded object-cover flex-shrink-0" alt="" />
                        <span className="flex-1 truncate text-xs">{coverFile?.name}</span>
                        <button type="button" onClick={() => { setCoverFile(null); setCoverPreview(''); }}>
                          <X className="w-4 h-4 text-muted-foreground" />
                        </button>
                      </div>
                    ) : (
                      <button type="button" onClick={() => coverRef.current?.click()}
                        className="w-full h-10 border-2 border-dashed border-border rounded-lg text-xs text-muted-foreground hover:border-beat-purple/50 transition-colors flex items-center justify-center gap-1">
                        <Upload className="w-3 h-3" />
                        Upload cover
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="ghost" size="sm" onClick={handleDiscard}>
                Discard
              </Button>
              <Button type="submit" size="sm" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />}
                Post
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
