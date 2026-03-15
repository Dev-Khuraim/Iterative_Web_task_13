import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';
import { useNotificationStore } from '@/stores/notificationStore';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { getInitials } from '@/lib/utils';
import {
  Home,
  Search,
  MessageCircle,
  Bell,
  Users,
  UsersRound,
  Mic,
  PlusCircle,
  User,
  LogOut,
  Music,
} from 'lucide-react';

const navItems = [
  { icon: Home, label: 'Feed', path: '/' },
  { icon: Search, label: 'Discover', path: '/discover' },
  { icon: MessageCircle, label: 'Messages', path: '/messages' },
  { icon: Bell, label: 'Notifications', path: '/notifications' },
  { icon: Users, label: 'Friends', path: '/friends' },
  { icon: Mic, label: 'Voice Rooms', path: '/voice-rooms' },
  { icon: UsersRound, label: 'Groups', path: '/groups' },
];

export function Sidebar() {
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const { notificationOnlyCount, friendRequestCount, messageCount } = useNotificationStore();

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r border-border bg-card flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-border">
        <Link to="/" className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-beat-purple to-beat-pink flex items-center justify-center">
            <Music className="w-6 h-6 text-white" />
          </div>
          <span className="text-xl font-bold music-gradient-text">BeatConnect</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;

          // Determine badge count per nav item
          let badgeCount = 0;
          if (item.label === 'Notifications') badgeCount = notificationOnlyCount;
          else if (item.label === 'Friends') badgeCount = friendRequestCount;
          else if (item.label === 'Messages') badgeCount = messageCount;
          const showBadge = badgeCount > 0;

          return (
            <Link key={item.path} to={item.path}>
              <Button
                variant={isActive ? 'default' : 'ghost'}
                className={cn(
                  'w-full justify-start gap-3 relative',
                  isActive && 'glow-purple'
                )}
              >
                <Icon className="w-5 h-5" />
                {item.label}
                {showBadge && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 bg-beat-pink text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {badgeCount > 9 ? '9+' : badgeCount}
                  </span>
                )}
              </Button>
            </Link>
          );
        })}

        {/* Create Post Button */}
        <Link to="/create">
          <Button className="w-full mt-4">
            <PlusCircle className="w-5 h-5 mr-2" />
            Create Post
          </Button>
        </Link>
      </nav>

      {/* User Section */}
      <div className="p-4 border-t border-border">
        <Link
          to={`/profile/${user?.id}`}
          className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary transition-colors"
        >
          <Avatar>
            <AvatarImage src={user?.avatar_url || undefined} />
            <AvatarFallback>{getInitials(user?.display_name || user?.username || null)}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">{user?.display_name || user?.username}</p>
            <p className="text-sm text-muted-foreground truncate">@{user?.username}</p>
          </div>
        </Link>

        <div className="flex gap-2 mt-3">
          <Link to={`/profile/${user?.id}`} className="flex-1">
            <Button variant="outline" size="sm" className="w-full">
              <User className="w-4 h-4 mr-2" />
              Profile
            </Button>
          </Link>
          <Button variant="outline" size="sm" onClick={logout}>
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </aside>
  );
}
