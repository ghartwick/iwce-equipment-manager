import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Plus, Check, FileText } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useSurveyTimecard } from '../hooks/useSurveyTimecard';
import { UserManagementService, AppUser } from '../services/userManagementService';
import { TimecardModeToggle } from '../components/TimecardModeToggle';
import { SurveyInvoiceModal } from '../components/SurveyInvoiceModal';
import { InlineSurveyTimecardEdit } from '../components/InlineSurveyTimecardEdit';
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
  isToday,
} from 'date-fns';

export default function SurveyTimecardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    entries,
    loading,
    getEntriesForDate,
    deleteEntry,
    submitEntry,
    updateEntry,
    canEditEntry,
    canSeeEntry,
    entryTotalCost,
    refresh,
  } = useSurveyTimecard();

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [lastSelectedDate, setLastSelectedDate] = useState<Date | null>(null);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [clientFilter, setClientFilter] = useState('');
  const [siteFilter, setSiteFilter] = useState('');
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set());

  const isAdminOrSupervisor = user?.role === 'admin' || user?.role === 'supervisor';

  useEffect(() => {
    const loadUsers = async () => {
      if (!isAdminOrSupervisor) return;
      try {
        const svc = new UserManagementService();
        setUsers(await svc.getAllUsers());
      } catch (err) {
        console.error('Failed to load users', err);
      }
    };
    loadUsers();
  }, [isAdminOrSupervisor]);

  const supervisorUserIds = useMemo(
    () => new Set(users.filter(u => u.role === 'supervisor').map(u => u.id)),
    [users]
  );

  // All entries the current user can see, across every date (for invoicing).
  const invoiceVisibleEntries = useMemo(
    () => (user ? entries.filter(e => canSeeEntry(e, user, supervisorUserIds)) : []),
    [entries, user, supervisorUserIds]
  );

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: startDate, end: endDate });
  const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const visibleEntriesForDate = (date: Date) => {
    if (!user) return [];
    return getEntriesForDate(date)
      .filter(e => canSeeEntry(e, user, supervisorUserIds))
      .filter(e => !clientFilter || e.clientName === clientFilter)
      .filter(e => !siteFilter || e.site === siteFilter);
  };

  const selectedEntries = selectedDates.flatMap(date => visibleEntriesForDate(date));
  const selectedDateLabel = selectedDates.length === 1
    ? format(selectedDates[0], 'MMMM d, yyyy')
    : selectedDates.length > 1
      ? `${selectedDates.length} dates selected`
      : 'Select a date';
  const selectedDateParam = selectedDates.length === 1 ? format(selectedDates[0], 'yyyy-MM-dd') : null;

  const clientOptions = useMemo(() => {
    if (!selectedDates.length || !user) return [];
    const names = selectedDates
      .flatMap(date => getEntriesForDate(date))
      .filter(e => canSeeEntry(e, user, supervisorUserIds))
      .map(e => e.clientName)
      .filter(Boolean);
    return [...new Set(names)].sort();
  }, [selectedDates, user, supervisorUserIds]);

  const siteOptions = useMemo(() => {
    if (!selectedDates.length || !user) return [] as string[];
    const names = selectedDates
      .flatMap(date => getEntriesForDate(date))
      .filter(e => canSeeEntry(e, user, supervisorUserIds))
      .map(e => e.site)
      .filter(Boolean);
    return [...new Set(names)].sort();
  }, [selectedDates, user, supervisorUserIds]);

  const handleDateClick = (day: Date, event: React.MouseEvent<HTMLButtonElement>) => {
    const isAdditive = event.ctrlKey || event.metaKey;
    const isRange = event.shiftKey && lastSelectedDate != null;

    let nextSelectedDates: Date[] = [];

    if (isRange && lastSelectedDate) {
      const rangeStart = lastSelectedDate < day ? lastSelectedDate : day;
      const rangeEnd = lastSelectedDate < day ? day : lastSelectedDate;
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
      const alreadySelected = selectedDates.some(selected => isSameDay(selected, day));
      nextSelectedDates = alreadySelected
        ? selectedDates.filter(selected => !isSameDay(selected, day))
        : [...selectedDates, day];
    } else {
      nextSelectedDates = [day];
    }

    setSelectedDates(nextSelectedDates);
    setLastSelectedDate(day);

    if (!isAdditive && !isRange) {
      setClientFilter('');
      setSiteFilter('');
    }
  };

  const handleAdd = () => {
    if (!selectedDateParam) return;
    navigate(`/survey-timecard/edit/new?date=${selectedDateParam}`);
  };

  const handleEdit = (id?: string) => {
    if (id) navigate(`/survey-timecard/edit/${id}`);
  };

  const toggleEntryExpanded = (id: string) => {
    setExpandedEntries(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const getEntryTotalHours = (entry: any): number => {
    if (entry.workEntries && entry.workEntries.length > 0) {
      return entry.workEntries.reduce((s: number, w: any) => s + (w.hours || 0), 0) + (entry.travelHours || 0);
    }
    return (entry.hours || 0) + (entry.travelHours || 0);
  };

  const getStatusChar = (status?: string) => {
    switch (status) {
      case 'submitted': return 'S';
      case 'rejected': return 'R';
      case 'draft':
      default: return 'D';
    }
  };

  const handleDelete = async (id?: string) => {
    if (!id) return;
    if (!window.confirm('Delete this survey time card?')) return;
    await deleteEntry(id);
  };

  const handleSubmit = async (id?: string, submittedBy?: string) => {
    if (!id) return;
    await submitEntry(id, submittedBy);
    await refresh();
  };

  const userName = (id: string) => {
    const u = users.find(x => x.id === id);
    return u?.name || u?.username || (id === user?.id ? user?.name : '') || 'Unknown';
  };

  const statusBadgeBg = (status?: string) => {
    switch (status) {
      case 'submitted': return 'bg-green-600';
      case 'rejected': return 'bg-red-600';
      case 'draft':
      default: return 'bg-gray-600';
    }
  };

  return (
    <div className="min-h-screen bg-yellow-100 dark:bg-black text-gray-900 dark:text-yellow-100 px-2 sm:px-4 py-4 -mx-2 sm:-mx-4 lg:mx-0 lg:p-4">
      <div className="max-w-5xl mx-auto space-y-4">
        {/* Calendar card */}
        <div className="bg-yellow-200 dark:bg-black border border-yellow-600 rounded-lg shadow-xl dark:shadow-yellow-900/20 dark:shadow-2xl p-2">
          {/* Calendar Header */}
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              className="p-2 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-100 dark:hover:bg-yellow-900 dark:hover:bg-opacity-30 rounded-lg transition-colors"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <h2 className="text-xl font-semibold text-yellow-700 dark:text-yellow-300">
              {format(currentMonth, 'MMMM yyyy')}
            </h2>
            <button
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              className="p-2 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-100 dark:hover:bg-yellow-900 dark:hover:bg-opacity-30 rounded-lg transition-colors"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          {/* Field | Survey toggle (admins and surveyors) */}
          {(isAdminOrSupervisor || user?.isSurveyor) && (
            <div className="flex justify-center mb-4">
              <TimecardModeToggle mode="survey" />
            </div>
          )}

          {/* Week day headers */}
          <div className="grid grid-cols-7 gap-2 mb-2">
            {weekDays.map(day => (
              <div key={day} className="text-center text-xs font-medium text-yellow-700 dark:text-yellow-600 py-2">
                {day}
              </div>
            ))}
          </div>

          {/* Days */}
          <div className="grid grid-cols-7 gap-2">
            {days.map((day, index) => {
              const isCurrentMonth = isSameMonth(day, currentMonth);
              const isSelected = selectedDates.some(selected => isSameDay(selected, day));
              const isTodayDate = isToday(day);
              const dayEntries = user
                ? getEntriesForDate(day).filter(e => canSeeEntry(e, user, supervisorUserIds))
                : [];
              const submittedCount = dayEntries.filter(e => e.status === 'submitted').length;
              const draftCount = dayEntries.filter(e => !e.status || e.status === 'draft').length;
              return (
                <button
                  key={index}
                  onClick={(e) => handleDateClick(day, e)}
                  className={`relative p-2 text-sm rounded-lg border transition-all ${
                    isSelected
                      ? 'bg-green-200 dark:bg-green-900 dark:bg-opacity-50 border-green-500'
                      : isTodayDate
                        ? 'border-yellow-500 dark:border-yellow-400'
                        : 'border-yellow-600 dark:border-yellow-800'
                  } ${isCurrentMonth ? 'text-gray-800 dark:text-yellow-100' : 'text-yellow-600 dark:text-yellow-700'} ${!isCurrentMonth ? 'opacity-50' : ''} hover:bg-yellow-100 dark:hover:bg-yellow-900 dark:hover:bg-opacity-30`}
                >
                  <div className="text-center relative">
                    {format(day, 'd')}
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
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected date panel */}
        <div className="bg-yellow-200 dark:bg-black border border-yellow-600 rounded-lg shadow-xl dark:shadow-yellow-900/20 dark:shadow-2xl overflow-hidden">
          <div className="px-4 sm:px-6 py-4 border-b border-yellow-300 dark:border-yellow-700 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <h3 className="text-lg font-semibold text-yellow-700 dark:text-yellow-300">
              {selectedDateLabel}
            </h3>
            <div className="flex items-center gap-2">
              {isAdminOrSupervisor && (
                <button
                  onClick={() => setShowInvoiceModal(true)}
                  className="px-3 py-1.5 text-sm bg-yellow-500 text-black rounded-lg hover:bg-yellow-600 font-medium transition-colors whitespace-nowrap flex items-center gap-1"
                  title="Create or view invoices"
                >
                  <FileText className="h-4 w-4" /> Invoice
                </button>
              )}
              <button
                onClick={handleAdd}
                disabled={!selectedDateParam}
                className="px-3 py-1.5 text-sm bg-yellow-600 text-black rounded-lg hover:bg-yellow-500 font-medium transition-colors whitespace-nowrap disabled:opacity-50 flex items-center gap-1"
                title={selectedDateParam ? 'Add Survey Time Card' : 'Select a date to add a survey time card'}
              >
                <Plus className="h-4 w-4" /> Add Survey Time Card
              </button>
            </div>
          </div>

          <div className="p-4 sm:p-6">
            {/* Filters */}
            {isAdminOrSupervisor && selectedDates.length > 0 && (clientOptions.length > 0 || siteOptions.length > 0) && (
              <div className="flex flex-col sm:flex-row gap-2 mb-4">
                <select
                  value={clientFilter}
                  onChange={(e) => setClientFilter(e.target.value)}
                  className="flex-1 px-3 py-2 bg-yellow-200 dark:bg-black border border-yellow-600 rounded-lg text-gray-900 dark:text-yellow-100 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                >
                  <option value="">All clients</option>
                  {clientOptions.map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
                <select
                  value={siteFilter}
                  onChange={(e) => setSiteFilter(e.target.value)}
                  className="flex-1 px-3 py-2 bg-yellow-200 dark:bg-black border border-yellow-600 rounded-lg text-gray-900 dark:text-yellow-100 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                >
                  <option value="">All sites</option>
                  {siteOptions.map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>
            )}

            {loading ? (
              <div className="text-yellow-600 dark:text-yellow-400">Loading...</div>
            ) : selectedDates.length === 0 ? (
              <div className="text-center py-8 text-yellow-600 dark:text-yellow-500">Select a date on the calendar to view survey time cards.</div>
            ) : selectedEntries.length === 0 ? (
              <div className="text-center py-8 text-yellow-600 dark:text-yellow-500">No survey time cards for this date.</div>
            ) : (
              <div className="space-y-3">
                {(() => {
                  const userDayTotals = selectedEntries.reduce<Record<string, number>>((totals, entry) => {
                    totals[entry.userId] = (totals[entry.userId] || 0) + getEntryTotalHours(entry);
                    return totals;
                  }, {});
                  return selectedEntries.map((entry, index) => {
                    const editable = user ? canEditEntry(entry, user) : false;
                    const isDraft = !entry.status || entry.status === 'draft';
                    const entryKey = entry.id || `entry-${index}`;
                    const isExpanded = expandedEntries.has(entryKey);
                    const worked = entry.workEntries && entry.workEntries.length > 0
                      ? entry.workEntries.reduce((s: number, w: any) => s + (w.hours || 0), 0)
                      : (entry.hours || 0);
                    const travel = entry.travelHours || 0;
                    const total = worked + travel;
                    return (
                      <div key={entryKey}>
                        <div className="bg-yellow-50 dark:bg-yellow-900 dark:bg-opacity-10 border border-yellow-400 dark:border-yellow-700 hover:border-yellow-600 rounded-lg p-3 transition-colors">
                          <div className="space-y-2">
                            <div
                              className="cursor-pointer"
                              onClick={() => handleEdit(entry.id)}
                            >
                              <div className="flex justify-between items-start">
                                <span className="text-gray-900 dark:text-yellow-100 font-medium">
                                  {userName(entry.userId)}
                                  <span className="ml-2 text-sm font-normal text-yellow-700 dark:text-yellow-500">
                                    {userDayTotals[entry.userId]?.toFixed(2) ?? '0.00'} hrs
                                  </span>
                                </span>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={(e) => { e.stopPropagation(); toggleEntryExpanded(entryKey); }}
                                    className="p-1 text-yellow-600 dark:text-yellow-400 hover:text-yellow-500 dark:hover:text-yellow-300"
                                  >
                                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                  </button>
                                  <span className={`px-2 py-1 rounded text-xs ${statusBadgeBg(entry.status)} text-white`}>
                                    {entry.status === 'submitted' ? (
                                      <Check className="w-3 h-3" />
                                    ) : (
                                      getStatusChar(entry.status)
                                    )}
                                  </span>
                                  {editable && isDraft && (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleSubmit(entry.id, entry.submittedBy || entry.userId); }}
                                      className="px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-xs font-medium"
                                    >
                                      Submit
                                    </button>
                                  )}
                                  {editable && (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleDelete(entry.id); }}
                                      className="px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-xs font-medium"
                                    >
                                      Delete
                                    </button>
                                  )}
                                </div>
                              </div>
                              <div className="text-gray-900 dark:text-yellow-100">
                                {entry.clientName} — {entry.site}
                              </div>
                              <div className="font-medium text-yellow-700 dark:text-yellow-600">
                                <span className="text-sm">
                                  {entry.roleName ? `${entry.roleName}: ` : ''}Worked {worked}
                                  {travel > 0 && (<> + Travel {travel}</>)} = Total {total.toFixed(2)}
                                </span>
                                <span className="ml-2 text-sm font-semibold text-gray-900 dark:text-yellow-100">
                                  ${entryTotalCost(entry).toFixed(2)}
                                </span>
                              </div>
                            </div>

                            {isExpanded && user && (
                              editable ? (
                                <InlineSurveyTimecardEdit
                                  entry={entry}
                                  user={{ id: user.id, username: user.username, role: user.role, name: user.name || user.username }}
                                  canEdit={editable}
                                  onSave={updateEntry}
                                />
                              ) : (
                                <div className="pt-2 border-t border-yellow-200 dark:border-yellow-800 space-y-2 text-sm">
                                  {entry.workEntries && entry.workEntries.length > 0 ? (
                                    <div className="space-y-1">
                                      {entry.workEntries.map((w: any, i: number) => (
                                        <div key={i} className="text-yellow-700 dark:text-yellow-400">
                                          <span className="font-medium">{w.roleName || 'Role'}</span>: {w.hours || 0}h @ ${w.roleCostPerHour?.toFixed(2) || '0.00'}/h
                                          {w.notes && <span className="text-gray-700 dark:text-yellow-300"> — {w.notes}</span>}
                                          {w.expenses && w.expenses.length > 0 && (
                                            <div className="ml-3 text-xs text-yellow-600 dark:text-yellow-500">
                                              Expenses: {w.expenses.map((ex: any) => `${ex.name} x${ex.quantity}`).join(', ')}
                                            </div>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <>
                                      {entry.expenses && entry.expenses.length > 0 && (
                                        <div className="text-yellow-700 dark:text-yellow-500">
                                          Expenses: {entry.expenses.map((e: any) => `${e.name} x${e.quantity}`).join(', ')}
                                        </div>
                                      )}
                                      {entry.notes && (
                                        <div className="text-gray-700 dark:text-yellow-300">{entry.notes}</div>
                                      )}
                                    </>
                                  )}
                                </div>
                              )
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            )}
          </div>
        </div>
      </div>

      {user && (
        <SurveyInvoiceModal
          open={showInvoiceModal}
          onClose={() => setShowInvoiceModal(false)}
          visibleEntries={invoiceVisibleEntries}
          user={{ id: user.id, username: user.username, name: user.name || user.username }}
          clientFilter={clientFilter}
          siteFilter={siteFilter}
          entryTotalCost={entryTotalCost}
          onInvoiced={refresh}
        />
      )}
    </div>
  );
}
