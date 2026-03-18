import { useState, useEffect, useRef } from 'react';
import { Plus, Edit2, Trash2, X, Check, MapPin, Upload, Code2, ChevronDown, ChevronUp } from 'lucide-react';
import { Site, SiteCode, siteManagementService } from '../services/siteManagementService';
import { parseExcelFile } from '../utils/excelImport';

interface SiteManagementProps {
  onClose: () => void;
  currentUser: { username: string; role: string } | null;
}

export function SiteManagement({ onClose, currentUser }: SiteManagementProps) {
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingSiteId, setEditingSiteId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    isActive: true
  });
  const [editFormData, setEditFormData] = useState<{[key: string]: {name: string, description: string, isActive: boolean}}>({}); 
  const [newCode, setNewCode] = useState('');
  const [newCodeDescription, setNewCodeDescription] = useState('');
  const [expandedSiteId, setExpandedSiteId] = useState<string | null>(null);
  const codeFileInputRefs = useRef<{[key: string]: HTMLInputElement | null}>({});
  const [importingCodes, setImportingCodes] = useState<{[key: string]: boolean}>({});

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

  const handleUpdateSite = async (siteId: string) => {
    setError(null);
    setSuccess(null);
    const data = editFormData[siteId];
    if (!data) return;

    try {
      await siteManagementService.updateSite(siteId, data);
      setSuccess('Site updated successfully');
      setEditingSiteId(null);
      setEditFormData(prev => {
        const newData = {...prev};
        delete newData[siteId];
        return newData;
      });
      await loadSites();
    } catch (error) {
      setError('Failed to update site');
    }
  };

  const handleEdit = (site: Site) => {
    if (editingSiteId === site.id) {
      // Close edit form
      setEditingSiteId(null);
      setEditFormData(prev => {
        const newData = {...prev};
        delete newData[site.id];
        return newData;
      });
    } else {
      // Open edit form
      setEditingSiteId(site.id);
      setEditFormData(prev => ({
        ...prev,
        [site.id]: {
          name: site.name,
          description: site.description || '',
          isActive: site.isActive
        }
      }));
      setShowAddForm(false);
    }
  };

  const handleAddCode = async (siteId: string) => {
    if (!newCode.trim()) return;
    const site = sites.find(s => s.id === siteId);
    if (!site) return;
    const existingCodes: SiteCode[] = site.codes || [];
    if (existingCodes.some(c => c.name === newCode.trim())) {
      setError('This code already exists for this site.');
      return;
    }
    try {
      const newEntry: SiteCode = { name: newCode.trim(), description: newCodeDescription.trim() };
      await siteManagementService.updateSite(siteId, { codes: [...existingCodes, newEntry] });
      setNewCode('');
      setNewCodeDescription('');
      setSuccess('Code added successfully');
      await loadSites();
    } catch (err) {
      setError('Failed to add code');
    }
  };

  const handleRemoveCode = async (siteId: string, codeName: string) => {
    const site = sites.find(s => s.id === siteId);
    if (!site) return;
    const updatedCodes = (site.codes || []).filter(c => c.name !== codeName);
    try {
      await siteManagementService.updateSite(siteId, { codes: updatedCodes });
      setSuccess('Code removed successfully');
      await loadSites();
    } catch (err) {
      setError('Failed to remove code');
    }
  };

  const handleImportCodes = async (siteId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportingCodes(prev => ({ ...prev, [siteId]: true }));
    setError(null);
    setSuccess(null);
    try {
      const rows = await parseExcelFile(file);
      const site = sites.find(s => s.id === siteId);
      if (!site) return;
      const existingCodes: SiteCode[] = site.codes || [];
      const newCodes: SiteCode[] = rows
        .filter(row => !existingCodes.some(c => c.name === row.name))
        .map(row => ({ name: row.name, description: row.description || '' }));
      await siteManagementService.updateSite(siteId, { codes: [...existingCodes, ...newCodes] });
      setSuccess(`Imported ${newCodes.length} code${newCodes.length !== 1 ? 's' : ''}`);
      await loadSites();
    } catch (err: any) {
      setError(err.message || 'Failed to import codes.');
    } finally {
      setImportingCodes(prev => ({ ...prev, [siteId]: false }));
      if (codeFileInputRefs.current[siteId]) codeFileInputRefs.current[siteId]!.value = '';
    }
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


  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-black border border-yellow-600 rounded-lg p-6">
          <div className="text-yellow-600 dark:text-yellow-400">Loading sites...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-black border border-yellow-600 rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-yellow-100 dark:bg-yellow-900 dark:bg-opacity-30 px-6 py-4 border-b border-yellow-300 dark:border-yellow-700 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <MapPin className="h-6 w-6 text-yellow-600 dark:text-yellow-300" />
            <h2 className="text-xl font-semibold text-yellow-700 dark:text-yellow-300">Site Management</h2>
          </div>
          <button
            onClick={onClose}
            className="text-yellow-600 dark:text-yellow-400 hover:text-yellow-500 dark:hover:text-yellow-300 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
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

          {/* Add Site / Import Buttons */}
          {!showAddForm && !editingSiteId && (
            <div className="mb-6 flex flex-wrap gap-3">
              <button
                onClick={() => setShowAddForm(true)}
                className="flex items-center space-x-2 px-4 py-2 bg-yellow-500 text-black rounded-lg hover:bg-yellow-600 transition-colors"
              >
                <Plus className="h-4 w-4" />
                <span>Add New Site</span>
              </button>
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
                      className="w-full px-3 py-2 bg-white dark:bg-black border border-yellow-600 rounded-lg text-gray-900 dark:text-yellow-100 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-yellow-700 dark:text-yellow-300 mb-1">Description</label>
                    <input
                      type="text"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full px-3 py-2 bg-white dark:bg-black border border-yellow-600 rounded-lg text-gray-900 dark:text-yellow-100 focus:outline-none focus:ring-2 focus:ring-yellow-500"
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
                    <Check className="h-4 w-4" />
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
            <h3 className="text-lg font-medium text-yellow-700 dark:text-yellow-300 mb-3">Sites ({sites.length})</h3>
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
                        ? 'bg-yellow-50 dark:bg-yellow-900 dark:bg-opacity-10 border-yellow-300 dark:border-yellow-700'
                        : 'bg-gray-100 dark:bg-gray-900 dark:bg-opacity-30 border-gray-300 dark:border-gray-700'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <h4 className={`font-medium ${site.isActive ? 'text-gray-900 dark:text-yellow-100' : 'text-gray-500 dark:text-gray-400'}`}>
                            {site.name}
                          </h4>
                          {!site.isActive && (
                            <span className="px-2 py-0.5 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs rounded">
                              Inactive
                            </span>
                          )}
                        </div>
                        {site.description && (
                          <p className={`text-sm mt-1 ${site.isActive ? 'text-yellow-700 dark:text-yellow-600' : 'text-gray-500'}`}>
                            {site.description}
                          </p>
                        )}
                        <p className="text-xs text-gray-500 mt-2">
                          Created: {site.createdAt.toLocaleDateString()}
                          {site.createdBy && ` by ${site.createdBy}`}
                        </p>
                        {/* Codes count */}
                        <div className="flex items-center space-x-1 mt-1">
                          <Code2 className="h-3 w-3 text-yellow-500" />
                          <span className="text-xs text-yellow-500">
                            {(site.codes || []).length} code{(site.codes || []).length !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </div>
                      <div className="flex space-x-2 ml-4">
                        <button
                          onClick={() => setExpandedSiteId(expandedSiteId === site.id ? null : site.id)}
                          className="p-2 text-yellow-600 dark:text-yellow-400 hover:text-yellow-500 dark:hover:text-yellow-300 transition-colors"
                          title="Manage codes"
                        >
                          {expandedSiteId === site.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>
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
                          className="p-2 text-yellow-600 dark:text-yellow-400 hover:text-yellow-500 dark:hover:text-yellow-300 transition-colors"
                          title="Edit site"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(site)}
                          className="p-2 text-red-500 dark:text-red-400 hover:text-red-400 dark:hover:text-red-300 transition-colors"
                          title="Delete site"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {/* Inline Edit Form */}
                    {editingSiteId === site.id && editFormData[site.id] && (
                      <div className="mt-3 pt-3 border-t border-yellow-200 dark:border-yellow-800">
                        <h5 className="text-sm font-medium text-yellow-700 dark:text-yellow-300 mb-3">Edit Site</h5>
                        <div className="space-y-3">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-medium text-yellow-700 dark:text-yellow-300 mb-1">Site Name</label>
                              <input
                                type="text"
                                value={editFormData[site.id].name}
                                onChange={(e) => setEditFormData(prev => ({
                                  ...prev,
                                  [site.id]: { ...prev[site.id], name: e.target.value }
                                }))}
                                className="w-full px-3 py-2 bg-white dark:bg-black border border-yellow-600 rounded-lg text-gray-900 dark:text-yellow-100 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500"
                                required
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-yellow-700 dark:text-yellow-300 mb-1">Description</label>
                              <input
                                type="text"
                                value={editFormData[site.id].description}
                                onChange={(e) => setEditFormData(prev => ({
                                  ...prev,
                                  [site.id]: { ...prev[site.id], description: e.target.value }
                                }))}
                                className="w-full px-3 py-2 bg-white dark:bg-black border border-yellow-600 rounded-lg text-gray-900 dark:text-yellow-100 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500"
                              />
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              id={`isActive-${site.id}`}
                              checked={editFormData[site.id].isActive}
                              onChange={(e) => setEditFormData(prev => ({
                                ...prev,
                                [site.id]: { ...prev[site.id], isActive: e.target.checked }
                              }))}
                              className="rounded border-yellow-600 text-yellow-500 focus:ring-yellow-500"
                            />
                            <label htmlFor={`isActive-${site.id}`} className="text-xs text-yellow-700 dark:text-yellow-300">Active</label>
                          </div>
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleUpdateSite(site.id)}
                              className="flex items-center space-x-1 px-3 py-1.5 bg-yellow-500 text-black rounded-lg hover:bg-yellow-600 transition-colors text-sm"
                            >
                              <Check className="h-3 w-3" />
                              <span>Update</span>
                            </button>
                            <button
                              onClick={() => handleEdit(site)}
                              className="px-3 py-1.5 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors text-sm"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Expanded Codes Section */}
                    {expandedSiteId === site.id && (
                      <div className="mt-3 pt-3 border-t border-yellow-200 dark:border-yellow-800">
                        <div className="flex items-center space-x-2 mb-2">
                          <Code2 className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                          <h5 className="text-sm font-medium text-yellow-700 dark:text-yellow-300">Site Codes</h5>
                        </div>

                        {/* Existing Codes */}
                        {(site.codes || []).length > 0 ? (
                          <div className="space-y-1 mb-3">
                            {(site.codes || []).map((code) => (
                              <div
                                key={code.name}
                                className="flex items-center justify-between px-3 py-2 bg-yellow-50 dark:bg-yellow-900 dark:bg-opacity-20 border border-yellow-300 dark:border-yellow-800 rounded-lg"
                              >
                                <div>
                                  <span className="text-gray-900 dark:text-yellow-100 text-sm font-medium">{code.name}</span>
                                  {code.description && (
                                    <span className="text-yellow-700 dark:text-yellow-600 text-xs ml-2">— {code.description}</span>
                                  )}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveCode(site.id, code.name)}
                                  className="text-red-400 hover:text-red-300 ml-2 flex-shrink-0"
                                  title="Remove code"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-yellow-600 mb-3">No codes assigned to this site yet.</p>
                        )}

                        {/* Add Code Inputs */}
                        <div className="space-y-2">
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={newCode}
                              onChange={(e) => setNewCode(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleAddCode(site.id);
                                }
                              }}
                              placeholder="Code name"
                              className="flex-1 px-3 py-1.5 bg-white dark:bg-black border border-yellow-600 rounded-lg text-gray-900 dark:text-yellow-100 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500"
                            />
                            <input
                              type="text"
                              value={newCodeDescription}
                              onChange={(e) => setNewCodeDescription(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleAddCode(site.id);
                                }
                              }}
                              placeholder="Description (optional)"
                              className="flex-1 px-3 py-1.5 bg-white dark:bg-black border border-yellow-600 rounded-lg text-gray-900 dark:text-yellow-100 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500"
                            />
                            <button
                              onClick={() => handleAddCode(site.id)}
                              className="flex items-center space-x-1 px-3 py-1.5 bg-yellow-500 text-black rounded-lg hover:bg-yellow-600 transition-colors text-sm flex-shrink-0"
                            >
                              <Plus className="h-3 w-3" />
                              <span>Add</span>
                            </button>
                          </div>
                          {/* Import Codes from Excel */}
                          <div>
                            <input
                              type="file"
                              accept=".xlsx,.xls,.csv"
                              ref={(el) => { codeFileInputRefs.current[site.id] = el; }}
                              onChange={(e) => handleImportCodes(site.id, e)}
                              className="hidden"
                            />
                            <button
                              onClick={() => codeFileInputRefs.current[site.id]?.click()}
                              disabled={importingCodes[site.id]}
                              className="flex items-center space-x-1 px-3 py-1.5 bg-yellow-700 text-yellow-100 rounded-lg hover:bg-yellow-600 transition-colors text-sm disabled:opacity-50"
                            >
                              <Upload className="h-3 w-3" />
                              <span>{importingCodes[site.id] ? 'Importing...' : 'Import Codes from Excel'}</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
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
