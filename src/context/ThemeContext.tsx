import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'dark' | 'light';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  isDark: boolean;
  // Opt-in preview of the refreshed dark theme
  darkRefresh: boolean;
  toggleDarkRefresh: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = localStorage.getItem('iwce-theme');
    return (stored as Theme) || 'dark';
  });

  const [darkRefresh, setDarkRefresh] = useState<boolean>(
    () => localStorage.getItem('iwce-dark-refresh') === 'on'
  );

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    root.classList.toggle('dark-refresh', theme === 'dark' && darkRefresh);
    localStorage.setItem('iwce-theme', theme);
    localStorage.setItem('iwce-dark-refresh', darkRefresh ? 'on' : 'off');
  }, [theme, darkRefresh]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  const toggleDarkRefresh = () => setDarkRefresh(prev => !prev);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, isDark: theme === 'dark', darkRefresh, toggleDarkRefresh }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
