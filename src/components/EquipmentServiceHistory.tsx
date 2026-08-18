import { useState, useEffect, useMemo } from 'react';
import { X, FileDown, Wrench, ClipboardList, AlertTriangle, StickyNote, CheckCircle2, ExternalLink, ChevronDown, ChevronRight, Ban, RotateCcw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { maintenanceHistoryFirebaseService, MaintenanceReport } from '../services/maintenanceHistoryFirebaseService';
import { shopHistoryFirebaseService, ShopReport } from '../services/shopHistoryFirebaseService';
import { equipmentServiceLogService, ServiceLogEntry } from '../services/equipmentServiceLogService';
import { maintenanceCategoriesService } from '../services/maintenanceCategoriesService';
import { generateServiceHistoryPdf } from '../utils/serviceHistoryPdf';
import { EquipmentMaintenance } from '../types';

type TimelineKind = 'maintenance_card' | 'service_card' | 'flag' | 'note' | 'resolved';

interface TimelineEvent {
  id: string;
  kind: TimelineKind;
  date: string;
  summary: string;
  user: string;
  details: string[];
  link?: { label: string; path: string };
  // Present on inspection cards that carry a meter reading, enabling the
  // admin-only void action.
  reading?: {
    reportId: string;
    value: number;
    voided: boolean;
    voidedBy?: string;
    voidReason?: string;
  };
}

interface EquipmentServiceHistoryProps {
  equipmentId: string;
  equipmentName: string;
  site?: string;
  maintenanceItems?: string[];
  onClose: () => void;
}

const KIND_META: Record<TimelineKind, { label: string; Icon: typeof Wrench; classes: string }> = {
  maintenance_card: { label: 'Inspection Card', Icon: ClipboardList, classes: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' },
  service_card: { label: 'Service Card', Icon: Wrench, classes: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300' },
  flag: { label: 'Repair Flagged', Icon: AlertTriangle, classes: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300' },
  note: { label: 'Note', Icon: StickyNote, classes: 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300' },
  resolved: { label: 'Repair Resolved', Icon: CheckCircle2, classes: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300' },
};

export function EquipmentServiceHistory({
  equipmentId,
  equipmentName,
  site,
  maintenanceItems,
  onClose,
}: EquipmentServiceHistoryProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canVoidReadings = user?.role === 'admin';
  const [voidingId, setVoidingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [maintenanceReports, setMaintenanceReports] = useState<MaintenanceReport[]>([]);
  const [shopReports, setShopReports] = useState<ShopReport[]>([]);
  const [logEntries, setLogEntries] = useState<ServiceLogEntry[]>([]);
  const [filter, setFilter] = useState<'all' | 'maintenance' | 'service' | 'repairs'>('all');
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const [maintenance, shop, log] = await Promise.all([
          maintenanceHistoryFirebaseService.getEquipmentMaintenanceHistory(equipmentId),
          shopHistoryFirebaseService.getEquipmentShopHistory(equipmentId),
          equipmentServiceLogService.getEquipmentLog(equipmentId),
        ]);
        if (cancelled) return;
        setMaintenanceReports(maintenance);
        setShopReports(shop);
        setLogEntries(log);
      } catch (error) {
        console.error('Failed to load equipment service history:', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [equipmentId]);

  const events = useMemo<TimelineEvent[]>(() => {
    const categories = maintenanceCategoriesService.getCategories(maintenanceItems);
    const all: TimelineEvent[] = [];

    maintenanceReports.forEach(report => {
      const m = report.maintenance as EquipmentMaintenance;
      const details: string[] = [];
      if (m.hours != null) {
        details.push(report.readingVoided
          ? `Hours/KM: ${m.hours} (VOIDED — excluded from service scheduling)`
          : `Hours/KM: ${m.hours}`);
      }
      categories.forEach(({ key, label }) => {
        const value = (m as any)[key];
        if (value) details.push(`${label}: ${value}`);
      });
      if (m.lastServicedDate) details.push(`Last serviced: ${m.lastServicedDate}`);
      if (m.notes?.trim()) details.push(`Notes: ${m.notes.trim()}`);

      const repairCount = categories.filter(c => (m as any)[c.key] === 'Repair').length;
      all.push({
        id: `maint-${report.id}`,
        kind: 'maintenance_card',
        date: report.createdAt,
        summary: repairCount > 0
          ? `Inspection card filed — ${repairCount} item(s) flagged for repair`
          : 'Inspection card filed',
        user: report.createdBy,
        details,
        link: { label: 'Open inspection card', path: `/inventory/equipment/${equipmentId}` },
        reading: m.hours != null
          ? {
              reportId: report.id,
              value: m.hours,
              voided: !!report.readingVoided,
              voidedBy: report.readingVoidedBy,
              voidReason: report.readingVoidReason,
            }
          : undefined,
      });
    });

    shopReports.forEach(report => {
      const details: string[] = [];
      if (report.intervalIds?.length) {
        details.push(`Intervals completed: ${report.intervalIds.length}`);
      } else if (report.serviceType) {
        details.push(`Service type: ${report.serviceType === 'major' ? 'Major' : 'Minor'}`);
      }
      if (report.lastServicedDate) details.push(`Serviced date: ${report.lastServicedDate}`);
      if (report.servicedAt != null) details.push(`Serviced at: ${report.servicedAt.toLocaleString()} hrs/km`);
      if (report.nextServiceAt != null) details.push(`Next service at: ${report.nextServiceAt.toLocaleString()} hrs/km`);
      if (report.notes?.trim()) details.push(`Notes: ${report.notes.trim()}`);

      all.push({
        id: `shop-${report.id}`,
        kind: 'service_card',
        date: report.createdAt,
        summary: 'Service card created',
        user: report.createdBy,
        details,
        link: { label: 'Open service card', path: `/inventory/equipment/${equipmentId}/service` },
      });
    });

    logEntries.forEach(entry => {
      // Service-card log rows duplicate the shop report row above, so skip them.
      if (entry.type === 'service_card') return;
      const kind: TimelineKind =
        entry.type === 'maintenance_flag' ? 'flag' :
        entry.type === 'repair_resolved' ? 'resolved' : 'note';
      all.push({
        id: `log-${entry.id}`,
        kind,
        date: entry.createdAt,
        summary: entry.description,
        user: entry.createdBy,
        details: [],
        link: entry.linkedReportId
          ? {
              label: entry.linkedReportType === 'shop' ? 'Open service card' : 'Open inspection card',
              path: entry.linkedReportType === 'shop'
                ? `/inventory/equipment/${equipmentId}/service`
                : `/inventory/equipment/${equipmentId}`,
            }
          : undefined,
      });
    });

    return all.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [maintenanceReports, shopReports, logEntries, maintenanceItems, equipmentId]);

  const visibleEvents = useMemo(() => {
    switch (filter) {
      case 'maintenance': return events.filter(e => e.kind === 'maintenance_card');
      case 'service': return events.filter(e => e.kind === 'service_card');
      case 'repairs': return events.filter(e => e.kind === 'flag' || e.kind === 'resolved' || e.kind === 'note');
      default: return events;
    }
  }, [events, filter]);

  useEffect(() => {
    setCollapsedIds(new Set(events.filter(e => e.kind === 'maintenance_card').map(e => e.id)));
  }, [events]);

  // Voiding a reading removes it from schedule calculations and from the
  // entry-time validation floor, without deleting the inspection record.
  const handleToggleReadingVoid = async (reading: NonNullable<TimelineEvent['reading']>) => {
    if (!user) return;
    const nextVoided = !reading.voided;
    let reason: string | undefined;
    if (nextVoided) {
      const entered = window.prompt(
        `Void the reading of ${reading.value.toLocaleString()}?\n\nIt will be excluded from all service scheduling. Optionally record why:`,
        ''
      );
      if (entered === null) return;
      reason = entered.trim() || undefined;
    }

    setVoidingId(reading.reportId);
    try {
      await maintenanceHistoryFirebaseService.setReadingVoided(
        reading.reportId,
        nextVoided,
        { username: user.username },
        reason
      );
      setMaintenanceReports(prev => prev.map(r => r.id === reading.reportId
        ? {
            ...r,
            readingVoided: nextVoided,
            readingVoidedBy: nextVoided ? user.username : undefined,
            readingVoidedAt: nextVoided ? new Date().toISOString() : undefined,
            readingVoidReason: nextVoided ? reason : undefined,
          }
        : r));
    } catch (error) {
      console.error('Failed to update reading void state:', error);
      alert('Error updating the reading. Please try again.');
    } finally {
      setVoidingId(null);
    }
  };

  const handleExport = () => {
    generateServiceHistoryPdf({
      equipmentName,
      site,
      events: visibleEvents.map(e => ({
        date: e.date,
        kind: KIND_META[e.kind].label,
        summary: e.summary,
        user: e.user,
        details: e.details,
      })),
    });
  };

  const filters: { key: typeof filter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'maintenance', label: 'Inspection' },
    { key: 'service', label: 'Service' },
    { key: 'repairs', label: 'Repairs & Notes' },
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-yellow-200 dark:bg-black border border-yellow-600 rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between p-4 border-b border-yellow-400 dark:border-yellow-700">
          <div>
            <h2 className="text-base sm:text-lg font-semibold text-yellow-700 dark:text-yellow-300">
              Service &amp; Repair History
            </h2>
            <p className="text-xs text-yellow-600 dark:text-yellow-500 mt-0.5">{equipmentName}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExport}
              disabled={loading || visibleEvents.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-yellow-600 text-black rounded-md hover:bg-yellow-500 text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FileDown className="h-4 w-4" />
              Export PDF
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-yellow-700 dark:text-yellow-300 hover:text-red-600 dark:hover:text-red-400"
              aria-label="Close history"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5 px-4 py-2 border-b border-yellow-300 dark:border-yellow-800">
          {filters.map(f => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                filter === f.key
                  ? 'bg-yellow-600 text-black'
                  : 'text-yellow-700 dark:text-yellow-400 border border-yellow-500 dark:border-yellow-700 hover:bg-yellow-100 dark:hover:bg-yellow-900/40'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-600 dark:border-yellow-400 mx-auto" />
            </div>
          ) : visibleEvents.length === 0 ? (
            <p className="text-xs text-yellow-600 dark:text-yellow-400">No history recorded for this unit.</p>
          ) : (
            visibleEvents.map(event => {
              const { label, Icon, classes } = KIND_META[event.kind];
              const isCollapsed = collapsedIds.has(event.id);
              const canCollapse = event.kind === 'maintenance_card';
              return (
                <div
                  key={event.id}
                  className="rounded-lg border border-yellow-300 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/10 px-3 py-2"
                >
                  <div className="flex items-start gap-2">
                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium flex-shrink-0 ${classes}`}>
                      <Icon className="h-3 w-3" />
                      {label}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm text-gray-900 dark:text-yellow-100">{event.summary}</p>
                        {canCollapse && (
                          <button
                            type="button"
                            onClick={() => setCollapsedIds(prev => {
                              const next = new Set(prev);
                              if (next.has(event.id)) next.delete(event.id);
                              else next.add(event.id);
                              return next;
                            })}
                            className="text-yellow-700 dark:text-yellow-400 hover:text-yellow-500 flex-shrink-0"
                            aria-label={isCollapsed ? 'Expand inspection card' : 'Collapse inspection card'}
                          >
                            {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </button>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {new Date(event.date).toLocaleString('en-US', {
                          month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
                        })}
                        {' · '}{event.user}
                      </p>
                      {(!canCollapse || !isCollapsed) && event.details.length > 0 && (
                        <ul className="mt-1.5 space-y-0.5">
                          {event.details.map((detail, i) => (
                            <li key={i} className="text-xs text-gray-700 dark:text-gray-300">- {detail}</li>
                          ))}
                        </ul>
                      )}
                      {(!canCollapse || !isCollapsed) && event.reading && (
                        <div className="mt-1.5">
                          {event.reading.voided && (
                            <p className="text-xs text-red-600 dark:text-red-400">
                              Reading voided{event.reading.voidedBy ? ` by ${event.reading.voidedBy}` : ''}
                              {event.reading.voidReason ? ` — ${event.reading.voidReason}` : ''}
                            </p>
                          )}
                          {canVoidReadings && (
                            <button
                              type="button"
                              onClick={() => handleToggleReadingVoid(event.reading!)}
                              disabled={voidingId === event.reading.reportId}
                              className="mt-1 inline-flex items-center gap-1 text-xs text-red-700 dark:text-red-400 underline hover:text-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {event.reading.voided
                                ? <><RotateCcw className="h-3 w-3" />Restore reading</>
                                : <><Ban className="h-3 w-3" />Void reading</>}
                            </button>
                          )}
                        </div>
                      )}
                      {(!canCollapse || !isCollapsed) && event.link && (
                        <button
                          type="button"
                          onClick={() => { navigate(event.link!.path); onClose(); }}
                          className="mt-1.5 inline-flex items-center gap-1 text-xs text-yellow-700 dark:text-yellow-400 underline hover:text-yellow-500"
                        >
                          <ExternalLink className="h-3 w-3" />
                          {event.link.label}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
