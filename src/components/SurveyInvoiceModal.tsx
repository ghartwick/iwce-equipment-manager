import { useState, useMemo, useEffect } from 'react';
import { X, ChevronDown, ChevronRight, FileText, Download, Loader2, Trash2 } from 'lucide-react';
import { SurveyTimeEntry } from '../services/surveyTimecardService';
import { surveyTimecardService } from '../services/surveyTimecardService';
import { invoiceService, Invoice, buildInvoiceLineItems } from '../services/invoiceService';
import { generateInvoicePdf } from '../utils/invoicePdf';
import { format } from 'date-fns';

interface ModalUser {
  id: string;
  username: string;
  name: string;
}

interface SurveyInvoiceModalProps {
  open: boolean;
  onClose: () => void;
  // Entries already filtered by canSeeEntry (all dates).
  visibleEntries: SurveyTimeEntry[];
  user: ModalUser;
  clientFilter: string;
  siteFilter: string;
  entryTotalCost: (entry: SurveyTimeEntry) => number;
  onInvoiced: () => void;
}

interface SiteGroup {
  key: string;
  clientId: string;
  clientName: string;
  site: string;
  entries: SurveyTimeEntry[];
}

interface ClientGroup {
  clientId: string;
  clientName: string;
  sites: SiteGroup[];
}

