import { useEffect } from 'react';
import { usePostStore } from '@/stores/postStore';
import { PostCard } from '@/components/posts/PostCard';
import { QuickPost } from '@/components/posts/QuickPost';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw } from 'lucide-react';

export function Feed() {
  const { posts, isLoading, fetchFeed } = usePostStore();

  useEffect(() => {
    fetchFeed();
  }, [fetchFeed]);

  return (
    <div className="max-w-2xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Feed</h1>
        <Button variant="outline" size="sm" onClick={() => fetchFeed()}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Quick post composer */}
      <QuickPost />

      {/* Posts */}
      {isLoading && posts.length === 0 ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-beat-purple" />
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-beat-purple to-beat-pink flex items-center justify-center">
            <RefreshCw className="w-10 h-10 text-white" />
          </div>
          <h3 className="text-xl font-semibold mb-2">No posts yet</h3>
          <p className="text-muted-foreground">
            Be the first to share your beats!
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {posts.map((post, index) => (
            <PostCard
              key={post.is_repost ? `repost-${post.id}-${index}` : post.id}
              post={post}
              isRepost={post.is_repost}
              repostedBy={post.reposted_by || undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}
