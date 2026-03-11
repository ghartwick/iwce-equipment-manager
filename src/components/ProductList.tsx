import React, { useRef } from 'react';
import { Package, Download, Upload, Pencil } from 'lucide-react';
import { Equipment, Category } from '../types';
import { exportToExcel, importFromExcel } from '../utils/exportToExcel';
import { ProductForm } from './ProductForm';

interface ProductListProps {
  products: Equipment[];
  categories: Category[];
  onEdit: (product: Equipment) => void;
  onDelete: (id: string) => void;
  selectedEquipmentId?: string;
  onEditProduct: (product: Omit<Equipment, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onAddProduct: (product: Omit<Equipment, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onCancelEdit: () => void;
  userRole?: 'admin' | 'supervisor' | 'field';
  showCategoryHeadings?: boolean; // New prop for category headings
  refreshData?: () => void; // Add refresh function
  onImportComplete?: () => void; // Add callback for import completion
}

export function ProductList({
  products,
  categories,
  onEdit,
  onDelete,
  selectedEquipmentId,
  onEditProduct,
  onAddProduct,
  onCancelEdit,
  userRole,
  showCategoryHeadings = false,
  refreshData,
  onImportComplete,
}: ProductListProps) {
  const selectedProduct = products.find(p => p.id === selectedEquipmentId);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Debug: Log products and categories when they change
  React.useEffect(() => {
    console.log('ProductList Debug - Current products:', products.map(p => ({
      id: p.id,
      name: p.name,
      category: p.category,
      categoryName: categories.find(c => c.id === p.category)?.name || 'Unknown'
    })));
    console.log('ProductList Debug - Current categories:', categories.map(c => ({ id: c.id, name: c.name })));
  }, [products, categories]);

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      console.log('Import Debug - Starting import process...');
      const importedEquipment = await importFromExcel(file, categories);
      console.log('Import Debug - Received imported equipment:', importedEquipment);
      
      // Create new equipment items
      for (let i = 0; i < importedEquipment.length; i++) {
        const equipment = importedEquipment[i];
        console.log(`Import Debug - Creating equipment item ${i + 1}/${importedEquipment.length}:`, equipment);
        
        try {
          await onAddProduct(equipment as Omit<Equipment, 'id' | 'createdAt' | 'updatedAt'>);
          console.log(`Import Debug - Successfully created equipment item ${i + 1}:`, equipment.name);
        } catch (error) {
          console.error(`Import Debug - Failed to create equipment item ${i + 1}:`, error);
        }
      }
      
      // Refresh data to show new categories and equipment
      if (refreshData) {
        console.log('Import Debug - Refreshing data...');
        await refreshData();
        console.log('Import Debug - Data refresh completed');
        
        // Add a small delay to ensure Firebase sync is complete
        await new Promise(resolve => setTimeout(resolve, 1000));
        console.log('Import Debug - Firebase sync delay completed');
        
        // Refresh one more time to ensure latest data
        await refreshData();
        console.log('Import Debug - Second data refresh completed');
      }
      
      // Reset category filter to show all items
      if (onImportComplete) {
        console.log('Import Debug - Calling onImportComplete callback...');
        onImportComplete();
        console.log('Import Debug - onImportComplete callback completed');
      } else {
        console.log('Import Debug - No onImportComplete callback provided');
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
      <div className="bg-black border border-yellow-600 rounded-lg shadow p-8 text-center">
        <Package className="h-12 w-12 text-yellow-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-yellow-300 mb-2">No equipment found</h3>
        <p className="text-yellow-600">Get started by adding your first equipment to the inventory.</p>
      </div>
    );
  }

  return (
    <div className="bg-black border border-yellow-600 rounded-lg shadow overflow-hidden">
      {/* Header with export button */}
      <div className="bg-yellow-900 px-6 py-4 flex justify-between items-center border-b-2 border-yellow-700">
        <h2 className="text-lg font-semibold text-yellow-300">Equipment Inventory</h2>
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
        <table className="w-full max-w-[100vw] divide-y divide-yellow-800">
          <thead className="bg-yellow-900">
            <tr>
              <th className="w-[70%] px-2 py-3 text-left text-xs font-medium text-yellow-200 uppercase tracking-wider">
                Equipment
              </th>
              <th className="w-[30%] px-1 py-3 text-center text-xs font-medium text-yellow-200 uppercase tracking-wider">
              </th>
            </tr>
          </thead>
          <tbody className="bg-black divide-y divide-yellow-800">
            {showCategoryHeadings ? (
              // Group by category with headings
              (() => {
                const groupedProducts = products.reduce((groups, product) => {
                  const category = categories.find(cat => cat.id === product.category)?.name || product.category;
                  if (!groups[category]) {
                    groups[category] = [];
                  }
                  groups[category].push(product);
                  return groups;
                }, {} as Record<string, Equipment[]>);

                return Object.entries(groupedProducts).map(([categoryName, categoryProducts]) => (
                  <React.Fragment key={categoryName}>
                    {/* Category Heading */}
                    <tr>
                      <td colSpan={2} className="px-4 py-2 bg-yellow-900 bg-opacity-30 border-b border-yellow-700">
                        <h3 className="text-sm font-semibold text-yellow-300 uppercase tracking-wide">
                          {categoryName}
                        </h3>
                      </td>
                    </tr>
                    
                    {/* Products in this category */}
                    {categoryProducts.map((product) => (
                      <React.Fragment key={product.id}>
                        <tr 
                          className={`
                            ${selectedEquipmentId === product.id 
                              ? (product.repair ? "bg-red-900" : "bg-yellow-900") 
                              : (product.repair ? "bg-red-950" : "bg-black")
                            } 
                            transition-all duration-200
                          `}
                        >
                          <td className="w-[70%] px-2 py-4">
                            <div className="max-w-xs">
                              <div className={`text-xs sm:text-sm font-medium ${product.repair ? "text-red-400" : "text-yellow-100"} break-words`}>{product.name}</div>
                              <div className="text-xs sm:text-sm text-yellow-600">
                                {product.employee && <div className="break-words">{product.employee}</div>}
                                {product.site && <div className="break-words">{product.site}</div>}
                                {product.repair && (
                                  <>
                                    <div className="text-xs sm:text-sm text-red-500 font-medium break-words">Repair: Yes</div>
                                    {product.repairDescription && (
                                      <div className="text-xs text-red-400 mt-1 italic break-words">Repair: {product.repairDescription}</div>
                                    )}
                                  </>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="w-[30%] px-1 py-4">
                            <div className="flex justify-center">
                              <div className="flex justify-end w-3/4">
                                <button
                                  onClick={() => {
                                    if (selectedEquipmentId === product.id) {
                                      onCancelEdit();
                                    } else {
                                      onEdit(product);
                                    }
                                  }}
                                  className="inline-flex items-center justify-center p-4 sm:p-1 text-yellow-300 bg-yellow-900 bg-opacity-40 rounded-lg hover:bg-yellow-800 hover:bg-opacity-50 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 focus:ring-offset-black transition-all duration-200 hover:scale-105 active:scale-95"
                                  title={selectedEquipmentId === product.id ? "Close edit form" : "Edit equipment"}
                                >
                                  <Pencil className="h-6 w-6 sm:h-3 sm:w-3" />
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                        
                        {/* Inline Edit Form */}
                        {selectedEquipmentId === product.id && (
                          <tr>
                            <td colSpan={2} className="px-0 py-0 border-t border-yellow-800">
                              <div className="bg-yellow-900">
                                <ProductForm
                                  categories={categories}
                                  product={selectedProduct}
                                  onSubmit={onEditProduct}
                                  onCancel={onCancelEdit}
                                  onDelete={() => onDelete(product.id)}
                                  userRole={userRole}
                                />
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
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
                      <td colSpan={2} className="px-4 py-2 bg-yellow-900 bg-opacity-30 border-b border-yellow-700">
                        <h3 className="text-sm font-semibold text-yellow-300 uppercase tracking-wide">
                          {categoryName}
                        </h3>
                      </td>
                    </tr>
                    
                    {/* Products */}
                    {products.map((product) => (
                      <React.Fragment key={product.id}>
                        <tr 
                          className={`
                            ${selectedEquipmentId === product.id 
                              ? (product.repair ? "bg-red-900" : "bg-yellow-900") 
                              : (product.repair ? "bg-red-950" : "bg-black")
                            } 
                            transition-all duration-200
                          `}
                        >
                          <td className="w-[70%] px-2 py-4">
                            <div className="max-w-xs">
                              <div className={`text-xs sm:text-sm font-medium ${product.repair ? "text-red-400" : "text-yellow-100"} break-words`}>{product.name}</div>
                              <div className="text-xs sm:text-sm text-yellow-600">
                                {product.employee && <div className="break-words">{product.employee}</div>}
                                {product.site && <div className="break-words">{product.site}</div>}
                                {product.repair && (
                                  <>
                                    <div className="text-xs sm:text-sm text-red-500 font-medium break-words">Repair: Yes</div>
                                    {product.repairDescription && (
                                      <div className="text-xs text-red-400 mt-1 italic break-words">Repair: {product.repairDescription}</div>
                                    )}
                                  </>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="w-[30%] px-1 py-4">
                            <div className="flex justify-center">
                              <div className="flex justify-end w-3/4">
                                <button
                                  onClick={() => {
                                    if (selectedEquipmentId === product.id) {
                                      onCancelEdit();
                                    } else {
                                      onEdit(product);
                                    }
                                  }}
                                  className="inline-flex items-center justify-center p-4 sm:p-1 text-yellow-300 bg-yellow-900 bg-opacity-40 rounded-lg hover:bg-yellow-800 hover:bg-opacity-50 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 focus:ring-offset-black transition-all duration-200 hover:scale-105 active:scale-95"
                                  title={selectedEquipmentId === product.id ? "Close edit form" : "Edit equipment"}
                                >
                                  <Pencil className="h-6 w-6 sm:h-3 sm:w-3" />
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                        
                        {/* Inline Edit Form */}
                        {selectedEquipmentId === product.id && (
                          <tr>
                            <td colSpan={2} className="px-0 py-0 border-t border-yellow-800">
                              <div className="bg-yellow-900">
                                <ProductForm
                                  categories={categories}
                                  product={selectedProduct}
                                  onSubmit={onEditProduct}
                                  onCancel={onCancelEdit}
                                  onDelete={() => onDelete(product.id)}
                                  userRole={userRole}
                                />
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </React.Fragment>
                );
              })()
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
