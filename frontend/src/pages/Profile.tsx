import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PostCard } from '@/components/posts/PostCard';
import { EditProfileDialog } from '@/components/profile/EditProfileDialog';
import { useAuthStore } from '@/stores/authStore';
import { usePostStore } from '@/stores/postStore';
import { useChatStore } from '@/stores/chatStore';
import { api } from '@/lib/api';
import { socketClient } from '@/lib/socket';
import { getInitials, formatTimeAgo } from '@/lib/utils';
import type { User, Post } from '@/types';
import {
  UserPlus,
  UserCheck,
  MessageCircle,
  Link as LinkIcon,
  Music,
  Users,
  Calendar,
  Loader2,
} from 'lucide-react';

export function Profile() {
  const { userId } = useParams<{ userId: string }>();
  const { user: currentUser } = useAuthStore();
  const { posts, fetchUserPosts, isLoading: postsLoading } = usePostStore();
  const { openConversation } = useChatStore();

  const [profile, setProfile] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('tracks');
  const [likedPosts, setLikedPosts] = useState<Post[]>([]);
  const [likesLoading, setLikesLoading] = useState(false);
  const [editProfileOpen, setEditProfileOpen] = useState(false);

  const isOwnProfile = currentUser?.id === userId;

  useEffect(() => {
    if (userId) {
      loadProfile();
      fetchUserPosts(userId);
      setLikedPosts([]);
      setActiveTab('tracks');
    }
  }, [userId, fetchUserPosts]);

  useEffect(() => {
    if (activeTab === 'likes' && userId && likedPosts.length === 0 && !likesLoading) {
      loadLikedPosts();
    }
  }, [activeTab, userId]);

  const loadLikedPosts = async () => {
    if (!userId) return;
    setLikesLoading(true);
    try {
      const { posts: liked } = await api.getLikedPosts(userId);
      setLikedPosts(liked);
    } catch (error) {
      console.error('Failed to load liked posts:', error);
    } finally {
      setLikesLoading(false);
    }
  };

  const loadProfile = async () => {
    if (!userId) return;
    setIsLoading(true);
    try {
      const { user } = await api.getUser(userId);
      setProfile(user);
    } catch (error) {
      console.error('Failed to load profile:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFollow = async () => {
    if (!profile) return;
    setActionLoading(true);
    try {
      if (profile.is_following) {
        await api.unfollowUser(profile.id);
        setProfile({ ...profile, is_following: false, followers_count: (profile.followers_count || 1) - 1 });
      } else {
        await api.followUser(profile.id);
        setProfile({ ...profile, is_following: true, followers_count: (profile.followers_count || 0) + 1 });
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleFriendRequest = async () => {
    if (!profile) return;
    setActionLoading(true);
    try {
      await api.sendFriendRequest(profile.id);
      socketClient.emitFriendRequest(profile.id);
      setProfile({ ...profile, friendship_status: 'pending' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleMessage = async () => {
    if (!profile) return;
    await openConversation([profile.id]);
    window.location.href = '/messages';
  };

  const handleProfileSaved = (updated: User) => {
    setProfile((prev) => prev ? { ...prev, ...updated } : updated);
    const { updateUser } = useAuthStore.getState();
    updateUser(updated);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-beat-purple" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold">User not found</h2>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Cover Image */}
      <div className="h-48 bg-gradient-to-r from-beat-purple via-beat-pink to-beat-orange" />

      {/* Profile Header */}
      <div className="px-6 pb-6 -mt-16">
        <div className="flex flex-col md:flex-row gap-6 items-start">
          {/* Avatar */}
          <Avatar className="w-32 h-32 border-4 border-background">
            <AvatarImage src={profile.avatar_url || undefined} />
            <AvatarFallback className="text-3xl">
              {getInitials(profile.display_name || profile.username)}
            </AvatarFallback>
          </Avatar>

          {/* Info */}
          <div className="flex-1 pt-8">
            <div className="flex flex-col md:flex-row md:items-center gap-4">
              <div>
                <h1 className="text-2xl font-bold">{profile.display_name || profile.username}</h1>
                <p className="text-muted-foreground">@{profile.username}</p>
                {profile.producer_type && (
                  <p className="text-beat-purple font-medium mt-1">{profile.producer_type}</p>
                )}
              </div>

              {/* Actions */}
              {!isOwnProfile && (
                <div className="flex gap-2 md:ml-auto">
                  <Button onClick={handleFollow} variant="outline" disabled={actionLoading}>
                    {profile.is_following ? (
                      <>
                        <UserCheck className="w-4 h-4 mr-2" />
                        Following
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-4 h-4 mr-2" />
                        Follow
                      </>
                    )}
                  </Button>

                  {profile.friendship_status === 'accepted' ? (
                    <Button variant="secondary" disabled>
                      <Users className="w-4 h-4 mr-2" />
                      Friends
                    </Button>
                  ) : profile.friendship_status === 'pending' ? (
                    <Button variant="secondary" disabled>
                      Request Sent
                    </Button>
                  ) : (
                    <Button onClick={handleFriendRequest} variant="secondary" disabled={actionLoading}>
                      <UserPlus className="w-4 h-4 mr-2" />
                      Add Friend
                    </Button>
                  )}

                  <Button onClick={handleMessage}>
                    <MessageCircle className="w-4 h-4 mr-2" />
                    Message
                  </Button>
                </div>
              )}

              {isOwnProfile && (
                <Button variant="outline" className="md:ml-auto" onClick={() => setEditProfileOpen(true)}>
                  Edit Profile
                </Button>
              )}
            </div>

            {/* Bio */}
            {profile.bio && <p className="mt-4">{profile.bio}</p>}

            {/* Genres */}
            {profile.genres && profile.genres.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {profile.genres.map((genre) => (
                  <span
                    key={genre}
                    className="px-3 py-1 rounded-full bg-beat-purple/20 text-beat-purple text-sm"
                  >
                    {genre}
                  </span>
                ))}
              </div>
            )}

            {/* Links */}
            <div className="flex flex-wrap gap-4 mt-4 text-sm text-muted-foreground">
              {profile.website && (
                <a
                  href={profile.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 hover:text-beat-purple"
                >
                  <LinkIcon className="w-4 h-4" />
                  Website
                </a>
              )}
              <span className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                Joined {new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </span>
            </div>

            {/* Stats */}
            <div className="flex gap-6 mt-4">
              <div>
                <span className="font-bold">{profile.posts_count || 0}</span>
                <span className="text-muted-foreground ml-1">tracks</span>
              </div>
              <div>
                <span className="font-bold">{profile.followers_count || 0}</span>
                <span className="text-muted-foreground ml-1">followers</span>
              </div>
              <div>
                <span className="font-bold">{profile.following_count || 0}</span>
                <span className="text-muted-foreground ml-1">following</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content Tabs */}
      <div className="px-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList>
            <TabsTrigger value="tracks">
              <Music className="w-4 h-4 mr-2" />
              Tracks
            </TabsTrigger>
            <TabsTrigger value="likes">Likes</TabsTrigger>
            <TabsTrigger value="reposts">Reposts</TabsTrigger>
          </TabsList>

          <TabsContent value="tracks" className="mt-6">
            {postsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-beat-purple" />
              </div>
            ) : posts.filter(p => !p.is_repost).length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No tracks yet
              </div>
            ) : (
              <div className="space-y-6">
                {posts.filter(p => !p.is_repost).map((post) => (
                  <PostCard key={post.id} post={post} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="likes" className="mt-6">
            {likesLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-beat-purple" />
              </div>
            ) : likedPosts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No liked tracks yet
              </div>
            ) : (
              <div className="space-y-6">
                {likedPosts.map((post) => (
                  <PostCard key={post.id} post={post} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="reposts" className="mt-6">
            {postsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-beat-purple" />
              </div>
            ) : posts.filter(p => p.is_repost).length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No reposts yet
              </div>
            ) : (
              <div className="space-y-6">
                {posts.filter(p => p.is_repost).map((post, index) => (
                  <PostCard
                    key={`repost-${post.id}-${index}`}
                    post={post}
                    isRepost
                    repostedBy={post.reposted_by || profile?.display_name || profile?.username}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {isOwnProfile && profile && (
        <EditProfileDialog
          open={editProfileOpen}
          onOpenChange={setEditProfileOpen}
          profile={profile}
          onSaved={handleProfileSaved}
        />
      )}
    </div>
  );
}
