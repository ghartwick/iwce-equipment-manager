import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, Trash2, FileText, Image as ImageIcon, Calendar, User, CheckSquare, Square } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { timecardAttachmentService, TimecardAttachment } from '../services/timecardAttachmentService';
import { UserManagementService, AppUser } from '../services/userManagementService';
import { format, startOfMonth } from 'date-fns';

interface MonthGroup {
  month: Date;
  monthLabel: string;
  attachments: TimecardAttachment[];
}

export default function AttachmentsListPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [attachments, setAttachments] = useState<TimecardAttachment[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [downloading, setDownloading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [hoveredAttachment, setHoveredAttachment] = useState<TimecardAttachment | null>(null);

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    const load = async () => {
      try {
        const [allAttachments, allUsers] = await Promise.all([
          timecardAttachmentService.getAllAttachments(),
          new UserManagementService().getAllUsers(),
        ]);
        setAttachments(
          allAttachments.sort((a, b) => b.date.getTime() - a.date.getTime())
        );
        setUsers(allUsers);
      } catch (error) {
        console.error('Failed to load attachments:', error);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const getUserName = (userId: string) => {
    const u = users.find(x => x.id === userId);
    return u?.name || u?.username || userId;
  };

  const grouped: MonthGroup[] = useMemo(() => {
    const map = new Map<string, MonthGroup>();
    attachments.forEach(attachment => {
      const monthKey = format(attachment.date, 'yyyy-MM');
      const monthStart = startOfMonth(attachment.date);
      const label = format(monthStart, 'MMMM yyyy');
      if (!map.has(monthKey)) {
        map.set(monthKey, { month: monthStart, monthLabel: label, attachments: [] });
      }
      map.get(monthKey)!.attachments.push(attachment);
    });
    return Array.from(map.values()).sort((a, b) => b.month.getTime() - a.month.getTime());
  }, [attachments]);

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleMonth = (attachmentsInMonth: TimecardAttachment[], selected: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      attachmentsInMonth.forEach(a => {
        if (!a.id) return;
        if (selected) next.add(a.id);
        else next.delete(a.id);
      });
      return next;
    });
  };

  const isMonthSelected = (attachmentsInMonth: TimecardAttachment[]) =>
    attachmentsInMonth.every(a => a.id && selectedIds.has(a.id)) && attachmentsInMonth.length > 0;

  const isMonthPartial = (attachmentsInMonth: TimecardAttachment[]) =>
    attachmentsInMonth.some(a => a.id && selectedIds.has(a.id)) && !isMonthSelected(attachmentsInMonth);

  const handleDownloadSelected = async () => {
    const selected = attachments.filter(a => a.id && selectedIds.has(a.id));
    if (!selected.length) return;
    setDownloading(true);
    try {
      for (const attachment of selected) {
        const response = await fetch(attachment.fileUrl);
        if (!response.ok) throw new Error(`Failed to download ${attachment.fileName}`);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = attachment.fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      alert('Bulk download failed: ' + (error as Error).message);
    } finally {
      setDownloading(false);
    }
  };

  const handleDeleteSelected = async () => {
    if (!window.confirm(`Delete ${selectedIds.size} selected attachment(s)? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      const selected = attachments.filter(a => a.id && selectedIds.has(a.id));
      await Promise.all(
        selected.map(a => timecardAttachmentService.deleteAttachment(a.id!, a.filePath))
      );
      setAttachments(prev => prev.filter(a => !a.id || !selectedIds.has(a.id)));
      setSelectedIds(new Set());
    } catch (error) {
      alert('Failed to delete attachments.');
    } finally {
      setDeleting(false);
    }
  };

  const isImage = (fileName: string) =>
    /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(fileName);

  const isPdf = (fileName: string) =>
    /\.pdf$/i.test(fileName);

  if (loading) {
    return (
      <div className="min-h-screen bg-yellow-100 dark:bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-600 dark:border-yellow-400 mx-auto mb-4"></div>
          <div className="text-lg text-yellow-600 dark:text-yellow-400">Loading attachments...</div>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-yellow-100 dark:bg-black p-6">
        <div className="max-w-5xl mx-auto bg-yellow-200 dark:bg-gray-900 border border-yellow-600 rounded-xl p-8 text-center">
          <h1 className="text-xl font-bold text-yellow-900 dark:text-yellow-100 mb-4">Admin Access Required</h1>
          <p className="text-yellow-700 dark:text-yellow-400 mb-6">Only administrators can view all attachments.</p>
          <button
            onClick={() => navigate('/timecard')}
            className="px-4 py-2 bg-yellow-600 text-black rounded-lg hover:bg-yellow-500 font-medium"
          >
            Back to Timecard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-yellow-100 dark:bg-black p-4 sm:p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <button
              onClick={() => navigate('/timecard')}
              className="flex items-center text-sm text-yellow-700 dark:text-yellow-400 hover:text-yellow-900 dark:hover:text-yellow-200 mb-2"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to Timecard
            </button>
            <h1 className="text-2xl font-bold text-yellow-900 dark:text-yellow-100">All Attachments</h1>
            <p className="text-sm text-yellow-700 dark:text-yellow-500 mt-1">
              {attachments.length} attachment{attachments.length !== 1 ? 's' : ''} across {grouped.length} month{grouped.length !== 1 ? 's' : ''}
            </p>
          </div>
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleDownloadSelected}
                disabled={downloading}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-50 font-medium transition-colors"
              >
                <Download className="h-4 w-4 mr-2" />
                {downloading ? 'Downloading...' : `Download ${selectedIds.size}`}
              </button>
              <button
                onClick={handleDeleteSelected}
                disabled={deleting}
                className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-500 disabled:opacity-50 font-medium transition-colors"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {deleting ? 'Deleting...' : `Delete ${selectedIds.size}`}
              </button>
            </div>
          )}
        </div>

        {grouped.length === 0 ? (
          <div className="bg-yellow-200 dark:bg-gray-900 border border-yellow-600 rounded-xl p-8 text-center">
            <p className="text-yellow-700 dark:text-yellow-400">No attachments found.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {grouped.map(group => (
              <div key={group.monthLabel} className="bg-yellow-200 dark:bg-gray-900 border border-yellow-600 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between p-4 bg-yellow-300 dark:bg-yellow-900/40 border-b border-yellow-600">
                  <h2 className="text-lg font-bold text-yellow-900 dark:text-yellow-100 flex items-center">
                    <Calendar className="h-5 w-5 mr-2" />
                    {group.monthLabel}
                  </h2>
                  <button
                    onClick={() => toggleMonth(group.attachments, !isMonthSelected(group.attachments))}
                    className="flex items-center text-sm text-yellow-800 dark:text-yellow-300 hover:text-yellow-900 dark:hover:text-yellow-100 font-medium"
                  >
                    {isMonthSelected(group.attachments) ? (
                      <CheckSquare className="h-4 w-4 mr-1" />
                    ) : isMonthPartial(group.attachments) ? (
                      <div className="h-4 w-4 mr-1 border-2 border-yellow-800 dark:border-yellow-300 rounded-sm bg-yellow-800 dark:bg-yellow-300" />
                    ) : (
                      <Square className="h-4 w-4 mr-1" />
                    )}
                    Select {group.attachments.length}
                  </button>
                </div>
                <div className="divide-y divide-yellow-400 dark:divide-yellow-700">
                  {group.attachments.map(attachment => {
                    const selected = attachment.id ? selectedIds.has(attachment.id) : false;
                    return (
                      <div
                        key={attachment.id}
                        className={`p-4 flex items-start gap-4 transition-colors ${
                          selected ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-yellow-100 dark:bg-black'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => attachment.id && toggleSelection(attachment.id)}
                          className="mt-1 h-4 w-4 rounded border-yellow-400 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                        <div
                          className="flex-shrink-0 w-14 h-14 flex items-center justify-center bg-yellow-200 dark:bg-yellow-900/30 rounded-lg border border-yellow-400 dark:border-yellow-700 cursor-pointer"
                          onMouseEnter={() => (isImage(attachment.fileName) || isPdf(attachment.fileName)) && setHoveredAttachment(attachment)}
                          onMouseLeave={() => setHoveredAttachment(null)}
                        >
                          {isImage(attachment.fileName) ? (
                            <img
                              src={attachment.fileUrl}
                              alt={attachment.fileName}
                              className="w-full h-full object-cover rounded-lg"
                            />
                          ) : (
                            <FileText className="h-6 w-6 text-yellow-700 dark:text-yellow-400" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <a
                            href={attachment.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline truncate block"
                          >
                            {attachment.fileName}
                          </a>
                          {attachment.description && (
                            <p className="text-xs text-gray-700 dark:text-yellow-500 mt-1">
                              {attachment.description}
                            </p>
                          )}
                          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-yellow-700 dark:text-yellow-500">
                            <span className="flex items-center">
                              <User className="h-3 w-3 mr-1" />
                              {getUserName(attachment.uploadedBy)}
                            </span>
                            <span className="flex items-center">
                              <Calendar className="h-3 w-3 mr-1" />
                              {format(attachment.date, 'MMM d, yyyy')}
                            </span>
                            <span className="flex items-center">
                              <ImageIcon className="h-3 w-3 mr-1" />
                              {format(attachment.createdAt, 'MMM d, yyyy h:mm a')}
                            </span>
                          </div>
                          <div className="mt-1 text-xs text-yellow-700 dark:text-yellow-500">
                            <span className="font-medium">Site:</span> {attachment.site}
                            {attachment.code && (
                              <span className="ml-2"><span className="font-medium">Code:</span> {attachment.code}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {hoveredAttachment && (isImage(hoveredAttachment.fileName) || isPdf(hoveredAttachment.fileName)) && (
          <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 pointer-events-none">
            {isImage(hoveredAttachment.fileName) ? (
              <div className="relative inline-block" style={{ transform: 'scale(0.75)', transformOrigin: 'center' }}>
                <img
                  src={hoveredAttachment.fileUrl}
                  alt={hoveredAttachment.fileName}
                />
              </div>
            ) : (
              <iframe
                src={hoveredAttachment.fileUrl}
                title={hoveredAttachment.fileName}
                className="w-[80vw] h-[80vh] max-w-4xl bg-white rounded-lg shadow-2xl"
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
