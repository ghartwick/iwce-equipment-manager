import React, { useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Plus, Bell, User, LogOut, ChevronDown, Menu, Package, Users, Clock } from 'lucide-react';
import { UserManagement } from './UserManagement';

interface LayoutProps {
  children: React.ReactNode;
}

function Layout({ children }: LayoutProps) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showUserManagement, setShowUserManagement] = useState(false);

  const navigation = [
    { name: 'Inventory', href: '/inventory', icon: Package },
    { name: 'Timecard', href: '/timecard', icon: Clock },
  ];

  const isActive = (href: string) => location.pathname === href;

  const getRoleDisplay = (role: string) => {
    switch (role) {
      case 'admin':
        return 'Administrator';
      case 'manager':
        return 'Manager';
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
      case 'manager':
        return 'text-yellow-400';
      case 'field':
        return 'text-green-400';
      default:
        return 'text-yellow-400';
    }
  };

  const handleLogout = () => {
    try {
      logout();
      setShowUserMenu(false);
      // Force immediate redirect to login
      window.location.href = '/login';
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const handleAddProduct = () => {
    // Dispatch global event for InventoryPage to handle
    window.dispatchEvent(new CustomEvent('addProduct'));
    console.log('Add equipment event dispatched');
  };

  const handleToggleAlerts = () => {
    // This will be handled by the InventoryPage component
    const event = new CustomEvent('toggleAlerts');
    window.dispatchEvent(event);
  };

  return (
    <div className="min-h-screen bg-black">
      {/* Header - Matching Original Style */}
      <header className="bg-black border-b border-yellow-600">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Left Side - Logo + Title */}
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-3">
                <img 
                  src="/top-left-logo.png" 
                  alt="IWCE Logo" 
                  className="h-6 w-6 sm:h-8 sm:w-8"
                />
                <h1 className="text-lg sm:text-xl font-semibold text-yellow-400">IWCE</h1>
              </div>
            </div>

            {/* Right Side - Mobile Icons */}
            <div className="flex items-center space-x-2">
              {/* Mobile Alert Icon */}
              <button
                onClick={handleToggleAlerts}
                className="relative p-2 text-yellow-400 hover:text-yellow-300 lg:hidden"
              >
                <Bell className="h-5 w-5" />
              </button>

              {/* Hamburger Menu - Moved to Right */}
              <button
                onClick={() => setShowMobileMenu(!showMobileMenu)}
                className="p-2 text-yellow-400 hover:text-yellow-300 lg:hidden"
              >
                <Menu className="h-5 w-5" />
              </button>
            </div>

            {/* Desktop Actions */}
            <div className="hidden lg:flex items-center space-x-2">
              {/* Navigation Links */}
              <div className="flex items-center space-x-1 mr-4">
                {navigation.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.name}
                      to={item.href}
                      className={`flex items-center px-2 py-1 rounded text-sm font-medium transition-colors ${
                        isActive(item.href)
                          ? 'bg-yellow-900 text-yellow-100'
                          : 'text-yellow-400 hover:text-yellow-300 hover:bg-yellow-900 hover:bg-opacity-30'
                      }`}
                      title={item.name}
                    >
                      <Icon className="h-4 w-4 mr-1" />
                      <span className="hidden sm:inline">{item.name}</span>
                    </Link>
                  );
                })}
              </div>

              {user?.role !== 'field' && (
                <button
                  onClick={handleAddProduct}
                  className="p-2 bg-yellow-500 text-black rounded-lg hover:bg-yellow-400 transition-colors"
                  title="Add Equipment"
                >
                  <Plus className="h-4 w-4" />
                </button>
              )}
              
              <button
                onClick={handleToggleAlerts}
                className="relative p-2 text-yellow-400 hover:text-yellow-300 transition-colors"
              >
                <Bell className="h-5 w-5" />
              </button>

              {/* User Management - Admin, Supervisor, and Field Users */}
              {user && (user.role === 'admin' || user.role === 'supervisor' || user.role === 'field') && (
                <button
                  onClick={() => setShowUserManagement(true)}
                  className="p-2 text-yellow-400 hover:text-yellow-300 transition-colors"
                  title="User Management"
                >
                  <Users className="h-5 w-5" />
                </button>
              )}

              {/* User Menu */}
              {user && (
                <div className="relative">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowUserMenu(!showUserMenu);
                    }}
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
                          onClick={(e) => {
                            e.stopPropagation();
                            handleLogout();
                          }}
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
                {/* Mobile Navigation */}
                {navigation.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.name}
                      to={item.href}
                      onClick={() => setShowMobileMenu(false)}
                      className={`flex items-center space-x-3 w-full p-3 rounded-lg transition-colors ${
                        isActive(item.href)
                          ? 'bg-yellow-900 bg-opacity-70 border border-yellow-600 text-yellow-100'
                          : 'bg-yellow-900 bg-opacity-50 border border-yellow-600 text-yellow-300 hover:bg-opacity-70'
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                      <span>{item.name}</span>
                    </Link>
                  );
                })}
                
                {user?.role !== 'field' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAddProduct(); 
                      setShowMobileMenu(false);
                    }}
                    className="flex items-center space-x-3 w-full p-3 bg-yellow-900 bg-opacity-50 border border-yellow-600 text-yellow-300 rounded-lg hover:bg-opacity-70 transition-colors"
                  >
                    <Plus className="h-5 w-5" />
                    <span>Add Equipment</span>
                  </button>
                )}
                
                {/* User Management - Admin, Supervisor, and Field Users */}
                {user && (user.role === 'admin' || user.role === 'supervisor' || user.role === 'field') && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowUserManagement(true);
                      setShowMobileMenu(false);
                    }}
                    className="flex items-center space-x-3 w-full p-3 bg-yellow-900 bg-opacity-50 border border-yellow-600 text-yellow-300 rounded-lg hover:bg-opacity-70 transition-colors"
                  >
                    <Users className="h-5 w-5" />
                    <span>User Management</span>
                  </button>
                )}
                
                {/* Mobile User Identification Section */}
                {user && (
                  <div className="border-t border-yellow-800 pt-3">
                    <div className="p-3 bg-yellow-900 bg-opacity-30 rounded-lg">
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
                  </div>
                )}
                
                {user && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleLogout(); 
                    }}
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

      {/* Main Content */}
      {children}

      {/* User Management Modal */}
      {showUserManagement && user && (
        <UserManagement
          currentUser={user}
          onClose={() => setShowUserManagement(false)}
        />
      )}
    </div>
  );
}

export default Layout;
