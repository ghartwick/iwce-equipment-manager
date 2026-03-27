import React, { useState, useEffect } from 'react';
import { X, Clock, QrCode, Download } from 'lucide-react';
import { QRCodeSVG, QRCodeCanvas } from 'qrcode.react';
import { Equipment, Category } from '../types';
import { EquipmentLog } from './EquipmentLog';
import { siteManagementService, Site } from '../services/siteManagementService';
import { userManagementService, AppUser } from '../services/userManagementService';
import { getCategories } from '../services/firebaseService';

interface ProductFormProps {
  product?: Equipment | null;
  onSubmit: (product: Omit<Equipment, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onCancel: () => void;
  onDelete?: () => void;
  userRole?: 'admin' | 'supervisor' | 'field';
  categories?: Category[];
  allowFullEdit?: boolean;
}

export function ProductForm({ product, onSubmit, onCancel, onDelete, userRole, categories: categoriesProp, allowFullEdit = false }: ProductFormProps) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    employee: '',
    site: '',
    category: '',
    serialNumber: '',
    equipmentType: 'field' as 'heavy' | 'field',
    repair: false,
    repairDescription: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [showLog, setShowLog] = useState(false);
  const [showQR, setShowQR] = useState(false);

  const getEquipmentUrl = (id: string) =>
    `${window.location.origin}/inventory/equipment/${id}`;

  const handleDownloadQR = () => {
    if (!product?.id) return;
    const canvas = document.getElementById(`qr-form-${product.id}`) as HTMLCanvasElement;
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = url;
    link.download = `${product.name.replace(/\s+/g, '-')}-qr.png`;
    link.click();
  };
  const [sites, setSites] = useState<Site[]>([]);
  const [showCustomSite, setShowCustomSite] = useState(false);
  const [customSite, setCustomSite] = useState('');
  const [users, setUsers] = useState<AppUser[]>([]);
  const [fetchedCategories, setFetchedCategories] = useState<Category[]>([]);
  const categories = categoriesProp && categoriesProp.length > 0 ? categoriesProp : fetchedCategories;

  const isEditing = !!product;
  const formTitle = isEditing ? (allowFullEdit ? 'Edit Equipment' : 'Change Location') : 'Add Equipment';

  // Sort sites alphabetically
  const sortedSites = [...sites].sort((a, b) => a.name.localeCompare(b.name));

