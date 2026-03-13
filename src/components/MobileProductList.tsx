import React from 'react';
import { User, MapPin, Wrench, Pencil } from 'lucide-react';
import { Equipment, Category } from '../types';
import { ProductForm } from './ProductForm';

interface MobileProductListProps {
  products: Equipment[];
  onEdit: (product: Equipment) => void;
  selectedEquipmentId?: string;
  onEditProduct: (product: Omit<Equipment, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onCancelEdit: () => void;
  categories: Category[];
  userRole?: 'admin' | 'supervisor' | 'field';
}

export function MobileProductList({ 
  products, 
  onEdit,
  selectedEquipmentId,
  onEditProduct,
  onCancelEdit,
  categories,
  userRole
}: MobileProductListProps) {

  if (products.length === 0) {
    return (
      <div className="p-8 text-center">
        <div className="h-12 w-12 bg-yellow-400 rounded-full mx-auto mb-4 flex items-center justify-center">
          <span className="text-black text-xl font-bold">!</span>
        </div>
        <h3 className="text-lg font-medium text-yellow-300 mb-2">No equipment found</h3>
        <p className="text-yellow-600">Get started by adding your first equipment to the inventory.</p>
      </div>
    );
  }

  // If no categories, create a default "Uncategorized" category
  const categoriesToUse = categories.length > 0 ? categories : [
    { id: 'uncategorized', name: 'Uncategorized', description: 'Items without category', color: '#6B7280' }
  ];

  return (
    <div className="divide-y divide-yellow-800">
      {/* Group products by category */}
      {categoriesToUse.map((category) => {
        // Try both exact match and case-insensitive match
        const categoryProducts = products.filter(product => 
          product.category === category.name || 
          product.category?.toLowerCase() === category.name?.toLowerCase()
        );
        
        if (categoryProducts.length === 0) return null;
        
        return (
          <div key={category.id}>
            {/* Category Header */}
            <div className="sticky top-0 bg-yellow-900 bg-opacity-30 z-10 p-3 border-b border-yellow-700">
              <h3 className="text-sm font-semibold text-yellow-300">
                {category.name} ({categoryProducts.length})
              </h3>
            </div>
            
            {/* Products in this category */}
            {categoryProducts.map((product) => {
              const selectedProduct = products.find(p => p.id === selectedEquipmentId);
              
              return (
                <React.Fragment key={product.id}>
                  <div 
                    className={`p-3 border-b border-yellow-800 ${product.repair ? 'bg-red-950' : 'bg-black'} ${selectedEquipmentId === product.id ? 'ring-2 ring-yellow-400 ring-opacity-50' : ''}`}
                  >
                    {/* Equipment Name - Primary */}
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className={`text-sm font-medium ${product.repair ? 'text-red-400' : 'text-yellow-100'} break-words`}>
                          {product.name}
                        </h3>
                      </div>
                      {/* Edit Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (selectedEquipmentId === product.id) {
                            onCancelEdit();
                          } else {
                            onEdit(product);
                          }
                        }}
                        className="p-2 text-yellow-300 bg-yellow-900 bg-opacity-40 rounded-lg hover:bg-yellow-800 hover:bg-opacity-50 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 focus:ring-offset-black transition-all duration-200 hover:scale-105 active:scale-95"
                        title={selectedEquipmentId === product.id ? "Close edit form" : "Edit equipment"}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    </div>

                    {/* Equipment Details - Mobile Card Layout */}
                    <div className="space-y-2">
                      {/* Employee */}
                      {product.employee && (
                        <div className="flex items-center space-x-2">
                          <User className="h-3 w-3 text-yellow-600" />
                          <span className="text-yellow-300 text-xs">{product.employee}</span>
                        </div>
                      )}

                      {/* Site */}
                      {product.site && (
                        <div className="flex items-center space-x-2">
                          <MapPin className="h-3 w-3 text-yellow-600" />
                          <span className="text-yellow-300 text-xs">{product.site}</span>
                        </div>
                      )}

                      {/* Repair Description */}
                      {product.repair && product.repairDescription && (
                        <div className="flex items-start space-x-2 mt-2 p-2 bg-red-900 bg-opacity-20 rounded">
                          <Wrench className="h-3 w-3 text-red-500 mt-0.5" />
                          <div>
                            <span className="text-red-400 text-xs font-medium">Repair Details:</span>
                            <p className="text-red-300 text-xs mt-1">{product.repairDescription}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Inline Edit Form - Appears directly below selected equipment */}
                  {selectedEquipmentId === product.id && (
                    <div className="border-t border-yellow-800">
                      <div className="bg-yellow-900 p-3">
                        <ProductForm
                          categories={categories}
                          product={selectedProduct}
                          onSubmit={onEditProduct}
                          onCancel={onCancelEdit}
                          onDelete={() => {
                            // Delete functionality would need to be passed down
                            console.log('Delete mobile product:', product.id);
                          }}
                          userRole={userRole}
                        />
                      </div>
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        );
      })}
      
      {/* Dynamic categories based on actual product categories */}
      {(() => {
        const matchedProducts = categoriesToUse.flatMap(category => 
          products.filter(product => 
            product.category === category.name || 
            product.category?.toLowerCase() === category.name?.toLowerCase()
          )
        );
        const unmatchedProducts = products.filter(product => 
          !matchedProducts.find(mp => mp.id === product.id)
        );
        
        if (unmatchedProducts.length > 0) {
          // Group unmatched products by their actual category
          const productsByCategory = unmatchedProducts.reduce((acc, product) => {
            const categoryName = product.category || 'Uncategorized';
            if (!acc[categoryName]) {
              acc[categoryName] = [];
            }
            acc[categoryName].push(product);
            return acc;
          }, {} as Record<string, typeof products>);
          
          return Object.entries(productsByCategory).map(([categoryName, categoryProducts]) => {
            // Find the category info from the categories array to get color and proper name
            // Try multiple matching approaches
            let categoryInfo = categories.find(c => c.name === categoryName);
            let displayCategoryName = categoryName;
                                    
            // If exact match fails, try case-insensitive match
            if (!categoryInfo) {
              categoryInfo = categories.find(c => 
                c.name.toLowerCase() === categoryName.toLowerCase()
              );
            }
            
            // If still no match, try to match by category ID if categoryName looks like an ID
            if (!categoryInfo && (categoryName.length > 5 && /^[a-zA-Z0-9]+$/.test(categoryName))) {
              categoryInfo = categories.find(c => c.id === categoryName);
            }
            
            // If we found a category, use its proper name
            if (categoryInfo) {
              displayCategoryName = categoryInfo.name;
            }
            
            return (
              <div key={categoryName}>
                <div className="sticky top-0 bg-yellow-900 bg-opacity-30 z-10 p-3 border-b border-yellow-700">
                  <h3 className="text-sm font-semibold text-yellow-300">
                    {displayCategoryName} ({categoryProducts.length})
                  </h3>
                </div>
                {categoryProducts.map((product) => {
                  const selectedProduct = products.find(p => p.id === selectedEquipmentId);
                  
                  return (
                    <React.Fragment key={product.id}>
                      <div 
                        className={`p-3 border-b border-yellow-800 ${product.repair ? 'bg-red-950' : 'bg-black'} ${selectedEquipmentId === product.id ? 'ring-2 ring-yellow-400 ring-opacity-50' : ''}`}
                      >
                        {/* Equipment Name - Primary */}
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className={`text-sm font-medium ${product.repair ? 'text-red-400' : 'text-yellow-100'} break-words`}>
                              {product.name}
                            </h3>
                          </div>
                          {/* Edit Button */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (selectedEquipmentId === product.id) {
                                onCancelEdit();
                              } else {
                                onEdit(product);
                              }
                            }}
                            className="p-2 text-yellow-300 bg-yellow-900 bg-opacity-40 rounded-lg hover:bg-yellow-800 hover:bg-opacity-50 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 focus:ring-offset-black transition-all duration-200 hover:scale-105 active:scale-95"
                            title={selectedEquipmentId === product.id ? "Close edit form" : "Edit equipment"}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                        </div>

                        {/* Equipment Details - Mobile Card Layout */}
                        <div className="space-y-2">
                          {/* Employee */}
                          {product.employee && (
                            <div className="flex items-center space-x-2">
                              <User className="h-3 w-3 text-yellow-600" />
                              <span className="text-yellow-300 text-xs">{product.employee}</span>
                            </div>
                          )}

                          {/* Site */}
                          {product.site && (
                            <div className="flex items-center space-x-2">
                              <MapPin className="h-3 w-3 text-yellow-600" />
                              <span className="text-yellow-300 text-xs">{product.site}</span>
                            </div>
                          )}

                          {/* Repair Description */}
                          {product.repair && product.repairDescription && (
                            <div className="flex items-start space-x-2 mt-2 p-2 bg-red-900 bg-opacity-20 rounded">
                              <Wrench className="h-3 w-3 text-red-500 mt-0.5" />
                              <div>
                                <span className="text-red-400 text-xs font-medium">Repair Details:</span>
                                <p className="text-red-300 text-xs mt-1">{product.repairDescription}</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* Inline Edit Form - Appears directly below selected equipment */}
                      {selectedEquipmentId === product.id && (
                        <div className="border-t border-yellow-800">
                          <div className="bg-yellow-900 p-3">
                            <ProductForm
                              categories={categories}
                              product={selectedProduct}
                              onSubmit={onEditProduct}
                              onCancel={onCancelEdit}
                              onDelete={() => {
                                // Delete functionality would need to be passed down
                                console.log('Delete mobile product:', product.id);
                              }}
                              userRole={userRole}
                            />
                          </div>
                        </div>
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            );
          });
        }
        return null;
      })()}
    </div>
  );
}
