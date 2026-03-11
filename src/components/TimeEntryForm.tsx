import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { TimeEntry, User } from '../services/timecardService';
import { AppUser } from '../services/userManagementService';

interface TimeEntryFormProps {
  selectedDate: Date | null;
  entry: TimeEntry | null;
  supervisors: AppUser[];
  user: User;
  onSubmit: (entryData: Omit<TimeEntry, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onCancel: () => void;
  canEdit: boolean;
}

export function TimeEntryForm({ 
  selectedDate, 
  entry, 
  supervisors, 
  user, 
  onSubmit, 
  onCancel, 
  canEdit 
}: TimeEntryFormProps) {
  const [clockIn, setClockIn] = useState('');
  const [clockOut, setClockOut] = useState('');
  const [notes, setNotes] = useState('');
  const [supervisorId, setSupervisorId] = useState('');
  const [hours, setHours] = useState(0);

  // Generate time options for dropdowns
  const generateTimeOptions = () => {
    const options = [];
    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += 15) {
        const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
        const period = hour < 12 ? 'AM' : 'PM';
        const displayString = `${displayHour}:${minute.toString().padStart(2, '0')} ${period}`;
        options.push({ value: timeString, label: displayString });
      }
    }
    return options;
  };

  useEffect(() => {
    if (entry) {
      setClockIn(format(entry.clockIn, 'HH:mm'));
      setClockOut(format(entry.clockOut, 'HH:mm'));
      setNotes(entry.notes || '');
      setSupervisorId(entry.supervisorId);
      setHours(entry.hours);
    } else if (selectedDate) {
      // Reset form for new entry
      setClockIn('');
      setClockOut('');
      setNotes('');
      setSupervisorId(supervisors[0]?.id || '');
      setHours(0);
    }
  }, [entry, selectedDate, supervisors]);

  useEffect(() => {
    // Calculate hours when clock in/out change
    if (clockIn && clockOut) {
      const [inHours, inMinutes] = clockIn.split(':').map(Number);
      const [outHours, outMinutes] = clockOut.split(':').map(Number);
      
      const inTime = new Date();
      inTime.setHours(inHours, inMinutes, 0, 0);
      
      const outTime = new Date();
      outTime.setHours(outHours, outMinutes, 0, 0);
      
      if (outTime > inTime) {
        const diff = outTime.getTime() - inTime.getTime();
        const calculatedHours = diff / (1000 * 60 * 60);
        setHours(Math.round(calculatedHours * 100) / 100);
      }
    }
  }, [clockIn, clockOut]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedDate || !clockIn || !clockOut || !supervisorId) {
      return;
    }

    const [inHours, inMinutes] = clockIn.split(':').map(Number);
    const [outHours, outMinutes] = clockOut.split(':').map(Number);

    const clockInDate = new Date(selectedDate);
    clockInDate.setHours(inHours, inMinutes, 0, 0);

    const clockOutDate = new Date(selectedDate);
    clockOutDate.setHours(outHours, outMinutes, 0, 0);

    const entryData: Omit<TimeEntry, 'id' | 'createdAt' | 'updatedAt'> = {
      userId: user.id,
      date: selectedDate,
      clockIn: clockInDate,
      clockOut: clockOutDate,
      hours,
      notes,
      supervisorId,
      status: entry?.status || 'draft',
      submittedAt: entry?.submittedAt,
      approvedAt: entry?.approvedAt,
      approvedBy: entry?.approvedBy,
      isLocked: entry?.isLocked || false,
    };

    onSubmit(entryData);
  };

  const isLocked = entry?.isLocked && !canEdit;

  return (
    <div className="bg-black border border-yellow-600 rounded-lg p-6">
      <h3 className="text-lg font-semibold text-yellow-300 mb-4">
        {selectedDate ? format(selectedDate, 'EEEE, MMMM d, yyyy') : 'Select a Date'}
      </h3>

      {entry && (
        <div className="mb-4">
          <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
            entry.status === 'draft' ? 'bg-gray-600' :
            entry.status === 'submitted' ? 'bg-yellow-600' :
            entry.status === 'approved' ? 'bg-green-600' :
            'bg-red-600'
          } text-white`}>
            {entry.status === 'draft' ? 'Draft' :
             entry.status === 'submitted' ? 'Submitted' :
             entry.status === 'approved' ? 'Approved' :
             'Rejected'}
          </span>
          {entry.isLocked && (
            <span className="ml-2 text-xs text-yellow-600">
              {entry.status === 'approved' ? 'Approved - Locked' : 'Submitted - Locked'}
            </span>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Clock In and Clock Out - Side by Side */}
        <div>
          <label className="block text-sm font-medium text-yellow-600 mb-1">
            Work Hours
          </label>
          <div className="grid grid-cols-2 gap-4">
            {/* Clock In */}
            <div>
              <label className="block text-xs font-medium text-yellow-600 mb-1">
                Clock In
              </label>
              <select
                value={clockIn}
                onChange={(e) => setClockIn(e.target.value)}
                disabled={isLocked}
                className="w-full px-3 py-2 bg-black border border-yellow-800 rounded-lg text-yellow-100 focus:outline-none focus:border-yellow-400 disabled:opacity-50"
                required
              >
                <option value="">Select time</option>
                {generateTimeOptions().map(time => (
                  <option key={time.value} value={time.value}>
                    {time.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Clock Out */}
            <div>
              <label className="block text-xs font-medium text-yellow-600 mb-1">
                Clock Out
              </label>
              <select
                value={clockOut}
                onChange={(e) => setClockOut(e.target.value)}
                disabled={isLocked}
                className="w-full px-3 py-2 bg-black border border-yellow-800 rounded-lg text-yellow-100 focus:outline-none focus:border-yellow-400 disabled:opacity-50"
                required
              >
                <option value="">Select time</option>
                {generateTimeOptions().map(time => (
                  <option key={time.value} value={time.value}>
                    {time.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Hours (Calculated) */}
        <div>
          <label className="block text-sm font-medium text-yellow-600 mb-1">
            Hours (Calculated)
          </label>
          <input
            type="number"
            value={hours}
            readOnly
            className="w-full px-3 py-2 bg-yellow-900 bg-opacity-20 border border-yellow-800 rounded-lg text-yellow-100"
            step="0.01"
          />
        </div>

        {/* Supervisor Dropdown */}
        <div>
          <label className="block text-sm font-medium text-yellow-600 mb-1">
            Submit to Supervisor
          </label>
          <select
            value={supervisorId}
            onChange={(e) => setSupervisorId(e.target.value)}
            disabled={isLocked}
            className="w-full px-3 py-2 bg-black border border-yellow-800 rounded-lg text-yellow-100 focus:outline-none focus:border-yellow-400 disabled:opacity-50"
            required
          >
            <option value="">Select Supervisor</option>
            {supervisors.map(supervisor => (
              <option key={supervisor.id} value={supervisor.id}>
                {supervisor.name}
              </option>
            ))}
          </select>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-yellow-600 mb-1">
            Notes (Optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={isLocked}
            rows={3}
            className="w-full px-3 py-2 bg-black border border-yellow-800 rounded-lg text-yellow-100 focus:outline-none focus:border-yellow-400 disabled:opacity-50 resize-none"
            placeholder="Add any notes about this time entry..."
          />
        </div>

        {/* Action Buttons */}
        <div className="flex space-x-3">
          {canEdit && !isLocked && (
            <>
              <button
                type="submit"
                className="flex-1 p-2 bg-yellow-500 text-black rounded-lg hover:bg-yellow-400 transition-colors"
              >
                {entry ? 'Update' : 'Save'} Entry
              </button>
              {entry && entry.status === 'draft' && (
                <button
                  type="button"
                  onClick={() => {/* Handle submit */}}
                  className="flex-1 p-2 bg-yellow-900 bg-opacity-50 text-yellow-300 rounded-lg hover:bg-opacity-70 transition-colors"
                >
                  Submit
                </button>
              )}
            </>
          )}
          
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 p-2 bg-yellow-900 bg-opacity-50 text-yellow-300 rounded-lg hover:bg-opacity-70 transition-colors"
          >
            Close
          </button>
        </div>

        {isLocked && (
          <p className="text-xs text-yellow-600 text-center">
            This entry is locked and cannot be edited.
          </p>
        )}
      </form>
    </div>
  );
}
