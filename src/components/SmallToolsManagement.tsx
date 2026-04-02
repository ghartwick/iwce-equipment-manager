import { useState, useEffect, useRef } from 'react';
import { Plus, Edit2, Trash2, X, Check, Upload, Power } from 'lucide-react';
import { SmallTool, smallToolsManagementService } from '../services/smallToolsManagementService';
import { parseExcelFile } from '../utils/excelImport';

interface SmallToolsManagementProps {
  onClose: () => void;
  currentUser: { username: string; role: string } | null;
  asPage?: boolean;
}

export function SmallToolsManagement({ currentUser, asPage = false }: SmallToolsManagementProps) {
  const [tools, setTools] = useState<SmallTool[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingTool, setEditingTool] = useState<SmallTool | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    isActive: true
  });

  useEffect(() => {
    loadTools();
  }, []);

  const loadTools = async () => {
    try {
      const toolsData = await smallToolsManagementService.getAllSmallTools();
      setTools(toolsData);
    } catch (error) {
      console.error('Failed to load small tools:', error);
      setError('Failed to load small tools');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    try {
      if (editingTool) {
        await smallToolsManagementService.updateSmallTool(editingTool.id, formData);
        setSuccess('Small tool updated successfully');
        setEditingTool(null);
      } else {
        await smallToolsManagementService.addSmallTool({
          ...formData,
          createdBy: currentUser?.username
        });
        setSuccess('Small tool added successfully');
        setShowAddForm(false);
      }

      setFormData({ name: '', description: '', isActive: true });
      await loadTools();
    } catch (error) {
      setError(editingTool ? 'Failed to update small tool' : 'Failed to add small tool');
    }
  };

  const handleEdit = (tool: SmallTool) => {
    setEditingTool(tool);
    setFormData({
      name: tool.name,
      description: tool.description || '',
      isActive: tool.isActive
    });
    setShowAddForm(false);
  };

  const handleDelete = async (tool: SmallTool) => {
    if (!window.confirm(`Are you sure you want to delete "${tool.name}"?`)) {
      return;
    }

    try {
      await smallToolsManagementService.deleteSmallTool(tool.id);
      setSuccess('Small tool deleted successfully');
      await loadTools();
    } catch (error) {
      setError('Failed to delete small tool');
    }
  };

  const handleToggleActive = async (tool: SmallTool) => {
    try {
      await smallToolsManagementService.updateSmallTool(tool.id, { isActive: !tool.isActive });
      setSuccess(`Small tool ${!tool.isActive ? 'activated' : 'deactivated'} successfully`);
      await loadTools();
    } catch (error) {
      setError('Failed to update small tool status');
    }
  };

  const cancelForm = () => {
    setShowAddForm(false);
    setEditingTool(null);
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
        await smallToolsManagementService.addSmallTool({
          name: row.name,
          description: row.description || '',
          isActive: true,
          createdBy: currentUser?.username
        });
        addedCount++;
      }
      setSuccess(`Successfully imported ${addedCount} small tool${addedCount !== 1 ? 's' : ''} from Excel.`);
      await loadTools();
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
        <div className="bg-yellow-200 dark:bg-black border border-yellow-600 rounded-lg p-6">
          <div className="text-yellow-400">Loading small tools...</div>
        </div>
      </div>
    );
  }

  const inner = (
    <>
        {/* Header */}
        <div className="px-6 py-4 border-b border-yellow-300 dark:border-yellow-700 bg-yellow-700 dark:bg-yellow-900 dark:bg-opacity-30"><h2 className="text-xl font-semibold text-yellow-100 dark:text-yellow-300">Small Tools Management</h2>
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

          {/* Add Tool / Import Buttons */}
          {!showAddForm && !editingTool && (
            <div className="mb-6 flex flex-wrap gap-3">
              <button
                onClick={() => setShowAddForm(true)}
                className="flex items-center space-x-2 px-4 py-2 bg-yellow-500 text-black rounded-lg hover:bg-yellow-600 transition-colors"
              >
                <Plus className="h-4 w-4" />
                <span>Add New Small Tool</span>
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
          {(showAddForm || editingTool) && (
            <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900 dark:bg-opacity-20 border border-yellow-300 dark:border-yellow-700 rounded-lg">
              <h3 className="text-lg font-medium text-yellow-700 dark:text-yellow-300 mb-4">
                {editingTool ? 'Edit Small Tool' : 'Add New Small Tool'}
              </h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-yellow-700 dark:text-yellow-300 mb-1">Tool Name</label>
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
                    <span>{editingTool ? 'Update' : 'Add'} Small Tool</span>
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

          {/* Tools List */}
          <div className="space-y-2">
            <h3 className="text-lg font-medium text-yellow-700 dark:text-yellow-300 mb-3">Small Tools ({tools.length})</h3>
            {tools.length === 0 ? (
              <div className="text-center py-8 text-yellow-600">
                No small tools found. Add your first small tool above.
              </div>
            ) : (
              <div className="space-y-2">
                {tools.map((tool) => (
                  <div
                    key={tool.id}
                    className={`p-4 rounded-lg border transition-colors ${
                      tool.isActive
                        ? 'bg-yellow-50 dark:bg-yellow-900 dark:bg-opacity-10 border-yellow-300 dark:border-yellow-700'
                        : 'bg-gray-100 dark:bg-gray-900 dark:bg-opacity-30 border-gray-300 dark:border-gray-700'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <h4 className={`font-medium ${tool.isActive ? 'text-gray-900 dark:text-yellow-100' : 'text-gray-500 dark:text-gray-400'}`}>
                            {tool.name}
                          </h4>
                          {!tool.isActive && (
                            <span className="px-2 py-0.5 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs rounded">
                              Inactive
                            </span>
                          )}
                        </div>
                        {tool.description && (
                          <p className={`text-sm mt-1 ${tool.isActive ? 'text-yellow-700 dark:text-yellow-600' : 'text-gray-500'}`}>
                            {tool.description}
                          </p>
                        )}
                        <p className="text-xs text-gray-500 mt-2">
                          Created: {tool.createdAt.toLocaleDateString()}
                          {tool.createdBy && ` by ${tool.createdBy}`}
                        </p>
                      </div>
                      <div className="flex space-x-2 ml-4">
                        <button
                          onClick={() => handleToggleActive(tool)}
                          className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                            tool.isActive
                              ? 'bg-gray-600 text-white hover:bg-gray-700'
                              : 'bg-green-600 text-white hover:bg-green-700'
                          }`}
                          title={tool.isActive ? 'Deactivate' : 'Activate'}
                        >
                          {tool.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          onClick={() => handleEdit(tool)}
                          className="p-2 text-yellow-600 dark:text-yellow-400 hover:text-yellow-500 dark:hover:text-yellow-300 transition-colors"
                          title="Edit small tool"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(tool)}
                          className="p-2 text-red-500 dark:text-red-400 hover:text-red-400 dark:hover:text-red-300 transition-colors"
                          title="Delete small tool"
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
    </>
  );

  const pageContent = (
    <>
        {/* Header */}
        <div className="px-6 py-4 border-b border-yellow-300 dark:border-yellow-700 bg-yellow-700 dark:bg-yellow-900 dark:bg-opacity-30"><h2 className="text-xl font-semibold text-yellow-100 dark:text-yellow-300">Small Tools Management</h2>
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

          {/* Tools List */}
          {tools.length === 0 ? (
            <div className="text-center py-8 text-yellow-600 dark:text-yellow-400">
              No small tools found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full max-w-[100vw]">
                <thead>
                  <tr className="bg-yellow-600 dark:bg-yellow-900 dark:bg-opacity-30">
                    <th className="px-4 py-2 text-left text-yellow-100 dark:text-yellow-300">Name</th>
                    <th className="px-4 py-2 text-left text-yellow-100 dark:text-yellow-300">Description</th>
                    <th className="px-4 py-2 text-center text-yellow-100 dark:text-yellow-300">Status</th>
                    <th className="px-4 py-2 text-left text-yellow-100 dark:text-yellow-300">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tools.map((tool) => (
                    <tr key={tool.id} className="border-t border-yellow-200 dark:border-yellow-800">
                      <td className="px-4 py-2">
                        {editingTool?.id === tool.id ? (
                          <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full px-2 py-1 border border-yellow-600 rounded bg-yellow-200 dark:bg-black text-gray-900 dark:text-yellow-100"
                          />
                        ) : (
                          <span className={tool.isActive ? 'text-gray-900 dark:text-yellow-100' : 'text-gray-400 line-through'}>
                            {tool.name}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2">
                        {editingTool?.id === tool.id ? (
                          <input
                            type="text"
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            className="w-full px-2 py-1 border border-yellow-600 rounded bg-yellow-200 dark:bg-black text-gray-900 dark:text-yellow-100"
                          />
                        ) : (
                          <span className="text-gray-600 dark:text-yellow-600">{tool.description || '-'}</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-center">
                        {editingTool?.id === tool.id ? (
                          <label className="flex items-center justify-center">
                            <input
                              type="checkbox"
                              checked={formData.isActive}
                              onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                              className="mr-2"
                            />
                            Active
                          </label>
                        ) : (
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            tool.isActive 
                              ? 'bg-green-100 dark:bg-green-900 dark:bg-opacity-30 text-green-700 dark:text-green-300' 
                              : 'bg-red-100 dark:bg-red-900 dark:bg-opacity-30 text-red-600 dark:text-red-300'
                          }`}>
                            {tool.isActive ? 'Active' : 'Inactive'}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex items-center space-x-2">
                          {editingTool?.id === tool.id ? (
                            <>
                              <button
                                onClick={handleSubmit}
                                className="p-1 text-green-600 hover:text-green-500"
                                title="Save"
                              >
                                <Check className="h-4 w-4" />
                              </button>
                              <button
                                onClick={cancelForm}
                                className="p-1 text-red-600 hover:text-red-500"
                                title="Cancel"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => handleEdit(tool)}
                                className="p-1 text-yellow-600 hover:text-yellow-500"
                                title="Edit"
                              >
                                <Edit2 className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleToggleActive(tool)}
                                className={`p-1 ${tool.isActive ? 'text-orange-600 hover:text-orange-500' : 'text-green-600 hover:text-green-500'}`}
                                title={tool.isActive ? 'Deactivate' : 'Activate'}
                              >
                                <Power className="h-4 w-4" />
                              </button>
                              {currentUser?.role === 'admin' && (
                                <button
                                  onClick={() => handleDelete(tool)}
                                  className="p-1 text-red-600 hover:text-red-500"
                                  title="Delete"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
            {pageContent}
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
