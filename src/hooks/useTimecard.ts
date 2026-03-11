import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import { timecardService, TimeEntry } from '../services/timecardService';

export const useTimecard = () => {
  const { user } = useAuth();
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch time entries based on user role
  useEffect(() => {
    const fetchTimeEntries = async () => {
      if (!user) return;

      try {
        setLoading(true);
        let entries: TimeEntry[] = [];

        if (user.role === 'admin') {
          entries = await timecardService.getAllTimeEntries();
        } else if (user.role === 'supervisor') {
          entries = await timecardService.getSupervisorTimeEntries(user.id);
        } else {
          entries = await timecardService.getUserTimeEntries(user.id);
        }

        setTimeEntries(entries);
      } catch (err) {
        setError('Failed to fetch time entries');
        console.error('Error fetching time entries:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchTimeEntries();
  }, [user]);

  // Create new time entry
  const createTimeEntry = async (entryData: Omit<TimeEntry, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (!user) throw new Error('User not authenticated');

    try {
      const id = await timecardService.createTimeEntry(entryData);
      
      // Refresh entries
      const entries = user.role === 'admin' 
        ? await timecardService.getAllTimeEntries()
        : user.role === 'supervisor'
        ? await timecardService.getSupervisorTimeEntries(user.id)
        : await timecardService.getUserTimeEntries(user.id);
      
      setTimeEntries(entries);
      return id;
    } catch (err) {
      setError('Failed to create time entry');
      throw err;
    }
  };

  // Update time entry
  const updateTimeEntry = async (id: string, updates: Partial<TimeEntry>) => {
    try {
      await timecardService.updateTimeEntry(id, updates);
      
      // Update local state
      setTimeEntries(prev => 
        prev.map(entry => 
          entry.id === id ? { ...entry, ...updates, updatedAt: new Date() } : entry
        )
      );
    } catch (err) {
      setError('Failed to update time entry');
      throw err;
    }
  };

  // Delete time entry
  const deleteTimeEntry = async (id: string) => {
    try {
      await timecardService.deleteTimeEntry(id);
      
      // Update local state
      setTimeEntries(prev => prev.filter(entry => entry.id !== id));
    } catch (err) {
      setError('Failed to delete time entry');
      throw err;
    }
  };

  // Submit time entry
  const submitTimeEntry = async (id: string) => {
    try {
      await timecardService.submitTimeEntry(id);
      
      // Update local state
      setTimeEntries(prev => 
        prev.map(entry => 
          entry.id === id 
            ? { ...entry, status: 'submitted', isLocked: true, submittedAt: new Date(), updatedAt: new Date() }
            : entry
        )
      );
    } catch (err) {
      setError('Failed to submit time entry');
      throw err;
    }
  };

  // Approve time entry
  const approveTimeEntry = async (id: string) => {
    if (!user) throw new Error('User not authenticated');

    try {
      await timecardService.approveTimeEntry(id, user.id);
      
      // Update local state
      setTimeEntries(prev => 
        prev.map(entry => 
          entry.id === id 
            ? { ...entry, status: 'approved', isLocked: true, approvedAt: new Date(), approvedBy: user.id, updatedAt: new Date() }
            : entry
        )
      );
    } catch (err) {
      setError('Failed to approve time entry');
      throw err;
    }
  };

  // Reject time entry
  const rejectTimeEntry = async (id: string) => {
    if (!user) throw new Error('User not authenticated');

    try {
      await timecardService.rejectTimeEntry(id, user.id);
      
      // Update local state
      setTimeEntries(prev => 
        prev.map(entry => 
          entry.id === id 
            ? { ...entry, status: 'rejected', isLocked: false, approvedBy: user.id, updatedAt: new Date() }
            : entry
        )
      );
    } catch (err) {
      setError('Failed to reject time entry');
      throw err;
    }
  };

  // Get entries for a specific month
  const getEntriesForMonth = (date: Date) => {
    const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
    const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    
    return timeEntries.filter(entry => {
      const entryDate = new Date(entry.date);
      return entryDate >= monthStart && entryDate <= monthEnd;
    });
  };

  // Get entry for a specific date
  const getEntryForDate = (date: Date) => {
    return timeEntries.find(entry => {
      const entryDate = new Date(entry.date);
      return entryDate.toDateString() === date.toDateString();
    });
  };

  // Calculate monthly statistics
  const getMonthlyStats = (date: Date) => {
    const entries = getEntriesForMonth(date);
    
    const totalHours = entries.reduce((sum, entry) => sum + entry.hours, 0);
    const daysWorked = entries.filter(entry => entry.status === 'approved').length;
    const averageHours = daysWorked > 0 ? totalHours / daysWorked : 0;
    
    return {
      totalHours: Math.round(totalHours * 100) / 100,
      daysWorked,
      averageHours: Math.round(averageHours * 100) / 100,
    };
  };

  return {
    timeEntries,
    loading,
    error,
    createTimeEntry,
    updateTimeEntry,
    deleteTimeEntry,
    submitTimeEntry,
    approveTimeEntry,
    rejectTimeEntry,
    getEntriesForMonth,
    getEntryForDate,
    getMonthlyStats,
    canEditEntry: timecardService.canEditEntry,
    canApproveEntry: timecardService.canApproveEntry,
    getStatusColor: timecardService.getStatusColor,
    getStatusText: timecardService.getStatusText,
    calculateHours: timecardService.calculateHours,
  };
};
