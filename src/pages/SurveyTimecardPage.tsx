import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Plus, Edit2, Trash2, Check } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useSurveyTimecard } from '../hooks/useSurveyTimecard';
import { UserManagementService, AppUser } from '../services/userManagementService';
import { TimecardModeToggle } from '../components/TimecardModeToggle';
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
    loading,
    getEntriesForDate,
    deleteEntry,
    submitEntry,
    canEditEntry,
    canSeeEntry,
    entryTotalCost,
    refresh,
  } = useSurveyTimecard();

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [clientFilter, setClientFilter] = useState('');
  const [surveyorFilter, setSurveyorFilter] = useState('');

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
      .filter(e => !surveyorFilter || e.userId === surveyorFilter);
  };

  const selectedEntries = selectedDate ? visibleEntriesForDate(selectedDate) : [];
  const selectedDateParam = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : null;

  const clientOptions = useMemo(() => {
    if (!selectedDate || !user) return [];
    const names = getEntriesForDate(selectedDate)
      .filter(e => canSeeEntry(e, user, supervisorUserIds))
      .map(e => e.clientName)
      .filter(Boolean);
    return [...new Set(names)].sort();
  }, [selectedDate, user, supervisorUserIds, clientFilter, surveyorFilter]);

  const surveyorOptions = useMemo(() => {
    if (!selectedDate || !user) return [] as AppUser[];
    const ids = [...new Set(getEntriesForDate(selectedDate)
      .filter(e => canSeeEntry(e, user, supervisorUserIds))
      .map(e => e.userId))];
    return ids.map(id => users.find(u => u.id === id)).filter(Boolean) as AppUser[];
  }, [selectedDate, user, users, supervisorUserIds]);

  const handleDateClick = (day: Date) => {
    setClientFilter('');
    setSurveyorFilter('');
    setSelectedDate(prev => (prev && isSameDay(prev, day) ? null : day));
  };

  const handleAdd = () => {
    if (!selectedDateParam) return;
    navigate(`/survey-timecard/edit/new?date=${selectedDateParam}`);
  };

  const handleEdit = (id?: string) => {
    if (id) navigate(`/survey-timecard/edit/${id}`);
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

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      draft: 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
      submitted: 'bg-green-100 dark:bg-green-900 dark:bg-opacity-30 text-green-700 dark:text-green-400',
      rejected: 'bg-red-100 dark:bg-red-900 dark:bg-opacity-30 text-red-700 dark:text-red-400',
    };
    return map[status] || map.draft;
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
              const isSelected = selectedDate && isSameDay(day, selectedDate);
              const isTodayDate = isToday(day);
              const count = user ? getEntriesForDate(day).filter(e => canSeeEntry(e, user, supervisorUserIds)).length : 0;
              return (
                <button
                  key={index}
                  onClick={() => handleDateClick(day)}
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
                    {count > 0 && (
                      <div className="absolute -top-1 -right-1 bg-yellow-600 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold">
                        {count}
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
              {selectedDate ? format(selectedDate, 'MMMM d, yyyy') : 'Select a date'}
            </h3>
            <button
              onClick={handleAdd}
              disabled={!selectedDateParam}
              className="px-3 py-1.5 text-sm bg-yellow-600 text-black rounded-lg hover:bg-yellow-500 font-medium transition-colors whitespace-nowrap disabled:opacity-50 flex items-center gap-1"
              title={selectedDateParam ? 'Add Survey Time Card' : 'Select a date to add a survey time card'}
            >
              <Plus className="h-4 w-4" /> Add Survey Time Card
            </button>
          </div>

          <div className="p-4 sm:p-6">
            {/* Filters */}
            {isAdminOrSupervisor && selectedDate && (clientOptions.length > 0 || surveyorOptions.length > 0) && (
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
                  value={surveyorFilter}
                  onChange={(e) => setSurveyorFilter(e.target.value)}
                  className="flex-1 px-3 py-2 bg-yellow-200 dark:bg-black border border-yellow-600 rounded-lg text-gray-900 dark:text-yellow-100 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                >
                  <option value="">All surveyors</option>
                  {surveyorOptions.map(u => (
                    <option key={u.id} value={u.id}>{u.name || u.username}</option>
                  ))}
                </select>
              </div>
            )}

            {loading ? (
              <div className="text-yellow-600 dark:text-yellow-400">Loading...</div>
            ) : !selectedDate ? (
              <div className="text-center py-8 text-yellow-600 dark:text-yellow-500">Select a date on the calendar to view survey time cards.</div>
            ) : selectedEntries.length === 0 ? (
              <div className="text-center py-8 text-yellow-600 dark:text-yellow-500">No survey time cards for this date.</div>
            ) : (
              <div className="space-y-3">
                {selectedEntries.map(entry => {
                  const editable = user ? canEditEntry(entry, user) : false;
                  const isDraft = !entry.status || entry.status === 'draft';
                  return (
                    <div key={entry.id} className="border border-yellow-300 dark:border-yellow-800 rounded-lg p-4 bg-yellow-50 dark:bg-yellow-900 dark:bg-opacity-10">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <div className="font-semibold text-gray-900 dark:text-yellow-100">{entry.clientName} — {entry.site}</div>
                          <div className="text-sm text-yellow-700 dark:text-yellow-400">
                            {entry.roleName} · {entry.hours}h work · {entry.travelHours}h travel
                          </div>
                          {isAdminOrSupervisor && (
                            <div className="text-xs text-yellow-600 dark:text-yellow-500 mt-0.5">Surveyor: {userName(entry.userId)}</div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-1 text-xs rounded-full ${statusBadge(entry.status)}`}>
                            {entry.status || 'draft'}
                          </span>
                          <span className="text-sm font-semibold text-gray-900 dark:text-yellow-100">${entryTotalCost(entry).toFixed(2)}</span>
                        </div>
                      </div>

                      {entry.expenses.length > 0 && (
                        <div className="mt-2 text-xs text-yellow-700 dark:text-yellow-500">
                          Expenses: {entry.expenses.map(e => `${e.name} x${e.quantity}`).join(', ')}
                        </div>
                      )}
                      {entry.notes && (
                        <div className="mt-2 text-sm text-gray-700 dark:text-yellow-300">{entry.notes}</div>
                      )}

                      <div className="mt-3 flex items-center gap-2">
                        <button
                          onClick={() => handleEdit(entry.id)}
                          className="px-3 py-1.5 text-sm bg-yellow-500 text-black rounded-lg hover:bg-yellow-600 transition-colors flex items-center gap-1"
                        >
                          <Edit2 className="h-3.5 w-3.5" /> {editable ? 'Edit' : 'View'}
                        </button>
                        {editable && isDraft && (
                          <button
                            onClick={() => handleSubmit(entry.id, entry.submittedBy || entry.userId)}
                            className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-1"
                          >
                            <Check className="h-3.5 w-3.5" /> Submit
                          </button>
                        )}
                        {editable && (
                          <button
                            onClick={() => handleDelete(entry.id)}
                            className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-1"
                          >
                            <Trash2 className="h-3.5 w-3.5" /> Delete
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
