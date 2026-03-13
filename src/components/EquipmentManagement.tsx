import { useState, useEffect, useRef } from 'react';
import { Plus, Edit2, Trash2, X, Check, Truck, Upload } from 'lucide-react';
import { Equipment, equipmentManagementService } from '../services/equipmentManagementService';
import { parseExcelFile } from '../utils/excelImport';

interface EquipmentManagementProps {
  onClose: () => void;
  currentUser: { username: string; role: string } | null;
}

export function EquipmentManagement({ onClose, currentUser }: EquipmentManagementProps) {
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingItem, setEditingItem] = useState<Equipment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    isActive: true
  });

  useEffect(() => {
    loadEquipment();
  }, []);

  const loadEquipment = async () => {
    try {
      const data = await equipmentManagementService.getAllEquipment();
      setEquipment(data);
    } catch (error: any) {
      console.error('Failed to load equipment:', error);
      setError(`Failed to load equipment: ${error?.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    try {
      if (editingItem) {
        await equipmentManagementService.updateEquipment(editingItem.id, formData);
        setSuccess('Equipment updated successfully');
        setEditingItem(null);
      } else {
        await equipmentManagementService.addEquipment({
          ...formData,
          createdBy: currentUser?.username
        });
        setSuccess('Equipment added successfully');
        setShowAddForm(false);
      }

      setFormData({ name: '', description: '', isActive: true });
      await loadEquipment();
    } catch (error) {
      setError(editingItem ? 'Failed to update equipment' : 'Failed to add equipment');
    }
  };

  const handleEdit = (item: Equipment) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      description: item.description || '',
      isActive: item.isActive
    });
    setShowAddForm(false);
  };

  const handleDelete = async (item: Equipment) => {
    if (!window.confirm(`Are you sure you want to delete "${item.name}"?`)) {
      return;
    }

    try {
      await equipmentManagementService.deleteEquipment(item.id);
      setSuccess('Equipment deleted successfully');
      await loadEquipment();
    } catch (error) {
      setError('Failed to delete equipment');
    }
  };

  const handleToggleActive = async (item: Equipment) => {
    try {
      await equipmentManagementService.updateEquipment(item.id, { isActive: !item.isActive });
      setSuccess(`Equipment ${!item.isActive ? 'activated' : 'deactivated'} successfully`);
      await loadEquipment();
    } catch (error) {
      setError('Failed to update equipment status');
    }
  };

  const cancelForm = () => {
    setShowAddForm(false);
    setEditingItem(null);
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
        await equipmentManagementService.addEquipment({
          name: row.name,
          description: row.description || '',
          isActive: true,
          createdBy: currentUser?.username
        });
        addedCount++;
      }
      setSuccess(`Successfully imported ${addedCount} equipment item${addedCount !== 1 ? 's' : ''} from Excel.`);
      await loadEquipment();
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
          <div className="text-yellow-400">Loading equipment...</div>
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
            <Truck className="h-6 w-6 text-yellow-300" />
            <h2 className="text-xl font-semibold text-yellow-300">Equipment Management</h2>
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

          {!showAddForm && !editingItem && (
            <div className="mb-6 flex flex-wrap gap-3">
              <button
                onClick={() => setShowAddForm(true)}
                className="flex items-center space-x-2 px-4 py-2 bg-yellow-500 text-black rounded-lg hover:bg-yellow-600 transition-colors"
              >
                <Plus className="h-4 w-4" />
                <span>Add New Equipment</span>
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

          {(showAddForm || editingItem) && (
            <div className="mb-6 p-4 bg-yellow-900 bg-opacity-20 border border-yellow-700 rounded-lg">
              <h3 className="text-lg font-medium text-yellow-300 mb-4">
                {editingItem ? 'Edit Equipment' : 'Add New Equipment'}
              </h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-yellow-300 mb-1">Equipment Name</label>
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
                    <span>{editingItem ? 'Update' : 'Add'} Equipment</span>
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

          <div className="space-y-2">
            <h3 className="text-lg font-medium text-yellow-300 mb-3">Equipment ({equipment.length})</h3>
            {equipment.length === 0 ? (
              <div className="text-center py-8 text-yellow-600">
                No equipment found. Add your first equipment above.
              </div>
            ) : (
              <div className="space-y-2">
                {equipment.map((item) => (
                  <div
                    key={item.id}
                    className={`p-4 rounded-lg border transition-colors ${
                      item.isActive
                        ? 'bg-yellow-900 bg-opacity-10 border-yellow-700'
                        : 'bg-gray-900 bg-opacity-30 border-gray-700'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <h4 className={`font-medium ${item.isActive ? 'text-yellow-100' : 'text-gray-400'}`}>
                            {item.name}
                          </h4>
                          {!item.isActive && (
                            <span className="px-2 py-0.5 bg-gray-700 text-gray-300 text-xs rounded">
                              Inactive
                            </span>
                          )}
                        </div>
                        {item.description && (
                          <p className={`text-sm mt-1 ${item.isActive ? 'text-yellow-600' : 'text-gray-500'}`}>
                            {item.description}
                          </p>
                        )}
                        <p className="text-xs text-gray-500 mt-2">
                          Created: {item.createdAt.toLocaleDateString()}
                          {item.createdBy && ` by ${item.createdBy}`}
                        </p>
                      </div>
                      <div className="flex space-x-2 ml-4">
                        <button
                          onClick={() => handleToggleActive(item)}
                          className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                            item.isActive
                              ? 'bg-gray-600 text-white hover:bg-gray-700'
                              : 'bg-green-600 text-white hover:bg-green-700'
                          }`}
                          title={item.isActive ? 'Deactivate' : 'Activate'}
                        >
                          {item.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          onClick={() => handleEdit(item)}
                          className="p-2 text-yellow-400 hover:text-yellow-300 transition-colors"
                          title="Edit equipment"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(item)}
                          className="p-2 text-red-400 hover:text-red-300 transition-colors"
                          title="Delete equipment"
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
