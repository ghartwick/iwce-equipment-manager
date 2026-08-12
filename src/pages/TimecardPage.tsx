import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronUp, Check, MoreVertical, X } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useTimecard } from '../hooks/useTimecard';
import { InlineTimecardEdit } from '../components/InlineTimecardEdit';
import { TimecardModeToggle } from '../components/TimecardModeToggle';
import { UserManagementService, AppUser } from '../services/userManagementService';
import { codeManagementService } from '../services/codeManagementService';
import { siteManagementService, Site } from '../services/siteManagementService';
import { TimecardAttachment, timecardAttachmentService } from '../services/timecardAttachmentService';
import { PurchaseOrderPanel } from '../components/PurchaseOrderPanel';
import { purchaseOrderService, PurchaseOrder } from '../services/purchaseOrderService';
import { lockedDateService } from '../services/lockedDateService';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
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

// Persists selected date/month across navigation to/from edit page
let _savedTimecardState: { selectedDates: string[]; currentMonth: string; siteFilter: string; employeeFilter: string } | null = null;

export default function TimecardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { 
    loading, 
    getEntriesForDate,
    updateTimeEntry,
    deleteTimeEntry,
    canEditEntry,
    canViewEntry,
    canSeeEntry,
  } = useTimecard();

  const [currentMonth, setCurrentMonth] = useState(() =>
    _savedTimecardState?.currentMonth ? new Date(_savedTimecardState.currentMonth) : new Date()
  );
  const [selectedDates, setSelectedDates] = useState<Date[]>(() =>
    _savedTimecardState?.selectedDates?.length
      ? _savedTimecardState.selectedDates.map(date => new Date(date))
      : []
  );
  const [lastSelectedDate, setLastSelectedDate] = useState<Date | null>(() =>
    _savedTimecardState?.selectedDates?.length
      ? new Date(_savedTimecardState.selectedDates[_savedTimecardState.selectedDates.length - 1])
      : null
  );

  // Consume saved state once on mount then clear it
  useEffect(() => {
    if (_savedTimecardState) {
      if (_savedTimecardState.selectedDates?.length) {
        const restoredDates = _savedTimecardState.selectedDates.map(date => new Date(date));
        setSelectedDates(restoredDates);
        setLastSelectedDate(restoredDates[restoredDates.length - 1] ?? null);
      }
      if (_savedTimecardState.currentMonth) setCurrentMonth(new Date(_savedTimecardState.currentMonth));
      setSiteFilter(_savedTimecardState.siteFilter);
      setEmployeeFilter(_savedTimecardState.employeeFilter);
      _savedTimecardState = null;
    }
  }, []);

  
  // Filter states for admins and supervisors
  const [siteFilter, setSiteFilter] = useState<string>(_savedTimecardState?.siteFilter ?? '');
  const [employeeFilter, setEmployeeFilter] = useState<string>(_savedTimecardState?.employeeFilter ?? '');
  const [showAttachments, setShowAttachments] = useState(false);
  const [attachmentSite, setAttachmentSite] = useState('');
  const [attachmentCode, setAttachmentCode] = useState('');
  const [attachmentFilesWithDesc, setAttachmentFilesWithDesc] = useState<{ file: File; description: string }[]>([]);
  const [attachmentSubmitting, setAttachmentSubmitting] = useState(false);
  const [attachmentsForDate, setAttachmentsForDate] = useState<TimecardAttachment[]>([]);
  const [selectedAttachmentIds, setSelectedAttachmentIds] = useState<Set<string>>(new Set());
  const [sitesData, setSitesData] = useState<Site[]>([]);
  const [codeOptionsState, setCodeOptionsState] = useState<string[]>([]);
  const [monthAttachments, setMonthAttachments] = useState<TimecardAttachment[]>([]);
  const [lockedDates, setLockedDates] = useState<Set<string>>(new Set());
  const [showPOForm, setShowPOForm] = useState(false);
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [monthPOs, setMonthPOs] = useState<PurchaseOrder[]>([]);
  const [posForDate, setPosForDate] = useState<PurchaseOrder[]>([]);
  const [hoveredAttachment, setHoveredAttachment] = useState<TimecardAttachment | null>(null);

  // User management
  const [users, setUsers] = useState<AppUser[]>([]);
  const [userManagementService] = useState(() => new UserManagementService());
  
  // Collapsible states
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set());
  
  
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 }); // Monday
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 }); // Sunday

  const days = eachDayOfInterval({ start: startDate, end: endDate });
  const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const formatDateKey = (date: Date) => format(date, 'yyyy-MM-dd');

  const currentUserId = user?.id ?? '';
  const currentUserDisplay = user?.name ?? user?.username ?? '';
  const isAdmin = user?.role === 'admin';

  const canSeeAttachment = (a: TimecardAttachment) => isAdmin || a.uploadedBy === currentUserId;
  const canSeePO = (po: PurchaseOrder) =>
    isAdmin ||
    (po.submittedById ? po.submittedById === currentUserId : po.submittedBy === currentUserDisplay);

  const handlePreviousMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  const handleDateClick = (date: Date, event: React.MouseEvent<HTMLButtonElement>) => {
    const isAdditive = event.ctrlKey || event.metaKey;
    const isRange = event.shiftKey && lastSelectedDate;

    let nextSelectedDates: Date[] = [];

    if (isRange && lastSelectedDate) {
      const rangeStart = lastSelectedDate < date ? lastSelectedDate : date;
      const rangeEnd = lastSelectedDate < date ? date : lastSelectedDate;
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
      const alreadySelected = selectedDates.some(selected => isSameDay(selected, date));
      nextSelectedDates = alreadySelected
        ? selectedDates.filter(selected => !isSameDay(selected, date))
        : [...selectedDates, date];
    } else {
      nextSelectedDates = [date];
    }

    setSelectedDates(nextSelectedDates);
    setLastSelectedDate(date);
    setShowSummary(false);

    if (!isAdditive && !isRange) {
      // Reset filters when selecting a new date (non-multi-select behavior)
      setSiteFilter('');
      setEmployeeFilter('');
    }
  };

  const getEntryDate = (entry: any): Date | null => {
    try {
      const rawDate = entry?.date;
      const resolved = rawDate && typeof rawDate.toDate === 'function'
        ? rawDate.toDate()
        : rawDate instanceof Date
          ? rawDate
          : new Date(rawDate);
      if (!resolved || isNaN(resolved.getTime())) return null;
      return new Date(resolved.getFullYear(), resolved.getMonth(), resolved.getDate());
    } catch {
      return null;
    }
  };

  const groupEntriesByDate = (entries: any[]) => {
    const groups = new Map<string, { date: Date; entries: any[] }>();
    entries.forEach(entry => {
      const entryDate = getEntryDate(entry);
      if (!entryDate) return;
      const key = format(entryDate, 'yyyy-MM-dd');
      if (!groups.has(key)) {
        groups.set(key, { date: entryDate, entries: [] });
      }
      groups.get(key)!.entries.push(entry);
    });
    return Array.from(groups.values()).sort((a, b) => a.date.getTime() - b.date.getTime());
  };

  // Create a set of supervisor user IDs for filtering
  const supervisorUserIds = new Set(
    users.filter(u => u.role === 'supervisor').map(u => u.id)
  );

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
      } else if (user) {
        // For field users, add themselves to the users array so their name displays
        const currentUserAsAppUser: AppUser = {
          id: user.id,
          username: user.username,
          role: user.role,
          name: user.name,
          password: '', // Not needed for display
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        setUsers([currentUserAsAppUser]);
      }
    };

    loadUsers();
  }, [user, userManagementService]);

  useEffect(() => {
    const loadAttachmentOptions = async () => {
      try {
        const [sites, codes] = await Promise.all([
          siteManagementService.getActiveSites(),
          codeManagementService.getActiveCodes()
        ]);
        setSitesData(sites);
        setCodeOptionsState(codes.map(code => code.name));
      } catch (error) {
        // Error loading attachment options
      }
    };

    loadAttachmentOptions();
  }, []);

  useEffect(() => {
    const loadAttachmentsForMonth = async () => {
      try {
        const attachments = await timecardAttachmentService.getAttachmentsForRange(startDate, endDate);
        setMonthAttachments(attachments.filter(canSeeAttachment));
      } catch (error) {
        // Error loading attachments
      }
    };

    loadAttachmentsForMonth();
  }, [startDate, endDate]);

  useEffect(() => {
    const loadAttachmentsForDate = async () => {
      if (selectedDates.length !== 1) {
        setAttachmentsForDate([]);
        return;
      }
      try {
        const date = selectedDates[0];
        const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        const endOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59);
        const attachments = await timecardAttachmentService.getAttachmentsForRange(startOfDay, endOfDay);
        setAttachmentsForDate(attachments.filter(canSeeAttachment));
      } catch (error) {
        setAttachmentsForDate([]);
      }
    };

    loadAttachmentsForDate();
  }, [selectedDates]);

  useEffect(() => {
    const loadPOCountsForMonth = async () => {
      try {
        const pos = await purchaseOrderService.getPOsForRange(startDate, endDate);
        setMonthPOs(pos.filter(canSeePO));
      } catch {
        // ignore
      }
    };
    loadPOCountsForMonth();
  }, [startDate, endDate]);

  useEffect(() => {
    const loadPOsForDate = async () => {
      if (selectedDates.length !== 1) { setPosForDate([]); return; }
      try {
        const pos = await purchaseOrderService.getPOsForDate(selectedDates[0]);
        setPosForDate(pos.filter(canSeePO));
      } catch {
        setPosForDate([]);
      }
    };
    loadPOsForDate();
  }, [selectedDates]);

  useEffect(() => {
    const loadLockedDates = async () => {
      try {
        const locked = await lockedDateService.getLockedDates(startDate, endDate);
        setLockedDates(locked);
      } catch (error) {
        // Error loading locked dates
      }
    };

    loadLockedDates();
  }, [startDate, endDate]);

  // Must be before any early returns (Rules of Hooks)
  const toDateSafe = (val: any): Date => {
    if (!val) return new Date();
    if (val instanceof Date) return val;
    if (typeof val.toDate === 'function') return val.toDate();
    return new Date(val);
  };

  const filteredAttachmentCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    const filtered = siteFilter && siteFilter !== 'all'
      ? monthAttachments.filter(a => a.site === siteFilter)
      : monthAttachments;
    filtered.forEach(a => {
      const key = formatDateKey(toDateSafe(a.date));
      counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
  }, [monthAttachments, siteFilter]);

  const filteredPOCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    const filtered = siteFilter && siteFilter !== 'all'
      ? monthPOs.filter(po => po.site === siteFilter)
      : monthPOs;
    filtered.forEach(po => {
      const key = formatDateKey(toDateSafe(po.date));
      counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
  }, [monthPOs, siteFilter]);

  if (loading) {
    return (
      <div className="min-h-screen bg-yellow-100 dark:bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-600 dark:border-yellow-400 mx-auto mb-4"></div>
          <div className="text-lg text-yellow-600 dark:text-yellow-400">Loading timecard...</div>
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
      default: return status || 'Draft';
    }
  };

  // Get unique sites from entries for the selected date
  const getUniqueSites = () => {
    if (!selectedDates.length || !user) return [];
    const allEntries = selectedDates
      .flatMap(date => getEntriesForDate(date))
      .filter(entry => canSeeEntry(entry, user!, supervisorUserIds));
    
    // For admins/supervisors, show sites from all entries (including own for admins)
    if (user?.role === 'admin' || user?.role === 'supervisor') {
      // Include all entries for admins, exclude own for supervisors
      const entriesToShow = user?.role === 'admin' ? allEntries : allEntries.filter(entry => entry.userId !== user?.id);
      const sites = [...new Set(entriesToShow.map(entry => entry.job).filter(Boolean))];
      return sites.sort();
    }
    
    // For field users, show sites from all their entries (including drafts)
    const sites = [...new Set(allEntries.map(entry => entry.job).filter(Boolean))];
    return sites.sort();
  };

  // Get unique employees from entries for the selected date
  const getUniqueEmployees = () => {
    if (!selectedDates.length || !user) return [];
    const allEntries = selectedDates
      .flatMap(date => getEntriesForDate(date))
      .filter(entry => canSeeEntry(entry, user!, supervisorUserIds));
    
    // For admins/supervisors, show all employees who have any entry for this date
    if (user?.role === 'admin' || user?.role === 'supervisor') {
      // Include all entries (including current user's for admins)
      const entriesToShow = user?.role === 'admin' ? allEntries : allEntries.filter(entry => entry.userId !== user?.id);
      const employeeIds = [...new Set(entriesToShow.map(entry => entry.userId).filter(Boolean))];
      return employeeIds.map(id => users.find(u => u.id === id)).filter(Boolean) as AppUser[];
    }
    
    // For field users, show only themselves if they have submitted entries
    const submittedEntries = allEntries.filter(entry => 
      entry.status === 'submitted'
    );
    if (submittedEntries.length === 0) return [];
    
    // Only return the current user for field users
    return user ? [user] : [];
  };

  // Build an aggregated day summary from entries visible under the current site filter
  const buildDaySummary = () => {
    if (selectedDates.length !== 1) return null;
    if (!siteFilter || siteFilter === '' || siteFilter === 'all') return null;
    const date = selectedDates[0];
    const entries = getEntriesForDate(date).filter(e => e.job === siteFilter);
    if (!entries.length) return null;

    type UserRow = { name: string; labourH: number; travelH: number; machineH: number; codes: string[]; equipment: string[]; notes: string[] };
    const byUser: Record<string, UserRow> = {};
    const allEquipment = new Set<string>();
    const allCodes = new Set<string>();
    const allNotes: string[] = [];
    let totalLabour = 0, totalTravel = 0, totalMachine = 0;

    for (const entry of entries) {
      const u = users.find(u2 => u2.id === entry.userId);
      const name = u?.name || 'Unknown';
      if (!byUser[entry.userId]) byUser[entry.userId] = { name, labourH: 0, travelH: 0, machineH: 0, codes: [], equipment: [], notes: [] };
      const row = byUser[entry.userId];
      const labH = entry.labourHours ?? entry.hours ?? 0;
      const travH = entry.travelHours ?? 0;
      const machH = entry.machineHours ?? 0;
      row.labourH += labH; row.travelH += travH; row.machineH += machH;
      totalLabour += labH; totalTravel += travH; totalMachine += machH;
      if (entry.code && !row.codes.includes(entry.code)) { row.codes.push(entry.code); allCodes.add(entry.code); }
      if (entry.equipment && !row.equipment.includes(entry.equipment)) { row.equipment.push(entry.equipment); allEquipment.add(entry.equipment); }
      entry.workEntries?.forEach(we => {
        if (we.code && !row.codes.includes(we.code)) { row.codes.push(we.code); allCodes.add(we.code); }
        we.equipmentEntries?.forEach(ee => {
          if (ee.equipment && !row.equipment.includes(ee.equipment)) { row.equipment.push(ee.equipment); allEquipment.add(ee.equipment); }
        });
        if (we.notes?.trim()) allNotes.push(`${name}: ${we.notes.trim()}`);
      });
      // Only use entry-level notes if there are no workEntries (legacy fallback)
      if (!entry.workEntries?.length && entry.notes?.trim()) allNotes.push(`${name}: ${entry.notes.trim()}`);
    }
    return { date, site: siteFilter, byUser, allEquipment, allCodes, allNotes, totalLabour, totalTravel, totalMachine, count: entries.length };
  };

  // Handle entry selection - save page state then navigate to edit page
  const handleEntrySelect = (entryId: string) => {
    if (isDateLocked) {
      alert('This date is locked. You cannot edit time entries on locked dates.');
      return;
    }
    _savedTimecardState = {
      selectedDates: selectedDates.map(date => date.toISOString()),
      currentMonth: currentMonth.toISOString(),
      siteFilter,
      employeeFilter,
    };
    navigate(`/timecard/edit/${entryId}`);
  };

  const selectedEntries = selectedDates.flatMap(date => getEntriesForDate(date));
  const selectedDateLabel = selectedDates.length === 1
    ? format(selectedDates[0], 'MMMM d, yyyy')
    : `${selectedDates.length} dates selected`;
  const selectedDateParam = selectedDates.length === 1
    ? format(selectedDates[0], 'yyyy-MM-dd')
    : null;
  const isMultiDateSelection = selectedDates.length > 1;
  const isDateLocked = selectedDates.length === 1 ? lockedDates.has(formatDateKey(selectedDates[0])) : false;
  const attachmentCodeOptions = (() => {
    if (attachmentSite) {
      const selectedSite = sitesData.find(site => site.name === attachmentSite);
      if (selectedSite?.codes?.length) {
        return selectedSite.codes;
      }
    }
    return codeOptionsState.map(name => ({ name, description: undefined }));
  })();

  // Handle inline edit save
  const handleInlineSave = async (entryId: string, updates: any, editedBy?: string) => {
    if (isDateLocked) {
      alert('This date is locked. You cannot edit time entries on locked dates.');
      return;
    }
    await updateTimeEntry(entryId, updates, editedBy);
  };

  // Handle entry deletion
  const handleDeleteEntry = async (entryId: string) => {
    if (isDateLocked) {
      alert('This date is locked. You cannot delete time entries on locked dates.');
      return;
    }
    if (window.confirm('Are you sure you want to delete this time entry?')) {
      try {
        await deleteTimeEntry(entryId);
      } catch (error) {
        alert('Error deleting time entry');
      }
    }
  };

  const handleAttachmentSubmit = async () => {
    if (!selectedDates.length) {
      alert('Please select a date first.');
      return;
    }
    if (selectedDates.length !== 1) {
      alert('Select a single date to attach a file.');
      return;
    }
    if (!attachmentSite) {
      alert('Please select a site.');
      return;
    }
    if (attachmentFilesWithDesc.length === 0) {
      alert('Please select at least one file.');
      return;
    }
    if (attachmentFilesWithDesc.some(item => !item.description.trim())) {
      alert('Please enter a description for each attachment.');
      return;
    }
    if (!user) {
      alert('User not authenticated.');
      return;
    }

    setAttachmentSubmitting(true);
    try {
      // Upload all files with their individual descriptions
      for (const { file, description } of attachmentFilesWithDesc) {
        await timecardAttachmentService.uploadAttachment({
          date: selectedDates[0],
          site: attachmentSite,
          code: attachmentCode,
          description,
          file,
          uploadedBy: user.id
        });
      }
      
      setAttachmentSite('');
      setAttachmentCode('');
      setAttachmentFilesWithDesc([]);
      setShowAttachments(false);
      // Refresh attachment list for the selected date and update month array
      const date = selectedDates[0];
      const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const endOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59);
      const attachments = await timecardAttachmentService.getAttachmentsForRange(startOfDay, endOfDay);
      const visibleAttachments = attachments.filter(canSeeAttachment);
      setAttachmentsForDate(visibleAttachments);
      setMonthAttachments(prev => [
        ...prev.filter(a => formatDateKey(toDateSafe(a.date)) !== formatDateKey(date)),
        ...visibleAttachments
      ]);
      alert(`${attachmentFilesWithDesc.length} attachment(s) uploaded successfully.`);
    } catch (error) {
      console.error('Error uploading attachment:', error);
      alert('Failed to upload attachment: ' + (error as Error).message);
    } finally {
      setAttachmentSubmitting(false);
    }
  };

  const handleDownloadSelectedAsPdf = async () => {
    const selected = attachmentsForDate.filter(
      a => selectedAttachmentIds.has(a.id!) && a.fileName.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp|bmp)$/i)
    );
    if (selected.length === 0) {
      alert('No image attachments selected.');
      return;
    }

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 10;
    const contentW = pageW - margin * 2;
    const contentH = pageH - margin * 2;

    for (let i = 0; i < selected.length; i++) {
      if (i > 0) doc.addPage();
      const attachment = selected[i];
      const resp = await fetch(attachment.fileUrl);
      const blob = await resp.blob();
      const dataUrl: string = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      const img = new Image();
      await new Promise<void>((resolve) => { img.onload = () => resolve(); img.src = dataUrl; });
      const scale = Math.min(contentW / img.width, contentH / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      const x = margin + (contentW - w) / 2;
      const y = margin + (contentH - h) / 2;
      const fmt = attachment.fileName.toLowerCase().endsWith('.png') ? 'PNG' : 'JPEG';
      doc.addImage(dataUrl, fmt, x, y, w, h);
    }

    const dateStr = selectedDates.length === 1
      ? selectedDates[0].toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10);
    doc.save(`attachments_${dateStr}.pdf`);
    setSelectedAttachmentIds(new Set());
  };

  const handleDeleteAttachment = async (attachment: TimecardAttachment) => {
    if (!window.confirm('Are you sure you want to delete this attachment?')) return;
    if (!attachment.id) return;

    try {
      await timecardAttachmentService.deleteAttachment(attachment.id, attachment.filePath);
      // Refresh attachment list
      setAttachmentsForDate(prev => prev.filter(a => a.id !== attachment.id));
      setMonthAttachments(prev => prev.filter(a => a.id !== attachment.id));
    } catch (error) {
      alert('Failed to delete attachment.');
    }
  };

  const handleToggleLock = async (dates: Date | Date[]) => {
    if (!user || user.role !== 'admin') {
      alert('Only admins can lock/unlock dates.');
      return;
    }

    const datesArray = Array.isArray(dates) ? dates : [dates];
    const someLocked = datesArray.some(d => lockedDates.has(formatDateKey(d)));
    const shouldLock = !someLocked;

    try {
      if (shouldLock) {
        await lockedDateService.lockMultipleDates(datesArray, user.id);
        setLockedDates(prev => {
          const next = new Set(prev);
          datesArray.forEach(d => next.add(formatDateKey(d)));
          return next;
        });
      } else {
        await lockedDateService.unlockMultipleDates(datesArray);
        setLockedDates(prev => {
          const next = new Set(prev);
          datesArray.forEach(d => next.delete(formatDateKey(d)));
          return next;
        });
      }
    } catch (error) {
      alert(`Failed to ${shouldLock ? 'lock' : 'unlock'} dates.`);
    }
  };

  // Calculate hours from clockIn/clockOut time-of-day only (same as form)
  // Avoids cross-day timestamp bugs where stored dates span multiple days
  const calcHours = (clockIn: any, clockOut: any): number | null => {
    if (!clockIn || !clockOut) return null;
    try {
      const inDate = clockIn instanceof Date ? clockIn :
        (clockIn && 'toDate' in clockIn && typeof (clockIn as any).toDate === 'function') ? (clockIn as any).toDate() : new Date(clockIn);
      const outDate = clockOut instanceof Date ? clockOut :
        (clockOut && 'toDate' in clockOut && typeof (clockOut as any).toDate === 'function') ? (clockOut as any).toDate() : new Date(clockOut);
      // Compare time-of-day only, same approach as TimeEntryForm
      const inRef = new Date(0);
      inRef.setHours(inDate.getHours(), inDate.getMinutes(), 0, 0);
      const outRef = new Date(0);
      outRef.setHours(outDate.getHours(), outDate.getMinutes(), 0, 0);
      const diff = outRef.getTime() - inRef.getTime();
      if (diff <= 0) return null;
      return Math.round((diff / (1000 * 60 * 60)) * 100) / 100;
    } catch {
      return null;
    }
  };

  const getEntryTotalHours = (entry: any): number => {
    const worked = calcHours(entry.clockIn, entry.clockOut) ?? entry.hours ?? 0;
    return worked + (entry.travelHours ?? 0);
  };

  const toggleEntryExpanded = (entryId: string) => {
    setExpandedEntries(prev => {
      const newSet = new Set(prev);
      if (newSet.has(entryId)) {
        newSet.delete(entryId);
      } else {
        newSet.add(entryId);
      }
      return newSet;
    });
  };

  const handleExportPDF = async () => {
    if (!selectedDates.length) {
      alert('Please select at least one date to export.');
      return;
    }

    // Check if both filters are set to none
    if ((!siteFilter || siteFilter === '') && (!employeeFilter || employeeFilter === '')) {
      alert('Please select a site or employee filter before exporting.');
      return;
    }

    let entries = selectedDates.flatMap(d => getEntriesForDate(d));
    
    // Filter based on site filter (only if a specific site is selected, not 'all')
    if (siteFilter && siteFilter !== '' && siteFilter !== 'all') {
      entries = entries.filter(entry => entry.job === siteFilter);
    }
    
    // Filter based on employee filter
    if (employeeFilter && employeeFilter !== '' && employeeFilter !== 'all') {
      if (employeeFilter === 'self') {
        // Show only current user's entries
        entries = entries.filter(entry => entry.userId === user?.id);
      } else {
        // Show entries for specific employee
        entries = entries.filter(entry => entry.userId === employeeFilter);
      }
    }
    
    const filteredEntries = entries.filter(entry => canSeeEntry(entry, user!, supervisorUserIds));

    if (filteredEntries.length === 0) {
      alert('No time entries found for the selected filters.');
      return;
    }

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const dateStr = selectedDates.length === 1
      ? format(selectedDates[0], 'MMM d, yyyy')
      : `${format(selectedDates[0], 'MMM d')} - ${format(selectedDates[selectedDates.length - 1], 'MMM d, yyyy')}`;

    // Title - left justified
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Time Card', 14, 20);

    // Date range - right justified
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(dateStr, pageWidth - 14 - doc.getTextWidth(dateStr), 20);

    // Filters
    let yPosition = 35;
    if (employeeFilter) {
      const employee = users.find(u => u.id === employeeFilter);
      const employeeName = employee ? (employee.name || employee.username) : employeeFilter;
      doc.text(`Employee: ${employeeName}`, 14, yPosition);
      yPosition += 7;
    }
    yPosition += 5;

    // Group entries by date first, then by site
    const entriesByDate = new Map<string, any[]>();
    filteredEntries.forEach(entry => {
      const dateKey = entry.date ? format(new Date(entry.date), 'yyyy-MM-dd') : 'Unknown Date';
      if (!entriesByDate.has(dateKey)) {
        entriesByDate.set(dateKey, []);
      }
      entriesByDate.get(dateKey)!.push(entry);
    });

    // Sort dates
    const sortedDates = Array.from(entriesByDate.keys()).sort();

    sortedDates.forEach(dateKey => {
      const dateEntries = entriesByDate.get(dateKey)!;

      if (yPosition > 240) {
        doc.addPage();
        yPosition = 20;
      }

      // Date header
      const displayDate = dateKey === 'Unknown Date' ? 'Unknown Date' : format(new Date(dateKey), 'MMM d, yyyy');
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(displayDate, 14, yPosition);
      yPosition += 10;

      // Group entries by job/site within each date
      const entriesByJob = new Map<string, any[]>();
      dateEntries.forEach(entry => {
        const job = entry.job || 'No Site';
        if (!entriesByJob.has(job)) {
          entriesByJob.set(job, []);
        }
        entriesByJob.get(job)!.push(entry);
      });

      entriesByJob.forEach((jobEntries, job) => {
        if (yPosition > 240) {
          doc.addPage();
          yPosition = 20;
        }

        // Site header
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.text(`Site: ${job}`, 14, yPosition);
        yPosition += 7;

        jobEntries.forEach((entry) => {
          if (yPosition > 240) {
            doc.addPage();
            yPosition = 20;
          }

          const entryOwner = users.find(u => u.id === entry.userId);
          const ownerName = entryOwner ? (entryOwner.name || entryOwner.username) : 'Unknown';

          // Employee name
          doc.setFontSize(6);
          doc.setFont('helvetica', 'bold');
          doc.text(`Employee: ${ownerName}`, 14, yPosition);
          yPosition += 4;

          // Clock in/out
          doc.setFont('helvetica', 'normal');
          const clockIn = entry.clockIn ? format(new Date(entry.clockIn), 'h:mm a') : 'N/A';
          const clockOut = entry.clockOut ? format(new Date(entry.clockOut), 'h:mm a') : 'N/A';
          doc.text(`Clock In: ${clockIn}  |  Clock Out: ${clockOut}`, 14, yPosition);
          yPosition += 2;

          // Work entries table
          const workEntries = entry.workEntries || [];
          if (workEntries.length > 0) {
            const tableData = workEntries.map((we: any) => [
              we.code || '',
              we.machineHours || '0',
              we.labourHours || '0',
              (we.equipmentEntries && we.equipmentEntries.length > 0)
                ? we.equipmentEntries
                    .filter((e: any) => e.equipment && e.machineHours && e.machineHours !== '0')
                    .map((e: any) => `${e.equipment} (${e.machineHours})`)
                    .join(', ')
                : '',
              we.smallTools && we.smallTools.length > 0 ? we.smallTools.join(', ') : '',
              we.notes || ''
            ]);

            autoTable(doc, {
              startY: yPosition,
              head: [['Code', 'Machine', 'Labour', 'Equipment', 'Small Tools', 'Notes']],
              body: tableData,
              theme: 'grid',
              headStyles: { fillColor: [255, 200, 100], textColor: 0 },
              styles: { fontSize: 6, cellPadding: 2 },
              columnStyles: {
                0: { cellWidth: 20 },
                1: { cellWidth: 15 },
                2: { cellWidth: 15 },
                3: { cellWidth: 45 },
                4: { cellWidth: 35 },
                5: { cellWidth: 38 }
              }
            });

            yPosition = (doc as any).lastAutoTable.finalY + 3;
          }

          // Add consent note after each time card
          doc.setFontSize(8);
          doc.setFont('helvetica', 'italic');
          doc.text('Employee consented to end of day health statement', 14, yPosition);

          yPosition += 10;
        });
      });

      yPosition += 10;
    });

    // Add submission statement at the end
    yPosition += 20;
    if (yPosition > 240) {
      doc.addPage();
      yPosition = 20;
    }
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    doc.text('By submitting this form, I confirm that, to the best of my knowledge, all assigned work has', 14, yPosition);
    yPosition += 5;
    doc.text('been completed and that I departed the worksite without injury, illness, or incident at the', 14, yPosition);
    yPosition += 5;
    doc.text('time of departure. Once submitted the card is locked.', 14, yPosition);

    // Save PDF
    const fileName = `TimeCard_${format(selectedDates[0], 'yyyy-MM-dd')}${selectedDates.length > 1 ? `_${format(selectedDates[selectedDates.length - 1], 'yyyy-MM-dd')}` : ''}.pdf`;
    doc.save(fileName);
  };

  const handleExportPOsPDF = async () => {
    if (!selectedDates.length) {
      alert('Please select at least one date to export.');
      return;
    }

    let pos: PurchaseOrder[];
    if (selectedDates.length === 1) {
      pos = posForDate;
    } else {
      const rangeStart = new Date(Math.min(...selectedDates.map(d => d.getTime())));
      const rangeEnd = new Date(Math.max(...selectedDates.map(d => d.getTime())));
      rangeStart.setHours(0, 0, 0, 0);
      rangeEnd.setHours(23, 59, 59, 999);
      pos = (await purchaseOrderService.getPOsForRange(rangeStart, rangeEnd)).filter(canSeePO);
    }

    if (pos.length === 0) {
      alert('No purchase orders found for the selected date(s).');
      return;
    }

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const dateStr = selectedDates.length === 1
      ? format(selectedDates[0], 'MMM d, yyyy')
      : `${format(selectedDates[0], 'MMM d')} – ${format(selectedDates[selectedDates.length - 1], 'MMM d, yyyy')}`;

    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Purchase Orders', 14, 20);

    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(dateStr, pageWidth - 14 - doc.getTextWidth(dateStr), 20);

    let yPosition = 35;

    // Group POs by date
    const posByDate = new Map<string, PurchaseOrder[]>();
    pos.forEach(po => {
      const key = format(new Date(po.date), 'yyyy-MM-dd');
      if (!posByDate.has(key)) posByDate.set(key, []);
      posByDate.get(key)!.push(po);
    });

    Array.from(posByDate.keys()).sort().forEach(dateKey => {
      const datePOs = posByDate.get(dateKey)!;

      if (yPosition > 240) { doc.addPage(); yPosition = 20; }

      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(format(new Date(dateKey), 'MMM d, yyyy'), 14, yPosition);
      yPosition += 8;

      datePOs.forEach(po => {
        if (yPosition > 240) { doc.addPage(); yPosition = 20; }

        // PO header
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text(`PO #${po.poNumber}`, 14, yPosition);
        doc.setFont('helvetica', 'normal');
        doc.text(`To: ${po.to}   Site: ${po.site}   By: ${po.submittedBy}`, 40, yPosition);
        yPosition += 6;

        // Items table
        autoTable(doc, {
          startY: yPosition,
          head: [['Qty', 'Description', 'Code']],
          body: po.items.map(item => [String(item.quantity), item.description, item.code]),
          theme: 'grid',
          headStyles: { fillColor: [147, 51, 234], textColor: 255 },
          styles: { fontSize: 8, cellPadding: 2 },
          columnStyles: {
            0: { cellWidth: 15 },
            1: { cellWidth: 110 },
            2: { cellWidth: 45 },
          },
        });

        yPosition = (doc as any).lastAutoTable.finalY + 3;

        if (po.attachmentName) {
          doc.setFontSize(7);
          doc.setFont('helvetica', 'italic');
          doc.text(`Attachment: ${po.attachmentName}`, 14, yPosition);
          yPosition += 4;
        }

        yPosition += 6;
      });

      yPosition += 4;
    });

    const fileName = `PurchaseOrders_${format(selectedDates[0], 'yyyy-MM-dd')}${selectedDates.length > 1 ? `_${format(selectedDates[selectedDates.length - 1], 'yyyy-MM-dd')}` : ''}.pdf`;
    doc.save(fileName);
  };

  return (
    <div className="min-h-screen bg-yellow-100 dark:bg-black text-gray-900 dark:text-yellow-100 px-2 sm:px-4 py-4 -mx-2 sm:-mx-4 lg:mx-0 lg:p-2">
      <div className="max-w-5xl mx-auto">
        
        <div className="grid grid-cols-1 gap-2">
          {/* Calendar */}
          <div className="bg-yellow-200 dark:bg-black border border-yellow-600 rounded-lg shadow-xl dark:shadow-yellow-900/20 dark:shadow-2xl p-2">
            {/* Calendar Header */}
            <div className="flex items-center justify-between mb-6">
              <button
                onClick={handlePreviousMonth}
                className="p-2 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-100 dark:hover:bg-yellow-900 dark:hover:bg-opacity-30 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h2 className="text-xl font-semibold text-yellow-700 dark:text-yellow-300">
                {format(currentMonth, 'MMMM yyyy')}
              </h2>
              <button
                onClick={handleNextMonth}
                className="p-2 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-100 dark:hover:bg-yellow-900 dark:hover:bg-opacity-30 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            {/* Field | Survey toggle (admins and surveyors) */}
            {(user?.role === 'admin' || user?.isSurveyor) && (
              <div className="flex justify-center mb-4">
                <TimecardModeToggle mode="field" />
              </div>
            )}

            {/* Week Days */}
            <div className="grid grid-cols-7 gap-2 mb-2">
              {weekDays.map(day => (
                <div key={day} className="text-center text-xs font-medium text-yellow-700 dark:text-yellow-600 py-2">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Days */}
            <div className="grid grid-cols-7 gap-2">
              {days.map((day, index) => {
                const isCurrentMonth = isSameMonth(day, currentMonth);
                const isSelected = selectedDates.some(selected => isSameDay(day, selected));
                const isTodayDate = isToday(day);
                const dateKey = formatDateKey(day);
                const attachmentCount = filteredAttachmentCounts[dateKey] || 0;
                const poCount = filteredPOCounts[dateKey] || 0;
                const isLocked = lockedDates.has(dateKey);

                return (
                  <button
                    key={index}
                    onClick={(event) => handleDateClick(day, event)}
                    className={`
                      relative p-2 text-sm rounded-lg border transition-all
                      ${isCurrentMonth ? 'text-gray-800 dark:text-yellow-100' : 'text-yellow-600 dark:text-yellow-700'}
                      ${!isCurrentMonth ? 'opacity-50' : ''}
                      ${isLocked ? 'border-gray-400 dark:border-gray-600 bg-gray-300 dark:bg-gray-800 opacity-75' : (isTodayDate && !isSelected ? 'border-yellow-500 dark:border-yellow-400' : (!isTodayDate && !isSelected ? 'border-yellow-600 dark:border-yellow-800' : ''))}
                      ${isSelected && !isLocked ? 'bg-green-200 dark:bg-green-900 dark:bg-opacity-50 border-green-500' : 'hover:bg-yellow-100 dark:hover:bg-yellow-900 dark:hover:bg-opacity-30'}
                    `}
                  >
                    <div className="text-center relative">
                      {format(day, 'd')}
                      {(() => {
                        const dayEntries = getEntriesForDate(day);
                        const filteredDayEntries = (() => {
                          if (!user || (!siteFilter && !employeeFilter)) return dayEntries;
                          let f = dayEntries.filter(e => canSeeEntry(e, user!, supervisorUserIds));
                          if (siteFilter && siteFilter !== 'all') f = f.filter(e => e.job === siteFilter);
                          if (employeeFilter === 'self') f = f.filter(e => e.userId === user!.id);
                          else if (employeeFilter && employeeFilter !== 'all') f = f.filter(e => e.userId === employeeFilter);
                          return f;
                        })();
                        const submittedCount = filteredDayEntries.filter(entry => entry.status === 'submitted').length;
                        const draftCount = filteredDayEntries.filter(entry => !entry.status || entry.status === 'draft').length;

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
                            {attachmentCount > 0 && (
                              <div className="absolute -bottom-1 -right-1 bg-blue-600 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold border border-yellow-200 dark:border-yellow-800">
                                {attachmentCount}
                              </div>
                            )}
                            {poCount > 0 && (
                              <div className="absolute -bottom-1 -left-1 bg-purple-600 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold border border-yellow-200 dark:border-yellow-800">
                                {poCount}
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
          {selectedDates.length > 0 && (
            <div className="bg-yellow-200 dark:bg-black border border-yellow-600 rounded-lg shadow-xl dark:shadow-yellow-900/20 dark:shadow-2xl p-2">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-6">
                <h3 className="text-lg font-semibold text-yellow-700 dark:text-yellow-300">
                  {showPOForm && selectedDates.length === 1
                    ? `PO Entry for ${format(selectedDates[0], 'MMMM d, yyyy')}`
                    : showAttachments && selectedDates.length === 1
                    ? `Attachment Entry for ${format(selectedDates[0], 'MMMM d, yyyy')}`
                    : `Entries for ${selectedDateLabel}`}
                </h3>
                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <button
                    onClick={() => {
                      if (!selectedDateParam) return;
                      navigate(`/timecard/edit/new?date=${selectedDateParam}`);
                    }}
                    disabled={!selectedDateParam || isDateLocked}
                    className="px-3 py-1.5 text-sm bg-yellow-600 text-black rounded-lg hover:bg-yellow-500 font-medium transition-colors whitespace-nowrap disabled:opacity-50"
                    title={isDateLocked ? 'Date is locked' : (selectedDateParam ? 'Add Time Card' : 'Select a single date to add a time card')}
                  >
                    Add Time Card
                  </button>
                  {/* Clear Selection */}
                  {selectedDates.length > 0 && (
                    <button
                      onClick={() => { setSelectedDates([]); setAttachmentsForDate([]); setPosForDate([]); setShowPOForm(false); setShowAttachments(false); }}
                      className="px-3 py-1.5 text-sm bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 font-medium transition-colors whitespace-nowrap"
                      title="Clear date selection"
                    >
                      Clear
                    </button>
                  )}
                  {/* Actions overflow menu */}
                  <div className="relative">
                    <button
                      onClick={() => setShowActionsMenu(prev => !prev)}
                      className="p-1.5 rounded-lg bg-yellow-300 dark:bg-yellow-800 text-yellow-900 dark:text-yellow-100 hover:bg-yellow-400 dark:hover:bg-yellow-700 transition-colors"
                      title="More actions"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </button>
                    {showActionsMenu && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setShowActionsMenu(false)} />
                        <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-gray-900 border border-yellow-300 dark:border-yellow-700 rounded-lg shadow-lg z-50 py-1">
                        <button
                          onClick={() => { setShowAttachments(true); setShowPOForm(false); setShowActionsMenu(false); }}
                          className="w-full text-left px-4 py-2 text-sm text-gray-800 dark:text-yellow-100 hover:bg-yellow-50 dark:hover:bg-yellow-900/40"
                        >
                          Attachments
                        </button>
                        <button
                          onClick={() => { setShowPOForm(true); setShowAttachments(false); setShowActionsMenu(false); }}
                          disabled={!selectedDateParam}
                          className="w-full text-left px-4 py-2 text-sm text-gray-800 dark:text-yellow-100 hover:bg-yellow-50 dark:hover:bg-yellow-900/40 disabled:opacity-50"
                        >
                          PO
                        </button>
                        {(user?.role === 'admin' || user?.role === 'supervisor') && selectedDates.length === 1 && siteFilter && siteFilter !== '' && siteFilter !== 'all' && (
                          <button
                            onClick={() => { setShowSummary(v => !v); setShowActionsMenu(false); }}
                            className="w-full text-left px-4 py-2 text-sm text-gray-800 dark:text-yellow-100 hover:bg-yellow-50 dark:hover:bg-yellow-900/40"
                          >
                            {showSummary ? 'Hide Summary' : 'Summarize Day'}
                          </button>
                        )}
                        {user?.role === 'admin' && selectedDates.length > 0 && (
                          <button
                            onClick={() => { handleToggleLock(selectedDates); setShowActionsMenu(false); }}
                            className="w-full text-left px-4 py-2 text-sm text-gray-800 dark:text-yellow-100 hover:bg-yellow-50 dark:hover:bg-yellow-900/40"
                          >
                            {selectedDates.length === 1 ? (isDateLocked ? 'Unlock' : 'Lock') : (selectedDates.some(d => lockedDates.has(formatDateKey(d))) ? 'Unlock All' : 'Lock All')}
                          </button>
                        )}
                        {(user?.role === 'admin' || user?.role === 'supervisor') && (
                          <button
                            onClick={() => { showPOForm ? handleExportPOsPDF() : handleExportPDF(); setShowActionsMenu(false); }}
                            className="w-full text-left px-4 py-2 text-sm text-gray-800 dark:text-yellow-100 hover:bg-yellow-50 dark:hover:bg-yellow-900/40"
                          >
                            {showPOForm ? 'Export POs' : 'Export'}
                          </button>
                        )}
                      </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {showPOForm && selectedDates.length === 1 && (
                <div
                  className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50"
                  onClick={() => setShowPOForm(false)}
                >
                  <div
                    className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto border border-yellow-600"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-between p-4 border-b border-yellow-600 bg-yellow-600 rounded-t-xl">
                      <h2 className="text-lg font-bold text-black">Purchase Orders</h2>
                      <button onClick={() => setShowPOForm(false)} className="p-1.5 rounded-lg hover:bg-yellow-700 text-black transition-colors">
                        <X className="h-5 w-5" />
                      </button>
                    </div>
                    <div className="p-5">
                      <PurchaseOrderPanel
                        date={selectedDates[0]}
                        submittedBy={user?.name ?? user?.username ?? 'Unknown'}
                        submittedById={user?.id}
                        posForDate={posForDate}
                        onClose={() => setShowPOForm(false)}
                        onPOCreated={(poNumber) => {
                          const key = formatDateKey(selectedDates[0]);
                          purchaseOrderService.getPOsForDate(selectedDates[0]).then(pos => {
                            const visible = pos.filter(canSeePO);
                            setMonthPOs(prev => [
                              ...prev.filter(p => formatDateKey(toDateSafe(p.date)) !== key),
                              ...visible
                            ]);
                          });
                          purchaseOrderService.getPOsForDate(selectedDates[0]).then(pos => setPosForDate(pos.filter(canSeePO)));
                          void poNumber;
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {showAttachments && (
                <div
                  className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50"
                  onClick={() => setShowAttachments(false)}
                >
                  <div
                    className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto border border-yellow-600"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-between p-4 border-b border-yellow-600 bg-yellow-600 rounded-t-xl">
                      <h2 className="text-lg font-bold text-black">Attachments</h2>
                      <button onClick={() => setShowAttachments(false)} className="p-1.5 rounded-lg hover:bg-yellow-700 text-black transition-colors">
                        <X className="h-5 w-5" />
                      </button>
                    </div>
                    <div className="p-5">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <label className="block text-sm font-medium text-yellow-700 dark:text-yellow-600 mb-2">
                      Site
                    </label>
                    <select
                      value={attachmentSite}
                      onChange={(e) => {
                        setAttachmentSite(e.target.value);
                        setAttachmentCode('');
                      }}
                      className="w-full px-3 py-2 bg-yellow-200 dark:bg-black border border-yellow-400 dark:border-yellow-700 rounded-lg text-gray-900 dark:text-yellow-100 focus:outline-none focus:border-yellow-400"
                    >
                      <option value="">Select Site</option>
                      {sitesData.map(site => (
                        <option key={site.id} value={site.name}>{site.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-yellow-700 dark:text-yellow-600 mb-2">
                      Code
                    </label>
                    <select
                      value={attachmentCode}
                      onChange={(e) => setAttachmentCode(e.target.value)}
                      className="w-full px-3 py-2 bg-yellow-200 dark:bg-black border border-yellow-400 dark:border-yellow-700 rounded-lg text-gray-900 dark:text-yellow-100 focus:outline-none focus:border-yellow-400"
                    >
                      <option value="">Select Code</option>
                      {attachmentCodeOptions.map(code => (
                        <option key={code.name} value={code.name}>
                          {code.name} - {code.description || 'No description'}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-yellow-700 dark:text-yellow-600 mb-2">
                      Attachment
                    </label>
                    <input
                      type="file"
                      multiple
                      onChange={(e) => {
                        const files = Array.from(e.target.files || []);
                        setAttachmentFilesWithDesc(files.map(f => ({ file: f, description: '' })));
                      }}
                      className="w-full px-3 py-2 bg-yellow-200 dark:bg-black border border-yellow-400 dark:border-yellow-700 rounded-lg text-gray-900 dark:text-yellow-100 focus:outline-none focus:border-yellow-400"
                    />
                    {attachmentFilesWithDesc.length > 0 && (
                      <p className="mt-1 text-xs text-yellow-700 dark:text-yellow-500">
                        Selected: {attachmentFilesWithDesc.length} file(s)
                      </p>
                    )}
                  </div>
                  {attachmentFilesWithDesc.map((item, index) => (
                    <div key={index} className="sm:col-span-3">
                      <label className="block text-sm font-medium text-yellow-700 dark:text-yellow-600 mb-2">
                        Description for {item.file.name} <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={item.description}
                        onChange={(e) => {
                          const updated = [...attachmentFilesWithDesc];
                          updated[index].description = e.target.value;
                          setAttachmentFilesWithDesc(updated);
                        }}
                        placeholder={`Enter description for ${item.file.name}`}
                        required
                        className="w-full px-3 py-2 bg-yellow-200 dark:bg-black border border-yellow-400 dark:border-yellow-700 rounded-lg text-gray-900 dark:text-yellow-100 focus:outline-none focus:border-yellow-400"
                      />
                    </div>
                  ))}
                </div>
                  <div className="mt-4 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={handleAttachmentSubmit}
                      disabled={attachmentSubmitting || selectedDates.length !== 1}
                      className="px-3 py-1.5 text-sm bg-yellow-600 text-black rounded-lg hover:bg-yellow-500 font-medium transition-colors whitespace-nowrap disabled:opacity-50"
                      title={selectedDates.length === 1 ? 'Upload attachment' : 'Select a single date to attach'}
                    >
                      {attachmentSubmitting ? 'Uploading...' : 'Submit Attachment'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowAttachments(false)}
                      className="px-3 py-1.5 text-sm bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-yellow-100 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 font-medium transition-colors whitespace-nowrap"
                    >
                      Close
                    </button>
                  </div>

                  {attachmentsForDate.length > 0 && (
                    <div className="mt-4 border-t border-yellow-400 dark:border-yellow-700 pt-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-semibold text-yellow-700 dark:text-yellow-300">
                          Attachments for this date ({attachmentsForDate.length})
                        </h4>
                        {selectedAttachmentIds.size > 0 && (
                          <button
                            type="button"
                            onClick={handleDownloadSelectedAsPdf}
                            className="px-2.5 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-500 font-medium transition-colors"
                          >
                            Download {selectedAttachmentIds.size} as PDF
                          </button>
                        )}
                      </div>
                      <div className="space-y-2">
                        {attachmentsForDate.map((attachment) => {
                          const uploader = users.find(u => u.id === attachment.uploadedBy);
                          const isImage = attachment.fileName.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp|bmp)$/i);
                          const isSelected = selectedAttachmentIds.has(attachment.id!);
                          return (
                            <div
                              key={attachment.id}
                              className={`bg-yellow-100 dark:bg-black border rounded-lg p-3 transition-colors ${
                                isSelected ? 'border-blue-500 dark:border-blue-400' : 'border-yellow-400 dark:border-yellow-700'
                              }`}
                            >
                              <div className="flex items-start gap-3">
                                {isImage && (
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => {
                                      setSelectedAttachmentIds(prev => {
                                        const next = new Set(prev);
                                        if (next.has(attachment.id!)) next.delete(attachment.id!);
                                        else next.add(attachment.id!);
                                        return next;
                                      });
                                    }}
                                    className="mt-1 flex-shrink-0 h-4 w-4 rounded border-yellow-400 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                    title="Select for PDF download"
                                  />
                                )}
                                {isImage && (
                                  <div
                                    className="flex-shrink-0 w-20 h-20 border border-yellow-400 dark:border-yellow-700 rounded overflow-hidden cursor-pointer hover:border-yellow-600 dark:hover:border-yellow-500 transition-colors"
                                    onMouseEnter={() => setHoveredAttachment(attachment)}
                                    onMouseLeave={() => setHoveredAttachment(null)}
                                  >
                                    <img
                                      src={attachment.fileUrl}
                                      alt={attachment.fileName}
                                      className="w-full h-full object-cover"
                                    />
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <a
                                      href={attachment.fileUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline truncate"
                                    >
                                      {attachment.fileName}
                                    </a>
                                  </div>
                                  {attachment.description && (
                                    <p className="text-xs text-gray-600 dark:text-yellow-500 mb-1">
                                      {attachment.description}
                                    </p>
                                  )}
                                  <div className="text-xs text-yellow-600 dark:text-yellow-500">
                                    <span className="font-medium">Site:</span> {attachment.site}
                                    {attachment.code && <span className="ml-2"><span className="font-medium">Code:</span> {attachment.code}</span>}
                                    {uploader && <span className="ml-2"><span className="font-medium">Uploaded by:</span> {uploader.name}</span>}
                                  </div>
                                </div>
                                <button
                                  onClick={() => handleDeleteAttachment(attachment)}
                                  className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 text-xs font-medium"
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Attachment Preview Overlay */}
                      {hoveredAttachment && (
                        <div
                          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 pointer-events-none"
                        >
                          <div className="relative inline-block" style={{ transform: 'scale(0.75)', transformOrigin: 'center' }}>
                            <img
                              src={hoveredAttachment.fileUrl}
                              alt={hoveredAttachment.fileName}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

              {/* Time Entries heading — shown here when PO form is open */}
              {showPOForm && (
                <h3 className="text-lg font-semibold text-yellow-700 dark:text-yellow-300 mb-4">
                  Time Entries for {selectedDateLabel}
                </h3>
              )}

              {/* Day Summary Panel */}
              {showSummary && (() => {
                const s = buildDaySummary();
                if (!s) return null;
                const fmtH = (h: number) => h % 1 === 0 ? `${h}h` : `${h.toFixed(1)}h`;
                const copyText = [
                  `DAY SUMMARY — ${s.site} — ${format(s.date, 'MMM d, yyyy')}`,
                  '='.repeat(48),
                  `CREW (${s.count} ${s.count === 1 ? 'worker' : 'workers'})`,
                  ...Object.values(s.byUser).map(r => {
                    const parts = [`Labour: ${fmtH(r.labourH)}`];
                    if (r.travelH) parts.push(`Travel: ${fmtH(r.travelH)}`);
                    if (r.machineH) parts.push(`Machine: ${fmtH(r.machineH)}`);
                    return `  ${r.name}: ${parts.join(' | ')}`;
                  }),
                  '',
                  s.allEquipment.size ? `EQUIPMENT\n${[...s.allEquipment].map(e => `  - ${e}`).join('\n')}` : '',
                  s.allCodes.size ? `WORK CODES: ${[...s.allCodes].join(', ')}` : '',
                  s.allNotes.length ? `NOTES\n${s.allNotes.map(n => `  - ${n}`).join('\n')}` : '',
                  '',
                  `TOTALS — Labour: ${fmtH(s.totalLabour)} | Travel: ${fmtH(s.totalTravel)} | Machine: ${fmtH(s.totalMachine)}`,
                ].filter(l => l !== '').join('\n');
                return (
                  <div className="mb-6 bg-green-50 dark:bg-green-950 border border-green-400 dark:border-green-700 rounded-lg p-4">
                    <div className="flex justify-between items-center mb-3">
                      <div>
                        <h3 className="font-bold text-green-800 dark:text-green-300 text-sm">DAY SUMMARY</h3>
                        <p className="text-xs text-green-600 dark:text-green-500">{s.site} &mdash; {format(s.date, 'EEEE, MMMM d, yyyy')}</p>
                      </div>
                      <button
                        onClick={() => navigator.clipboard.writeText(copyText)}
                        className="text-xs px-2 py-1 bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200 rounded hover:bg-green-300 dark:hover:bg-green-700 font-medium"
                      >Copy</button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                      <div>
                        <p className="font-semibold text-green-700 dark:text-green-400 uppercase tracking-wide mb-1">Crew ({s.count})</p>
                        {Object.values(s.byUser).map((r, i) => (
                          <div key={i} className="mb-1 text-gray-700 dark:text-gray-300">
                            <span className="font-medium">{r.name}</span>
                            <span className="text-green-600 dark:text-green-500 ml-1">
                              {r.labourH > 0 && `${fmtH(r.labourH)} labour`}
                              {r.travelH > 0 && ` · ${fmtH(r.travelH)} travel`}
                              {r.machineH > 0 && ` · ${fmtH(r.machineH)} machine`}
                            </span>
                            {r.codes.length > 0 && <span className="ml-1 text-yellow-600 dark:text-yellow-500">[{r.codes.join(', ')}]</span>}
                          </div>
                        ))}
                      </div>
                      <div>
                        {s.allEquipment.size > 0 && (
                          <div className="mb-2">
                            <p className="font-semibold text-green-700 dark:text-green-400 uppercase tracking-wide mb-1">Equipment</p>
                            {[...s.allEquipment].map((e, i) => <p key={i} className="text-gray-700 dark:text-gray-300">{e}</p>)}
                          </div>
                        )}
                        {s.allNotes.length > 0 && (
                          <div>
                            <p className="font-semibold text-green-700 dark:text-green-400 uppercase tracking-wide mb-1">Notes</p>
                            {s.allNotes.map((n, i) => <p key={i} className="text-gray-600 dark:text-gray-400 italic">{n}</p>)}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-green-300 dark:border-green-700 flex gap-4 text-xs font-semibold text-green-800 dark:text-green-300">
                      <span>Labour: {fmtH(s.totalLabour)}</span>
                      <span>Travel: {fmtH(s.totalTravel)}</span>
                      <span>Machine: {fmtH(s.totalMachine)}</span>
                    </div>
                  </div>
                );
              })()}

              {/* Filters for Admins and Supervisors */}
              {(user?.role === 'admin' || user?.role === 'supervisor') && (
                <div className="mb-6 grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-sm font-medium text-yellow-700 dark:text-yellow-600 mb-2">
                      Site
                    </label>
                    <select
                      value={siteFilter}
                      onChange={(e) => {
                        setSiteFilter(e.target.value);
                        setEmployeeFilter(''); // Reset employee filter when site filter changes
                      }}
                      className="w-full px-3 py-2 bg-yellow-200 dark:bg-black border border-yellow-400 dark:border-yellow-700 rounded-lg text-gray-900 dark:text-yellow-100 focus:outline-none focus:border-yellow-400"
                    >
                      <option value="">All Sites</option>
                      {getUniqueSites().map(site => (
                        <option key={site} value={site}>{site}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-yellow-700 dark:text-yellow-600 mb-2">
                      Employee
                    </label>
                    <select
                      value={employeeFilter}
                      onChange={(e) => {
                        setEmployeeFilter(e.target.value);
                        setSiteFilter(''); // Reset site filter when employee filter changes
                      }}
                      className="w-full px-3 py-2 bg-yellow-200 dark:bg-black border border-yellow-400 dark:border-yellow-700 rounded-lg text-gray-900 dark:text-yellow-100 focus:outline-none focus:border-yellow-400"
                    >
                      <option value="">All Employees</option>
                      {(user?.role === 'supervisor' || user?.role === 'admin') && (
                        <option value="self">Your Time Card</option>
                      )}
                      {getUniqueEmployees().map(employee => (
                        <option key={employee.id} value={employee.id}>
                          {employee.name || employee.username}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
              
              {/* Time Cards List */}
              <div className="space-y-4">
                {(() => {
                  const allEntries = selectedEntries;
                  
                  const filteredEntries = allEntries.filter(entry => 
                    entry.userId === user?.id || canSeeEntry(entry, user!, supervisorUserIds)
                  );
                  
                  
                  const isAdminOrSupervisor = user?.role === 'admin' || user?.role === 'supervisor';

                  if (filteredEntries.length === 0) {
                    return (
                      <div className="text-center py-8 text-yellow-700 dark:text-yellow-600">
                        No time entries found for this date
                      </div>
                    );
                  }

                  const dateGroups = isMultiDateSelection
                    ? groupEntriesByDate(filteredEntries)
                    : [{ date: selectedDates[0], entries: filteredEntries }];

                  return (
                    <div className="space-y-6">
                      {dateGroups.map(({ date, entries }) => {
                        const groupKey = format(date, 'yyyy-MM-dd');
                        const groupEntries = entries;

                        const userDayTotals = groupEntries.reduce<Record<string, number>>((totals, entry) => {
                          totals[entry.userId] = (totals[entry.userId] || 0) + getEntryTotalHours(entry);
                          return totals;
                        }, {});

                        // Separate entries into your cards and other cards
                        const yourEntries = groupEntries
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
                          // 'self' filter: show supervisor's own entries
                          if (employeeFilter === 'self') {
                            return groupEntries.filter(entry => entry.userId === user?.id);
                          }

                          // Show all entries for admins, other users' entries for supervisors (including drafts)
                          const otherUsersEntries = user?.role === 'admin' ? groupEntries : groupEntries.filter(entry => entry.userId !== user?.id);
                          
                          // Check if "all" is explicitly selected for either filter
                          const showAll = (siteFilter === 'all') || (employeeFilter === 'all');
                          
                          // Check if a specific filter is set (not empty and not 'all' and not 'self')
                          const hasSpecificFilter = (siteFilter && siteFilter !== '' && siteFilter !== 'all') || 
                                                  (employeeFilter && employeeFilter !== '' && employeeFilter !== 'all' && employeeFilter !== 'self');
                          
                          if (showAll || !hasSpecificFilter) {
                            // No filter or "All" selected - show all other users' entries
                            return otherUsersEntries;
                          }
                          
                          // Apply specific filters
                          let filtered = otherUsersEntries;
                          // Only apply site filter if it's not "all" and not empty
                          if (siteFilter && siteFilter !== 'all' && siteFilter !== '') {
                            filtered = filtered.filter(entry => entry.job === siteFilter);
                          }
                          // Only apply employee filter if it's not "all" and not empty
                          if (employeeFilter && employeeFilter !== 'all' && employeeFilter !== '') {
                            filtered = filtered.filter(entry => entry.userId === employeeFilter);
                          }
                          
                          return filtered;
                        })() : [];

                        const showGrouped = !siteFilter || siteFilter === 'all' || employeeFilter === 'all';
                        const siteGroups: { site: string | null; entries: any[] }[] = [];
                        if (showGrouped) {
                          const groupMap: Record<string, any[]> = {};
                          (otherEntries as any[]).forEach((entry: any) => {
                            const site = entry.job || '(No Site)';
                            if (!groupMap[site]) groupMap[site] = [];
                            groupMap[site].push(entry);
                          });
                          Object.keys(groupMap)
                            .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
                            .forEach(site => siteGroups.push({ site, entries: groupMap[site] }));
                        } else {
                          siteGroups.push({ site: null, entries: otherEntries });
                        }

                        return (
                          <div key={groupKey} className="space-y-3">
                            {isMultiDateSelection && (
                              <div className="text-yellow-800 dark:text-yellow-300 font-semibold text-sm uppercase tracking-wide">
                                {format(date, 'EEE, MMM d, yyyy')}
                              </div>
                            )}
                            {/* Your Time Cards Section - Field users only */}
                            {user?.role === 'field' && (
                              <div className="border-t border-yellow-200 dark:border-yellow-700 pt-4">
                                  <div className="space-y-3">
                                    {yourEntries.length > 0 ? (
                                      yourEntries.map((entry: any, index: number) => {
                                        const canAccess = canViewEntry(entry, user!);
                                        return (
                                          <div key={entry.id || `your-${index}`}>
                                            <div
                                              className={`bg-yellow-50 dark:bg-yellow-900 dark:bg-opacity-10 border rounded-lg p-3 transition-colors ${
                                                canAccess 
                                                  ? 'border-yellow-400 dark:border-yellow-700 hover:border-yellow-600' 
                                                  : 'border-gray-400 dark:border-gray-600 opacity-75'
                                              }`}
                                            >
                                              <div className="space-y-2">
                                                {/* Top row — clickable to navigate to edit page */}
                                                <div
                                                  className={canAccess ? 'cursor-pointer' : ''}
                                                  onClick={() => canAccess && handleEntrySelect(entry.id!)}
                                                >
                                                <div className="flex justify-between items-start">
                                                  <span className="text-gray-900 dark:text-yellow-100 font-medium">
                                                    {getBestDisplayName(users.find(u => u.id === entry.userId))}
                                                    <span className="ml-2 text-sm font-normal text-yellow-700 dark:text-yellow-500">
                                                      {userDayTotals[entry.userId]?.toFixed(2) ?? '0.00'} hrs
                                                    </span>
                                                  </span>
                                                  <div className="flex items-center gap-2">
                                                    <button
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        toggleEntryExpanded(entry.id || `your-${index}`);
                                                      }}
                                                      className="p-1 text-yellow-600 dark:text-yellow-400 hover:text-yellow-500 dark:hover:text-yellow-300"
                                                    >
                                                      {expandedEntries.has(entry.id || `your-${index}`) ? (
                                                        <ChevronUp className="w-4 h-4" />
                                                      ) : (
                                                        <ChevronDown className="w-4 h-4" />
                                                      )}
                                                    </button>
                                                    <span className={`px-2 py-1 rounded text-xs ${
                                                      entry.status === 'draft' ? 'bg-gray-600' :
                                                      entry.status === 'submitted' ? 'bg-green-600' :
                                                      entry.status === 'rejected' ? 'bg-red-600' :
                                                      'bg-blue-600'
                                                    } text-white`}>
                                                      {entry.status === 'submitted' ? (
                                                        <Check className="w-3 h-3" />
                                                      ) : (
                                                        (getStatusDisplay(entry.status) || 'D').charAt(0)
                                                      )}
                                                    </span>
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
                                                  </div>
                                                </div>
                                                {entry.job && (
                                                  <div className="text-gray-900 dark:text-yellow-100">
                                                    {entry.job}
                                                  </div>
                                                )}
                                                <div className="font-medium text-yellow-700 dark:text-yellow-600">
                                                  <span className="text-sm">
                                                    Worked {calcHours(entry.clockIn, entry.clockOut) ?? entry.hours}
                                                    {(entry.travelHours ?? 0) > 0 && (
                                                      <> + Travel {entry.travelHours}</>
                                                    )} = Total {((calcHours(entry.clockIn, entry.clockOut) ?? entry.hours) + (entry.travelHours ?? 0)).toFixed(2)}
                                                  </span>
                                                  {entry.lastEditedBy && (
                                                    <span className="text-xs text-yellow-600 dark:text-yellow-400 ml-2" title={`Last edited by ${entry.lastEditedBy} on ${entry.lastEditedAt ? format(entry.lastEditedAt instanceof Date ? entry.lastEditedAt : (entry.lastEditedAt as any).toDate(), 'MMM d, yyyy HH:mm') : ''}`}>
                                                      Edited by {entry.lastEditedBy}
                                                    </span>
                                                  )}
                                                </div>
                                                </div>
                                                
                                                {/* Expanded Details - Inline Editable */}
                                                {expandedEntries.has(entry.id || `your-${index}`) && (
                                                  <>
                                                  <div className="hidden sm:block">
                                                    <InlineTimecardEdit
                                                      entry={entry}
                                                      user={user!}
                                                      canEdit={canEditEntry(entry, user!)}
                                                      onSave={handleInlineSave}
                                                      calcHours={calcHours}
                                                    />
                                                  </div>
                                                  <div className="block sm:hidden">
                                                    <InlineTimecardEdit
                                                      entry={entry}
                                                      user={user!}
                                                      canEdit={canEditEntry(entry, user!)}
                                                      onSave={handleInlineSave}
                                                      calcHours={calcHours}
                                                    />
                                                  </div>
                                                  </>
                                                )}
                                              </div>
                                              
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
                                      <div className="text-center py-8 text-yellow-700 dark:text-yellow-600">
                                        No time entries found for this date
                                      </div>
                                    )}
                                  </div>
                              </div>
                            )}

                            {/* Other Time Cards Section (Admins/Supervisors only) */}
                            {otherEntries.length > 0 && (
                              <div className="border-t border-yellow-200 dark:border-yellow-700 pt-4 mt-4">
                                {(() => {
                                  const label = (() => {
                                    if (employeeFilter === 'self') return 'Your Time Card';
                                    if (siteFilter && siteFilter !== 'all' && employeeFilter && employeeFilter !== 'all') {
                                      return `${siteFilter} - ${getBestDisplayName(users.find(u => u.id === employeeFilter))}'s Time Cards`;
                                    }
                                    if (siteFilter && siteFilter !== 'all') return `${siteFilter} Time Cards`;
                                    if (employeeFilter && employeeFilter !== 'all') return `${getBestDisplayName(users.find(u => u.id === employeeFilter))}'s Time Cards`;
                                    return null;
                                  })();
                                  return label ? (
                                    <div className="mb-3">
                                      <h4 className="text-yellow-700 dark:text-yellow-300 font-semibold text-lg">{label}</h4>
                                    </div>
                                  ) : null;
                                })()}
                                <div className={showGrouped ? 'space-y-4' : 'space-y-3'}>
                                    {siteGroups.map(({ site, entries }) => (
                                      <div key={site ?? 'ungrouped'}>
                                        {site && (
                                          <h5 className="text-yellow-700 dark:text-yellow-400 font-semibold text-sm mb-2 mt-1 border-b border-yellow-200 dark:border-yellow-800 pb-1 flex justify-between">
                                            <span>{site}</span>
                                            <span>
                                              {entries.reduce((sum, entry) => sum + getEntryTotalHours(entry), 0).toFixed(2)} hrs
                                            </span>
                                          </h5>
                                        )}
                                        <div className="space-y-3">
                                    {entries.map((entry: any, index: number) => {
                                      const canAccess = canViewEntry(entry, user!);
                                      return (
                                        <div key={entry.id || `other-${index}`}>
                                          <div
                                            className={`bg-yellow-50 dark:bg-yellow-900 dark:bg-opacity-10 border rounded-lg p-3 transition-colors ${
                                              canAccess 
                                                ? 'border-yellow-400 dark:border-yellow-700 hover:border-yellow-600' 
                                                : 'border-gray-400 dark:border-gray-600 opacity-75'
                                            }`}
                                          >
                                            <div className="space-y-2">
                                              {/* Top row — clickable to navigate to edit page */}
                                              <div
                                                className={canAccess ? 'cursor-pointer' : ''}
                                                onClick={() => canAccess && handleEntrySelect(entry.id!)}
                                              >
                                              <div className="flex justify-between items-start">
                                                <span className="text-gray-900 dark:text-yellow-100 font-medium">
                                                  {getBestDisplayName(users.find(u => u.id === entry.userId))}
                                                  <span className="ml-2 text-sm font-normal text-yellow-700 dark:text-yellow-500">
                                                    {userDayTotals[entry.userId]?.toFixed(2) ?? '0.00'} hrs
                                                  </span>
                                                </span>
                                                <div className="flex items-center gap-2">
                                                  <button
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      toggleEntryExpanded(entry.id || `other-${index}`);
                                                    }}
                                                    className="p-1 text-yellow-600 dark:text-yellow-400 hover:text-yellow-500 dark:hover:text-yellow-300"
                                                  >
                                                    {expandedEntries.has(entry.id || `other-${index}`) ? (
                                                      <ChevronUp className="w-4 h-4" />
                                                    ) : (
                                                      <ChevronDown className="w-4 h-4" />
                                                    )}
                                                  </button>
                                                  <span className={`px-2 py-1 rounded text-xs ${
                                                    entry.status === 'draft' ? 'bg-gray-600' :
                                                    entry.status === 'submitted' ? 'bg-green-600' :
                                                    entry.status === 'rejected' ? 'bg-red-600' :
                                                    'bg-blue-600'
                                                  } text-white`}>
                                                    {entry.status === 'submitted' ? (
                                                      <Check className="w-3 h-3" />
                                                    ) : (
                                                      (getStatusDisplay(entry.status) || 'D').charAt(0)
                                                    )}
                                                  </span>
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
                                                </div>
                                              </div>
                                              {entry.job && (
                                                <div className="text-gray-900 dark:text-yellow-100">
                                                  {entry.job}
                                                </div>
                                              )}
                                              <div className="font-medium text-yellow-700 dark:text-yellow-600">
                                                <span className="text-sm">
                                                  Worked {calcHours(entry.clockIn, entry.clockOut) ?? entry.hours}
                                                  {(entry.travelHours ?? 0) > 0 && (
                                                    <> + Travel {entry.travelHours}</>
                                                  )} = Total {((calcHours(entry.clockIn, entry.clockOut) ?? entry.hours) + (entry.travelHours ?? 0)).toFixed(2)}
                                                </span>
                                                {entry.lastEditedBy && (
                                                  <span className="text-xs text-yellow-600 dark:text-yellow-400 ml-2" title={`Last edited by ${entry.lastEditedBy} on ${entry.lastEditedAt ? format(entry.lastEditedAt instanceof Date ? entry.lastEditedAt : (entry.lastEditedAt as any).toDate(), 'MMM d, yyyy HH:mm') : ''}`}>
                                                    Edited by {entry.lastEditedBy}
                                                  </span>
                                                )}
                                              </div>
                                              </div>
                                              
                                              {/* Expanded Details - Inline Editable */}
                                              {expandedEntries.has(entry.id || `other-${index}`) && (
                                                <>
                                                <div className="hidden sm:block">
                                                  <InlineTimecardEdit
                                                    entry={entry}
                                                    user={user!}
                                                    canEdit={canEditEntry(entry, user!)}
                                                    onSave={handleInlineSave}
                                                    calcHours={calcHours}
                                                  />
                                                </div>
                                                <div className="block sm:hidden">
                                                  <InlineTimecardEdit
                                                    entry={entry}
                                                    user={user!}
                                                    canEdit={canEditEntry(entry, user!)}
                                                    onSave={handleInlineSave}
                                                    calcHours={calcHours}
                                                  />
                                                </div>
                                                </>
                                              )}
                                            </div>
                                            
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
                                      </div>
                                    ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            </div>
          )}


          {selectedDates.length === 0 && (
            <div className="bg-yellow-200 dark:bg-black border border-yellow-600 rounded-lg shadow-xl dark:shadow-yellow-900/20 dark:shadow-2xl p-2">
              <h3 className="text-lg font-semibold text-yellow-700 dark:text-yellow-300 mb-4">Select a Date</h3>
              <p className="text-yellow-700 dark:text-yellow-600">Click on a date in the calendar to view or edit time entries.</p>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
