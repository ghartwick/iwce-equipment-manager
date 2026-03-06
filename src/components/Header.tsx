import { useState } from 'react';
import { Plus, Bell, User, LogOut, ChevronDown, Menu } from 'lucide-react';

interface User {
  id: string;
  username: string;
  role: 'admin' | 'manager' | 'technician';
  name: string;
}

interface HeaderProps {
  onAddProduct: () => void;
  alertCount: number;
  onToggleAlerts: () => void;
  user: User | null;
  onLogout: () => void;
}

export function Header({ user, onAddProduct, onToggleAlerts, alertCount, onLogout }: HeaderProps) {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  const getRoleDisplay = (role: string) => {
    switch (role) {
      case 'admin':
        return 'Administrator';
      case 'manager':
        return 'Manager';
      case 'technician':
        return 'Technician';
      default:
        return role;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'text-red-400';
      case 'manager':
        return 'text-yellow-400';
      case 'technician':
        return 'text-green-400';
      default:
        return 'text-yellow-400';
    }
  };

  return (
    <header className="bg-black border-b border-yellow-600">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-3">
            <img 
              src="/top-left-logo.png" 
              alt="IWCE Logo" 
              className="h-6 w-6 sm:h-8 sm:w-8"
            />
            <h1 className="text-lg sm:text-xl font-semibold text-yellow-400">IWCE Equipment</h1>
          </div>
          
          {/* Mobile Menu Toggle */}
          <button
            onClick={() => setShowMobileMenu(!showMobileMenu)}
            className="p-2 text-yellow-400 hover:text-yellow-300 lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Mobile Alert Icon */}
          <button
            onClick={onToggleAlerts}
            className="relative p-2 text-yellow-400 hover:text-yellow-300 lg:hidden"
          >
            <Bell className="h-5 w-5" />
            {alertCount > 0 && (
              <span className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                {alertCount}
              </span>
            )}
          </button>

          {/* Desktop Actions */}
          <div className="hidden lg:flex items-center space-x-2">
            <button
              onClick={onAddProduct}
              className="p-2 bg-yellow-500 text-black rounded-lg hover:bg-yellow-400 transition-colors"
              title="Add Equipment"
            >
              <Plus className="h-4 w-4" />
            </button>
            
            <button
              onClick={onToggleAlerts}
              className="relative p-2 text-yellow-400 hover:text-yellow-300 transition-colors"
            >
              <Bell className="h-5 w-5" />
              {alertCount > 0 && (
                <span className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                  {alertCount}
                </span>
              )}
            </button>

            {/* User Menu */}
            {user && (
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center space-x-2 p-2 bg-yellow-900 bg-opacity-30 rounded-lg hover:bg-opacity-50 transition-colors"
                  title="User Menu"
                >
                  <User className="h-4 w-4 text-yellow-400" />
                  <ChevronDown className="h-3 w-3 text-yellow-400" />
                </button>

                {showUserMenu && (
                  <div className="absolute right-0 mt-2 w-64 bg-black border border-yellow-600 rounded-lg shadow-lg z-50">
                    <div className="p-4 border-b border-yellow-800">
                      <div className="flex items-center space-x-3">
                        <div className="h-10 w-10 bg-yellow-600 rounded-full flex items-center justify-center">
                          <User className="h-5 w-5 text-black" />
                        </div>
                        <div>
                          <p className="text-yellow-100 font-medium">{user.name}</p>
                          <p className={`text-xs ${getRoleColor(user.role)}`}>
                            {getRoleDisplay(user.role)}
                          </p>
                          <p className="text-xs text-yellow-600">@{user.username}</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="p-2">
                      <button
                        onClick={onLogout}
                        className="w-full flex items-center space-x-2 px-3 py-2 text-yellow-300 hover:bg-yellow-900 hover:bg-opacity-30 rounded-lg transition-colors"
                      >
                        <LogOut className="h-4 w-4" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Mobile Menu */}
        {showMobileMenu && (
          <div className="lg:hidden border-t border-yellow-800">
            <div className="px-4 py-4 space-y-3">
              <button
                onClick={() => { onAddProduct(); setShowMobileMenu(false); }}
                className="flex items-center space-x-3 w-full p-3 bg-yellow-900 bg-opacity-50 border border-yellow-600 text-yellow-300 rounded-lg hover:bg-opacity-70 transition-colors"
              >
                <Plus className="h-5 w-5" />
                <span>Add Equipment</span>
              </button>
              {user && (
                <button
                  onClick={() => { onLogout(); setShowMobileMenu(false); }}
                  className="flex items-center space-x-3 w-full p-3 bg-yellow-900 bg-opacity-50 border border-yellow-600 text-yellow-300 rounded-lg hover:bg-opacity-70 transition-colors"
                >
                  <LogOut className="h-5 w-5" />
                  <span>Logout</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Click outside to close menu */}
      {showUserMenu && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowUserMenu(false)}
        />
      )}
    </header>
  );
}
