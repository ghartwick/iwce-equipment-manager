import { useState } from 'react';
import { Filter, Plus, Trash2, Edit2, ChevronDown, ChevronUp } from 'lucide-react';
import { Category } from '../types';

interface FilterPanelProps {
  categories: Category[];
  selectedCategory: string;
  onCategoryChange: (categoryId: string) => void;
  onAddCategory: (category: Omit<Category, 'id'>) => void;
  onDeleteCategory: (categoryId: string) => void;
  onEditCategory: (categoryId: string, category: Omit<Category, 'id'>) => void;
}

export function FilterPanel({ 
  categories, 
  selectedCategory, 
  onCategoryChange, 
  onAddCategory,
  onDeleteCategory,
  onEditCategory 
}: FilterPanelProps) {
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isCategoryFormCollapsed, setIsCategoryFormCollapsed] = useState(false);

  // Sort categories alphabetically and numerically
  const sortedCategories = [...categories].sort((a, b) => {
    const nameA = a.name.toLowerCase();
    const nameB = b.name.toLowerCase();
    
    // Try numeric comparison first
    const numA = parseFloat(nameA);
    const numB = parseFloat(nameB);
    
    if (!isNaN(numA) && !isNaN(numB)) {
      return numA - numB;
    }
    
    // Fall back to alphabetical comparison
    return nameA.localeCompare(nameB);
  });

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
    <div className="bg-black border border-yellow-600 rounded-lg shadow p-2 sm:p-4">
      <div className="flex items-center justify-between mb-3 sm:mb-4">
        <div className="flex items-center space-x-2">
          <Filter className="h-3 w-3 sm:h-4 sm:w-4 text-yellow-400" />
          <h3 className="text-xs sm:text-sm font-medium text-yellow-400">Categories</h3>
        </div>
        <div className="flex items-center space-x-1">
          <button
            onClick={() => setIsCategoryFormCollapsed(!isCategoryFormCollapsed)}
            className="p-1 text-yellow-400 hover:text-yellow-300"
            title={isCategoryFormCollapsed ? "Expand Category Form" : "Collapse Category Form"}
          >
            {isCategoryFormCollapsed ? (
              <ChevronDown className="h-3 w-3 sm:h-4 sm:w-4" />
            ) : (
              <ChevronUp className="h-3 w-3 sm:h-4 sm:w-4" />
            )}
          </button>
          <button
            onClick={() => setShowAddCategory(!showAddCategory)}
            className="p-1 text-yellow-400 hover:text-yellow-300"
            title="Add Category"
          >
            <Plus className="h-3 w-3 sm:h-4 sm:w-4" />
          </button>
        </div>
      </div>

      {!isCategoryFormCollapsed && (
        <>
          {showAddCategory && (
            <div className="mb-3 sm:mb-4 p-2 sm:p-3 bg-yellow-900 rounded-lg space-y-2 sm:space-y-3">
              <input
                type="text"
                placeholder="Category name"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                className="w-full px-2 py-1 sm:px-3 sm:py-2 border border-yellow-600 rounded-md bg-black text-yellow-100 placeholder-yellow-600 focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 outline-none text-xs sm:text-sm"
              />
              <div className="flex space-x-2">
                <button
                  onClick={handleAddCategory}
                  className="px-2 py-1 sm:px-3 sm:py-1 bg-yellow-500 text-black text-xs sm:text-sm rounded hover:bg-yellow-600"
                >
                  Add
                </button>
                <button
                  onClick={() => setShowAddCategory(false)}
                  className="px-2 py-1 sm:px-3 sm:py-1 bg-gray-300 text-gray-700 text-xs sm:text-sm rounded hover:bg-gray-400"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {editingCategoryId && (
            <div className="mb-3 sm:mb-4 p-2 sm:p-3 bg-yellow-900 rounded-lg space-y-2 sm:space-y-3">
              <h4 className="text-xs sm:text-sm font-medium text-yellow-200">Edit Category</h4>
              <input
                type="text"
                placeholder="Category name"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                className="w-full px-2 py-1 sm:px-3 sm:py-2 border border-yellow-600 rounded-md bg-black text-yellow-100 placeholder-yellow-600 focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 outline-none text-xs sm:text-sm"
              />
              <div className="flex space-x-2">
                <button
                  onClick={handleUpdateCategory}
                  className="px-2 py-1 sm:px-3 sm:py-1 bg-yellow-500 text-black text-xs sm:text-sm rounded hover:bg-yellow-600"
                >
                  Update
                </button>
                <button
                  onClick={handleCancelEdit}
                  className="px-2 py-1 sm:px-3 sm:py-1 bg-gray-300 text-gray-700 text-xs sm:text-sm rounded hover:bg-gray-400"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="space-y-1 sm:space-y-2">
            <button
              onClick={() => onCategoryChange('all')}
              className={`w-full text-left px-2 py-1 sm:px-3 sm:py-2 rounded-md transition-colors text-xs sm:text-sm ${
                selectedCategory === 'all'
                  ? 'bg-yellow-600 text-black'
                  : 'hover:bg-yellow-900 text-yellow-200'
              }`}
            >
              All Categories
            </button>
            {sortedCategories.map((category) => (
              <div
                key={category.id}
                className={`w-full px-2 py-1 sm:px-3 sm:py-2 rounded-md transition-colors flex items-center justify-between group text-xs sm:text-sm ${
                  selectedCategory === category.id
                    ? 'bg-yellow-600 text-black'
                    : 'hover:bg-yellow-900 text-yellow-200'
                }`}
              >
                <button
                  onClick={() => onCategoryChange(category.id)}
                  className="flex items-center space-x-2 flex-1 text-left"
                >
                  <span>{category.name}</span>
                </button>
                <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-all">
                  <button
                    onClick={() => handleEditCategory(category.id)}
                    className="p-1 text-yellow-500 hover:text-yellow-300"
                    title="Edit category"
                  >
                    <Edit2 className="h-2 w-2 sm:h-3 sm:w-3" />
                  </button>
                  <button
                    onClick={() => {
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
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
