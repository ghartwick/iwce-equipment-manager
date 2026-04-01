import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { siteManagementService, Site, SiteCode } from '../services/siteManagementService';
import { parseExcelFile } from '../utils/excelImport';
import { ArrowLeft, Plus, Trash2, Upload, Save } from 'lucide-react';

export function EditSitePage() {
  const { siteId } = useParams<{ siteId: string }>();
  const navigate = useNavigate();
  
  const [site, setSite] = useState<Site | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    isActive: true
  });
  
  const [codes, setCodes] = useState<SiteCode[]>([]);
  const [newCode, setNewCode] = useState('');
  const [newCodeDescription, setNewCodeDescription] = useState('');
  const [showAddCode, setShowAddCode] = useState(false);
  const [importingCodes, setImportingCodes] = useState(false);
  const codeFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (siteId) {
      loadSite(siteId);
    }
  }, [siteId]);

  const loadSite = async (id: string) => {
    try {
      const siteData = await siteManagementService.getSite(id);
      setSite(siteData);
      setFormData({
        name: siteData.name,
        description: siteData.description || '',
        isActive: siteData.isActive
      });
      setCodes(siteData.codes || []);
    } catch (error: any) {
      setError(error?.message || 'Failed to load site');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!site) return;
    
    setError(null);
    setSuccess(null);
    
    try {
      await siteManagementService.updateSite(site.id, {
        ...formData,
        codes
      });
      setSuccess('Site updated successfully');
      setTimeout(() => navigate('/manage/sites'), 1500);
    } catch (error: any) {
      setError(error?.message || 'Failed to update site');
    }
  };

  const handleAddCode = () => {
    if (!newCode.trim()) return;
    
    if (codes.some(c => c.name === newCode.trim())) {
      setError('A code with this name already exists');
      return;
    }
    
    setCodes([...codes, { 
      name: newCode.trim(), 
      description: newCodeDescription.trim() 
    }]);
    setNewCode('');
    setNewCodeDescription('');
    setShowAddCode(false);
  };

  const handleRemoveCode = (codeName: string) => {
    if (!window.confirm(`Remove code "${codeName}"?`)) return;
    setCodes(codes.filter(c => c.name !== codeName));
  };

  const handleImportCodes = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportingCodes(true);
    setError(null);

    try {
      const rows = await parseExcelFile(file);
      const newCodes: SiteCode[] = rows
        .filter(row => !codes.some(c => c.name === row.name))
        .map(row => ({ name: row.name, description: row.description || '' }));
      
      if (newCodes.length === 0) {
        setError('No new codes to import (all codes already exist)');
      } else {
        setCodes([...codes, ...newCodes]);
        setSuccess(`Imported ${newCodes.length} code${newCodes.length !== 1 ? 's' : ''}`);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to import codes.');
    } finally {
      setImportingCodes(false);
      if (codeFileInputRef.current) codeFileInputRef.current.value = '';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f0e0c8] dark:bg-black text-gray-900 dark:text-yellow-100 px-2 sm:px-4 py-4 -mx-2 sm:-mx-4 lg:mx-0 lg:p-2">
        <div className="max-w-5xl mx-auto">
          <div className="bg-[#fffff0] dark:bg-black border border-yellow-600 rounded-lg p-6">
            <div className="text-yellow-600 dark:text-yellow-400">Loading site...</div>
          </div>
        </div>
      </div>
    );
  }

  if (!site) {
    return (
      <div className="min-h-screen bg-[#f0e0c8] dark:bg-black text-gray-900 dark:text-yellow-100 px-2 sm:px-4 py-4 -mx-2 sm:-mx-4 lg:mx-0 lg:p-2">
        <div className="max-w-5xl mx-auto">
          <div className="bg-[#fffff0] dark:bg-black border border-yellow-600 rounded-lg p-6">
            <div className="text-red-600 dark:text-red-400">Site not found</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f0e0c8] dark:bg-black text-gray-900 dark:text-yellow-100 px-2 sm:px-4 py-4 -mx-2 sm:-mx-4 lg:mx-0 lg:p-2">
      <div className="max-w-5xl mx-auto">
        <div className="bg-[#fffff0] dark:bg-black border border-yellow-600 rounded-lg shadow-xl dark:shadow-yellow-900/20 dark:shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-yellow-100 dark:bg-yellow-900 dark:bg-opacity-30 px-6 py-4 border-b border-yellow-300 dark:border-yellow-700 flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/manage/sites')}
                className="p-2 text-yellow-600 dark:text-yellow-400 hover:text-yellow-500 dark:hover:text-yellow-300 transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div className="flex items-center space-x-2">
                <h2 className="text-xl font-semibold text-yellow-700 dark:text-yellow-300">Edit Site</h2>
              </div>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={handleSave}
                className="flex items-center space-x-2 px-4 py-2 bg-yellow-600 text-black rounded-lg hover:bg-yellow-500 transition-colors"
              >
                <Save className="h-4 w-4" />
                <span>Save Changes</span>
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
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

            {/* Site Information */}
            <div className="mb-8">
              <h3 className="text-lg font-medium text-yellow-700 dark:text-yellow-300 mb-4">Site Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-yellow-700 dark:text-yellow-300 mb-1">Site Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 bg-[#fffff0] dark:bg-black border border-yellow-600 rounded-lg text-gray-900 dark:text-yellow-100 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-yellow-700 dark:text-yellow-300 mb-1">Description</label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 bg-[#fffff0] dark:bg-black border border-yellow-600 rounded-lg text-gray-900 dark:text-yellow-100 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  />
                </div>
              </div>
              <div className="mt-4">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="rounded border-yellow-600 text-yellow-500 focus:ring-yellow-500"
                  />
                  <span className="text-sm text-yellow-700 dark:text-yellow-300">Active</span>
                </label>
              </div>
            </div>

            {/* Site Codes */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-yellow-700 dark:text-yellow-300">Site Codes</h3>
                <div className="flex space-x-2">
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    ref={codeFileInputRef}
                    onChange={handleImportCodes}
                    className="hidden"
                  />
                  <button
                    onClick={() => codeFileInputRef.current?.click()}
                    disabled={importingCodes}
                    className="flex items-center space-x-1 px-3 py-1.5 bg-yellow-700 text-yellow-100 rounded-lg hover:bg-yellow-600 transition-colors text-sm disabled:opacity-50"
                  >
                    <Upload className="h-3 w-3" />
                    <span>{importingCodes ? 'Importing...' : 'Import Codes'}</span>
                  </button>
                  <button
                    onClick={() => setShowAddCode(!showAddCode)}
                    className="flex items-center space-x-1 px-3 py-1.5 bg-yellow-500 text-black rounded-lg hover:bg-yellow-600 transition-colors text-sm"
                  >
                    <Plus className="h-3 w-3" />
                    <span>Add Code</span>
                  </button>
                </div>
              </div>

              {/* Add Code Form */}
              {showAddCode && (
                <div className="mb-4 p-4 bg-yellow-50 dark:bg-yellow-900 dark:bg-opacity-20 border border-yellow-300 dark:border-yellow-700 rounded-lg">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <input
                      type="text"
                      value={newCode}
                      onChange={(e) => setNewCode(e.target.value)}
                      placeholder="Code name"
                      className="px-3 py-2 bg-[#fffff0] dark:bg-black border border-yellow-600 rounded-lg text-gray-900 dark:text-yellow-100 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500"
                    />
                    <input
                      type="text"
                      value={newCodeDescription}
                      onChange={(e) => setNewCodeDescription(e.target.value)}
                      placeholder="Description (optional)"
                      className="px-3 py-2 bg-[#fffff0] dark:bg-black border border-yellow-600 rounded-lg text-gray-900 dark:text-yellow-100 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500"
                    />
                  </div>
                  <div className="mt-3 flex space-x-2">
                    <button
                      onClick={handleAddCode}
                      className="px-3 py-1.5 bg-yellow-500 text-black rounded-lg hover:bg-yellow-600 transition-colors text-sm"
                    >
                      Add Code
                    </button>
                    <button
                      onClick={() => {
                        setShowAddCode(false);
                        setNewCode('');
                        setNewCodeDescription('');
                      }}
                      className="px-3 py-1.5 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Codes List */}
              {codes.length > 0 ? (
                <div className="space-y-2">
                  {codes.map((code) => (
                    <div
                      key={code.name}
                      className="flex items-center justify-between p-3 bg-yellow-50 dark:bg-yellow-900 dark:bg-opacity-20 border border-yellow-300 dark:border-yellow-800 rounded-lg"
                    >
                      <div>
                        <span className="text-gray-900 dark:text-yellow-100 font-medium">{code.name}</span>
                        {code.description && (
                          <span className="text-yellow-700 dark:text-yellow-600 text-sm ml-2">— {code.description}</span>
                        )}
                      </div>
                      <button
                        onClick={() => handleRemoveCode(code.name)}
                        className="text-red-400 hover:text-red-300"
                        title="Remove code"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-yellow-600 dark:text-yellow-400">No codes assigned to this site yet.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
