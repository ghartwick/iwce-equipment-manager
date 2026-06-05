import { useState, useEffect, useRef } from 'react';
import { FileText, Wrench, ChevronDown, ChevronUp, MoreVertical } from 'lucide-react';
import { ServiceIntervalBar } from '../components/ServiceIntervalBar';
import { serviceNotificationService, ServiceNotificationItem } from '../services/serviceNotificationService';
import { AlertPanel } from '../components/AlertPanel';
import { alertsFirebaseService } from '../services/alertsFirebaseService';
import { maintenanceHistoryFirebaseService, MaintenanceReport } from '../services/maintenanceHistoryFirebaseService';
import { shopHistoryFirebaseService, ShopReport } from '../services/shopHistoryFirebaseService';
import { equipmentManagementService } from '../services/equipmentManagementService';
import { fleetManagementService } from '../services/fleetManagementService';
import { UserManagementService, AppUser } from '../services/userManagementService';
import { Equipment, StockAlert } from '../types';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  addMonths, 
  subMonths,
  isToday
} from 'date-fns';

export default function ReportsPage() {
  // Persist state across navigation
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [lastSelectedDate, setLastSelectedDate] = useState<Date | null>(null);
  const [siteFilter, setSiteFilter] = useState<string>('');
  const [userFilter, setUserFilter] = useState<string>('');
  const [maintenanceReports, setMaintenanceReports] = useState<MaintenanceReport[]>([]);
  const [shopReports, setShopReports] = useState<ShopReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [maintenanceCounts, setMaintenanceCounts] = useState<Record<string, number>>({});
  const [shopCounts, setShopCounts] = useState<Record<string, number>>({});
  const [repairNoteCounts, setRepairNoteCounts] = useState<Record<string, number>>({});
  const [equipmentData, setEquipmentData] = useState<Record<string, Equipment>>({});
  const [users, setUsers] = useState<AppUser[]>([]);
  const [userManagementService] = useState(() => new UserManagementService());
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [analysisResults, setAnalysisResults] = useState<any>(null);
  const [expandedReport, setExpandedReport] = useState<string | null>(null);
  const [repairAlerts, setRepairAlerts] = useState<StockAlert[]>([]);
  const [showRepairAlerts, setShowRepairAlerts] = useState(false);
  const alertPanelRef = useRef<HTMLDivElement>(null);
  const [serviceNotifications, setServiceNotifications] = useState<ServiceNotificationItem[]>([]);
  const [showMenu, setShowMenu] = useState(false);
  const [showServiceView, setShowServiceView] = useState(false);
  const [heavyEquipmentList, setHeavyEquipmentList] = useState<Equipment[]>([]);
  const [fleetEquipmentList, setFleetEquipmentList] = useState<Equipment[]>([]);
  const [equipmentServiceData, setEquipmentServiceData] = useState<Record<string, { currentHours: number; nextServiceAt: number }>>({});
  const [serviceLoading, setServiceLoading] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    alertsFirebaseService.getAllRepairAlerts().then(setRepairAlerts).catch(console.error);
    serviceNotificationService.getServiceStatuses().then(setServiceNotifications).catch(console.error);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadServiceData = async () => {
    setServiceLoading(true);
    try {
      const [heavy, fleet, allMaintenance, allShop] = await Promise.all([
        equipmentManagementService.getAllEquipment(),
        fleetManagementService.getAllEquipment(),
        maintenanceHistoryFirebaseService.getAllMaintenanceHistory(),
        shopHistoryFirebaseService.getAllShopHistory(),
      ]);
      const hoursMap: Record<string, number> = {};
      allMaintenance.forEach(r => {
        if (!hoursMap[r.equipmentId] && r.maintenance?.hours) hoursMap[r.equipmentId] = r.maintenance.hours;
      });
      const nextServiceMap: Record<string, number> = {};
      allShop.forEach(r => {
        if (!nextServiceMap[r.equipmentId] && r.lastServiceHours) nextServiceMap[r.equipmentId] = r.lastServiceHours;
      });
      const serviceData: Record<string, { currentHours: number; nextServiceAt: number }> = {};
      [...heavy, ...fleet].forEach(eq => {
        serviceData[eq.id] = { currentHours: hoursMap[eq.id] || 0, nextServiceAt: nextServiceMap[eq.id] || 0 };
      });
      setHeavyEquipmentList(heavy.filter(e => e.serviceInterval));
      setFleetEquipmentList(fleet.filter(e => e.serviceInterval));
      setEquipmentServiceData(serviceData);
    } catch (err) {
      console.error('Error loading service data:', err);
    } finally {
      setServiceLoading(false);
    }
  };

  useEffect(() => {
    const handleToggleAlerts = () => {
      setShowRepairAlerts(v => !v);
    };
    window.addEventListener('toggleAlerts', handleToggleAlerts);
    return () => window.removeEventListener('toggleAlerts', handleToggleAlerts);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (alertPanelRef.current && !alertPanelRef.current.contains(event.target as Node)) {
        setShowRepairAlerts(false);
      }
    };

    if (showRepairAlerts) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showRepairAlerts]);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 }); // Monday
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 }); // Sunday

  const days = eachDayOfInterval({ start: startDate, end: endDate });
  const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const formatDateKey = (date: Date) => format(date, 'yyyy-MM-dd');

  const handlePreviousMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  const handleGenerateReport = async () => {
    // Check if a filter is selected
    if (!siteFilter && !userFilter) {
      alert('Please select a filter (Site or User) to generate a report');
      return;
    }
    
    try {
      setLoading(true);
      const [maintenance, shop] = await Promise.all([
        maintenanceHistoryFirebaseService.getAllMaintenanceHistory(),
        shopHistoryFirebaseService.getAllShopHistory()
      ]);

      const selectedDateKeys = selectedDates.map(d => formatDateKey(d));

      const filteredMaintenance = maintenance.filter(report => {
        const reportDate = format(new Date(report.createdAt), 'yyyy-MM-dd');
        if (!selectedDateKeys.includes(reportDate)) return false;
        
        const equipment = equipmentData[report.equipmentId];
        
        // If siteFilter is 'all', don't filter by site
        if (siteFilter && siteFilter !== '' && siteFilter !== 'all' && equipment?.site !== siteFilter) return false;
        
        // If userFilter is 'all', don't filter by user
        if (userFilter && userFilter !== '' && userFilter !== 'all') {
          const selectedUser = users.find(u => u.id === userFilter);
          if (selectedUser && report.createdBy !== selectedUser.username) return false;
        }
        
        return true;
      });

      const filteredShop = shop.filter(report => {
        const reportDate = format(new Date(report.createdAt), 'yyyy-MM-dd');
        if (!selectedDateKeys.includes(reportDate)) return false;
        
        const equipment = equipmentData[report.equipmentId];
        
        // If siteFilter is 'all', don't filter by site
        if (siteFilter && siteFilter !== '' && siteFilter !== 'all' && equipment?.site !== siteFilter) return false;
        
        // If userFilter is 'all', don't filter by user
        if (userFilter && userFilter !== '' && userFilter !== 'all') {
          const selectedUser = users.find(u => u.id === userFilter);
          if (selectedUser && report.createdBy !== selectedUser.username) return false;
        }
        
        return true;
      });

      // Analyze maintenance reports by user
      const reportsByUser: Record<string, number> = {};
      filteredMaintenance.forEach(report => {
        reportsByUser[report.createdBy] = (reportsByUser[report.createdBy] || 0) + 1;
      });

      // Analyze by equipment
      const reportsByEquipment: Record<string, number> = {};
      filteredMaintenance.forEach(report => {
        const equipmentName = report.equipmentName || report.equipmentId;
        reportsByEquipment[equipmentName] = (reportsByEquipment[equipmentName] || 0) + 1;
      });

      // Analyze by repair items (from maintenance fields marked as 'Repair')
      const repairItems: Record<string, number> = {};
      filteredMaintenance.forEach(report => {
        const m = report.maintenance;
        if (m.stepsHandRails === 'Repair') repairItems['Steps/Hand Rails'] = (repairItems['Steps/Hand Rails'] || 0) + 1;
        if (m.tiresTracks === 'Repair') repairItems['Tires/Tracks'] = (repairItems['Tires/Tracks'] || 0) + 1;
        if (m.bucket === 'Repair') repairItems['Bucket'] = (repairItems['Bucket'] || 0) + 1;
        if (m.cuttingEdgeTeeth === 'Repair') repairItems['Cutting Edge/Teeth'] = (repairItems['Cutting Edge/Teeth'] || 0) + 1;
        if (m.hoses === 'Repair') repairItems['Hoses'] = (repairItems['Hoses'] || 0) + 1;
        if (m.batteryCableBeltHosesFilterGuards === 'Repair') repairItems['Battery/Cable/Belt/Hoses/Filter/Guards'] = (repairItems['Battery/Cable/Belt/Hoses/Filter/Guards'] || 0) + 1;
        if (m.backupAlarm === 'Repair') repairItems['Backup Alarm'] = (repairItems['Backup Alarm'] || 0) + 1;
        if (m.fireExtinguisher === 'Repair') repairItems['Fire Extinguisher'] = (repairItems['Fire Extinguisher'] || 0) + 1;
        if (m.gauges === 'Repair') repairItems['Gauges'] = (repairItems['Gauges'] || 0) + 1;
        if (m.horn === 'Repair') repairItems['Horn'] = (repairItems['Horn'] || 0) + 1;
        if (m.spillKit === 'Repair') repairItems['Spill Kit'] = (repairItems['Spill Kit'] || 0) + 1;
        if (m.glass === 'Repair') repairItems['Glass'] = (repairItems['Glass'] || 0) + 1;
        if (m.mirror === 'Repair') repairItems['Mirror'] = (repairItems['Mirror'] || 0) + 1;
        if (m.rollOverProtection === 'Repair') repairItems['Roll Over Protection'] = (repairItems['Roll Over Protection'] || 0) + 1;
        if (m.seatBeltSeat === 'Repair') repairItems['Seat Belt/Seat'] = (repairItems['Seat Belt/Seat'] || 0) + 1;
        if (m.allFluidsLevel === 'Repair') repairItems['All Fluids Level'] = (repairItems['All Fluids Level'] || 0) + 1;
      });

      // Extract units with repairs or notes
      const unitsWithRepairsOrNotes: Array<{ equipment: string; item: string; type: 'repair' | 'note'; date: string; user: string }> = [];
      filteredMaintenance.forEach(report => {
        const m = report.maintenance;
        // Check for repairs
        const repairFields = [
          { key: 'stepsHandRails', label: 'Steps/Hand Rails' },
          { key: 'tiresTracks', label: 'Tires/Tracks' },
          { key: 'bucket', label: 'Bucket' },
          { key: 'cuttingEdgeTeeth', label: 'Cutting Edge/Teeth' },
          { key: 'hoses', label: 'Hoses' },
          { key: 'batteryCableBeltHosesFilterGuards', label: 'Battery Cable, Belt, Hoses, Filter, Guards' },
          { key: 'backupAlarm', label: 'Backup Alarm' },
          { key: 'fireExtinguisher', label: 'Fire Extinguisher' },
          { key: 'gauges', label: 'Gauges' },
          { key: 'horn', label: 'Horn' },
          { key: 'spillKit', label: 'Spill Kit' },
          { key: 'glass', label: 'Glass (all sides)' },
          { key: 'mirror', label: 'Mirror' },
          { key: 'rollOverProtection', label: 'Roll Over Protection' },
          { key: 'seatBeltSeat', label: 'Seat Belt/Seat' },
          { key: 'allFluidsLevel', label: 'All Fluids Level' },
        ];
        repairFields.forEach(field => {
          if ((m as any)[field.key] === 'Repair') {
            unitsWithRepairsOrNotes.push({ 
              equipment: report.equipmentName, 
              item: field.label, 
              type: 'repair',
              date: format(new Date(report.createdAt), 'MMM d'),
              user: report.createdBy
            });
          }
        });
        // Check for notes
        if (m.notes && m.notes.trim().length > 0) {
          unitsWithRepairsOrNotes.push({ 
            equipment: report.equipmentName, 
            item: m.notes, 
            type: 'note',
            date: format(new Date(report.createdAt), 'MMM d'),
            user: report.createdBy
          });
        }
      });

      // Group by equipment
      const groupedByEquipment: Record<string, Array<{ item: string; type: 'repair' | 'note'; date: string; user: string }>> = {};
      unitsWithRepairsOrNotes.forEach(item => {
        if (!groupedByEquipment[item.equipment]) {
          groupedByEquipment[item.equipment] = [];
        }
        groupedByEquipment[item.equipment].push({ item: item.item, type: item.type, date: item.date, user: item.user });
      });

      const analysis = {
        totalMaintenanceReports: filteredMaintenance.length,
        totalShopReports: filteredShop.length,
        reportsByUser,
        reportsByEquipment,
        repairItems,
        unitsWithRepairsOrNotes,
        groupedByEquipment,
        totalRepairsAndNotes: unitsWithRepairsOrNotes.length,
        dateRange: `${format(selectedDates[0], 'MMM d')} - ${format(selectedDates[selectedDates.length - 1], 'MMM d')}`,
        uniqueUsers: Object.keys(reportsByUser).length,
        uniqueEquipment: Object.keys(reportsByEquipment).length
      };

      setAnalysisResults(analysis);
      setShowAnalysis(true);
    } catch (error) {
      console.error('Error generating report:', error);
      alert('Error generating report');
    } finally {
      setLoading(false);
    }
  };

  const handleDateClick = (date: Date, event: React.MouseEvent<HTMLButtonElement>) => {
    const isAdditive = event.ctrlKey || event.metaKey;
    const isRange = event.shiftKey && lastSelectedDate;

    let nextSelectedDates: Date[] = [];

    if (isRange && lastSelectedDate) {
      const rangeStart = lastSelectedDate < date ? lastSelectedDate : date;
      const rangeEnd = lastSelectedDate < date ? date : lastSelectedDate;
      const rangeDates = eachDayOfInterval({ start: rangeStart, end: rangeEnd });

      if (isAdditive) {
        const existing = selectedDates.filter(selected =>
          !rangeDates.some(rangeDate => isSameDay(rangeDate, selected))
        );
        nextSelectedDates = [...existing, ...rangeDates];
      } else {
        nextSelectedDates = rangeDates;
      }
    } else if (isAdditive) {
      const alreadySelected = selectedDates.some(selected => isSameDay(selected, date));
      if (alreadySelected) {
        nextSelectedDates = selectedDates.filter(selected => !isSameDay(selected, date));
      } else {
        nextSelectedDates = [...selectedDates, date];
      }
    } else {
      nextSelectedDates = [date];
    }

    setSelectedDates(nextSelectedDates);
    setLastSelectedDate(date);

    // Load reports for the dates to populate user filter dropdown
    if (nextSelectedDates.length > 0) {
      loadReportsForDate(nextSelectedDates);
    }
  };

  const loadReportsForDate = async (dates: Date[]) => {
    setLoading(true);
    try {
      const [maintenance, shop] = await Promise.all([
        maintenanceHistoryFirebaseService.getAllMaintenanceHistory(),
        shopHistoryFirebaseService.getAllShopHistory()
      ]);

      const dateKeys = dates.map(d => formatDateKey(d));

      const filteredMaintenance = maintenance.filter(report => {
        const reportDate = format(new Date(report.createdAt), 'yyyy-MM-dd');
        if (!dateKeys.includes(reportDate)) return false;
        
        // Use stored site from report, fall back to current equipment site
        const site = report.site || equipmentData[report.equipmentId]?.site;
        
        // If siteFilter is 'all', don't filter by site
        // If siteFilter is set but report has no site, include the report (for backward compatibility)
        if (siteFilter && siteFilter !== '' && siteFilter !== 'all' && site && site !== siteFilter) return false;
        
        // If userFilter is 'all', don't filter by user
        if (userFilter && userFilter !== '' && userFilter !== 'all') {
          const selectedUser = users.find(u => u.id === userFilter);
          if (selectedUser && report.createdBy !== selectedUser.username) return false;
        }
        
        return true;
      });

      const filteredShop = shop.filter(report => {
        const reportDate = format(new Date(report.createdAt), 'yyyy-MM-dd');
        if (!dateKeys.includes(reportDate)) return false;
        
        // Use stored site from report, fall back to current equipment site
        const site = report.site || equipmentData[report.equipmentId]?.site;
        
        // If siteFilter is 'all', don't filter by site
        // If siteFilter is set but report has no site, include the report (for backward compatibility)
        if (siteFilter && siteFilter !== '' && siteFilter !== 'all' && site && site !== siteFilter) return false;
        
        // If userFilter is 'all', don't filter by user
        if (userFilter && userFilter !== '' && userFilter !== 'all') {
          const selectedUser = users.find(u => u.id === userFilter);
          if (selectedUser && report.createdBy !== selectedUser.username) return false;
        }
        
        return true;
      });

      // Always set reports for selected date so filter dropdowns can populate
      setMaintenanceReports(filteredMaintenance);
      setShopReports(filteredShop);
    } catch (error) {
      console.error('Error loading reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadReportsForMonth = async () => {
    try {
      const [maintenance, shop] = await Promise.all([
        maintenanceHistoryFirebaseService.getAllMaintenanceHistory(),
        shopHistoryFirebaseService.getAllShopHistory()
      ]);

      const maintCounts: Record<string, number> = {};
      const shopCounts: Record<string, number> = {};
      const repairNoteCounts: Record<string, number> = {};
      const unitsWithNotesOrRepairs: Record<string, Set<string>> = {};

      maintenance.forEach(report => {
        // Use stored site from report, fall back to current equipment site
        const site = report.site || equipmentData[report.equipmentId]?.site;

        // If siteFilter is 'all', don't filter by site
        // If siteFilter is set but report has no site, include the report (for backward compatibility)
        if (siteFilter && siteFilter !== '' && siteFilter !== 'all' && site && site !== siteFilter) return;

        // If userFilter is 'all', don't filter by user
        if (userFilter && userFilter !== '' && userFilter !== 'all') {
          const selectedUser = users.find(u => u.id === userFilter);
          if (selectedUser && report.createdBy !== selectedUser.username) return;
        }

        const reportDate = format(new Date(report.createdAt), 'yyyy-MM-dd');
        maintCounts[reportDate] = (maintCounts[reportDate] || 0) + 1;

        // Check if unit has notes, repairs, or a triggered service notification
        const hasNotes = report.maintenance.notes && report.maintenance.notes.trim().length > 0;
        const hasRepairs = Object.values(report.maintenance).some(
          val => val === 'Repair'
        );
        const hasServiceNotification = !!report.maintenance.serviceNotificationTriggered;

        if (hasNotes || hasRepairs || hasServiceNotification) {
          if (!unitsWithNotesOrRepairs[reportDate]) {
            unitsWithNotesOrRepairs[reportDate] = new Set();
          }
          unitsWithNotesOrRepairs[reportDate].add(report.equipmentId);
        }
      });

      shop.forEach(report => {
        // Use stored site from report, fall back to current equipment site
        const site = report.site || equipmentData[report.equipmentId]?.site;

        // If siteFilter is 'all', don't filter by site
        // If siteFilter is set but report has no site, include the report (for backward compatibility)
        if (siteFilter && siteFilter !== '' && siteFilter !== 'all' && site && site !== siteFilter) return;

        // If userFilter is 'all', don't filter by user
        if (userFilter && userFilter !== '' && userFilter !== 'all') {
          const selectedUser = users.find(u => u.id === userFilter);
          if (selectedUser && report.createdBy !== selectedUser.username) return;
        }

        const reportDate = format(new Date(report.createdAt), 'yyyy-MM-dd');
        shopCounts[reportDate] = (shopCounts[reportDate] || 0) + 1;
      });

      // Calculate repair/note counts from the Sets
      Object.keys(unitsWithNotesOrRepairs).forEach(date => {
        repairNoteCounts[date] = unitsWithNotesOrRepairs[date].size;
      });

      setMaintenanceCounts(maintCounts);
      setShopCounts(shopCounts);
      setRepairNoteCounts(repairNoteCounts);
    } catch (error) {
      console.error('Error loading reports for month:', error);
    }
  };

  useEffect(() => {
    loadReportsForMonth();
  }, [currentMonth, siteFilter, userFilter]);

  useEffect(() => {
    if (selectedDates.length > 0) {
      loadReportsForDate(selectedDates);
    }
  }, [siteFilter, userFilter]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [equipment, fleetEquipment, allUsers] = await Promise.all([
          equipmentManagementService.getAllEquipment(),
          fleetManagementService.getAllEquipment(),
          userManagementService.getAllUsers()
        ]);
        
        const equipmentMap: Record<string, Equipment> = {};
        equipment.forEach(eq => {
          equipmentMap[eq.id] = eq;
        });
        fleetEquipment.forEach(eq => {
          equipmentMap[eq.id] = eq;
        });
        setEquipmentData(equipmentMap);
        setUsers(allUsers);
      } catch (error) {
        console.error('Error loading data:', error);
      }
    };
    loadData();
  }, []);

  const selectedDateLabel = selectedDates.length === 1
    ? format(selectedDates[0], 'MMM d, yyyy')
    : `${selectedDates.length} dates selected`;

  // Get unique sites from equipment that have reports for the selected date
  const getUniqueSites = () => {
    const siteSet = new Set<string>();
    [...maintenanceReports, ...shopReports].forEach(report => {
      // Use the site stored in the report (at creation time), fall back to current equipment site
      const site = report.site || (equipmentData[report.equipmentId]?.site);
      if (site) {
        siteSet.add(site);
      }
    });
    return Array.from(siteSet).sort();
  };

  // Get unique users who created reports
  const getUniqueUsers = () => {
    const userSet = new Set<string>();
    [...maintenanceReports, ...shopReports].forEach(report => {
      userSet.add(report.createdBy);
    });
    return users.filter(u => userSet.has(u.username)).sort((a, b) => a.name.localeCompare(b.name));
  };

  return (
    <div className="min-h-screen bg-yellow-100 dark:bg-black text-gray-900 dark:text-yellow-100 px-2 sm:px-4 py-4 -mx-2 sm:-mx-4 lg:mx-0 lg:p-2">
      <div className="max-w-5xl mx-auto">
        <div className="grid grid-cols-1 gap-2">
          {/* Repair Alerts Panel */}
          {showRepairAlerts && (
            <div ref={alertPanelRef}>
              <AlertPanel
                alerts={repairAlerts}
                products={Object.values(equipmentData)}
                serviceNotifications={serviceNotifications}
              />
            </div>
          )}

          {/* Calendar */}
          <div className="bg-yellow-200 dark:bg-black border border-yellow-600 rounded-lg shadow-xl dark:shadow-yellow-900/20 dark:shadow-2xl p-2">
            {/* Calendar Header */}
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={handlePreviousMonth}
                className="p-2 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-100 dark:hover:bg-yellow-900 dark:hover:bg-opacity-30 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h2 className="text-xl font-semibold text-yellow-700 dark:text-yellow-300">
                {format(currentMonth, 'MMMM yyyy')}
              </h2>
              <button
                onClick={handleNextMonth}
                className="p-2 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-100 dark:hover:bg-yellow-900 dark:hover:bg-opacity-30 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            {/* Week Days */}
            <div className="grid grid-cols-7 gap-2 mb-2">
              {weekDays.map(day => (
                <div key={day} className="text-center text-xs font-medium text-yellow-700 dark:text-yellow-600 py-2">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Days */}
            <div className="grid grid-cols-7 gap-2 mb-6">
              {days.map((day, index) => {
                const isCurrentMonth = isSameMonth(day, currentMonth);
                const isSelected = selectedDates.some(d => isSameDay(day, d));
                const isTodayDate = isToday(day);
                const dateKey = formatDateKey(day);
                const maintCount = maintenanceCounts[dateKey] || 0;
                const shopCount = shopCounts[dateKey] || 0;
                const repairNoteCount = repairNoteCounts[dateKey] || 0;

                return (
                  <button
                    key={index}
                    onClick={(event) => handleDateClick(day, event)}
                    className={`
                      relative p-2 text-sm rounded-lg border transition-all
                      ${isCurrentMonth ? 'text-gray-800 dark:text-yellow-100' : 'text-yellow-600 dark:text-yellow-700'}
                      ${!isCurrentMonth ? 'opacity-50' : ''}
                      ${isTodayDate && !isSelected ? 'border-yellow-500 dark:border-yellow-400' : (!isTodayDate && !isSelected ? 'border-yellow-600 dark:border-yellow-800' : '')}
                      ${isSelected ? 'bg-green-200 dark:bg-green-900 dark:bg-opacity-50 border-green-500' : 'hover:bg-yellow-100 dark:hover:bg-yellow-900 dark:hover:bg-opacity-30'}
                    `}
                  >
                    <div className="text-center relative">
                      {format(day, 'd')}
                      {maintCount > 0 && (
                        <div className="absolute -top-1 -left-1 bg-orange-600 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold">
                          {maintCount}
                        </div>
                      )}
                      {shopCount > 0 && (
                        <div className="absolute -top-1 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold">
                          {shopCount}
                        </div>
                      )}
                      {repairNoteCount > 0 && (
                        <div className="absolute -top-1 -right-1 bg-red-600 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold">
                          {repairNoteCount}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Reports section — always visible, menu button matches timesheet style */}
          <div className="bg-yellow-200 dark:bg-black border border-yellow-600 rounded-lg shadow-xl dark:shadow-yellow-900/20 dark:shadow-2xl p-2">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-yellow-700 dark:text-yellow-300">
                  {selectedDates.length > 0 ? `Shop Reports for ${selectedDateLabel}` : 'Shop Reports'}
                </h3>
                <div className="relative" ref={menuRef}>
                  <button
                    onClick={() => setShowMenu(v => !v)}
                    className="p-1.5 rounded-lg bg-yellow-300 dark:bg-yellow-800 text-yellow-900 dark:text-yellow-100 hover:bg-yellow-400 dark:hover:bg-yellow-700 transition-colors"
                    title="More actions"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>
                  {showMenu && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
                      <div className="absolute right-0 top-full mt-1 w-44 bg-white dark:bg-gray-900 border border-yellow-300 dark:border-yellow-700 rounded-lg shadow-lg z-50 py-1">
                        <button
                          onClick={() => {
                            setShowMenu(false);
                            if (!showServiceView) loadServiceData();
                            setShowServiceView(v => !v);
                            setShowAnalysis(false);
                          }}
                          className="w-full text-left px-4 py-2 text-sm text-gray-800 dark:text-yellow-100 hover:bg-yellow-50 dark:hover:bg-yellow-900/40"
                        >
                          {showServiceView ? 'Close Service' : 'Service'}
                        </button>
                        <button
                          onClick={() => {
                            setShowMenu(false);
                            if (showAnalysis) { setShowAnalysis(false); } else { handleGenerateReport(); }
                          }}
                          className="w-full text-left px-4 py-2 text-sm text-gray-800 dark:text-yellow-100 hover:bg-yellow-50 dark:hover:bg-yellow-900/40"
                        >
                          {showAnalysis ? 'Close Report' : 'Report'}
                        </button>
                        <button
                          onClick={() => {
                            setShowMenu(false);
                            setSelectedDates([]);
                            setMaintenanceReports([]);
                            setShopReports([]);
                            setShowAnalysis(false);
                            setAnalysisResults(null);
                            setShowServiceView(false);
                          }}
                          className="w-full text-left px-4 py-2 text-sm text-gray-800 dark:text-yellow-100 hover:bg-yellow-50 dark:hover:bg-yellow-900/40"
                        >
                          Clear Selection
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
              {selectedDates.length === 0 && (
                <p className="text-sm text-yellow-700 dark:text-yellow-600">Click on a date in the calendar to view reports.</p>
              )}
          {selectedDates.length > 0 && (
            <div>

              {/* Filter Dropdowns */}
              <div className="grid grid-cols-2 gap-2 mb-6">
                <div>
                  <label className="block text-sm font-medium text-yellow-700 dark:text-yellow-600 mb-2">
                    Site
                  </label>
                  <select
                    value={siteFilter}
                    onChange={(e) => {
                      setSiteFilter(e.target.value);
                      setUserFilter('');
                    }}
                    className="w-full px-3 py-2 bg-yellow-200 dark:bg-black border border-yellow-400 dark:border-yellow-700 rounded-lg text-gray-900 dark:text-yellow-100 focus:outline-none focus:border-yellow-400"
                  >
                    <option value="">None</option>
                    <option value="all">All</option>
                    {getUniqueSites().map(site => (
                      <option key={site} value={site}>{site}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-yellow-700 dark:text-yellow-600 mb-2">
                    User
                  </label>
                  <select
                    value={userFilter}
                    onChange={(e) => {
                      setUserFilter(e.target.value);
                      setSiteFilter('');
                    }}
                    className="w-full px-3 py-2 bg-yellow-200 dark:bg-black border border-yellow-400 dark:border-yellow-700 rounded-lg text-gray-900 dark:text-yellow-100 focus:outline-none focus:border-yellow-400"
                  >
                    <option value="">None</option>
                    <option value="all">All</option>
                    {getUniqueUsers().map(user => (
                      <option key={user.id} value={user.id}>{user.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Analysis Results */}
              {showAnalysis && analysisResults && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-300 dark:border-blue-700 rounded-lg p-4 mb-6">
                  <h4 className="text-lg font-semibold text-blue-800 dark:text-blue-300 mb-4">
                    Maintenance Analysis for {analysisResults.dateRange}
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-800 dark:text-blue-300">{analysisResults.totalMaintenanceReports}</div>
                      <div className="text-sm text-blue-600 dark:text-blue-400">Total Maintenance Reports</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-800 dark:text-blue-300">{analysisResults.totalShopReports}</div>
                      <div className="text-sm text-blue-600 dark:text-blue-400">Total Shop Reports</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-800 dark:text-blue-300">{analysisResults.totalRepairsAndNotes}</div>
                      <div className="text-sm text-blue-600 dark:text-blue-400">Repairs & Notes</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-800 dark:text-blue-300">{Object.keys(analysisResults.groupedByEquipment || {}).length}</div>
                      <div className="text-sm text-blue-600 dark:text-blue-400">Units with Issues</div>
                    </div>
                  </div>

                  {analysisResults.groupedByEquipment && Object.keys(analysisResults.groupedByEquipment).length > 0 && (
                    <div className="mb-4">
                      <h5 className="font-semibold text-blue-700 dark:text-blue-400 mb-2">Units with Repairs & Notes ({Object.keys(analysisResults.groupedByEquipment).length})</h5>
                      <div className="space-y-2">
                        {Object.entries(analysisResults.groupedByEquipment).map(([equipment, items]) => (
                          <div key={equipment} className="text-sm">
                            <div className="font-medium text-gray-900 dark:text-yellow-100 mb-1">{equipment}</div>
                            <ul className="ml-4 space-y-1">
                              {(items as Array<{ item: string; type: 'repair' | 'note'; date: string; user: string }>).map((item, index) => (
                                <li key={index} className="text-gray-700 dark:text-gray-300">
                                  {item.type === 'repair' ? 'Repair: ' : 'Note: '}{item.item} <span className="italic text-gray-400 dark:text-gray-500">({item.date} by {item.user})</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="mb-4">
                    <h5 className="font-semibold text-blue-700 dark:text-blue-400 mb-2">Reports by Equipment</h5>
                    <div className="space-y-1">
                      {Object.entries(analysisResults.reportsByEquipment).map(([equipment, count]) => (
                        <div key={equipment} className="flex justify-between text-sm text-gray-700 dark:text-gray-300">
                          <span>{equipment}</span>
                          <span>{String(count)} report(s)</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h5 className="font-semibold text-blue-700 dark:text-blue-400 mb-2">Reports by User</h5>
                    <div className="space-y-1">
                      {Object.entries(analysisResults.reportsByUser).map(([user, count]) => (
                        <div key={user} className="flex justify-between text-sm text-gray-700 dark:text-gray-300">
                          <span>{user}</span>
                          <span>{String(count)} report(s)</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {loading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-600 dark:border-yellow-400 mx-auto mb-4"></div>
                  <div className="text-sm text-yellow-600 dark:text-yellow-400">Loading reports...</div>
                </div>
              ) : (
                <>
                  {/* Maintenance Reports */}
                  {maintenanceReports.length > 0 && (siteFilter || userFilter) && (
                    <div className="mb-6">
                      <h4 className="text-base font-semibold text-yellow-700 dark:text-yellow-300 mb-3 flex items-center gap-2">
                        <Wrench className="h-4 w-4" />
                        Maintenance Reports ({maintenanceReports.length})
                      </h4>
                      <div className="space-y-2">
                        {maintenanceReports.map(report => {
                          const m = report.maintenance;
                          const hasRepairOrNotes = !!m.notes?.trim() || [
                            m.stepsHandRails, m.tiresTracks, m.bucket, m.cuttingEdgeTeeth,
                            m.hoses, m.batteryCableBeltHosesFilterGuards, m.backupAlarm,
                            m.fireExtinguisher, m.gauges, m.horn, m.spillKit, m.glass,
                            m.mirror, m.rollOverProtection, m.seatBeltSeat, m.allFluidsLevel
                          ].some(v => v === 'Repair');

                          // Get repair/note items for summary
                          const repairFields = [
                            { key: 'stepsHandRails', label: 'Steps/Hand Rails' },
                            { key: 'tiresTracks', label: 'Tires/Tracks' },
                            { key: 'bucket', label: 'Bucket' },
                            { key: 'cuttingEdgeTeeth', label: 'Cutting Edge/Teeth' },
                            { key: 'hoses', label: 'Hoses' },
                            { key: 'batteryCableBeltHosesFilterGuards', label: 'Battery Cable, Belt, Hoses, Filter, Guards' },
                            { key: 'backupAlarm', label: 'Backup Alarm' },
                            { key: 'fireExtinguisher', label: 'Fire Extinguisher' },
                            { key: 'gauges', label: 'Gauges' },
                            { key: 'horn', label: 'Horn' },
                            { key: 'spillKit', label: 'Spill Kit' },
                            { key: 'glass', label: 'Glass (all sides)' },
                            { key: 'mirror', label: 'Mirror' },
                            { key: 'rollOverProtection', label: 'Roll Over Protection' },
                            { key: 'seatBeltSeat', label: 'Seat Belt/Seat' },
                            { key: 'allFluidsLevel', label: 'All Fluids Level' },
                          ];
                          const repairItems = repairFields.filter(f => (m as any)[f.key] === 'Repair').map(f => f.label);
                          const noteText = m.notes?.trim() || '';

                          return (
                          <div key={report.id} className={`rounded-lg border ${hasRepairOrNotes ? 'bg-red-50 dark:bg-red-900/20 border-red-400 dark:border-red-700' : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-300 dark:border-yellow-700'}`}>
                            <button
                              type="button"
                              onClick={() => setExpandedReport(expandedReport === report.id ? null : report.id)}
                              className="w-full px-3 py-2 flex items-center justify-between text-left"
                            >
                              <div className="flex-1">
                                <div className="flex items-center space-x-2">
                                  <span className="text-sm font-medium text-yellow-700 dark:text-yellow-300">
                                    {report.equipmentName}
                                  </span>
                                  <span className="text-xs text-yellow-600 dark:text-yellow-400">
                                    by {report.createdBy}
                                  </span>
                                </div>
                                <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                  {new Date(report.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </div>
                                {report.site && (
                                  <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                                    Site: {report.site}
                                  </div>
                                )}
                                {(repairItems.length > 0 || noteText) && (
                                  <div className="text-xs text-red-700 dark:text-red-300 mt-1 italic">
                                    {repairItems.length > 0 && `Repair: ${repairItems.join(', ')}`}
                                    {repairItems.length > 0 && noteText && '; '}
                                    {noteText && `Note: ${noteText}`}
                                  </div>
                                )}
                              </div>
                              {expandedReport === report.id ? (
                                <ChevronUp className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                              ) : (
                                <ChevronDown className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                              )}
                            </button>
                            {expandedReport === report.id && (
                              <div className="px-3 pb-3 pt-0 border-t border-yellow-200 dark:border-yellow-800">
                                <div className="grid grid-cols-2 gap-2 mt-2 text-xs text-gray-700 dark:text-gray-300">
                                  <div><strong>Hours/KM:</strong> {report.maintenance.hours || 'N/A'}</div>
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
                              </div>
                            )}
                          </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Shop Reports */}
                  {shopReports.length > 0 && (siteFilter || userFilter) && (
                    <div>
                      <h4 className="text-base font-semibold text-yellow-700 dark:text-yellow-300 mb-3 flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Shop Reports ({shopReports.length})
                      </h4>
                      <div className="space-y-2">
                        {shopReports.map(report => (
                          <div key={report.id} className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-300 dark:border-yellow-700 p-3">
                            <div className="flex items-center justify-between mb-2">
                              <div>
                                <span className="text-sm font-medium text-yellow-700 dark:text-yellow-300">{report.equipmentName}</span>
                                <span className="text-xs text-yellow-600 dark:text-yellow-400 ml-2">by {report.createdBy}</span>
                              </div>
                              <div className="text-right">
                                <span className="text-xs text-yellow-600 dark:text-yellow-400 block">
                                  {new Date(report.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                                {report.site && (
                                  <span className="text-xs text-blue-600 dark:text-blue-400 block">
                                    Site: {report.site}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs text-gray-700 dark:text-gray-300">
                              <div><strong>Serviced:</strong> {report.lastServicedDate || 'N/A'}</div>
                              <div><strong>Next Service:</strong> {report.lastServiceHours || 'N/A'}</div>
                            </div>
                            {report.notes && (
                              <div className="text-xs text-gray-700 dark:text-gray-300 mt-2">
                                <strong>Notes:</strong> {report.notes}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {maintenanceReports.length === 0 && shopReports.length === 0 && null}
                </>
              )}
            </div>
          )}
          </div>

          {/* Service View Panel */}
          {showServiceView && (
            <div className="bg-yellow-200 dark:bg-black border border-yellow-600 rounded-lg shadow-xl dark:shadow-yellow-900/20 dark:shadow-2xl p-4">
              {serviceLoading ? (
                <p className="text-xs text-yellow-600 dark:text-yellow-400">Loading service data...</p>
              ) : (
                <>
                  {/* Heavy Equipment */}
                  {heavyEquipmentList.length > 0 && (
                    <div className="mb-6">
                      <h3 className="text-base font-semibold text-yellow-700 dark:text-yellow-300 mb-3 border-b border-yellow-400 dark:border-yellow-700 pb-1">Heavy Equipment</h3>
                      <div className="space-y-3">
                        {heavyEquipmentList.map(eq => (
                          <div key={eq.id} className="flex items-center space-x-2">
                            <div className="text-sm font-medium text-gray-800 dark:text-yellow-100 self-center">{eq.name}</div>
                            <div className="w-1/2">
                              <ServiceIntervalBar
                                currentHours={equipmentServiceData[eq.id]?.currentHours || 0}
                                nextServiceAt={equipmentServiceData[eq.id]?.nextServiceAt || 0}
                                serviceInterval={eq.serviceInterval || 0}
                                serviceNotification={eq.serviceNotification || 0}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* Fleet */}
                  {fleetEquipmentList.length > 0 && (
                    <div>
                      <h3 className="text-base font-semibold text-yellow-700 dark:text-yellow-300 mb-3 border-b border-yellow-400 dark:border-yellow-700 pb-1">Fleet</h3>
                      <div className="space-y-3">
                        {fleetEquipmentList.map(eq => (
                          <div key={eq.id} className="flex items-center space-x-2">
                            <div className="text-sm font-medium text-gray-800 dark:text-yellow-100 self-center">{eq.name}</div>
                            <div className="w-1/2">
                              <ServiceIntervalBar
                                currentHours={equipmentServiceData[eq.id]?.currentHours || 0}
                                nextServiceAt={equipmentServiceData[eq.id]?.nextServiceAt || 0}
                                serviceInterval={eq.serviceInterval || 0}
                                serviceNotification={eq.serviceNotification || 0}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {heavyEquipmentList.length === 0 && fleetEquipmentList.length === 0 && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">No equipment with service intervals configured.</p>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
