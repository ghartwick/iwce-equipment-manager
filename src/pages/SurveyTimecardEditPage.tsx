import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { SurveyTimeEntryForm } from '../components/SurveyTimeEntryForm';
import { UserManagementService, AppUser } from '../services/userManagementService';
import { surveyTimecardService, SurveyTimeEntry } from '../services/surveyTimecardService';

export default function SurveyTimecardEditPage() {
  const { entryId } = useParams<{ entryId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();

  const [entry, setEntry] = useState<SurveyTimeEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [duplicateError, setDuplicateError] = useState<string | null>(null);
  const isSubmittingRef = useRef(false);
  const [userManagementService] = useState(() => new UserManagementService());

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      try {
        setLoading(true);
        const allUsers = await userManagementService.getAllUsers();
        setUsers(allUsers);

        if (entryId && entryId !== 'new') {
          let entries: SurveyTimeEntry[] = [];
          if (user.role === 'admin') {
            entries = await surveyTimecardService.getAllEntries();
          } else if (user.role === 'supervisor') {
            entries = await surveyTimecardService.getSupervisorEntries(user.id);
          } else {
            entries = await surveyTimecardService.getUserEntries(user.id);
          }
          setEntry(entries.find(e => e.id === entryId) || null);
        }
      } catch (err) {
        console.error('Failed to load survey time card data', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user, entryId]);

  const handleSubmit = async (entryData: Partial<SurveyTimeEntry> & { isUpdate?: boolean }) => {
    if (!user) return;
    // Prevent double-click / rapid resubmission race conditions
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    try {
      if (entryId === 'new') {
        const targetUserId = entryData.userId || user.id;
        const date = entryData.date as Date;
        const clientId = entryData.clientId as string;
        const site = entryData.site as string;
        if (date && clientId && site) {
          const existing = await surveyTimecardService.findDuplicateEntry(targetUserId, date, clientId, site);
          if (existing) {
            setDuplicateError('A survey time card for this client/site already exists on this date. Redirecting to existing card...');
            setTimeout(() => navigate(`/survey-timecard/edit/${existing.id}`), 1500);
            return;
          }
        }
        const { isUpdate, ...data } = entryData;
        await surveyTimecardService.createEntry({
          ...(data as Omit<SurveyTimeEntry, 'id' | 'createdAt' | 'updatedAt'>),
          isLocked: data.status === 'submitted',
          submittedBy: data.status === 'submitted' ? targetUserId : undefined,
          submittedAt: data.status === 'submitted' ? new Date() : undefined,
        });
      } else {
        if (!entry) return;
        const isSubmitting = entryData.status === 'submitted' && !entryData.isUpdate;
        if (isSubmitting) {
          await surveyTimecardService.submitEntry(entry.id!, entry.submittedBy || entry.userId);
        } else {
          const isEditingOthersCard = entry.userId !== user.id;
          const editedBy = isEditingOthersCard ? user.username : undefined;
          const { isUpdate, ...data } = entryData;
          const preservedFields = isEditingOthersCard
            ? {
                userId: entry.userId,
                status: entry.status,
                isLocked: entry.isLocked,
                submittedAt: entry.submittedAt,
                submittedBy: entry.submittedBy || entry.userId,
              }
            : {};
          await surveyTimecardService.updateEntry(entry.id!, { ...data, ...preservedFields }, editedBy);
        }
      }
      navigate('/timecard?type=survey');
    } catch (err) {
      throw err;
    } finally {
      isSubmittingRef.current = false;
    }
  };

  const handleCancel = () => navigate('/timecard?type=survey');

  if (loading) {
    return (
      <div className="min-h-screen bg-yellow-100 dark:bg-black flex items-center justify-center">
        <div className="text-yellow-600 dark:text-yellow-400">Loading...</div>
      </div>
    );
  }

  if (!entry && entryId !== 'new') {
    return (
      <div className="min-h-screen bg-yellow-100 dark:bg-black flex items-center justify-center">
        <div className="text-red-500">Survey time card not found.</div>
      </div>
    );
  }

  const entryDate = entry?.date instanceof Date
    ? entry.date
    : searchParams.get('date')
      ? (() => {
          const [year, month, day] = searchParams.get('date')!.split('-').map(Number);
          return new Date(year, month - 1, day, 12, 0, 0);
        })()
      : new Date();

  const ownerName = entry
    ? (users.find(u => u.id === entry.userId)?.name || users.find(u => u.id === entry.userId)?.username || '')
    : user?.name || '';

  const canEdit = entry ? surveyTimecardService.canEditEntry(entry, user!) : true;

  return (
    <div className="min-h-screen bg-yellow-100 dark:bg-black text-gray-900 dark:text-yellow-100 px-2 sm:px-4 py-4 -mx-2 sm:-mx-4 lg:mx-0 lg:p-4">
      <div className="max-w-5xl mx-auto">
        {duplicateError && (
          <div className="mb-4 p-3 bg-yellow-100 dark:bg-yellow-900 border border-yellow-500 rounded-lg text-yellow-800 dark:text-yellow-200 text-sm">
            {duplicateError}
          </div>
        )}
        <SurveyTimeEntryForm
          selectedDate={entryDate}
          entry={entry || undefined}
          user={user!}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          canEdit={canEdit}
          entryOwnerName={ownerName}
        />
      </div>
    </div>
  );
}
