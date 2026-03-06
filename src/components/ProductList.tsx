import React from 'react';
import { Package, Download } from 'lucide-react';
import { Equipment, Category } from '../types';
import { exportToExcel } from '../utils/exportToExcel';
import { ProductForm } from './ProductForm';

interface ProductListProps {
  products: Equipment[];
  categories: Category[];
  onEdit: (product: Equipment) => void;
  onDelete: (id: string) => void;
  selectedEquipmentId?: string;
  onEditProduct: (product: Omit<Equipment, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onCancelEdit: () => void;
  userRole?: 'admin' | 'technician';
}

export function ProductList({
  products,
  categories,
  onEdit,
  onDelete,
  selectedEquipmentId,
  onEditProduct,
  onCancelEdit,
  userRole,
}: ProductListProps) {
  const selectedProduct = products.find(p => p.id === selectedEquipmentId);

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
        <button
          onClick={() => exportToExcel(products, 'equipment-inventory')}
          className="flex items-center space-x-1 px-2 py-1 text-xs bg-yellow-500 text-black rounded hover:bg-yellow-400 transition-colors sm:flex sm:items-center sm:space-x-2 sm:px-4 sm:py-2 sm:text-sm"
        >
          <Download className="h-3 w-3 sm:h-4 sm:w-4" />
          <span className="hidden sm:inline sm:text-sm sm:font-medium">Export to Excel</span>
          <span className="sm:hidden">Export</span>
        </button>
      </div>
      
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-yellow-800">
          <thead className="bg-yellow-900">
            <tr>
              <th className="w-full px-6 py-3 text-left text-xs font-medium text-yellow-200 uppercase tracking-wider">
                Equipment
              </th>
            </tr>
          </thead>
          <tbody className="bg-black divide-y divide-yellow-800">
            {products.map((product) => (
              <React.Fragment key={product.id}>
                <tr 
                  className={`
                    ${selectedEquipmentId === product.id 
                      ? (product.repair ? "bg-red-900 ring-2 ring-yellow-400 ring-opacity-50" : "bg-yellow-900 ring-2 ring-yellow-400 ring-opacity-50") 
                      : (product.repair ? "bg-red-950" : "bg-black")
                    } 
                    cursor-pointer
                    transition-colors duration-200
                    ${selectedEquipmentId === product.id
                      ? 'bg-yellow-900 bg-opacity-50'
                      : 'hover:bg-yellow-900 hover:bg-opacity-20'
                    }
                  `}
                  onTouchEnd={(e) => {
                    e.preventDefault(); // Prevent click event from firing
                    // Add touch feedback for mobile
                    if (selectedEquipmentId === product.id) {
                      // If already selected, toggle off (hide form)
                      onCancelEdit();
                    } else {
                      // If different equipment, select it (show form)
                      onEdit(product);
                    }
                  }}
                  onClick={(_) => {
                    // Only handle click on desktop (non-touch devices)
                    if (!('ontouchstart' in window)) {
                      if (selectedEquipmentId === product.id) {
                        // If already selected, toggle off (hide form)
                        onCancelEdit();
                      } else {
                        // If different equipment, select it (show form)
                        onEdit(product);
                      }
                    }
                  }}
                  title={selectedEquipmentId === product.id ? "Tap to close edit form" : "Tap to edit equipment"}
                >
                  <td className="px-6 py-4">
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
                </tr>
                
                {/* Inline Edit Form - Appears directly below selected equipment */}
                {selectedEquipmentId === product.id && (
                  <tr>
                    <td colSpan={1} className="px-0 py-0 border-t border-yellow-800">
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
          </tbody>
        </table>
      </div>
    </div>
  );
}
