import React, { useState, useEffect } from 'react';
import { X, Clock, QrCode, Download, Plus, ChevronDown, ChevronUp } from 'lucide-react';
import { QRCodeSVG, QRCodeCanvas } from 'qrcode.react';
import { Equipment, Category, EquipmentMaintenance } from '../types';
import { EquipmentLog } from './EquipmentLog';
import { MaintenanceForm } from './MaintenanceForm';
import { siteManagementService, Site } from '../services/siteManagementService';
import { userManagementService, AppUser } from '../services/userManagementService';
import { getCategories } from '../services/firebaseService';
import { maintenanceHistoryFirebaseService, MaintenanceReport } from '../services/maintenanceHistoryFirebaseService';
import { maintenanceAttachmentService } from '../services/maintenanceAttachmentService';
import { useAuth } from '../hooks/useAuth';

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
  const formRef = React.useRef<HTMLFormElement>(null);
  const { user } = useAuth();
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
    locationNotes: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [showLog, setShowLog] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [showMaintenanceForm, setShowMaintenanceForm] = useState(false);
  const [maintenanceReports, setMaintenanceReports] = useState<MaintenanceReport[]>([]);
  const [expandedReport, setExpandedReport] = useState<string | null>(null);
  const [maintenanceAttachments, setMaintenanceAttachments] = useState<Record<string, any[]>>({});
  const [maintenanceCollapsed, setMaintenanceCollapsed] = useState(true);
  const [visibleReportCount, setVisibleReportCount] = useState(10);

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
        locationNotes: '', // Always start with empty notes for new entry
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

  // Fetch maintenance reports when product changes
  useEffect(() => {
    const fetchMaintenanceReports = async () => {
      if (product?.equipmentType === 'heavy') {
        try {
          const reports = await maintenanceHistoryFirebaseService.getEquipmentMaintenanceHistory(product.id);
          setMaintenanceReports(reports);
          setVisibleReportCount(10);
        } catch (error) {
          console.error('Error fetching maintenance reports:', error);
        }
      }
    };
    fetchMaintenanceReports();
  }, [product]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isSubmitting) return;
    
    // Immediately set submitting state to prevent double clicks
    setIsSubmitting(true);
    
    // Validate custom site if "Other" is selected
    if (showCustomSite && !customSite.trim()) {
      alert('Please enter a custom site name');
      setIsSubmitting(false); // Reset state on validation error
      return;
    }
    
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
      repair: repairFlag,
      isActive: true,
      showInInventory: true,
      showInTimecard: true
    };
    
        
    try {
      await onSubmit(submitData);
      // Reset form after successful submission
      formRef.current?.reset();
      // Reset submitting state to allow proper component unmounting
      setIsSubmitting(false);
    } catch (error) {
      console.error('Error in form submission:', error);
      alert('Error submitting form: ' + (error as Error).message);
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    if (isSubmitting) return;
    onCancel();
  };

  const handleMaintenanceSubmit = async (maintenance: EquipmentMaintenance, files?: File[]) => {
    if (!product || !user) return;
    
    try {
      const reportId = await maintenanceHistoryFirebaseService.addMaintenanceReport(
        product.id,
        product.name,
        maintenance,
        { username: user.username, role: user.role }
      );
      
      // Upload files if provided
      if (files && files.length > 0) {
        for (const file of files) {
          await maintenanceAttachmentService.uploadAttachment({
            maintenanceReportId: reportId,
            equipmentId: product.id,
            equipmentName: product.name,
            file,
            uploadedBy: user.id
          });
        }
      }
      
      setShowMaintenanceForm(false);
      // Refresh maintenance reports
      const reports = await maintenanceHistoryFirebaseService.getEquipmentMaintenanceHistory(product.id);
      setMaintenanceReports(reports);
      setVisibleReportCount(10);
    } catch (error) {
      console.error('Error submitting maintenance report:', error);
      throw error;
    }
  };

  const handleMaintenanceReportExpand = async (reportId: string | null) => {
    const newExpanded = expandedReport === reportId ? null : reportId;
    setExpandedReport(newExpanded);
    
    if (newExpanded && reportId) {
      try {
        const attachments = await maintenanceAttachmentService.getAttachmentsForReport(reportId);
        setMaintenanceAttachments(prev => ({ ...prev, [reportId]: attachments }));
      } catch (error) {
        console.error('Error fetching maintenance attachments:', error);
      }
    }
  };

  const handleDeleteMaintenanceReport = async (reportId: string) => {
    if (!confirm('Are you sure you want to delete this maintenance report?')) return;
    
    try {
      await maintenanceHistoryFirebaseService.deleteMaintenanceReport(reportId);
      // Refresh maintenance reports
      if (product?.equipmentType === 'heavy') {
        const reports = await maintenanceHistoryFirebaseService.getEquipmentMaintenanceHistory(product.id);
        setMaintenanceReports(reports);
        setVisibleReportCount(10);
      }
    } catch (error) {
      console.error('Error deleting maintenance report:', error);
      alert('Error deleting maintenance report: ' + (error as Error).message);
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
    <div className="bg-yellow-200 dark:bg-black border border-yellow-600 rounded-lg shadow-lg p-3 sm:p-4">
      <div className="flex items-center justify-between mb-3 sm:mb-4">
        <h2 className="text-base sm:text-lg font-semibold text-yellow-600 dark:text-yellow-400">
          {formTitle}
        </h2>
        <div className="flex items-center space-x-2">
          {isEditing && (
            <>
              {allowFullEdit && (
                <button
                  onClick={() => setShowQR(!showQR)}
                  className="p-1 text-yellow-600 dark:text-yellow-400 hover:text-yellow-500 dark:hover:text-yellow-300"
                  title="Show QR code"
                >
                  <QrCode className="h-4 w-4 sm:h-5 sm:w-5" />
                </button>
              )}
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
            onClick={handleCancel}
            className="p-1 text-yellow-600 dark:text-yellow-400 hover:text-yellow-500 dark:hover:text-yellow-300"
          >
            <X className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>
        </div>
      </div>

      <form ref={formRef} onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
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
                  : 'border-yellow-600 bg-yellow-200 dark:bg-black text-gray-900 dark:text-yellow-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500'
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
                    : 'border-yellow-600 bg-yellow-200 dark:bg-black text-gray-900 dark:text-yellow-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500'
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
                    : 'border-yellow-600 bg-yellow-200 dark:bg-black text-gray-900 dark:text-yellow-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500'
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
                className="w-full px-2 py-1.5 sm:px-3 sm:py-2 border border-yellow-600 rounded-md bg-yellow-200 dark:bg-black text-gray-900 dark:text-yellow-100 focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 outline-none text-xs sm:text-sm"
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
                className="w-full px-2 py-1.5 sm:px-3 sm:py-2 border border-yellow-600 rounded-md bg-yellow-200 dark:bg-black text-gray-900 dark:text-yellow-100 focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 outline-none text-xs sm:text-sm"
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
                className="w-full px-2 py-1.5 sm:px-3 sm:py-2 border border-yellow-600 rounded-md bg-yellow-200 dark:bg-black text-gray-900 dark:text-yellow-100 focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 outline-none text-xs sm:text-sm"
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
                  className="w-full mt-2 px-2 py-1.5 sm:px-3 sm:py-2 border border-yellow-600 rounded-md bg-yellow-200 dark:bg-black text-gray-900 dark:text-yellow-100 placeholder-yellow-500 dark:placeholder-yellow-600 focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 outline-none text-xs sm:text-sm"
                  autoFocus
                />
              )}
            </div>
          )}

          {/* Maintenance Section - Only for heavy equipment when editing */}
          {isEditing && product?.equipmentType === 'heavy' && (
            <div className="md:col-span-2 mt-4 pt-4 border-t border-yellow-400 dark:border-yellow-600">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base sm:text-lg font-semibold text-yellow-600 dark:text-yellow-400">Maintenance</h3>
                <div className="flex items-center space-x-1">
                  {maintenanceReports.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setMaintenanceCollapsed(!maintenanceCollapsed)}
                      className="text-yellow-600 dark:text-yellow-400 hover:text-yellow-500 dark:hover:text-yellow-300 p-1"
                      title={maintenanceCollapsed ? "Expand" : "Collapse"}
                    >
                      {maintenanceCollapsed ? <ChevronDown className="h-5 w-5" /> : <ChevronUp className="h-5 w-5" />}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowMaintenanceForm(true)}
                    className="text-yellow-600 dark:text-yellow-400 hover:text-yellow-500 dark:hover:text-yellow-300 p-1"
                    title="Add Maintenance Report"
                  >
                    <Plus className="h-5 w-5" />
                  </button>
                </div>
              </div>
              
              {/* Maintenance Reports List */}
              {maintenanceReports.length > 0 && (
                <div className="space-y-2 mt-3">
                  {(maintenanceCollapsed ? [maintenanceReports[0]] : maintenanceReports.slice(0, visibleReportCount)).map((report) => (
                    <div key={report.id} className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-300 dark:border-yellow-700">
                      <button
                        type="button"
                        onClick={() => handleMaintenanceReportExpand(report.id)}
                        className="w-full px-3 py-2 flex items-center justify-between text-left"
                      >
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <span className="text-sm font-medium text-yellow-700 dark:text-yellow-300">
                              {new Date(report.createdAt).toLocaleDateString()}
                            </span>
                            <span className="text-xs text-yellow-600 dark:text-yellow-400">
                              by {report.createdBy}
                            </span>
                          </div>
                          <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                            {report.maintenance.notes && `Notes: ${report.maintenance.notes.substring(0, 50)}${report.maintenance.notes.length > 50 ? '...' : ''}`}
                          </div>
                          <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                            {report.maintenance.hours && `Hours: ${report.maintenance.hours}`}
                          </div>
                          <div className="text-xs text-red-600 dark:text-red-400 mt-1">
                            {[
                              report.maintenance.stepsHandRails,
                              report.maintenance.tiresTracks,
                              report.maintenance.bucket,
                              report.maintenance.cuttingEdgeTeeth,
                              report.maintenance.hoses,
                              report.maintenance.batteryCableBeltHosesFilterGuards,
                              report.maintenance.backupAlarm,
                              report.maintenance.fireExtinguisher,
                              report.maintenance.gauges,
                              report.maintenance.horn,
                              report.maintenance.spillKit,
                              report.maintenance.glass,
                              report.maintenance.mirror,
                              report.maintenance.rollOverProtection,
                              report.maintenance.seatBeltSeat,
                              report.maintenance.allFluidsLevel,
                            ].filter(val => val === 'Repair').length > 0 && (
                              <span>
                                Repairs: {[
                                  report.maintenance.stepsHandRails === 'Repair' && 'Steps/Hand Rails',
                                  report.maintenance.tiresTracks === 'Repair' && 'Tires/Tracks',
                                  report.maintenance.bucket === 'Repair' && 'Bucket',
                                  report.maintenance.cuttingEdgeTeeth === 'Repair' && 'Cutting Edge/Teeth',
                                  report.maintenance.hoses === 'Repair' && 'Hoses',
                                  report.maintenance.batteryCableBeltHosesFilterGuards === 'Repair' && 'Battery Cable/Belt/Hoses/Filter/Guards',
                                  report.maintenance.backupAlarm === 'Repair' && 'Backup Alarm',
                                  report.maintenance.fireExtinguisher === 'Repair' && 'Fire Extinguisher',
                                  report.maintenance.gauges === 'Repair' && 'Gauges',
                                  report.maintenance.horn === 'Repair' && 'Horn',
                                  report.maintenance.spillKit === 'Repair' && 'Spill Kit',
                                  report.maintenance.glass === 'Repair' && 'Glass',
                                  report.maintenance.mirror === 'Repair' && 'Mirror',
                                  report.maintenance.rollOverProtection === 'Repair' && 'Roll Over Protection',
                                  report.maintenance.seatBeltSeat === 'Repair' && 'Seat Belt/Seat',
                                  report.maintenance.allFluidsLevel === 'Repair' && 'All Fluids Level',
                                ].filter(Boolean).join(', ')}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          {userRole === 'admin' && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteMaintenanceReport(report.id);
                              }}
                              className="p-1 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
                              title="Delete Report"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          )}
                          {expandedReport === report.id ? (
                            <ChevronUp className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                          )}
                        </div>
                      </button>
                      
                      {expandedReport === report.id && (
                        <div className="px-3 pb-3 pt-0 border-t border-yellow-200 dark:border-yellow-800">
                          <div className="grid grid-cols-2 gap-2 mt-2 text-xs text-gray-700 dark:text-gray-300">
                            <div><strong>Hours:</strong> {report.maintenance.hours || 'N/A'}</div>
                            <div><strong>Steps/Hand Rails:</strong> {report.maintenance.stepsHandRails || 'N/A'}</div>
                            <div><strong>Tires/Tracks:</strong> {report.maintenance.tiresTracks || 'N/A'}</div>
                            <div><strong>Bucket:</strong> {report.maintenance.bucket || 'N/A'}</div>
                            <div><strong>Cutting Edge/Teeth:</strong> {report.maintenance.cuttingEdgeTeeth || 'N/A'}</div>
                            <div><strong>Hoses:</strong> {report.maintenance.hoses || 'N/A'}</div>
                            <div><strong>Backup Alarm:</strong> {report.maintenance.backupAlarm || 'N/A'}</div>
                            <div><strong>Fire Extinguisher:</strong> {report.maintenance.fireExtinguisher || 'N/A'}</div>
                            <div><strong>Gauges:</strong> {report.maintenance.gauges || 'N/A'}</div>
                            <div><strong>Horn:</strong> {report.maintenance.horn || 'N/A'}</div>
                            <div><strong>Spill Kit:</strong> {report.maintenance.spillKit || 'N/A'}</div>
                            <div><strong>Glass:</strong> {report.maintenance.glass || 'N/A'}</div>
                            <div><strong>Mirror:</strong> {report.maintenance.mirror || 'N/A'}</div>
                            <div><strong>Seat Belt/Seat:</strong> {report.maintenance.seatBeltSeat || 'N/A'}</div>
                            <div><strong>All Fluids Level:</strong> {report.maintenance.allFluidsLevel || 'N/A'}</div>
                            {report.maintenance.lastServicedDate && (
                              <div><strong>Last Serviced:</strong> {report.maintenance.lastServicedDate}</div>
                            )}
                            {report.maintenance.lastServiceHours && (
                              <div><strong>Last Service Hours:</strong> {report.maintenance.lastServiceHours}</div>
                            )}
                          </div>
                          {report.maintenance.notes && (
                            <div className="mt-3 pt-3 border-t border-yellow-200 dark:border-yellow-800">
                              <div className="text-xs text-gray-700 dark:text-gray-300">
                                <strong>Notes:</strong> {report.maintenance.notes}
                              </div>
                            </div>
                          )}
                          {maintenanceAttachments[report.id!] && maintenanceAttachments[report.id!].length > 0 && (
                            <div className="mt-3 pt-3 border-t border-yellow-200 dark:border-yellow-800">
                              <div className="text-xs text-gray-700 dark:text-gray-300 mb-2">
                                <strong>Attachments:</strong>
                              </div>
                              <div className="space-y-1">
                                {maintenanceAttachments[report.id!].map((attachment, index) => (
                                  <a
                                    key={index}
                                    href={attachment.fileUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block text-xs text-yellow-600 dark:text-yellow-400 hover:underline"
                                  >
                                    {attachment.fileName}
                                  </a>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              
              {!maintenanceCollapsed && maintenanceReports.length > visibleReportCount && (
                <button
                  type="button"
                  onClick={() => setVisibleReportCount(prev => prev + 10)}
                  className="w-full mt-2 px-3 py-2 text-xs text-yellow-600 dark:text-yellow-400 hover:text-yellow-500 dark:hover:text-yellow-300 border border-yellow-600 rounded hover:bg-yellow-100 dark:hover:bg-yellow-900 transition-colors flex items-center justify-center space-x-1"
                >
                  <span>Show More ({maintenanceReports.length - visibleReportCount} remaining)</span>
                  <ChevronDown className="h-3 w-3" />
                </button>
              )}
              
              {maintenanceReports.length === 0 && (
                <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-2">No maintenance reports yet.</p>
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
              className="w-full px-2 py-1.5 sm:px-3 sm:py-2 border border-yellow-600 rounded-md bg-yellow-200 dark:bg-black text-gray-900 dark:text-yellow-100 placeholder-yellow-500 dark:placeholder-yellow-600 focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 outline-none text-xs sm:text-sm"
            />
          </div>
        )}

        {isEditing && formData.equipmentType !== 'heavy' && (
          <div className="mt-2 sm:mt-3">
            <label className="block text-xs sm:text-sm font-medium text-yellow-600 dark:text-yellow-300 mb-1">
              Notes
            </label>
            <textarea
              rows={2}
              value={formData.locationNotes}
              onChange={(e) => handleInputChange('locationNotes', e.target.value)}
              placeholder="Make a note"
              className="w-full px-2 py-1.5 sm:px-3 sm:py-2 border border-yellow-600 rounded-md bg-yellow-200 dark:bg-black text-gray-900 dark:text-yellow-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 outline-none text-xs sm:text-sm"
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
          onClick={handleCancel}
          disabled={isSubmitting}
          className="px-4 py-3 border border-yellow-600 rounded-md text-yellow-700 dark:text-yellow-300 hover:bg-yellow-100 dark:hover:bg-yellow-900 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {allowFullEdit ? 'Cancel' : 'Close'}
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-4 py-3 bg-yellow-600 text-black rounded-md hover:bg-yellow-500 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isEditing ? 'Update' : 'Add Equipment'}
        </button>
        {isEditing && product?.equipmentType === 'heavy' && userRole === 'admin' && (
          <button
            type="button"
            onClick={() => window.location.href = `/inventory/equipment/${product.id}/shop`}
            className="px-4 py-3 bg-yellow-300 dark:bg-yellow-800 text-yellow-900 dark:text-yellow-100 rounded-md hover:bg-yellow-400 dark:hover:bg-yellow-700 text-sm font-medium transition-colors"
          >
            Shop
          </button>
        )}
        </div>
      </form>
      
      {/* Equipment Log - Shows when log button is clicked */}
      {showLog && isEditing && (
        <>
          <div className="border-t border-yellow-600 dark:border-yellow-400 mt-4 mb-4"></div>
          <div>
            <EquipmentLog
              equipment={product}
              onClose={() => setShowLog(false)}
            />
          </div>
        </>
      )}

      {/* QR Code Modal */}
      {showQR && product?.id && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50" onClick={() => setShowQR(false)}>
          <div className="bg-yellow-200 dark:bg-black border border-yellow-600 rounded-lg shadow-xl p-6 w-80" onClick={e => e.stopPropagation()}>
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

      {/* Maintenance Form Modal */}
      {showMaintenanceForm && product && (
        <MaintenanceForm
          equipmentId={product.id}
          equipmentName={product.name}
          onClose={() => setShowMaintenanceForm(false)}
          onSubmit={handleMaintenanceSubmit}
        />
      )}
    </div>
  );
}
