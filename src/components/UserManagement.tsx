import React, { useState, useEffect } from 'react';
import { UserPlus, Edit2, Trash2, X, Shield, Wrench, Check, X as XIcon } from 'lucide-react';
import { AppUser, userManagementService } from '../services/userManagementService';

interface User {
  id: string;
  username: string;
  role: 'admin' | 'field';
  name: string;
}

// Form data type that accepts both roles for conversion
type FormDataRole = 'admin' | 'field';

interface UserManagementProps {
  onClose: () => void;
  currentUser: User | null;
}

export function UserManagement({ onClose, currentUser }: UserManagementProps) {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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
      setLoading(true);
      const userList = await userManagementService.getAllUsers();
      setUsers(userList);
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
        // Update user
        await userManagementService.updateUser(editingUser.id, formData);
        setSuccess('User updated successfully');
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

  const handleToggleActive = async (user: AppUser) => {
    if (user.id === currentUser?.id) {
      setError('You cannot deactivate your own account');
      return;
    }

    try {
      await userManagementService.updateUser(user.id, { isActive: !user.isActive });
      setSuccess(`User ${user.isActive ? 'deactivated' : 'activated'} successfully`);
      await loadUsers();
    } catch (error) {
      console.error('Failed to toggle user status:', error);
      setError('Failed to update user status');
    }
  };

  const resetForm = () => {
    setFormData({
      username: '',
      password: '',
      name: '',
      role: 'field',
      isActive: true
    });
    setEditingUser(null);
    setShowAddForm(false);
    setError(null);
    setSuccess(null);
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-black border border-yellow-600 rounded-lg p-6">
          <div className="text-yellow-400">Loading users...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-black border border-yellow-600 rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-yellow-900 bg-opacity-30 px-6 py-4 border-b border-yellow-700 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-yellow-300">User Management</h2>
          <button
            onClick={onClose}
            className="text-yellow-400 hover:text-yellow-300 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {/* Alerts */}
          {error && (
            <div className="mb-4 p-3 bg-red-900 bg-opacity-30 border border-red-600 rounded-lg text-red-300">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-4 p-3 bg-green-900 bg-opacity-30 border border-green-600 rounded-lg text-green-300">
              {success}
            </div>
          )}

          {/* Add User Button */}
          {!showAddForm && !editingUser && (
            <div className="mb-6">
              <button
                onClick={() => setShowAddForm(true)}
                className="flex items-center space-x-2 px-4 py-2 bg-yellow-500 text-black rounded-lg hover:bg-yellow-600 transition-colors"
              >
                <UserPlus className="h-4 w-4" />
                <span>Add New User</span>
              </button>
            </div>
          )}

          {/* User Form */}
          {(showAddForm || editingUser) && (
            <div className="mb-6 p-4 bg-yellow-900 bg-opacity-20 border border-yellow-700 rounded-lg">
              <h3 className="text-lg font-medium text-yellow-300 mb-4">
                {editingUser ? 'Edit User' : 'Add New User'}
              </h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-yellow-300 mb-1">Username</label>
                    <input
                      type="text"
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                      className="w-full px-3 py-2 bg-black border border-yellow-600 rounded-lg text-yellow-100 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                      required
                      disabled={!!editingUser} // Don't allow username change for existing users
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-yellow-300 mb-1">Full Name</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 bg-black border border-yellow-600 rounded-lg text-yellow-100 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-yellow-300 mb-1">Password</label>
                    <input
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      placeholder={editingUser ? "Leave blank to keep current password" : "Enter password"}
                      className="w-full px-3 py-2 bg-black border border-yellow-600 rounded-lg text-yellow-100 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                      required={!editingUser}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-yellow-300 mb-1">Role</label>
                    <select
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value as FormDataRole })}
                      className="w-full px-3 py-2 bg-black border border-yellow-600 rounded-lg text-yellow-100 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                    >
                      <option value="field">Field</option>
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
                    className="w-4 h-4 text-yellow-500 bg-black border-yellow-600 rounded focus:ring-yellow-500"
                  />
                  <label htmlFor="isActive" className="text-sm text-yellow-300">Active User</label>
                </div>
                <div className="flex space-x-3">
                  <button
                    type="submit"
                    className="px-4 py-2 bg-yellow-500 text-black rounded-lg hover:bg-yellow-600 transition-colors"
                  >
                    {editingUser ? 'Update User' : 'Add User'}
                  </button>
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Users List */}
          <div className="space-y-3">
            {users.map((user) => (
              <div key={user.id} className="bg-yellow-900 bg-opacity-10 border border-yellow-700 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    {/* Role Icon */}
                    <div className={`p-2 rounded-lg ${user.role === 'admin' ? 'bg-red-900 bg-opacity-30' : 'bg-blue-900 bg-opacity-30'}`}>
                      {user.role === 'admin' ? (
                        <Shield className="h-5 w-5 text-red-400" />
                      ) : (
                        <Wrench className="h-5 w-5 text-blue-400" />
                      )}
                    </div>
                    
                    {/* User Info */}
                    <div>
                      <div className="flex items-center space-x-2">
                        <h3 className="font-medium text-yellow-100">{user.name}</h3>
                        <span className={`px-2 py-1 text-xs rounded-full ${user.isActive ? 'bg-green-900 bg-opacity-30 text-green-400' : 'bg-gray-700 text-gray-400'}`}>
                          {user.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <div className="text-sm text-yellow-600">@{user.username}</div>
                      <div className="text-xs text-yellow-700 capitalize">{user.role}</div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleToggleActive(user)}
                      className={`p-2 rounded-lg transition-colors ${user.isActive ? 'text-yellow-400 hover:text-yellow-300' : 'text-gray-500 hover:text-gray-400'}`}
                      title={user.isActive ? 'Deactivate User' : 'Activate User'}
                    >
                      {user.isActive ? <Check className="h-4 w-4" /> : <XIcon className="h-4 w-4" />}
                    </button>
                    <button
                      onClick={() => handleEdit(user)}
                      className="p-2 text-yellow-400 hover:text-yellow-300 transition-colors"
                      title="Edit User"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(user)}
                      className="p-2 text-red-400 hover:text-red-300 transition-colors"
                      title="Delete User"
                      disabled={user.id === currentUser?.id}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
