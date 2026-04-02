
import React, { useState, useEffect, useRef } from 'react';
import { Upload, Edit2, Trash2, Clock, QrCode, X } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { equipmentManagementService } from '../services/equipmentManagementService';
import { getCategories } from '../services/firebaseService';
import { siteManagementService, Site } from '../services/siteManagementService';
import { equipmentHistoryFirebaseService } from '../services/equipmentHistoryFirebaseService';
import { EquipmentLog } from './EquipmentLog';
import { Category, Equipment } from '../types';
import { parseExcelFile } from '../utils/excelImport';

interface EquipmentManagementProps {
  onClose: () => void;
  currentUser: { username: string; role: string } | null;
  asPage?: boolean;
}

const EMPTY_FORM = { name: '', description: '', serialNumber: '', category: '', site: '', employee: '', repair: false, repairDescription: '', isActive: true, showInInventory: true, showInTimecard: true, parentId: '' };

export function EquipmentManagement({ currentUser, asPage = false }: EquipmentManagementProps) {
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingItem, setEditingItem] = useState<Equipment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showLog, setShowLog] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Equipment | null>(null);
  const [formData, setFormData] = useState({ ...EMPTY_FORM });
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadEquipment();
    loadCategories();
    loadSites();
  }, []);

  const loadCategories = async () => {
    try {
      const loaded = await getCategories();
      setCategories([...loaded].sort((a, b) => {
        const numA = parseFloat(a.name), numB = parseFloat(b.name);
        if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
        return a.name.localeCompare(b.name);
      }));
    } catch (err) {
      console.error('Error loading categories:', err);
    }
  };

  const loadSites = async () => {
    try {
      const loaded = await siteManagementService.getAllSites();
      setSites(loaded);
    } catch (err) {
      console.error('Error loading sites:', err);
    }
  };

  const loadEquipment = async () => {
    try {
      const serviceEquipment = await equipmentManagementService.getAllEquipment();
      // Convert Date objects to strings and ensure all required fields
      const convertedEquipment: Equipment[] = serviceEquipment.map(item => ({
        ...item,
        employee: item.employee || '',
        site: item.site || '',
        category: item.category || '',
        serialNumber: item.serialNumber || '',
        repairDescription: item.repairDescription || '',
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
        notes: []
      }));
      setEquipment(convertedEquipment);
    } catch (err: any) {
      setError(`Failed to load equipment: ${err?.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const getCategoryName = (catId: string) =>
    categories.find(c => c.id === catId)?.name || catId || 'Uncategorized';

  const filteredEquipment = equipment.filter(item =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.serialNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.site?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    try {
      if (editingItem) {
        // Log the changes to history
        const changes: { field: string; oldValue: string; newValue: string }[] = [];
        
        // Check each field for changes
        Object.keys(formData).forEach(key => {
          const oldValue = editingItem[key as keyof typeof formData];
          const newValue = formData[key as keyof typeof formData];
          
          if (oldValue !== newValue) {
            changes.push({
              field: key,
              oldValue: String(oldValue || ''),
              newValue: String(newValue)
            });
          }
        });
        
        // Add history entry if there are changes
        if (changes.length > 0 && currentUser) {
          await equipmentHistoryFirebaseService.addHistory({
            equipmentId: editingItem.id,
            equipmentName: formData.name,
            action: 'updated',
            timestamp: new Date(),
            user: currentUser.username,
            userRole: currentUser.role || 'admin',
            changes
          });
        }
        
        await equipmentManagementService.updateEquipment(editingItem.id, formData);
        setSuccess('Equipment updated successfully');
        setEditingItem(null);
      } else {
        const newId = await equipmentManagementService.addEquipment({ ...formData, equipmentType: 'heavy', createdBy: currentUser?.username });
        
        // Log the creation to history
        if (currentUser) {
          await equipmentHistoryFirebaseService.addHistory({
            equipmentId: newId,
            equipmentName: formData.name,
            action: 'created',
            timestamp: new Date(),
            user: currentUser.username,
            userRole: currentUser.role || 'admin'
          });
        }
        
        setSuccess('Equipment added successfully');
        setShowAddForm(false);
      }
      setFormData({ ...EMPTY_FORM });
      await loadEquipment();
    } catch {
      setError(editingItem ? 'Failed to update equipment' : 'Failed to add equipment');
    }
  };

  const handleEdit = (item: Equipment) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      description: item.description || '',
      serialNumber: item.serialNumber || '',
      category: item.category || '',
      site: item.site || '',
      employee: item.employee || '',
      repair: item.repair || false,
      repairDescription: item.repairDescription || '',
      isActive: item.isActive,
      showInInventory: item.showInInventory,
      showInTimecard: item.showInTimecard,
      parentId: item.parentId || '',
    });
    setShowAddForm(false);
  };

  const handleDelete = async (item: Equipment) => {
    if (!window.confirm(`Are you sure you want to delete "${item.name}"?`)) return;
    try {
      await equipmentManagementService.deleteEquipment(item.id);
      setSuccess('Equipment deleted successfully');
      await loadEquipment();
    } catch {
      setError('Failed to delete equipment');
    }
  };

  const handleToggleInventory = async (item: Equipment) => {
    try {
      await equipmentManagementService.updateEquipment(item.id, { showInInventory: !item.showInInventory });
      setSuccess(`Inventory ${!item.showInInventory ? 'enabled' : 'disabled'} for ${item.name}`);
      await loadEquipment();
    } catch {
      setError('Failed to update inventory setting');
    }
  };

  const handleToggleTimecard = async (item: Equipment) => {
    try {
      await equipmentManagementService.updateEquipment(item.id, { showInTimecard: !item.showInTimecard });
      setSuccess(`Timecard ${!item.showInTimecard ? 'enabled' : 'disabled'} for ${item.name}`);
      await loadEquipment();
    } catch {
      setError('Failed to update timecard setting');
    }
  };

  const handleSiteChange = async (item: Equipment, newSite: string) => {
    try {
      await equipmentManagementService.updateEquipment(item.id, { site: newSite });
      setSuccess(`Site updated to ${newSite || 'Unassigned'} for ${item.name}`);
      await loadEquipment();
    } catch {
      setError('Failed to update site');
    }
  };

  const cancelForm = () => {
    setShowAddForm(false);
    setEditingItem(null);
    setFormData({ ...EMPTY_FORM });
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setError(null);
    try {
      const rows = await parseExcelFile(file);
      for (const row of rows) {
        await equipmentManagementService.addEquipment({
          name: row.name, 
          description: row.description || '',
          serialNumber: '',
          category: '',
          site: '',
          employee: '',
          equipmentType: 'heavy',
          repair: false,
          repairDescription: '',
          isActive: true, 
          showInInventory: true, 
          showInTimecard: true,
          createdBy: currentUser?.username
        });
      }
      setSuccess(`Successfully imported ${rows.length} item${rows.length !== 1 ? 's' : ''} from Excel.`);
      await loadEquipment();
    } catch (err: any) {
      setError(err.message || 'Failed to import from Excel.');
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const inner = (
    <>
        {/* Header */}
        <div className="px-6 py-4 border-b border-yellow-300 dark:border-yellow-700 bg-yellow-700 dark:bg-yellow-900 dark:bg-opacity-30"><h2 className="text-xl font-semibold text-yellow-100 dark:text-yellow-300">Manage Heavy Equipment</h2>
        </div>

        <div className="p-4 overflow-y-auto">

          {/* Notifications */}
          {error && (
            <div className="mb-4 p-3 bg-red-100 dark:bg-red-900 dark:bg-opacity-30 border border-red-600 rounded-lg text-red-600 dark:text-red-300 text-sm">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-4 p-3 bg-green-100 dark:bg-green-900 dark:bg-opacity-30 border border-green-600 rounded-lg text-green-700 dark:text-green-300 text-sm">
              {success}
            </div>
          )}

          {/* Search and Actions */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <input
              type="text"
              placeholder="Search heavy equipment..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 px-4 py-2 border border-yellow-600 rounded-lg bg-yellow-200 dark:bg-black text-gray-900 dark:text-yellow-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
            />
            {currentUser?.role === 'admin' && (
              <>
                <button
                  onClick={() => { setShowAddForm(true); setEditingItem(null); setFormData({ ...EMPTY_FORM }); }}
                  className="px-4 py-2 bg-yellow-600 text-black rounded-lg hover:bg-yellow-500 transition-colors"
                >
                  Add Equipment
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={importing}
                  className="flex items-center space-x-2 px-4 py-2 bg-yellow-700 text-yellow-100 rounded-lg hover:bg-yellow-600 transition-colors disabled:opacity-50"
                >
                  <Upload className="h-4 w-4" />
                  <span>{importing ? 'Importing...' : 'Import Excel'}</span>
                </button>
                <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleImportExcel} className="hidden" />
              </>
            )}
          </div>

          {/* Add Form */}
          {showAddForm && (
            <div className="mb-4 p-4 bg-yellow-50 dark:bg-yellow-900 dark:bg-opacity-20 border border-yellow-300 dark:border-yellow-700 rounded-lg">
              <h3 className="text-base font-semibold text-yellow-700 dark:text-yellow-300 mb-3">
                Add Heavy Equipment
              </h3>
              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input
                    type="text" required placeholder="Equipment Name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 bg-white dark:bg-black rounded-lg text-gray-900 dark:text-yellow-100 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  />
                  <input
                    type="text" placeholder="Description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 bg-white dark:bg-black rounded-lg text-gray-900 dark:text-yellow-100 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  />
                  <input
                    type="text" placeholder="Serial Number"
                    value={formData.serialNumber}
                    onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
                    className="w-full px-3 py-2 bg-white dark:bg-black rounded-lg text-gray-900 dark:text-yellow-100 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  />
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 bg-white dark:bg-black rounded-lg text-gray-900 dark:text-yellow-100 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  >
                    <option value="">Select Category</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                  <select
                    value={formData.site}
                    onChange={(e) => setFormData({ ...formData, site: e.target.value })}
                    className="w-full px-3 py-2 bg-white dark:bg-black rounded-lg text-gray-900 dark:text-yellow-100 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  >
                    <option value="">Select Site</option>
                    {sites.map((site) => (
                      <option key={site.id} value={site.name}>{site.name}</option>
                    ))}
                  </select>
                  <select
                    value={formData.parentId}
                    onChange={(e) => setFormData({ ...formData, parentId: e.target.value, showInInventory: e.target.value ? false : formData.showInInventory })}
                    className="w-full px-3 py-2 bg-white dark:bg-black rounded-lg text-gray-900 dark:text-yellow-100 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  >
                    <option value="">No Parent (Original Unit)</option>
                    {equipment.filter(e => !e.parentId && e.id !== editingItem?.id).map((e) => (
                      <option key={e.id} value={e.id}>{e.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center space-x-2 text-sm text-yellow-700 dark:text-yellow-300">
                    <input type="checkbox" checked={formData.isActive} onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })} className="rounded border-yellow-600 text-yellow-500 focus:ring-yellow-500" />
                    <span>Active</span>
                  </label>
                  {!formData.parentId && (
                    <label className="flex items-center space-x-2 text-sm text-yellow-700 dark:text-yellow-300">
                      <input type="checkbox" checked={formData.showInInventory} onChange={(e) => setFormData({ ...formData, showInInventory: e.target.checked })} className="rounded border-yellow-600 text-yellow-500 focus:ring-yellow-500" />
                      <span>Show in Inventory</span>
                    </label>
                  )}
                  <label className="flex items-center space-x-2 text-sm text-yellow-700 dark:text-yellow-300">
                    <input type="checkbox" checked={formData.showInTimecard} onChange={(e) => setFormData({ ...formData, showInTimecard: e.target.checked })} className="rounded border-yellow-600 text-yellow-500 focus:ring-yellow-500" />
                    <span>Show in Timecard</span>
                  </label>
                </div>
                <div className="flex space-x-2">
                  <button type="submit" className="px-4 py-2 bg-yellow-600 text-black rounded-lg hover:bg-yellow-500 transition-colors text-sm">
                    {editingItem ? 'Update' : 'Add'} Equipment
                  </button>
                  <button type="button" onClick={cancelForm} className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors text-sm">
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Equipment Table grouped by category */}
          {loading ? (
            <div className="text-center py-8 text-yellow-600 dark:text-yellow-400">Loading heavy equipment...</div>
          ) : filteredEquipment.length === 0 ? (
            <div className="text-center py-8 text-yellow-600 dark:text-yellow-400">
              {searchTerm ? 'No equipment found matching your search.' : 'No heavy equipment found.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full max-w-[100vw]">
                <thead>
                  <tr className="bg-yellow-600 dark:bg-yellow-900 dark:bg-opacity-30">
                    <th className="px-4 py-2 text-left text-yellow-100 dark:text-yellow-300">Name</th>
                    <th className="px-4 py-2 text-left text-yellow-100 dark:text-yellow-300">Site</th>
                    <th className="px-4 py-2 text-center text-yellow-100 dark:text-yellow-300">Inventory</th>
                    <th className="px-4 py-2 text-center text-yellow-100 dark:text-yellow-300">Timecard</th>
                    <th className="px-4 py-2 text-left text-yellow-100 dark:text-yellow-300">Status</th>
                    <th className="px-4 py-2 text-left text-yellow-100 dark:text-yellow-300">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    // First, separate parents and variants
                    const parents = filteredEquipment.filter(item => !item.parentId);
                    const variants = filteredEquipment.filter(item => item.parentId);
                    
                    // Group parents by category
                    const grouped = parents.reduce((acc, item) => {
                      const name = getCategoryName(item.category || '');
                      if (!acc[name]) acc[name] = [];
                      acc[name].push(item);
                      return acc;
                    }, {} as Record<string, Equipment[]>);

                    // Sort parents within each category
                    Object.keys(grouped).forEach(key => {
                      grouped[key].sort((a, b) => {
                        const numA = parseFloat(a.name), numB = parseFloat(b.name);
                        if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
                        return a.name.localeCompare(b.name);
                      });
                    });

                    // Sort categories
                    const sortedGroups = Object.entries(grouped).sort(([a], [b]) => {
                      const numA = parseFloat(a), numB = parseFloat(b);
                      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
                      return a.localeCompare(b);
                    });

                    return sortedGroups.map(([categoryName, items]) => (
                      <React.Fragment key={categoryName}>
                        <tr>
                          <td colSpan={6} className="px-4 py-2 bg-yellow-700 bg-opacity-40 border-b border-yellow-700">
                            <span className="text-sm font-semibold text-yellow-600 dark:text-yellow-400 uppercase tracking-wide">
                              {categoryName} ({items.length})
                            </span>
                          </td>
                        </tr>
                        {items.map((item) => {
                          // Find variants of this parent
                          const itemVariants = variants.filter(v => v.parentId === item.id);
                          return (
                            <React.Fragment key={item.id}>
                              {/* Parent row */}
                              <tr className="border-t border-yellow-200 dark:border-yellow-800">
                                <td className="px-4 py-2 text-gray-900 dark:text-yellow-100">
                                  {item.name}
                                  {!item.isActive && <span className="ml-2 px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 text-gray-500 text-xs rounded">Inactive</span>}
                                </td>
                              <td className="px-4 py-2">
                                <select
                                  value={item.site || ''}
                                  onChange={(e) => handleSiteChange(item, e.target.value)}
                                  className="px-2 py-1 rounded bg-yellow-200 dark:bg-black text-gray-900 dark:text-yellow-100 text-sm focus:ring-2 focus:ring-yellow-500"
                                >
                                  <option value="">Unassigned</option>
                                  {sites.map((site) => (
                                    <option key={site.id} value={site.name}>
                                      {site.name}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td className="px-4 py-2 text-center">
                                <button
                                  onClick={() => handleToggleInventory(item)}
                                  className={`p-1 rounded transition-colors ${
                                    item.showInInventory 
                                      ? 'text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900 dark:hover:bg-opacity-30' 
                                      : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                                  }`}
                                  title={item.showInInventory ? 'Remove from inventory' : 'Add to inventory'}
                                >
                                  {item.showInInventory ? '✓' : '-'}
                                </button>
                              </td>
                              <td className="px-4 py-2 text-center">
                                <button
                                  onClick={() => handleToggleTimecard(item)}
                                  className={`p-1 rounded transition-colors ${
                                    item.showInTimecard 
                                      ? 'text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900 dark:hover:bg-opacity-30' 
                                      : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                                  }`}
                                  title={item.showInTimecard ? 'Remove from timecard' : 'Add to timecard'}
                                >
                                  {item.showInTimecard ? '✓' : '-'}
                                </button>
                              </td>
                              <td className="px-4 py-2">
                                {!item.isActive ? (
                                  <span className="px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-500 text-xs rounded">Inactive</span>
                                ) : (
                                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                                    item.repair
                                      ? 'bg-red-100 dark:bg-red-900 dark:bg-opacity-30 text-red-600 dark:text-red-300'
                                      : item.site === 'Out for Repair'
                                      ? 'bg-red-100 dark:bg-red-900 dark:bg-opacity-30 text-red-600 dark:text-red-300'
                                      : item.site === 'Office'
                                      ? 'bg-green-100 dark:bg-green-900 dark:bg-opacity-30 text-green-700 dark:text-green-300'
                                      : item.site === 'Shop'
                                      ? 'bg-green-100 dark:bg-green-900 dark:bg-opacity-30 text-green-700 dark:text-green-300'
                                      : item.site
                                      ? 'bg-blue-100 dark:bg-blue-900 dark:bg-opacity-30 text-blue-700 dark:text-blue-300'
                                      : 'bg-green-100 dark:bg-green-900 dark:bg-opacity-30 text-green-700 dark:text-green-300'
                                  }`}>
                                    {item.repair ? 'Repair' : item.site === 'Out for Repair' ? 'Out for Repair' : item.site === 'Office' ? 'Office' : item.site === 'Shop' ? 'Available' : item.site ? 'In Use' : 'Available'}
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-2">
                                <div className="flex space-x-1">
                                  <button
                                    onClick={() => handleEdit(item)}
                                    className="p-1 text-yellow-600 hover:text-yellow-500"
                                    title={editingItem?.id === item.id ? 'Cancel' : 'Edit'}
                                  >
                                    <Edit2 className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={() => { setSelectedItem(item); setShowQR(true); }}
                                    className="p-1 text-purple-600 hover:text-purple-500"
                                    title="Show QR Code"
                                  >
                                    <QrCode className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={() => { setSelectedItem(item); setShowLog(true); }}
                                    className="p-1 text-blue-600 hover:text-blue-500"
                                    title="View Log"
                                  >
                                    <Clock className="h-4 w-4" />
                                  </button>
                                  {currentUser?.role === 'admin' && (
                                    <button
                                      onClick={() => handleDelete(item)}
                                      className="p-1 text-red-600 hover:text-red-500"
                                      title="Delete"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                            {editingItem?.id === item.id && (
                              <tr>
                                <td colSpan={6} className="px-4 py-0">
                                  <div className="p-4 bg-yellow-50 dark:bg-yellow-900 dark:bg-opacity-20 border border-yellow-300 dark:border-yellow-700 rounded-lg mt-2">
                                    <h3 className="text-base font-semibold text-yellow-700 dark:text-yellow-300 mb-3">
                                      Edit Heavy Equipment: {item.name}
                                    </h3>
                                    <form onSubmit={handleSubmit} className="space-y-3">
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <input
                                          type="text" required placeholder="Equipment Name"
                                          value={formData.name}
                                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                          className="w-full px-3 py-2 bg-white dark:bg-black rounded-lg text-gray-900 dark:text-yellow-100 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                                        />
                                        <input
                                          type="text" placeholder="Description"
                                          value={formData.description}
                                          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                          className="w-full px-3 py-2 bg-white dark:bg-black rounded-lg text-gray-900 dark:text-yellow-100 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                                        />
                                        <input
                                          type="text" placeholder="Serial Number"
                                          value={formData.serialNumber}
                                          onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
                                          className="w-full px-3 py-2 bg-white dark:bg-black rounded-lg text-gray-900 dark:text-yellow-100 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                                        />
                                        <select
                                          value={formData.category}
                                          onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                          className="w-full px-3 py-2 bg-white dark:bg-black rounded-lg text-gray-900 dark:text-yellow-100 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                                        >
                                          <option value="">Select Category</option>
                                          {categories.map(cat => (
                                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                                          ))}
                                        </select>
                                        <select
                                          value={formData.site}
                                          onChange={(e) => setFormData({ ...formData, site: e.target.value })}
                                          className="w-full px-3 py-2 bg-white dark:bg-black rounded-lg text-gray-900 dark:text-yellow-100 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                                        >
                                          <option value="">Select Site</option>
                                          {sites.map(site => (
                                            <option key={site.id} value={site.name}>{site.name}</option>
                                          ))}
                                        </select>
                                        <select
                                          value={formData.parentId}
                                          onChange={(e) => setFormData({ ...formData, parentId: e.target.value, showInInventory: e.target.value ? false : formData.showInInventory })}
                                          className="w-full px-3 py-2 bg-white dark:bg-black rounded-lg text-gray-900 dark:text-yellow-100 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                                        >
                                          <option value="">No Parent (Original Unit)</option>
                                          {equipment.filter(e => !e.parentId && e.id !== editingItem?.id).map((e) => (
                                            <option key={e.id} value={e.id}>{e.name}</option>
                                          ))}
                                        </select>
                                      </div>
                                      <div className="flex items-center space-x-6 text-sm">
                                        <label className="flex items-center space-x-2 text-sm text-yellow-700 dark:text-yellow-300">
                                          <input type="checkbox" checked={formData.isActive} onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })} className="rounded border-yellow-600 text-yellow-500 focus:ring-yellow-500" />
                                          <span>Active</span>
                                        </label>
                                        {!formData.parentId && (
                                          <label className="flex items-center space-x-2 text-sm text-yellow-700 dark:text-yellow-300">
                                            <input type="checkbox" checked={formData.showInInventory} onChange={(e) => setFormData({ ...formData, showInInventory: e.target.checked })} className="rounded border-yellow-600 text-yellow-500 focus:ring-yellow-500" />
                                            <span>Show in Inventory</span>
                                          </label>
                                        )}
                                        <label className="flex items-center space-x-2 text-sm text-yellow-700 dark:text-yellow-300">
                                          <input type="checkbox" checked={formData.showInTimecard} onChange={(e) => setFormData({ ...formData, showInTimecard: e.target.checked })} className="rounded border-yellow-600 text-yellow-500 focus:ring-yellow-500" />
                                          <span>Show in Timecard</span>
                                        </label>
                                      </div>
                                      <div className="flex space-x-2">
                                        <button type="submit" className="px-4 py-2 bg-yellow-600 text-black rounded-lg hover:bg-yellow-500 transition-colors text-sm">
                                          Update Equipment
                                        </button>
                                        <button type="button" onClick={cancelForm} className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors text-sm">
                                          Cancel
                                        </button>
                                      </div>
                                    </form>
                                  </div>
                                </td>
                              </tr>
                            )}
                            {/* Indented variants */}
                            {itemVariants.map(variant => (
                              <React.Fragment key={variant.id}>
                                <tr className="border-t border-yellow-100 dark:border-yellow-900">
                                  <td className="px-4 py-2 text-gray-900 dark:text-yellow-100 pl-8">
                                    <span className="text-gray-500 dark:text-gray-400 mr-2">↳</span>
                                    {variant.name}
                                    {!variant.isActive && <span className="ml-2 px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 text-gray-500 text-xs rounded">Inactive</span>}
                                  </td>
                                  <td className="px-4 py-2">
                                    <span className="text-sm text-gray-500 dark:text-gray-400">
                                      {item.site || 'Unassigned'}
                                    </span>
                                  </td>
                                  <td className="px-4 py-2 text-center">
                                    <span className="text-gray-400 text-sm">-</span>
                                  </td>
                                  <td className="px-4 py-2 text-center">
                                    <button
                                      onClick={() => handleToggleTimecard(variant)}
                                      className={`p-1 rounded transition-colors ${
                                        variant.showInTimecard 
                                          ? 'text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900 dark:hover:bg-opacity-30' 
                                          : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                                      }`}
                                      title={variant.showInTimecard ? 'Remove from timecard' : 'Add to timecard'}
                                    >
                                      {variant.showInTimecard ? '✓' : '-'}
                                    </button>
                                  </td>
                                  <td className="px-4 py-2">
                                    {/* No status badge for variants */}
                                  </td>
                                  <td className="px-4 py-2">
                                    <div className="flex space-x-1">
                                      <button
                                        onClick={() => handleEdit(variant)}
                                        className="p-1 text-yellow-600 hover:text-yellow-500"
                                        title={editingItem?.id === variant.id ? 'Cancel' : 'Edit'}
                                      >
                                        <Edit2 className="h-4 w-4" />
                                      </button>
                                      <button
                                        onClick={() => { setSelectedItem(variant); setShowQR(true); }}
                                        className="p-1 text-purple-600 hover:text-purple-500"
                                        title="Show QR Code"
                                      >
                                        <QrCode className="h-4 w-4" />
                                      </button>
                                      <button
                                        onClick={() => { setSelectedItem(variant); setShowLog(true); }}
                                        className="p-1 text-blue-600 hover:text-blue-500"
                                        title="View Log"
                                      >
                                        <Clock className="h-4 w-4" />
                                      </button>
                                      {currentUser?.role === 'admin' && (
                                        <button
                                          onClick={() => handleDelete(variant)}
                                          className="p-1 text-red-600 hover:text-red-500"
                                          title="Delete"
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                                {editingItem?.id === variant.id && (
                                  <tr>
                                    <td colSpan={6} className="px-4 py-0">
                                      <div className="p-4 bg-yellow-50 dark:bg-yellow-900 dark:bg-opacity-20 border border-yellow-300 dark:border-yellow-700 rounded-lg mt-2">
                                        <h3 className="text-base font-semibold text-yellow-700 dark:text-yellow-300 mb-3">
                                          Edit Heavy Equipment: {variant.name}
                                        </h3>
                                        <form onSubmit={handleSubmit} className="space-y-3">
                                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            <input
                                              type="text" required placeholder="Equipment Name"
                                              value={formData.name}
                                              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                              className="w-full px-3 py-2 bg-white dark:bg-black rounded-lg text-gray-900 dark:text-yellow-100 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                                            />
                                            <input
                                              type="text" placeholder="Description"
                                              value={formData.description}
                                              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                              className="w-full px-3 py-2 bg-white dark:bg-black rounded-lg text-gray-900 dark:text-yellow-100 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                                            />
                                            <input
                                              type="text" placeholder="Serial Number"
                                              value={formData.serialNumber}
                                              onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
                                              className="w-full px-3 py-2 bg-white dark:bg-black rounded-lg text-gray-900 dark:text-yellow-100 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                                            />
                                            <select
                                              value={formData.category}
                                              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                              className="w-full px-3 py-2 bg-white dark:bg-black rounded-lg text-gray-900 dark:text-yellow-100 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                                            >
                                              <option value="">Select Category</option>
                                              {categories.map(cat => (
                                                <option key={cat.id} value={cat.id}>{cat.name}</option>
                                              ))}
                                            </select>
                                            <select
                                              value={formData.site}
                                              onChange={(e) => setFormData({ ...formData, site: e.target.value })}
                                              className="w-full px-3 py-2 bg-white dark:bg-black rounded-lg text-gray-900 dark:text-yellow-100 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                                            >
                                              <option value="">Select Site</option>
                                              {sites.map(site => (
                                                <option key={site.id} value={site.name}>{site.name}</option>
                                              ))}
                                            </select>
                                            <select
                                              value={formData.parentId}
                                              onChange={(e) => setFormData({ ...formData, parentId: e.target.value, showInInventory: e.target.value ? false : formData.showInInventory })}
                                              className="w-full px-3 py-2 bg-white dark:bg-black rounded-lg text-gray-900 dark:text-yellow-100 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                                            >
                                              <option value="">No Parent (Original Unit)</option>
                                              {equipment.filter(e => !e.parentId && e.id !== editingItem?.id).map((e) => (
                                                <option key={e.id} value={e.id}>{e.name}</option>
                                              ))}
                                            </select>
                                          </div>
                                          <div className="flex items-center space-x-6 text-sm">
                                            <label className="flex items-center space-x-2 text-sm text-yellow-700 dark:text-yellow-300">
                                              <input type="checkbox" checked={formData.isActive} onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })} className="rounded border-yellow-600 text-yellow-500 focus:ring-yellow-500" />
                                              <span>Active</span>
                                            </label>
                                            {!formData.parentId && (
                                              <label className="flex items-center space-x-2 text-sm text-yellow-700 dark:text-yellow-300">
                                                <input type="checkbox" checked={formData.showInInventory} onChange={(e) => setFormData({ ...formData, showInInventory: e.target.checked })} className="rounded border-yellow-600 text-yellow-500 focus:ring-yellow-500" />
                                                <span>Show in Inventory</span>
                                              </label>
                                            )}
                                            <label className="flex items-center space-x-2 text-sm text-yellow-700 dark:text-yellow-300">
                                              <input type="checkbox" checked={formData.showInTimecard} onChange={(e) => setFormData({ ...formData, showInTimecard: e.target.checked })} className="rounded border-yellow-600 text-yellow-500 focus:ring-yellow-500" />
                                              <span>Show in Timecard</span>
                                            </label>
                                          </div>
                                          <div className="flex space-x-2">
                                            <button type="submit" className="px-4 py-2 bg-yellow-600 text-black rounded-lg hover:bg-yellow-500 transition-colors text-sm">
                                              Update Equipment
                                            </button>
                                            <button type="button" onClick={cancelForm} className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors text-sm">
                                              Cancel
                                            </button>
                                          </div>
                                        </form>
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            ))}
                          </React.Fragment>
                          );
                        })}
                      </React.Fragment>
                    ));
                  })()}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* QR Code Modal */}
        {showQR && selectedItem && (
          <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50" onClick={() => setShowQR(false)}>
            <div className="bg-yellow-200 dark:bg-black border border-yellow-600 rounded-lg shadow-xl p-6" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-yellow-700 dark:text-yellow-300">{selectedItem.name}</h3>
                <button onClick={() => setShowQR(false)} className="text-yellow-600 dark:text-yellow-400 hover:text-yellow-500">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="flex justify-center mb-4">
                <QRCodeSVG value={`${window.location.origin}/inventory/equipment/${selectedItem.id}`} size={200} level="M" includeMargin />
              </div>
              <p className="text-xs text-yellow-600 dark:text-yellow-500 text-center break-all">
                {window.location.origin}/inventory/equipment/{selectedItem.id}
              </p>
            </div>
          </div>
        )}

        {/* Equipment Log Modal */}
        {showLog && selectedItem && (
          <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50" onClick={() => setShowLog(false)}>
            <div className="bg-yellow-200 dark:bg-black border border-yellow-600 rounded-lg shadow-xl p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <EquipmentLog 
                equipment={selectedItem} 
                onClose={() => setShowLog(false)} 
              />
            </div>
          </div>
        )}
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
