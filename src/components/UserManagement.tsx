import React, { useState, useEffect } from 'react';
import { UserPlus, Edit2, Trash2, Shield, Wrench, Users, Eye, EyeOff, ChevronDown, ChevronRight } from 'lucide-react';
import { AppUser, userManagementService } from '../services/userManagementService';

interface User {
  id: string;
  username: string;
  role: 'admin' | 'supervisor' | 'field';
  name: string;
}

// Form data type that accepts all roles for conversion
type FormDataRole = 'admin' | 'supervisor' | 'field';

interface UserManagementProps {
  onClose: () => void;
  currentUser: User | null;
  asPage?: boolean;
}

export function UserManagement({ currentUser, asPage = false }: UserManagementProps) {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedRoles, setExpandedRoles] = useState<Record<string, boolean>>({});

  // Form state
  const [formData, setFormData] = useState<{
    username: string;
    password: string;
    name: string;
    role: FormDataRole;
    isActive: boolean;
  }>({
    username: '',
    password: '',
    name: '',
    role: 'field',
    isActive: true
  });

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const usersData = await userManagementService.getAllUsers();
      setUsers(usersData);
    } catch (error) {
      console.error('Failed to load users:', error);
      setError('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    try {
      if (editingUser) {
        // Update user - different behavior based on current user role
        let updateData: any = {};
        
        if (currentUser?.role === 'admin') {
          // Admin can update all fields
          updateData = {
            username: formData.username,
            name: formData.name,
            role: formData.role,
            isActive: formData.isActive
          };
          
          // Only include password if it's not empty (user wants to change password)
          if (formData.password.trim() !== '') {
            updateData.password = formData.password;
          }
        } else {
          // Supervisor and Field users can only update their password
          if (formData.password.trim() === '') {
            setError('Please enter a new password to update');
            return;
          }
          updateData = {
            password: formData.password
          };
        }
        
        await userManagementService.updateUser(editingUser.id, updateData);
        setSuccess(currentUser?.role === 'admin' ? 'User updated successfully' : 'Password updated successfully');
        setEditingUser(null);
      } else {
        // Add new user
        await userManagementService.addUser({
          ...formData,
          createdBy: currentUser?.username
        });
        setSuccess('User added successfully');
        setShowAddForm(false);
      }

      // Reset form
      setFormData({
        username: '',
        password: '',
        name: '',
        role: 'field',
        isActive: true
      });

      // Reload users
      await loadUsers();
    } catch (error) {
      console.error('Failed to save user:', error);
      setError((error as Error).message);
    }
  };

  const handleEdit = (user: AppUser) => {
    setEditingUser(user);
    setFormData({
      username: user.username,
      password: '', // Don't pre-fill password for security
      name: user.name,
      role: user.role, // AppUser already has converted role
      isActive: user.isActive
    });
    setShowAddForm(false);
  };

  const handleDelete = async (user: AppUser) => {
    if (user.id === currentUser?.id) {
      setError('You cannot delete your own account');
      return;
    }

    if (!confirm(`Are you sure you want to delete user "${user.name}"?`)) {
      return;
    }

    try {
      await userManagementService.deleteUser(user.id);
      setSuccess('User deleted successfully');
      await loadUsers();
    } catch (error) {
      console.error('Failed to delete user:', error);
      setError('Failed to delete user');
    }
  };

  const filteredUsers = users.filter(user =>
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.role.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    if (asPage) {
      return (
        <div className="min-h-screen bg-yellow-100 dark:bg-black text-gray-900 dark:text-yellow-100 px-2 sm:px-4 py-4 -mx-2 sm:-mx-4 lg:mx-0 lg:p-2">
          <div className="max-w-5xl mx-auto">
            <div className="bg-yellow-200 dark:bg-black border border-yellow-600 rounded-lg p-6">
              <div className="text-yellow-600 dark:text-yellow-400">Loading users...</div>
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-yellow-200 dark:bg-black border border-yellow-600 rounded-lg p-6">
          <div className="text-yellow-600 dark:text-yellow-400">Loading users...</div>
        </div>
      </div>
    );
  }

  const inner = (
    <>
        {/* Header */}
        <div className="bg-yellow-700 dark:bg-yellow-900 dark:bg-opacity-30 px-6 py-4 border-b border-yellow-300 dark:border-yellow-700">
          <h2 className="text-xl font-semibold text-yellow-100 dark:text-yellow-300">User Management</h2>
        </div>

        {/* Content */}
        <div className={`p-6 ${asPage ? 'overflow-visible' : 'overflow-y-auto max-h-[calc(90vh-120px)]'}`}>
          {/* Alerts */}
          {error && (
            <div className="mb-4 p-3 bg-red-100 dark:bg-red-900 dark:bg-opacity-30 border border-red-600 rounded-lg text-red-600 dark:text-red-300">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-4 p-3 bg-green-100 dark:bg-green-900 dark:bg-opacity-30 border border-green-600 rounded-lg text-green-700 dark:text-green-300">
              {success}
            </div>
          )}

          {/* Search and Actions */}
          {!showAddForm && !editingUser && (
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <input
                type="text"
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1 px-4 py-2 border border-yellow-600 rounded-lg bg-yellow-200 dark:bg-black text-gray-900 dark:text-yellow-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
              />
              {currentUser?.role === 'admin' && (
                <button
                  onClick={() => setShowAddForm(true)}
                  className="flex items-center space-x-2 px-4 py-2 bg-yellow-500 text-black rounded-lg hover:bg-yellow-600 transition-colors"
                >
                  <UserPlus className="h-4 w-4" />
                  <span>Add User</span>
                </button>
              )}
            </div>
          )}

          {/* Add User Form */}
          {showAddForm && (
            <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900 dark:bg-opacity-20 border border-yellow-300 dark:border-yellow-700 rounded-lg">
              <h3 className="text-lg font-medium text-yellow-700 dark:text-yellow-300 mb-4">Add New User</h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-yellow-700 dark:text-yellow-300 mb-1">Username</label>
                    <input
                      type="text"
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                      className="w-full px-3 py-2 bg-yellow-200 dark:bg-black border border-yellow-600 rounded-lg text-gray-900 dark:text-yellow-100 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-yellow-700 dark:text-yellow-300 mb-1">Password</label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        className="w-full px-3 py-2 pr-10 bg-yellow-200 dark:bg-black border border-yellow-600 rounded-lg text-gray-900 dark:text-yellow-100 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-yellow-400 transition-colors"
                        title={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-yellow-700 dark:text-yellow-300 mb-1">Full Name</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 bg-yellow-200 dark:bg-black border border-yellow-600 rounded-lg text-gray-900 dark:text-yellow-100 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-yellow-700 dark:text-yellow-300 mb-1">Role</label>
                    <select
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value as FormDataRole })}
                      className="w-full px-3 py-2 bg-yellow-200 dark:bg-black border border-yellow-600 rounded-lg text-gray-900 dark:text-yellow-100 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                    >
                      <option value="field">Field</option>
                      <option value="supervisor">Supervisor</option>
                      <option value="admin">Administrator</option>
                    </select>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="w-4 h-4 text-yellow-500 bg-white dark:bg-black border-yellow-600 rounded focus:ring-yellow-500"
                  />
                  <label htmlFor="isActive" className="text-sm text-yellow-700 dark:text-yellow-300">Active User</label>
                </div>
                <div className="flex space-x-3">
                  <button
                    type="submit"
                    className="px-4 py-2 bg-yellow-500 text-black rounded-lg hover:bg-yellow-600 transition-colors"
                  >
                    Add User
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddForm(false);
                      setError(null);
                      setSuccess(null);
                    }}
                    className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}
          
          {/* Users Table with Collapsible Role Categories */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-yellow-600 dark:bg-yellow-900 dark:bg-opacity-30">
                  <th className="px-4 py-2 text-left text-yellow-100 dark:text-yellow-300">Username</th>
                  <th className="px-4 py-2 text-left text-yellow-100 dark:text-yellow-300">Name</th>
                  <th className="px-4 py-2 text-center text-yellow-100 dark:text-yellow-300">Status</th>
                  <th className="px-4 py-2 text-center text-yellow-100 dark:text-yellow-300">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  let usersToShow = filteredUsers;
                  
                  if (currentUser?.role === 'supervisor' || currentUser?.role === 'field') {
                    // For supervisors and field users, only show their own profile
                    usersToShow = filteredUsers.filter(user => user.id === currentUser.id);
                  }
                  
                  // Group users by role
                  const roles = ['admin', 'supervisor', 'field'];
                  
                  return roles.map((role) => {
                    const roleUsers = usersToShow
                      .filter(user => user.role === role)
                      .sort((a, b) => a.name.localeCompare(b.name));
                    
                    if (roleUsers.length === 0) return null;
                    
                    const isExpanded = expandedRoles[role] || false;
                    
                    const toggleExpanded = () => {
                      setExpandedRoles(prev => ({
                        ...prev,
                        [role]: !prev[role]
                      }));
                    };
                    
                    return (
                      <React.Fragment key={role}>
                        {/* Role Header Row */}
                        <tr>
                          <td colSpan={4} className="px-4 py-2 bg-yellow-50 dark:bg-yellow-900 dark:bg-opacity-20">
                            <button
                              onClick={toggleExpanded}
                              className="flex items-center space-x-2 text-sm font-medium text-yellow-700 dark:text-yellow-300 hover:text-yellow-600 dark:hover:text-yellow-400 transition-colors"
                            >
                              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                              {role === 'admin' && <Shield className="h-5 w-5 text-red-400" />}
                              {role === 'supervisor' && <Users className="h-5 w-5 text-purple-400" />}
                              {role === 'field' && <Wrench className="h-5 w-5 text-blue-400" />}
                              <span className="capitalize">{role}s ({roleUsers.length})</span>
                              {(currentUser?.role === 'supervisor' || currentUser?.role === 'field') && (
                                <span className="text-xs text-yellow-600 dark:text-yellow-500 ml-2">(Your Profile Only)</span>
                              )}
                            </button>
                          </td>
                        </tr>
                        
                        {/* User Rows - Only show when expanded */}
                        {isExpanded && roleUsers.map((user) => (
                          <tr key={user.id} className={`border-b border-yellow-200 dark:border-yellow-800 ${user.isActive ? 'bg-white dark:bg-black' : 'bg-gray-100 dark:bg-gray-900 dark:bg-opacity-30 opacity-75'}`}>
                            <td className="px-4 py-2">
                              <div className="text-sm text-gray-900 dark:text-yellow-100">@{user.username}</div>
                            </td>
                            <td className="px-4 py-2">
                              <div className="text-sm font-medium text-gray-900 dark:text-yellow-100">{user.name}</div>
                            </td>
                            <td className="px-4 py-2 text-center">
                              <span className={`px-2 py-1 text-xs rounded-full ${user.isActive ? 'bg-green-100 dark:bg-green-900 dark:bg-opacity-30 text-green-700 dark:text-green-400' : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'}`}>
                                {user.isActive ? 'Active' : 'In Active'}
                              </span>
                            </td>
                            <td className="px-4 py-2">
                              <div className="flex items-center justify-center space-x-1">
                                {/* Edit User - Admin, Supervisor, and Field User (own account only) */}
                                {(currentUser?.role === 'admin' || 
                                  currentUser?.role === 'supervisor' || 
                                  (currentUser?.role === 'field' && user.id === currentUser?.id)) && (
                                  <button
                                    onClick={() => handleEdit(user)}
                                    className="p-1 text-yellow-600 hover:text-yellow-500"
                                    title="Edit user"
                                  >
                                    <Edit2 className="h-4 w-4" />
                                  </button>
                                )}
                                
                                {/* Delete User - Admin Only */}
                                {currentUser?.role === 'admin' && (
                                  <button
                                    onClick={() => {
                                      if (window.confirm(`Are you sure you want to delete user "${user.name}"?`)) {
                                        handleDelete(user);
                                      }
                                    }}
                                    className="p-1 text-red-600 hover:text-red-500"
                                    title="Delete user"
                                    disabled={user.id === currentUser?.id}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </React.Fragment>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>
          
          {/* Edit Form - Shows as modal when editing */}
          {editingUser && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-yellow-200 dark:bg-black border border-yellow-600 rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                <h3 className="text-lg font-medium text-yellow-700 dark:text-yellow-300 mb-4">Edit User</h3>
                {currentUser?.role !== 'admin' && (
                  <div className="mb-4 p-3 bg-yellow-100 dark:bg-yellow-800 dark:bg-opacity-30 border border-yellow-400 rounded-lg">
                    <p className="text-sm text-yellow-800 dark:text-yellow-200">
                      For security purposes, you can only change your password. Contact an administrator to update other information.
                    </p>
                  </div>
                )}
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {currentUser?.role === 'admin' ? (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-yellow-700 dark:text-yellow-300 mb-1">Username</label>
                          <input
                            type="text"
                            value={formData.username}
                            onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                            className="w-full px-3 py-2 bg-yellow-200 dark:bg-black border border-yellow-600 rounded-lg text-gray-900 dark:text-yellow-100 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-yellow-700 dark:text-yellow-300 mb-1">Full Name</label>
                          <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full px-3 py-2 bg-yellow-200 dark:bg-black border border-yellow-600 rounded-lg text-gray-900 dark:text-yellow-100 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-yellow-700 dark:text-yellow-300 mb-1">Role</label>
                          <select
                            value={formData.role}
                            onChange={(e) => setFormData({ ...formData, role: e.target.value as FormDataRole })}
                            className="w-full px-3 py-2 bg-yellow-200 dark:bg-black border border-yellow-600 rounded-lg text-gray-900 dark:text-yellow-100 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                          >
                            <option value="field">Field</option>
                            <option value="supervisor">Supervisor</option>
                            <option value="admin">Administrator</option>
                          </select>
                        </div>
                      </>
                    ) : null}
                    <div>
                      <label className="block text-sm font-medium text-yellow-700 dark:text-yellow-300 mb-1">
                        {currentUser?.role === 'admin' ? 'New Password (leave blank to keep current)' : 'Password'}
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword ? "text" : "password"}
                          value={formData.password}
                          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                          className="w-full px-3 py-2 pr-10 bg-yellow-200 dark:bg-black border border-yellow-600 rounded-lg text-gray-900 dark:text-yellow-100 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                          placeholder={currentUser?.role === 'admin' ? 'Leave blank to keep current password' : 'Enter new password'}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-yellow-400 transition-colors"
                          title={showPassword ? "Hide password" : "Show password"}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                  </div>
                  {currentUser?.role === 'admin' && (
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="editIsActive"
                        checked={formData.isActive}
                        onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                        className="w-4 h-4 text-yellow-500 bg-white dark:bg-black border-yellow-600 rounded focus:ring-yellow-500"
                      />
                      <label htmlFor="editIsActive" className="text-sm text-yellow-700 dark:text-yellow-300">Active User</label>
                    </div>
                  )}
                  <div className="flex space-x-3">
                    <button
                      type="submit"
                      className="px-4 py-2 bg-yellow-500 text-black rounded-lg hover:bg-yellow-600 transition-colors"
                    >
                      Update User
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingUser(null);
                        setError(null);
                        setSuccess(null);
                      }}
                      className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
    </>
  );

  if (asPage) {
    return (
      <div className="min-h-screen bg-yellow-100 dark:bg-black text-gray-900 dark:text-yellow-100 px-2 sm:px-4 py-4 -mx-2 sm:-mx-4 lg:mx-0 lg:p-2">
        <div className="max-w-5xl mx-auto">
          <div className="bg-yellow-200 dark:bg-black border border-yellow-600 rounded-lg shadow-xl dark:shadow-yellow-900/20 dark:shadow-2xl overflow-hidden">
            {inner}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-yellow-200 dark:bg-black border border-yellow-600 rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] flex flex-col overflow-hidden">
        {inner}
      </div>
    </div>
  );
}
