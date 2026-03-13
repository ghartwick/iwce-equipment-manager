import { useState, useEffect, useRef } from 'react';
import { ChevronDown, ChevronUp, Check } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useTimecard } from '../hooks/useTimecard';
import { TimeEntryForm } from '../components/TimeEntryForm';
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

export default function TimecardPage() {
  const { user } = useAuth();
  const { 
    loading, 
    getEntriesForDate,
    createTimeEntry,
    updateTimeEntry,
    deleteTimeEntry,
    canEditEntry,
    canViewEntry,
    canSeeEntry,
    getStatusColor,
  } = useTimecard();

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showEntryForm, setShowEntryForm] = useState(false);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0); // Add refresh key
  const formRef = useRef<HTMLDivElement>(null); // Ref for scrolling to form
  
  // Filter states for admins and supervisors
  const [siteFilter, setSiteFilter] = useState<string>('');
  const [employeeFilter, setEmployeeFilter] = useState<string>('');
  
  // User management
  const [users, setUsers] = useState<AppUser[]>([]);
  const [userManagementService] = useState(() => new UserManagementService());
  
  // Collapsible states
  const [yourCardsCollapsed, setYourCardsCollapsed] = useState(false);
  const [otherCardsCollapsed, setOtherCardsCollapsed] = useState(false);

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
    setShowEntryForm(false); // Show time cards first, not the form
  };

  const handleEntrySubmit = async (entryData: any) => {
    try {
      // Check for existing entry on the same date AND site
      const entries = getEntriesForDate(entryData.date);
      const existingEntry = entries.find(entry => entry.job === entryData.job);
      
      if (existingEntry) {
        // Preserve the original entry details when updating
        const preservedFields = {
          entryNumber: existingEntry.entryNumber || 1,
          userId: existingEntry.userId, // Preserve original owner
          createdAt: existingEntry.createdAt, // Preserve creation time
          status: entryData.status || existingEntry.status, // Use new status if provided
          submittedAt: entryData.submittedAt || existingEntry.submittedAt, // Use new submission time if provided
        };

        // Filter out undefined values to prevent Firebase errors
        const filteredPreservedFields = Object.fromEntries(
          Object.entries(preservedFields).filter(([_, value]) => value !== undefined)
        );

        const entryDataWithNumber = {
          ...entryData,
          ...filteredPreservedFields
        };
        await updateTimeEntry(existingEntry.id!, entryDataWithNumber);
      } else {
        // Calculate the next entry number for this date
        const userEntries = entries
          .filter(entry => entry.userId === user?.id)
          .sort((a, b) => {
            const aTime = a.createdAt?.getTime() || a.date?.getTime() || 0;
            const bTime = b.createdAt?.getTime() || b.date?.getTime() || 0;
            return aTime - bTime;
          });
        
        const nextEntryNumber = userEntries.length + 1;
        
        // Add the entry number to the data being saved
        const entryDataWithNumber = {
          ...entryData,
          entryNumber: nextEntryNumber,
          userId: user?.id,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        
        const id = await createTimeEntry(entryDataWithNumber);
        setSelectedEntryId(id);
      }
      
      setRefreshKey(prev => prev + 1);
      setShowEntryForm(false);
    } catch (error) {
      alert('Error saving time entry: ' + (error as Error).message);
    }
  };

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
      }
    };

    loadUsers();
  }, [user, userManagementService]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-400 mx-auto mb-4"></div>
          <div className="text-lg text-yellow-400">Loading timecard...</div>
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
      case 'approved': return 'Submitted'; // Treat approved as submitted
      default: return status;
    }
  };

  // Get unique sites from entries for the selected date
  const getUniqueSites = () => {
    if (!selectedDate || !user) return [];
    const allEntries = getEntriesForDate(selectedDate).filter(entry => canSeeEntry(entry, user!));
    
    // For admins/supervisors, only show sites from submitted/approved entries of other users
    if (user?.role === 'admin' || user?.role === 'supervisor') {
      const submittedOtherEntries = allEntries.filter(entry => 
        entry.userId !== user?.id && (entry.status === 'submitted' || entry.status === 'approved')
      );
      const sites = [...new Set(submittedOtherEntries.map(entry => entry.job).filter(Boolean))];
      return sites.sort();
    }
    
    // For field users, show sites from their submitted/approved entries only
    const submittedEntries = allEntries.filter(entry => 
      entry.status === 'submitted' || entry.status === 'approved'
    );
    const sites = [...new Set(submittedEntries.map(entry => entry.job).filter(Boolean))];
    return sites.sort();
  };

  // Get unique employees from entries for the selected date
  const getUniqueEmployees = () => {
    if (!selectedDate || !user) return [];
    const allEntries = getEntriesForDate(selectedDate).filter(entry => canSeeEntry(entry, user!));
    
    // For admins/supervisors, only show employees from submitted/approved entries of other users
    if (user?.role === 'admin' || user?.role === 'supervisor') {
      const submittedOtherEntries = allEntries.filter(entry => 
        entry.userId !== user?.id && (entry.status === 'submitted' || entry.status === 'approved')
      );
      const employeeIds = [...new Set(submittedOtherEntries.map(entry => entry.userId).filter(Boolean))];
      return employeeIds.map(id => users.find(u => u.id === id)).filter(Boolean) as AppUser[];
    }
    
    // For field users, show only themselves if they have submitted entries
    const submittedEntries = allEntries.filter(entry => 
      entry.status === 'submitted' || entry.status === 'approved'
    );
    if (submittedEntries.length === 0) return [];
    
    // Only return the current user for field users
    return user ? [user] : [];
  };

  // Handle entry selection
  const handleEntrySelect = (entryId: string) => {
    setSelectedEntryId(entryId);
    setShowEntryForm(true); // Show the form when an entry is selected
  };

  // Handle entry deletion
  const handleDeleteEntry = async (entryId: string) => {
    if (window.confirm('Are you sure you want to delete this time entry?')) {
      try {
        await deleteTimeEntry(entryId);
        setSelectedEntryId(null);
      } catch (error) {
        alert('Error deleting time entry');
      }
    }
  };

  // Handle unlocking/locking time entries
  const handleToggleLock = async (entryId: string, currentLocked: boolean) => {
    try {
      await updateTimeEntry(entryId, { isLocked: !currentLocked });
      setRefreshKey(prev => prev + 1);
    } catch (error) {
      alert('Error toggling lock: ' + (error as Error).message);
    }
  };

  return (
    <div className="min-h-screen bg-black text-yellow-100 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-yellow-400 mb-2">Timecard</h1>
        </div>

        <div className="grid grid-cols-1 gap-6">
          {/* Calendar */}
          <div className="bg-black border border-yellow-600 rounded-lg p-6">
            {/* Calendar Header */}
            <div className="flex items-center justify-between mb-6">
              <button
                onClick={handlePreviousMonth}
                className="p-2 text-yellow-400 hover:bg-yellow-900 hover:bg-opacity-30 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h2 className="text-xl font-semibold text-yellow-300">
                {format(currentMonth, 'MMMM yyyy')}
              </h2>
              <button
                onClick={handleNextMonth}
                className="p-2 text-yellow-400 hover:bg-yellow-900 hover:bg-opacity-30 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            {/* Week Days */}
            <div className="grid grid-cols-7 gap-2 mb-2">
              {weekDays.map(day => (
                <div key={day} className="text-center text-xs font-medium text-yellow-600 py-2">
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
                    key={`${index}-${refreshKey}`}
                    onClick={() => handleDateClick(day)}
                    className={`
                      relative p-2 text-sm rounded-lg border transition-all
                      ${isCurrentMonth ? 'text-yellow-100' : 'text-yellow-700'}
                      ${isTodayDate ? 'border-yellow-400' : 'border-yellow-800'}
                      ${isSelected ? 'bg-yellow-900 bg-opacity-50 border-yellow-400' : 'hover:bg-yellow-900 hover:bg-opacity-30'}
                      ${!isCurrentMonth ? 'opacity-50' : ''}
                    `}
                  >
                    <div className="text-center relative">
                      {format(day, 'd')}
                      {(() => {
                        const dayEntries = getEntriesForDate(day);
                        const submittedCount = dayEntries.filter(entry => entry.status === 'submitted' || entry.status === 'approved').length;
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
            <div className="bg-black border border-yellow-600 rounded-lg p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-semibold text-yellow-300">
                  Time Entries for {format(selectedDate, 'MMM d, yyyy')}
                </h3>
                <button
                  onClick={() => {
                    setSelectedEntryId(null);
                    setShowEntryForm(true);
                    // Scroll to form after a short delay to ensure it's rendered
                    setTimeout(() => {
                      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }, 100);
                  }}
                  className="px-4 py-2 bg-yellow-600 text-black rounded-lg hover:bg-yellow-500 font-medium transition-colors"
                >
                  Add Time Card
                </button>
              </div>

              {/* Filters for Admins and Supervisors */}
              {(user?.role === 'admin' || user?.role === 'supervisor') && (
                <div className="mb-6 grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-yellow-600 mb-2">
                      Site
                    </label>
                    <select
                      value={siteFilter}
                      onChange={(e) => setSiteFilter(e.target.value)}
                      className="w-full px-3 py-2 bg-black border border-yellow-700 rounded-lg text-yellow-100 focus:outline-none focus:border-yellow-400"
                    >
                      <option value="">None</option>
                      <option value="all">All</option>
                      {getUniqueSites().map(site => (
                        <option key={site} value={site}>{site}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-yellow-600 mb-2">
                      Employee
                    </label>
                    <select
                      value={employeeFilter}
                      onChange={(e) => setEmployeeFilter(e.target.value)}
                      className="w-full px-3 py-2 bg-black border border-yellow-700 rounded-lg text-yellow-100 focus:outline-none focus:border-yellow-400"
                    >
                      <option value="">None</option>
                      <option value="all">All</option>
                      {getUniqueEmployees().map(employee => (
                        <option key={employee.id} value={employee.id}>
                          {getBestDisplayName(employee)}
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
                  // Force re-render when refreshKey changes
                  void refreshKey;
                  
                  const filteredEntries = allEntries.filter(entry => 
                    entry.userId === user?.id || canSeeEntry(entry, user!)
                  );
                  
                  const isAdminOrSupervisor = user?.role === 'admin' || user?.role === 'supervisor';
                  
                  // Apply filters
                  let entries = filteredEntries;
                  if (isAdminOrSupervisor) {
                    if (siteFilter && siteFilter !== 'all') {
                      entries = entries.filter(entry => entry.job === siteFilter);
                    }
                    if (employeeFilter && employeeFilter !== 'all') {
                      entries = entries.filter(entry => entry.userId === employeeFilter);
                    }
                  }

                  if (entries.length === 0) {
                    return (
                      <div className="text-center py-8 text-yellow-600">
                        No time entries found for this date
                      </div>
                    );
                  }

                  // Separate entries into your cards and other cards
                  const yourEntries = entries
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
                    // Only show other entries if at least one filter is set (not empty)
                    const hasActiveFilter = (siteFilter && siteFilter !== '') || 
                                          (employeeFilter && employeeFilter !== '');
                    if (!hasActiveFilter) return [];
                    
                    // Filter for submitted/approved entries from other users
                    const submittedOtherEntries = entries.filter(entry => 
                      entry.userId !== user?.id && (entry.status === 'submitted' || entry.status === 'approved')
                    );
                    
                    // Apply additional filters
                    let filteredEntries = submittedOtherEntries;
                    // Only apply site filter if it's not "all" and not empty
                    if (siteFilter && siteFilter !== 'all' && siteFilter !== '') {
                      filteredEntries = filteredEntries.filter(entry => entry.job === siteFilter);
                    }
                    // Only apply employee filter if it's not "all" and not empty
                    if (employeeFilter && employeeFilter !== 'all' && employeeFilter !== '') {
                      filteredEntries = filteredEntries.filter(entry => entry.userId === employeeFilter);
                    }
                    
                    return filteredEntries;
                  })() : [];

                  return (
                    <div>
                      {/* Your Time Cards Section - Always visible */}
                      <div>
                        <div 
                          className="flex justify-between items-center cursor-pointer mb-3"
                          onClick={() => setYourCardsCollapsed(!yourCardsCollapsed)}
                        >
                          <h4 className="text-yellow-300 font-semibold text-lg">Your Time Cards</h4>
                          <button className="text-yellow-300 hover:text-yellow-200 transition-colors">
                            {yourCardsCollapsed ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
                          </button>
                        </div>
                        {!yourCardsCollapsed && (
                          <div className="space-y-3">
                            {yourEntries.length > 0 ? (
                              yourEntries.map((entry, index) => {
                                const canAccess = canViewEntry(entry, user!);
                                const isSelected = selectedEntryId === entry.id;
                                return (
                                  <div key={entry.id || `your-${index}`}>
                                    <div
                                      className={`bg-yellow-900 bg-opacity-10 border rounded-lg p-3 transition-colors ${
                                        isSelected 
                                          ? 'border-yellow-400 bg-opacity-30 ring-2 ring-yellow-400 ring-opacity-50' 
                                          : canAccess 
                                            ? 'border-yellow-700 hover:border-yellow-600' 
                                            : 'border-gray-600 opacity-75'
                                      }`}
                                      onClick={() => canAccess && handleEntrySelect(entry.id!)}
                                    >
                                      <div className="flex justify-between items-center">
                                        <div>
                                          <span className="text-yellow-100 font-medium">
                                            Time Card {entry.entryNumber}
                                          </span>
                                          {user?.role === 'field' && (
                                            <span className={`ml-2 px-2 py-1 rounded text-xs ${
                                              entry.status === 'draft' ? 'bg-gray-600' :
                                              entry.status === 'submitted' || entry.status === 'approved' ? 'bg-green-600' :
                                              entry.status === 'rejected' ? 'bg-red-600' :
                                              'bg-blue-600'
                                            } text-white`}>
                                              {(entry.status === 'submitted' || entry.status === 'approved') && (
                                                <Check className="w-3 h-3 inline mr-1" />
                                              )}
                                              {getStatusDisplay(entry.status)}
                                            </span>
                                          )}
                                          {isSelected && (
                                            <span className="ml-2 px-2 py-1 rounded text-xs bg-blue-600 text-white">
                                              Selected
                                            </span>
                                          )}
                                        </div>
                                        <div className="flex gap-2">
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
                                          {(user?.role === 'admin' || user?.role === 'supervisor') && (entry.status === 'submitted' || entry.status === 'approved') && (
                                            <>
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  if (entry.id) handleToggleLock(entry.id, entry.isLocked || false);
                                                }}
                                                className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                                                  (entry.isLocked || false)
                                                    ? 'bg-orange-600 text-white hover:bg-orange-700' 
                                                    : 'bg-gray-600 text-white hover:bg-gray-700'
                                                }`}
                                              >
                                                {entry.isLocked || false ? 'Unlock' : 'Lock'}
                                              </button>
                                            </>
                                          )}
                                        </div>
                                      </div>
                                      <div className="text-yellow-100 text-sm mt-1">
                                        {entry.hours} hours
                                      </div>
                                      {entry.job && (
                                        <div className="text-yellow-600 text-sm mt-1">
                                          Site: {entry.job}
                                        </div>
                                      )}
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
                              <div className="text-center py-8 text-yellow-600">
                                No time entries found for this date
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Other Time Cards Section (Admins/Supervisors only) */}
                      {otherEntries.length > 0 && (
                        <div>
                          <div 
                            className="flex justify-between items-center cursor-pointer mb-3"
                            onClick={() => setOtherCardsCollapsed(!otherCardsCollapsed)}
                          >
                            <h4 className="text-yellow-300 font-semibold text-lg">
                              {(() => {
                                if (siteFilter && siteFilter !== 'all' && employeeFilter && employeeFilter !== 'all') {
                                  // Both filters selected
                                  const employeeName = getBestDisplayName(users.find(u => u.id === employeeFilter));
                                  return `${siteFilter} - ${employeeName}'s Time Cards`;
                                } else if (siteFilter && siteFilter !== 'all') {
                                  // Only site filter selected
                                  return `${siteFilter} Time Cards`;
                                } else if (employeeFilter && employeeFilter !== 'all') {
                                  // Only employee filter selected
                                  return `${getBestDisplayName(users.find(u => u.id === employeeFilter))}'s Time Cards`;
                                } else {
                                  // No filters selected
                                  return 'Other Time Cards';
                                }
                              })()}
                            </h4>
                            <button className="text-yellow-300 hover:text-yellow-200 transition-colors">
                              {otherCardsCollapsed ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
                            </button>
                          </div>
                          {!otherCardsCollapsed && (
                            <div className="space-y-3">
                              {otherEntries.map((entry, index) => {
                                const canAccess = canViewEntry(entry, user!);
                                const isSelected = selectedEntryId === entry.id;
                                const employeeUser = users.find(u => u.id === entry.userId);
                                return (
                                  <div key={entry.id || `other-${index}`}>
                                    <div
                                      className={`bg-yellow-900 bg-opacity-10 border rounded-lg p-3 transition-colors ${
                                        isSelected 
                                          ? 'border-yellow-400 bg-opacity-30 ring-2 ring-yellow-400 ring-opacity-50' 
                                          : canAccess 
                                            ? 'border-yellow-700 hover:border-yellow-600' 
                                            : 'border-gray-600 opacity-75'
                                      }`}
                                      onClick={() => canAccess && handleEntrySelect(entry.id!)}
                                    >
                                      <div className="flex justify-between items-center">
                                        <div>
                                          <span className="text-yellow-100 font-medium">
                                            Time Card {entry.entryNumber}
                                          </span>
                                          {user?.role === 'field' && (
                                            <span className={`ml-2 px-2 py-1 rounded text-xs ${
                                              entry.status === 'draft' ? 'bg-gray-600' :
                                              entry.status === 'submitted' || entry.status === 'approved' ? 'bg-green-600' :
                                              entry.status === 'rejected' ? 'bg-red-600' :
                                              'bg-blue-600'
                                            } text-white`}>
                                              {(entry.status === 'submitted' || entry.status === 'approved') && (
                                                <Check className="w-3 h-3 inline mr-1" />
                                              )}
                                              {getStatusDisplay(entry.status)}
                                            </span>
                                          )}
                                          {isSelected && (
                                            <span className="ml-2 px-2 py-1 rounded text-xs bg-blue-600 text-white">
                                              Selected
                                            </span>
                                          )}
                                        </div>
                                        <div className="flex gap-2">
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
                                          {(user?.role === 'admin' || user?.role === 'supervisor') && (entry.status === 'submitted' || entry.status === 'approved') && (
                                            <>
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  if (entry.id) handleToggleLock(entry.id, entry.isLocked || false);
                                                }}
                                                className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                                                  (entry.isLocked || false)
                                                    ? 'bg-orange-600 text-white hover:bg-orange-700' 
                                                    : 'bg-gray-600 text-white hover:bg-gray-700'
                                                }`}
                                              >
                                                {entry.isLocked || false ? 'Unlock' : 'Lock'}
                                              </button>
                                            </>
                                          )}
                                        </div>
                                      </div>
                                      <div className="text-yellow-100 text-sm mt-1">
                                        {entry.hours} hours
                                      </div>
                                      {entry.job && (
                                        <div className="text-yellow-600 text-sm mt-1">
                                          Site: {entry.job}
                                        </div>
                                      )}
                                      {employeeUser && (
                                        <div className="text-yellow-600 text-sm mt-1">
                                          Employee: {getBestDisplayName(employeeUser)}
                                        </div>
                                      )}
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
                          )}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* Time Entry Form - Appears below the time cards */}
          {showEntryForm && selectedDate && user && (
            <div ref={formRef} className="mt-6">
              <TimeEntryForm
                selectedDate={selectedDate}
                entry={selectedEntryId ? getEntriesForDate(selectedDate).find(e => e.id === selectedEntryId) : undefined}
                user={user}
                onSubmit={handleEntrySubmit}
                onCancel={() => {
                  setShowEntryForm(false);
                  setSelectedEntryId(null);
                }}
                canEdit={true}
              />
            </div>
          )}

          {!showEntryForm && !selectedDate && (
            <div className="bg-black border border-yellow-600 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-yellow-300 mb-4">Select a Date</h3>
              <p className="text-yellow-600">Click on a date in the calendar to view or edit time entries.</p>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
