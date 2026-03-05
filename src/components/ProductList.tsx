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
  userRole?: 'admin' | 'manager' | 'technician';
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
      <div className="bg-yellow-900 px-6 py-4 flex justify-between items-center">
        <h2 className="text-lg font-semibold text-yellow-300">Equipment Inventory</h2>
        <button
          onClick={() => exportToExcel(products, 'equipment-inventory')}
          className="flex items-center space-x-2 px-4 py-2 bg-yellow-500 text-black rounded-md hover:bg-yellow-400 transition-colors"
        >
          <Download className="h-4 w-4" />
          <span className="text-sm font-medium">Export to Excel</span>
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
                    ${product.repair ? "hover:bg-red-900" : "hover:bg-yellow-950"} 
                    cursor-pointer
                    transition-colors duration-200
                  `}
                  onClick={() => {
  if (selectedEquipmentId === product.id) {
    // If already selected, toggle off (hide form)
    onCancelEdit();
  } else {
    // If different equipment, select it (show form)
    onEdit(product);
  }
}}
                  title={selectedEquipmentId === product.id ? "Click to close edit form" : "Click to edit equipment"}
                >
                  <td className="px-6 py-4">
                    <div className="max-w-xs">
                      <div className={`text-sm font-medium ${product.repair ? "text-red-400" : "text-yellow-100"} break-words`}>{product.name}</div>
                      <div className="text-sm text-yellow-600">
                        {product.employee && <div className="break-words">{product.employee}</div>}
                        {product.site && <div className="break-words">{product.site}</div>}
                        {product.repair && (
                          <>
                            <div className="text-red-500 font-medium break-words">Repair: Yes</div>
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
