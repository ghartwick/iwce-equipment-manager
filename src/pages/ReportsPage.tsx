import { useState, useEffect } from 'react';
import { FileText, Wrench, ChevronDown, ChevronUp } from 'lucide-react';
import { maintenanceHistoryFirebaseService, MaintenanceReport } from '../services/maintenanceHistoryFirebaseService';
import { shopHistoryFirebaseService, ShopReport } from '../services/shopHistoryFirebaseService';
import { equipmentManagementService } from '../services/equipmentManagementService';
import { UserManagementService, AppUser } from '../services/userManagementService';
import { Equipment } from '../types';
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
  const [currentMonth, setCurrentMonth] = useState(() => {
    const saved = localStorage.getItem('reportsCurrentMonth');
    return saved ? new Date(saved) : new Date();
  });
  const [selectedDates, setSelectedDates] = useState<Date[]>(() => {
    const saved = localStorage.getItem('reportsSelectedDates');
    return saved ? JSON.parse(saved).map((d: string) => new Date(d)) : [];
  });
  const [lastSelectedDate, setLastSelectedDate] = useState<Date | null>(() => {
    const saved = localStorage.getItem('reportsLastSelectedDate');
    return saved ? new Date(saved) : null;
  });
  const [siteFilter, setSiteFilter] = useState<string>(() => localStorage.getItem('reportsSiteFilter') || '');
  const [userFilter, setUserFilter] = useState<string>(() => localStorage.getItem('reportsUserFilter') || '');
  const [maintenanceReports, setMaintenanceReports] = useState<MaintenanceReport[]>([]);
  const [shopReports, setShopReports] = useState<ShopReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [maintenanceCounts, setMaintenanceCounts] = useState<Record<string, number>>({});
  const [shopCounts, setShopCounts] = useState<Record<string, number>>({});
  const [equipmentData, setEquipmentData] = useState<Record<string, Equipment>>({});
  const [users, setUsers] = useState<AppUser[]>([]);
  const [userManagementService] = useState(() => new UserManagementService());
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [analysisResults, setAnalysisResults] = useState<any>(null);
  const [expandedReport, setExpandedReport] = useState<string | null>(null);

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

      const analysis = {
        totalMaintenanceReports: filteredMaintenance.length,
        totalShopReports: filteredShop.length,
        reportsByUser,
        reportsByEquipment,
        repairItems,
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

    if (nextSelectedDates.length > 0) {
      loadReportsForDate(nextSelectedDates[0]);
    }
  };

  const loadReportsForDate = async (date: Date) => {
    setLoading(true);
    try {
      const [maintenance, shop] = await Promise.all([
        maintenanceHistoryFirebaseService.getAllMaintenanceHistory(),
        shopHistoryFirebaseService.getAllShopHistory()
      ]);

      const dateKey = formatDateKey(date);

      const filteredMaintenance = maintenance.filter(report => {
        const reportDate = format(new Date(report.createdAt), 'yyyy-MM-dd');
        if (reportDate !== dateKey) return false;
        
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
        if (reportDate !== dateKey) return false;
        
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

      // Only set reports if filters are engaged (including 'all'), otherwise clear them
      if (siteFilter || userFilter) {
        setMaintenanceReports(filteredMaintenance);
        setShopReports(filteredShop);
      } else {
        setMaintenanceReports([]);
        setShopReports([]);
      }
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

      maintenance.forEach(report => {
        const equipment = equipmentData[report.equipmentId];
        
        // If siteFilter is 'all', don't filter by site
        if (siteFilter && siteFilter !== '' && siteFilter !== 'all' && equipment?.site !== siteFilter) return;
        
        // If userFilter is 'all', don't filter by user
        if (userFilter && userFilter !== '' && userFilter !== 'all') {
          const selectedUser = users.find(u => u.id === userFilter);
          if (selectedUser && report.createdBy !== selectedUser.username) return;
        }
        
        const reportDate = format(new Date(report.createdAt), 'yyyy-MM-dd');
        maintCounts[reportDate] = (maintCounts[reportDate] || 0) + 1;
      });

      shop.forEach(report => {
        const equipment = equipmentData[report.equipmentId];
        
        // If siteFilter is 'all', don't filter by site
        if (siteFilter && siteFilter !== '' && siteFilter !== 'all' && equipment?.site !== siteFilter) return;
        
        // If userFilter is 'all', don't filter by user
        if (userFilter && userFilter !== '' && userFilter !== 'all') {
          const selectedUser = users.find(u => u.id === userFilter);
          if (selectedUser && report.createdBy !== selectedUser.username) return;
        }
        
        const reportDate = format(new Date(report.createdAt), 'yyyy-MM-dd');
        shopCounts[reportDate] = (shopCounts[reportDate] || 0) + 1;
      });

      setMaintenanceCounts(maintCounts);
      setShopCounts(shopCounts);
    } catch (error) {
      console.error('Error loading reports for month:', error);
    }
  };

  useEffect(() => {
    loadReportsForMonth();
  }, [currentMonth, siteFilter, userFilter]);

  useEffect(() => {
    if (selectedDates.length > 0) {
      loadReportsForDate(selectedDates[0]);
    }
  }, [siteFilter, userFilter]);

  // Save filter state to localStorage
  useEffect(() => {
    localStorage.setItem('reportsSiteFilter', siteFilter);
  }, [siteFilter]);

  useEffect(() => {
    localStorage.setItem('reportsUserFilter', userFilter);
  }, [userFilter]);

  useEffect(() => {
    localStorage.setItem('reportsCurrentMonth', currentMonth.toISOString());
  }, [currentMonth]);

  useEffect(() => {
    localStorage.setItem('reportsSelectedDates', JSON.stringify(selectedDates.map(d => d.toISOString())));
  }, [selectedDates]);

  useEffect(() => {
    if (lastSelectedDate) {
      localStorage.setItem('reportsLastSelectedDate', lastSelectedDate.toISOString());
    } else {
      localStorage.removeItem('reportsLastSelectedDate');
    }
  }, [lastSelectedDate]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [equipment, allUsers] = await Promise.all([
          equipmentManagementService.getAllEquipment(),
          userManagementService.getAllUsers()
        ]);
        
        const equipmentMap: Record<string, Equipment> = {};
        equipment.forEach(eq => {
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

  // Get unique sites from equipment
  const getUniqueSites = () => {
    const sites = new Set<string>();
    Object.values(equipmentData).forEach(eq => {
      if (eq.site) {
        sites.add(eq.site);
      }
    });
    return Array.from(sites).sort();
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
          {/* Calendar */}
          <div className="bg-yellow-200 dark:bg-black border border-yellow-600 rounded-lg shadow-xl dark:shadow-yellow-900/20 dark:shadow-2xl p-2">
            {/* Calendar Header */}
            <div className="flex items-center justify-between mb-6">
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
                        <div className="absolute -top-1 -right-1 bg-blue-600 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold">
                          {shopCount}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Select a Date Message */}
          {selectedDates.length === 0 && (
            <div className="bg-yellow-200 dark:bg-black border border-yellow-600 rounded-lg shadow-xl dark:shadow-yellow-900/20 dark:shadow-2xl p-2">
              <h3 className="text-lg font-semibold text-yellow-700 dark:text-yellow-300 mb-4">Select a Date</h3>
              <p className="text-yellow-700 dark:text-yellow-600">Click on a date in the calendar to view maintenance and shop reports.</p>
            </div>
          )}
          {selectedDates.length > 0 && (
            <div className="bg-yellow-200 dark:bg-black border border-yellow-600 rounded-lg shadow-xl dark:shadow-yellow-900/20 dark:shadow-2xl p-2">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-semibold text-yellow-700 dark:text-yellow-300">
                  Reports for {selectedDateLabel}
                </h3>
                <div className="flex space-x-2">
                  {selectedDates.length >= 1 && (
                    <button
                      onClick={handleGenerateReport}
                      className="px-3 py-1.5 text-sm bg-blue-500 dark:bg-blue-700 text-white rounded-lg hover:bg-blue-600 dark:hover:bg-blue-600 font-medium transition-colors"
                    >
                      Generate Report
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setSelectedDates([]);
                      setMaintenanceReports([]);
                      setShopReports([]);
                      setShowAnalysis(false);
                      setAnalysisResults(null);
                    }}
                    className="px-3 py-1.5 text-sm bg-yellow-300 dark:bg-yellow-800 text-yellow-900 dark:text-yellow-100 rounded-lg hover:bg-yellow-400 dark:hover:bg-yellow-700 font-medium transition-colors"
                  >
                    Clear Selection
                  </button>
                </div>
              </div>

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
                      <div className="text-2xl font-bold text-blue-800 dark:text-blue-300">{analysisResults.uniqueUsers}</div>
                      <div className="text-sm text-blue-600 dark:text-blue-400">Unique Users</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-800 dark:text-blue-300">{analysisResults.uniqueEquipment}</div>
                      <div className="text-sm text-blue-600 dark:text-blue-400">Unique Equipment</div>
                    </div>
                  </div>

                  {Object.keys(analysisResults.repairItems).length > 0 && (
                    <div className="mb-4">
                      <h5 className="font-semibold text-blue-700 dark:text-blue-400 mb-2">Repair Items</h5>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {Object.entries(analysisResults.repairItems).map(([item, count]) => (
                          <div key={item} className="bg-white dark:bg-black rounded px-3 py-2 border border-blue-200 dark:border-blue-800">
                            <div className="text-sm font-medium text-gray-800 dark:text-gray-200">{item}</div>
                            <div className="text-xs text-gray-600 dark:text-gray-400">{String(count)} report(s)</div>
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
                  {maintenanceReports.length > 0 && (
                    <div className="mb-6">
                      <h4 className="text-base font-semibold text-yellow-700 dark:text-yellow-300 mb-3 flex items-center gap-2">
                        <Wrench className="h-4 w-4" />
                        Maintenance Reports ({maintenanceReports.length})
                      </h4>
                      <div className="space-y-2">
                        {maintenanceReports.map(report => (
                          <div key={report.id} className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-300 dark:border-yellow-700">
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
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Shop Reports */}
                  {shopReports.length > 0 && (
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
                              <span className="text-xs text-yellow-600 dark:text-yellow-400">
                                {new Date(report.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-xs text-gray-700 dark:text-gray-300">
                              <div><strong>Serviced:</strong> {report.lastServicedDate || 'N/A'}</div>
                              <div><strong>Hours:</strong> {report.lastServiceHours || 'N/A'}</div>
                              <div><strong>Interval:</strong> {report.serviceInterval || 'N/A'}</div>
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
      </div>
    </div>
  );
}
