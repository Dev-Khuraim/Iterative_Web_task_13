import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import type { User } from '@/types';
import { Loader2 } from 'lucide-react';

interface EditProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: User;
  onSaved: (updated: User) => void;
}

const URL_RE = /^https?:\/\/.+\..+/;

function validateProfileForm(form: {
  display_name: string;
  bio: string;
  website: string;
}) {
  const errors: Record<string, string> = {};
  if (form.display_name && form.display_name.trim().length < 3)
    errors.display_name = 'Display name must be at least 3 characters.';
  if (form.display_name && form.display_name.length > 100)
    errors.display_name = 'Display name must be at most 100 characters.';
  if (form.bio.length > 500)
    errors.bio = 'Bio must be at most 500 characters.';
  if (form.website && !URL_RE.test(form.website))
    errors.website = 'Enter a valid URL (e.g. https://yoursite.com).';
  return errors;
}

export function EditProfileDialog({ open, onOpenChange, profile, onSaved }: EditProfileDialogProps) {
  const [form, setForm] = useState({
    display_name: profile.display_name || '',
    bio: profile.bio || '',
    producer_type: profile.producer_type || '',
    genres: (profile.genres || []).join(', '),
    website: profile.website || '',
    avatar_url: profile.avatar_url || '',
    cover_image_url: profile.cover_image_url || '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);

  const clearError = (field: string) => setErrors((p) => ({ ...p, [field]: '' }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validateProfileForm(form);
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setIsSaving(true);
    try {
      let avatarUrl = form.avatar_url;
      let coverUrl = form.cover_image_url;

      if (avatarFile) {
        avatarUrl = await api.uploadFile(avatarFile);
      }
      if (coverFile) {
        coverUrl = await api.uploadFile(coverFile);
      }

      const genres = form.genres
        .split(',')
        .map((g) => g.trim())
        .filter(Boolean);

      const { user: updated } = await api.updateProfile({
        display_name: form.display_name || undefined,
        bio: form.bio || undefined,
        producer_type: form.producer_type || undefined,
        genres: genres.length > 0 ? genres : undefined,
        website: form.website || undefined,
        avatar_url: avatarUrl || undefined,
        cover_image_url: coverUrl || undefined,
      });

      onSaved(updated);
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to update profile:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Profile</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Display Name</label>
            <Input
              value={form.display_name}
              onChange={(e) => { setForm({ ...form, display_name: e.target.value }); clearError('display_name'); }}
              placeholder="Your display name"
              className={errors.display_name ? 'border-destructive' : ''}
            />
            {errors.display_name
              ? <p className="text-xs text-destructive">{errors.display_name}</p>
              : <p className="text-xs text-muted-foreground">If set, at least 3 characters.</p>}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Bio</label>
            <textarea
              value={form.bio}
              onChange={(e) => { setForm({ ...form, bio: e.target.value }); clearError('bio'); }}
              placeholder="Tell us about yourself"
              rows={3}
              maxLength={500}
              className={`w-full rounded-md border bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${errors.bio ? 'border-destructive' : 'border-input'}`}
            />
            <p className="text-xs text-muted-foreground text-right">{form.bio.length}/500</p>
            {errors.bio && <p className="text-xs text-destructive">{errors.bio}</p>}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Producer Type</label>
            <Input
              value={form.producer_type}
              onChange={(e) => setForm({ ...form, producer_type: e.target.value })}
              placeholder="e.g. Hip-Hop Producer, EDM Artist"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Genres (comma-separated)</label>
            <Input
              value={form.genres}
              onChange={(e) => setForm({ ...form, genres: e.target.value })}
              placeholder="e.g. Hip-Hop, EDM, R&B"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Website</label>
            <Input
              value={form.website}
              onChange={(e) => { setForm({ ...form, website: e.target.value }); clearError('website'); }}
              placeholder="https://yourwebsite.com"
              className={errors.website ? 'border-destructive' : ''}
            />
            {errors.website && <p className="text-xs text-destructive">{errors.website}</p>}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Avatar Image</label>
            <Input
              type="file"
              accept="image/*"
              onChange={(e) => setAvatarFile(e.target.files?.[0] || null)}
            />
            {form.avatar_url && !avatarFile && (
              <p className="text-xs text-muted-foreground">Current avatar is set</p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Cover Image</label>
            <Input
              type="file"
              accept="image/*"
              onChange={(e) => setCoverFile(e.target.files?.[0] || null)}
            />
            {form.cover_image_url && !coverFile && (
              <p className="text-xs text-muted-foreground">Current cover is set</p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
