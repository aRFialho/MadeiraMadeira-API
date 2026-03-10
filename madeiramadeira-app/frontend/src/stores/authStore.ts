import { create } from 'zustand';
import { User } from '../types';

interface AuthStore {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  setUser: (user: User | null, token: string | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  // Initialize with a dummy user to simulate logged-in state
  user: { userId: '1', username: 'admin', email: 'admin@madeiramadeira.com.br' } as User,
  token: 'dummy-token',
  isLoading: false,
  setUser: (user, token) => {
    if (user && token) {
      localStorage.setItem('user', JSON.stringify(user));
      localStorage.setItem('token', token);
    }
    set({ user, token });
  },
  logout: () => {
    // Logout is disabled/noop in no-auth mode
    console.log('Logout disabled');
  },
}));
