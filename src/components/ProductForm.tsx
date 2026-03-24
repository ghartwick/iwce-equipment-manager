import React, { useState, useEffect } from 'react';
import { X, Clock, QrCode, Download } from 'lucide-react';
import { QRCodeSVG, QRCodeCanvas } from 'qrcode.react';
import { Equipment, Category } from '../types';
import { EquipmentLog } from './EquipmentLog';
import { siteManagementService, Site } from '../services/siteManagementService';

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

  // Sort sites alphabetically
  const sortedSites = [...sites].sort((a, b) => a.name.localeCompare(b.name));

  // Fetch sites on component mount
  useEffect(() => {
    const fetchSites = async () => {
      try {
        const activeSites = await siteManagementService.getActiveSites();
        setSites(activeSites);
      } catch (error) {
        console.error('Error fetching sites:', error);
      }
    };
    fetchSites();
  }, []);

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate custom site if "Other" is selected
    if (showCustomSite && !customSite.trim()) {
      alert('Please enter a custom site name');
      return;
    }
    
    try {
      onSubmit(formData);
    } catch (error) {
      console.error('Error in form submission:', error);
      alert('Error submitting form: ' + (error as Error).message);
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
    <div className="bg-[#fffff0] dark:bg-black border border-yellow-600 rounded-lg shadow-lg p-4 sm:p-6">
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
              disabled={isEditing && !canEditRestrictedFields}
              className={`w-full px-2 py-1.5 sm:px-3 sm:py-2 border rounded-md outline-none text-xs sm:text-sm ${
                isEditing && !canEditRestrictedFields
                  ? 'border-gray-400 bg-gray-100 dark:bg-gray-900 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                  : 'border-yellow-600 bg-[#fffff0] dark:bg-black text-gray-900 dark:text-yellow-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500'
              }`}
              placeholder="Equipment Name"
            />
          </div>

          <div>
            <input
              type="text"
              value={formData.serialNumber}
              onChange={(e) => handleInputChange('serialNumber', e.target.value)}
              disabled={isEditing && !canEditRestrictedFields}
              className={`w-full px-2 py-1.5 sm:px-3 sm:py-2 border rounded-md outline-none text-xs sm:text-sm ${
                isEditing && !canEditRestrictedFields
                  ? 'border-gray-400 bg-gray-100 dark:bg-gray-900 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                  : 'border-yellow-600 bg-[#fffff0] dark:bg-black text-gray-900 dark:text-yellow-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500'
              }`}
              placeholder="Serial Number"
            />
          </div>

          <div>
            <select
              required
              value={formData.category}
              onChange={(e) => handleInputChange('category', e.target.value)}
              disabled={isEditing && !canEditRestrictedFields}
              className={`w-full px-2 py-1.5 sm:px-3 sm:py-2 border rounded-md outline-none text-xs sm:text-sm ${
                isEditing && !canEditRestrictedFields
                  ? 'border-gray-400 bg-gray-100 dark:bg-gray-900 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                  : 'border-yellow-600 bg-[#fffff0] dark:bg-black text-gray-900 dark:text-yellow-100 focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500'
              }`}
            >
              <option value="">Category</option>
              {sortedCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <input
              type="text"
              value={formData.employee}
              onChange={(e) => handleInputChange('employee', e.target.value)}
              placeholder="Employee"
              className="w-full px-2 py-1.5 sm:px-3 sm:py-2 border border-yellow-600 rounded-md bg-[#fffff0] dark:bg-black text-gray-900 dark:text-yellow-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 outline-none text-xs sm:text-sm"
            />
          </div>

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

          <div>
            <div className="flex items-center space-x-3">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.repair}
                  onChange={(e) => handleInputChange('repair', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 dark:bg-black border border-yellow-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-yellow-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-yellow-500"></div>
                <span className="ml-3 text-xs sm:text-sm font-medium text-yellow-600 dark:text-yellow-300">
                  {formData.repair ? 'Yes' : 'No'}
                </span>
              </label>
            </div>
          </div>

        {formData.repair && (
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
