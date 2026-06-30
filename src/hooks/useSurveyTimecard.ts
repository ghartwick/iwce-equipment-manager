import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import { surveyTimecardService, SurveyTimeEntry } from '../services/surveyTimecardService';

export const useSurveyTimecard = () => {
  const { user } = useAuth();
  const [entries, setEntries] = useState<SurveyTimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEntries = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      let data: SurveyTimeEntry[] = [];
      if (user.role === 'admin') {
        data = await surveyTimecardService.getAllEntries();
      } else if (user.role === 'supervisor') {
        data = await surveyTimecardService.getSupervisorEntries(user.id);
      } else {
        data = await surveyTimecardService.getUserEntries(user.id);
      }
      setEntries(data);
    } catch (err) {
      console.error('Failed to fetch survey entries', err);
      setError('Failed to fetch survey time entries');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const deleteEntry = async (id: string) => {
    try {
      await surveyTimecardService.deleteEntry(id);
      setEntries(prev => prev.filter(e => e.id !== id));
    } catch (err) {
      setError('Failed to delete survey time entry');
      throw err;
    }
  };

  const submitEntry = async (id: string, userId?: string) => {
    try {
      await surveyTimecardService.submitEntry(id, userId);
      setEntries(prev =>
        prev.map(e =>
          e.id === id
            ? { ...e, status: 'submitted', isLocked: true, submittedAt: new Date(), submittedBy: userId || e.userId }
            : e
        )
      );
    } catch (err) {
      setError('Failed to submit survey time entry');
      throw err;
    }
  };

  const getEntriesForDate = (date: Date) =>
    entries.filter(entry => {
      const d = entry.date instanceof Date ? entry.date : new Date(entry.date);
      if (isNaN(d.getTime())) return false;
      return d.getFullYear() === date.getFullYear() &&
        d.getMonth() === date.getMonth() &&
        d.getDate() === date.getDate();
    });

  return {
    entries,
    loading,
    error,
    refresh: fetchEntries,
    deleteEntry,
    submitEntry,
    getEntriesForDate,
    canEditEntry: surveyTimecardService.canEditEntry,
    canViewEntry: surveyTimecardService.canViewEntry,
    canSeeEntry: surveyTimecardService.canSeeEntry,
    entryTotalCost: surveyTimecardService.entryTotalCost.bind(surveyTimecardService),
  };
};
