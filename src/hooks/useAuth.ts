import { useState, useEffect } from 'react';

interface User {
  id: string;
  username: string;
  role: 'admin' | 'manager' | 'technician';
  name: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
    error: null,
  });

  // Check for existing session on mount
  useEffect(() => {
    const checkAuth = () => {
      try {
        const savedUser = localStorage.getItem('iwce_user');
        const savedSession = localStorage.getItem('iwce_session');
        
        if (savedUser && savedSession) {
          const user = JSON.parse(savedUser);
          const session = JSON.parse(savedSession);
          
          // Check if session is still valid (24 hours)
          const sessionAge = Date.now() - session.createdAt;
          if (sessionAge < 24 * 60 * 60 * 1000) {
            setAuthState({
              user,
              isAuthenticated: true,
              isLoading: false,
              error: null,
            });
          } else {
            // Session expired
            localStorage.removeItem('iwce_user');
            localStorage.removeItem('iwce_session');
            setAuthState({
              user: null,
              isAuthenticated: false,
              isLoading: false,
              error: null,
            });
          }
        } else {
          setAuthState({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,
          });
        }
      } catch (error) {
        console.error('Auth check failed:', error);
        setAuthState({
          user: null,
          isAuthenticated: false,
          isLoading: false,
          error: null,
        });
      }
    };

    checkAuth();
  }, []);

  const login = async (username: string, password: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      // Simulate API call delay
      setTimeout(() => {
        try {
          // Demo users - in production, this would be an API call
          const demoUsers: Record<string, { password: string; user: User }> = {
            admin: {
              password: 'admin123',
              user: {
                id: '1',
                username: 'admin',
                role: 'admin',
                name: 'System Administrator',
              },
            },
            manager: {
              password: 'manager123',
              user: {
                id: '2',
                username: 'manager',
                role: 'manager',
                name: 'Equipment Manager',
              },
            },
            tech: {
              password: 'tech123',
              user: {
                id: '3',
                username: 'tech',
                role: 'technician',
                name: 'Field Technician',
              },
            },
          };

          const userData = demoUsers[username.toLowerCase()];
          
          if (!userData || userData.password !== password) {
            const error = 'Invalid username or password';
            setAuthState(prev => ({ ...prev, error }));
            reject(new Error(error));
            return;
          }

          // Create session
          const session = {
            token: btoa(`${userData.user.id}:${Date.now()}`),
            createdAt: Date.now(),
          };

          // Save to localStorage
          localStorage.setItem('iwce_user', JSON.stringify(userData.user));
          localStorage.setItem('iwce_session', JSON.stringify(session));

          // Update state
          setAuthState({
            user: userData.user,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });

          resolve();
        } catch (error) {
          const errorMessage = 'Login failed. Please try again.';
          setAuthState(prev => ({ ...prev, error: errorMessage }));
          reject(new Error(errorMessage));
        }
      }, 1000); // Simulate network delay
    });
  };

  const logout = (): void => {
    try {
      localStorage.removeItem('iwce_user');
      localStorage.removeItem('iwce_session');
      setAuthState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const clearError = (): void => {
    setAuthState(prev => ({ ...prev, error: null }));
  };

  return {
    ...authState,
    login,
    logout,
    clearError,
  };
}
