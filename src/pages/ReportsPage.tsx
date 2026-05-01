import { useState, useEffect } from 'react';
import { FileText, Wrench } from 'lucide-react';
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
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [lastSelectedDate, setLastSelectedDate] = useState<Date | null>(null);
  const [maintenanceReports, setMaintenanceReports] = useState<MaintenanceReport[]>([]);
  const [shopReports, setShopReports] = useState<ShopReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [reportsForMonth, setReportsForMonth] = useState<Set<string>>(new Set());
  const [siteFilter, setSiteFilter] = useState<string>('');
  const [userFilter, setUserFilter] = useState<string>('');
  const [equipmentData, setEquipmentData] = useState<Record<string, Equipment>>({});
  const [users, setUsers] = useState<AppUser[]>([]);
  const [userManagementService] = useState(() => new UserManagementService());

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

      const reportDates = new Set<string>();

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
        reportDates.add(reportDate);
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
        reportDates.add(reportDate);
      });

      setReportsForMonth(reportDates);
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
                const hasReports = reportsForMonth.has(formatDateKey(day));

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
                      {hasReports && (
                        <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-blue-600" />
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
                <button
                  onClick={() => {
                    setSelectedDates([]);
                    setMaintenanceReports([]);
                    setShopReports([]);
                  }}
                  className="px-3 py-1.5 text-sm bg-yellow-300 dark:bg-yellow-800 text-yellow-900 dark:text-yellow-100 rounded-lg hover:bg-yellow-400 dark:hover:bg-yellow-700 font-medium transition-colors"
                >
                  Clear Selection
                </button>
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
                            {report.maintenance.notes && (
                              <div className="text-xs text-gray-700 dark:text-gray-300">
                                <strong>Notes:</strong> {report.maintenance.notes}
                              </div>
                            )}
                            {report.maintenance.hours && (
                              <div className="text-xs text-gray-700 dark:text-gray-300 mt-1">
                                <strong>Hours:</strong> {report.maintenance.hours}
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
