import React, { useRef, useState } from 'react';
import { Package, Download, Upload, Pencil } from 'lucide-react';
import { Equipment, Category } from '../types';
import { exportToExcel, importFromExcel } from '../utils/exportToExcel';
import { Site } from '../services/siteManagementService';
import { AppUser } from '../services/userManagementService';
import { ServiceNotificationItem, mostUrgentPerEquipment } from '../services/serviceNotificationService';
import { ServiceScheduleBars } from './ServiceScheduleBars';

interface ProductListProps {
  products: Equipment[];
  categories: Category[];
  onEdit?: (product: Equipment) => void;
  selectedEquipmentId?: string;
  onAddProduct?: (product: Omit<Equipment, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onCancelEdit?: () => void;
  userRole?: 'admin' | 'supervisor' | 'field';
  showCategoryHeadings?: boolean;
  refreshData?: () => void;
  onImportComplete?: () => void;
  sites?: Site[];
  users?: AppUser[];
  onInlineUpdate?: (productId: string, updates: Partial<Equipment>) => Promise<void>;
  fleetProducts?: Equipment[];
  serviceNotifications?: ServiceNotificationItem[];
}

export function ProductList({
  products,
  categories,
  onEdit,
  selectedEquipmentId,
  onAddProduct,
  onCancelEdit,
  userRole,
  showCategoryHeadings = false,
  refreshData,
  onImportComplete,
  sites,
  users,
  onInlineUpdate,
  fleetProducts = [],
  serviceNotifications = [],
}: ProductListProps) {
  // A unit now has one notification per interval, so rows summarise with the worst one.
  const urgentByEquipment = React.useMemo(
    () => mostUrgentPerEquipment(serviceNotifications),
    [serviceNotifications]
  );
  const getServiceStatus = (productId: string) => urgentByEquipment[productId];
  const getServiceItems = (productId: string) =>
    serviceNotifications.filter(n => n.equipmentId === productId && !n.isCustom);
  const sortedSites = sites ? [...sites].sort((a, b) => a.name.localeCompare(b.name)) : [];
  const sortedUsers = users ? [...users].filter(u => u.isActive && (u.role === 'field' || u.role === 'admin' || u.role === 'supervisor')).sort((a, b) => a.name.localeCompare(b.name)) : [];

  const isFleet = (productId: string) => fleetProducts.some(f => f.id === productId);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<'site' | 'employee' | null>(null);

  const handleInlineFieldClick = (e: React.MouseEvent, productId: string, field: 'site' | 'employee') => {
    e.stopPropagation();
    if (!onInlineUpdate) return;
    if (editingProductId === productId && editingField === field) {
      setEditingProductId(null);
      setEditingField(null);
    } else {
      setEditingProductId(productId);
      setEditingField(field);
    }
  };

  const handleInlineChange = async (productId: string, field: 'site' | 'employee', value: string) => {
    if (!onInlineUpdate) return;
    try {
      await onInlineUpdate(productId, { [field]: value });
    } catch (error) {
      console.error('Error updating inline field:', error);
    }
    setEditingProductId(null);
    setEditingField(null);
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const importedEquipment = await importFromExcel(file, categories);
      
      // Create new equipment items
      for (let i = 0; i < importedEquipment.length; i++) {
        const equipment = importedEquipment[i];
        
        try {
          await onAddProduct?.(equipment as Omit<Equipment, 'id' | 'createdAt' | 'updatedAt'>);
        } catch (error) {
          console.error(`Failed to create equipment item ${i + 1}:`, error);
        }
      }
      
      // Refresh data to show new categories and equipment
      if (refreshData) {
        await refreshData();
        
        // Add a small delay to ensure Firebase sync is complete
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Refresh one more time to ensure latest data
        await refreshData();
      }
      
      // Reset category filter to show all items
      if (onImportComplete) {
        onImportComplete();
      }
      
      alert(`Successfully imported ${importedEquipment.length} equipment items!`);
    } catch (error) {
      console.error('Import failed:', error);
      alert('Failed to import Excel file. Please check the file format and try again.');
    }
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  if (products.length === 0) {
    return (
      <div className="bg-yellow-200 dark:bg-black border border-yellow-600 rounded-lg shadow p-8 text-center">
        <Package className="h-12 w-12 text-yellow-600 dark:text-yellow-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-yellow-700 dark:text-yellow-300 mb-2">No equipment found</h3>
        <p className="text-yellow-600">Get started by adding your first equipment to the inventory.</p>
      </div>
    );
  }

  return (
    <>
    <div className="bg-yellow-200 dark:bg-black border border-yellow-600 rounded-lg shadow overflow-hidden">
      {/* Header with export button */}
      <div className="bg-yellow-200 dark:bg-yellow-900 px-6 py-4 flex justify-between items-center border-b-2 border-yellow-700">
        <h2 className="text-lg font-semibold text-yellow-800 dark:text-yellow-300">Equipment Inventory</h2>
        {userRole === 'admin' && (
          <div className="flex items-center space-x-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleImport}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center space-x-1 px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-500 transition-colors sm:flex sm:items-center sm:space-x-2 sm:px-4 sm:py-2 sm:text-sm"
            >
              <Upload className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline sm:text-sm sm:font-medium">Import Excel</span>
              <span className="sm:hidden">Import</span>
            </button>
            <button
              onClick={() => exportToExcel(products, 'equipment-inventory', categories)}
              className="flex items-center space-x-1 px-2 py-1 text-xs bg-yellow-500 text-black rounded hover:bg-yellow-400 transition-colors sm:flex sm:items-center sm:space-x-2 sm:px-4 sm:py-2 sm:text-sm"
            >
              <Download className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline sm:text-sm sm:font-medium">Export to Excel</span>
              <span className="sm:hidden">Export</span>
            </button>
          </div>
        )}
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full max-w-[100vw]">
          <tbody className="bg-yellow-200 dark:bg-black divide-y divide-yellow-400 dark:divide-yellow-800">
            {showCategoryHeadings ? (
              // Group by category with headings
              (() => {
                const groupedProducts = products.reduce((groups, product) => {
                  const category = categories.find(cat => cat.id === product.category)?.name || product.category || 'Uncategorized';
                  if (!groups[category]) {
                    groups[category] = [];
                  }
                  groups[category].push(product);
                  return groups;
                }, {} as Record<string, Equipment[]>);

                const sortedGroups = Object.entries(groupedProducts).sort(([a], [b]) => {
                  const numA = parseFloat(a);
                  const numB = parseFloat(b);
                  if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
                  return a.localeCompare(b);
                });

                return sortedGroups.map(([categoryName, categoryProducts]) => (
                  <React.Fragment key={categoryName}>
                    {/* Category Heading */}
                    <tr>
                      <td colSpan={2} className="px-4 py-2 bg-yellow-600 dark:bg-yellow-900 dark:bg-opacity-30 border-b border-yellow-700">
                        <h3 className="text-sm font-semibold text-yellow-100 dark:text-yellow-300 uppercase tracking-wide">
                          {categoryName}
                        </h3>
                      </td>
                    </tr>
                    
                    {/* Products in this category */}
                    {categoryProducts.map((product) => {
                      const serviceStatus = getServiceStatus(product.id);
                      const isRepairStatus = product.employee === 'Out For Repair' || product.employee === 'Broken' || product.employee === 'Missing' || (product.equipmentType === 'heavy' && (product.site?.includes('Out For Repair') || product.site?.includes('Other') || product.site?.includes('Missing')));
                      const siteFlaggedRed = sites?.find(s => s.name === product.site)?.flagRed;

                      const getRowBg = () => {
                        if (serviceStatus?.status === 'due') return selectedEquipmentId === product.id ? 'bg-red-200 dark:bg-red-900' : 'bg-red-100 dark:bg-red-950';
                        if (serviceStatus?.status === 'schedule') return selectedEquipmentId === product.id ? 'bg-yellow-300 dark:bg-yellow-800' : 'bg-yellow-200 dark:bg-yellow-900';
                        if (isRepairStatus) return selectedEquipmentId === product.id ? 'bg-red-200 dark:bg-red-900' : 'bg-red-100 dark:bg-red-950';
                        if (siteFlaggedRed) return selectedEquipmentId === product.id ? 'bg-red-200 dark:bg-red-900' : 'bg-red-100 dark:bg-red-950';
                        return selectedEquipmentId === product.id ? 'bg-yellow-200 dark:bg-yellow-900' : 'bg-yellow-200 dark:bg-black';
                      };

                      return (
                      <React.Fragment key={product.id}>
                        <tr 
                          onClick={() => onEdit?.(product)}
                          className={`
                            ${getRowBg()} 
                            transition-all duration-200 cursor-pointer hover:opacity-80
                          `}
                        >
                          <td className="w-[70%] px-2 py-4">
                            <div className="max-w-xs">
                              <div className={`text-xs sm:text-sm font-medium ${isRepairStatus ? "text-red-600 dark:text-red-400" : serviceStatus?.status === 'due' ? "text-red-600 dark:text-red-400" : "text-gray-900 dark:text-yellow-100"} break-words`}>
                                {product.name}
                                {product.description && (
                                  <span className="text-gray-600 dark:text-gray-400 ml-2">- {product.description}</span>
                                )}
                              </div>
                              {serviceStatus?.message && (
                                <div className={`text-xs font-semibold mt-0.5 ${serviceStatus.status === 'due' ? 'text-red-600 dark:text-red-400' : 'text-yellow-700 dark:text-yellow-400'}`}>
                                  {serviceStatus.message}
                                </div>
                              )}
                              <div className="text-xs sm:text-sm text-yellow-700 dark:text-yellow-600 mt-1">
                                {onInlineUpdate ? (
                                  <>
                                    {product.equipmentType !== 'heavy' && (
                                      editingProductId === product.id && editingField === 'employee' ? (
                                        <select
                                          autoFocus
                                          value={product.employee || ''}
                                          onClick={(e) => e.stopPropagation()}
                                          onChange={(e) => handleInlineChange(product.id, 'employee', e.target.value)}
                                          onBlur={() => { setEditingProductId(null); setEditingField(null); }}
                                          className="px-2 py-1 text-xs rounded ring-1 ring-yellow-600 bg-yellow-200 dark:bg-black text-gray-900 dark:text-yellow-100"
                                        >
                                          <option value="">No Employee</option>
                                          <option value="Office">Office</option>
                                          <option value="Shop">Shop</option>
                                          <option value="Broken">Broken</option>
                                          <option value="Out For Repair">Out For Repair</option>
                                          <option value="Missing">Missing</option>
                                          {sortedUsers.map((u) => (
                                            <option key={u.id} value={u.name}>{u.name}</option>
                                          ))}
                                        </select>
                                      ) : (
                                        <div
                                          className="break-words cursor-pointer hover:bg-yellow-100 dark:hover:bg-yellow-900 dark:hover:bg-opacity-30 px-0.5 rounded inline-block"
                                          onClick={(e) => handleInlineFieldClick(e, product.id, 'employee')}
                                        >
                                          {product.employee || <span className="text-gray-400 dark:text-gray-600 italic">(set employee)</span>}
                                        </div>
                                      )
                                    )}
                                    {product.equipmentType === 'heavy' && !isFleet(product.id) && (
                                      editingProductId === product.id && editingField === 'site' ? (
                                        <select
                                          autoFocus
                                          value={product.site || ''}
                                          onClick={(e) => e.stopPropagation()}
                                          onChange={(e) => handleInlineChange(product.id, 'site', e.target.value)}
                                          onBlur={() => { setEditingProductId(null); setEditingField(null); }}
                                          className="px-2 py-1 text-xs rounded ring-1 ring-yellow-600 bg-yellow-200 dark:bg-black text-gray-900 dark:text-yellow-100 mt-1"
                                        >
                                          <option value="">No Site</option>
                                          {sortedSites.map((s) => (
                                            <option key={s.id} value={s.name}>{s.name}</option>
                                          ))}
                                        </select>
                                      ) : (
                                        <div
                                          className="break-words cursor-pointer hover:bg-yellow-100 dark:hover:bg-yellow-900 dark:hover:bg-opacity-30 px-0.5 rounded inline-block mt-0.5"
                                          onClick={(e) => handleInlineFieldClick(e, product.id, 'site')}
                                        >
                                          {product.site || <span className="text-gray-400 dark:text-gray-600 italic">(set site)</span>}
                                        </div>
                                      )
                                    )}
                                    {product.equipmentType === 'heavy' && isFleet(product.id) && (
                                      editingProductId === product.id && editingField === 'employee' ? (
                                        <select
                                          autoFocus
                                          value={product.employee || ''}
                                          onClick={(e) => e.stopPropagation()}
                                          onChange={(e) => handleInlineChange(product.id, 'employee', e.target.value)}
                                          onBlur={() => { setEditingProductId(null); setEditingField(null); }}
                                          className="px-2 py-1 text-xs rounded ring-1 ring-yellow-600 bg-yellow-200 dark:bg-black text-gray-900 dark:text-yellow-100 mt-1"
                                        >
                                          <option value="">No Employee</option>
                                          <option value="Office">Office</option>
                                          <option value="Shop">Shop</option>
                                          <option value="Broken">Broken</option>
                                          <option value="Out For Repair">Out For Repair</option>
                                          <option value="Missing">Missing</option>
                                          {sortedUsers.map((u) => (
                                            <option key={u.id} value={u.name}>{u.name}</option>
                                          ))}
                                        </select>
                                      ) : (
                                        <div
                                          className="break-words cursor-pointer hover:bg-yellow-100 dark:hover:bg-yellow-900 dark:hover:bg-opacity-30 px-0.5 rounded inline-block mt-0.5"
                                          onClick={(e) => handleInlineFieldClick(e, product.id, 'employee')}
                                        >
                                          {product.employee || <span className="text-gray-400 dark:text-gray-600 italic">(set employee)</span>}
                                        </div>
                                      )
                                    )}
                                  </>
                                ) : (
                                  <>
                                    {product.employee && <div className="break-words">{product.employee}</div>}
                                    {product.site && product.equipmentType === 'heavy' && !isFleet(product.id) && <div className="break-words">{product.site}</div>}
                                  </>
                                )}
                                {product.notes && product.notes.length > 0 && (
                                  <div className="text-xs text-gray-600 dark:text-gray-400 italic mt-1 break-words">
                                    {product.notes.map((note) => (
                                      <div key={note.id}>- {note.text}</div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="w-[30%] px-1 py-4">
                            <div className="flex items-center justify-end gap-3 pr-1">
                              {(() => {
                                const states = getServiceItems(product.id)
                                  .map(n => n.state)
                                  .filter((s): s is NonNullable<typeof s> => !!s);
                                if (states.length === 0) return null;
                                return (
                                  <div className="w-48" onClick={(e) => e.stopPropagation()}>
                                    <ServiceScheduleBars states={states} compact initiallyExpanded={1} />
                                  </div>
                                );
                              })()}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (selectedEquipmentId === product.id) {
                                    onCancelEdit?.();
                                  } else if (onEdit) {
                                    onEdit?.(product);
                                  }
                                }}
                                className="inline-flex items-center justify-center p-4 sm:p-1 text-yellow-700 dark:text-yellow-300 rounded-lg hover:bg-yellow-200 dark:hover:bg-yellow-900 dark:hover:bg-opacity-30 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-black transition-all duration-200 hover:scale-105 active:scale-95"
                                title={selectedEquipmentId === product.id ? "Close" : "Change Location"}
                              >
                                <Pencil className="h-6 w-6 sm:h-3 sm:w-3" />
                              </button>
                            </div>
                          </td>
                        </tr>
                        
                                              </React.Fragment>
                    );
                    })}
                  </React.Fragment>
                ));
              })()
            ) : (
              // Single category with heading
              (() => {
                // Get the category name for the current selection
                const categoryName = products.length > 0 
                  ? categories.find(cat => cat.id === products[0].category)?.name || products[0].category
                  : 'Unknown Category';

                return (
                  <React.Fragment>
                    {/* Single Category Heading */}
                    <tr>
                      <td colSpan={2} className="px-4 py-2 bg-yellow-600 dark:bg-yellow-900 dark:bg-opacity-30 border-b border-yellow-700">
                        <h3 className="text-sm font-semibold text-yellow-300 uppercase tracking-wide">
                          {categoryName}
                        </h3>
                      </td>
                    </tr>
                    
                    {/* Products */}
                    {products.map((product) => {
                      const siteFlaggedRed = sites?.find(s => s.name === product.site)?.flagRed;
                      const isRepairStatus = product.employee === 'Out For Repair' || product.employee === 'Broken' || product.employee === 'Missing' || (product.equipmentType === 'heavy' && (product.site?.includes('Out For Repair') || product.site?.includes('Other') || product.site?.includes('Missing')));

                      const getRowBg = () => {
                        if (isRepairStatus) return selectedEquipmentId === product.id ? 'bg-red-200 dark:bg-red-900' : 'bg-red-100 dark:bg-red-950';
                        if (siteFlaggedRed) return selectedEquipmentId === product.id ? 'bg-red-200 dark:bg-red-900' : 'bg-red-100 dark:bg-red-950';
                        return selectedEquipmentId === product.id ? 'bg-yellow-200 dark:bg-yellow-900' : 'bg-yellow-200 dark:bg-black';
                      };

                      return (
                      <React.Fragment key={product.id}>
                        <tr 
                          onClick={() => onEdit?.(product)}
                          className={`
                            ${getRowBg()} 
                            transition-all duration-200 cursor-pointer hover:opacity-80
                          `}
                        >
                          <td className="w-[70%] px-2 py-4">
                            <div className="max-w-xs">
                              <div className={`text-xs sm:text-sm font-medium ${(isRepairStatus || siteFlaggedRed) ? "text-red-600 dark:text-red-400" : "text-gray-900 dark:text-yellow-100"} break-words`}>
                                {product.name}
                                {product.description && (
                                  <span className="text-gray-600 dark:text-gray-400 ml-2">- {product.description}</span>
                                )}
                              </div>
                              <div className="text-xs sm:text-sm text-yellow-700 dark:text-yellow-600 mt-1">
                                {onInlineUpdate ? (
                                  <>
                                    {product.equipmentType !== 'heavy' && (
                                      editingProductId === product.id && editingField === 'employee' ? (
                                        <select
                                          autoFocus
                                          value={product.employee || ''}
                                          onClick={(e) => e.stopPropagation()}
                                          onChange={(e) => handleInlineChange(product.id, 'employee', e.target.value)}
                                          onBlur={() => { setEditingProductId(null); setEditingField(null); }}
                                          className="px-2 py-1 text-xs rounded ring-1 ring-yellow-600 bg-yellow-200 dark:bg-black text-gray-900 dark:text-yellow-100"
                                        >
                                          <option value="">No Employee</option>
                                          <option value="Office">Office</option>
                                          <option value="Shop">Shop</option>
                                          <option value="Broken">Broken</option>
                                          <option value="Out For Repair">Out For Repair</option>
                                          <option value="Missing">Missing</option>
                                          {sortedUsers.map((u) => (
                                            <option key={u.id} value={u.name}>{u.name}</option>
                                          ))}
                                        </select>
                                      ) : (
                                        <div
                                          className="break-words cursor-pointer hover:bg-yellow-100 dark:hover:bg-yellow-900 dark:hover:bg-opacity-30 px-0.5 rounded inline-block"
                                          onClick={(e) => handleInlineFieldClick(e, product.id, 'employee')}
                                        >
                                          {product.employee || <span className="text-gray-400 dark:text-gray-600 italic">(set employee)</span>}
                                        </div>
                                      )
                                    )}
                                    {product.equipmentType === 'heavy' && !isFleet(product.id) && (
                                      editingProductId === product.id && editingField === 'site' ? (
                                        <select
                                          autoFocus
                                          value={product.site || ''}
                                          onClick={(e) => e.stopPropagation()}
                                          onChange={(e) => handleInlineChange(product.id, 'site', e.target.value)}
                                          onBlur={() => { setEditingProductId(null); setEditingField(null); }}
                                          className="px-2 py-1 text-xs rounded ring-1 ring-yellow-600 bg-yellow-200 dark:bg-black text-gray-900 dark:text-yellow-100 mt-1"
                                        >
                                          <option value="">No Site</option>
                                          {sortedSites.map((s) => (
                                            <option key={s.id} value={s.name}>{s.name}</option>
                                          ))}
                                        </select>
                                      ) : (
                                        <div
                                          className="break-words cursor-pointer hover:bg-yellow-100 dark:hover:bg-yellow-900 dark:hover:bg-opacity-30 px-0.5 rounded inline-block mt-0.5"
                                          onClick={(e) => handleInlineFieldClick(e, product.id, 'site')}
                                        >
                                          {product.site || <span className="text-gray-400 dark:text-gray-600 italic">(set site)</span>}
                                        </div>
                                      )
                                    )}
                                    {product.equipmentType === 'heavy' && isFleet(product.id) && (
                                      editingProductId === product.id && editingField === 'employee' ? (
                                        <select
                                          autoFocus
                                          value={product.employee || ''}
                                          onClick={(e) => e.stopPropagation()}
                                          onChange={(e) => handleInlineChange(product.id, 'employee', e.target.value)}
                                          onBlur={() => { setEditingProductId(null); setEditingField(null); }}
                                          className="px-2 py-1 text-xs rounded ring-1 ring-yellow-600 bg-yellow-200 dark:bg-black text-gray-900 dark:text-yellow-100 mt-1"
                                        >
                                          <option value="">No Employee</option>
                                          <option value="Office">Office</option>
                                          <option value="Shop">Shop</option>
                                          <option value="Broken">Broken</option>
                                          <option value="Out For Repair">Out For Repair</option>
                                          <option value="Missing">Missing</option>
                                          {sortedUsers.map((u) => (
                                            <option key={u.id} value={u.name}>{u.name}</option>
                                          ))}
                                        </select>
                                      ) : (
                                        <div
                                          className="break-words cursor-pointer hover:bg-yellow-100 dark:hover:bg-yellow-900 dark:hover:bg-opacity-30 px-0.5 rounded inline-block mt-0.5"
                                          onClick={(e) => handleInlineFieldClick(e, product.id, 'employee')}
                                        >
                                          {product.employee || <span className="text-gray-400 dark:text-gray-600 italic">(set employee)</span>}
                                        </div>
                                      )
                                    )}
                                  </>
                                ) : (
                                  <>
                                    {product.employee && <div className="break-words">{product.employee}</div>}
                                    {product.site && product.equipmentType === 'heavy' && !isFleet(product.id) && <div className="break-words">{product.site}</div>}
                                  </>
                                )}
                                {product.notes && product.notes.length > 0 && (
                                  <div className="text-xs text-gray-600 dark:text-gray-400 italic mt-1 break-words">
                                    {product.notes.map((note) => (
                                      <div key={note.id}>- {note.text}</div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="w-[30%] px-1 py-4">
                            <div className="flex items-center justify-end gap-3 pr-1">
                              {(() => {
                                const states = getServiceItems(product.id)
                                  .map(n => n.state)
                                  .filter((s): s is NonNullable<typeof s> => !!s);
                                if (states.length === 0) return null;
                                return (
                                  <div className="w-48" onClick={(e) => e.stopPropagation()}>
                                    <ServiceScheduleBars states={states} compact initiallyExpanded={1} />
                                  </div>
                                );
                              })()}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (selectedEquipmentId === product.id) {
                                    onCancelEdit?.();
                                  } else if (onEdit) {
                                    onEdit?.(product);
                                  }
                                }}
                                className="inline-flex items-center justify-center p-4 sm:p-1 text-yellow-700 dark:text-yellow-300 rounded-lg hover:bg-yellow-200 dark:hover:bg-yellow-900 dark:hover:bg-opacity-30 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-black transition-all duration-200 hover:scale-105 active:scale-95"
                                title={selectedEquipmentId === product.id ? "Close" : "Change Location"}
                              >
                                <Pencil className="h-6 w-6 sm:h-3 sm:w-3" />
                              </button>
                            </div>
                          </td>
                        </tr>
                        
                                              </React.Fragment>
                    );
                    })}
                  </React.Fragment>
                );
              })()
            )}
          </tbody>
        </table>
      </div>
    </div>
    </>
  );
}
