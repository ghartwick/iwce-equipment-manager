import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useTimecard } from '../hooks/useTimecard';
import { useSupervisors } from '../hooks/useSupervisors';
import { TimeEntryForm } from '../components/TimeEntryForm';
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
  const { supervisors, loading: supervisorsLoading } = useSupervisors();
  const { 
    loading, 
    getEntryForDate, 
    getMonthlyStats,
    createTimeEntry,
    updateTimeEntry,
    canEditEntry,
    getStatusColor,
  } = useTimecard();

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showEntryForm, setShowEntryForm] = useState(false);

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
    setShowEntryForm(true);
  };

  const handleEntrySubmit = async (entryData: any) => {
    try {
      const entry = getEntryForDate(entryData.date);
      
      if (entry) {
        await updateTimeEntry(entry.id!, entryData);
      } else {
        await createTimeEntry(entryData);
      }
      
      setShowEntryForm(false);
    } catch (error) {
      console.error('Error saving time entry:', error);
    }
  };

  const monthlyStats = getMonthlyStats(currentMonth);

  if (loading || supervisorsLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-400 mx-auto mb-4"></div>
          <div className="text-lg text-yellow-400">Loading timecard...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-yellow-100 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-yellow-400 mb-2">Timecard</h1>
          <p className="text-yellow-600">Track your work hours and manage timesheets</p>
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
                const timeEntry = getEntryForDate(day);
                const isCurrentMonth = isSameMonth(day, currentMonth);
                const isSelected = selectedDate && isSameDay(day, selectedDate);
                const isTodayDate = isToday(day);

                return (
                  <button
                    key={index}
                    onClick={() => handleDateClick(day)}
                    className={`
                      relative p-2 text-sm rounded-lg border transition-all
                      ${isCurrentMonth ? 'text-yellow-100' : 'text-yellow-700'}
                      ${isTodayDate ? 'border-yellow-400' : 'border-yellow-800'}
                      ${isSelected ? 'bg-yellow-900 bg-opacity-50 border-yellow-400' : 'hover:bg-yellow-900 hover:bg-opacity-30'}
                      ${!isCurrentMonth ? 'opacity-50' : ''}
                    `}
                  >
                    <div className="text-center">
                      {format(day, 'd')}
                    </div>
                    {timeEntry && (
                      <div className={`absolute bottom-1 left-1/2 transform -translate-x-1/2 w-1 h-1 rounded-full ${getStatusColor(timeEntry.status)}`} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Time Entry Form */}
          {showEntryForm && selectedDate && user && (
            <TimeEntryForm
              selectedDate={selectedDate}
              entry={getEntryForDate(selectedDate) || null}
              supervisors={supervisors}
              user={user}
              onSubmit={handleEntrySubmit}
              onCancel={() => setShowEntryForm(false)}
              canEdit={canEditEntry(getEntryForDate(selectedDate) || {} as any, user)}
            />
          )}

          {!showEntryForm && (
            <div className="bg-black border border-yellow-600 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-yellow-300 mb-4">Select a Date</h3>
              <p className="text-yellow-600">Click on a date in the calendar to view or edit time entries.</p>
            </div>
          )}

          {/* Summary Stats */}
          <div className="bg-black border border-yellow-600 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-yellow-300 mb-4">Monthly Summary</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-yellow-600">Total Hours:</span>
                <span className="text-yellow-100 font-medium">{monthlyStats.totalHours}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-yellow-600">Days Worked:</span>
                <span className="text-yellow-100 font-medium">{monthlyStats.daysWorked}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-yellow-600">Average Hours:</span>
                <span className="text-yellow-100 font-medium">{monthlyStats.averageHours}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
