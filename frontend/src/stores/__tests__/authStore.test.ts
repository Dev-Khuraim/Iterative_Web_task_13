import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock modules BEFORE importing the store
vi.mock('../../lib/api', () => ({
  api: {
    login: vi.fn(),
    googleAuth: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    getMe: vi.fn(),
  },
}));

vi.mock('../../lib/socket', () => ({
  socketClient: {
    connect: vi.fn(),
    disconnect: vi.fn(),
  },
}));

// Now import the store and get access to mocked modules
import { useAuthStore } from '../authStore';
import { api } from '../../lib/api';
import { socketClient } from '../../lib/socket';

const mockApi = api as {
  login: ReturnType<typeof vi.fn>;
  googleAuth: ReturnType<typeof vi.fn>;
  register: ReturnType<typeof vi.fn>;
  logout: ReturnType<typeof vi.fn>;
  getMe: ReturnType<typeof vi.fn>;
};

const mockSocketClient = socketClient as {
  connect: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
};

const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
};

Object.defineProperty(global, 'localStorage', {
  value: mockLocalStorage,
});

const sampleUser = {
  id: 'user-1',
  username: 'testuser',
  email: 'test@example.com',
  display_name: 'Test User',
  bio: null,
  avatar_url: null,
  cover_image_url: null,
  producer_type: 'Beat Maker',
  genres: [],
  website: null,
  soundcloud_url: null,
  spotify_url: null,
  is_online: true,
  created_at: new Date().toISOString(),
};

describe('authStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset store state
    useAuthStore.setState({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: true,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('login', () => {
    it('logs in user successfully', async () => {
      mockApi.login.mockResolvedValueOnce({ user: sampleUser, token: 'test-token' });

      const { login } = useAuthStore.getState();
      await login('test@example.com', 'password123');

      const state = useAuthStore.getState();
      expect(state.user).toEqual(sampleUser);
      expect(state.token).toBe('test-token');
      expect(state.isAuthenticated).toBe(true);
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('token', 'test-token');
      expect(mockSocketClient.connect).toHaveBeenCalledWith('test-token');
    });

    it('throws error on failed login', async () => {
      mockApi.login.mockRejectedValueOnce(new Error('Invalid credentials'));

      const { login } = useAuthStore.getState();
      await expect(login('test@example.com', 'wrong')).rejects.toThrow('Invalid credentials');

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
    });
  });

  describe('loginWithGoogle', () => {
    it('logs in with Google successfully', async () => {
      mockApi.googleAuth.mockResolvedValueOnce({ user: sampleUser, token: 'google-token' });

      const { loginWithGoogle } = useAuthStore.getState();
      await loginWithGoogle('google-id-token');

      const state = useAuthStore.getState();
      expect(state.user).toEqual(sampleUser);
      expect(state.token).toBe('google-token');
      expect(state.isAuthenticated).toBe(true);
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('token', 'google-token');
      expect(mockSocketClient.connect).toHaveBeenCalledWith('google-token');
    });

    it('throws error on failed Google login', async () => {
      mockApi.googleAuth.mockRejectedValueOnce(new Error('Google auth failed'));

      const { loginWithGoogle } = useAuthStore.getState();
      await expect(loginWithGoogle('invalid-token')).rejects.toThrow('Google auth failed');
    });
  });

  describe('register', () => {
    it('registers user successfully', async () => {
      mockApi.register.mockResolvedValueOnce({ user: sampleUser, token: 'new-token' });

      const { register } = useAuthStore.getState();
      await register({
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123',
        display_name: 'Test User',
        producer_type: 'Beat Maker',
      });

      const state = useAuthStore.getState();
      expect(state.user).toEqual(sampleUser);
      expect(state.token).toBe('new-token');
      expect(state.isAuthenticated).toBe(true);
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('token', 'new-token');
      expect(mockSocketClient.connect).toHaveBeenCalledWith('new-token');
    });

    it('throws error on failed registration', async () => {
      mockApi.register.mockRejectedValueOnce(new Error('Username taken'));

      const { register } = useAuthStore.getState();
      await expect(register({
        username: 'taken',
        email: 'test@example.com',
        password: 'password123',
      })).rejects.toThrow('Username taken');
    });
  });

  describe('logout', () => {
    it('logs out user successfully', async () => {
      mockApi.logout.mockResolvedValueOnce({ message: 'Logged out' });

      // Set initial authenticated state
      useAuthStore.setState({
        user: sampleUser,
        token: 'test-token',
        isAuthenticated: true,
      });

      const { logout } = useAuthStore.getState();
      await logout();

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.token).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('token');
      expect(mockSocketClient.disconnect).toHaveBeenCalled();
    });

    it('logs out even if API call fails', async () => {
      mockApi.logout.mockRejectedValueOnce(new Error('Network error'));

      useAuthStore.setState({
        user: sampleUser,
        token: 'test-token',
        isAuthenticated: true,
      });

      const { logout } = useAuthStore.getState();
      await logout();

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('token');
    });
  });

  describe('checkAuth', () => {
    it('authenticates user with valid token', async () => {
      mockLocalStorage.getItem.mockReturnValueOnce('stored-token');
      mockApi.getMe.mockResolvedValueOnce({ user: sampleUser });

      const { checkAuth } = useAuthStore.getState();
      await checkAuth();

      const state = useAuthStore.getState();
      expect(state.user).toEqual(sampleUser);
      expect(state.token).toBe('stored-token');
      expect(state.isAuthenticated).toBe(true);
      expect(state.isLoading).toBe(false);
      expect(mockSocketClient.connect).toHaveBeenCalledWith('stored-token');
    });

    it('sets isLoading false when no token', async () => {
      mockLocalStorage.getItem.mockReturnValueOnce(null);

      const { checkAuth } = useAuthStore.getState();
      await checkAuth();

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isLoading).toBe(false);
      expect(mockApi.getMe).not.toHaveBeenCalled();
    });

    it('clears auth on invalid token', async () => {
      mockLocalStorage.getItem.mockReturnValueOnce('invalid-token');
      mockApi.getMe.mockRejectedValueOnce(new Error('Invalid token'));

      const { checkAuth } = useAuthStore.getState();
      await checkAuth();

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.token).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isLoading).toBe(false);
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('token');
    });
  });

  describe('updateUser', () => {
    it('updates user data', () => {
      useAuthStore.setState({
        user: sampleUser,
        token: 'test-token',
        isAuthenticated: true,
      });

      const { updateUser } = useAuthStore.getState();
      updateUser({ display_name: 'Updated Name', bio: 'New bio' });

      const state = useAuthStore.getState();
      expect(state.user?.display_name).toBe('Updated Name');
      expect(state.user?.bio).toBe('New bio');
      expect(state.user?.username).toBe('testuser'); // Unchanged
    });

    it('does nothing when no user', () => {
      useAuthStore.setState({
        user: null,
        token: null,
        isAuthenticated: false,
      });

      const { updateUser } = useAuthStore.getState();
      updateUser({ display_name: 'New Name' });

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
    });
  });
});
