import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useChatStore } from '@/stores/chatStore';
import { api } from '@/lib/api';
import { getInitials } from '@/lib/utils';
import type { Friendship } from '@/types';
import { Users, Check, X, Loader2, Search } from 'lucide-react';

interface CreateGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateGroupDialog({ open, onOpenChange }: CreateGroupDialogProps) {
  const { openConversation, selectConversation } = useChatStore();

  const [groupName, setGroupName] = useState('');
  const [groupNameError, setGroupNameError] = useState('');
  const [friends, setFriends] = useState<Friendship[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (open) {
      loadFriends();
      setGroupName('');
      setSelectedIds(new Set());
      setSearchQuery('');
    }
  }, [open]);

  const loadFriends = async () => {
    setIsLoading(true);
    try {
      const { friends } = await api.getFriends();
      setFriends(friends);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSelection = (userId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  const handleCreate = async () => {
    if (selectedIds.size === 0) return;
    const trimmed = groupName.trim();
    if (!trimmed) { setGroupNameError('Group name is required.'); return; }
    if (trimmed.length < 3) { setGroupNameError('Group name must be at least 3 characters.'); return; }
    if (trimmed.length > 100) { setGroupNameError('Group name must be at most 100 characters.'); return; }
    setGroupNameError('');

    setIsCreating(true);
    try {
      const conversation = await openConversation(
        Array.from(selectedIds),
        true,
        groupName.trim()
      );
      selectConversation(conversation);
      onOpenChange(false);
    } finally {
      setIsCreating(false);
    }
  };

  const filteredFriends = friends.filter((f) => {
    if (!searchQuery) return true;
    const friend = f.friend;
    if (!friend) return false;
    const query = searchQuery.toLowerCase();
    return (
      friend.username.toLowerCase().includes(query) ||
      (friend.display_name?.toLowerCase().includes(query) ?? false)
    );
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Group</DialogTitle>
          <DialogDescription>
            Create a group to communicate with multiple friends at once.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Group Name */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">Group Name <span className="text-destructive">*</span></label>
            <Input
              value={groupName}
              onChange={(e) => { setGroupName(e.target.value); setGroupNameError(''); }}
              placeholder="Enter group name..."
              className={groupNameError ? 'border-destructive' : ''}
            />
            {groupNameError
              ? <p className="text-xs text-destructive mt-1">{groupNameError}</p>
              : <p className="text-xs text-muted-foreground mt-1">At least 3 characters.</p>}
          </div>

          {/* Selected Members */}
          {selectedIds.size > 0 && (
            <div>
              <label className="text-sm font-medium mb-1.5 block">
                Selected ({selectedIds.size})
              </label>
              <div className="flex flex-wrap gap-2">
                {friends
                  .filter((f) => f.friend && selectedIds.has(f.friend.id))
                  .map((f) => {
                    const friend = f.friend!;
                    return (
                      <div
                        key={friend.id}
                        className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-beat-purple/20 text-sm"
                      >
                        <Avatar className="w-5 h-5">
                          <AvatarImage src={friend.avatar_url || undefined} />
                          <AvatarFallback className="text-[10px]">
                            {getInitials(friend.display_name || friend.username)}
                          </AvatarFallback>
                        </Avatar>
                        <span>{friend.display_name || friend.username}</span>
                        <button
                          onClick={() => toggleSelection(friend.id)}
                          className="hover:text-destructive"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Search Friends */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search friends..."
              className="pl-9"
            />
          </div>

          {/* Friends List */}
          <ScrollArea className="h-[200px]">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-beat-purple" />
              </div>
            ) : filteredFriends.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>{searchQuery ? 'No friends match your search' : 'No friends to add'}</p>
              </div>
            ) : (
              <div className="space-y-1">
                {filteredFriends.map((friendship) => {
                  const friend = friendship.friend;
                  if (!friend) return null;
                  const isSelected = selectedIds.has(friend.id);
                  return (
                    <button
                      key={friendship.id}
                      onClick={() => toggleSelection(friend.id)}
                      className={`w-full flex items-center gap-3 p-2 rounded-lg transition-colors text-left ${
                        isSelected ? 'bg-beat-purple/10 border border-beat-purple/30' : 'hover:bg-secondary'
                      }`}
                    >
                      <Avatar className="w-10 h-10">
                        <AvatarImage src={friend.avatar_url || undefined} />
                        <AvatarFallback>
                          {getInitials(friend.display_name || friend.username)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">
                          {friend.display_name || friend.username}
                        </p>
                        <p className="text-sm text-muted-foreground truncate">
                          @{friend.username}
                        </p>
                      </div>
                      {isSelected && (
                        <div className="w-6 h-6 rounded-full bg-beat-purple flex items-center justify-center">
                          <Check className="w-4 h-4 text-white" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </ScrollArea>

          {/* Create Button */}
          <Button
            onClick={handleCreate}
            disabled={selectedIds.size === 0 || isCreating}
            className="w-full"
          >
            {isCreating ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Users className="w-4 h-4 mr-2" />
            )}
            Create Group ({selectedIds.size} member{selectedIds.size !== 1 ? 's' : ''})
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
