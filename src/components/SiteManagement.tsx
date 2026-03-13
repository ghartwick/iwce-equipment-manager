import { useState, useEffect, useRef } from 'react';
import { Plus, Edit2, Trash2, X, Check, MapPin, Upload } from 'lucide-react';
import { Site, siteManagementService } from '../services/siteManagementService';
import { parseExcelFile } from '../utils/excelImport';

interface SiteManagementProps {
  onClose: () => void;
  currentUser: { username: string; role: string } | null;
}

export function SiteManagement({ onClose, currentUser }: SiteManagementProps) {
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingSite, setEditingSite] = useState<Site | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    isActive: true
  });

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
      if (editingSite) {
        await siteManagementService.updateSite(editingSite.id, formData);
        setSuccess('Site updated successfully');
        setEditingSite(null);
      } else {
        await siteManagementService.addSite({
          ...formData,
          createdBy: currentUser?.username
        });
        setSuccess('Site added successfully');
        setShowAddForm(false);
      }

      setFormData({ name: '', description: '', isActive: true });
      await loadSites();
    } catch (error) {
      setError(editingSite ? 'Failed to update site' : 'Failed to add site');
    }
  };

  const handleEdit = (site: Site) => {
    setEditingSite(site);
    setFormData({
      name: site.name,
      description: site.description || '',
      isActive: site.isActive
    });
    setShowAddForm(false);
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
    setEditingSite(null);
    setFormData({ name: '', description: '', isActive: true });
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setError(null);
    setSuccess(null);

    try {
      const rows = await parseExcelFile(file);
      let addedCount = 0;
      for (const row of rows) {
        await siteManagementService.addSite({
          name: row.name,
          description: row.description || '',
          isActive: true,
          createdBy: currentUser?.username
        });
        addedCount++;
      }
      setSuccess(`Successfully imported ${addedCount} site${addedCount !== 1 ? 's' : ''} from Excel.`);
      await loadSites();
    } catch (err: any) {
      setError(err.message || 'Failed to import from Excel.');
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-black border border-yellow-600 rounded-lg p-6">
          <div className="text-yellow-400">Loading sites...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-black border border-yellow-600 rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-yellow-900 bg-opacity-30 px-6 py-4 border-b border-yellow-700 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <MapPin className="h-6 w-6 text-yellow-300" />
            <h2 className="text-xl font-semibold text-yellow-300">Site Management</h2>
          </div>
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

          {/* Add Site / Import Buttons */}
          {!showAddForm && !editingSite && (
            <div className="mb-6 flex flex-wrap gap-3">
              <button
                onClick={() => setShowAddForm(true)}
                className="flex items-center space-x-2 px-4 py-2 bg-yellow-500 text-black rounded-lg hover:bg-yellow-600 transition-colors"
              >
                <Plus className="h-4 w-4" />
                <span>Add New Site</span>
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={importing}
                className="flex items-center space-x-2 px-4 py-2 bg-yellow-700 text-yellow-100 rounded-lg hover:bg-yellow-600 transition-colors disabled:opacity-50"
              >
                <Upload className="h-4 w-4" />
                <span>{importing ? 'Importing...' : 'Import from Excel'}</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleImportExcel}
                className="hidden"
              />
            </div>
          )}

          {/* Add/Edit Form */}
          {(showAddForm || editingSite) && (
            <div className="mb-6 p-4 bg-yellow-900 bg-opacity-20 border border-yellow-700 rounded-lg">
              <h3 className="text-lg font-medium text-yellow-300 mb-4">
                {editingSite ? 'Edit Site' : 'Add New Site'}
              </h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-yellow-300 mb-1">Site Name</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 bg-black border border-yellow-600 rounded-lg text-yellow-100 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-yellow-300 mb-1">Description</label>
                    <input
                      type="text"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full px-3 py-2 bg-black border border-yellow-600 rounded-lg text-yellow-100 focus:outline-none focus:ring-2 focus:ring-yellow-500"
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
                  <label htmlFor="isActive" className="text-sm text-yellow-300">Active</label>
                </div>
                <div className="flex space-x-2">
                  <button
                    type="submit"
                    className="flex items-center space-x-2 px-4 py-2 bg-yellow-500 text-black rounded-lg hover:bg-yellow-600 transition-colors"
                  >
                    <Check className="h-4 w-4" />
                    <span>{editingSite ? 'Update' : 'Add'} Site</span>
                  </button>
                  <button
                    type="button"
                    onClick={cancelForm}
                    className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Sites List */}
          <div className="space-y-2">
            <h3 className="text-lg font-medium text-yellow-300 mb-3">Sites ({sites.length})</h3>
            {sites.length === 0 ? (
              <div className="text-center py-8 text-yellow-600">
                No sites found. Add your first site above.
              </div>
            ) : (
              <div className="space-y-2">
                {sites.map((site) => (
                  <div
                    key={site.id}
                    className={`p-4 rounded-lg border transition-colors ${
                      site.isActive
                        ? 'bg-yellow-900 bg-opacity-10 border-yellow-700'
                        : 'bg-gray-900 bg-opacity-30 border-gray-700'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <h4 className={`font-medium ${site.isActive ? 'text-yellow-100' : 'text-gray-400'}`}>
                            {site.name}
                          </h4>
                          {!site.isActive && (
                            <span className="px-2 py-0.5 bg-gray-700 text-gray-300 text-xs rounded">
                              Inactive
                            </span>
                          )}
                        </div>
                        {site.description && (
                          <p className={`text-sm mt-1 ${site.isActive ? 'text-yellow-600' : 'text-gray-500'}`}>
                            {site.description}
                          </p>
                        )}
                        <p className="text-xs text-gray-500 mt-2">
                          Created: {site.createdAt.toLocaleDateString()}
                          {site.createdBy && ` by ${site.createdBy}`}
                        </p>
                      </div>
                      <div className="flex space-x-2 ml-4">
                        <button
                          onClick={() => handleToggleActive(site)}
                          className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                            site.isActive
                              ? 'bg-gray-600 text-white hover:bg-gray-700'
                              : 'bg-green-600 text-white hover:bg-green-700'
                          }`}
                          title={site.isActive ? 'Deactivate' : 'Activate'}
                        >
                          {site.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          onClick={() => handleEdit(site)}
                          className="p-2 text-yellow-400 hover:text-yellow-300 transition-colors"
                          title="Edit site"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(site)}
                          className="p-2 text-red-400 hover:text-red-300 transition-colors"
                          title="Delete site"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
