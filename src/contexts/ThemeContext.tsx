import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type Theme = 'light' | 'dark';

interface ThemeColors {
  // Backgrounds
  bgPrimary: string;
  bgSecondary: string;
  bgTertiary: string;
  bgHover: string;
  
  // Text
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  
  // Bruins colors (consistent across themes)
  bruinsYellow: string;
  bruinsYellowLight: string;
  bruinsYellowDark: string;
  bruinsBlack: string;
  
  // Borders
  borderPrimary: string;
  borderSecondary: string;
  borderAccent: string;
  
  // Status colors
  statusDraft: string;
  statusSubmitted: string;
  statusRejected: string;
  statusLocked: string;
  
  // Interactive elements
  buttonPrimary: string;
  buttonPrimaryHover: string;
  buttonSecondary: string;
  buttonSecondaryHover: string;
  buttonDanger: string;
  buttonDangerHover: string;
  
  // Form elements
  inputBg: string;
  inputBorder: string;
  inputBorderFocus: string;
  inputText: string;
  inputDisabled: string;
}

const lightTheme: ThemeColors = {
  // Backgrounds
  bgPrimary: 'bg-white',
  bgSecondary: 'bg-gray-50',
  bgTertiary: 'bg-gray-100',
  bgHover: 'bg-gray-100',
  
  // Text
  textPrimary: 'text-gray-900',
  textSecondary: 'text-gray-700',
  textTertiary: 'text-gray-600',
  
  // Bruins colors
  bruinsYellow: 'text-yellow-600',
  bruinsYellowLight: 'text-yellow-500',
  bruinsYellowDark: 'text-yellow-700',
  bruinsBlack: 'text-black',
  
  // Borders
  borderPrimary: 'border-gray-300',
  borderSecondary: 'border-gray-200',
  borderAccent: 'border-yellow-500',
  
  // Status colors
  statusDraft: 'bg-gray-400',
  statusSubmitted: 'bg-green-600',
  statusRejected: 'bg-red-600',
  statusLocked: 'bg-orange-600',
  
  // Interactive elements
  buttonPrimary: 'bg-yellow-500',
  buttonPrimaryHover: 'hover:bg-yellow-400',
  buttonSecondary: 'bg-gray-300',
  buttonSecondaryHover: 'hover:bg-gray-400',
  buttonDanger: 'bg-red-600',
  buttonDangerHover: 'hover:bg-red-700',
  
  // Form elements
  inputBg: 'bg-white',
  inputBorder: 'border-gray-300',
  inputBorderFocus: 'focus:border-yellow-500',
  inputText: 'text-gray-900',
  inputDisabled: 'bg-gray-100',
};

const darkTheme: ThemeColors = {
  // Backgrounds
  bgPrimary: 'bg-black',
  bgSecondary: 'bg-gray-900',
  bgTertiary: 'bg-gray-800',
  bgHover: 'bg-yellow-900 bg-opacity-10',
  
  // Text
  textPrimary: 'text-yellow-100',
  textSecondary: 'text-yellow-200',
  textTertiary: 'text-yellow-600',
  
  // Bruins colors
  bruinsYellow: 'text-yellow-600',
  bruinsYellowLight: 'text-yellow-300',
  bruinsYellowDark: 'text-yellow-700',
  bruinsBlack: 'text-black',
  
  // Borders
  borderPrimary: 'border-yellow-700',
  borderSecondary: 'border-yellow-800',
  borderAccent: 'border-yellow-600',
  
  // Status colors
  statusDraft: 'bg-gray-600',
  statusSubmitted: 'bg-green-600',
  statusRejected: 'bg-red-600',
  statusLocked: 'bg-orange-600',
  
  // Interactive elements
  buttonPrimary: 'bg-yellow-600',
  buttonPrimaryHover: 'hover:bg-yellow-500',
  buttonSecondary: 'bg-gray-600',
  buttonSecondaryHover: 'hover:bg-gray-700',
  buttonDanger: 'bg-red-600',
  buttonDangerHover: 'hover:bg-red-700',
  
  // Form elements
  inputBg: 'bg-black',
  inputBorder: 'border-yellow-800',
  inputBorderFocus: 'focus:border-yellow-400',
  inputText: 'text-yellow-100',
  inputDisabled: 'bg-red-900 bg-opacity-20',
};

interface ThemeContextType {
  theme: Theme;
  themeColors: ThemeColors;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
  initialTheme?: Theme;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children, initialTheme = 'dark' }) => {
  const [theme, setThemeState] = useState<Theme>(initialTheme);

  useEffect(() => {
    // Load theme from localStorage on mount
    const savedTheme = localStorage.getItem('app-theme') as Theme;
    if (savedTheme && (savedTheme === 'light' || savedTheme === 'dark')) {
      setThemeState(savedTheme);
    }
  }, []);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem('app-theme', newTheme);
  };

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
  };

  const themeColors = theme === 'light' ? lightTheme : darkTheme;

  return (
    <ThemeContext.Provider value={{ theme, themeColors, setTheme, toggleTheme }}>
      <div className={theme === 'light' ? 'bg-white min-h-screen' : 'bg-black min-h-screen'}>
        {children}
      </div>
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
