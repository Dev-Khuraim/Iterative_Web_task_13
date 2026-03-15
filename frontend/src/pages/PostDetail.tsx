import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { PostCard } from '@/components/posts/PostCard';
import { usePostStore } from '@/stores/postStore';
import { useAuthStore } from '@/stores/authStore';
import { api } from '@/lib/api';
import { formatTimeAgo, getInitials } from '@/lib/utils';
import type { Comment } from '@/types';
import { Send, ArrowLeft, MessageCircle, Reply, Loader2 } from 'lucide-react';

export function PostDetail() {
  const { postId } = useParams<{ postId: string }>();
  const { user } = useAuthStore();
  const { currentPost, fetchPost, addComment, isLoading: postLoading } = usePostStore();

  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [commentsLoading, setCommentsLoading] = useState(true);

  useEffect(() => {
    if (postId) {
      fetchPost(postId);
      loadComments(postId);
    }
  }, [postId, fetchPost]);

  const loadComments = async (id: string) => {
    setCommentsLoading(true);
    try {
      const { comments } = await api.getComments(id);
      setComments(comments);
    } finally {
      setCommentsLoading(false);
    }
  };

  const handleSubmitComment = async () => {
    if (!commentText.trim() || !postId || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const comment = await addComment(postId, {
        content: commentText.trim(),
        parent_id: replyTo?.id,
      });

      if (replyTo) {
        setComments((prev) =>
          prev.map((c) =>
            c.id === replyTo.id
              ? { ...c, replies: [...(c.replies || []), comment] }
              : c
          )
        );
      } else {
        setComments((prev) => [...prev, { ...comment, replies: [] }]);
      }

      setCommentText('');
      setReplyTo(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmitComment();
    }
  };

  if (postLoading || !currentPost) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-beat-purple" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <Link to="/">
        <Button variant="ghost" size="sm" className="mb-4 gap-2">
          <ArrowLeft className="w-4 h-4" />
          Back to Feed
        </Button>
      </Link>

      <PostCard post={currentPost} />

      {/* Comments Section */}
      <div className="mt-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <MessageCircle className="w-5 h-5" />
          Comments ({currentPost.comments_count || 0})
        </h3>

        {/* Comment Input */}
        <div className="mb-6">
          {replyTo && (
            <div className="mb-2 px-3 py-2 rounded-lg bg-secondary flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Replying to <span className="font-medium text-foreground">{replyTo.user?.display_name || replyTo.user?.username}</span>
              </span>
              <Button variant="ghost" size="sm" onClick={() => setReplyTo(null)}>
                Cancel
              </Button>
            </div>
          )}
          <div className="flex gap-2">
            <Avatar className="w-8 h-8">
              <AvatarImage src={user?.avatar_url || undefined} />
              <AvatarFallback>{getInitials(user?.display_name || null)}</AvatarFallback>
            </Avatar>
            <div className="flex-1 flex gap-2">
              <Input
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={replyTo ? `Reply to ${replyTo.user?.display_name || replyTo.user?.username}...` : 'Write a comment...'}
                className="flex-1"
              />
              <Button onClick={handleSubmitComment} disabled={!commentText.trim() || isSubmitting} size="icon">
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Comments List */}
        {commentsLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-beat-purple" />
          </div>
        ) : comments.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No comments yet. Be the first to comment!
          </div>
        ) : (
          <div className="space-y-4">
            {comments.map((comment) => (
              <CommentItem
                key={comment.id}
                comment={comment}
                onReply={(c) => setReplyTo(c)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface CommentItemProps {
  comment: Comment;
  onReply: (comment: Comment) => void;
  isReply?: boolean;
}

function CommentItem({ comment, onReply, isReply = false }: CommentItemProps) {
  return (
    <div className={isReply ? 'ml-10' : ''}>
      <div className="flex gap-3">
        <Link to={`/profile/${comment.user?.id}`}>
          <Avatar className={isReply ? 'w-7 h-7' : 'w-8 h-8'}>
            <AvatarImage src={comment.user?.avatar_url || undefined} />
            <AvatarFallback>{getInitials(comment.user?.display_name || null)}</AvatarFallback>
          </Avatar>
        </Link>
        <div className="flex-1">
          <div className="rounded-xl bg-secondary px-4 py-2">
            <Link to={`/profile/${comment.user?.id}`} className="hover:underline">
              <p className="font-medium text-sm">
                {comment.user?.display_name || comment.user?.username}
              </p>
            </Link>
            <p className="text-sm whitespace-pre-wrap">{comment.content}</p>
          </div>
          <div className="flex items-center gap-4 mt-1 px-2">
            <span className="text-xs text-muted-foreground">
              {formatTimeAgo(comment.created_at)}
            </span>
            <button
              onClick={() => onReply(comment)}
              className="text-xs text-muted-foreground hover:text-beat-purple flex items-center gap-1"
            >
              <Reply className="w-3 h-3" />
              Reply
            </button>
          </div>

          {/* Replies */}
          {comment.replies && comment.replies.length > 0 && (
            <div className="mt-2 space-y-2">
              {comment.replies.map((reply) => (
                <CommentItem key={reply.id} comment={reply} onReply={onReply} isReply />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
