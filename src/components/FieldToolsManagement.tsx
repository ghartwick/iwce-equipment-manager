import React, { useState, useRef } from 'react';
import { X, Edit2, Trash2, Plus, Clock, QrCode } from 'lucide-react';
import { Equipment } from '../types';
import { useInventory } from '../hooks/useInventory';
import { ProductForm } from './ProductForm';
import { EquipmentLog } from './EquipmentLog';
import { QRCodeSVG } from 'qrcode.react';

interface FieldToolsManagementProps {
  onClose: () => void;
  currentUser: { username: string; role: string } | null;
  asPage?: boolean;
}

export function FieldToolsManagement({ currentUser, asPage = false }: FieldToolsManagementProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingTool, setEditingTool] = useState<Equipment | null>(null);
  const editFormRef = useRef<HTMLDivElement>(null);
  const [showLog, setShowLog] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [selectedTool, setSelectedTool] = useState<Equipment | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAlertsOnly, setShowAlertsOnly] = useState(false);
  const [showMissingOnly, setShowMissingOnly] = useState(false);

  // Use the inventory hook but we'll filter for field tools only
  const {
    products: allProducts,
    categories,
    loading,
    addProduct,
    updateProduct,
    deleteProduct
  } = useInventory();

  // Filter for field tools only
  const fieldTools = allProducts.filter(tool => 
    !tool.equipmentType || tool.equipmentType === 'field'
  );

  // Apply search and alert filters
  const filteredTools = fieldTools.filter(tool => {
    const matchesSearch = tool.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         tool.serialNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (tool.employee?.toLowerCase() || '').includes(searchTerm.toLowerCase());
    const matchesAlert = !showAlertsOnly || tool.repair || tool.employee === 'Missing';
    const matchesMissing = !showMissingOnly || tool.employee === 'Missing';
    return matchesSearch && matchesAlert && matchesMissing;
  }).sort((a, b) => {
    // Try to extract numbers from the beginning of the name
    const numA = parseFloat(a.name);
    const numB = parseFloat(b.name);
    
    // If both names start with numbers, sort numerically
    if (!isNaN(numA) && !isNaN(numB)) {
      return numA - numB;
    }
    
    // If only one starts with a number, it comes first
    if (!isNaN(numA)) return -1;
    if (!isNaN(numB)) return 1;
    
    // If neither starts with a number, sort alphabetically
    return a.name.localeCompare(b.name);
  });

  const handleAddTool = async (toolData: Omit<Equipment, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newTool = { ...toolData, equipmentType: 'field' as const };
    await addProduct(newTool);
    setShowAddForm(false);
  };

  
  const handleUpdateTool = async (toolData: Omit<Equipment, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (!editingTool) return;
    try {
      await updateProduct(editingTool.id, toolData);
      setEditingTool(null);
      // Force a refresh to ensure the UI updates
      setTimeout(() => window.location.reload(), 100);
    } catch (error) {
      console.error('Error updating tool:', error);
      // Still close the form even on error
      setEditingTool(null);
    }
  };

  const handleEdit = (tool: Equipment) => {
    setEditingTool(tool);
    // Scroll to the form after it renders
    setTimeout(() => {
      editFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  };

  const handleDeleteTool = async (tool: Equipment) => {
    if (window.confirm(`Are you sure you want to delete "${tool.name}"?`)) {
      await deleteProduct(tool.id);
    }
  };


  const handleViewLog = (tool: Equipment) => {
    setSelectedTool(tool);
    setShowLog(true);
  };

  const handleShowQR = (tool: Equipment) => {
    setSelectedTool(tool);
    setShowQR(true);
  };

  const getEquipmentUrl = (id: string) => `${window.location.origin}/inventory/equipment/${id}`;

  const modalContent = (
    <>
        {/* Header */}
        <div className="px-6 py-4 border-b border-yellow-300 dark:border-yellow-700 bg-yellow-100 dark:bg-yellow-900 dark:bg-opacity-30">
          <h2 className="text-xl font-semibold text-yellow-700 dark:text-yellow-300">Manage Field Tools</h2>
        </div>

        {/* Content */}
        <div className="p-4">
          {/* Search and Filters */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <input
              type="text"
              placeholder="Search field tools..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 px-4 py-2 border border-yellow-600 rounded-lg bg-[#fffff0] dark:bg-black text-gray-900 dark:text-yellow-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
            />
            <button
              onClick={() => setShowAlertsOnly(!showAlertsOnly)}
              className={`px-4 py-2 rounded-lg transition-colors ${
                showAlertsOnly 
                  ? 'bg-red-600 text-white hover:bg-red-500' 
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300'
              }`}
            >
              {showAlertsOnly ? 'Showing Alerts & Missing' : 'Show Alerts & Missing'}
            </button>
            <button
              onClick={() => setShowMissingOnly(!showMissingOnly)}
              className={`px-4 py-2 rounded-lg transition-colors ${
                showMissingOnly 
                  ? 'bg-gray-600 text-white hover:bg-gray-500' 
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300'
              }`}
            >
              {showMissingOnly ? 'Showing Missing' : 'Show Missing'}
            </button>
            {currentUser?.role === 'admin' && (
              <button
                onClick={() => setShowAddForm(true)}
                className="px-4 py-2 bg-yellow-600 text-black rounded-lg hover:bg-yellow-500 transition-colors"
              >
                Add Tool
              </button>
            )}
          </div>

          {/* Add/Edit Form */}
          {showAddForm && (
            <div className="mb-4">
              <ProductForm
                product={null}
                onSubmit={handleAddTool}
                onCancel={() => setShowAddForm(false)}
                userRole={currentUser?.role === 'admin' ? 'admin' : currentUser?.role === 'supervisor' ? 'supervisor' : 'field'}
              />
            </div>
          )}

          {/* Tools List */}
          {loading ? (
            <div className="text-center py-8 text-yellow-600 dark:text-yellow-400">
              Loading field tools...
            </div>
          ) : filteredTools.length === 0 ? (
            <div className="text-center py-8 text-yellow-600 dark:text-yellow-400">
              {searchTerm || showAlertsOnly || showMissingOnly ? 'No field tools found matching your criteria.' : 'No field tools found.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full max-w-[100vw]">
                <thead>
                  <tr className="bg-yellow-100 dark:bg-yellow-900 dark:bg-opacity-30">
                    <th className="px-4 py-2 text-left text-yellow-700 dark:text-yellow-300">Name</th>
                    <th className="px-4 py-2 text-left text-yellow-700 dark:text-yellow-300">Category</th>
                    <th className="px-4 py-2 text-left text-yellow-700 dark:text-yellow-300">With</th>
                    <th className="px-4 py-2 text-left text-yellow-700 dark:text-yellow-300">Status</th>
                    <th className="px-4 py-2 text-left text-yellow-700 dark:text-yellow-300">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const getCategoryName = (cat: string) =>
                      categories.find(c => c.id === cat)?.name || cat || 'Uncategorized';

                    const grouped = filteredTools.reduce((acc, tool) => {
                      const name = getCategoryName(tool.category || '');
                      if (!acc[name]) acc[name] = [];
                      acc[name].push(tool);
                      return acc;
                    }, {} as Record<string, typeof filteredTools>);

                    // Sort tools within each category
                    Object.keys(grouped).forEach(key => {
                      grouped[key].sort((a, b) => {
                        const numA = parseFloat(a.name);
                        const numB = parseFloat(b.name);
                        if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
                        return a.name.localeCompare(b.name);
                      });
                    });

                    const sortedGroups = Object.entries(grouped).sort(([a], [b]) => {
                      const numA = parseFloat(a), numB = parseFloat(b);
                      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
                      return a.localeCompare(b);
                    });

                    return sortedGroups.map(([categoryName, tools]) => (
                      <React.Fragment key={categoryName}>
                        <tr>
                          <td colSpan={5} className="px-4 py-2 bg-yellow-900 bg-opacity-30 border-b border-yellow-700">
                            <span className="text-sm font-semibold text-yellow-600 dark:text-yellow-400 uppercase tracking-wide">
                              {categoryName} ({tools.length})
                            </span>
                          </td>
                        </tr>
                          {tools.map((tool) => (
                          <React.Fragment key={tool.id}>
                            <tr className="border-t border-yellow-200 dark:border-yellow-800">
                              <td className="px-4 py-2 text-gray-900 dark:text-yellow-100">{tool.name}</td>
                              <td className="px-4 py-2 text-gray-900 dark:text-yellow-100">{categories.find(c => c.id === tool.category)?.name || tool.category || 'Uncategorized'}</td>
                              <td className="px-4 py-2 text-gray-900 dark:text-yellow-100">{tool.employee}</td>
                              <td className="px-4 py-2">
                                <span className={`px-2 py-1 rounded text-xs font-medium ${
                                  tool.repair
                                    ? 'bg-red-100 dark:bg-red-900 dark:bg-opacity-30 text-red-600 dark:text-red-300'
                                    : tool.employee === 'Missing'
                                    ? 'bg-gray-100 dark:bg-gray-900 dark:bg-opacity-30 text-gray-600 dark:text-gray-300'
                                    : tool.employee === 'Office'
                                    ? 'bg-green-100 dark:bg-green-900 dark:bg-opacity-30 text-green-700 dark:text-green-300'
                                    : tool.employee
                                    ? 'bg-blue-100 dark:bg-blue-900 dark:bg-opacity-30 text-blue-700 dark:text-blue-300'
                                    : 'bg-green-100 dark:bg-green-900 dark:bg-opacity-30 text-green-700 dark:text-green-300'
                                }`}>
                                  {tool.repair ? 'Repair' : tool.employee === 'Missing' ? 'Missing' : tool.employee === 'Office' ? 'Office' : tool.employee ? 'In Use' : 'Available'}
                                </span>
                              </td>
                              <td className="px-4 py-2">
                                <div className="flex space-x-2">
                                  <button
                                    onClick={() => handleEdit(tool)}
                                    className="px-3 py-1 text-xs bg-yellow-600 text-black rounded hover:bg-yellow-500"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => { setSelectedTool(tool); setShowQR(true); }}
                                    className="px-3 py-1 text-xs bg-gray-600 text-white rounded hover:bg-gray-500"
                                  >
                                    QR
                                  </button>
                                  <button
                                    onClick={() => { setSelectedTool(tool); setShowLog(true); }}
                                    className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-500"
                                  >
                                    History
                                  </button>
                                </div>
                              </td>
                            </tr>
                            {editingTool?.id === tool.id && (
                              <tr>
                                <td colSpan={5} className="px-0 py-0">
                                  <div ref={editFormRef} className="p-4 bg-yellow-50 dark:bg-yellow-900 dark:bg-opacity-20 border border-yellow-300 dark:border-yellow-700">
                                    <ProductForm
                                      product={editingTool}
                                      onSubmit={handleUpdateTool}
                                      onCancel={() => setEditingTool(null)}
                                      onDelete={currentUser?.role === 'admin' ? () => handleDeleteTool(editingTool) : undefined}
                                      userRole={currentUser?.role === 'admin' ? 'admin' : currentUser?.role === 'supervisor' ? 'supervisor' : 'field'}
                                      allowFullEdit={true}
                                    />
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        ))}
                      </React.Fragment>
                    ));
                  })()}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* QR Code Modal */}
        {showQR && selectedTool && (
          <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50" onClick={() => setShowQR(false)}>
            <div className="bg-[#fffff0] dark:bg-black border border-yellow-600 rounded-lg shadow-xl p-6" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-yellow-700 dark:text-yellow-300">{selectedTool.name}</h3>
                <button onClick={() => setShowQR(false)} className="text-yellow-600 dark:text-yellow-400 hover:text-yellow-500">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="flex justify-center mb-4">
                <QRCodeSVG value={getEquipmentUrl(selectedTool.id)} size={200} level="M" includeMargin />
              </div>
              <p className="text-xs text-yellow-600 dark:text-yellow-500 text-center break-all">{getEquipmentUrl(selectedTool.id)}</p>
            </div>
          </div>
        )}

        {/* Log Modal */}
        {showLog && selectedTool && (
          <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50" onClick={() => setShowLog(false)}>
            <div className="bg-[#fffff0] dark:bg-black border border-yellow-600 rounded-lg shadow-xl p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-yellow-700 dark:text-yellow-300">Edit History - {selectedTool.name}</h3>
                <button onClick={() => setShowLog(false)} className="text-yellow-600 dark:text-yellow-400 hover:text-yellow-500">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <EquipmentLog
                equipment={selectedTool}
                onClose={() => setShowLog(false)}
              />
            </div>
          </div>
        )}
    </>
  );

  const pageContent = (
    <>
        {/* Header */}
        <div className="px-6 py-4 border-b border-yellow-300 dark:border-yellow-700 bg-yellow-100 dark:bg-yellow-900 dark:bg-opacity-30">
          <h2 className="text-xl font-semibold text-yellow-700 dark:text-yellow-300">Manage Field Tools</h2>
        </div>

        {/* Content */}
        <div className="p-4">
          {/* Search and Filters */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <input
              type="text"
              placeholder="Search field tools..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 px-4 py-2 border border-yellow-600 rounded-lg bg-[#fffff0] dark:bg-black text-gray-900 dark:text-yellow-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
            />
                        {currentUser?.role === 'admin' && (
              <button
                onClick={() => setShowAddForm(true)}
                className="px-4 py-2 bg-yellow-600 text-black rounded-lg hover:bg-yellow-500 font-medium transition-colors flex items-center justify-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Add Tool
              </button>
            )}
          </div>

          {/* Add Form */}
          {showAddForm && (
            <div className="mb-4 p-4 bg-yellow-50 dark:bg-yellow-900 dark:bg-opacity-30 rounded-lg">
              <ProductForm
                categories={categories}
                product={null}
                onSubmit={handleAddTool}
                onCancel={() => setShowAddForm(false)}
                userRole={currentUser?.role === 'admin' ? 'admin' : currentUser?.role === 'supervisor' ? 'supervisor' : 'field'}
              />
            </div>
          )}

          {/* Tools Table */}
          {loading ? (
            <div className="text-center py-8 text-yellow-600 dark:text-yellow-400">
              Loading field tools...
            </div>
          ) : filteredTools.length === 0 ? (
            <div className="text-center py-8 text-yellow-600 dark:text-yellow-400">
              {searchTerm || showAlertsOnly || showMissingOnly ? 'No field tools found matching your criteria.' : 'No field tools found.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full max-w-[100vw]">
                <thead>
                  <tr className="bg-yellow-100 dark:bg-yellow-900 dark:bg-opacity-30">
                    <th className="px-4 py-2 text-left text-yellow-700 dark:text-yellow-300">Name</th>
                    <th className="px-4 py-2 text-left text-yellow-700 dark:text-yellow-300">Category</th>
                    <th className="px-4 py-2 text-left text-yellow-700 dark:text-yellow-300">With</th>
                    <th className="px-4 py-2 text-left text-yellow-700 dark:text-yellow-300">Status</th>
                    <th className="px-4 py-2 text-left text-yellow-700 dark:text-yellow-300">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTools.map((tool) => (
                    <React.Fragment key={tool.id}>
                      <tr className="border-t border-yellow-200 dark:border-yellow-800">
                        <td className="px-4 py-2">
                          <span className="text-gray-900 dark:text-yellow-100">{tool.name}</span>
                        </td>
                        <td className="px-4 py-2 text-gray-600 dark:text-yellow-600">{categories.find(c => c.id === tool.category)?.name || tool.category || 'Uncategorized'}</td>
                        <td className="px-4 py-2 text-gray-600 dark:text-yellow-600">{tool.employee || '-'}</td>
                        <td className="px-4 py-2">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                          tool.repair
                            ? 'bg-red-100 dark:bg-red-900 dark:bg-opacity-30 text-red-600 dark:text-red-300'
                            : tool.employee === 'Missing'
                            ? 'bg-gray-100 dark:bg-gray-900 dark:bg-opacity-30 text-gray-600 dark:text-gray-300'
                            : tool.employee === 'Office'
                            ? 'bg-green-100 dark:bg-green-900 dark:bg-opacity-30 text-green-700 dark:text-green-300'
                            : tool.employee
                            ? 'bg-blue-100 dark:bg-blue-900 dark:bg-opacity-30 text-blue-700 dark:text-blue-300'
                            : 'bg-green-100 dark:bg-green-900 dark:bg-opacity-30 text-green-700 dark:text-green-300'
                        }`}>
                          {tool.repair ? 'Repair' : tool.employee === 'Missing' ? 'Missing' : tool.employee === 'Office' ? 'Office' : tool.employee ? 'In Use' : 'Available'}
                        </span>
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => handleEdit(tool)}
                              className="p-1 text-yellow-600 hover:text-yellow-500"
                              title="Edit"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                          <button
                            onClick={() => handleViewLog(tool)}
                            className="p-1 text-blue-600 hover:text-blue-500"
                            title="View Log"
                          >
                            <Clock className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleShowQR(tool)}
                            className="p-1 text-purple-600 hover:text-purple-500"
                            title="Show QR Code"
                          >
                            <QrCode className="h-4 w-4" />
                          </button>
                          {currentUser?.role === 'admin' && (
                            <button
                              onClick={() => handleDeleteTool(tool)}
                              className="p-1 text-red-600 hover:text-red-500"
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                      {editingTool?.id === tool.id && (
                        <tr>
                          <td colSpan={5} className="px-0 py-0">
                            <div ref={editFormRef} className="p-4 bg-yellow-50 dark:bg-yellow-900 dark:bg-opacity-20 border border-yellow-300 dark:border-yellow-700">
                              <ProductForm
                                categories={categories}
                                product={editingTool}
                                onSubmit={handleUpdateTool}
                                onCancel={() => setEditingTool(null)}
                                onDelete={currentUser?.role === 'admin' ? () => handleDeleteTool(editingTool) : undefined}
                                userRole={currentUser?.role === 'admin' ? 'admin' : currentUser?.role === 'supervisor' ? 'supervisor' : 'field'}
                                allowFullEdit={true}
                              />
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* QR Code Modal */}
        {showQR && selectedTool && (
          <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50" onClick={() => setShowQR(false)}>
            <div className="bg-[#fffff0] dark:bg-black border border-yellow-600 rounded-lg shadow-xl p-6" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-yellow-700 dark:text-yellow-300">QR Code - {selectedTool.name}</h3>
                <button onClick={() => setShowQR(false)} className="text-yellow-600 dark:text-yellow-400 hover:text-yellow-500">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="flex justify-center p-4 bg-white rounded">
                <QRCodeSVG value={getEquipmentUrl(selectedTool.id)} size={200} />
              </div>
              <div className="mt-4 text-center text-sm text-gray-600 dark:text-yellow-600">
                {getEquipmentUrl(selectedTool.id)}
              </div>
            </div>
          </div>
        )}

        {/* Log Modal */}
        {showLog && selectedTool && (
          <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50" onClick={() => setShowLog(false)}>
            <div className="bg-[#fffff0] dark:bg-black border border-yellow-600 rounded-lg shadow-xl p-6 w-full max-w-2xl" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-yellow-700 dark:text-yellow-300">Edit History - {selectedTool.name}</h3>
                <button onClick={() => setShowLog(false)} className="text-yellow-600 dark:text-yellow-400 hover:text-yellow-500">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <EquipmentLog
                equipment={selectedTool}
                onClose={() => setShowLog(false)}
              />
            </div>
          </div>
        )}
    </>
  );

  if (asPage) {
    return (
      <div className="min-h-screen bg-[#f0e0c8] dark:bg-black text-gray-900 dark:text-yellow-100 px-2 sm:px-4 py-4 -mx-2 sm:-mx-4 lg:mx-0 lg:p-2">
        <div className="max-w-5xl mx-auto">
          <div className="bg-[#fffff0] dark:bg-black border border-yellow-600 rounded-lg shadow-xl dark:shadow-yellow-900/20 dark:shadow-2xl overflow-hidden">
            {pageContent}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-[#fffff0] dark:bg-black border border-yellow-600 rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] flex flex-col overflow-hidden">
        {modalContent}
      </div>
    </div>
  );
}
