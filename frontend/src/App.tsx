import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { MainLayout } from '@/components/layout/MainLayout';
import { Toaster } from '@/components/ui/toaster';
import { Auth } from '@/pages/Auth';
import { Feed } from '@/pages/Feed';
import { Discover } from '@/pages/Discover';
import { Messages } from '@/pages/Messages';
import { Notifications } from '@/pages/Notifications';
import { Friends } from '@/pages/Friends';
import { VoiceRooms } from '@/pages/VoiceRooms';
import { Profile } from '@/pages/Profile';
import { CreatePost } from '@/pages/CreatePost';
import { PostDetail } from '@/pages/PostDetail';
import { Groups } from '@/pages/Groups';
import { Loader2 } from 'lucide-react';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-vinyl-dark">
        <Loader2 className="w-8 h-8 animate-spin text-beat-purple" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-vinyl-dark">
        <Loader2 className="w-8 h-8 animate-spin text-beat-purple" />
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

export function App() {
  const { checkAuth } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route
          path="/auth"
          element={
            <PublicRoute>
              <Auth />
            </PublicRoute>
          }
        />

        {/* Protected Routes */}
        <Route
          element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/" element={<Feed />} />
          <Route path="/discover" element={<Discover />} />
          <Route path="/messages" element={<Messages />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/friends" element={<Friends />} />
          <Route path="/voice-rooms" element={<VoiceRooms />} />
          <Route path="/groups" element={<Groups />} />
          <Route path="/profile/:userId" element={<Profile />} />
          <Route path="/post/:postId" element={<PostDetail />} />
          <Route path="/create" element={<CreatePost />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <Toaster />
    </BrowserRouter>
  );
}
