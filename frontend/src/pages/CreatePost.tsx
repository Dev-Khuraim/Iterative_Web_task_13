import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { usePostStore } from '@/stores/postStore';
import { toast } from '@/hooks/useToast';
import { generateWaveformData } from '@/lib/utils';
import { api } from '@/lib/api';
import { Upload, Music, X, Loader2, FileText } from 'lucide-react';

function validatePostForm(
  postType: 'normal' | 'music',
  content: string,
  title: string,
  bpm: string,
  audioFile: File | null,
) {
  const errors: Record<string, string> = {};
  if (postType === 'normal' && !content.trim())
    errors.content = 'Post text is required.';
  if (postType === 'music') {
    if (!title.trim()) errors.title = 'Track title is required for music posts.';
    if (!audioFile) errors.audio = 'An audio file is required for music posts.';
  }
  if (bpm) {
    const n = parseInt(bpm, 10);
    if (isNaN(n) || n < 20 || n > 300) errors.bpm = 'BPM must be a whole number between 20 and 300.';
  }
  return errors;
}

export function CreatePost() {
  const navigate = useNavigate();
  const { createPost } = usePostStore();
  const [isLoading, setIsLoading] = useState(false);
  const [postType, setPostType] = useState<'normal' | 'music'>('normal');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [form, setForm] = useState({
    content: '',
    title: '',
    genre: '',
    bpm: '',
    key_signature: '',
    tags: '',
    is_full_track: false,
  });

  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [coverImage, setCoverImage] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState('');

  const audioInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const clearError = (field: string) => setErrors((p) => ({ ...p, [field]: '' }));

  const handleAudioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAudioFile(file);
      clearError('audio');
    }
  };

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCoverImage(file);
      setCoverPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validatePostForm(postType, form.content, form.title, form.bpm, audioFile);
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setIsLoading(true);
    try {
      let uploadedAudioUrl: string | undefined;
      let uploadedCoverUrl: string | undefined;

      if (audioFile) {
        uploadedAudioUrl = await api.uploadFile(audioFile);
      }
      if (coverImage) {
        uploadedCoverUrl = await api.uploadFile(coverImage);
      }

      const postData = {
        content: form.content || undefined,
        title: postType === 'music' ? (form.title || undefined) : undefined,
        genre: postType === 'music' ? (form.genre || undefined) : undefined,
        bpm: postType === 'music' && form.bpm ? parseInt(form.bpm) : undefined,
        key_signature: postType === 'music' ? (form.key_signature || undefined) : undefined,
        tags: postType === 'music' && form.tags ? form.tags.split(',').map((t) => t.trim()).filter(Boolean) : undefined,
        is_full_track: postType === 'music' ? form.is_full_track : false,
        audio_url: uploadedAudioUrl,
        cover_image_url: uploadedCoverUrl,
        audio_duration: 180,
        waveform_data: generateWaveformData(50),
      };

      await createPost(postData);
      toast({ title: 'Post created!', variant: 'default' });
      navigate('/');
    } catch (error: any) {
      toast({
        title: 'Failed to create post',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Music className="w-6 h-6 text-beat-purple" />
            Create New Post
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Post type selector */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setPostType('normal'); setErrors({}); }}
                className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg border text-sm font-medium transition-colors ${postType === 'normal' ? 'bg-beat-purple text-white border-beat-purple' : 'border-border hover:border-beat-purple/50'}`}
              >
                <FileText className="w-4 h-4" />
                Normal Post
              </button>
              <button
                type="button"
                onClick={() => { setPostType('music'); setErrors({}); }}
                className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg border text-sm font-medium transition-colors ${postType === 'music' ? 'bg-beat-purple text-white border-beat-purple' : 'border-border hover:border-beat-purple/50'}`}
              >
                <Music className="w-4 h-4" />
                Music Post
              </button>
            </div>

            {/* Content / caption */}
            <div className="space-y-2">
              <label className="text-sm font-medium">
                {postType === 'normal' ? <>What's on your mind? <span className="text-destructive">*</span></> : 'Caption (optional)'}
              </label>
              <textarea
                className={`w-full min-h-[100px] p-3 rounded-lg bg-background border resize-none focus:ring-2 focus:ring-beat-purple focus:outline-none ${errors.content ? 'border-destructive' : 'border-input'}`}
                placeholder={postType === 'normal' ? 'Share your thoughts...' : 'Add a caption for your track...'}
                value={form.content}
                onChange={(e) => { setForm({ ...form, content: e.target.value }); clearError('content'); }}
              />
              {errors.content && <p className="text-xs text-destructive">{errors.content}</p>}
            </div>

            {/* Music-only fields */}
            {postType === 'music' && (
              <>
                {/* Audio Upload */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Audio File <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="file"
                    ref={audioInputRef}
                    accept="audio/*"
                    onChange={handleAudioChange}
                    className="hidden"
                  />
                  {audioFile ? (
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-vinyl-gray border border-vinyl-light">
                      <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-beat-purple to-beat-pink flex items-center justify-center">
                        <Music className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium truncate">{audioFile.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {(audioFile.size / (1024 * 1024)).toFixed(2)} MB
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => { setAudioFile(null); clearError('audio'); }}
                      >
                        <X className="w-5 h-5" />
                      </Button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => audioInputRef.current?.click()}
                      className={`w-full p-8 border-2 border-dashed rounded-lg hover:border-beat-purple/50 transition-colors ${errors.audio ? 'border-destructive' : 'border-border'}`}
                    >
                      <div className="flex flex-col items-center gap-2">
                        <Upload className="w-8 h-8 text-muted-foreground" />
                        <p className="text-muted-foreground">Click to upload audio (MP3, WAV, etc.)</p>
                      </div>
                    </button>
                  )}
                  {errors.audio && <p className="text-xs text-destructive">{errors.audio}</p>}
                </div>

                {/* Cover Image */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Cover Image (optional)</label>
                  <input
                    type="file"
                    ref={coverInputRef}
                    accept="image/*"
                    onChange={handleCoverChange}
                    className="hidden"
                  />
                  {coverPreview ? (
                    <div className="relative w-40 h-40">
                      <img src={coverPreview} alt="Cover preview" className="w-full h-full object-cover rounded-lg" />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute top-2 right-2 bg-black/50"
                        onClick={() => { setCoverImage(null); setCoverPreview(''); }}
                      >
                        <X className="w-4 h-4 text-white" />
                      </Button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => coverInputRef.current?.click()}
                      className="w-40 h-40 border-2 border-dashed border-border rounded-lg hover:border-beat-purple/50 transition-colors flex items-center justify-center"
                    >
                      <Upload className="w-6 h-6 text-muted-foreground" />
                    </button>
                  )}
                </div>

                {/* Track Details */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2 col-span-2">
                    <label className="text-sm font-medium">
                      Track Title <span className="text-destructive">*</span>
                    </label>
                    <Input
                      placeholder="My New Beat"
                      value={form.title}
                      onChange={(e) => { setForm({ ...form, title: e.target.value }); clearError('title'); }}
                      className={errors.title ? 'border-destructive' : ''}
                    />
                    {errors.title && <p className="text-xs text-destructive">{errors.title}</p>}
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Genre</label>
                    <Input
                      placeholder="Hip-Hop, EDM, etc."
                      value={form.genre}
                      onChange={(e) => setForm({ ...form, genre: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">BPM</label>
                    <Input
                      type="number"
                      placeholder="120"
                      min={20}
                      max={300}
                      value={form.bpm}
                      onChange={(e) => { setForm({ ...form, bpm: e.target.value }); clearError('bpm'); }}
                      className={errors.bpm ? 'border-destructive' : ''}
                    />
                    {errors.bpm
                      ? <p className="text-xs text-destructive">{errors.bpm}</p>
                      : <p className="text-xs text-muted-foreground">20–300</p>}
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Key</label>
                    <Input
                      placeholder="C Minor, F# Major"
                      value={form.key_signature}
                      onChange={(e) => setForm({ ...form, key_signature: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Tags (comma separated)</label>
                    <Input
                      placeholder="trap, dark, melody"
                      value={form.tags}
                      onChange={(e) => setForm({ ...form, tags: e.target.value })}
                    />
                  </div>
                </div>

                {/* Full Track Toggle */}
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="is_full_track"
                    checked={form.is_full_track}
                    onChange={(e) => setForm({ ...form, is_full_track: e.target.checked })}
                    className="w-4 h-4 rounded border-input"
                  />
                  <label htmlFor="is_full_track" className="text-sm">
                    This is a full track (not a snippet/preview)
                  </label>
                </div>
              </>
            )}

            {/* Submit */}
            <div className="flex gap-3">
              <Button type="button" variant="outline" onClick={() => navigate(-1)} className="flex-1">
                Cancel
              </Button>
              <Button type="submit" className="flex-1" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Posting...
                  </>
                ) : (
                  'Post'
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
