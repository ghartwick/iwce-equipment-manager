import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useTimecard } from '../hooks/useTimecard';
import { TimeEntryForm } from '../components/TimeEntryForm';
import { UserManagementService, AppUser } from '../services/userManagementService';
import { timecardService, TimeEntry } from '../services/timecardService';

export default function TimecardEditPage() {
  const { entryId } = useParams<{ entryId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { canEditEntry, updateTimeEntry } = useTimecard();

  const [entry, setEntry] = useState<TimeEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [userManagementService] = useState(() => new UserManagementService());

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      try {
        setLoading(true);
        
        // Load users
        const allUsers = await userManagementService.getAllUsers();
        setUsers(allUsers);
        
        // Only load entry if we're editing (not creating new)
        if (entryId && entryId !== 'new') {
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
        }
      } catch (err) {
        console.error('Failed to load data', err);
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
    if (!user) return;
    try {
      if (entryId === 'new') {
        // Create new entry
        await timecardService.createTimeEntry(entryData as Omit<TimeEntry, 'id' | 'createdAt' | 'updatedAt'>);
      } else {
        // Update existing entry
        if (!entry) return;
        // Preserve certain fields if supervisor editing
        const filteredPreservedFields = user.role === 'supervisor' && entry.userId !== user.id
          ? {}
          : {};
        await updateTimeEntry(entry.id!, { ...entryData, ...filteredPreservedFields });
      }
      navigate('/timecard');
    } catch (err: any) {
      throw err;
    }
  };

  const handleCancel = () => {
    navigate('/timecard');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f0e0c8] dark:bg-black flex items-center justify-center">
        <div className="text-yellow-600 dark:text-yellow-400">Loading...</div>
      </div>
    );
  }

  if (!entry && entryId !== 'new') {
    return (
      <div className="min-h-screen bg-[#f0e0c8] dark:bg-black flex items-center justify-center">
        <div className="text-red-500">Time card not found.</div>
      </div>
    );
  }

  const entryDate = entry?.date instanceof Date
    ? entry.date
    : entry?.date && 'toDate' in (entry.date as any)
      ? (entry.date as any).toDate()
      : searchParams.get('date') 
        ? (() => {
            const dateStr = searchParams.get('date')!;
            const [year, month, day] = dateStr.split('-').map(Number);
            // Create date in local timezone at noon to avoid timezone issues
            return new Date(year, month - 1, day, 12, 0, 0);
          })()
        : new Date();

  const ownerName = entry ? getBestDisplayName(users.find(u => u.id === entry.userId)) : user?.name || '';

  return (
    <div className="min-h-screen bg-[#f0e0c8] dark:bg-black text-gray-900 dark:text-yellow-100 px-2 sm:px-4 py-4 -mx-2 sm:-mx-4 lg:mx-0 lg:p-4">
      <div className="max-w-5xl mx-auto">
        <TimeEntryForm
          selectedDate={entryDate}
          entry={entry || undefined}
          user={user!}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          canEdit={entry ? canEditEntry(entry, user!) : true}
          entryOwnerName={ownerName}
          selectedEntryId={entry?.id || null}
          showCancelButton={true}
        />
      </div>
    </div>
  );
}
