import { useState } from 'react';
import { X, Sun, Moon } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { User } from '../services/timecardService';

interface UserSettingsProps {
  onClose: () => void;
  currentUser: User;
  onThemeChange?: (theme: 'light' | 'dark') => void;
}

export function UserSettings({ onClose, currentUser, onThemeChange }: UserSettingsProps) {
  const { theme, setTheme, themeColors } = useTheme();
  const [selectedTheme, setSelectedTheme] = useState<'light' | 'dark'>(theme);

  const handleThemeChange = (newTheme: 'light' | 'dark') => {
    setSelectedTheme(newTheme);
    setTheme(newTheme);
    if (onThemeChange) {
      onThemeChange(newTheme);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className={`${themeColors.bgPrimary} border ${themeColors.borderAccent} rounded-lg shadow-xl max-w-md w-full mx-4`}>
        {/* Header */}
        <div className={`${themeColors.bgSecondary} px-6 py-4 border-b ${themeColors.borderPrimary} flex justify-between items-center`}>
          <h2 className={`text-xl font-semibold ${themeColors.bruinsYellowLight}`}>User Settings</h2>
          <button
            onClick={onClose}
            className={`${themeColors.bruinsYellow} hover:${themeColors.bruinsYellowLight} transition-colors`}
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* User Info */}
          <div>
            <h3 className={`text-sm font-medium ${themeColors.bruinsYellow} mb-2`}>User Information</h3>
            <div className="space-y-2">
              <div>
                <span className={`text-sm ${themeColors.textTertiary}`}>Name: </span>
                <span className={`text-sm ${themeColors.textPrimary}`}>{currentUser.name}</span>
              </div>
              <div>
                <span className={`text-sm ${themeColors.textTertiary}`}>Username: </span>
                <span className={`text-sm ${themeColors.textPrimary}`}>{currentUser.username}</span>
              </div>
              <div>
                <span className={`text-sm ${themeColors.textTertiary}`}>Role: </span>
                <span className={`text-sm ${themeColors.textPrimary} capitalize`}>{currentUser.role}</span>
              </div>
            </div>
          </div>

          {/* Theme Selection */}
          <div>
            <h3 className={`text-sm font-medium ${themeColors.bruinsYellow} mb-3`}>Theme Preference</h3>
            <div className="grid grid-cols-2 gap-3">
              {/* Light Theme Option */}
              <button
                onClick={() => handleThemeChange('light')}
                className={`p-4 rounded-lg border-2 transition-all ${
                  selectedTheme === 'light'
                    ? 'border-yellow-500 bg-yellow-50'
                    : theme === 'light'
                    ? 'border-gray-300 bg-white hover:border-yellow-400'
                    : 'border-yellow-700 bg-gray-900 hover:border-yellow-500'
                }`}
              >
                <div className="flex flex-col items-center space-y-2">
                  <Sun className={`h-8 w-8 ${selectedTheme === 'light' ? 'text-yellow-600' : theme === 'light' ? 'text-gray-600' : 'text-yellow-600'}`} />
                  <span className={`text-sm font-medium ${selectedTheme === 'light' ? 'text-yellow-700' : theme === 'light' ? 'text-gray-900' : 'text-yellow-300'}`}>
                    Light
                  </span>
                  {selectedTheme === 'light' && (
                    <span className="text-xs text-yellow-600">Active</span>
                  )}
                </div>
              </button>

              {/* Dark Theme Option */}
              <button
                onClick={() => handleThemeChange('dark')}
                className={`p-4 rounded-lg border-2 transition-all ${
                  selectedTheme === 'dark'
                    ? 'border-yellow-500 bg-gray-800'
                    : theme === 'light'
                    ? 'border-gray-300 bg-white hover:border-yellow-400'
                    : 'border-yellow-700 bg-gray-900 hover:border-yellow-500'
                }`}
              >
                <div className="flex flex-col items-center space-y-2">
                  <Moon className={`h-8 w-8 ${selectedTheme === 'dark' ? 'text-yellow-400' : theme === 'light' ? 'text-gray-600' : 'text-yellow-600'}`} />
                  <span className={`text-sm font-medium ${selectedTheme === 'dark' ? 'text-yellow-300' : theme === 'light' ? 'text-gray-900' : 'text-yellow-300'}`}>
                    Dark
                  </span>
                  {selectedTheme === 'dark' && (
                    <span className="text-xs text-yellow-400">Active</span>
                  )}
                </div>
              </button>
            </div>
            <p className={`text-xs ${themeColors.textTertiary} mt-2`}>
              Choose your preferred theme. Changes apply immediately.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className={`${themeColors.bgSecondary} px-6 py-4 border-t ${themeColors.borderPrimary} flex justify-end`}>
          <button
            onClick={onClose}
            className={`px-4 py-2 ${themeColors.buttonPrimary} text-black rounded-lg ${themeColors.buttonPrimaryHover} transition-colors font-medium`}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
