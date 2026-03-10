import React, { useState, useEffect } from 'react';
import { X, Clock } from 'lucide-react';
import { Equipment, Category } from '../types';
import { EquipmentLog } from './EquipmentLog';

interface ProductFormProps {
  categories: Category[];
  product?: Equipment | null;
  onSubmit: (product: Omit<Equipment, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onCancel: () => void;
  onDelete?: () => void;
  userRole?: 'admin' | 'supervisor' | 'field';
}

export function ProductForm({ categories, product, onSubmit, onCancel, onDelete, userRole }: ProductFormProps) {
  const [formData, setFormData] = useState({
    name: '',
    employee: '',
    site: '',
    category: '',
    serialNumber: '',
    repair: false,
    repairDescription: '',
  });

  const [showLog, setShowLog] = useState(false);

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

  const isEditing = !!product;
  const formTitle = isEditing ? 'Edit Equipment' : 'Add Equipment';
  const isAdmin = userRole === 'admin';
  const canEditRestrictedFields = isAdmin || !isEditing; // Admins can edit, anyone can add

  useEffect(() => {
    if (product) {
      setFormData({
        name: product.name,
        employee: product.employee,
        site: product.site,
        category: product.category,
        serialNumber: product.serialNumber,
        repair: product.repair,
        repairDescription: product.repairDescription,
      });
    }
  }, [product]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      onSubmit(formData);
    } catch (error) {
      console.error('Error in form submission:', error);
      alert('Error submitting form: ' + (error as Error).message);
    }
  };

  const handleInputChange = (field: string, value: string | number | boolean) => {
    if (field === 'repair' && value === false) {
      setFormData(prev => ({ 
        ...prev, 
        [field]: value,
        repairDescription: '' 
      }));
    } else {
      setFormData(prev => ({ ...prev, [field]: value }));
    }
    
    console.log('FormData after change should be:', field === 'repair' ? value : (formData as any)[field]);
  };

  return (
    <div className="bg-black border border-yellow-600 rounded-lg shadow-lg p-4 sm:p-6">
      <div className="flex items-center justify-between mb-3 sm:mb-4">
        <h2 className="text-base sm:text-lg font-semibold text-yellow-400">
          {formTitle}
        </h2>
        <div className="flex items-center space-x-2">
          {isEditing && (
            <button
              onClick={() => setShowLog(!showLog)}
              className="p-1 text-yellow-400 hover:text-yellow-300"
              title="View edit history"
            >
              <Clock className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>
          )}
          <button
            onClick={onCancel}
            className="p-1 text-yellow-400 hover:text-yellow-300"
          >
            <X className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
          <div>
            <label className="block text-xs sm:text-sm font-medium text-yellow-300 mb-1">
              Equipment Name *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              disabled={isEditing && !canEditRestrictedFields}
              className={`w-full px-2 py-1.5 sm:px-3 sm:py-2 border rounded-md outline-none text-xs sm:text-sm ${
                isEditing && !canEditRestrictedFields
                  ? 'border-gray-600 bg-gray-900 text-gray-400 cursor-not-allowed'
                  : 'border-yellow-600 bg-black text-yellow-100 placeholder-yellow-600 focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500'
              }`}
              placeholder="Enter equipment name"
            />
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-medium text-yellow-300 mb-1">
              Serial Number *
            </label>
            <input
              type="text"
              required
              value={formData.serialNumber}
              onChange={(e) => handleInputChange('serialNumber', e.target.value)}
              disabled={isEditing && !canEditRestrictedFields}
              className={`w-full px-2 py-1.5 sm:px-3 sm:py-2 border rounded-md outline-none text-xs sm:text-sm ${
                isEditing && !canEditRestrictedFields
                  ? 'border-gray-600 bg-gray-900 text-gray-400 cursor-not-allowed'
                  : 'border-yellow-600 bg-black text-yellow-100 placeholder-yellow-600 focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500'
              }`}
            />
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-medium text-yellow-300 mb-1">
              Category *
            </label>
            <select
              required
              value={formData.category}
              onChange={(e) => handleInputChange('category', e.target.value)}
              disabled={isEditing && !canEditRestrictedFields}
              className={`w-full px-2 py-1.5 sm:px-3 sm:py-2 border rounded-md outline-none text-xs sm:text-sm ${
                isEditing && !canEditRestrictedFields
                  ? 'border-gray-600 bg-gray-900 text-gray-400 cursor-not-allowed'
                  : 'border-yellow-600 bg-black text-yellow-100 focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500'
              }`}
            >
              <option value="">Select a category</option>
              {sortedCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-medium text-yellow-300 mb-1">
              Employee
            </label>
            <input
              type="text"
              value={formData.employee}
              onChange={(e) => handleInputChange('employee', e.target.value)}
              className="w-full px-2 py-1.5 sm:px-3 sm:py-2 border border-yellow-600 rounded-md bg-black text-yellow-100 placeholder-yellow-600 focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 outline-none text-xs sm:text-sm"
            />
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-medium text-yellow-300 mb-1">
              Site
            </label>
            <input
              type="text"
              value={formData.site}
              onChange={(e) => handleInputChange('site', e.target.value)}
              className="w-full px-2 py-1.5 sm:px-3 sm:py-2 border border-yellow-600 rounded-md bg-black text-yellow-100 placeholder-yellow-600 focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 outline-none text-xs sm:text-sm"
            />
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-medium text-yellow-300 mb-1">
              Repair
            </label>
            <div className="flex items-center space-x-3">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.repair}
                  onChange={(e) => handleInputChange('repair', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-black border border-yellow-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-yellow-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-yellow-500"></div>
                <span className="ml-3 text-xs sm:text-sm font-medium text-yellow-300">
                  {formData.repair ? 'Yes' : 'No'}
                </span>
              </label>
            </div>
          </div>

        {formData.repair && (
          <div className="mt-2 sm:mt-3">
            <label className="block text-xs sm:text-sm font-medium text-yellow-300 mb-1">
              Repair Description
            </label>
            <textarea
              rows={3}
              value={formData.repairDescription}
              onChange={(e) => handleInputChange('repairDescription', e.target.value)}
              placeholder="Describe the repair needed or repair details..."
              className="w-full px-2 py-1.5 sm:px-3 sm:py-2 border border-yellow-600 rounded-md bg-black text-yellow-100 placeholder-yellow-600 focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 outline-none text-xs sm:text-sm"
            />
          </div>
        )}
      </div>

      <div className="flex justify-end space-x-2 pt-4">
        {onDelete && product && userRole === 'admin' && (
          <button
            type="button"
            onClick={() => {
              if (window.confirm(`Are you sure you want to delete "${product.name}"? This action cannot be undone.`)) {
                onDelete();
              }
            }}
            className="px-4 py-3 border border-red-600 rounded-md text-red-300 hover:bg-red-900 text-sm font-medium"
          >
            Delete
          </button>
        )}
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-3 border border-yellow-600 rounded-md text-yellow-300 hover:bg-yellow-900 text-sm font-medium"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-3 bg-yellow-500 text-black rounded-md hover:bg-yellow-600 text-sm font-medium transition-colors"
        >
          {isEditing ? 'Update' : 'Add'} Equipment
        </button>
      </div>
      </form>
      
      {/* Equipment Log - Shows when log button is clicked */}
      {showLog && isEditing && (
        <div className="mt-4">
          <EquipmentLog
            equipment={product}
            onClose={() => setShowLog(false)}
          />
        </div>
      )}
    </div>
  );
}
