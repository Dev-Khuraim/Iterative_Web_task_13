import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { usePostStore } from '@/stores/postStore';
import { cn, formatDuration, formatTimeAgo, generateWaveformData, getInitials } from '@/lib/utils';
import type { Post, User } from '@/types';
import {
  Search,
  Loader2,
  Play,
  Pause,
  Heart,
  MessageCircle,
  TrendingUp,
  Star,
  Music,
  Users,
  Flame,
  UserPlus,
  UserCheck,
} from 'lucide-react';

const genres = [
  'All', 'Hip-Hop', 'EDM', 'Trap', 'R&B', 'Pop', 'Rock', 'Jazz', 'Lo-Fi', 'House', 'Techno',
];

// ─── Mini Audio Player ────────────────────────────────────────────────────────

interface TrackCardProps {
  post: Post;
  rank?: number;
  variant?: 'grid' | 'list';
}

function TrackCard({ post, rank, variant = 'grid' }: TrackCardProps) {
  const { user } = useAuthStore();
  const { likePost, unlikePost } = usePostStore();

  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [waveform] = useState(() => post.waveform_data || generateWaveformData(32));
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => setProgress(audio.duration ? audio.currentTime / audio.duration : 0);
    const onEnd = () => setIsPlaying(false);
    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('ended', onEnd);
    return () => {
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('ended', onEnd);
    };
  }, []);

  const togglePlay = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleLike = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) return;
    if (post.is_liked) {
      await unlikePost(post.id);
    } else {
      await likePost(post.id);
    }
  };

  if (variant === 'list') {
    return (
      <Link to={`/profile/${post.user?.id}`}>
        <div className="group flex items-center gap-4 p-3 rounded-xl hover:bg-secondary/60 transition-all duration-200 cursor-pointer">
          {audio_url_exists(post) && (
            <audio ref={audioRef} src={post.audio_url!} preload="none" />
          )}

          {rank !== undefined && (
            <span className={cn(
              'w-6 text-center text-sm font-bold flex-shrink-0',
              rank <= 3 ? 'text-beat-orange' : 'text-muted-foreground'
            )}>
              {rank}
            </span>
          )}

          {/* Play button + cover */}
          <div className="relative w-12 h-12 flex-shrink-0" onClick={togglePlay}>
            {post.cover_image_url ? (
              <img
                src={post.cover_image_url}
                alt={post.title || ''}
                className="w-full h-full rounded-lg object-cover"
              />
            ) : (
              <div className="w-full h-full rounded-lg bg-gradient-to-br from-beat-purple/30 to-beat-pink/30 flex items-center justify-center">
                <Music className="w-5 h-5 text-beat-purple" />
              </div>
            )}
            <div className="absolute inset-0 rounded-lg bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
              {isPlaying ? (
                <Pause className="w-5 h-5 text-white" />
              ) : (
                <Play className="w-5 h-5 text-white ml-0.5" />
              )}
            </div>
          </div>

          {/* Title + artist */}
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate text-sm">{post.title || 'Untitled'}</p>
            <p className="text-xs text-muted-foreground truncate">
              {post.user?.display_name || post.user?.username}
            </p>
          </div>

          {/* Mini waveform progress */}
          <div className="hidden sm:flex items-center gap-[1.5px] h-8 w-20 flex-shrink-0">
            {waveform.slice(0, 20).map((h, i) => {
              const barFilled = i / 20 <= progress;
              return (
                <div
                  key={i}
                  className={cn(
                    'flex-1 rounded-full transition-colors duration-75',
                    barFilled ? 'bg-beat-purple' : 'bg-secondary'
                  )}
                  style={{ height: `${h * 100}%` }}
                />
              );
            })}
          </div>

          {/* Duration */}
          <span className="hidden sm:block text-xs text-muted-foreground w-10 text-right flex-shrink-0">
            {post.audio_duration ? formatDuration(post.audio_duration) : '—'}
          </span>

          {/* Stats */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <button
              onClick={handleLike}
              className={cn(
                'flex items-center gap-1 text-xs transition-colors',
                post.is_liked ? 'text-beat-pink' : 'text-muted-foreground hover:text-beat-pink'
              )}
            >
              <Heart className={cn('w-3.5 h-3.5', post.is_liked && 'fill-current')} />
              {post.likes_count ?? 0}
            </button>
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <MessageCircle className="w-3.5 h-3.5" />
              {post.comments_count ?? 0}
            </span>
          </div>
        </div>
      </Link>
    );
  }

  // Grid variant
  return (
    <Link to={`/profile/${post.user?.id}`}>
      <div className="group relative rounded-xl overflow-hidden border border-border hover:border-beat-purple/50 transition-all duration-200 bg-card hover:shadow-lg hover:shadow-beat-purple/10 cursor-pointer">
        {audio_url_exists(post) && (
          <audio ref={audioRef} src={post.audio_url!} preload="none" />
        )}

        {/* Cover */}
        <div className="aspect-square relative" onClick={togglePlay}>
          {post.cover_image_url ? (
            <img
              src={post.cover_image_url}
              alt={post.title || ''}
              className={cn(
                'w-full h-full object-cover transition-transform duration-300 group-hover:scale-105',
                isPlaying && 'scale-105'
              )}
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-beat-purple/20 via-beat-pink/10 to-beat-orange/10 flex items-center justify-center">
              <div className={cn('vinyl-record w-20 h-20', isPlaying && 'vinyl-spin')} />
            </div>
          )}

          {/* Overlay with play button */}
          <div className={cn(
            'absolute inset-0 bg-black/50 flex items-center justify-center transition-opacity duration-200',
            isPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          )}>
            <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center">
              {isPlaying ? (
                <Pause className="w-5 h-5 text-white" />
              ) : (
                <Play className="w-5 h-5 text-white ml-0.5" />
              )}
            </div>
          </div>

          {/* Genre badge */}
          {post.genre && (
            <span className="absolute top-2 left-2 px-2 py-0.5 text-xs rounded-full bg-beat-purple/80 text-white backdrop-blur-sm">
              {post.genre}
            </span>
          )}

          {/* BPM badge */}
          {post.bpm && (
            <span className="absolute top-2 right-2 px-2 py-0.5 text-xs rounded-full bg-black/60 text-white backdrop-blur-sm">
              {post.bpm} BPM
            </span>
          )}
        </div>

        {/* Mini waveform progress bar */}
        <div className="flex items-center gap-[1.5px] h-6 px-3 pt-2 bg-card">
          {waveform.map((h, i) => {
            const barFilled = i / waveform.length <= progress;
            return (
              <div
                key={i}
                className={cn(
                  'flex-1 rounded-full transition-colors duration-75',
                  barFilled ? 'bg-gradient-to-t from-beat-purple to-beat-pink' : 'bg-secondary'
                )}
                style={{ height: `${h * 100}%` }}
              />
            );
          })}
        </div>

        {/* Info */}
        <div className="p-3 pt-1">
          <p className="font-semibold text-sm truncate">{post.title || 'Untitled Track'}</p>

          {/* Producer */}
          <div className="flex items-center gap-2 mt-1.5">
            <Avatar className="w-5 h-5">
              <AvatarImage src={post.user?.avatar_url || undefined} />
              <AvatarFallback className="text-[9px]">
                {getInitials(post.user?.display_name || null)}
              </AvatarFallback>
            </Avatar>
            <span className="text-xs text-muted-foreground truncate">
              {post.user?.display_name || post.user?.username}
            </span>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-4 mt-2">
            <button
              onClick={handleLike}
              className={cn(
                'flex items-center gap-1 text-xs transition-colors',
                post.is_liked ? 'text-beat-pink' : 'text-muted-foreground hover:text-beat-pink'
              )}
            >
              <Heart className={cn('w-3.5 h-3.5', post.is_liked && 'fill-current')} />
              {post.likes_count ?? 0}
            </button>
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <MessageCircle className="w-3.5 h-3.5" />
              {post.comments_count ?? 0}
            </span>
            <span className="ml-auto text-xs text-muted-foreground">
              {formatTimeAgo(post.created_at)}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

function audio_url_exists(post: Post): boolean {
  return !!post.audio_url;
}

// ─── Producer Card ────────────────────────────────────────────────────────────

interface ProducerCardProps {
  user: User;
}

function ProducerCard({ user }: ProducerCardProps) {
  const { user: currentUser } = useAuthStore();
  const [isFollowing, setIsFollowing] = useState(user.is_following ?? false);
  const [loading, setLoading] = useState(false);
  const isSelf = currentUser?.id === user.id;

  const handleFollow = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!currentUser || isSelf) return;
    setLoading(true);
    try {
      if (isFollowing) {
        await api.unfollowUser(user.id);
        setIsFollowing(false);
      } else {
        await api.followUser(user.id);
        setIsFollowing(true);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Link to={`/profile/${user.id}`}>
      <div className="group flex flex-col items-center gap-3 p-4 rounded-xl border border-border hover:border-beat-purple/50 bg-card hover:shadow-lg hover:shadow-beat-purple/10 transition-all duration-200 cursor-pointer text-center">
        <div className="relative">
          <Avatar className="w-16 h-16">
            <AvatarImage src={user.avatar_url || undefined} />
            <AvatarFallback>{getInitials(user.display_name || user.username)}</AvatarFallback>
          </Avatar>
          {user.is_online && (
            <span className="absolute bottom-0.5 right-0.5 w-3.5 h-3.5 bg-green-500 border-2 border-background rounded-full" />
          )}
        </div>

        <div className="min-w-0 w-full">
          <p className="font-semibold text-sm truncate">
            {user.display_name || user.username}
          </p>
          <p className="text-xs text-muted-foreground truncate">@{user.username}</p>
          {user.producer_type && (
            <p className="text-xs text-beat-purple mt-0.5 truncate">{user.producer_type}</p>
          )}
        </div>

        {user.genres && user.genres.length > 0 && (
          <div className="flex flex-wrap justify-center gap-1">
            {user.genres.slice(0, 2).map((g) => (
              <span key={g} className="px-1.5 py-0.5 text-[10px] rounded-full bg-secondary text-secondary-foreground">
                {g}
              </span>
            ))}
          </div>
        )}

        {!isSelf && (
          <button
            onClick={handleFollow}
            disabled={loading}
            className={cn(
              'w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200',
              isFollowing
                ? 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                : 'bg-gradient-to-r from-beat-purple to-beat-pink text-white hover:opacity-90'
            )}
          >
            {loading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : isFollowing ? (
              <><UserCheck className="w-3.5 h-3.5" /> Following</>
            ) : (
              <><UserPlus className="w-3.5 h-3.5" /> Follow</>
            )}
          </button>
        )}
      </div>
    </Link>
  );
}

// ─── Section Header ───────────────────────────────────────────────────────────

function SectionHeader({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle?: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-beat-purple to-beat-pink flex items-center justify-center flex-shrink-0">
        {icon}
      </div>
      <div>
        <h2 className="text-lg font-bold leading-none">{title}</h2>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function Discover() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState<string>('All');

  const [trendingPosts, setTrendingPosts] = useState<Post[]>([]);
  const [popularPosts, setPopularPosts] = useState<Post[]>([]);
  const [searchResults, setSearchResults] = useState<Post[]>([]);
  const [producerResults, setProducerResults] = useState<User[]>([]);
  const [trendingProducers, setTrendingProducers] = useState<User[]>([]);

  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingInitial, setIsLoadingInitial] = useState(true);
  const [activeTab, setActiveTab] = useState<'trending' | 'popular' | 'producers'>('trending');
  const [hasSearched, setHasSearched] = useState(false);

  const genre = selectedGenre === 'All' ? undefined : selectedGenre;

  // Load trending/popular on mount and when genre filter changes
  useEffect(() => {
    loadInitial();
  }, [selectedGenre]);

  const loadInitial = async () => {
    setIsLoadingInitial(true);
    try {
      const [trendingRes, popularRes, producersRes] = await Promise.all([
        api.getTrendingPosts(12, genre),
        api.getPopularPosts(12, genre),
        api.searchUsers({ genre }),
      ]);
      setTrendingPosts(trendingRes.posts.filter((p) => !!p.audio_url));
      setPopularPosts(popularRes.posts);
      setTrendingProducers(producersRes.users.slice(0, 12));
    } finally {
      setIsLoadingInitial(false);
    }
  };

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!searchQuery.trim()) {
      setHasSearched(false);
      return;
    }
    setIsSearching(true);
    setHasSearched(true);
    try {
      const [postsRes, usersRes] = await Promise.all([
        api.searchPosts({ q: searchQuery, genre, limit: 24 }),
        api.searchUsers({ q: searchQuery, genre }),
      ]);
      setSearchResults(postsRes.posts);
      setProducerResults(usersRes.users);
    } finally {
      setIsSearching(false);
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setHasSearched(false);
    setSearchResults([]);
    setProducerResults([]);
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-8">
      {/* Page Title */}
      <div>
        <h1 className="text-3xl font-bold music-gradient-text">Discover</h1>
        <p className="text-muted-foreground mt-1">Explore beats, tracks, and producers from the community</p>
      </div>

      {/* Search + Genre Filter */}
      <div className="space-y-3">
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              placeholder="Search tracks, producers, genres, tags…"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (!e.target.value.trim()) clearSearch();
              }}
              className="pl-10"
            />
          </div>
          <Button type="submit" disabled={isSearching}>
            {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}
          </Button>
          {hasSearched && (
            <Button type="button" variant="outline" onClick={clearSearch}>
              Clear
            </Button>
          )}
        </form>

        {/* Genre chips */}
        <div className="flex flex-wrap gap-2">
          {genres.map((g) => (
            <button
              key={g}
              onClick={() => setSelectedGenre(g)}
              className={cn(
                'px-3 py-1 rounded-full text-sm font-medium transition-all duration-200 border',
                selectedGenre === g
                  ? 'bg-gradient-to-r from-beat-purple to-beat-pink text-white border-transparent shadow-md shadow-beat-purple/25'
                  : 'border-border hover:border-beat-purple/50 hover:bg-secondary'
              )}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      {/* ── Search Results ── */}
      {hasSearched && (
        <div className="space-y-8">
          {isSearching ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-beat-purple" />
            </div>
          ) : (
            <>
              {/* Track results */}
              <section>
                <SectionHeader
                  icon={<Music className="w-4 h-4 text-white" />}
                  title={`Tracks (${searchResults.length})`}
                />
                {searchResults.length === 0 ? (
                  <p className="text-muted-foreground py-6 text-center">No tracks found for "{searchQuery}"</p>
                ) : (
                  <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                    {searchResults.map((post) => (
                      <TrackCard key={post.id} post={post} variant="grid" />
                    ))}
                  </div>
                )}
              </section>

              {/* Producer results */}
              <section>
                <SectionHeader
                  icon={<Users className="w-4 h-4 text-white" />}
                  title={`Producers (${producerResults.length})`}
                />
                {producerResults.length === 0 ? (
                  <p className="text-muted-foreground py-6 text-center">No producers found for "{searchQuery}"</p>
                ) : (
                  <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                    {producerResults.map((u) => (
                      <ProducerCard key={u.id} user={u} />
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      )}

      {/* ── Default Discovery View ── */}
      {!hasSearched && (
        isLoadingInitial ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-beat-purple" />
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
            <TabsList className="mb-6">
              <TabsTrigger value="trending" className="gap-2">
                <Flame className="w-4 h-4" /> Trending
              </TabsTrigger>
              <TabsTrigger value="popular" className="gap-2">
                <Star className="w-4 h-4" /> Popular
              </TabsTrigger>
              <TabsTrigger value="producers" className="gap-2">
                <Users className="w-4 h-4" /> Producers
              </TabsTrigger>
            </TabsList>

            {/* ── TRENDING TAB ── */}
            <TabsContent value="trending" className="space-y-8">
              {/* Top 5 list */}
              {trendingPosts.length > 0 && (
                <section>
                  <SectionHeader
                    icon={<TrendingUp className="w-4 h-4 text-white" />}
                    title="Hot Right Now"
                    subtitle="Most-engaged tracks in the last 7 days"
                  />
                  <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
                    {trendingPosts.slice(0, 5).map((post, i) => (
                      <TrackCard key={post.id} post={post} rank={i + 1} variant="list" />
                    ))}
                  </div>
                </section>
              )}

              {/* Grid of the rest */}
              {trendingPosts.length > 5 && (
                <section>
                  <SectionHeader
                    icon={<Flame className="w-4 h-4 text-white" />}
                    title="Trending Tracks"
                  />
                  <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                    {trendingPosts.slice(5).map((post) => (
                      <TrackCard key={post.id} post={post} variant="grid" />
                    ))}
                  </div>
                </section>
              )}

              {trendingPosts.length === 0 && (
                <EmptyState
                  icon={<Flame className="w-10 h-10 text-muted-foreground" />}
                  title="No trending tracks yet"
                  subtitle="Be the first to drop a beat!"
                />
              )}

              {/* Trending producers inline */}
              {trendingProducers.length > 0 && (
                <section>
                  <SectionHeader
                    icon={<Users className="w-4 h-4 text-white" />}
                    title="Trending Producers"
                    subtitle="Active producers to follow"
                  />
                  <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                    {trendingProducers.slice(0, 6).map((u) => (
                      <ProducerCard key={u.id} user={u} />
                    ))}
                  </div>
                </section>
              )}
            </TabsContent>

            {/* ── POPULAR TAB ── */}
            <TabsContent value="popular" className="space-y-8">
              {/* Top 5 list */}
              {popularPosts.length > 0 && (
                <section>
                  <SectionHeader
                    icon={<Star className="w-4 h-4 text-white" />}
                    title="All-Time Favourites"
                    subtitle="Most-loved tracks of all time"
                  />
                  <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
                    {popularPosts.slice(0, 5).map((post, i) => (
                      <TrackCard key={post.id} post={post} rank={i + 1} variant="list" />
                    ))}
                  </div>
                </section>
              )}

              {/* Grid */}
              {popularPosts.length > 5 && (
                <section>
                  <SectionHeader
                    icon={<Music className="w-4 h-4 text-white" />}
                    title="Popular Tracks"
                  />
                  <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                    {popularPosts.slice(5).map((post) => (
                      <TrackCard key={post.id} post={post} variant="grid" />
                    ))}
                  </div>
                </section>
              )}

              {popularPosts.length === 0 && (
                <EmptyState
                  icon={<Star className="w-10 h-10 text-muted-foreground" />}
                  title="No popular tracks yet"
                  subtitle="Start posting your beats to build up plays and likes!"
                />
              )}
            </TabsContent>

            {/* ── PRODUCERS TAB ── */}
            <TabsContent value="producers" className="space-y-8">
              <section>
                <SectionHeader
                  icon={<Users className="w-4 h-4 text-white" />}
                  title="Discover Producers"
                  subtitle="Connect with music makers in the community"
                />
                {trendingProducers.length === 0 ? (
                  <EmptyState
                    icon={<Users className="w-10 h-10 text-muted-foreground" />}
                    title="No producers yet"
                    subtitle="Be the first to sign up!"
                  />
                ) : (
                  <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                    {trendingProducers.map((u) => (
                      <ProducerCard key={u.id} user={u} />
                    ))}
                  </div>
                )}
              </section>
            </TabsContent>
          </Tabs>
        )
      )}
    </div>
  );
}

function EmptyState({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="text-center py-16 space-y-3">
      <div className="flex justify-center">{icon}</div>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="text-muted-foreground">{subtitle}</p>
    </div>
  );
}