  // Fetch sites and users on component mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [activeSites, allUsers, loadedCategories] = await Promise.all([
          siteManagementService.getActiveSites(),
          userManagementService.getAllUsers(),
          getCategories()
        ]);
        setSites(activeSites);
        const activeUsers = allUsers
          .filter(user => user.isActive && (user.role === 'field' || user.role === 'admin' || user.role === 'supervisor'))
          .sort((a, b) => a.name.localeCompare(b.name));
        setUsers(activeUsers);
        const sortedCats = [...loadedCategories].sort((a, b) => {
          const numA = parseFloat(a.name);
          const numB = parseFloat(b.name);
          if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
          return a.name.localeCompare(b.name);
        });
        setFetchedCategories(sortedCats);
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (product) {
      setFormData({
        name: product.name || '',
        description: product.description || '',
        employee: product.employee || '',
        site: product.site || '',
        category: product.category || '',
        serialNumber: product.serialNumber || '',
        equipmentType: product.equipmentType || 'field',
        repair: product.repair || false,
        repairDescription: product.repairDescription || '',
      });
      
      // Check if the site is a custom site (not in the sites list)
      if (product.site && !sites.some(site => site.name === product.site)) {
        setShowCustomSite(true);
        setCustomSite(product.site);
      } else {
        // Reset custom site state if editing a product with a database site
        setShowCustomSite(false);
        setCustomSite('');
      }
    }
  }, [product, sites]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isSubmitting) return;
    
    // Validate custom site if "Other" is selected
    if (showCustomSite && !customSite.trim()) {
      alert('Please enter a custom site name');
      return;
    }
    
    setIsSubmitting(true);
    
    // Only set repair flag based on employee if it's Out For Repair or Broken
    // Otherwise, respect the manual repair toggle
    let repairFlag = formData.repair;
    if (formData.employee === 'Out For Repair' || formData.employee === 'Broken') {
      repairFlag = true;
    } else if (formData.employee && formData.employee !== 'Office' && formData.employee !== 'Missing') {
      // If employee is assigned but not a special status, repair should be false
      repairFlag = false;
    }
    
    const submitData = {
      ...formData,
      repair: repairFlag
    };
    
    console.log('Submitting form data:', submitData);
    
    try {
      await onSubmit(submitData);
      // Reset submitting state after successful submission
      setIsSubmitting(false);
    } catch (error) {
      console.error('Error in form submission:', error);
      alert('Error submitting form: ' + (error as Error).message);
      setIsSubmitting(false);
    }
  };

  const handleSiteChange = (value: string) => {
    if (value === 'OTHER') {
      setShowCustomSite(true);
      setFormData(prev => ({ ...prev, site: '' }));
    } else {
      setShowCustomSite(false);
      setCustomSite('');
      setFormData(prev => ({ ...prev, site: value }));
    }
  };

  const handleCustomSiteChange = (value: string) => {
    setCustomSite(value);
    setFormData(prev => ({ ...prev, site: value }));
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // If repair is being turned off, clear employee if it's Out For Repair or Broken
    if (field === 'repair' && !value) {
      setFormData(prev => {
        if (prev.employee === 'Out For Repair' || prev.employee === 'Broken') {
          return { ...prev, repair: false, employee: '', repairDescription: '' };
        }
        return { ...prev, repair: false };
      });
    }
  };

  return (
    <div className="bg-[#fffff0] dark:bg-black border border-yellow-600 rounded-lg shadow-lg p-3 sm:p-4">
      <div className="flex items-center justify-between mb-3 sm:mb-4">
        <h2 className="text-base sm:text-lg font-semibold text-yellow-600 dark:text-yellow-400">
          {formTitle}
        </h2>
        <div className="flex items-center space-x-2">
          {isEditing && (
            <>
              <button
                onClick={() => setShowQR(!showQR)}
                className="p-1 text-yellow-600 dark:text-yellow-400 hover:text-yellow-500 dark:hover:text-yellow-300"
                title="Show QR code"
              >
                <QrCode className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>
              <button
                onClick={() => setShowLog(!showLog)}
                className="p-1 text-yellow-600 dark:text-yellow-400 hover:text-yellow-500 dark:hover:text-yellow-300"
                title="View edit history"
              >
                <Clock className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>
            </>
          )}
          <button
            onClick={onCancel}
            className="p-1 text-yellow-600 dark:text-yellow-400 hover:text-yellow-500 dark:hover:text-yellow-300"
          >
            <X className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
          <div>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              disabled={isEditing && !allowFullEdit}
              className={`w-full px-2 py-1.5 sm:px-3 sm:py-2 border rounded-md outline-none text-xs sm:text-sm ${
                isEditing && !allowFullEdit
                  ? 'border-gray-400 bg-gray-100 dark:bg-gray-900 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                  : 'border-yellow-600 bg-[#fffff0] dark:bg-black text-gray-900 dark:text-yellow-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500'
              }`}
              placeholder="Equipment Name"
            />
          </div>

          {(!isEditing || product?.equipmentType !== 'field') && (
            <div>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                disabled={isEditing && !allowFullEdit}
                className={`w-full px-2 py-1.5 sm:px-3 sm:py-2 border rounded-md outline-none text-xs sm:text-sm ${
                  isEditing && !allowFullEdit
                    ? 'border-gray-400 bg-gray-100 dark:bg-gray-900 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                    : 'border-yellow-600 bg-[#fffff0] dark:bg-black text-gray-900 dark:text-yellow-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500'
                }`}
                placeholder="Description"
              />
            </div>
          )}

          {(!isEditing || product?.equipmentType !== 'heavy') && (
            <div>
              <input
                type="text"
                value={formData.serialNumber}
                onChange={(e) => handleInputChange('serialNumber', e.target.value)}
                disabled={isEditing && !allowFullEdit}
                className={`w-full px-2 py-1.5 sm:px-3 sm:py-2 border rounded-md outline-none text-xs sm:text-sm ${
                  isEditing && !allowFullEdit
                    ? 'border-gray-400 bg-gray-100 dark:bg-gray-900 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                    : 'border-yellow-600 bg-[#fffff0] dark:bg-black text-gray-900 dark:text-yellow-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500'
                }`}
                placeholder="Serial Number"
              />
            </div>
          )}

          {!isEditing && (
            <div>
              <select
                required
                value={formData.category}
                onChange={(e) => handleInputChange('category', e.target.value)}
                className="w-full px-2 py-1.5 sm:px-3 sm:py-2 border border-yellow-600 rounded-md bg-[#fffff0] dark:bg-black text-gray-900 dark:text-yellow-100 focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 outline-none text-xs sm:text-sm"
              >
                <option value="">Category</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {(!isEditing || product?.equipmentType !== 'heavy') && (
            <div>
              <select
                value={formData.employee}
                onChange={(e) => handleInputChange('employee', e.target.value)}
                className="w-full px-2 py-1.5 sm:px-3 sm:py-2 border border-yellow-600 rounded-md bg-[#fffff0] dark:bg-black text-gray-900 dark:text-yellow-100 focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 outline-none text-xs sm:text-sm"
              >
                <option value="">Employee</option>
                <option value="Office">Office</option>
                <option value="Broken">Broken</option>
                <option value="Out For Repair">Out For Repair</option>
                <option value="Missing">Missing</option>
                {users.map((user) => (
                  <option key={user.id} value={user.name}>
                    {user.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {isEditing && product?.equipmentType === 'heavy' && (
            <div>
              <select
                value={showCustomSite ? 'OTHER' : formData.site}
                onChange={(e) => handleSiteChange(e.target.value)}
                className="w-full px-2 py-1.5 sm:px-3 sm:py-2 border border-yellow-600 rounded-md bg-[#fffff0] dark:bg-black text-gray-900 dark:text-yellow-100 focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 outline-none text-xs sm:text-sm"
              >
                <option value="">Site</option>
                {sortedSites.map((site) => (
                  <option key={site.id} value={site.name}>
                    {site.name}
                  </option>
                ))}
                <option value="OTHER">Other (type custom site)</option>
              </select>
              {showCustomSite && (
                <input
                  type="text"
                  value={customSite}
                  onChange={(e) => handleCustomSiteChange(e.target.value)}
                  placeholder="Enter custom site name"
                  className="w-full mt-2 px-2 py-1.5 sm:px-3 sm:py-2 border border-yellow-600 rounded-md bg-[#fffff0] dark:bg-black text-gray-900 dark:text-yellow-100 placeholder-yellow-500 dark:placeholder-yellow-600 focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 outline-none text-xs sm:text-sm"
                  autoFocus
                />
              )}
            </div>
          )}

          {allowFullEdit && (
            <div>
              <div className="flex items-center space-x-3">
                <span className="text-xs sm:text-sm font-medium text-yellow-600 dark:text-yellow-300">
                  Alert
                </span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.repair}
                    onChange={(e) => handleInputChange('repair', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 dark:bg-black border border-yellow-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-yellow-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[&quot;&quot;] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-yellow-500"></div>
                  <span className="ml-3 text-xs sm:text-sm font-medium text-yellow-600 dark:text-yellow-300">
                    {formData.repair ? 'Yes' : 'No'}
                  </span>
                </label>
              </div>
            </div>
          )}
        </div>


        {allowFullEdit && formData.repair && (
          <div className="mt-2 sm:mt-3">
            <textarea
              rows={3}
              value={formData.repairDescription}
              onChange={(e) => handleInputChange('repairDescription', e.target.value)}
              placeholder="Describe the alert or issue details..."
              className="w-full px-2 py-1.5 sm:px-3 sm:py-2 border border-yellow-600 rounded-md bg-[#fffff0] dark:bg-black text-gray-900 dark:text-yellow-100 placeholder-yellow-500 dark:placeholder-yellow-600 focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 outline-none text-xs sm:text-sm"
            />
          </div>
        )}

        <div className="flex justify-end space-x-2 pt-4">
        {onDelete && product && userRole === 'admin' && (
          <button
            type="button"
            onClick={() => {
              if (window.confirm(`Are you sure you want to delete "${product.name}"? This action cannot be undone.`)) {
                onDelete();
              }
            }}
            className="px-4 py-3 border border-red-600 rounded-md text-red-600 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900 text-sm font-medium"
          >
            Delete
          </button>
        )}
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-3 border border-yellow-600 rounded-md text-yellow-700 dark:text-yellow-300 hover:bg-yellow-100 dark:hover:bg-yellow-900 text-sm font-medium"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-4 py-3 bg-yellow-600 text-black rounded-md hover:bg-yellow-500 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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

      {/* QR Code Modal */}
      {showQR && product?.id && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50" onClick={() => setShowQR(false)}>
          <div className="bg-[#fffff0] dark:bg-black border border-yellow-600 rounded-lg shadow-xl p-6 w-80" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-yellow-700 dark:text-yellow-300">{product.name}</h3>
              <button onClick={() => setShowQR(false)} className="text-yellow-600 dark:text-yellow-400 hover:text-yellow-500">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex justify-center mb-4">
              <QRCodeSVG value={getEquipmentUrl(product.id)} size={200} level="M" includeMargin />
            </div>
            <div className="hidden">
              <QRCodeCanvas id={`qr-form-${product.id}`} value={getEquipmentUrl(product.id)} size={400} level="M" includeMargin />
            </div>
            <p className="text-xs text-yellow-600 dark:text-yellow-500 text-center mb-4 break-all">{getEquipmentUrl(product.id)}</p>
            <button
              onClick={handleDownloadQR}
              className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-yellow-600 text-black rounded-lg hover:bg-yellow-500 transition-colors font-medium"
            >
              <Download className="h-4 w-4" />
              <span>Download QR Code</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
