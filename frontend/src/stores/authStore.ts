import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '../types';
import { api } from '../lib/api';
import { socketClient } from '../lib/socket';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: (idToken: string) => Promise<void>;
  register: (data: { username: string; email: string; password: string; display_name?: string; producer_type?: string }) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  updateUser: (user: Partial<User>) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: true,

      login: async (email, password) => {
        const { user, token } = await api.login({ email, password });
        localStorage.setItem('token', token);
        socketClient.connect(token);
        set({ user, token, isAuthenticated: true });
      },

      loginWithGoogle: async (idToken) => {
        const { user, token } = await api.googleAuth(idToken);
        localStorage.setItem('token', token);
        socketClient.connect(token);
        set({ user, token, isAuthenticated: true });
      },

      register: async (data) => {
        const { user, token } = await api.register(data);
        localStorage.setItem('token', token);
        socketClient.connect(token);
        set({ user, token, isAuthenticated: true });
      },

      logout: async () => {
        try {
          await api.logout();
        } catch {
          // Ignore errors during logout
        }
        localStorage.removeItem('token');
        socketClient.disconnect();
        set({ user: null, token: null, isAuthenticated: false });
      },

      checkAuth: async () => {
        const token = localStorage.getItem('token');
        if (!token) {
          set({ isLoading: false, isAuthenticated: false });
          return;
        }

        try {
          const { user } = await api.getMe();
          socketClient.connect(token);
          set({ user, token, isAuthenticated: true, isLoading: false });
        } catch {
          localStorage.removeItem('token');
          set({ user: null, token: null, isAuthenticated: false, isLoading: false });
        }
      },

      updateUser: (userData) => {
        const currentUser = get().user;
        if (currentUser) {
          set({ user: { ...currentUser, ...userData } });
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ token: state.token }),
    }
  )
);
