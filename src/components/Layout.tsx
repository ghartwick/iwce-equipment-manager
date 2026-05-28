import React, { useState } from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../context/ThemeContext';
import { Plus, Bell, User, LogOut, Menu, Package, Users, Clock, MapPin, Wrench, Truck, Sun, Moon, FileText, Car } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
}

function Layout({ children }: LayoutProps) {
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

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

  
  const handleToggleAlerts = () => {
    // This will be handled by the InventoryPage component
    const event = new CustomEvent('toggleAlerts');
    window.dispatchEvent(event);
  };

  return (
    <div className="min-h-screen bg-yellow-100 dark:bg-black transition-colors duration-200">
      {/* Header - Matching Original Style */}
      <header className="bg-yellow-100 dark:bg-black border-b border-yellow-600 transition-colors duration-200">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between h-16">
            {/* Left Side - Logo + Title */}
            <div className="flex items-center space-x-3">
              <div
                className="flex items-center space-x-3 cursor-pointer select-none"
                onClick={() => navigate('/game')}
                title="Secret Game"
              >
                <img 
                  src="/top-left-logo.png" 
                  alt="IWCE Logo" 
                  className="h-6 w-6 sm:h-8 sm:w-8"
                />
                <h1 className="text-lg sm:text-xl font-semibold text-yellow-600 dark:text-yellow-400">Field Hub</h1>
              </div>
            </div>

            {/* Right Side - Mobile Icons */}
            <div className="flex items-center space-x-2">
              {/* Mobile Alert Icon */}
              <button
                onClick={handleToggleAlerts}
                className="relative p-2 text-yellow-600 dark:text-yellow-400 hover:text-yellow-500 dark:hover:text-yellow-300 lg:hidden"
              >
                <Bell className="h-5 w-5" />
              </button>

              {/* Hamburger Menu - Mobile Only */}
              <button
                onClick={() => setShowMobileMenu(!showMobileMenu)}
                className="p-2 text-yellow-600 dark:text-yellow-400 hover:text-yellow-500 dark:hover:text-yellow-300 lg:hidden"
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
                          ? 'bg-yellow-200 dark:bg-yellow-900 text-yellow-900 dark:text-yellow-100'
                          : 'text-yellow-600 dark:text-yellow-400 hover:text-yellow-700 dark:hover:text-yellow-300 hover:bg-yellow-100 dark:hover:bg-yellow-900 dark:hover:bg-opacity-30'
                      }`}
                      title={item.name}
                    >
                      <Icon className="h-4 w-4 mr-1" />
                      <span className="hidden sm:inline">{item.name}</span>
                    </Link>
                  );
                })}
              </div>

              <button
                onClick={handleToggleAlerts}
                className="relative p-2 text-yellow-600 dark:text-yellow-400 hover:text-yellow-500 dark:hover:text-yellow-300 transition-colors"
              >
                <Bell className="h-5 w-5" />
              </button>

              {/* User Menu */}
              {user && (
                <div className="relative">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowUserMenu(!showUserMenu);
                    }}
                    className="p-2 text-yellow-600 dark:text-yellow-400 hover:text-yellow-500 dark:hover:text-yellow-300 transition-colors"
                    title="User Menu"
                  >
                    <Menu className="h-5 w-5" />
                  </button>

                  {showUserMenu && (
                    <div className="absolute right-0 mt-2 w-64 bg-yellow-200 dark:bg-black border border-yellow-600 rounded-lg shadow-lg z-50">
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

                      <div className="p-2">
                        {/* Admin-only Management Items */}
                        {user.role === 'admin' && (
                          <>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowUserMenu(false);
                                navigate('/manage/sites');
                              }}
                              className="w-full flex items-center space-x-2 px-3 py-2 text-yellow-700 dark:text-yellow-300 hover:bg-yellow-100 dark:hover:bg-yellow-900 dark:hover:bg-opacity-30 rounded-lg transition-colors"
                            >
                              <MapPin className="h-4 w-4" />
                              <span>Manage Sites</span>
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowUserMenu(false);
                                navigate('/manage/fleet');
                              }}
                              className="w-full flex items-center space-x-2 px-3 py-2 text-yellow-700 dark:text-yellow-300 hover:bg-yellow-100 dark:hover:bg-yellow-900 dark:hover:bg-opacity-30 rounded-lg transition-colors"
                            >
                              <Car className="h-4 w-4" />
                              <span>Manage Fleet</span>
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowUserMenu(false);
                                navigate('/manage/heavy-equipment');
                              }}
                              className="w-full flex items-center space-x-2 px-3 py-2 text-yellow-700 dark:text-yellow-300 hover:bg-yellow-100 dark:hover:bg-yellow-900 dark:hover:bg-opacity-30 rounded-lg transition-colors"
                            >
                              <Truck className="h-4 w-4" />
                              <span>Manage Heavy Equipment</span>
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowUserMenu(false);
                                navigate('/manage/field-tools');
                              }}
                              className="w-full flex items-center space-x-2 px-3 py-2 text-yellow-700 dark:text-yellow-300 hover:bg-yellow-100 dark:hover:bg-yellow-900 dark:hover:bg-opacity-30 rounded-lg transition-colors"
                            >
                              <Plus className="h-4 w-4" />
                              <span>Manage Field Tools</span>
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowUserMenu(false);
                                navigate('/manage/small-tools');
                              }}
                              className="w-full flex items-center space-x-2 px-3 py-2 text-yellow-700 dark:text-yellow-300 hover:bg-yellow-100 dark:hover:bg-yellow-900 dark:hover:bg-opacity-30 rounded-lg transition-colors"
                            >
                              <Wrench className="h-4 w-4" />
                              <span>Manage Small Tools</span>
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowUserMenu(false);
                                navigate('/shop');
                              }}
                              className="w-full flex items-center space-x-2 px-3 py-2 text-yellow-700 dark:text-yellow-300 hover:bg-yellow-100 dark:hover:bg-yellow-900 dark:hover:bg-opacity-30 rounded-lg transition-colors"
                            >
                              <FileText className="h-4 w-4" />
                              <span>Shop</span>
                            </button>
                          </>
                        )}

                        {/* User Management - Admin, Supervisor, and Field Users */}
                        {user && (user.role === 'admin' || user.role === 'supervisor' || user.role === 'field') && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowUserMenu(false);
                              navigate('/manage/users');
                            }}
                            className="w-full flex items-center space-x-2 px-3 py-2 text-yellow-700 dark:text-yellow-300 hover:bg-yellow-100 dark:hover:bg-yellow-900 dark:hover:bg-opacity-30 rounded-lg transition-colors"
                          >
                            <Users className="h-4 w-4" />
                            <span>User Management</span>
                          </button>
                        )}

                        {/* Theme Toggle */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleTheme();
                            setShowUserMenu(false);
                          }}
                          className="w-full flex items-center space-x-2 px-3 py-2 text-yellow-700 dark:text-yellow-300 hover:bg-yellow-100 dark:hover:bg-yellow-900 dark:hover:bg-opacity-30 rounded-lg transition-colors"
                        >
                          {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                          <span>{isDark ? 'Light Mode' : 'Dark Mode'}</span>
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleLogout();
                          }}
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

          {/* Mobile Menu */}
          {showMobileMenu && (
            <div className="lg:hidden border-t border-yellow-200 dark:border-yellow-800">
              <div className="px-4 py-4 space-y-3">
                {/* Mobile User Identification Section - Moved to top */}
                {user && (
                  <div className="p-3 bg-yellow-50 dark:bg-yellow-900 dark:bg-opacity-30 rounded-lg">
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
                )}
                
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
                          ? 'bg-yellow-200 dark:bg-yellow-900 dark:bg-opacity-70 border border-yellow-600 text-yellow-900 dark:text-yellow-100'
                          : 'bg-yellow-50 dark:bg-yellow-900 dark:bg-opacity-50 border border-yellow-600 text-yellow-700 dark:text-yellow-300 hover:bg-yellow-100 dark:hover:bg-opacity-70'
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                      <span>{item.name}</span>
                    </Link>
                  );
                })}
                
                {/* Admin Management Items */}
                {user && user.role === 'admin' && (
                  <>
                    <button
                      onClick={() => { setShowMobileMenu(false); navigate('/manage/sites'); }}
                      className="flex items-center space-x-3 w-full p-3 bg-yellow-50 dark:bg-yellow-900 dark:bg-opacity-50 border border-yellow-600 text-yellow-700 dark:text-yellow-300 rounded-lg hover:bg-yellow-100 dark:hover:bg-opacity-70 transition-colors"
                    >
                      <MapPin className="h-5 w-5" />
                      <span>Manage Sites</span>
                    </button>
                    <button
                      onClick={() => { setShowMobileMenu(false); navigate('/manage/fleet'); }}
                      className="flex items-center space-x-3 w-full p-3 bg-yellow-50 dark:bg-yellow-900 dark:bg-opacity-50 border border-yellow-600 text-yellow-700 dark:text-yellow-300 rounded-lg hover:bg-yellow-100 dark:hover:bg-opacity-70 transition-colors"
                    >
                      <Car className="h-5 w-5" />
                      <span>Manage Fleet</span>
                    </button>
                    <button
                      onClick={() => { setShowMobileMenu(false); navigate('/manage/heavy-equipment'); }}
                      className="flex items-center space-x-3 w-full p-3 bg-yellow-50 dark:bg-yellow-900 dark:bg-opacity-50 border border-yellow-600 text-yellow-700 dark:text-yellow-300 rounded-lg hover:bg-yellow-100 dark:hover:bg-opacity-70 transition-colors"
                    >
                      <Truck className="h-5 w-5" />
                      <span>Manage Heavy Equipment</span>
                    </button>
                    <button
                      onClick={() => { setShowMobileMenu(false); navigate('/manage/field-tools'); }}
                      className="flex items-center space-x-3 w-full p-3 bg-yellow-50 dark:bg-yellow-900 dark:bg-opacity-50 border border-yellow-600 text-yellow-700 dark:text-yellow-300 rounded-lg hover:bg-yellow-100 dark:hover:bg-opacity-70 transition-colors"
                    >
                      <Plus className="h-5 w-5" />
                      <span>Manage Field Tools</span>
                    </button>
                    <button
                      onClick={() => { setShowMobileMenu(false); navigate('/manage/small-tools'); }}
                      className="flex items-center space-x-3 w-full p-3 bg-yellow-50 dark:bg-yellow-900 dark:bg-opacity-50 border border-yellow-600 text-yellow-700 dark:text-yellow-300 rounded-lg hover:bg-yellow-100 dark:hover:bg-opacity-70 transition-colors"
                    >
                      <Wrench className="h-5 w-5" />
                      <span>Manage Small Tools</span>
                    </button>
                    <button
                      onClick={() => { setShowMobileMenu(false); navigate('/shop'); }}
                      className="flex items-center space-x-3 w-full p-3 bg-yellow-50 dark:bg-yellow-900 dark:bg-opacity-50 border border-yellow-600 text-yellow-700 dark:text-yellow-300 rounded-lg hover:bg-yellow-100 dark:hover:bg-opacity-70 transition-colors"
                    >
                      <FileText className="h-5 w-5" />
                      <span>Shop</span>
                    </button>
                  </>
                )}
                
                {/* User Management - Admin, Supervisor, and Field Users */}
                {user && (user.role === 'admin' || user.role === 'supervisor' || user.role === 'field') && (
                  <button
                    onClick={() => { setShowMobileMenu(false); navigate('/manage/users'); }}
                    className="flex items-center space-x-3 w-full p-3 bg-yellow-50 dark:bg-yellow-900 dark:bg-opacity-50 border border-yellow-600 text-yellow-700 dark:text-yellow-300 rounded-lg hover:bg-yellow-100 dark:hover:bg-opacity-70 transition-colors"
                  >
                    <Users className="h-5 w-5" />
                    <span>User Management</span>
                  </button>
                )}
                
                                
                {/* Mobile Theme Toggle */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleTheme(); 
                    setShowMobileMenu(false);
                  }}
                  className="flex items-center space-x-3 w-full p-3 bg-yellow-50 dark:bg-yellow-900 dark:bg-opacity-50 border border-yellow-600 text-yellow-700 dark:text-yellow-300 rounded-lg hover:bg-yellow-100 dark:hover:bg-opacity-70 transition-colors"
                >
                  {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                  <span>{isDark ? 'Light Mode' : 'Dark Mode'}</span>
                </button>
                
                {user && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleLogout(); 
                    }}
                    className="flex items-center space-x-3 w-full p-3 bg-yellow-50 dark:bg-yellow-900 dark:bg-opacity-50 border border-yellow-600 text-yellow-700 dark:text-yellow-300 rounded-lg hover:bg-yellow-100 dark:hover:bg-opacity-70 transition-colors"
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



    </div>
  );
}

export default Layout;
