import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, X, ChevronDown, ChevronUp, Settings } from 'lucide-react';
import { shopHistoryFirebaseService, ShopReport } from '../services/shopHistoryFirebaseService';
import { shopAttachmentService } from '../services/shopAttachmentService';
import { AddService } from '../components/ShopForm';
import { useAuth } from '../hooks/useAuth';
import { equipmentManagementService } from '../services/equipmentManagementService';
import { fleetManagementService } from '../services/fleetManagementService';
import { getCategories, updateCategory } from '../services/firebaseService';
import { equipmentHistoryFirebaseService } from '../services/equipmentHistoryFirebaseService';
import { equipmentServiceLogService } from '../services/equipmentServiceLogService';
import { EquipmentServiceHistory } from '../components/EquipmentServiceHistory';
import { EquipmentNote, Category } from '../types';

export function Service() {
  const { equipmentId } = useParams<{ equipmentId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [equipmentName, setEquipmentName] = useState<string>('');
  const [unitName, setUnitName] = useState<string>('');
  const [equipmentSite, setEquipmentSite] = useState<string>('');
  const [serviceInterval, setServiceInterval] = useState<number | undefined>(undefined);
  const [largeServiceInterval, setLargeServiceInterval] = useState<number | undefined>(undefined);
  const [serviceNotification, setServiceNotification] = useState<number | undefined>(undefined);
  const [notificationType, setNotificationType] = useState<'fleet' | 'heavy' | 'none'>('none');
  // Track values that have been saved to DB — used for lock/edit logic (NOT the live typed value)
  const [savedServiceInterval, setSavedServiceInterval] = useState<number | undefined>(undefined);
  const [savedLargeServiceInterval, setSavedLargeServiceInterval] = useState<number | undefined>(undefined);
  const [savedServiceNotification, setSavedServiceNotification] = useState<number | undefined>(undefined);
  const [editingLargeInterval, setEditingLargeInterval] = useState(false);
  const [shopReports, setShopReports] = useState<ShopReport[]>([]);
  const [shopAttachments, setShopAttachments] = useState<Record<string, any[]>>({});
  const [showShopForm, setShowShopForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [equipmentDataNotes, setEquipmentDataNotes] = useState<EquipmentNote[]>([]);
  const [reportsCollapsed, setReportsCollapsed] = useState(true);
  const [hoveredAttachment, setHoveredAttachment] = useState<any | null>(null);
  const [editingInterval, setEditingInterval] = useState(false);
  const [editingNotification, setEditingNotification] = useState(false);
  const [customNotifications, setCustomNotifications] = useState<Array<{ description: string; threshold: number }>>([]);
  const [showAddCustom, setShowAddCustom] = useState(false);
  const [newCustomDesc, setNewCustomDesc] = useState('');
  const [newCustomThreshold, setNewCustomThreshold] = useState('');
  const [editingNoteIndex, setEditingNoteIndex] = useState<number | null>(null);
  const [maintenanceItems, setMaintenanceItems] = useState<string[] | undefined>(undefined);
  const [showHistory, setShowHistory] = useState(false);
  const [category, setCategory] = useState<Category | null>(null);
  const [categoryServiceLabels, setCategoryServiceLabels] = useState<string[]>([]);
  const [editingServiceIndex, setEditingServiceIndex] = useState<number | null>(null);

  // Compute heavy equipment cycle schedule
  const cycleInfo = useMemo(() => {
    if (notificationType !== 'heavy' || !serviceInterval || !largeServiceInterval) return null;
    const reportsWithHours = shopReports.filter(r => r.servicedAt != null);
    if (reportsWithHours.length === 0) return null;

    // Cycle starts at the most recent major service's servicedAt
    const majorReports = reportsWithHours
      .filter(r => r.serviceType === 'major')
      .sort((a, b) => (b.servicedAt ?? 0) - (a.servicedAt ?? 0));
    const cycleStart = majorReports.length > 0
      ? majorReports[0].servicedAt!
      : reportsWithHours.sort((a, b) => (a.servicedAt ?? 0) - (b.servicedAt ?? 0))[0].servicedAt!;

    const numSlots = Math.floor(largeServiceInterval / serviceInterval);

    // Minor reports completed in this cycle (after cycleStart)
    const cycleMinorReports = reportsWithHours
      .filter(r => r.serviceType === 'minor' && r.servicedAt! > cycleStart)
      .sort((a, b) => (a.servicedAt ?? 0) - (b.servicedAt ?? 0));

    const milestones = [];
    for (let i = 1; i < numSlots; i++) {
      const slotIndex = i - 1;
      milestones.push({
        label: categoryServiceLabels[slotIndex] || `Minor Service ${i}`,
        hour: cycleStart + i * serviceInterval,
        type: 'minor' as const,
        completed: cycleMinorReports.length >= i,
        report: cycleMinorReports[i - 1] ?? null,
      });
    }
    const majorSlotIndex = numSlots - 1;
    milestones.push({
      label: categoryServiceLabels[majorSlotIndex] || 'Major Service',
      hour: cycleStart + largeServiceInterval,
      type: 'major' as const,
      completed: false,
      report: null,
    });

    return { cycleStart, milestones, completedMinorCount: cycleMinorReports.length };
  }, [shopReports, notificationType, serviceInterval, largeServiceInterval, categoryServiceLabels]);

  const handleSaveServiceLabel = async (slotIndex: number, newLabel: string) => {
    if (!category) return;
    const trimmed = newLabel.trim();
    if (!trimmed) return;
    const next = [...categoryServiceLabels];
    next[slotIndex] = trimmed;
    setCategoryServiceLabels(next);
    setCategory(prev => (prev ? { ...prev, serviceLabels: next } : null));
    setEditingServiceIndex(null);
    try {
      await updateCategory(category.id, { serviceLabels: next });
    } catch (error) {
      console.error('Error saving service label:', error);
      alert('Error saving service label');
    }
  };

  const addEquipmentDataNote = async () => {
    if (!equipmentId) return;
    const newNote: EquipmentNote = {
      id: `note_${Date.now()}`,
      text: '',
      createdAt: new Date().toISOString(),
      createdBy: user?.name || user?.username || 'Unknown',
      createdByRole: user?.role || 'user',
    };
    const updatedNotes = [...equipmentDataNotes, newNote];
    setEquipmentDataNotes(updatedNotes);
    setEditingNoteIndex(updatedNotes.length - 1);
    await saveNotesToEquipment(updatedNotes);
  };

  const removeEquipmentDataNote = async (index: number) => {
    if (!equipmentId) return;
    const removedNote = equipmentDataNotes[index];
    const updatedNotes = equipmentDataNotes.filter((_, i) => i !== index);
    setEquipmentDataNotes(updatedNotes);
    setEditingNoteIndex(null);
    await saveNotesToEquipment(updatedNotes);
    // Log to history
    if (equipmentName) {
      await equipmentHistoryFirebaseService.addHistory({
        equipmentId,
        equipmentName,
        action: 'updated',
        timestamp: new Date(),
        user: user?.name || user?.username || 'Unknown',
        userRole: user?.role || 'user',
        changes: [{ field: 'notes', oldValue: removedNote.text, newValue: '' }],
      });
    }
  };

  const saveNoteText = async (index: number, text: string) => {
    if (!equipmentId) return;
    const oldNote = equipmentDataNotes[index];
    const newNotes = [...equipmentDataNotes];
    newNotes[index] = { ...newNotes[index], text };
    setEquipmentDataNotes(newNotes);
    setEditingNoteIndex(null);
    await saveNotesToEquipment(newNotes);
    // Log to history if text changed
    if (equipmentName && oldNote.text !== text) {
      await equipmentHistoryFirebaseService.addHistory({
        equipmentId,
        equipmentName,
        action: 'updated',
        timestamp: new Date(),
        user: user?.name || user?.username || 'Unknown',
        userRole: user?.role || 'user',
        changes: [{ field: 'notes', oldValue: oldNote.text, newValue: text }],
      });
    }
  };

  const saveNotesToEquipment = async (notes: EquipmentNote[]) => {
    if (!equipmentId) return;
    try {
      const allEquipment = await equipmentManagementService.getAllEquipment();
      const inEquipmentCollection = allEquipment.some(eq => eq.id === equipmentId);
      if (inEquipmentCollection) {
        await equipmentManagementService.updateEquipment(equipmentId, { notes });
      } else {
        await fleetManagementService.updateEquipment(equipmentId, { notes }, undefined, true);
      }
    } catch (error) {
      console.error('Error saving notes:', error);
    }
  };

  const handleSaveServiceInterval = async () => {
    if (!equipmentId) return;
    try {
      const allEquipment = await equipmentManagementService.getAllEquipment();
      const inEquipmentCollection = allEquipment.some(eq => eq.id === equipmentId);
      if (inEquipmentCollection) {
        await equipmentManagementService.updateEquipment(equipmentId, { serviceInterval });
      } else {
        await fleetManagementService.updateEquipment(equipmentId, { serviceInterval }, undefined, true);
      }
      setSavedServiceInterval(serviceInterval);
      setEditingInterval(false);
      alert('Service interval saved successfully');
    } catch (error) {
      console.error('Error saving service interval:', error);
      alert('Error saving service interval');
    }
  };

  const handleSaveLargeServiceInterval = async () => {
    if (!equipmentId) return;
    try {
      const allEquipment = await equipmentManagementService.getAllEquipment();
      const inEquipmentCollection = allEquipment.some(eq => eq.id === equipmentId);
      if (inEquipmentCollection) {
        await equipmentManagementService.updateEquipment(equipmentId, { largeServiceInterval });
      } else {
        await fleetManagementService.updateEquipment(equipmentId, { largeServiceInterval }, undefined, true);
      }
      setSavedLargeServiceInterval(largeServiceInterval);
      setEditingLargeInterval(false);
      alert('Major service interval saved successfully');
    } catch (error) {
      console.error('Error saving major service interval:', error);
      alert('Error saving major service interval');
    }
  };

  const handleSaveCustomNotifications = async (updated: Array<{ description: string; threshold: number }>) => {
    if (!equipmentId) return;
    try {
      const allEquipment = await equipmentManagementService.getAllEquipment();
      const inEquipmentCollection = allEquipment.some(eq => eq.id === equipmentId);
      if (inEquipmentCollection) {
        await equipmentManagementService.updateEquipment(equipmentId, { customNotifications: updated });
      } else {
        await fleetManagementService.updateEquipment(equipmentId, { customNotifications: updated }, undefined, true);
      }
      setCustomNotifications(updated);
    } catch (error) {
      console.error('Error saving custom notifications:', error);
      alert('Error saving custom notifications');
    }
  };

  const handleSaveServiceNotification = async () => {
    if (!equipmentId) return;
    try {
      const allEquipment = await equipmentManagementService.getAllEquipment();
      const inEquipmentCollection = allEquipment.some(eq => eq.id === equipmentId);
      if (inEquipmentCollection) {
        await equipmentManagementService.updateEquipment(equipmentId, { serviceNotification });
      } else {
        await fleetManagementService.updateEquipment(equipmentId, { serviceNotification }, undefined, true);
      }
      setSavedServiceNotification(serviceNotification);
      setEditingNotification(false);
      alert('Service notification saved successfully');
    } catch (error) {
      console.error('Error saving service notification:', error);
      alert('Error saving service notification');
    }
  };

  useEffect(() => {
    if (equipmentId) {
      // Load equipment name immediately - try both services
      const loadEquipmentName = async () => {
        try {
          // Try equipment management first
          let allEquipment = await equipmentManagementService.getAllEquipment();
          let equipment = allEquipment.find(eq => eq.id === equipmentId);
          
          // If not found, try fleet management
          if (!equipment) {
            const fleetEquipment = await fleetManagementService.getAllEquipment();
            equipment = fleetEquipment.find(eq => eq.id === equipmentId);
          }
          
          if (equipment) {
            setUnitName(equipment.name || '');
            setEquipmentSite(equipment.site || '');
            setServiceInterval(equipment.serviceInterval);
            setSavedServiceInterval(equipment.serviceInterval);
            setLargeServiceInterval(equipment.largeServiceInterval);
            setSavedLargeServiceInterval(equipment.largeServiceInterval);
            setServiceNotification(equipment.serviceNotification);
            setSavedServiceNotification(equipment.serviceNotification);
            setCustomNotifications(equipment.customNotifications || []);
            setEquipmentDataNotes(equipment.notes || []);
            // Load category to determine notification type
            if (equipment.category) {
              try {
                const cats = await getCategories();
                const cat = cats.find(c => c.id === equipment.category);
                setCategory(cat || null);
                setCategoryServiceLabels(cat?.serviceLabels || []);
                setNotificationType(cat?.notificationType || 'none');
                setMaintenanceItems(cat?.maintenanceItems);
              } catch {}
            }
          }
        } catch (error) {
          console.error('Error loading equipment data:', error);
        }
      };
      loadEquipmentName();
      loadShopReports();
    }
  }, [equipmentId]);

  const loadShopReports = async () => {
    if (!equipmentId) return;
    
    try {
      setLoading(true);
      
      const reports = await shopHistoryFirebaseService.getEquipmentShopHistory(equipmentId);
      setShopReports(reports);
      if (reports.length > 0) {
        setEquipmentName(reports[0].equipmentName);
        
        // Load all attachments for all reports
        const attachmentsMap: Record<string, any[]> = {};
        for (const report of reports) {
          if (report.id) {
            const attachments = await shopAttachmentService.getAttachmentsForReport(report.id);
            attachmentsMap[report.id] = attachments;
          }
        }
        setShopAttachments(attachmentsMap);
      }
    } catch (error) {
      console.error('Error loading shop reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleShopSubmit = async (shopReport: { lastServicedDate?: string; servicedAt?: number; serviceInterval?: number; serviceType?: 'minor' | 'major'; notes?: string; files?: File[] }, previews?: string[]) => {
    if (!equipmentId || !user) return;
    const reportEquipmentName = equipmentName || unitName;
    if (!reportEquipmentName) return;

    // For heavy equipment, major service resets the cycle (nextServiceAt = servicedAt + largeInterval)
    // Minor service: nextServiceAt = servicedAt + smallInterval
    const isHeavyMajor = notificationType === 'heavy' && shopReport.serviceType === 'major';
    const relevantInterval = isHeavyMajor ? largeServiceInterval : serviceInterval;
    const nextServiceAt = shopReport.servicedAt != null && relevantInterval
      ? shopReport.servicedAt + relevantInterval
      : undefined;
    
    try {
      const reportId = await shopHistoryFirebaseService.addShopReport(
        equipmentId,
        reportEquipmentName,
        equipmentSite,
        { ...shopReport, nextServiceAt },
        { username: user.username, role: user.role }
      );
      
      // Upload files if provided
      if (shopReport.files && shopReport.files.length > 0) {
        for (let i = 0; i < shopReport.files.length; i++) {
          const preview = previews?.[i] || '';
          await shopAttachmentService.uploadAttachment({
            shopReportId: reportId,
            equipmentId,
            equipmentName,
            file: shopReport.files[i],
            thumbnailUrl: preview,
            uploadedBy: user.id
          });
        }
      }
      
      // Record that this user created a service card, linked back to the report.
      const serviceLabel = shopReport.serviceType
        ? `${shopReport.serviceType === 'major' ? 'Major' : 'Minor'} service card created`
        : 'Service card created';
      await equipmentServiceLogService.addEntry({
        equipmentId,
        equipmentName: reportEquipmentName,
        type: 'service_card',
        description: shopReport.servicedAt != null
          ? `${serviceLabel} at ${shopReport.servicedAt.toLocaleString()} hrs/km`
          : serviceLabel,
        createdAt: new Date().toISOString(),
        createdBy: user.username,
        createdByRole: user.role,
        linkedReportId: reportId,
        linkedReportType: 'shop',
      });

      setShowShopForm(false);
      setReportsCollapsed(true);
      // Refresh shop reports and attachments
      const reports = await shopHistoryFirebaseService.getEquipmentShopHistory(equipmentId);
      setShopReports(reports);
      
      // Load all attachments for all reports
      const attachmentsMap: Record<string, any[]> = {};
      for (const report of reports) {
        if (report.id) {
          const attachments = await shopAttachmentService.getAttachmentsForReport(report.id);
          attachmentsMap[report.id] = attachments;
        }
      }
      setShopAttachments(attachmentsMap);
    } catch (error) {
      console.error('Error submitting shop report:', error);
      throw error;
    }
  };

  const handleDeleteShopReport = async (reportId: string) => {
    if (!confirm('Are you sure you want to delete this shop report?')) return;
    
    try {
      await shopHistoryFirebaseService.deleteShopReport(reportId);
      // Refresh shop reports
      if (equipmentId) {
        const reports = await shopHistoryFirebaseService.getEquipmentShopHistory(equipmentId);
        setShopReports(reports);
        setReportsCollapsed(true);
        
        // Load all attachments for all reports
        const attachmentsMap: Record<string, any[]> = {};
        for (const report of reports) {
          if (report.id) {
            const attachments = await shopAttachmentService.getAttachmentsForReport(report.id);
            attachmentsMap[report.id] = attachments;
          }
        }
        setShopAttachments(attachmentsMap);
      }
    } catch (error) {
      console.error('Error deleting shop report:', error);
      alert('Error deleting shop report: ' + (error as Error).message);
    }
  };

  return (
    <div className="min-h-screen bg-yellow-100 dark:bg-black text-gray-900 dark:text-yellow-100 px-2 sm:px-4 py-4 -mx-2 sm:-mx-4 lg:mx-0 lg:p-2">
      <div className="max-w-5xl mx-auto">
        <div className="bg-yellow-200 dark:bg-black border border-yellow-600 rounded-lg shadow-lg p-3 sm:p-4">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <div className="flex items-center space-x-2">
              <button
                onClick={() => navigate(-1)}
                className="p-1 text-yellow-600 dark:text-yellow-400 hover:text-yellow-500 dark:hover:text-yellow-300"
              >
                <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>
              <h3 className="text-base sm:text-lg font-semibold text-yellow-600 dark:text-yellow-400">{equipmentName || unitName || 'Loading...'}</h3>
            </div>
            <button
              type="button"
              onClick={() => setShowHistory(true)}
              className="p-1 text-yellow-600 dark:text-yellow-400 hover:text-yellow-500 dark:hover:text-yellow-300"
              title="Maintenance, service & repair history"
              aria-label="Maintenance, service and repair history"
            >
              <Settings className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>
          </div>

          {showHistory && equipmentId && (
            <EquipmentServiceHistory
              equipmentId={equipmentId}
              equipmentName={equipmentName || unitName || 'Equipment'}
              site={equipmentSite}
              maintenanceItems={maintenanceItems}
              onClose={() => setShowHistory(false)}
            />
          )}

          {/* Service Interval — label changes based on notification type */}
          <div className="mb-4">
            <label className="block text-xs text-yellow-700 dark:text-yellow-300 mb-1">
              {notificationType === 'heavy' ? 'Minor Service Interval' : 'Service Interval'}
            </label>
            <div className="flex items-center space-x-2">
              <input
                type="number"
                value={serviceInterval || ''}
                onChange={(e) => setServiceInterval(e.target.value ? parseFloat(e.target.value) : undefined)}
                disabled={!!savedServiceInterval && !editingInterval}
                className={`flex-1 px-2 py-1.5 border rounded-md text-xs [-moz-appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                  savedServiceInterval && !editingInterval
                    ? 'border-gray-400 dark:border-gray-600 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                    : 'border-yellow-600 bg-yellow-200 dark:bg-black text-gray-900 dark:text-yellow-100 focus:outline-none focus:ring-2 focus:ring-yellow-500'
                }`}
                placeholder="Enter Service Interval"
              />
              {savedServiceInterval && !editingInterval ? (
                <button
                  type="button"
                  onClick={() => setEditingInterval(true)}
                  className="px-3 py-1.5 text-xs text-yellow-600 dark:text-yellow-400 hover:text-yellow-500 dark:hover:text-yellow-300 border border-yellow-600 rounded hover:bg-yellow-100 dark:hover:bg-yellow-900 transition-colors"
                >
                  Edit
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSaveServiceInterval}
                  className="px-3 py-1.5 text-xs text-yellow-600 dark:text-yellow-400 hover:text-yellow-500 dark:hover:text-yellow-300 border border-yellow-600 rounded hover:bg-yellow-100 dark:hover:bg-yellow-900 transition-colors"
                >
                  Save
                </button>
              )}
            </div>
          </div>

          {/* Major Service Interval — heavy equipment only */}
          {notificationType === 'heavy' && (
            <div className="mb-4">
              <label className="block text-xs text-yellow-700 dark:text-yellow-300 mb-1">Major Service Interval</label>
              <div className="flex items-center space-x-2">
                <input
                  type="number"
                  value={largeServiceInterval || ''}
                  onChange={(e) => setLargeServiceInterval(e.target.value ? parseFloat(e.target.value) : undefined)}
                  disabled={!!savedLargeServiceInterval && !editingLargeInterval}
                  className={`flex-1 px-2 py-1.5 border rounded-md text-xs [-moz-appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                    savedLargeServiceInterval && !editingLargeInterval
                      ? 'border-gray-400 dark:border-gray-600 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                      : 'border-yellow-600 bg-yellow-200 dark:bg-black text-gray-900 dark:text-yellow-100 focus:outline-none focus:ring-2 focus:ring-yellow-500'
                  }`}
                  placeholder="Enter Major Service Interval"
                />
                {savedLargeServiceInterval && !editingLargeInterval ? (
                  <button
                    type="button"
                    onClick={() => setEditingLargeInterval(true)}
                    className="px-3 py-1.5 text-xs text-yellow-600 dark:text-yellow-400 hover:text-yellow-500 dark:hover:text-yellow-300 border border-yellow-600 rounded hover:bg-yellow-100 dark:hover:bg-yellow-900 transition-colors"
                  >
                    Edit
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSaveLargeServiceInterval}
                    className="px-3 py-1.5 text-xs text-yellow-600 dark:text-yellow-400 hover:text-yellow-500 dark:hover:text-yellow-300 border border-yellow-600 rounded hover:bg-yellow-100 dark:hover:bg-yellow-900 transition-colors"
                  >
                    Save
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Service Notification */}
          <div className="mb-4">
            <label className="block text-xs text-yellow-700 dark:text-yellow-300 mb-1">Set Service Notification</label>
            <div className="flex items-center space-x-2">
              <input
                type="number"
                value={serviceNotification || ''}
                onChange={(e) => setServiceNotification(e.target.value ? parseFloat(e.target.value) : undefined)}
                disabled={!!savedServiceNotification && !editingNotification}
                className={`flex-1 px-2 py-1.5 border rounded-md text-xs [-moz-appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                  savedServiceNotification && !editingNotification
                    ? 'border-gray-400 dark:border-gray-600 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                    : 'border-yellow-600 bg-yellow-200 dark:bg-black text-gray-900 dark:text-yellow-100 focus:outline-none focus:ring-2 focus:ring-yellow-500'
                }`}
                placeholder="Enter Service Notification"
              />
              {savedServiceNotification && !editingNotification ? (
                <button
                  type="button"
                  onClick={() => setEditingNotification(true)}
                  className="px-3 py-1.5 text-xs text-yellow-600 dark:text-yellow-400 hover:text-yellow-500 dark:hover:text-yellow-300 border border-yellow-600 rounded hover:bg-yellow-100 dark:hover:bg-yellow-900 transition-colors"
                >
                  Edit
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSaveServiceNotification}
                  className="px-3 py-1.5 text-xs text-yellow-600 dark:text-yellow-400 hover:text-yellow-500 dark:hover:text-yellow-300 border border-yellow-600 rounded hover:bg-yellow-100 dark:hover:bg-yellow-900 transition-colors"
                >
                  Save
                </button>
              )}
            </div>
          </div>

          {/* Custom Notifications */}
          {notificationType !== 'none' && (
            <div className="mb-4">
              <label className="block text-xs text-yellow-700 dark:text-yellow-300 mb-2">Custom Notifications</label>
              {customNotifications.length > 0 && (
                <div className="space-y-1.5 mb-2">
                  {customNotifications.map((cn, i) => (
                    <div key={i} className="flex items-center justify-between px-2 py-1.5 border border-yellow-500 rounded-md bg-yellow-50 dark:bg-yellow-900/10 text-xs">
                      <span className="text-gray-900 dark:text-yellow-100 flex-1 min-w-0 truncate">{cn.description}</span>
                      <span className="ml-2 text-yellow-700 dark:text-yellow-300 whitespace-nowrap">{cn.threshold.toLocaleString()} hr/km</span>
                      <button
                        type="button"
                        onClick={() => {
                          const updated = customNotifications.filter((_, idx) => idx !== i);
                          handleSaveCustomNotifications(updated);
                        }}
                        className="ml-2 text-red-500 hover:text-red-700 text-xs font-medium whitespace-nowrap"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {showAddCustom ? (
                <div className="flex flex-col gap-1.5 border border-yellow-500 rounded-md p-2 bg-yellow-50 dark:bg-yellow-900/10">
                  <input
                    type="text"
                    placeholder="Description (e.g. Replace brake pads)"
                    value={newCustomDesc}
                    onChange={(e) => setNewCustomDesc(e.target.value)}
                    className="w-full px-2 py-1.5 border border-yellow-600 rounded-md text-xs bg-yellow-200 dark:bg-black text-gray-900 dark:text-yellow-100 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  />
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      placeholder="Hr/km threshold"
                      value={newCustomThreshold}
                      onChange={(e) => setNewCustomThreshold(e.target.value)}
                      className="flex-1 px-2 py-1.5 border border-yellow-600 rounded-md text-xs bg-yellow-200 dark:bg-black text-gray-900 dark:text-yellow-100 focus:outline-none focus:ring-2 focus:ring-yellow-500 [-moz-appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (!newCustomDesc.trim() || !newCustomThreshold) return;
                        const updated = [...customNotifications, { description: newCustomDesc.trim(), threshold: Number(newCustomThreshold) }];
                        handleSaveCustomNotifications(updated);
                        setNewCustomDesc('');
                        setNewCustomThreshold('');
                        setShowAddCustom(false);
                      }}
                      disabled={!newCustomDesc.trim() || !newCustomThreshold}
                      className="px-3 py-1.5 text-xs text-yellow-600 dark:text-yellow-400 hover:text-yellow-500 dark:hover:text-yellow-300 border border-yellow-600 rounded hover:bg-yellow-100 dark:hover:bg-yellow-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowAddCustom(false); setNewCustomDesc(''); setNewCustomThreshold(''); }}
                      className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 border border-gray-400 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowAddCustom(true)}
                  className="w-full px-2 py-1.5 border border-dashed border-yellow-600 rounded-md text-xs text-yellow-700 dark:text-yellow-300 hover:bg-yellow-100 dark:hover:bg-yellow-900/30 transition-colors"
                >
                  + Set Custom Notification
                </button>
              )}
            </div>
          )}

          {/* Heavy Equipment Service Schedule */}
          {cycleInfo && (
            <div className="mb-4">
              <h3 className="text-xs font-semibold text-yellow-700 dark:text-yellow-300 mb-2">
                Service Schedule
                <span className="ml-2 font-normal text-gray-500 dark:text-gray-400">
                  (cycle from {cycleInfo.cycleStart.toLocaleString()} hrs)
                </span>
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {cycleInfo.milestones.map((m, i) => (
                  <div
                    key={i}
                    className={`flex items-center space-x-2 px-3 py-2 rounded-md border text-xs ${
                      m.completed
                        ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                        : m.type === 'major'
                          ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300'
                          : 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/10 text-yellow-700 dark:text-yellow-300'
                    }`}
                  >
                    <span className="text-base leading-none">
                      {m.completed ? '✓' : m.type === 'major' ? '★' : '○'}
                    </span>
                    <div className="min-w-0">
                      {editingServiceIndex === i ? (
                        <input
                          type="text"
                          defaultValue={categoryServiceLabels[i] || m.label}
                          autoFocus
                          onBlur={(e) => handleSaveServiceLabel(i, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveServiceLabel(i, e.currentTarget.value);
                            if (e.key === 'Escape') setEditingServiceIndex(null);
                          }}
                          className="w-full px-1.5 py-0.5 text-xs border border-yellow-500 rounded bg-yellow-100 dark:bg-black text-gray-900 dark:text-yellow-100 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                        />
                      ) : (
                        <div
                          className={`font-medium truncate ${user?.role === 'admin' || user?.role === 'supervisor' ? 'cursor-pointer hover:text-yellow-600 dark:hover:text-yellow-300' : ''}`}
                          onClick={() => {
                            if (user?.role === 'admin' || user?.role === 'supervisor') {
                              setEditingServiceIndex(i);
                            }
                          }}
                          title={user?.role === 'admin' || user?.role === 'supervisor' ? 'Click to rename service' : ''}
                        >
                          {m.label}
                        </div>
                      )}
                      <div className="opacity-75">{m.hour.toLocaleString()} hrs</div>
                      {m.completed && m.report?.lastServicedDate && (
                        <div className="opacity-60">{m.report.lastServicedDate}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Equipment Data Notes */}
          <div className="mb-4">
            <label className="block text-xs text-yellow-700 dark:text-yellow-300 mb-1.5">Notes</label>
            <div className="space-y-1.5 mb-2">
              {equipmentDataNotes.map((note, index) => (
                <div key={index} className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    {editingNoteIndex === index ? (
                      <input
                        type="text"
                        defaultValue={note.text}
                        autoFocus
                        onBlur={(e) => saveNoteText(index, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveNoteText(index, e.currentTarget.value);
                          if (e.key === 'Escape') setEditingNoteIndex(null);
                        }}
                        className="w-full px-2 py-1 text-xs border border-yellow-500 rounded bg-yellow-100 dark:bg-black text-gray-900 dark:text-yellow-100 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                      />
                    ) : (
                      <p
                        className="text-xs text-gray-500 dark:text-gray-400 italic cursor-pointer hover:text-gray-600 dark:hover:text-gray-300"
                        onClick={() => setEditingNoteIndex(index)}
                      >
                        {note.text || 'Empty note'}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeEquipmentDataNote(index)}
                    className="p-1 text-red-500 hover:text-red-700 text-xs"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addEquipmentDataNote}
              className="flex items-center space-x-1 px-2 py-1 text-xs text-yellow-600 dark:text-yellow-400 hover:text-yellow-500 dark:hover:text-yellow-300 border border-yellow-600 rounded hover:bg-yellow-100 dark:hover:bg-yellow-900 transition-colors"
            >
              <Plus className="h-3 w-3" />
              <span>Add Note</span>
            </button>
          </div>

          {/* Services Header */}
          <div className="border-t border-yellow-400 dark:border-yellow-600 pt-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base sm:text-lg font-semibold text-yellow-600 dark:text-yellow-400">
                Services
              </h2>
              <div className="flex items-center space-x-2">
                {shopReports.length > 1 && (
                  <button
                    onClick={() => setReportsCollapsed(!reportsCollapsed)}
                    className="text-yellow-600 dark:text-yellow-400 hover:text-yellow-500 dark:hover:text-yellow-300 p-1"
                    title={reportsCollapsed ? 'Show All Reports' : 'Collapse Reports'}
                  >
                    {reportsCollapsed ? (
                      <ChevronDown className="h-5 w-5" />
                    ) : (
                      <ChevronUp className="h-5 w-5" />
                    )}
                  </button>
                )}
                {(user?.role === 'admin' || user?.role === 'supervisor') && (
                  <button
                    onClick={() => setShowShopForm(true)}
                    className="text-yellow-600 dark:text-yellow-400 hover:text-yellow-500 dark:hover:text-yellow-300 p-1"
                    title="Add Shop Report"
                  >
                    <Plus className="h-5 w-5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-4">
              <div className="text-xs text-yellow-600 dark:text-yellow-400">Loading...</div>
            </div>
          ) : (
            <>
              {/* Services Reports List */}
              {shopReports.length > 0 ? (
                <div className="space-y-2 mt-3">
                  {(reportsCollapsed ? [shopReports[0]] : shopReports).map((report) => (
                    <div key={report.id} className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-300 dark:border-yellow-700">
                      <div className="px-3 py-2">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <span className="text-sm font-medium text-yellow-700 dark:text-yellow-300">
                              {new Date(report.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                            </span>
                            <span className="text-xs text-yellow-600 dark:text-yellow-400">
                              by {report.createdBy}
                            </span>
                          </div>
                          {(user?.role === 'admin' || user?.role === 'supervisor') && (
                            <button
                              onClick={() => report.id && handleDeleteShopReport(report.id)}
                              className="p-1 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
                              title="Delete Report"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-2 mt-2 text-xs text-gray-700 dark:text-gray-300">
                          <div><strong>Serviced Date:</strong> {report.lastServicedDate || 'N/A'}</div>
                          <div><strong>Serviced At:</strong> {report.servicedAt?.toLocaleString() ?? report.lastServiceHours ?? 'N/A'}</div>
                          {(() => {
                            // Use stored nextServiceAt, or compute it for heavy equipment
                            let nextSvc = report.nextServiceAt;
                            if (nextSvc == null && report.servicedAt != null && notificationType === 'heavy') {
                              const isMajor = report.serviceType === 'major';
                              const interval = isMajor ? largeServiceInterval : serviceInterval;
                              if (interval) nextSvc = report.servicedAt + interval;
                            }
                            if (nextSvc == null && report.servicedAt != null && serviceInterval) {
                              nextSvc = report.servicedAt + serviceInterval;
                            }
                            return nextSvc != null ? (
                              <div>
                                <strong>Next Service:</strong> {nextSvc.toLocaleString()} hrs
                                {notificationType === 'heavy' && report.serviceType && (
                                  <span className="ml-1 text-gray-500 dark:text-gray-400">
                                    ({report.serviceType === 'major' ? 'next cycle' : 'minor'})
                                  </span>
                                )}
                              </div>
                            ) : null;
                          })()}
                          {report.serviceType && (
                            <div>
                              <strong>Type:</strong>{' '}
                              <span className={report.serviceType === 'major' ? 'text-orange-600 dark:text-orange-400 font-semibold' : ''}>
                                {report.serviceType === 'major' ? 'Major Service' : 'Minor Service'}
                              </span>
                            </div>
                          )}
                        </div>
                        {report.notes && (
                          <div className="mt-3 pt-3 border-t border-yellow-200 dark:border-yellow-800">
                            <div className="text-xs text-gray-700 dark:text-gray-300">
                              <strong>Notes:</strong> {report.notes}
                            </div>
                          </div>
                        )}
                        {shopAttachments[report.id!] && shopAttachments[report.id!].length > 0 && (
                          <div className="mt-3 pt-3 border-t border-yellow-200 dark:border-yellow-800">
                            <div className="text-xs text-gray-700 dark:text-gray-300 mb-2">
                              <strong>Attachments:</strong>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                              {shopAttachments[report.id!].map((attachment, index) => (
                                <a
                                  key={index}
                                  href={attachment.fileUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="relative bg-yellow-50 dark:bg-yellow-900/20 p-2 rounded-md border border-yellow-300 dark:border-yellow-700 hover:border-yellow-500 dark:hover:border-yellow-600 transition-colors"
                                >
                                  {attachment.thumbnailUrl ? (
                                    <div
                                      className="w-full h-20 border border-yellow-400 dark:border-yellow-700 rounded overflow-hidden cursor-pointer"
                                      onMouseEnter={() => setHoveredAttachment(attachment)}
                                      onMouseLeave={() => setHoveredAttachment(null)}
                                    >
                                      <img 
                                        src={attachment.thumbnailUrl} 
                                        alt={attachment.fileName}
                                        className="w-full h-full object-cover"
                                      />
                                    </div>
                                  ) : (
                                    <div className="w-full h-20 bg-yellow-100 dark:bg-yellow-800 flex items-center justify-center rounded mb-1">
                                      <span className="text-xs text-yellow-600 dark:text-yellow-400">
                                        {attachment.fileName.split('.').pop()?.toUpperCase() || 'FILE'}
                                      </span>
                                    </div>
                                  )}
                                  <span className="text-xs text-yellow-600 dark:text-yellow-400 truncate block">
                                    {attachment.fileName}
                                  </span>
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-2">No service reports yet.</p>
              )}
              
              {/* Attachment Preview Overlay */}
              {hoveredAttachment && (
                <div
                  className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 pointer-events-none"
                >
                  <div className="relative inline-block" style={{ transform: 'scale(0.75)', transformOrigin: 'center' }}>
                    <img
                      src={hoveredAttachment.fileUrl}
                      alt={hoveredAttachment.fileName}
                    />
                  </div>
                </div>
              )}
            </>
          )}

          {/* Add Service Modal */}
          {showShopForm && (
            <AddService
              equipmentId={equipmentId!}
              equipmentName={equipmentName}
              onClose={() => setShowShopForm(false)}
              onSubmit={handleShopSubmit}
              serviceInterval={serviceInterval}
              notificationType={notificationType}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default Service;
