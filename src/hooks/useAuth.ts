import { useState, useEffect } from 'react';
import { userManagementService, AppUser } from '../services/userManagementService';

interface User {
  id: string;
  username: string;
  role: 'admin' | 'field';
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
    const checkAuth = async () => {
      try {
        const savedUser = localStorage.getItem('iwce_user');
        const savedSession = localStorage.getItem('iwce_session');
        
        if (savedUser && savedSession) {
          const user = JSON.parse(savedUser);
          const session = JSON.parse(savedSession);
          
          // Check if session is still valid (24 hours)
          const sessionAge = Date.now() - session.createdAt;
          if (sessionAge < 24 * 60 * 60 * 1000) {
            // Verify user still exists and is active
            const currentUser = await userManagementService.getUserByUsername(user.username);
            if (currentUser && currentUser.isActive) {
              setAuthState({
                user,
                isAuthenticated: true,
                isLoading: false,
                error: null,
              });
            } else {
              // User no longer exists or is inactive
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
    return new Promise(async (resolve, reject) => {
      try {
        // Get user from Firebase
        const userRecord = await userManagementService.getUserByUsername(username);
        
        if (!userRecord) {
          const error = 'Invalid username or password';
          setAuthState(prev => ({ ...prev, error }));
          reject(new Error(error));
          return;
        }

        // Check password (in production, use proper password hashing)
        if (userRecord.password !== password) {
          const error = 'Invalid username or password';
          setAuthState(prev => ({ ...prev, error }));
          reject(new Error(error));
          return;
        }

        // Check if user is active
        if (!userRecord.isActive) {
          const error = 'Account has been deactivated';
          setAuthState(prev => ({ ...prev, error }));
          reject(new Error(error));
          return;
        }

        // Create session
        const session = {
          createdAt: Date.now(),
        };

        // Save to localStorage
        const user: User = {
          id: userRecord.id,
          username: userRecord.username,
          role: userRecord.role === 'technician' ? 'field' : userRecord.role,
          name: userRecord.name,
        };

        localStorage.setItem('iwce_user', JSON.stringify(user));
        localStorage.setItem('iwce_session', JSON.stringify(session));

        // Update state
        setAuthState({
          user,
          isAuthenticated: true,
          isLoading: false,
          error: null,
        });

        resolve();
      } catch (error) {
        console.error('Login failed:', error);
        const errorMessage = error instanceof Error ? error.message : 'Login failed';
        setAuthState(prev => ({ ...prev, error: errorMessage }));
        reject(new Error(errorMessage));
      }
    });
  };

  const logout = () => {
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

  // Initialize default users if needed (only for initial setup)
  useEffect(() => {
    const initializeUsers = async () => {
      try {
        await userManagementService.initializeDefaultUsers();
      } catch (error) {
        console.error('Failed to initialize default users:', error);
      }
    };

    initializeUsers();
  }, []);

  const clearError = (): void => {
    setAuthState(prev => ({ ...prev, error: null }));
  };

  return {
    user: authState.user,
    isAuthenticated: authState.isAuthenticated,
    isLoading: authState.isLoading,
    error: authState.error,
    login,
    logout,
    clearError,
  };
}
