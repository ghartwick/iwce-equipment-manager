import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Edit2, Trash2, Building2, ChevronDown, ChevronRight, MapPin } from 'lucide-react';
import { Client, clientManagementService } from '../services/clientManagementService';
import { Site, siteManagementService } from '../services/siteManagementService';

interface ClientManagementProps {
  currentUser: { username: string; role: string } | null;
}

interface ClientFormState {
  name: string;
  description: string;
  isActive: boolean;
  allowFieldUsers: boolean;
  allowSupervisorUsers: boolean;
}

interface SiteFormState {
  name: string;
  description: string;
  isActive: boolean;
  flagRed: boolean;
}

const emptyClientForm: ClientFormState = { name: '', description: '', isActive: true, allowFieldUsers: false, allowSupervisorUsers: false };
const emptySiteForm: SiteFormState = { name: '', description: '', isActive: true, flagRed: false };

export function ClientManagement({ currentUser }: ClientManagementProps) {
  const navigate = useNavigate();
  const isAdmin = currentUser?.role === 'admin';

  const [clients, setClients] = useState<Client[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Client form
  const [showClientForm, setShowClientForm] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [clientForm, setClientForm] = useState<ClientFormState>(emptyClientForm);

  // Expansion + nested site forms
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [addSiteForClient, setAddSiteForClient] = useState<string | null>(null);
  const [siteForm, setSiteForm] = useState<SiteFormState>(emptySiteForm);

  // Assigning existing unassigned sites
  const [assignTargets, setAssignTargets] = useState<Record<string, string>>({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [clientsData, sitesData] = await Promise.all([
        clientManagementService.getAllClients(),
        siteManagementService.getAllSites(),
      ]);
      setClients(clientsData);
      setSites(sitesData);
    } catch (err) {
      console.error('Failed to load clients:', err);
      setError('Failed to load clients');
    } finally {
      setLoading(false);
    }
  };

  const sitesForClient = (clientId: string) => sites.filter(s => s.clientId === clientId);
  const unassignedSites = sites.filter(s => !s.clientId);

  // ----- Client form handlers -----
  const openAddClient = () => {
    setEditingClient(null);
    setClientForm(emptyClientForm);
    setShowClientForm(true);
  };

  const openEditClient = (client: Client) => {
    setEditingClient(client);
    setClientForm({
      name: client.name,
      description: client.description || '',
      isActive: client.isActive,
      allowFieldUsers: client.allowFieldUsers ?? false,
      allowSupervisorUsers: client.allowSupervisorUsers ?? false,
    });
    setShowClientForm(true);
  };

  const cancelClientForm = () => {
    setShowClientForm(false);
    setEditingClient(null);
    setClientForm(emptyClientForm);
  };

  const handleToggleFieldAccess = (checked: boolean) => {
    setClientForm(prev => ({ ...prev, allowFieldUsers: checked }));
    if (editingClient) setEditingClient({ ...editingClient, allowFieldUsers: checked });
  };

  const handleToggleSupervisorAccess = (checked: boolean) => {
    setClientForm(prev => ({ ...prev, allowSupervisorUsers: checked }));
    if (editingClient) setEditingClient({ ...editingClient, allowSupervisorUsers: checked });
  };

  const handleClientSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!clientForm.name.trim()) { setError('Client name is required'); return; }

    try {
      if (editingClient) {
        await clientManagementService.updateClient(editingClient.id, {
          name: clientForm.name.trim(),
          description: clientForm.description.trim(),
          isActive: clientForm.isActive,
          allowFieldUsers: clientForm.allowFieldUsers,
          allowSupervisorUsers: clientForm.allowSupervisorUsers,
        });
        setSuccess('Client updated successfully');
      } else {
        await clientManagementService.addClient({
          name: clientForm.name.trim(),
          description: clientForm.description.trim(),
          isActive: clientForm.isActive,
          allowFieldUsers: clientForm.allowFieldUsers,
          allowSupervisorUsers: clientForm.allowSupervisorUsers,
          createdBy: currentUser?.username,
        });
        setSuccess('Client added successfully');
      }
      cancelClientForm();
      await loadData();
    } catch (err) {
      console.error('Failed to save client:', err);
      setError('Failed to save client');
    }
  };

  const handleDeleteClient = async (client: Client) => {
    const assigned = sitesForClient(client.id);
    const msg = assigned.length
      ? `Delete client "${client.name}"? Its ${assigned.length} site(s) will become unassigned (not deleted).`
      : `Delete client "${client.name}"?`;
    if (!window.confirm(msg)) return;
    try {
      await Promise.all(assigned.map(s => siteManagementService.updateSite(s.id, { clientId: '' })));
      await clientManagementService.deleteClient(client.id);
      setSuccess('Client deleted successfully');
      await loadData();
    } catch (err) {
      console.error('Failed to delete client:', err);
      setError('Failed to delete client');
    }
  };

  // ----- Site handlers -----
  const toggleExpand = (id: string) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

  const openAddSite = (clientId: string) => {
    setAddSiteForClient(clientId);
    setSiteForm(emptySiteForm);
    setExpanded(prev => ({ ...prev, [clientId]: true }));
  };

  const handleSiteSubmit = async (e: React.FormEvent, clientId: string) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!siteForm.name.trim()) { setError('Site name is required'); return; }
    try {
      await siteManagementService.addSite({
        name: siteForm.name.trim(),
        description: siteForm.description.trim(),
        isActive: siteForm.isActive,
        flagRed: siteForm.flagRed,
        clientId,
        createdBy: currentUser?.username,
      } as Omit<Site, 'id' | 'createdAt' | 'updatedAt'>);
      setSuccess('Site added successfully');
      setAddSiteForClient(null);
      setSiteForm(emptySiteForm);
      await loadData();
    } catch (err) {
      console.error('Failed to add site:', err);
      setError('Failed to add site');
    }
  };

  const handleAssignSite = async (site: Site) => {
    const target = assignTargets[site.id];
    if (!target) { setError('Choose a client to assign this site to'); return; }
    try {
      await siteManagementService.updateSite(site.id, { clientId: target });
      setSuccess(`"${site.name}" assigned successfully`);
      setAssignTargets(prev => { const n = { ...prev }; delete n[site.id]; return n; });
      await loadData();
    } catch (err) {
      setError('Failed to assign site');
    }
  };

  const inputClass = 'w-full px-3 py-2 bg-yellow-200 dark:bg-black border border-yellow-600 rounded-lg text-gray-900 dark:text-yellow-100 focus:outline-none focus:ring-2 focus:ring-yellow-500';
  const labelClass = 'block text-sm font-medium text-yellow-700 dark:text-yellow-300 mb-1';

  if (loading) {
    return <div className="text-yellow-600 dark:text-yellow-400 p-4">Loading clients...</div>;
  }

  return (
    <div>
      {error && (
        <div className="mb-4 p-3 bg-red-100 dark:bg-red-900 dark:bg-opacity-30 border border-red-600 rounded-lg text-red-600 dark:text-red-300">{error}</div>
      )}
      {success && (
        <div className="mb-4 p-3 bg-green-100 dark:bg-green-900 dark:bg-opacity-30 border border-green-600 rounded-lg text-green-700 dark:text-green-300">{success}</div>
      )}

      {!showClientForm && isAdmin && (
        <div className="flex justify-end mb-4">
          <button onClick={openAddClient} className="flex items-center space-x-2 px-4 py-2 bg-yellow-600 text-black rounded-lg hover:bg-yellow-500 transition-colors">
            <Plus className="h-4 w-4" />
            <span>Add Client</span>
          </button>
        </div>
      )}

      {/* Client form */}
      {showClientForm && (
        <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900 dark:bg-opacity-20 border border-yellow-300 dark:border-yellow-700 rounded-lg">
          <h3 className="text-lg font-medium text-yellow-700 dark:text-yellow-300 mb-4">
            {editingClient ? 'Edit Client' : 'Add New Client'}
          </h3>
          <form onSubmit={handleClientSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Client Name</label>
                <input type="text" value={clientForm.name} onChange={(e) => setClientForm({ ...clientForm, name: e.target.value })} className={inputClass} required />
              </div>
              <div>
                <label className={labelClass}>Description</label>
                <input type="text" value={clientForm.description} onChange={(e) => setClientForm({ ...clientForm, description: e.target.value })} className={inputClass} />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <input type="checkbox" id="clientIsActive" checked={clientForm.isActive} onChange={(e) => setClientForm({ ...clientForm, isActive: e.target.checked })} className="rounded border-yellow-600 text-yellow-500 focus:ring-yellow-500" />
              <label htmlFor="clientIsActive" className="text-sm text-yellow-700 dark:text-yellow-300">Active</label>
            </div>

            {/* Role-based client access */}
            <div className="p-3 rounded-lg border border-yellow-300 dark:border-yellow-700 bg-yellow-100/60 dark:bg-yellow-900/20">
              <label className={labelClass}>Timecard Access</label>
              <p className="text-xs text-yellow-600 dark:text-yellow-500 mb-2">
                Checked clients are visible to the selected user roles in the timecard app. Admins always see every active client.
              </p>
              <div className="space-y-2">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={clientForm.allowFieldUsers}
                    onChange={(e) => handleToggleFieldAccess(e.target.checked)}
                    className="rounded border-yellow-600 text-yellow-500 focus:ring-yellow-500"
                  />
                  <span className="text-sm text-yellow-700 dark:text-yellow-300">Allow field users access</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={clientForm.allowSupervisorUsers}
                    onChange={(e) => handleToggleSupervisorAccess(e.target.checked)}
                    className="rounded border-yellow-600 text-yellow-500 focus:ring-yellow-500"
                  />
                  <span className="text-sm text-yellow-700 dark:text-yellow-300">Allow Supervisor users access</span>
                </label>
              </div>
            </div>

            <div className="flex space-x-2">
              <button type="submit" className="px-4 py-2 bg-yellow-500 text-black rounded-lg hover:bg-yellow-600 transition-colors">
                {editingClient ? 'Update Client' : 'Add Client'}
              </button>
              <button type="button" onClick={cancelClientForm} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Clients list with nested sites */}
      <div className="space-y-2">
        <h3 className="text-lg font-medium text-yellow-700 dark:text-yellow-300 mb-3">Clients</h3>
        {clients.length === 0 ? (
          <div className="text-center py-8 text-yellow-600">No clients yet. Add your first client above.</div>
        ) : (
          <div className="space-y-2">
            {clients.map(client => {
              const clientSites = sitesForClient(client.id);
              const isOpen = !!expanded[client.id];
              return (
                <div key={client.id} className="border border-yellow-300 dark:border-yellow-800 rounded-lg overflow-hidden">
                  {/* Client header */}
                  <div className="flex items-center justify-between px-4 py-3 bg-yellow-50 dark:bg-yellow-900 dark:bg-opacity-10">
                    <button onClick={() => toggleExpand(client.id)} className="flex items-center gap-2 text-left flex-1">
                      {isOpen ? <ChevronDown className="h-4 w-4 text-yellow-600" /> : <ChevronRight className="h-4 w-4 text-yellow-600" />}
                      <Building2 className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                      <div>
                        <div className="font-medium text-gray-900 dark:text-yellow-100">{client.name}</div>
                        {client.description && <div className="text-xs text-yellow-700 dark:text-yellow-600">{client.description}</div>}
                      </div>
                    </button>
                    <div className="flex items-center gap-3">
                      {client.allowFieldUsers && (
                        <span className="inline-flex items-center px-2 py-1 text-xs rounded-full bg-blue-100 dark:bg-blue-900 dark:bg-opacity-30 text-blue-700 dark:text-blue-400 font-medium">
                          Field
                        </span>
                      )}
                      {client.allowSupervisorUsers && (
                        <span className="inline-flex items-center px-2 py-1 text-xs rounded-full bg-purple-100 dark:bg-purple-900 dark:bg-opacity-30 text-purple-700 dark:text-purple-400 font-medium">
                          Supervisor
                        </span>
                      )}
                      <span className="text-xs text-yellow-700 dark:text-yellow-400">{clientSites.length} site(s)</span>
                      <span className={`px-2 py-1 text-xs rounded-full ${client.isActive ? 'bg-green-100 dark:bg-green-900 dark:bg-opacity-30 text-green-700 dark:text-green-400' : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'}`}>
                        {client.isActive ? 'Active' : 'Inactive'}
                      </span>
                      {isAdmin && (
                        <>
                          <button onClick={() => openEditClient(client)} className="p-1 text-yellow-600 hover:text-yellow-500" title="Edit client"><Edit2 className="h-4 w-4" /></button>
                          <button onClick={() => handleDeleteClient(client)} className="p-1 text-red-600 hover:text-red-500" title="Delete client"><Trash2 className="h-4 w-4" /></button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Expanded body */}
                  {isOpen && (
                    <div className="px-4 py-3 border-t border-yellow-200 dark:border-yellow-800 bg-yellow-100/50 dark:bg-black">
                      {/* Sites */}
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-semibold text-yellow-700 dark:text-yellow-300 flex items-center gap-1"><MapPin className="h-4 w-4" /> Sites</h4>
                        {isAdmin && (
                          <button onClick={() => openAddSite(client.id)} className="flex items-center gap-1 px-2 py-1 text-xs bg-yellow-600 text-black rounded-lg hover:bg-yellow-500 transition-colors">
                            <Plus className="h-3 w-3" /> Add Site
                          </button>
                        )}
                      </div>

                      {/* Add site form */}
                      {isAdmin && addSiteForClient === client.id && (
                        <form onSubmit={(e) => handleSiteSubmit(e, client.id)} className="mb-3 p-3 bg-yellow-50 dark:bg-yellow-900 dark:bg-opacity-20 border border-yellow-300 dark:border-yellow-700 rounded-lg space-y-2">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <input type="text" placeholder="Site name" value={siteForm.name} onChange={(e) => setSiteForm({ ...siteForm, name: e.target.value })} className={inputClass} required />
                            <input type="text" placeholder="Description" value={siteForm.description} onChange={(e) => setSiteForm({ ...siteForm, description: e.target.value })} className={inputClass} />
                          </div>
                          <div className="flex items-center gap-4">
                            <label className="flex items-center gap-1 text-sm text-yellow-700 dark:text-yellow-300">
                              <input type="checkbox" checked={siteForm.isActive} onChange={(e) => setSiteForm({ ...siteForm, isActive: e.target.checked })} className="rounded border-yellow-600 text-yellow-500 focus:ring-yellow-500" /> Active
                            </label>
                            <label className="flex items-center gap-1 text-sm text-red-700 dark:text-red-300">
                              <input type="checkbox" checked={siteForm.flagRed} onChange={(e) => setSiteForm({ ...siteForm, flagRed: e.target.checked })} className="rounded border-red-600 text-red-500 focus:ring-red-500" /> Flag Red
                            </label>
                          </div>
                          <div className="flex gap-2">
                            <button type="submit" className="px-3 py-1.5 text-sm bg-yellow-500 text-black rounded-lg hover:bg-yellow-600 transition-colors">Add Site</button>
                            <button type="button" onClick={() => setAddSiteForClient(null)} className="px-3 py-1.5 text-sm bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors">Cancel</button>
                          </div>
                        </form>
                      )}

                      {clientSites.length === 0 ? (
                        <p className="text-xs text-yellow-600 dark:text-yellow-500">No sites under this client yet.</p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-left text-yellow-700 dark:text-yellow-400 border-b border-yellow-200 dark:border-yellow-800">
                                <th className="py-1 pr-2">Site</th>
                                <th className="py-1 px-2 text-center">Codes</th>
                                {isAdmin && <th className="py-1 pl-2 text-right">Actions</th>}
                              </tr>
                            </thead>
                            <tbody>
                              {[...clientSites].sort((a, b) => (b.isActive ? 1 : 0) - (a.isActive ? 1 : 0)).map(site => (
                                <tr key={site.id} className={`border-b border-yellow-100 dark:border-yellow-900 ${!site.isActive ? 'opacity-50' : ''}`}>
                                  <td className={`py-1.5 pr-2 ${!site.isActive ? 'text-gray-400 dark:text-gray-600 italic' : 'text-gray-900 dark:text-yellow-100'}`}>
                                    {site.name}
                                    {site.flagRed && <span className="ml-2 text-xs text-red-600 dark:text-red-400">(flagged)</span>}
                                    {!site.isActive && <span className="ml-2 text-xs">(inactive)</span>}
                                  </td>
                                  <td className="py-1.5 px-2 text-center text-yellow-700 dark:text-yellow-400">{(site.codes || []).length}</td>
                                  {isAdmin && (
                                    <td className="py-1.5 pl-2">
                                      <div className="flex justify-end gap-1">
                                        <button onClick={() => navigate(`/admin/sites/edit/${site.id}`)} className="p-1 text-yellow-600 hover:text-yellow-500" title="Edit site / codes"><Edit2 className="h-4 w-4" /></button>
                                      </div>
                                    </td>
                                  )}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Unassigned sites */}
      {isAdmin && unassignedSites.length > 0 && (
        <div className="mt-6">
          <h3 className="text-lg font-medium text-orange-700 dark:text-orange-400 mb-2">Unassigned Sites ({unassignedSites.length})</h3>
          <p className="text-xs text-yellow-600 dark:text-yellow-500 mb-2">These sites are not yet attached to a client. Assign each to a client to organize them.</p>
          <div className="space-y-2">
            {unassignedSites.map(site => (
              <div key={site.id} className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 border border-orange-300 dark:border-orange-800 rounded-lg bg-orange-50 dark:bg-orange-900 dark:bg-opacity-10">
                <div className="flex-1 text-gray-900 dark:text-yellow-100">
                  {site.name}
                  <span className="ml-2 text-xs text-yellow-600 dark:text-yellow-500">{(site.codes || []).length} code(s)</span>
                </div>
                <select
                  value={assignTargets[site.id] || ''}
                  onChange={(e) => setAssignTargets(prev => ({ ...prev, [site.id]: e.target.value }))}
                  className="px-3 py-1.5 text-sm bg-yellow-200 dark:bg-black border border-yellow-600 rounded-lg text-gray-900 dark:text-yellow-100 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                >
                  <option value="">Select client...</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <button onClick={() => handleAssignSite(site)} className="px-3 py-1.5 text-sm bg-yellow-600 text-black rounded-lg hover:bg-yellow-500 transition-colors">Assign</button>
                <button onClick={() => navigate(`/admin/sites/edit/${site.id}`)} className="p-1.5 text-yellow-600 hover:text-yellow-500" title="Edit site / codes"><Edit2 className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
