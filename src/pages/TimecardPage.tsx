import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronUp, Check } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useTimecard } from '../hooks/useTimecard';
import { UserManagementService, AppUser } from '../services/userManagementService';
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

// Persists selected date/month across navigation to/from edit page
let _savedTimecardState: { selectedDate: string | null; currentMonth: string; siteFilter: string; employeeFilter: string } | null = null;

export default function TimecardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { 
    loading, 
    getEntriesForDate,
    deleteTimeEntry,
    canEditEntry,
    canViewEntry,
    canSeeEntry,
    getStatusColor,
  } = useTimecard();

  const [currentMonth, setCurrentMonth] = useState(() =>
    _savedTimecardState?.currentMonth ? new Date(_savedTimecardState.currentMonth) : new Date()
  );
  const [selectedDate, setSelectedDate] = useState<Date | null>(() =>
    _savedTimecardState?.selectedDate ? new Date(_savedTimecardState.selectedDate) : null
  );

  // Consume saved state once on mount then clear it
  useEffect(() => {
    if (_savedTimecardState) {
      if (_savedTimecardState.selectedDate) setSelectedDate(new Date(_savedTimecardState.selectedDate));
      if (_savedTimecardState.currentMonth) setCurrentMonth(new Date(_savedTimecardState.currentMonth));
      setSiteFilter(_savedTimecardState.siteFilter);
      setEmployeeFilter(_savedTimecardState.employeeFilter);
      _savedTimecardState = null;
    }
  }, []);

  
  // Filter states for admins and supervisors
  const [siteFilter, setSiteFilter] = useState<string>(_savedTimecardState?.siteFilter ?? '');
  const [employeeFilter, setEmployeeFilter] = useState<string>(_savedTimecardState?.employeeFilter ?? '');
  
  // User management
  const [users, setUsers] = useState<AppUser[]>([]);
  const [userManagementService] = useState(() => new UserManagementService());
  
  // Collapsible states
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set());
  
  
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 }); // Monday
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 }); // Sunday

  const days = eachDayOfInterval({ start: startDate, end: endDate });
  const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const handlePreviousMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    // Reset filters when selecting a new date
    setSiteFilter('');
    setEmployeeFilter('');
  };

  // Create a set of supervisor user IDs for filtering
  const supervisorUserIds = new Set(
    users.filter(u => u.role === 'supervisor').map(u => u.id)
  );

  // Load users for admin/supervisor functionality
  useEffect(() => {
    const loadUsers = async () => {
      if (user?.role === 'admin' || user?.role === 'supervisor') {
        try {
          const allUsers = await userManagementService.getAllUsers();
          setUsers(allUsers);
        } catch (error) {
          // Error loading users
        }
      } else if (user) {
        // For field users, add themselves to the users array so their name displays
        const currentUserAsAppUser: AppUser = {
          id: user.id,
          username: user.username,
          role: user.role,
          name: user.name,
          password: '', // Not needed for display
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        setUsers([currentUserAsAppUser]);
      }
    };

    loadUsers();
  }, [user, userManagementService]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f0e0c8] dark:bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-600 dark:border-yellow-400 mx-auto mb-4"></div>
          <div className="text-lg text-yellow-600 dark:text-yellow-400">Loading timecard...</div>
        </div>
      </div>
    );
  }

  // Helper functions
  const getBestDisplayName = (user: AppUser | undefined) => {
    if (!user) return 'Unknown User';
    return user.name || 'Unknown User';
  };

  // Helper function to get display text for status
  const getStatusDisplay = (status: string) => {
    switch (status) {
      case 'draft': return 'Saved';
      case 'submitted': return 'Submitted';
      case 'rejected': return 'Rejected';
            default: return status;
    }
  };

  // Get unique sites from entries for the selected date
  const getUniqueSites = () => {
    if (!selectedDate || !user) return [];
    const allEntries = getEntriesForDate(selectedDate).filter(entry => canSeeEntry(entry, user!, supervisorUserIds));
    
    // For admins/supervisors, show sites from all entries of other users (including drafts)
    if (user?.role === 'admin' || user?.role === 'supervisor') {
      const otherEntries = allEntries.filter(entry => entry.userId !== user?.id);
      const sites = [...new Set(otherEntries.map(entry => entry.job).filter(Boolean))];
      return sites.sort();
    }
    
    // For field users, show sites from all their entries (including drafts)
    const sites = [...new Set(allEntries.map(entry => entry.job).filter(Boolean))];
    return sites.sort();
  };

  // Get unique employees from entries for the selected date
  const getUniqueEmployees = () => {
    if (!selectedDate || !user) return [];
    const allEntries = getEntriesForDate(selectedDate).filter(entry => canSeeEntry(entry, user!, supervisorUserIds));
    
    // For admins/supervisors, only show employees from submitted/approved entries of other users
    if (user?.role === 'admin' || user?.role === 'supervisor') {
      const submittedOtherEntries = allEntries.filter(entry => 
        entry.userId !== user?.id && entry.status === 'submitted'
      );
      const employeeIds = [...new Set(submittedOtherEntries.map(entry => entry.userId).filter(Boolean))];
      return employeeIds.map(id => users.find(u => u.id === id)).filter(Boolean) as AppUser[];
    }
    
    // For field users, show only themselves if they have submitted entries
    const submittedEntries = allEntries.filter(entry => 
      entry.status === 'submitted'
    );
    if (submittedEntries.length === 0) return [];
    
    // Only return the current user for field users
    return user ? [user] : [];
  };

  // Handle entry selection - save page state then navigate to edit page
  const handleEntrySelect = (entryId: string) => {
    _savedTimecardState = {
      selectedDate: selectedDate?.toISOString() ?? null,
      currentMonth: currentMonth.toISOString(),
      siteFilter,
      employeeFilter,
    };
    navigate(`/timecard/edit/${entryId}`);
  };

  // Handle entry deletion
  const handleDeleteEntry = async (entryId: string) => {
    if (window.confirm('Are you sure you want to delete this time entry?')) {
      try {
        await deleteTimeEntry(entryId);
      } catch (error) {
        alert('Error deleting time entry');
      }
    }
  };

  const toggleEntryExpanded = (entryId: string) => {
    setExpandedEntries(prev => {
      const newSet = new Set(prev);
      if (newSet.has(entryId)) {
        newSet.delete(entryId);
      } else {
        newSet.add(entryId);
      }
      return newSet;
    });
  };

  return (
    <div className="min-h-screen bg-[#f0e0c8] dark:bg-black text-gray-900 dark:text-yellow-100 px-2 sm:px-4 py-4 -mx-2 sm:-mx-4 lg:mx-0 lg:p-2">
      <div className="max-w-6xl mx-auto">
        
        <div className="grid grid-cols-1 gap-2">
          {/* Calendar */}
          <div className="bg-[#fffff0] dark:bg-black border border-yellow-600 rounded-lg shadow-xl dark:shadow-yellow-900/20 dark:shadow-2xl p-2">
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
            <div className="grid grid-cols-7 gap-2">
              {days.map((day, index) => {
                const isCurrentMonth = isSameMonth(day, currentMonth);
                const isSelected = selectedDate && isSameDay(day, selectedDate);
                const isTodayDate = isToday(day);

                return (
                  <button
                    key={index}
                    onClick={() => handleDateClick(day)}
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
                      {(() => {
                        const dayEntries = getEntriesForDate(day);
                        const submittedCount = dayEntries.filter(entry => entry.status === 'submitted').length;
                        const draftCount = dayEntries.filter(entry => entry.status === 'draft').length;
                        
                        return (
                          <>
                            {draftCount > 0 && (
                              <div className="absolute -top-1 -left-1 bg-gray-600 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold">
                                {draftCount}
                              </div>
                            )}
                            {submittedCount > 0 && (
                              <div className="absolute -top-1 -right-1 bg-green-600 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold">
                                {submittedCount}
                              </div>
                            )}
                            {dayEntries.length > 0 && (
                              <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 flex gap-1">
                                {dayEntries.slice(0, 3).map((entry, i) => (
                                  <div
                                    key={entry.id || i}
                                    className={`w-1 h-1 rounded-full ${getStatusColor(entry.status)}`}
                                  />
                                ))}
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Time Cards Display */}
          {selectedDate && (
            <div className="bg-[#fffff0] dark:bg-black border border-yellow-600 rounded-lg shadow-xl dark:shadow-yellow-900/20 dark:shadow-2xl p-2">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-6">
                <h3 className="text-lg font-semibold text-yellow-700 dark:text-yellow-300">
                  Time Entries for {format(selectedDate, 'MMM d, yyyy')}
                </h3>
                <button
                  onClick={() => {
                    const dateStr = format(selectedDate, 'yyyy-MM-dd');
                    navigate(`/timecard/edit/new?date=${dateStr}`);
                  }}
                  className="px-3 py-1.5 text-sm bg-yellow-600 text-black rounded-lg hover:bg-yellow-500 font-medium transition-colors whitespace-nowrap"
                >
                  Add Time Card
                </button>
              </div>

              {/* Filters for Admins and Supervisors */}
              {(user?.role === 'admin' || user?.role === 'supervisor') && (
                <div className="mb-6 grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-sm font-medium text-yellow-700 dark:text-yellow-600 mb-2">
                      Site
                    </label>
                    <select
                      value={siteFilter}
                      onChange={(e) => {
                        setSiteFilter(e.target.value);
                        setEmployeeFilter(''); // Reset employee filter when site filter changes
                      }}
                      className="w-full px-3 py-2 bg-[#fffff0] dark:bg-black border border-yellow-400 dark:border-yellow-700 rounded-lg text-gray-900 dark:text-yellow-100 focus:outline-none focus:border-yellow-400"
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
                      Employee
                    </label>
                    <select
                      value={employeeFilter}
                      onChange={(e) => {
                        setEmployeeFilter(e.target.value);
                        setSiteFilter(''); // Reset site filter when employee filter changes
                      }}
                      className="w-full px-3 py-2 bg-[#fffff0] dark:bg-black border border-yellow-400 dark:border-yellow-700 rounded-lg text-gray-900 dark:text-yellow-100 focus:outline-none focus:border-yellow-400"
                    >
                      <option value="">None</option>
                      {user?.role === 'supervisor' && (
                        <option value="self">Your Time Card</option>
                      )}
                      <option value="all">All</option>
                      {getUniqueEmployees().map(employee => (
                        <option key={employee.id} value={employee.id}>
                          {employee.name || employee.username}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Time Cards List */}
              <div className="space-y-4">
                {(() => {
                  const allEntries = getEntriesForDate(selectedDate);
                  
                  const filteredEntries = allEntries.filter(entry => 
                    entry.userId === user?.id || canSeeEntry(entry, user!, supervisorUserIds)
                  );
                  
                  const isAdminOrSupervisor = user?.role === 'admin' || user?.role === 'supervisor';

                  if (filteredEntries.length === 0) {
                    return (
                      <div className="text-center py-8 text-yellow-700 dark:text-yellow-600">
                        No time entries found for this date
                      </div>
                    );
                  }

                  // Separate entries into your cards and other cards
                  const yourEntries = filteredEntries
                    .filter(entry => entry.userId === user?.id)
                    .sort((a, b) => {
                      // Sort by creation time (oldest first) - handle Firestore Timestamp
                      const getTimestamp = (entry: any) => {
                        if (!entry.createdAt) return entry.date?.getTime() || 0;
                        // Check if it's a Firestore Timestamp (has toDate method)
                        if (typeof (entry.createdAt as any).toDate === 'function') {
                          return (entry.createdAt as any).toDate().getTime();
                        }
                        // Handle as regular Date
                        return new Date(entry.createdAt).getTime();
                      };
                      
                      const aTime = getTimestamp(a);
                      const bTime = getTimestamp(b);
                      return aTime - bTime;
                    })
                    .map((entry, index) => ({
                      ...entry,
                      entryNumber: entry.entryNumber || (index + 1) // Use existing or assign sequential number
                    }));
                  
                  const otherEntries = isAdminOrSupervisor ? (() => {
                    // 'self' filter: show supervisor's own entries
                    if (employeeFilter === 'self') {
                      return filteredEntries.filter(entry => entry.userId === user?.id);
                    }

                    // Show all other users' entries for supervisors/admins (including drafts)
                    const otherUsersEntries = filteredEntries.filter(entry => entry.userId !== user?.id);
                    
                    // Check if "all" is explicitly selected for either filter
                    const showAll = (siteFilter === 'all') || (employeeFilter === 'all');
                    
                    // Check if a specific filter is set (not empty and not 'all' and not 'self')
                    const hasSpecificFilter = (siteFilter && siteFilter !== '' && siteFilter !== 'all') || 
                                            (employeeFilter && employeeFilter !== '' && employeeFilter !== 'all' && employeeFilter !== 'self');
                    
                    if (showAll) {
                      // "All" selected - show all other users' entries
                      return otherUsersEntries;
                    }
                    
                    if (!hasSpecificFilter) {
                      // No filters selected - don't show other users' entries
                      return [];
                    }
                    
                    // Apply specific filters
                    let filtered = otherUsersEntries;
                    // Only apply site filter if it's not "all" and not empty
                    if (siteFilter && siteFilter !== 'all' && siteFilter !== '') {
                      filtered = filtered.filter(entry => entry.job === siteFilter);
                    }
                    // Only apply employee filter if it's not "all" and not empty
                    if (employeeFilter && employeeFilter !== 'all' && employeeFilter !== '') {
                      filtered = filtered.filter(entry => entry.userId === employeeFilter);
                    }
                    
                    return filtered;
                  })() : [];

                  const showGrouped = siteFilter === 'all' || employeeFilter === 'all';
                  const siteGroups: { site: string | null; entries: any[] }[] = [];
                  if (showGrouped) {
                    const groupMap: Record<string, any[]> = {};
                    (otherEntries as any[]).forEach((entry: any) => {
                      const site = entry.job || '(No Site)';
                      if (!groupMap[site]) groupMap[site] = [];
                      groupMap[site].push(entry);
                    });
                    Object.keys(groupMap)
                      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
                      .forEach(site => siteGroups.push({ site, entries: groupMap[site] }));
                  } else {
                    siteGroups.push({ site: null, entries: otherEntries });
                  }

                  return (
                    <div>
                      {/* Your Time Cards Section - Field users only */}
                      {user?.role === 'field' && (
                        <div className="border-t border-yellow-200 dark:border-yellow-700 pt-4">
                            <div className="space-y-3">
                              {yourEntries.length > 0 ? (
                                yourEntries.map((entry: any, index: number) => {
                                  const canAccess = canViewEntry(entry, user!);
                                  return (
                                    <div key={entry.id || `your-${index}`}>
                                      <div
                                        className={`bg-yellow-50 dark:bg-yellow-900 dark:bg-opacity-10 border rounded-lg p-3 transition-colors ${
                                          canAccess 
                                            ? 'border-yellow-400 dark:border-yellow-700 hover:border-yellow-600 cursor-pointer' 
                                            : 'border-gray-400 dark:border-gray-600 opacity-75'
                                        }`}
                                        onClick={() => canAccess && handleEntrySelect(entry.id!)}
                                      >
                                        <div className="space-y-2">
                                          <div className="flex justify-between items-start">
                                            <span className="text-gray-900 dark:text-yellow-100 font-medium">
                                              {getBestDisplayName(users.find(u => u.id === entry.userId))}
                                            </span>
                                            <div className="flex items-center gap-2">
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  toggleEntryExpanded(entry.id || `your-${index}`);
                                                }}
                                                className="p-1 text-yellow-600 dark:text-yellow-400 hover:text-yellow-500 dark:hover:text-yellow-300"
                                              >
                                                {expandedEntries.has(entry.id || `your-${index}`) ? (
                                                  <ChevronUp className="w-4 h-4" />
                                                ) : (
                                                  <ChevronDown className="w-4 h-4" />
                                                )}
                                              </button>
                                              <span className={`px-2 py-1 rounded text-xs ${
                                                entry.status === 'draft' ? 'bg-gray-600' :
                                                entry.status === 'submitted' ? 'bg-green-600' :
                                                entry.status === 'rejected' ? 'bg-red-600' :
                                                'bg-blue-600'
                                              } text-white`}>
                                                {entry.status === 'submitted' ? (
                                                  <Check className="w-3 h-3" />
                                                ) : (
                                                  getStatusDisplay(entry.status).charAt(0)
                                                )}
                                              </span>
                                              {canEditEntry(entry, user!) && (
                                                <button
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (entry.id) handleDeleteEntry(entry.id);
                                                  }}
                                                  className="px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-xs font-medium"
                                                >
                                                  Delete
                                                </button>
                                              )}
                                            </div>
                                          </div>
                                          {entry.job && (
                                            <div className="text-gray-900 dark:text-yellow-100">
                                              {entry.job}
                                            </div>
                                          )}
                                          <div className="font-medium text-yellow-700 dark:text-yellow-600">
                                            {entry.hours}
                                          </div>
                                          
                                          {/* Expanded Details */}
                                          {expandedEntries.has(entry.id || `your-${index}`) && (
                                            <div className="mt-3 pt-3 border-t border-yellow-200 dark:border-yellow-700 space-y-2">
                                              {/* Time Details */}
                                              <div className="flex items-center gap-2 text-xs text-yellow-700 dark:text-yellow-600">
                                                {entry.clockIn && (
                                                  <span>
                                                    In: {(() => {
                                                      const date = entry.clockIn instanceof Date ? entry.clockIn : 
                                                        (entry.clockIn && 'toDate' in entry.clockIn && typeof (entry.clockIn as any).toDate === 'function') ? 
                                                          (entry.clockIn as any).toDate() : new Date(entry.clockIn);
                                                      return format(date, 'HH:mm');
                                                    })()}
                                                  </span>
                                                )}
                                                {entry.clockOut && (
                                                  <span>
                                                    Out: {(() => {
                                                      const date = entry.clockOut instanceof Date ? entry.clockOut : 
                                                        (entry.clockOut && 'toDate' in entry.clockOut && typeof (entry.clockOut as any).toDate === 'function') ? 
                                                          (entry.clockOut as any).toDate() : new Date(entry.clockOut);
                                                      return format(date, 'HH:mm');
                                                    })()}
                                                  </span>
                                                )}
                                              </div>
                                              
                                              {/* Work Entries */}
                                              {entry.workEntries && entry.workEntries.length > 0 && (
                                                <div className="space-y-1">
                                                  {entry.workEntries.map((workEntry: any, idx: number) => (
                                                    <div key={idx} className="text-xs bg-yellow-50 dark:bg-yellow-900 dark:bg-opacity-20 p-2 rounded">
                                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                                        <div>
                                                          {(user?.role === 'supervisor' || user?.role === 'admin') && workEntry.code && (
                                                            <div className="font-medium text-yellow-800 dark:text-yellow-300">
                                                              {workEntry.code}
                                                            </div>
                                                          )}
                                                          {workEntry.machineHours && (
                                                            <div className="text-yellow-700 dark:text-yellow-400">
                                                              Machine {workEntry.machineHours}
                                                            </div>
                                                          )}
                                                          {workEntry.labourHours && (
                                                            <div className="text-yellow-700 dark:text-yellow-400">
                                                              Labour {workEntry.labourHours}
                                                            </div>
                                                          )}
                                                          {workEntry.equipment && (
                                                            <div className="text-yellow-700 dark:text-yellow-400">
                                                              Equipment: {workEntry.equipment}
                                                            </div>
                                                          )}
                                                          {workEntry.smallTools && workEntry.smallTools.length > 0 && (
                                                            <div className="text-yellow-700 dark:text-yellow-400">
                                                              Tools: {Array.isArray(workEntry.smallTools) ? workEntry.smallTools.join(', ') : workEntry.smallTools}
                                                            </div>
                                                          )}
                                                        </div>
                                                        {workEntry.notes && (
                                                          <div className="text-yellow-600 dark:text-yellow-500">
                                                            {workEntry.notes}
                                                          </div>
                                                        )}
                                                      </div>
                                                    </div>
                                                  ))}
                                                </div>
                                              )}
                                              
                                              {/* Legacy single entry display */}
                                              {!entry.workEntries && (entry.code || entry.equipment || entry.machineHours || entry.labourHours || entry.notes) && (
                                                <div className="text-xs bg-yellow-50 dark:bg-yellow-900 dark:bg-opacity-20 p-2 rounded">
                                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                                    <div>
                                                      {(user?.role === 'supervisor' || user?.role === 'admin') && entry.code && (
                                                        <div className="font-medium text-yellow-800 dark:text-yellow-300">
                                                          {entry.code}
                                                        </div>
                                                      )}
                                                      {entry.machineHours && (
                                                        <div className="text-yellow-700 dark:text-yellow-400">
                                                          Machine {entry.machineHours}
                                                        </div>
                                                      )}
                                                      {entry.labourHours && (
                                                        <div className="text-yellow-700 dark:text-yellow-400">
                                                          Labour {entry.labourHours}
                                                        </div>
                                                      )}
                                                      {entry.equipment && (
                                                        <div className="text-yellow-700 dark:text-yellow-400">
                                                          Equipment: {entry.equipment}
                                                        </div>
                                                      )}
                                                      {entry.smallTools && (
                                                        <div className="text-yellow-700 dark:text-yellow-400">
                                                          Tools: {Array.isArray(entry.smallTools) ? entry.smallTools.join(', ') : entry.smallTools}
                                                        </div>
                                                      )}
                                                    </div>
                                                    {entry.notes && (
                                                      <div className="text-yellow-600 dark:text-yellow-500">
                                                        {entry.notes}
                                                      </div>
                                                    )}
                                                  </div>
                                                </div>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                        
                                        {!canAccess && (
                                          <div className="text-red-400 text-xs mt-2">
                                            This time card has been submitted and cannot be accessed.
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })
                              ) : (
                                <div className="text-center py-8 text-yellow-700 dark:text-yellow-600">
                                  No time entries found for this date
                                </div>
                              )}
                            </div>
                        </div>
                      )}

                      {/* Other Time Cards Section (Admins/Supervisors only) */}
                      {otherEntries.length > 0 && (
                        <div className="border-t border-yellow-200 dark:border-yellow-700 pt-4 mt-4">
                          <div className="mb-3">
                            <h4 className="text-yellow-700 dark:text-yellow-300 font-semibold text-lg">
                              {(() => {
                                if (siteFilter === 'all' || employeeFilter === 'all') {
                                  return 'All Time Cards';
                                } else if (siteFilter && siteFilter !== 'all' && employeeFilter && employeeFilter !== 'all') {
                                  const employeeName = getBestDisplayName(users.find(u => u.id === employeeFilter));
                                  return `${siteFilter} - ${employeeName}'s Time Cards`;
                                } else if (siteFilter && siteFilter !== 'all') {
                                  return `${siteFilter} Time Cards`;
                                } else if (employeeFilter && employeeFilter !== 'all') {
                                  return `${getBestDisplayName(users.find(u => u.id === employeeFilter))}'s Time Cards`;
                                } else {
                                  return 'Other Time Cards';
                                }
                              })()}
                            </h4>
                          </div>
                          <div className={showGrouped ? 'space-y-4' : 'space-y-3'}>
                              {siteGroups.map(({ site, entries }) => (
                                <div key={site ?? 'ungrouped'}>
                                  {site && (
                                    <h5 className="text-yellow-700 dark:text-yellow-400 font-semibold text-sm mb-2 mt-1 border-b border-yellow-200 dark:border-yellow-800 pb-1">
                                      {site}
                                    </h5>
                                  )}
                                  <div className="space-y-3">
                              {entries.map((entry: any, index: number) => {
                                const canAccess = canViewEntry(entry, user!);
                                return (
                                  <div key={entry.id || `other-${index}`}>
                                    <div
                                      className={`bg-yellow-50 dark:bg-yellow-900 dark:bg-opacity-10 border rounded-lg p-3 transition-colors ${
                                        canAccess 
                                          ? 'border-yellow-400 dark:border-yellow-700 hover:border-yellow-600 cursor-pointer' 
                                          : 'border-gray-400 dark:border-gray-600 opacity-75'
                                      }`}
                                      onClick={() => canAccess && handleEntrySelect(entry.id!)}
                                    >
                                      <div className="space-y-2">
                                        <div className="flex justify-between items-start">
                                          <span className="text-gray-900 dark:text-yellow-100 font-medium">
                                            {getBestDisplayName(users.find(u => u.id === entry.userId))}
                                          </span>
                                          <div className="flex items-center gap-2">
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                toggleEntryExpanded(entry.id || `other-${index}`);
                                              }}
                                              className="p-1 text-yellow-600 dark:text-yellow-400 hover:text-yellow-500 dark:hover:text-yellow-300"
                                            >
                                              {expandedEntries.has(entry.id || `other-${index}`) ? (
                                                <ChevronUp className="w-4 h-4" />
                                              ) : (
                                                <ChevronDown className="w-4 h-4" />
                                              )}
                                            </button>
                                            <span className={`px-2 py-1 rounded text-xs ${
                                              entry.status === 'draft' ? 'bg-gray-600' :
                                              entry.status === 'submitted' ? 'bg-green-600' :
                                              entry.status === 'rejected' ? 'bg-red-600' :
                                              'bg-blue-600'
                                            } text-white`}>
                                              {entry.status === 'submitted' ? (
                                                <Check className="w-3 h-3" />
                                              ) : (
                                                getStatusDisplay(entry.status).charAt(0)
                                              )}
                                            </span>
                                            {canEditEntry(entry, user!) && (
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  if (entry.id) handleDeleteEntry(entry.id);
                                                }}
                                                className="px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-xs font-medium"
                                              >
                                                Delete
                                              </button>
                                            )}
                                          </div>
                                        </div>
                                        {!showGrouped && entry.job && (
                                          <div className="text-gray-900 dark:text-yellow-100">
                                            {entry.job}
                                          </div>
                                        )}
                                        <div className="font-medium text-yellow-700 dark:text-yellow-600">
                                          {entry.hours}
                                        </div>
                                        
                                        {/* Expanded Details */}
                                        {expandedEntries.has(entry.id || `other-${index}`) && (
                                          <div className="mt-3 pt-3 border-t border-yellow-200 dark:border-yellow-700 space-y-2">
                                            {/* Time Details */}
                                            <div className="flex items-center gap-2 text-xs text-yellow-700 dark:text-yellow-600">
                                              {entry.clockIn && (
                                                <span>
                                                  In: {(() => {
                                                    const date = entry.clockIn instanceof Date ? entry.clockIn : 
                                                      (entry.clockIn && 'toDate' in entry.clockIn && typeof (entry.clockIn as any).toDate === 'function') ? 
                                                        (entry.clockIn as any).toDate() : new Date(entry.clockIn);
                                                    return format(date, 'HH:mm');
                                                  })()}
                                                </span>
                                              )}
                                              {entry.clockOut && (
                                                <span>
                                                  Out: {(() => {
                                                    const date = entry.clockOut instanceof Date ? entry.clockOut : 
                                                      (entry.clockOut && 'toDate' in entry.clockOut && typeof (entry.clockOut as any).toDate === 'function') ? 
                                                        (entry.clockOut as any).toDate() : new Date(entry.clockOut);
                                                    return format(date, 'HH:mm');
                                                  })()}
                                                </span>
                                              )}
                                            </div>
                                            
                                            {/* Work Entries */}
                                            {entry.workEntries && entry.workEntries.length > 0 && (
                                              <div className="space-y-1">
                                                {entry.workEntries.map((workEntry: any, idx: number) => (
                                                  <div key={idx} className="text-xs bg-yellow-50 dark:bg-yellow-900 dark:bg-opacity-20 p-2 rounded">
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                                      <div>
                                                        {(user?.role === 'supervisor' || user?.role === 'admin') && workEntry.code && (
                                                          <div className="font-medium text-yellow-800 dark:text-yellow-300">
                                                            {workEntry.code}
                                                          </div>
                                                        )}
                                                        {workEntry.machineHours && (
                                                          <div className="text-yellow-700 dark:text-yellow-400">
                                                            Machine {workEntry.machineHours}
                                                          </div>
                                                        )}
                                                        {workEntry.labourHours && (
                                                          <div className="text-yellow-700 dark:text-yellow-400">
                                                            Labour {workEntry.labourHours}
                                                          </div>
                                                        )}
                                                        {workEntry.equipment && (
                                                          <div className="text-yellow-700 dark:text-yellow-400">
                                                            Equipment: {workEntry.equipment}
                                                          </div>
                                                        )}
                                                        {workEntry.smallTools && workEntry.smallTools.length > 0 && (
                                                          <div className="text-yellow-700 dark:text-yellow-400">
                                                            Tools: {Array.isArray(workEntry.smallTools) ? workEntry.smallTools.join(', ') : workEntry.smallTools}
                                                          </div>
                                                        )}
                                                      </div>
                                                      {workEntry.notes && (
                                                        <div className="text-yellow-600 dark:text-yellow-500">
                                                          {workEntry.notes}
                                                        </div>
                                                      )}
                                                    </div>
                                                  </div>
                                                ))}
                                              </div>
                                            )}
                                            
                                            {/* Legacy single entry display */}
                                            {!entry.workEntries && (entry.code || entry.equipment || entry.machineHours || entry.labourHours || entry.notes) && (
                                              <div className="text-xs bg-yellow-50 dark:bg-yellow-900 dark:bg-opacity-20 p-2 rounded">
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                                  <div>
                                                    {(user?.role === 'supervisor' || user?.role === 'admin') && entry.code && (
                                                      <div className="font-medium text-yellow-800 dark:text-yellow-300">
                                                        {entry.code}
                                                      </div>
                                                    )}
                                                    {entry.machineHours && (
                                                      <div className="text-yellow-700 dark:text-yellow-400">
                                                        Machine {entry.machineHours}
                                                      </div>
                                                    )}
                                                    {entry.labourHours && (
                                                      <div className="text-yellow-700 dark:text-yellow-400">
                                                        Labour {entry.labourHours}
                                                      </div>
                                                    )}
                                                    {entry.equipment && (
                                                      <div className="text-yellow-700 dark:text-yellow-400">
                                                        Equipment: {entry.equipment}
                                                      </div>
                                                    )}
                                                    {entry.smallTools && (
                                                      <div className="text-yellow-700 dark:text-yellow-400">
                                                        Tools: {Array.isArray(entry.smallTools) ? entry.smallTools.join(', ') : entry.smallTools}
                                                      </div>
                                                    )}
                                                  </div>
                                                  {entry.notes && (
                                                    <div className="text-yellow-600 dark:text-yellow-500">
                                                      {entry.notes}
                                                    </div>
                                                  )}
                                                </div>
                                              </div>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                      
                                      {!canAccess && (
                                        <div className="text-red-400 text-xs mt-2">
                                          This time card has been submitted and cannot be accessed.
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                                  </div>
                                </div>
                              ))}
                            </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
          )}


          {!selectedDate && (
            <div className="bg-[#fffff0] dark:bg-black border border-yellow-600 rounded-lg shadow-xl dark:shadow-yellow-900/20 dark:shadow-2xl p-2">
              <h3 className="text-lg font-semibold text-yellow-700 dark:text-yellow-300 mb-4">Select a Date</h3>
              <p className="text-yellow-700 dark:text-yellow-600">Click on a date in the calendar to view or edit time entries.</p>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
