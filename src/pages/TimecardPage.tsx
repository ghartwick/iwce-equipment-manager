import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronUp, Check } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useTimecard } from '../hooks/useTimecard';
import { InlineTimecardEdit } from '../components/InlineTimecardEdit';
import { UserManagementService, AppUser } from '../services/userManagementService';
import { codeManagementService } from '../services/codeManagementService';
import { siteManagementService, Site } from '../services/siteManagementService';
import { TimecardAttachment, timecardAttachmentService } from '../services/timecardAttachmentService';
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
  const [attachmentDescription, setAttachmentDescription] = useState('');
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);
  const [attachmentSubmitting, setAttachmentSubmitting] = useState(false);
  const [attachmentsForDate, setAttachmentsForDate] = useState<TimecardAttachment[]>([]);
  const [sitesData, setSitesData] = useState<Site[]>([]);
  const [codeOptionsState, setCodeOptionsState] = useState<string[]>([]);
  const [attachmentCounts, setAttachmentCounts] = useState<Record<string, number>>({});
  const [lockedDates, setLockedDates] = useState<Set<string>>(new Set());

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
        const counts: Record<string, number> = {};
        
        attachments.forEach(attachment => {
          const key = formatDateKey(new Date(attachment.date));
          counts[key] = (counts[key] || 0) + 1;
        });
        
        setAttachmentCounts(counts);
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
        setAttachmentsForDate(attachments);
      } catch (error) {
        setAttachmentsForDate([]);
      }
    };

    loadAttachmentsForDate();
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
    ? format(selectedDates[0], 'MMM d, yyyy')
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
        return selectedSite.codes.map(code => code.name);
      }
    }
    return codeOptionsState;
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
    if (attachmentFiles.length === 0) {
      alert('Please select at least one file.');
      return;
    }
    if (!user) {
      alert('User not authenticated.');
      return;
    }

    setAttachmentSubmitting(true);
    try {
      // Upload all files
      for (const file of attachmentFiles) {
        await timecardAttachmentService.uploadAttachment({
          date: selectedDates[0],
          site: attachmentSite,
          code: attachmentCode,
          description: attachmentDescription,
          file,
          uploadedBy: user.id
        });
      }
      
      setAttachmentSite('');
      setAttachmentCode('');
      setAttachmentDescription('');
      setAttachmentFiles([]);
      setShowAttachments(false);
      // Update attachment counts
      setAttachmentCounts(prev => {
        const next = { ...prev };
        const key = formatDateKey(selectedDates[0]);
        next[key] = (next[key] || 0) + 1;
        return next;
      });
      // Refresh attachment list for the selected date
      const date = selectedDates[0];
      const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const endOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59);
      const attachments = await timecardAttachmentService.getAttachmentsForRange(startOfDay, endOfDay);
      setAttachmentsForDate(attachments);
      alert(`${attachmentFiles.length} attachment(s) uploaded successfully.`);
    } catch (error) {
      console.error('Error uploading attachment:', error);
      alert('Failed to upload attachment: ' + (error as Error).message);
    } finally {
      setAttachmentSubmitting(false);
    }
  };

  const handleDeleteAttachment = async (attachment: TimecardAttachment) => {
    if (!window.confirm('Are you sure you want to delete this attachment?')) return;
    if (!attachment.id) return;

    try {
      await timecardAttachmentService.deleteAttachment(attachment.id, attachment.filePath);
      // Refresh attachment list
      setAttachmentsForDate(prev => prev.filter(a => a.id !== attachment.id));
      // Update attachment counts
      const date = selectedDates[0];
      setAttachmentCounts(prev => {
        const next = { ...prev };
        const remainingAttachments = attachmentsForDate.filter(a => a.id !== attachment.id);
        if (remainingAttachments.length === 0) {
          delete next[formatDateKey(date)];
        } else {
          next[formatDateKey(date)] = remainingAttachments.length;
        }
        return next;
      });
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
                const attachmentCount = attachmentCounts[dateKey] || 0;
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
                        const submittedCount = dayEntries.filter(entry => entry.status === 'submitted').length;
                        const draftCount = dayEntries.filter(entry => !entry.status || entry.status === 'draft').length;

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
                  Time Entries for {selectedDateLabel}
                </h3>
                <div className="flex flex-wrap gap-2">
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
                  <button
                    onClick={() => setShowAttachments(prev => !prev)}
                    className="px-3 py-1.5 text-sm bg-yellow-300 dark:bg-yellow-800 text-yellow-900 dark:text-yellow-100 rounded-lg hover:bg-yellow-400 dark:hover:bg-yellow-700 font-medium transition-colors whitespace-nowrap"
                  >
                    Attachments
                  </button>
                  {user?.role === 'admin' && selectedDates.length > 0 && (
                    <button
                      onClick={() => handleToggleLock(selectedDates)}
                      className="px-3 py-1.5 text-sm bg-gray-300 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg hover:bg-gray-400 dark:hover:bg-gray-600 font-medium transition-colors whitespace-nowrap"
                      title={selectedDates.length === 1 ? (isDateLocked ? 'Unlock date' : 'Lock date') : (selectedDates.some(d => lockedDates.has(formatDateKey(d))) ? 'Unlock dates' : 'Lock dates')}
                    >
                      {selectedDates.length === 1 ? (isDateLocked ? 'Unlock' : 'Lock') : (selectedDates.some(d => lockedDates.has(formatDateKey(d))) ? 'Unlock All' : 'Lock All')}
                    </button>
                  )}
                  <button
                    onClick={() => setSelectedDates([])}
                    className="px-3 py-1.5 text-sm bg-yellow-300 dark:bg-yellow-800 text-yellow-900 dark:text-yellow-100 rounded-lg hover:bg-yellow-400 dark:hover:bg-yellow-700 font-medium transition-colors whitespace-nowrap"
                  >
                    Clear Selection
                  </button>
                  {(user?.role === 'admin' || user?.role === 'supervisor') && (
                    <button
                      onClick={handleExportPDF}
                      className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-500 font-medium transition-colors whitespace-nowrap"
                    >
                      Export
                    </button>
                  )}
                </div>
              </div>

              {showAttachments && (
                <div className="mb-6">
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
                        <option key={code} value={code}>{code}</option>
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
                      onChange={(e) => setAttachmentFiles(Array.from(e.target.files || []))}
                      className="w-full px-3 py-2 bg-yellow-200 dark:bg-black border border-yellow-400 dark:border-yellow-700 rounded-lg text-gray-900 dark:text-yellow-100 focus:outline-none focus:border-yellow-400"
                    />
                    {attachmentFiles.length > 0 && (
                      <p className="mt-1 text-xs text-yellow-700 dark:text-yellow-500">
                        Selected: {attachmentFiles.length} file(s) - {attachmentFiles.map(f => f.name).join(', ')}
                      </p>
                    )}
                  </div>
                  <div className="sm:col-span-3">
                    <label className="block text-sm font-medium text-yellow-700 dark:text-yellow-600 mb-2">
                      Description
                    </label>
                    <input
                      type="text"
                      value={attachmentDescription}
                      onChange={(e) => setAttachmentDescription(e.target.value)}
                      placeholder="Enter a description for this attachment"
                      className="w-full px-3 py-2 bg-yellow-200 dark:bg-black border border-yellow-400 dark:border-yellow-700 rounded-lg text-gray-900 dark:text-yellow-100 focus:outline-none focus:border-yellow-400"
                    />
                  </div>
                </div>
                  <div className="mt-4 flex justify-end">
                    <button
                      type="button"
                      onClick={handleAttachmentSubmit}
                      disabled={attachmentSubmitting || selectedDates.length !== 1}
                      className="px-3 py-1.5 text-sm bg-yellow-600 text-black rounded-lg hover:bg-yellow-500 font-medium transition-colors whitespace-nowrap disabled:opacity-50"
                      title={selectedDates.length === 1 ? 'Upload attachment' : 'Select a single date to attach'}
                    >
                      {attachmentSubmitting ? 'Uploading...' : 'Submit Attachment'}
                    </button>
                  </div>

                  {attachmentsForDate.length > 0 && (
                    <div className="mt-4 border-t border-yellow-400 dark:border-yellow-700 pt-4">
                      <h4 className="text-sm font-semibold text-yellow-700 dark:text-yellow-300 mb-3">
                        Attachments for this date ({attachmentsForDate.length})
                      </h4>
                      <div className="space-y-2">
                        {attachmentsForDate.map((attachment) => {
                          const uploader = users.find(u => u.id === attachment.uploadedBy);
                          return (
                            <div
                              key={attachment.id}
                              className="bg-yellow-100 dark:bg-black border border-yellow-400 dark:border-yellow-700 rounded-lg p-3"
                            >
                              <div className="flex items-start justify-between gap-2">
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
                    </div>
                  )}
                </div>
              )}

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
                      <option value="">None</option>
                      <option value="all">All</option>
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
                      <option value="">None</option>
                      {(user?.role === 'supervisor' || user?.role === 'admin') && (
                        <option value="self">Your Time Card</option>
                      )}
                      <option value="all">All</option>
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
                          
                          if (showAll) {
                            // "All" selected - show all other users' entries
                            return otherUsersEntries;
                          }
                          
                          if (!hasSpecificFilter) {
                            // No filters selected - don't show other users' entries
                            return [];
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

                        const showGrouped = siteFilter === 'all' || employeeFilter === 'all';
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
                                                {(expandedEntries.has(entry.id || `your-${index}`) || canEditEntry(entry, user!)) && (
                                                  <>
                                                  <div className="hidden sm:block">
                                                    {expandedEntries.has(entry.id || `your-${index}`) && (
                                                      <InlineTimecardEdit
                                                        entry={entry}
                                                        user={user!}
                                                        canEdit={canEditEntry(entry, user!)}
                                                        onSave={handleInlineSave}
                                                        calcHours={calcHours}
                                                      />
                                                    )}
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
                                <div className="mb-3">
                                  <h4 className="text-yellow-700 dark:text-yellow-300 font-semibold text-lg">
                                    {(() => {
                                      if (siteFilter === 'all' || employeeFilter === 'all') {
                                        return 'All Time Cards';
                                      } else if (employeeFilter === 'self') {
                                        return 'Your Time Card';
                                      } else if (siteFilter && siteFilter !== 'all' && employeeFilter && employeeFilter !== 'all') {
                                        const employeeName = getBestDisplayName(users.find(u => u.id === employeeFilter));
                                        return `${siteFilter} - ${employeeName}'s Time Cards`;
                                      } else if (siteFilter && siteFilter !== 'all') {
                                        return `${siteFilter} Time Cards`;
                                      } else if (employeeFilter && employeeFilter !== 'all') {
                                        return `${getBestDisplayName(users.find(u => u.id === employeeFilter))}'s Time Cards`;
                                      } else {
                                        return 'Other Time Cards';
                                      }
                                    })()}
                                  </h4>
                                </div>
                                <div className={showGrouped ? 'space-y-4' : 'space-y-3'}>
                                    {siteGroups.map(({ site, entries }) => (
                                      <div key={site ?? 'ungrouped'}>
                                        {site && (
                                          <h5 className="text-yellow-700 dark:text-yellow-400 font-semibold text-sm mb-2 mt-1 border-b border-yellow-200 dark:border-yellow-800 pb-1">
                                            {site}
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
                                              {(expandedEntries.has(entry.id || `other-${index}`) || canEditEntry(entry, user!)) && (
                                                <>
                                                <div className="hidden sm:block">
                                                  {expandedEntries.has(entry.id || `other-${index}`) && (
                                                    <InlineTimecardEdit
                                                      entry={entry}
                                                      user={user!}
                                                      canEdit={canEditEntry(entry, user!)}
                                                      onSave={handleInlineSave}
                                                      calcHours={calcHours}
                                                    />
                                                  )}
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