export function SurveyInvoiceModal({
  open,
  onClose,
  visibleEntries,
  user,
  clientFilter,
  siteFilter,
  entryTotalCost,
  onInvoiced,
}: SurveyInvoiceModalProps) {
  const [tab, setTab] = useState<'new' | 'history'>('new');
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [generating, setGenerating] = useState(false);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());
  const [expandedInvoices, setExpandedInvoices] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const invoiceableEntries = useMemo(
    () =>
      visibleEntries
        .filter(e => e.status === 'submitted' && !e.invoiceId)
        .filter(e => !clientFilter || e.clientName === clientFilter)
        .filter(e => !siteFilter || e.site === siteFilter),
    [visibleEntries, clientFilter, siteFilter]
  );

  const clientGroups = useMemo<ClientGroup[]>(() => {
    const siteMap = new Map<string, SiteGroup>();
    for (const e of invoiceableEntries) {
      const key = `${e.clientId}||${e.site}`;
      if (!siteMap.has(key)) {
        siteMap.set(key, { key, clientId: e.clientId, clientName: e.clientName, site: e.site, entries: [] });
      }
      siteMap.get(key)!.entries.push(e);
    }
    const siteGroups = [...siteMap.values()].sort(
      (a, b) => a.clientName.localeCompare(b.clientName) || a.site.localeCompare(b.site)
    );
    const clientMap = new Map<string, ClientGroup>();
    for (const sg of siteGroups) {
      if (!clientMap.has(sg.clientId)) {
        clientMap.set(sg.clientId, { clientId: sg.clientId, clientName: sg.clientName, sites: [] });
      }
      clientMap.get(sg.clientId)!.sites.push(sg);
    }
    return [...clientMap.values()].sort((a, b) => a.clientName.localeCompare(b.clientName));
  }, [invoiceableEntries]);

  useEffect(() => {
    if (open && tab === 'history') {
      setLoadingInvoices(true);
      invoiceService
        .getAllInvoices()
        .then(setInvoices)
        .catch(() => setError('Failed to load invoices'))
        .finally(() => setLoadingInvoices(false));
    }
  }, [open, tab]);

  useEffect(() => {
    if (!open) {
      setExpandedKey(null);
      setSelectedIds(new Set());
      setError(null);
      setTab('new');
    }
  }, [open]);

  if (!open) return null;

  const toggleGroup = (group: SiteGroup) => {
    if (expandedKey === group.key) {
      setExpandedKey(null);
      return;
    }
    setExpandedKey(group.key);
    // Default-select all entries in the group.
    setSelectedIds(new Set(group.entries.map(e => e.id!).filter(Boolean)));
  };

  const toggleEntry = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleGenerate = async (group: SiteGroup) => {
    const chosen = group.entries.filter(e => e.id && selectedIds.has(e.id));
    if (chosen.length === 0) {
      setError('Select at least one time card');
      return;
    }
    setGenerating(true);
    setError(null);
    try {
      const { seq, invoiceNumber } = await invoiceService.getNextInvoiceNumber();
      const lineItems = buildInvoiceLineItems(chosen);
      const subtotal = Math.round(lineItems.reduce((s, li) => s + li.amount, 0) * 100) / 100;
      const times = chosen.map(e => e.date.getTime());
      const invoiceData: Omit<Invoice, 'id' | 'createdAt'> = {
        invoiceNumber,
        seq,
        clientId: group.clientId,
        clientName: group.clientName,
        site: group.site,
        entryIds: chosen.map(e => e.id!),
        lineItems,
        subtotal,
        total: subtotal,
        dateFrom: new Date(Math.min(...times)),
        dateTo: new Date(Math.max(...times)),
        createdBy: user.id,
        createdByName: user.name || user.username,
      };
      const id = await invoiceService.createInvoice(invoiceData);
      await surveyTimecardService.markEntriesInvoiced(chosen.map(e => e.id!), id, invoiceNumber);
      generateInvoicePdf({ ...invoiceData, id, createdAt: new Date() });
      onInvoiced();
      onClose();
    } catch (err) {
      console.error('Failed to generate invoice', err);
      setError('Failed to generate invoice');
    } finally {
      setGenerating(false);
    }
  };

  const handleDeleteInvoice = async (inv: Invoice) => {
    if (!inv.id) return;
    const ok = window.confirm(
      `Delete invoice ${inv.invoiceNumber} (${inv.clientName} — ${inv.site})?\n\nIts ${inv.entryIds.length} time card(s) will return to the uninvoiced list.`
    );
    if (!ok) return;
    setDeletingId(inv.id);
    setError(null);
    try {
      await invoiceService.deleteInvoice(inv.id);
      await surveyTimecardService.unmarkEntriesInvoiced(inv.entryIds);
      setInvoices(prev => prev.filter(i => i.id !== inv.id));
      onInvoiced();
    } catch (err) {
      console.error('Failed to delete invoice', err);
      setError('Failed to delete invoice');
    } finally {
      setDeletingId(null);
    }
  };

  const tabClass = (active: boolean) =>
    `px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
      active
        ? 'bg-yellow-600 text-black'
        : 'text-yellow-700 dark:text-yellow-400 hover:bg-yellow-100 dark:hover:bg-yellow-900/30'
    }`;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 overflow-y-auto">
      <div className="w-full max-w-3xl bg-yellow-100 dark:bg-zinc-950 border border-yellow-600 rounded-xl shadow-2xl my-8">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-yellow-300 dark:border-yellow-800">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
            <h2 className="text-lg font-semibold text-yellow-700 dark:text-yellow-300">Invoicing</h2>
          </div>
          <button
            onClick={onClose}
            className="text-yellow-600 dark:text-yellow-400 hover:text-yellow-800 dark:hover:text-yellow-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 px-5 pt-4">
          <button className={tabClass(tab === 'new')} onClick={() => setTab('new')}>
            New Invoice
          </button>
          <button className={tabClass(tab === 'history')} onClick={() => setTab('history')}>
            Past Invoices
          </button>
        </div>

        {error && (
          <div className="mx-5 mt-3 p-2 bg-red-100 dark:bg-red-900/30 border border-red-500 rounded-lg text-red-700 dark:text-red-300 text-sm">
            {error}
          </div>
        )}

        <div className="p-5 max-h-[65vh] overflow-y-auto">
          {tab === 'new' ? (
            clientGroups.length === 0 ? (
              <div className="text-center py-10 text-yellow-600 dark:text-yellow-500">
                No submitted, uninvoiced time cards
                {(clientFilter || siteFilter) ? ' for the current filters.' : '.'}
              </div>
            ) : (
              <div className="space-y-3">
                {clientGroups.map(client => {
                  const clientOpen = expandedClients.has(client.clientId);
                  const clientTotal = client.sites.reduce((sum, site) =>
                    sum + site.entries.reduce((s, e) => s + entryTotalCost(e), 0), 0);
                  const clientCards = client.sites.reduce((sum, site) => sum + site.entries.length, 0);
                  return (
                    <div
                      key={client.clientId}
                      className="border border-yellow-300 dark:border-yellow-800 rounded-lg overflow-hidden"
                    >
                      <button
                        onClick={() => setExpandedClients(prev => {
                          const next = new Set(prev);
                          if (next.has(client.clientId)) next.delete(client.clientId);
                          else next.add(client.clientId);
                          return next;
                        })}
                        className="w-full flex items-center justify-between px-4 py-3 bg-yellow-50 dark:bg-yellow-900/10 hover:bg-yellow-100 dark:hover:bg-yellow-900/20 transition-colors text-left"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {clientOpen ? (
                            <ChevronDown className="h-4 w-4 text-yellow-600 dark:text-yellow-400 shrink-0" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-yellow-600 dark:text-yellow-400 shrink-0" />
                          )}
                          <span className="font-medium text-gray-900 dark:text-yellow-100 truncate">{client.clientName}</span>
                          <span className="text-xs text-yellow-600 dark:text-yellow-500">({clientCards} card{clientCards !== 1 ? 's' : ''})</span>
                        </div>
                        <span className="text-sm font-semibold text-gray-900 dark:text-yellow-100 shrink-0">
                          ${clientTotal.toFixed(2)}
                        </span>
                      </button>

                      {clientOpen && (
                        <div className="border-t border-yellow-200 dark:border-yellow-800 divide-y divide-yellow-200 dark:divide-yellow-900">
                          {client.sites.map(siteGroup => {
                            const isOpen = expandedKey === siteGroup.key;
                            const groupTotal = siteGroup.entries.reduce((s, e) => s + entryTotalCost(e), 0);
                            const selectedInGroup = siteGroup.entries.filter(e => e.id && selectedIds.has(e.id));
                            const selectedTotal = selectedInGroup.reduce((s, e) => s + entryTotalCost(e), 0);
                            return (
                              <div key={siteGroup.key}>
                                <button
                                  onClick={() => toggleGroup(siteGroup)}
                                  className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-yellow-50 dark:hover:bg-yellow-900/10 transition-colors text-left"
                                >
                                  <div className="flex items-center gap-2">
                                    {isOpen ? (
                                      <ChevronDown className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                                    ) : (
                                      <ChevronRight className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                                    )}
                                    <span className="font-medium text-gray-900 dark:text-yellow-100">{siteGroup.site}</span>
                                    <span className="text-xs text-yellow-600 dark:text-yellow-500">
                                      {siteGroup.entries.length} card{siteGroup.entries.length !== 1 ? 's' : ''}
                                    </span>
                                  </div>
                                  <span className="text-sm font-semibold text-gray-900 dark:text-yellow-100">
                                    ${groupTotal.toFixed(2)}
                                  </span>
                                </button>

                                {isOpen && (
                                  <div className="px-4 pb-3">
                                    <div className="divide-y divide-yellow-200 dark:divide-yellow-900 border border-yellow-200 dark:border-yellow-800 rounded-lg overflow-hidden">
                                      {siteGroup.entries.map(entry => {
                                        const checked = entry.id ? selectedIds.has(entry.id) : false;
                                        return (
                                          <label
                                            key={entry.id}
                                            className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-yellow-50 dark:hover:bg-yellow-900/10"
                                          >
                                            <input
                                              type="checkbox"
                                              checked={checked}
                                              onChange={() => entry.id && toggleEntry(entry.id)}
                                              className="rounded border-yellow-600 text-yellow-600 focus:ring-yellow-500"
                                            />
                                            <div className="flex-1 min-w-0">
                                              <div className="text-sm text-gray-900 dark:text-yellow-100">
                                                {format(entry.date, 'MMM d, yyyy')} · {entry.roleName}
                                              </div>
                                              <div className="text-xs text-yellow-600 dark:text-yellow-500">
                                                {entry.hours}h work · {entry.travelHours}h travel
                                              </div>
                                              {(() => {
                                                const notes: string[] = [];
                                                if (entry.notes?.trim()) notes.push(entry.notes.trim());
                                                (entry.workEntries || []).forEach((w: any) => {
                                                  if (w.notes?.trim()) notes.push(w.notes.trim());
                                                });
                                                if (notes.length === 0) return null;
                                                return (
                                                  <div className="text-xs text-yellow-700 dark:text-yellow-500 mt-0.5 italic">
                                                    Notes: {notes.join(' · ')}
                                                  </div>
                                                );
                                              })()}
                                            </div>
                                            <span className="text-sm font-medium text-gray-900 dark:text-yellow-100">
                                              ${entryTotalCost(entry).toFixed(2)}
                                            </span>
                                          </label>
                                        );
                                      })}
                                    </div>
                                    <div className="flex items-center justify-between px-4 py-3 bg-yellow-50 dark:bg-yellow-900/10 border border-t-0 border-yellow-200 dark:border-yellow-800 rounded-b-lg">
                                      <span className="text-sm text-yellow-700 dark:text-yellow-400">
                                        {selectedInGroup.length} selected · ${selectedTotal.toFixed(2)}
                                      </span>
                                      <button
                                        onClick={() => handleGenerate(siteGroup)}
                                        disabled={generating || selectedInGroup.length === 0}
                                        className="flex items-center gap-2 px-4 py-2 bg-yellow-600 text-black rounded-lg hover:bg-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
                                      >
                                        {generating ? (
                                          <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                          <FileText className="h-4 w-4" />
                                        )}
                                        Generate Invoice
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )
          ) : loadingInvoices ? (
            <div className="text-center py-10 text-yellow-600 dark:text-yellow-500">Loading invoices...</div>
          ) : invoices.length === 0 ? (
            <div className="text-center py-10 text-yellow-600 dark:text-yellow-500">No invoices generated yet.</div>
          ) : (
            <div className="space-y-2">
              {(() => {
                const groups = invoices.reduce<Record<string, Invoice[]>>((acc, inv) => {
                  const key = inv.clientName || 'No client';
                  (acc[key] ||= []).push(inv);
                  return acc;
                }, {});
                return Object.entries(groups).map(([clientName, clientInvoices]) => {
                  const isOpen = expandedClients.has(clientName);
                  const total = clientInvoices.reduce((s, inv) => s + inv.total, 0);
                  const count = clientInvoices.length;
                  return (
                    <div key={clientName} className="border border-yellow-300 dark:border-yellow-800 rounded-lg bg-yellow-50 dark:bg-yellow-900/10 overflow-hidden">
                      <button
                        onClick={() => setExpandedClients(prev => {
                          const next = new Set(prev);
                          if (next.has(clientName)) next.delete(clientName);
                          else next.add(clientName);
                          return next;
                        })}
                        className="w-full flex items-center justify-between px-4 py-3 hover:bg-yellow-100 dark:hover:bg-yellow-900 dark:hover:bg-opacity-30 transition-colors text-left"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {isOpen ? <ChevronDown className="h-4 w-4 text-yellow-600 dark:text-yellow-400 shrink-0" /> : <ChevronRight className="h-4 w-4 text-yellow-600 dark:text-yellow-400 shrink-0" />}
                          <span className="font-medium text-gray-900 dark:text-yellow-100 truncate">{clientName}</span>
                          <span className="text-xs text-yellow-600 dark:text-yellow-500">({count} invoice{count !== 1 ? 's' : ''})</span>
                        </div>
                        <span className="text-sm font-semibold text-gray-900 dark:text-yellow-100 shrink-0">${total.toFixed(2)}</span>
                      </button>
                      {isOpen && (
                        <div className="border-t border-yellow-300 dark:border-yellow-800 px-4 py-2 space-y-2">
                          {clientInvoices.map(inv => {
                            const invOpen = inv.id ? expandedInvoices.has(inv.id) : false;
                            return (
                              <div
                                key={inv.id}
                                className="py-2 border-b border-yellow-200 dark:border-yellow-800 last:border-0"
                              >
                                <div className="flex items-center justify-between">
                                  <div className="min-w-0 flex-1">
                                    <button
                                      onClick={() => {
                                        if (!inv.id) return;
                                        setExpandedInvoices(prev => {
                                          const next = new Set(prev);
                                          if (next.has(inv.id!)) next.delete(inv.id!);
                                          else next.add(inv.id!);
                                          return next;
                                        });
                                      }}
                                      className="flex items-center gap-2 text-left w-full"
                                    >
                                      {invOpen ? (
                                        <ChevronDown className="h-4 w-4 text-yellow-600 dark:text-yellow-400 shrink-0" />
                                      ) : (
                                        <ChevronRight className="h-4 w-4 text-yellow-600 dark:text-yellow-400 shrink-0" />
                                      )}
                                      <div className="min-w-0">
                                        <div className="font-medium text-gray-900 dark:text-yellow-100 truncate">
                                          {inv.invoiceNumber} · {inv.site}
                                        </div>
                                        <div className="text-xs text-yellow-600 dark:text-yellow-500">
                                          {format(inv.createdAt, 'MMM d, yyyy')} · {inv.entryIds.length} card
                                          {inv.entryIds.length !== 1 ? 's' : ''} · ${inv.total.toFixed(2)}
                                        </div>
                                      </div>
                                    </button>
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <button
                                      onClick={() => generateInvoicePdf(inv)}
                                      className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-500 text-black rounded-lg hover:bg-yellow-600 text-sm font-medium transition-colors"
                                    >
                                      <Download className="h-4 w-4" /> PDF
                                    </button>
                                    <button
                                      onClick={() => handleDeleteInvoice(inv)}
                                      disabled={deletingId === inv.id}
                                      title="Delete invoice and return its time cards to the uninvoiced list"
                                      className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 text-sm font-medium transition-colors"
                                    >
                                      {deletingId === inv.id ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                      ) : (
                                        <Trash2 className="h-4 w-4" />
                                      )}
                                    </button>
                                  </div>
                                </div>

                                {invOpen && (
                                  <div className="mt-2 ml-6 pl-2 border-l-2 border-yellow-300 dark:border-yellow-800 space-y-1.5">
                                    {inv.lineItems.length === 0 ? (
                                      <div className="text-xs text-yellow-600 dark:text-yellow-500">No line items.</div>
                                    ) : (
                                      inv.lineItems.map((li, i) => (
                                        <div key={i} className="text-xs text-yellow-700 dark:text-yellow-400">
                                          <span className="font-medium text-gray-900 dark:text-yellow-100">{li.itemType}</span>
                                          <span className="ml-2 text-yellow-600 dark:text-yellow-500">
                                            {li.quantity} × ${li.unitPrice.toFixed(2)} = ${li.amount.toFixed(2)}
                                          </span>
                                          {li.description && (
                                            <span className="ml-2 italic">{li.description}</span>
                                          )}
                                        </div>
                                      ))
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                });
              })()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
