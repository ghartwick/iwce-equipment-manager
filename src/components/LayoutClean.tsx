import React from 'react';
import { Link } from 'react-router-dom';
import { Plus, Bell, User, LogOut, ChevronDown, Menu, Package, Settings } from 'lucide-react';

interface LayoutCleanProps {
  children: React.ReactNode;
  onAddEquipment?: () => void;
}

function LayoutClean({ children, onAddEquipment }: LayoutCleanProps) {
  console.log('LayoutClean component rendered');
  
  // Mock user for now
  const user = { username: 'Admin', role: 'admin', name: 'Admin User' };
  const [showUserMenu, setShowUserMenu] = React.useState(false);
  const [showMobileMenu, setShowMobileMenu] = React.useState(false);

  const navigation = [
    { name: 'Inventory', href: '/inventory', icon: Package },
    { name: 'Time Cards', href: '/new-feature', icon: Settings },
  ];

  const isActive = (href: string) => window.location.pathname === href;

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <header className="bg-black border-b border-yellow-600">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Left Side - Logo */}
            <div className="flex items-center space-x-3">
              <img 
                src="/top-left-logo.png" 
                alt="IWCE Logo" 
                className="h-6 w-6 sm:h-8 sm:w-8"
              />
              <h1 className="text-lg sm:text-xl font-semibold text-yellow-400">IWCE</h1>
            </div>
            
            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              className="p-2 text-yellow-400 hover:text-yellow-300 lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>

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

              {/* Add Equipment Button */}
              <button
                onClick={onAddEquipment || (() => console.log('Add equipment clicked - no handler provided'))}
                className="p-2 text-yellow-400 hover:text-yellow-300 transition-colors"
                title="Add Equipment"
              >
                <Plus className="h-5 w-5" />
              </button>

              {/* Alert Bell */}
              <button
                onClick={() => console.log('Alerts clicked')}
                className="relative p-2 text-yellow-400 hover:text-yellow-300 transition-colors"
              >
                <Bell className="h-5 w-5" />
              </button>

              {/* User Menu */}
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
                          <p className="text-yellow-600 text-xs">{user.role}</p>
                          <p className="text-yellow-600 text-xs">@{user.username}</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="p-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          console.log('Logout clicked');
                          setShowUserMenu(false);
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
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      {children}
    </div>
  );
}

export default LayoutClean;
