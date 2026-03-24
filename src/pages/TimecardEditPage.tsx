import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useTimecard } from '../hooks/useTimecard';
import { TimeEntryForm } from '../components/TimeEntryForm';
import { UserManagementService, AppUser } from '../services/userManagementService';
import { timecardService, TimeEntry } from '../services/timecardService';

export default function TimecardEditPage() {
  const { entryId } = useParams<{ entryId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const returnState = location.state as { selectedDate?: string; currentMonth?: string } | null;
  const { user } = useAuth();
  const { canEditEntry, updateTimeEntry } = useTimecard();

  const [entry, setEntry] = useState<TimeEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [userManagementService] = useState(() => new UserManagementService());

  useEffect(() => {
    const fetchData = async () => {
      if (!user || !entryId) return;
      try {
        setLoading(true);
        // Load all entries and find the one with matching ID
        let entries: TimeEntry[] = [];
        if (user.role === 'admin') {
          entries = await timecardService.getAllTimeEntries();
        } else if (user.role === 'supervisor') {
          entries = await timecardService.getSupervisorTimeEntries(user.id);
        } else {
          entries = await timecardService.getUserTimeEntries(user.id);
        }
        const found = entries.find(e => e.id === entryId);
        setEntry(found || null);

        // Load users
        const allUsers = await userManagementService.getAllUsers();
        setUsers(allUsers);
      } catch (err) {
        console.error('Failed to load entry', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user, entryId]);

  const getBestDisplayName = (u?: AppUser) => {
    if (!u) return '';
    return u.name || u.username || '';
  };

  const handleSubmit = async (entryData: any) => {
    if (!entry || !entry.id) return;
    try {
      const preservedFields = {
        entryNumber: entry.entryNumber || 1,
        userId: entry.userId,
        createdAt: entry.createdAt,
        status: entryData.status || entry.status,
        submittedAt: entryData.submittedAt || entry.submittedAt,
      };
      const filteredPreservedFields = Object.fromEntries(
        Object.entries(preservedFields).filter(([_, value]) => value !== undefined)
      );
      await updateTimeEntry(entry.id, { ...entryData, ...filteredPreservedFields });
      navigate('/timecard', { state: returnState });
    } catch (err: any) {
      throw err;
    }
  };

  const handleCancel = () => {
    navigate('/timecard', { state: returnState });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f0e0c8] dark:bg-black flex items-center justify-center">
        <div className="text-yellow-600 dark:text-yellow-400">Loading...</div>
      </div>
    );
  }

  if (!entry) {
    return (
      <div className="min-h-screen bg-[#f0e0c8] dark:bg-black flex items-center justify-center">
        <div className="text-red-500">Time card not found.</div>
      </div>
    );
  }

  const entryDate = entry.date instanceof Date
    ? entry.date
    : (entry.date && 'toDate' in (entry.date as any))
      ? (entry.date as any).toDate()
      : new Date(entry.date as any);

  const ownerName = getBestDisplayName(users.find(u => u.id === entry.userId));

  return (
    <div className="min-h-screen bg-[#f0e0c8] dark:bg-black text-gray-900 dark:text-yellow-100 p-4">
      <div className="max-w-4xl mx-auto">
        <TimeEntryForm
          selectedDate={entryDate}
          entry={entry}
          user={user!}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          canEdit={canEditEntry(entry, user!)}
          entryOwnerName={ownerName}
          selectedEntryId={entry.id || null}
          showCancelButton={true}
        />
      </div>
    </div>
  );
}
