import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { siteManagementService, Site, SiteCode, SiteRole } from '../services/siteManagementService';
import { clientManagementService, Client } from '../services/clientManagementService';
import { parseExcelFile } from '../utils/excelImport';
import { ArrowLeft, Plus, Trash2, Upload, Save, ChevronDown, X } from 'lucide-react';

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
  
  const [linkedSites, setLinkedSites] = useState<string[]>([]);
  const [allSites, setAllSites] = useState<Site[]>([]);
  const [linkedDropdownOpen, setLinkedDropdownOpen] = useState(false);
  const [linkedSearch, setLinkedSearch] = useState('');
  const linkedDropdownRef = useRef<HTMLDivElement>(null);
  const [codes, setCodes] = useState<SiteCode[]>([]);
  const [newCode, setNewCode] = useState('');
  const [newCodeDescription, setNewCodeDescription] = useState('');
  const [showAddCode, setShowAddCode] = useState(false);
  const [roles, setRoles] = useState<SiteRole[]>([]);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleCost, setNewRoleCost] = useState('');
  const [importingCodes, setImportingCodes] = useState(false);
  const codeFileInputRef = useRef<HTMLInputElement>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [clientAssignmentOpen, setClientAssignmentOpen] = useState(false);
  const [rolesOpen, setRolesOpen] = useState(false);
  const [linkedSitesOpen, setLinkedSitesOpen] = useState(false);

  useEffect(() => {
    if (siteId) {
      loadSite(siteId);
    }
  }, [siteId]);

  useEffect(() => {
    if (!linkedDropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (linkedDropdownRef.current && !linkedDropdownRef.current.contains(e.target as Node)) {
        setLinkedDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [linkedDropdownOpen]);

  const loadSite = async (id: string) => {
    try {
      const [siteData, allSitesData, clientsData] = await Promise.all([
        siteManagementService.getSite(id),
        siteManagementService.getAllSites(),
        clientManagementService.getAllClients(),
      ]);
      setSite(siteData);
      setAllSites(allSitesData.filter(s => s.id !== id));
      setClients(clientsData);
      setSelectedClientId(siteData.clientId || '');
      setFormData({
        name: siteData.name,
        description: siteData.description || '',
        isActive: siteData.isActive
      });
      setCodes((siteData.codes || []).sort((a, b) => {
        const numA = parseFloat(a.name);
        const numB = parseFloat(b.name);
        if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
        return a.name.localeCompare(b.name);
      }));
      setLinkedSites(siteData.linkedSites || []);
      setRoles((siteData.roles || []).slice().sort((a, b) => a.name.localeCompare(b.name)));
    } catch (error: any) {
      setError(error?.message || 'Failed to load site');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSite = async () => {
    if (!site) return;
    const confirmed = window.confirm(
      `⚠️ Permanently delete "${site.name}"?\n\nThis cannot be undone. All codes and roles for this site will be permanently removed.`
    );
    if (!confirmed) return;
    try {
      await siteManagementService.deleteSite(site.id);
      navigate('/manage/sites');
    } catch (err: any) {
      setError(err?.message || 'Failed to delete site');
    }
  };

  const handleChangeClient = async () => {
    if (!site) return;
    try {
      await siteManagementService.updateSite(site.id, { clientId: selectedClientId });
      setSite({ ...site, clientId: selectedClientId });
      setSuccess(selectedClientId ? 'Client updated' : 'Site unassigned from client');
    } catch (err: any) {
      setError(err?.message || 'Failed to update client assignment');
    }
  };

  const handleSave = async () => {
    if (!site) return;
    
    setError(null);
    setSuccess(null);
    
    try {
      await siteManagementService.updateSite(site.id, {
        ...formData,
        codes,
        roles,
        linkedSites
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
    
    const updatedCodes = [...codes, { 
      name: newCode.trim(), 
      description: newCodeDescription.trim() 
    }];
    setCodes(updatedCodes.sort((a, b) => {
      const numA = parseFloat(a.name);
      const numB = parseFloat(b.name);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return a.name.localeCompare(b.name);
    }));
    setNewCode('');
    setNewCodeDescription('');
    setShowAddCode(false);
  };

  const handleRemoveCode = (codeName: string) => {
    if (!window.confirm(`Remove code "${codeName}"?`)) return;
    setCodes(codes.filter(c => c.name !== codeName));
  };

  const handleAddRole = () => {
    const name = newRoleName.trim();
    const cost = parseFloat(newRoleCost);
    if (!name) { setError('Role name is required'); return; }
    if (isNaN(cost) || cost < 0) { setError('Enter a valid cost per hour'); return; }
    if (roles.some(r => r.name.toLowerCase() === name.toLowerCase())) {
      setError('A role with that name already exists');
      return;
    }
    setError(null);
    setRoles([...roles, { name, costPerHour: cost }].sort((a, b) => a.name.localeCompare(b.name)));
    setNewRoleName('');
    setNewRoleCost('');
  };

  const handleRemoveRole = (roleName: string) => {
    if (!window.confirm(`Remove role "${roleName}"?`)) return;
    setRoles(roles.filter(r => r.name !== roleName));
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
        const updatedCodes = [...codes, ...newCodes];
        setCodes(updatedCodes.sort((a, b) => {
          const numA = parseFloat(a.name);
          const numB = parseFloat(b.name);
          if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
          return a.name.localeCompare(b.name);
        }));
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
      <div className="min-h-screen bg-yellow-100 dark:bg-black text-gray-900 dark:text-yellow-100 px-2 sm:px-4 py-4 -mx-2 sm:-mx-4 lg:mx-0 lg:p-2">
        <div className="max-w-5xl mx-auto">
          <div className="bg-yellow-200 dark:bg-black border border-yellow-600 rounded-lg p-6">
            <div className="text-yellow-600 dark:text-yellow-400">Loading site...</div>
          </div>
        </div>
      </div>
    );
  }

  if (!site) {
    return (
      <div className="min-h-screen bg-yellow-100 dark:bg-black text-gray-900 dark:text-yellow-100 px-2 sm:px-4 py-4 -mx-2 sm:-mx-4 lg:mx-0 lg:p-2">
        <div className="max-w-5xl mx-auto">
          <div className="bg-yellow-200 dark:bg-black border border-yellow-600 rounded-lg p-6">
            <div className="text-red-600 dark:text-red-400">Site not found</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-yellow-100 dark:bg-black text-gray-900 dark:text-yellow-100 px-2 sm:px-4 py-4 -mx-2 sm:-mx-4 lg:mx-0 lg:p-2">
      <div className="max-w-5xl mx-auto">
        <div className="bg-yellow-200 dark:bg-black border border-yellow-600 rounded-lg shadow-xl dark:shadow-yellow-900/20 dark:shadow-2xl">
          {/* Header */}
          <div className="bg-yellow-700 dark:bg-yellow-900 dark:bg-opacity-30 px-6 py-4 border-b border-yellow-300 dark:border-yellow-700 flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/manage/sites')}
                className="p-2 text-yellow-100 dark:text-yellow-400 hover:text-yellow-200 dark:hover:text-yellow-300 transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div className="flex items-center space-x-2">
                <h2 className="text-xl font-semibold text-yellow-100 dark:text-yellow-300">Edit Site</h2>
              </div>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={handleDeleteSite}
                className="flex items-center space-x-2 px-4 py-2 bg-red-700 text-white rounded-lg hover:bg-red-600 transition-colors"
              >
                <Trash2 className="h-4 w-4" />
                <span>Delete Site</span>
              </button>
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
              <div className="mt-4 flex items-center space-x-6">
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

            {/* Client Assignment */}
            <div className="mb-4 border border-yellow-300 dark:border-yellow-800 rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => setClientAssignmentOpen(prev => !prev)}
                className="w-full flex items-center justify-between px-4 py-3 bg-yellow-50 dark:bg-yellow-900/10 text-left hover:bg-yellow-100 dark:hover:bg-yellow-900/20 transition-colors"
              >
                <h3 className="text-base font-medium text-yellow-700 dark:text-yellow-300">Client Assignment</h3>
                <ChevronDown className={`h-5 w-5 text-yellow-600 dark:text-yellow-400 transition-transform ${clientAssignmentOpen ? 'rotate-180' : ''}`} />
              </button>
              {clientAssignmentOpen && (
                <div className="px-4 py-4 border-t border-yellow-200 dark:border-yellow-800">
                  <p className="text-sm text-yellow-600 dark:text-yellow-500 mb-3">
                    Change which client this site belongs to, or leave unassigned.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                    <select
                      value={selectedClientId}
                      onChange={(e) => setSelectedClientId(e.target.value)}
                      className="flex-1 px-3 py-2 bg-yellow-200 dark:bg-black border border-yellow-600 rounded-lg text-gray-900 dark:text-yellow-100 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                    >
                      <option value="">— Unassigned —</option>
                      {clients.map(c => (
                        <option key={c.id} value={c.id}>{c.name}{!c.isActive ? ' (inactive)' : ''}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={handleChangeClient}
                      className="px-4 py-2 bg-yellow-600 text-black rounded-lg hover:bg-yellow-500 transition-colors whitespace-nowrap"
                    >
                      Change Client
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Roles & Costing */}
            <div className="mb-4 border border-yellow-300 dark:border-yellow-800 rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => setRolesOpen(prev => !prev)}
                className="w-full flex items-center justify-between px-4 py-3 bg-yellow-50 dark:bg-yellow-900/10 text-left hover:bg-yellow-100 dark:hover:bg-yellow-900/20 transition-colors"
              >
                <h3 className="text-base font-medium text-yellow-700 dark:text-yellow-300">Survey Tasks</h3>
                <ChevronDown className={`h-5 w-5 text-yellow-600 dark:text-yellow-400 transition-transform ${rolesOpen ? 'rotate-180' : ''}`} />
              </button>
              {rolesOpen && (
                <div className="px-4 py-4 border-t border-yellow-200 dark:border-yellow-800">
                  <p className="text-sm text-yellow-600 dark:text-yellow-500 mb-3">
                    Tasks available for survey time cards at this site. Each task's cost per hour drives the entry cost.
                  </p>

                  <div className="flex flex-col sm:flex-row gap-2 mb-3">
                    <input
                      type="text"
                      value={newRoleName}
                      onChange={(e) => setNewRoleName(e.target.value)}
                      placeholder="Role name"
                      className="flex-1 px-3 py-2 bg-yellow-200 dark:bg-black border border-yellow-600 rounded-lg text-gray-900 dark:text-yellow-100 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500"
                    />
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={newRoleCost}
                      onChange={(e) => setNewRoleCost(e.target.value)}
                      placeholder="Cost / hour"
                      className="w-full sm:w-40 px-3 py-2 bg-yellow-200 dark:bg-black border border-yellow-600 rounded-lg text-gray-900 dark:text-yellow-100 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500"
                    />
                    <button
                      type="button"
                      onClick={handleAddRole}
                      className="flex items-center justify-center gap-1 px-4 py-2 bg-yellow-500 text-black rounded-lg hover:bg-yellow-600 transition-colors text-sm whitespace-nowrap"
                    >
                      <Plus className="h-3 w-3" /> Add Role
                    </button>
                  </div>

                  {roles.length > 0 ? (
                    <div className="space-y-2">
                      {roles.map((role) => (
                        <div
                          key={role.name}
                          className="flex items-center justify-between p-3 bg-yellow-50 dark:bg-yellow-900 dark:bg-opacity-20 border border-yellow-300 dark:border-yellow-800 rounded-lg"
                        >
                          <div>
                            <span className="text-gray-900 dark:text-yellow-100 font-medium">{role.name}</span>
                            <span className="text-yellow-700 dark:text-yellow-500 text-sm ml-2">${role.costPerHour.toFixed(2)}/hr</span>
                          </div>
                          <button
                            onClick={() => handleRemoveRole(role.name)}
                            className="text-red-400 hover:text-red-300"
                            title="Remove role"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-yellow-600 dark:text-yellow-400">No roles defined for this site yet.</p>
                  )}
                </div>
              )}
            </div>

            {/* Linked Sites */}
            <div className="mb-4 border border-yellow-300 dark:border-yellow-800 rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => setLinkedSitesOpen(prev => !prev)}
                className="w-full flex items-center justify-between px-4 py-3 bg-yellow-50 dark:bg-yellow-900/10 text-left hover:bg-yellow-100 dark:hover:bg-yellow-900/20 transition-colors"
              >
                <h3 className="text-base font-medium text-yellow-700 dark:text-yellow-300">Co-located Sites</h3>
                <ChevronDown className={`h-5 w-5 text-yellow-600 dark:text-yellow-400 transition-transform ${linkedSitesOpen ? 'rotate-180' : ''}`} />
              </button>
              {linkedSitesOpen && (
                <div className="px-4 py-4 border-t border-yellow-200 dark:border-yellow-800">
                  <p className="text-sm text-yellow-600 dark:text-yellow-500 mb-3">
                    Equipment from selected sites will automatically appear when workers select <strong>{formData.name || 'this site'}</strong> on their timecard.
                  </p>

                  <div className="relative" ref={linkedDropdownRef}>
                    {/* Trigger */}
                    <button
                      type="button"
                      onClick={() => { setLinkedDropdownOpen(prev => !prev); setLinkedSearch(''); }}
                      className="w-full flex items-center justify-between px-3 py-2 bg-yellow-200 dark:bg-black border border-yellow-600 rounded-lg text-left focus:outline-none focus:ring-2 focus:ring-yellow-500"
                    >
                      <span className="text-sm text-gray-900 dark:text-yellow-100 truncate">
                        {linkedSites.length === 0
                          ? 'None selected'
                          : linkedSites.join(', ')}
                      </span>
                      <ChevronDown className={`h-4 w-4 text-yellow-600 dark:text-yellow-400 flex-shrink-0 ml-2 transition-transform ${linkedDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {/* Selected tags */}
                    {linkedSites.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {linkedSites.map(name => (
                          <span
                            key={name}
                            className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-yellow-400 dark:bg-yellow-700 text-yellow-900 dark:text-yellow-100 font-medium"
                          >
                            {name}
                            <button
                              type="button"
                              onClick={() => setLinkedSites(prev => prev.filter(n => n !== name))}
                              className="hover:text-red-700 dark:hover:text-red-300"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Dropdown panel */}
                    {linkedDropdownOpen && (
                      <div className="absolute z-50 mt-1 w-full bg-yellow-50 dark:bg-gray-900 border border-yellow-400 dark:border-yellow-700 rounded-lg shadow-lg overflow-hidden">
                        {/* Search */}
                        <div className="p-2 border-b border-yellow-300 dark:border-yellow-700">
                          <input
                            type="text"
                            autoFocus
                            value={linkedSearch}
                            onChange={e => setLinkedSearch(e.target.value)}
                            placeholder="Filter sites…"
                            className="w-full px-2 py-1.5 text-sm bg-yellow-200 dark:bg-black border border-yellow-400 dark:border-yellow-700 rounded focus:outline-none focus:ring-1 focus:ring-yellow-500 text-gray-900 dark:text-yellow-100"
                          />
                        </div>
                        {/* Options */}
                        <div className="max-h-52 overflow-y-auto">
                          {allSites
                            .filter(s => s.isActive && s.name.toLowerCase().includes(linkedSearch.toLowerCase()))
                            .length === 0 ? (
                              <p className="px-3 py-2 text-sm text-yellow-600 dark:text-yellow-500">No sites match.</p>
                            ) : (
                              allSites
                                .filter(s => s.isActive && (linkedSites.includes(s.name) || s.name.toLowerCase().includes(linkedSearch.toLowerCase())))
                                .map(s => {
                                  const checked = linkedSites.includes(s.name);
                                  return (
                                    <label
                                      key={s.id}
                                      className={`flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors ${
                                        checked
                                          ? 'bg-yellow-100 dark:bg-yellow-900/40'
                                          : 'hover:bg-yellow-100 dark:hover:bg-yellow-900/30'
                                      }`}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={e => {
                                          if (e.target.checked) {
                                            setLinkedSites(prev => [...prev, s.name]);
                                          } else {
                                            setLinkedSites(prev => prev.filter(n => n !== s.name));
                                          }
                                        }}
                                        className="rounded border-yellow-600 text-yellow-500 focus:ring-yellow-500"
                                      />
                                      <div>
                                        <span className="text-sm font-medium text-gray-900 dark:text-yellow-100">{s.name}</span>
                                        {s.description && (
                                          <p className="text-xs text-yellow-600 dark:text-yellow-500">{s.description}</p>
                                        )}
                                      </div>
                                    </label>
                                  );
                                })
                            )}
                        </div>
                        {/* Close */}
                        <div className="p-2 border-t border-yellow-300 dark:border-yellow-700">
                          <button
                            type="button"
                            onClick={() => setLinkedDropdownOpen(false)}
                            className="w-full py-1 text-xs text-yellow-700 dark:text-yellow-400 hover:text-yellow-900 dark:hover:text-yellow-200 font-medium"
                          >
                            Done
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
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
                      className="px-3 py-2 bg-yellow-200 dark:bg-black border border-yellow-600 rounded-lg text-gray-900 dark:text-yellow-100 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500"
                    />
                    <input
                      type="text"
                      value={newCodeDescription}
                      onChange={(e) => setNewCodeDescription(e.target.value)}
                      placeholder="Description (optional)"
                      className="px-3 py-2 bg-yellow-200 dark:bg-black border border-yellow-600 rounded-lg text-gray-900 dark:text-yellow-100 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500"
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
