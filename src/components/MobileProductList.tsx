import React from 'react';
import { Pencil } from 'lucide-react';
import { Equipment, Category } from '../types';

interface MobileProductListProps {
  products: Equipment[];
  onEdit?: (product: Equipment) => void;
  selectedEquipmentId?: string;
  onCancelEdit?: () => void;
  categories: Category[];
}

export function MobileProductList({ 
  products, 
  onEdit,
  selectedEquipmentId,
  onCancelEdit,
  categories
}: MobileProductListProps) {
  if (products.length === 0) {
    return (
      <div className="p-8 text-center">
        <div className="h-12 w-12 bg-yellow-400 rounded-full mx-auto mb-4 flex items-center justify-center">
          <span className="text-black text-xl font-bold">!</span>
        </div>
        <h3 className="text-lg font-medium text-yellow-700 dark:text-yellow-300 mb-2">No equipment found</h3>
        <p className="text-yellow-600">Get started by adding your first equipment to the inventory.</p>
      </div>
    );
  }

  // Sort categories numerically first, then alphabetically
  const sortedCategories = [...(categories.length > 0 ? categories : [
    { id: 'uncategorized', name: 'Uncategorized', description: 'Items without category', color: '#6B7280' }
  ])].sort((a, b) => {
    const numA = parseFloat(a.name);
    const numB = parseFloat(b.name);
    if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
    return a.name.localeCompare(b.name);
  });

  return (
    <>
    <div data-product-list className="divide-y divide-yellow-200 dark:divide-yellow-800">
      {/* Group products by category */}
      {sortedCategories.map((category) => {
        // Match by category ID (new) or name (legacy)
        const categoryProducts = products.filter(product => 
          product.category === category.id ||
          product.category === category.name ||
          product.category?.toLowerCase() === category.name?.toLowerCase()
        );
        
        if (categoryProducts.length === 0) return null;
        
        return (
          <div key={category.id}>
            {/* Category Header */}
            <div className="sticky top-0 bg-yellow-600 dark:bg-yellow-900 dark:bg-opacity-30 z-10 p-3 border-b border-yellow-700">
              <h3 className="text-sm font-semibold text-yellow-100 dark:text-yellow-300">
                {category.name} ({categoryProducts.length})
              </h3>
            </div>
            
            {/* Products in this category */}
            {categoryProducts.map((product) => {
                            
              return (
                <React.Fragment key={product.id}>
                  <div 
                    className={`p-3 border-b border-yellow-200 dark:border-yellow-800 ${(product.employee === 'Out For Repair' || product.employee === 'Broken' || product.employee === 'Missing' || (product.equipmentType === 'heavy' && (product.site?.includes('Out For Repair') || product.site?.includes('Other') || product.site?.includes('Missing')))) ? 'bg-red-100 dark:bg-red-950' : 'bg-yellow-200 dark:bg-black'} ${selectedEquipmentId === product.id ? 'ring-2 ring-yellow-400 ring-opacity-50' : ''}`}
                  >
                    {/* Equipment Name - Primary */}
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className={`text-sm font-medium ${(product.employee === 'Out For Repair' || product.employee === 'Broken' || product.employee === 'Missing' || (product.equipmentType === 'heavy' && (product.site?.includes('Out For Repair') || product.site?.includes('Other') || product.site?.includes('Missing')))) ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-yellow-100'} break-words`}>
                          {product.name}
                        </h3>
                        {product.description && (
                          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 break-words">{product.description}</p>
                        )}
                      </div>
                      {/* Edit Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (selectedEquipmentId === product.id) {
                            onCancelEdit?.();
                          } else if (onEdit) {
                            onEdit?.(product);
                          }
                        }}
                        className="p-2 text-yellow-700 dark:text-yellow-300 rounded-lg hover:bg-yellow-200 dark:hover:bg-yellow-900 dark:hover:bg-opacity-30 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-black transition-all duration-200 hover:scale-105 active:scale-95"
                        title={selectedEquipmentId === product.id ? "Close" : "Change Location"}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    </div>

                    {/* Equipment Details - Mobile Card Layout */}
                    <div className="space-y-2">
                      {/* Employee */}
                      {product.employee && (
                        <div>
                          <span className="text-yellow-700 dark:text-yellow-300 text-xs">{product.employee}</span>
                        </div>
                      )}

                      {/* Site */}
                      {product.site && product.equipmentType === 'heavy' && (
                        <div>
                          <span className="text-yellow-700 dark:text-yellow-300 text-xs">{product.site}</span>
                        </div>
                      )}

                      {/* Location Notes */}
                      {product.locationNotes && (
                        <div>
                          <span className="text-gray-600 dark:text-gray-400 text-xs italic">{product.locationNotes}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                </React.Fragment>
              );
            })}
          </div>
        );
      })}
      
      {/* Dynamic categories based on actual product categories */}
      {(() => {
        const matchedProducts = sortedCategories.flatMap((category: Category) => 
          products.filter(product => 
            product.category === category.id ||
            product.category === category.name || 
            product.category?.toLowerCase() === category.name?.toLowerCase()
          )
        );
        const unmatchedProducts = products.filter(product => 
          !matchedProducts.find((mp: Equipment) => mp.id === product.id)
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
            
            // Find the category ID from the categories array
            const category = categories.find(c => c.name === displayCategoryName);
            const categoryId = category?.id || categoryName;
            
            return (
              <div key={categoryName}>
                <div id={`category-${categoryId}`} className="sticky top-0 bg-yellow-600 dark:bg-yellow-900 dark:bg-opacity-30 z-10 p-3 border-b border-yellow-700">
                  <h3 className="text-sm font-semibold text-yellow-100 dark:text-yellow-300">
                    {displayCategoryName} ({categoryProducts.length})
                  </h3>
                </div>
                {categoryProducts.map((product) => {
                                    
                  return (
                    <React.Fragment key={product.id}>
                      <div 
                        className={`p-3 border-b border-yellow-200 dark:border-yellow-800 ${(product.employee === 'Out For Repair' || product.employee === 'Broken' || product.employee === 'Missing' || (product.equipmentType === 'heavy' && (product.site?.includes('Out For Repair') || product.site?.includes('Other') || product.site?.includes('Missing')))) ? 'bg-red-100 dark:bg-red-950' : 'bg-yellow-200 dark:bg-black'} ${selectedEquipmentId === product.id ? 'ring-2 ring-yellow-400 ring-opacity-50' : ''}`}
                      >
                        {/* Equipment Name - Primary */}
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className={`text-sm font-medium ${(product.employee === 'Out For Repair' || product.employee === 'Broken' || product.employee === 'Missing' || (product.equipmentType === 'heavy' && (product.site?.includes('Out For Repair') || product.site?.includes('Other') || product.site?.includes('Missing')))) ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-yellow-100'} break-words`}>
                              {product.name}
                            </h3>
                          </div>
                          {/* Edit Button */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (selectedEquipmentId === product.id) {
                                onCancelEdit?.();
                              } else if (onEdit) {
                                onEdit?.(product);
                              }
                            }}
                            className="p-2 text-yellow-700 dark:text-yellow-300 rounded-lg hover:bg-yellow-200 dark:hover:bg-yellow-900 dark:hover:bg-opacity-30 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-black transition-all duration-200 hover:scale-105 active:scale-95"
                            title={selectedEquipmentId === product.id ? "Close" : "Change Location"}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                        </div>

                        {/* Equipment Details - Mobile Card Layout */}
                        <div className="space-y-2">
                          {/* Employee */}
                          {product.employee && (
                            <div>
                              <span className="text-yellow-700 dark:text-yellow-300 text-xs">{product.employee}</span>
                            </div>
                          )}

                          {/* Site */}
                          {product.site && (
                            <div>
                              <span className="text-yellow-700 dark:text-yellow-300 text-xs">{product.site}</span>
                            </div>
                          )}

                                                  </div>
                      </div>
                      
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

    </>
  );
}
