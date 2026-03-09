import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import api from '../services/api';

interface User {
  id: number;
  username: string;
  email: string;
  role: 'admin' | 'reader';
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isGuest: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  loginAsGuest: () => void;
  logout: () => void;
  isAdmin: boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  // Persist login: token and guest flag are stored in localStorage so they survive page refresh and browser close
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'));
  const [isGuest, setIsGuest] = useState<boolean>(() => localStorage.getItem('isGuest') === 'true');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isGuest) {
      // Set guest user
      setUser({ id: 0, username: 'Guest', email: '', role: 'reader' });
      setIsLoading(false);
    } else if (token) {
      fetchUser();
    } else {
      setIsLoading(false);
    }
  }, [token, isGuest]);

  const fetchUser = async () => {
    try {
      const response = await api.get('/auth/me');
      setUser(response.data);
    } catch (error) {
      localStorage.removeItem('token');
      setToken(null);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (username: string, password: string) => {
    const response = await api.post('/auth/login', { username, password });
    const { access_token } = response.data;
    localStorage.removeItem('isGuest');
    localStorage.setItem('token', access_token);
    setToken(access_token);
    setIsGuest(false);
    await fetchUser();
  };

  const register = async (username: string, email: string, password: string) => {
    await api.post('/auth/register', { username, email, password });
    await login(username, password);
  };

  const loginAsGuest = () => {
    localStorage.setItem('isGuest', 'true');
    localStorage.removeItem('token');
    setIsGuest(true);
    setToken(null);
    setUser({ id: 0, username: 'Guest', email: '', role: 'reader' });
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('isGuest');
    setToken(null);
    setUser(null);
    setIsGuest(false);
  };

  const isAdmin = user?.role === 'admin';

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isGuest,
        login,
        register,
        loginAsGuest,
        logout,
        isAdmin,
        isLoading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
