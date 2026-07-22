import React, { createContext, useContext, useState, useEffect } from 'react';

export interface User {
  id: string;
  username: string;
  fullName: string;
  role: 'MANAGER' | 'STAFF' | 'RECEPTIONIST';
  assignedStations: string[];
  stationPrepTimes?: Record<string, number>;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  hasStationAccess: (stationId: string) => boolean;
  isPathAllowed: (path: string) => boolean;
  authFetch: (url: string, options?: RequestInit) => Promise<Response>;
}

const SESSION_STORAGE_USER_KEY = 'ticketflow_auth_user';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const saved = sessionStorage.getItem(SESSION_STORAGE_USER_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [isLoading, setIsLoading] = useState<boolean>(false);

  const login = async (username: string, password: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      const res = await fetch('http://localhost:4000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) {
        setIsLoading(false);
        return false;
      }

      const data = await res.json();
      if (data.user) {
        setUser(data.user);
        sessionStorage.setItem(SESSION_STORAGE_USER_KEY, JSON.stringify(data.user));
        setIsLoading(false);
        return true;
      }
    } catch (err) {
      console.error('[AuthContext] Login error:', err);
    }
    setIsLoading(false);
    return false;
  };

  const logout = () => {
    setUser(null);
    sessionStorage.removeItem(SESSION_STORAGE_USER_KEY);
    try {
      window.history.pushState({}, '', '/');
      window.dispatchEvent(new PopStateEvent('popstate'));
    } catch (err) {
      console.error('[AuthContext] Navigation reset failed:', err);
    }
  };

  const hasStationAccess = (stationId: string): boolean => {
    if (!user) return false;
    if (user.role === 'MANAGER') return true;
    if (user.role === 'RECEPTIONIST') return stationId === 'intake';
    return user.assignedStations.includes(stationId);
  };

  const isPathAllowed = (path: string): boolean => {
    if (!user) return false;
    if (user.role === 'MANAGER') return true;

    // Normalize path to exclude query parameters and handle root
    const normalizedPath = path.split('?')[0];
    const normPath = normalizedPath === '/' ? '' : normalizedPath;

    if (normPath === '/help') return true;

    if (user.role === 'RECEPTIONIST') {
      return normPath === '/intake';
    }

    if (user.role === 'STAFF') {
      // Station-specific views
      const stationMap: Record<string, string> = {
        '/intake': 'intake',
        '/prep': 'prep',
        '/grill': 'grill',
        '/assembly': 'assembly',
        '/expedite': 'expedite',
      };

      const stationId = stationMap[normPath];
      if (stationId) {
        return user.assignedStations.includes(stationId);
      }
      return false;
    }

    return false;
  };

  const authFetch = async (url: string, options: RequestInit = {}): Promise<Response> => {
    const headers = new Headers(options.headers || {});
    if (user) {
      headers.set('x-user-id', user.id);
      headers.set('x-user-role', user.role);
    }
    return fetch(url, { ...options, headers });
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, hasStationAccess, isPathAllowed, authFetch }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
