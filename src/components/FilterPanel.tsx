import { useState, useEffect, useRef } from 'react';
import { Filter, Plus, Trash2, Edit2, ChevronDown, ChevronUp } from 'lucide-react';
import { Category, Equipment } from '../types';

interface FilterPanelProps {
  categories: Category[];
  selectedCategory: string;
  onCategoryChange: (categoryId: string) => void;
  onAddCategory: (category: Omit<Category, 'id'>) => void;
  onDeleteCategory: (categoryId: string) => void;
  onEditCategory: (categoryId: string, category: Omit<Category, 'id'>) => void;
  userRole?: 'admin' | 'supervisor' | 'field';
  products?: Equipment[];
  fleetProducts?: Equipment[];
}

export function FilterPanel({ 
  categories, 
  selectedCategory, 
  onCategoryChange, 
  onAddCategory,
  onDeleteCategory,
  onEditCategory,
  userRole,
  products = [],
  fleetProducts = []
}: FilterPanelProps) {

  const scrollToCategory = (categoryId: string) => {
    // First change the category
    onCategoryChange(categoryId);
    
    // Collapse the form when a category is selected
    setIsCategoryFormCollapsed(true);
    
    // Then scroll to the category section after a brief delay to allow re-render
    setTimeout(() => {
      let elementId: string;
      
      if (categoryId === 'all') {
        // Scroll to top of product list
        const productList = document.querySelector('[data-product-list]');
        if (productList) {
          productList.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      } else {
        // Find the category by ID or name
        const category = categories.find(c => c.id === categoryId);
        if (category) {
          elementId = `category-${category.id}`;
        } else {
          // If not found by ID, try by name
          elementId = `category-${categoryId}`;
        }
        
        const element = document.getElementById(elementId);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    }, 100);
  };
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isCategoryFormCollapsed, setIsCategoryFormCollapsed] = useState(true);
  const panelRef = useRef<HTMLDivElement>(null);

  // Detect clicks outside the panel to collapse it
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setIsCategoryFormCollapsed(true);
      }
    };

    // Only add listener if panel is expanded
    if (!isCategoryFormCollapsed) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isCategoryFormCollapsed]);

  const sortCats = (cats: Category[]) => [...cats].sort((a, b) => {
    const nameA = a.name.toLowerCase();
    const nameB = b.name.toLowerCase();
    const numA = parseFloat(nameA);
    const numB = parseFloat(nameB);
    if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
    return nameA.localeCompare(nameB);
  });

  // Build sets of category IDs/names used by each equipment type
  const heavyCatKeys = new Set<string>();
  const fieldCatKeys = new Set<string>();
  const fleetCatKeys = new Set<string>();
  products.forEach(p => {
    if (!p.category) return;
    if (p.equipmentType === 'heavy') heavyCatKeys.add(p.category);
    else fieldCatKeys.add(p.category);
  });
  fleetProducts.forEach(p => {
    if (p.category) fleetCatKeys.add(p.category);
  });

  const matchesCat = (cat: Category, keys: Set<string>) =>
    keys.has(cat.id) || keys.has(cat.name);

  const heavyCategories = sortCats(categories.filter(c => matchesCat(c, heavyCatKeys)));
  const fieldCategories = sortCats(categories.filter(c => matchesCat(c, fieldCatKeys) && !matchesCat(c, heavyCatKeys)));
  const fleetCategories = sortCats(categories.filter(c => matchesCat(c, fleetCatKeys) && !matchesCat(c, heavyCatKeys) && !matchesCat(c, fieldCatKeys)));
  const uncategorized = sortCats(categories.filter(c => !matchesCat(c, heavyCatKeys) && !matchesCat(c, fieldCatKeys) && !matchesCat(c, fleetCatKeys)));

  const handleAddCategory = () => {
    if (newCategoryName.trim()) {
      onAddCategory({
        name: newCategoryName.trim(),
        description: '',
        color: '#FFB700' // Default Bruins gold color
      });
      setNewCategoryName('');
      setShowAddCategory(false);
    }
  };

  const handleEditCategory = (categoryId: string) => {
    const category = categories.find(cat => cat.id === categoryId);
    if (category) {
      setNewCategoryName(category.name);
      setEditingCategoryId(categoryId);
      setShowAddCategory(false);
    }
  };

  const handleUpdateCategory = () => {
    if (newCategoryName.trim() && editingCategoryId) {
      onEditCategory(editingCategoryId, {
        name: newCategoryName.trim(),
        description: '',
        color: '#FFB700' // Default Bruins gold color
      });
      setNewCategoryName('');
      setEditingCategoryId(null);
    }
  };

  const handleCancelEdit = () => {
    setEditingCategoryId(null);
    setNewCategoryName('');
  };

  return (
    <>
    {/* Add Category Modal */}
    {showAddCategory && (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onMouseDown={(e) => e.stopPropagation()}>
        <div className="bg-yellow-100 dark:bg-gray-900 border border-yellow-500 dark:border-yellow-700 rounded-lg shadow-2xl p-6 w-80 space-y-4">
          <h3 className="text-sm font-semibold text-yellow-700 dark:text-yellow-300">Add Category</h3>
          <input
            type="text"
            placeholder="Category name"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAddCategory(); if (e.key === 'Escape') setShowAddCategory(false); }}
            autoFocus
            className="w-full px-3 py-2 border border-yellow-600 rounded-md bg-yellow-200 dark:bg-black text-gray-900 dark:text-yellow-100 placeholder-yellow-500 dark:placeholder-yellow-600 focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 outline-none text-sm"
          />
          <div className="flex justify-end space-x-2">
            <button
              onClick={() => { setShowAddCategory(false); setNewCategoryName(''); }}
              className="px-3 py-1.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm rounded hover:bg-gray-300 dark:hover:bg-gray-600"
            >
              Cancel
            </button>
            <button
              onClick={handleAddCategory}
              className="px-3 py-1.5 bg-yellow-500 text-black text-sm rounded hover:bg-yellow-600 font-medium"
            >
              Add
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Edit Category Modal */}
    {editingCategoryId && (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onMouseDown={(e) => e.stopPropagation()}>
        <div className="bg-yellow-100 dark:bg-gray-900 border border-yellow-500 dark:border-yellow-700 rounded-lg shadow-2xl p-6 w-80 space-y-4">
          <h3 className="text-sm font-semibold text-yellow-700 dark:text-yellow-300">Edit Category</h3>
          <input
            type="text"
            placeholder="Category name"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleUpdateCategory(); if (e.key === 'Escape') handleCancelEdit(); }}
            autoFocus
            className="w-full px-3 py-2 border border-yellow-600 rounded-md bg-yellow-200 dark:bg-black text-gray-900 dark:text-yellow-100 placeholder-yellow-500 dark:placeholder-yellow-600 focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 outline-none text-sm"
          />
          <div className="flex justify-end space-x-2">
            <button
              onClick={handleCancelEdit}
              className="px-3 py-1.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm rounded hover:bg-gray-300 dark:hover:bg-gray-600"
            >
              Cancel
            </button>
            <button
              onClick={handleUpdateCategory}
              className="px-3 py-1.5 bg-yellow-500 text-black text-sm rounded hover:bg-yellow-600 font-medium"
            >
              Update
            </button>
          </div>
        </div>
      </div>
    )}

    <div ref={panelRef} className="bg-yellow-200 dark:bg-black border border-yellow-600 rounded-lg shadow p-2 sm:p-4">
      <div 
        className="flex items-center justify-between mb-2 sm:mb-3 cursor-pointer"
        onClick={() => setIsCategoryFormCollapsed(!isCategoryFormCollapsed)}
      >
        <div className="flex items-center space-x-2">
          <Filter className="h-3 w-3 sm:h-4 sm:w-4 text-yellow-600 dark:text-yellow-400" />
          <h3 className="text-xs sm:text-sm font-medium text-yellow-600 dark:text-yellow-400">
                    {selectedCategory === 'all' 
                      ? 'All Categories' 
                      : categories.find(c => c.id === selectedCategory)?.name || 'All Categories'}
                  </h3>
        </div>
        <div className="flex items-center space-x-1">
          <div
            className="p-1 text-yellow-600 dark:text-yellow-400 hover:text-yellow-500 dark:hover:text-yellow-300"
            title={isCategoryFormCollapsed ? "Expand Category Form" : "Collapse Category Form"}
          >
            {isCategoryFormCollapsed ? (
              <ChevronDown className="h-3 w-3 sm:h-4 sm:w-4" />
            ) : (
              <ChevronUp className="h-3 w-3 sm:h-4 sm:w-4" />
            )}
          </div>
          {userRole === 'admin' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowAddCategory(!showAddCategory);
              }}
              className="hidden sm:block p-1 text-yellow-600 dark:text-yellow-400 hover:text-yellow-500 dark:hover:text-yellow-300"
              title="Add Category"
            >
              <Plus className="h-3 w-3 sm:h-4 sm:w-4" />
            </button>
          )}
        </div>
      </div>

      {!isCategoryFormCollapsed && (
        <>
          <div className="space-y-1 sm:space-y-2">
            <button
              role="button"
              onClick={() => scrollToCategory('all')}
              className={`w-full text-left px-2 py-1 sm:px-3 sm:py-2 rounded-md transition-colors text-xs sm:text-sm ${
                selectedCategory === 'all'
                  ? 'bg-yellow-600 text-black'
                  : 'hover:bg-yellow-200 dark:hover:bg-yellow-900 text-yellow-700 dark:text-yellow-200'
              }`}
            >
              All Categories
            </button>

            {/* Helper to render a category button */}
            {(() => {
              const renderCategory = (category: Category) => (
                <div
                  role="button"
                  key={category.id}
                  onClick={() => scrollToCategory(category.id)}
                  className={`relative group flex items-center justify-between w-full px-2 py-1 sm:px-3 sm:py-2 rounded-md transition-colors text-xs sm:text-sm cursor-pointer ${
                    selectedCategory === category.id
                      ? 'bg-yellow-600 text-black'
                      : 'hover:bg-yellow-200 dark:hover:bg-yellow-900 text-yellow-700 dark:text-yellow-200'
                  }`}
                >
                  <div className="flex items-center space-x-2 flex-1">
                    <span>{category.name}</span>
                  </div>
                  {userRole === 'admin' && (
                    <div className="hidden sm:flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-all">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleEditCategory(category.id); }}
                        className="p-1 text-yellow-500 hover:text-yellow-300"
                        title="Edit category"
                      >
                        <Edit2 className="h-2 w-2 sm:h-3 sm:w-3" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (window.confirm(`Are you sure you want to delete the category "${category.name}"?`)) {
                            onDeleteCategory(category.id);
                          }
                        }}
                        className="p-1 text-red-500 hover:text-red-300"
                        title="Delete category"
                      >
                        <Trash2 className="h-2 w-2 sm:h-3 sm:w-3" />
                      </button>
                    </div>
                  )}
                </div>
              );

              return (
                <>
                  {heavyCategories.length > 0 && (
                    <div>
                      <p className="px-2 pt-2 pb-1 text-xs font-semibold text-yellow-600 dark:text-yellow-500 uppercase tracking-wide">
                        Heavy Equipment
                      </p>
                      {heavyCategories.map(renderCategory)}
                    </div>
                  )}
                  {fieldCategories.length > 0 && (
                    <div>
                      <p className="px-2 pt-2 pb-1 text-xs font-semibold text-yellow-600 dark:text-yellow-500 uppercase tracking-wide">
                        Field Tools
                      </p>
                      {fieldCategories.map(renderCategory)}
                    </div>
                  )}
                  <div>
                    <p className="px-2 pt-2 pb-1 text-xs font-semibold text-yellow-600 dark:text-yellow-500 uppercase tracking-wide">
                      Fleet
                    </p>
                    {fleetCategories.map(renderCategory)}
                  </div>
                  {uncategorized.length > 0 && (
                    <div>
                      {(heavyCategories.length > 0 || fieldCategories.length > 0 || fleetCategories.length > 0) && (
                        <p className="px-2 pt-2 pb-1 text-xs font-semibold text-yellow-600 dark:text-yellow-500 uppercase tracking-wide">
                          Other
                        </p>
                      )}
                      {uncategorized.map(renderCategory)}
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </>
      )}
    </div>
    </>
  );
}
