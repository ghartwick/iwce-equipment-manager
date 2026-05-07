import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Edit2, Trash2, MapPin, ChevronDown, ChevronRight } from 'lucide-react';
import { Site, siteManagementService } from '../services/siteManagementService';

interface SiteManagementProps {
  onClose: () => void;
  currentUser: { username: string; role: string } | null;
  asPage?: boolean;
}

export function SiteManagement({ currentUser, asPage = false }: SiteManagementProps) {
  const navigate = useNavigate();
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    isActive: true
  });
  const [showInactive, setShowInactive] = useState(false);
 

  useEffect(() => {
    loadSites();
  }, []);

  const loadSites = async () => {
    try {
      const sitesData = await siteManagementService.getAllSites();
      setSites(sitesData);
    } catch (error) {
      console.error('Failed to load sites:', error);
      setError('Failed to load sites');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    try {
      await siteManagementService.addSite({
        ...formData,
        createdBy: currentUser?.username
      });
      setSuccess('Site added successfully');
      setShowAddForm(false);
      setFormData({ name: '', description: '', isActive: true });
      await loadSites();
    } catch (error) {
      setError('Failed to add site');
    }
  };

  const handleEdit = (site: Site) => {
    navigate(`/admin/sites/edit/${site.id}`);
  };


  const handleDelete = async (site: Site) => {
    if (!window.confirm(`Are you sure you want to delete "${site.name}"?`)) {
      return;
    }

    try {
      await siteManagementService.deleteSite(site.id);
      setSuccess('Site deleted successfully');
      await loadSites();
    } catch (error) {
      setError('Failed to delete site');
    }
  };

  const handleToggleActive = async (site: Site) => {
    try {
      await siteManagementService.updateSite(site.id, { isActive: !site.isActive });
      setSuccess(`Site ${!site.isActive ? 'activated' : 'deactivated'} successfully`);
      await loadSites();
    } catch (error) {
      setError('Failed to update site status');
    }
  };

  const cancelForm = () => {
    setShowAddForm(false);
    setFormData({ name: '', description: '', isActive: true });
  };

  const filteredSites = sites.filter(site =>
    site.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    site.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  const activeSites = filteredSites.filter(site => site.isActive);
  const inactiveSites = filteredSites.filter(site => !site.isActive);


  if (loading) {
    if (asPage) {
      return (
        <div className="min-h-screen bg-yellow-100 dark:bg-black text-gray-900 dark:text-yellow-100 px-2 sm:px-4 py-4 -mx-2 sm:-mx-4 lg:mx-0 lg:p-2">
          <div className="max-w-5xl mx-auto">
            <div className="bg-yellow-200 dark:bg-black border border-yellow-600 rounded-lg p-6">
              <div className="text-yellow-600 dark:text-yellow-400">Loading sites...</div>
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-yellow-200 dark:bg-black border border-yellow-600 rounded-lg p-6">
          <div className="text-yellow-600 dark:text-yellow-400">Loading sites...</div>
        </div>
      </div>
    );
  }

  const inner = (
    <>
        {/* Header */}
        <div className="bg-yellow-700 dark:bg-yellow-900 dark:bg-opacity-30 px-6 py-4 border-b border-yellow-300 dark:border-yellow-700">
          <div className="flex items-center space-x-2">
            <MapPin className="h-6 w-6 text-yellow-100 dark:text-yellow-300" />
            <h2 className="text-xl font-semibold text-yellow-100 dark:text-yellow-300">Site Management</h2>
          </div>
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
          {!showAddForm && (
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <input
                type="text"
                placeholder="Search sites..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1 px-4 py-2 border border-yellow-600 rounded-lg bg-yellow-200 dark:bg-black text-gray-900 dark:text-yellow-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
              />
              {currentUser?.role === 'admin' && (
                <button
                  onClick={() => setShowAddForm(true)}
                  className="flex items-center space-x-2 px-4 py-2 bg-yellow-600 text-black rounded-lg hover:bg-yellow-500 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  <span>Add Site</span>
                </button>
              )}
            </div>
          )}

          {/* Add Form */}
          {showAddForm && (
            <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900 dark:bg-opacity-20 border border-yellow-300 dark:border-yellow-700 rounded-lg">
              <h3 className="text-lg font-medium text-yellow-700 dark:text-yellow-300 mb-4">Add New Site</h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-yellow-700 dark:text-yellow-300 mb-1">Site Name</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 bg-yellow-200 dark:bg-black border border-yellow-600 rounded-lg text-gray-900 dark:text-yellow-100 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-yellow-700 dark:text-yellow-300 mb-1">Description</label>
                    <input
                      type="text"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full px-3 py-2 bg-yellow-200 dark:bg-black border border-yellow-600 rounded-lg text-gray-900 dark:text-yellow-100 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                    />
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="rounded border-yellow-600 text-yellow-500 focus:ring-yellow-500"
                  />
                  <label htmlFor="isActive" className="text-sm text-yellow-700 dark:text-yellow-300">Active</label>
                </div>
                <div className="flex space-x-2">
                  <button
                    type="submit"
                    className="flex items-center space-x-2 px-4 py-2 bg-yellow-500 text-black rounded-lg hover:bg-yellow-600 transition-colors"
                  >
                    <span>Add</span>
                    <span>Add Site</span>
                  </button>
                  <button
                    type="button"
                    onClick={cancelForm}
                    className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Sites List */}
          <div className="space-y-2">
            <h3 className="text-lg font-medium text-yellow-700 dark:text-yellow-300 mb-3">
              Sites {searchTerm && `(filtered: ${filteredSites.length}/${sites.length})`}
            </h3>
            {filteredSites.length === 0 ? (
              <div className="text-center py-8 text-yellow-600">
                {searchTerm ? 'No sites found matching your search.' : 'No sites found. Add your first site above.'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-yellow-600 dark:bg-yellow-900 dark:bg-opacity-30">
                      <th className="px-4 py-2 text-left text-yellow-100 dark:text-yellow-300">Site Name</th>
                      <th className="px-4 py-2 text-left text-yellow-100 dark:text-yellow-300">Description</th>
                      <th className="px-4 py-2 text-center text-yellow-100 dark:text-yellow-300">Codes</th>
                      <th className="px-4 py-2 text-center text-yellow-100 dark:text-yellow-300">Active</th>
                      <th className="px-4 py-2 text-center text-yellow-100 dark:text-yellow-300">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Active Sites */}
                    {activeSites.map((site) => (
                      <tr key={site.id} className="border-b border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900 dark:bg-opacity-10">
                        <td className="px-4 py-2">
                          <div>
                            <div className="font-medium text-gray-900 dark:text-yellow-100">
                              {site.name}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              Created: {site.createdAt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                              {site.createdBy && ` by ${site.createdBy}`}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-2">
                          <span className="text-sm text-yellow-700 dark:text-yellow-600">
                            {site.description || '-'}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-center">
                          <span className="text-xs text-yellow-500">
                            {(site.codes || []).length}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-center">
                          <button
                            onClick={() => handleToggleActive(site)}
                            className={`p-1 rounded transition-colors ${
                              site.isActive 
                                ? 'text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900 dark:hover:bg-opacity-30' 
                                : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                            }`}
                            title={site.isActive ? 'Active (click to deactivate)' : 'Inactive (click to activate)'}
                          >
                            {site.isActive ? '✓' : '-'}
                          </button>
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex space-x-1">
                            <button
                              onClick={() => handleEdit(site)}
                              className="p-1 text-yellow-600 hover:text-yellow-500"
                              title="Edit site"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(site)}
                              className="p-1 text-red-600 hover:text-red-500"
                              title="Delete site"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    
                    {/* Inactive Sites Section */}
                    {inactiveSites.length > 0 && (
                      <>
                        <tr>
                          <td colSpan={5} className="px-4 py-2 bg-gray-100 dark:bg-gray-900 dark:bg-opacity-30">
                            <button
                              onClick={() => setShowInactive(!showInactive)}
                              className="flex items-center space-x-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                            >
                              {showInactive ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                              <span>Inactive Sites ({inactiveSites.length})</span>
                            </button>
                          </td>
                        </tr>
                        {showInactive && inactiveSites.map((site) => (
                          <tr key={site.id} className="border-b border-yellow-200 dark:border-yellow-800 bg-gray-100 dark:bg-gray-900 dark:bg-opacity-30">
                            <td className="px-4 py-2">
                              <div>
                                <div className="font-medium text-gray-500 dark:text-gray-400">
                                  {site.name}
                                </div>
                                <div className="text-xs text-gray-500 mt-1">
                                  Created: {site.createdAt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                                  {site.createdBy && ` by ${site.createdBy}`}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-2">
                              <span className="text-sm text-gray-500">
                                {site.description || '-'}
                              </span>
                            </td>
                            <td className="px-4 py-2 text-center">
                              <span className="text-xs text-gray-500">
                                {(site.codes || []).length}
                              </span>
                            </td>
                            <td className="px-4 py-2 text-center">
                              <button
                                onClick={() => handleToggleActive(site)}
                                className={`p-1 rounded transition-colors ${
                                  site.isActive 
                                    ? 'text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900 dark:hover:bg-opacity-30' 
                                    : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                                }`}
                                title={site.isActive ? 'Active (click to deactivate)' : 'Inactive (click to activate)'}
                              >
                                {site.isActive ? '✓' : '-'}
                              </button>
                            </td>
                            <td className="px-4 py-2">
                              <div className="flex space-x-1">
                                <button
                                  onClick={() => handleEdit(site)}
                                  className="p-1 text-yellow-600 hover:text-yellow-500"
                                  title="Edit site"
                                >
                                  <Edit2 className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => handleDelete(site)}
                                  className="p-1 text-red-600 hover:text-red-500"
                                  title="Delete site"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
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
