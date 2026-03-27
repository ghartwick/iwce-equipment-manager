import { useState } from 'react';
import { Plus, Bell, User, LogOut, ChevronDown, Menu, Trash2 } from 'lucide-react';
import { deleteEquipment, getEquipment } from '../services/firebaseService';
import { getCategories } from '../services/firebaseService';

interface User {
  id: string;
  username: string;
  role: 'admin' | 'supervisor' | 'field';
  name: string;
}

interface HeaderProps {
  onAddProduct: () => void;
  alertCount: number;
  onToggleAlerts: () => void;
  user: User | null;
  onLogout: () => void;
  onRefresh?: () => void;
}

export function Header({ user, onAddProduct, onToggleAlerts, alertCount, onLogout, onRefresh }: HeaderProps) {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const getRoleDisplay = (role: string) => {
    switch (role) {
      case 'admin':
        return 'Administrator';
      case 'field':
        return 'Field';
      default:
        return role;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'text-red-400';
      case 'field':
        return 'text-green-400';
      default:
        return 'text-yellow-400';
    }
  };

  const handleDeleteOrphanedEquipment = async () => {
    if (!user || user.role !== 'admin') {
      alert('Only administrators can perform this action.');
      return;
    }

    if (!confirm('Are you sure you want to delete all equipment entries that do not belong to a valid category? This action cannot be undone.')) {
      return;
    }

    setIsDeleting(true);
    try {
      const [allEquipment, allCategories] = await Promise.all([
        getEquipment(),
        getCategories()
      ]);

      const validCategoryIds = new Set(allCategories.map(cat => cat.id));
      const orphanedEquipment = allEquipment.filter(eq => !validCategoryIds.has(eq.category || ''));

      if (orphanedEquipment.length === 0) {
        alert('No orphaned equipment found. All equipment entries have valid categories.');
        return;
      }

      const deletePromises = orphanedEquipment.map(eq => deleteEquipment(eq.id));
      await Promise.all(deletePromises);

      alert(`Successfully deleted ${orphanedEquipment.length} orphaned equipment entries.`);
      onRefresh?.();
    } catch (error) {
      console.error('Error deleting orphaned equipment:', error);
      alert('Failed to delete orphaned equipment. Please check the console for details.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <header className="bg-white dark:bg-black border-b border-yellow-600">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
            <img 
              src="/top-left-logo.png" 
              alt="IWCE Logo" 
              className="h-6 w-6 sm:h-8 sm:w-8"
            />
            <h1 className="text-lg sm:text-xl font-semibold text-yellow-600 dark:text-yellow-400">IWCE Equipment</h1>
          </div>
            
            {/* Right side items */}
            <div className="flex items-center space-x-2">
              {/* Mobile Menu Toggle */}
          <button
            onClick={() => setShowMobileMenu(!showMobileMenu)}
            className="p-2 text-yellow-600 dark:text-yellow-400 hover:text-yellow-500 dark:hover:text-yellow-300 lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Mobile Alert Icon */}
          <button
            onClick={onToggleAlerts}
            className="relative p-2 text-yellow-600 dark:text-yellow-400 hover:text-yellow-500 dark:hover:text-yellow-300 lg:hidden"
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
            {user?.role === 'admin' && (
              <button
                onClick={onAddProduct}
                className="p-2 bg-yellow-500 text-black rounded-lg hover:bg-yellow-400 transition-colors"
                title="Add Equipment"
              >
                <Plus className="h-4 w-4" />
              </button>
            )}
            
            <button
              onClick={onToggleAlerts}
              className="relative p-2 text-yellow-600 dark:text-yellow-400 hover:text-yellow-500 dark:hover:text-yellow-300 transition-colors"
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
                  className="flex items-center space-x-2 p-2 bg-yellow-100 dark:bg-yellow-900 dark:bg-opacity-30 rounded-lg hover:bg-yellow-200 dark:hover:bg-opacity-50 transition-colors"
                  title="User Menu"
                >
                  <User className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                  <ChevronDown className="h-3 w-3 text-yellow-600 dark:text-yellow-400" />
                </button>

                {showUserMenu && (
                  <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-black border border-yellow-600 rounded-lg shadow-lg z-50">
                    <div className="p-4 border-b border-yellow-200 dark:border-yellow-800">
                      <div className="flex items-center space-x-3">
                        <div className="h-10 w-10 bg-yellow-600 rounded-full flex items-center justify-center">
                          <User className="h-5 w-5 text-black" />
                        </div>
                        <div>
                          <p className="text-gray-900 dark:text-yellow-100 font-medium">{user.name}</p>
                          <p className={`text-xs ${getRoleColor(user.role)}`}>
                            {getRoleDisplay(user.role)}
                          </p>
                          <p className="text-xs text-yellow-700 dark:text-yellow-600">@{user.username}</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="p-2 space-y-1">
                      {true && ( // Temporarily always show for testing
                        <button
                          onClick={handleDeleteOrphanedEquipment}
                          disabled={isDeleting}
                          className="w-full flex items-center space-x-2 px-3 py-2 text-red-500 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900 dark:hover:bg-opacity-30 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Trash2 className="h-4 w-4" />
                          <span>{isDeleting ? 'Deleting...' : 'Delete Orphaned Equipment'}</span>
                        </button>
                      )}
                      <button
                        onClick={onLogout}
                        className="w-full flex items-center space-x-2 px-3 py-2 text-yellow-700 dark:text-yellow-300 hover:bg-yellow-100 dark:hover:bg-yellow-900 dark:hover:bg-opacity-30 rounded-lg transition-colors"
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
        </div>

        {/* Mobile Menu */}
        {showMobileMenu && (
          <div className="lg:hidden border-t border-yellow-200 dark:border-yellow-800">
            <div className="px-4 py-4 space-y-3">
              {/* User Info - First item */}
              {user && (
                <div className="flex items-center space-x-3 p-3 bg-yellow-100 dark:bg-yellow-900 dark:bg-opacity-50 border border-yellow-400 dark:border-yellow-600 rounded-lg">
                  <User className="h-5 w-5 text-yellow-700 dark:text-yellow-300" />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-yellow-700 dark:text-yellow-300">
                      {user.name || user.username}
                    </div>
                    <div className={`text-xs ${getRoleColor(user.role)}`}>
                      {getRoleDisplay(user.role)}
                    </div>
                  </div>
                </div>
              )}
              {user?.role === 'admin' && (
                <button
                  onClick={() => { onAddProduct(); setShowMobileMenu(false); }}
                  className="flex items-center space-x-3 w-full p-3 bg-yellow-100 dark:bg-yellow-900 dark:bg-opacity-50 border border-yellow-400 dark:border-yellow-600 text-yellow-700 dark:text-yellow-300 rounded-lg hover:bg-yellow-200 dark:hover:bg-opacity-70 transition-colors"
                >
                  <Plus className="h-5 w-5" />
                  <span>Add Equipment</span>
                </button>
              )}
              {user && (
                <button
                  onClick={() => { onLogout(); setShowMobileMenu(false); }}
                  className="flex items-center space-x-3 w-full p-3 bg-yellow-100 dark:bg-yellow-900 dark:bg-opacity-50 border border-yellow-400 dark:border-yellow-600 text-yellow-700 dark:text-yellow-300 rounded-lg hover:bg-yellow-200 dark:hover:bg-opacity-70 transition-colors"
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
