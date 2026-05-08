import { useEffect, useMemo, useRef, useState } from 'react';
import { X, Paperclip, Loader2, Plus, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { purchaseOrderService } from '../services/purchaseOrderService';
import { siteManagementService, Site } from '../services/siteManagementService';
import { codeManagementService, Code } from '../services/codeManagementService';

interface LineItem {
  id: string;
  description: string;
  quantity: string;
  code: string;
}

const emptyItem = (): LineItem => ({
  id: Date.now().toString() + Math.random(),
  description: '',
  quantity: '',
  code: '',
});

interface Props {
  date: Date;
  submittedBy: string;
  onClose: () => void;
  onSuccess: (poNumber: number) => void;
}

export function PurchaseOrderModal({ date, submittedBy, onClose, onSuccess }: Props) {
  const [nextPONumber, setNextPONumber] = useState<number | null>(null);
  const [sites, setSites] = useState<Site[]>([]);
  const [allCodes, setAllCodes] = useState<Code[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const [to, setTo] = useState('');
  const [site, setSite] = useState('');
  const [items, setItems] = useState<LineItem[]>([emptyItem()]);
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);

  useEffect(() => {
    Promise.all([
      purchaseOrderService.getNextPONumber(),
      siteManagementService.getAllSites(),
      codeManagementService.getActiveCodes(),
    ]).then(([poNum, sitesData, codesData]) => {
      setNextPONumber(poNum);
      setSites(sitesData.filter(s => s.isActive));
      setAllCodes(codesData);
    });
  }, []);

  // Filter codes by selected site — same pattern as TimeEntryForm
  const availableCodes = useMemo<{ name: string; description?: string }[]>(() => {
    if (site) {
      const selectedSite = sites.find(s => s.name === site);
      if (selectedSite?.codes && selectedSite.codes.length > 0) {
        return selectedSite.codes;
      }
    }
    return allCodes.map(c => ({ name: c.name, description: c.description }));
  }, [site, sites, allCodes]);

  // Clear item codes that are no longer valid when site changes
  const handleSiteChange = (newSite: string) => {
    setSite(newSite);
    setItems(prev => prev.map(item => ({ ...item, code: '' })));
  };

  const updateItem = (id: string, field: keyof LineItem, value: string) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const addItem = () => setItems(prev => [...prev, emptyItem()]);

  const removeItem = (id: string) => {
    if (items.length === 1) return;
    setItems(prev => prev.filter(item => item.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!to.trim()) { setError('Please fill in the "To" field.'); return; }
    if (!site) { setError('Please select a site.'); return; }

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const label = items.length > 1 ? ` (item ${i + 1})` : '';
      if (!item.description.trim()) { setError(`Please enter a description${label}.`); return; }
      if (!item.quantity || Number(item.quantity) <= 0) { setError(`Please enter a valid quantity${label}.`); return; }
      if (!item.code) { setError(`Please select a code${label}.`); return; }
    }

    setSubmitting(true);
    try {
      await purchaseOrderService.createPO({
        to: to.trim(),
        site,
        items: items.map(({ description, quantity, code }) => ({
          description: description.trim(),
          quantity: Number(quantity),
          code,
        })),
        date,
        submittedBy,
        attachmentFile: attachmentFile ?? undefined,
      });
      onSuccess(nextPONumber ?? 0);
    } catch {
      setError('Failed to submit PO. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto border border-yellow-600">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-yellow-600 bg-yellow-600 rounded-t-xl">
          <div>
            <h2 className="text-lg font-bold text-black">Purchase Order</h2>
            <p className="text-sm text-black opacity-80">
              {nextPONumber !== null ? `PO #${nextPONumber}` : 'Loading...'} &nbsp;·&nbsp; {format(date, 'MMMM d, yyyy')}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-yellow-700 text-black transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Read-only info */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Submitted By</label>
              <input type="text" value={submittedBy} readOnly
                className="w-full px-3 py-2 text-sm rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 cursor-default" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Date</label>
              <input type="text" value={format(date, 'yyyy-MM-dd')} readOnly
                className="w-full px-3 py-2 text-sm rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 cursor-default" />
            </div>
          </div>

          {/* To */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
              To <span className="text-red-500">*</span>
            </label>
            <input type="text" value={to} onChange={e => setTo(e.target.value)}
              placeholder="Vendor / Supplier / Recipient"
              className="w-full px-3 py-2 text-sm rounded-lg border border-yellow-400 dark:border-yellow-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-yellow-500" />
          </div>

          {/* Site */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
              Site <span className="text-red-500">*</span>
            </label>
            <select value={site} onChange={e => handleSiteChange(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-yellow-400 dark:border-yellow-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-yellow-500">
              <option value="">-- Select Site --</option>
              {sites.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
            </select>
          </div>

          {/* Line Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                Items <span className="text-red-500">*</span>
              </label>
              <button type="button" onClick={addItem}
                className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-300 hover:bg-yellow-200 dark:hover:bg-yellow-800/60 font-medium transition-colors">
                <Plus className="h-3 w-3" /> Add Item
              </button>
            </div>

            <div className="space-y-2">
              {/* Desktop column headers */}
              <div className="hidden sm:flex gap-2 px-1">
                <span className="w-14 flex-shrink-0 text-xs text-gray-500 dark:text-gray-400 font-medium">Qty</span>
                <span className="flex-1 text-xs text-gray-500 dark:text-gray-400 font-medium">Description</span>
                <span className="w-36 flex-shrink-0 text-xs text-gray-500 dark:text-gray-400 font-medium">Code</span>
                <span className="w-8 flex-shrink-0" />
              </div>

              {items.map((item, idx) => (
                <div key={item.id} className="flex flex-wrap sm:flex-nowrap gap-2 items-start bg-gray-50 dark:bg-gray-800/50 rounded-lg p-2 border border-gray-200 dark:border-gray-700">
                  {/* Mobile item label */}
                  {items.length > 1 && (
                    <span className="w-full sm:hidden text-xs font-semibold text-gray-500 dark:text-gray-400">
                      Item {idx + 1}
                    </span>
                  )}

                  {/* Qty — order-1 mobile & desktop */}
                  <input
                    type="number"
                    min="1"
                    maxLength={3}
                    value={item.quantity}
                    onChange={e => updateItem(item.id, 'quantity', e.target.value)}
                    placeholder="Qty"
                    className="order-1 w-14 flex-shrink-0 px-2 py-1.5 text-sm rounded-md border border-yellow-400 dark:border-yellow-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-yellow-500"
                  />

                  {/* Code — order-2 on mobile (beside Qty), order-3 on desktop (after Description) */}
                  <select
                    value={item.code}
                    onChange={e => updateItem(item.id, 'code', e.target.value)}
                    className="order-2 sm:order-3 flex-1 sm:flex-none sm:w-36 px-2 py-1.5 text-sm rounded-md border border-yellow-400 dark:border-yellow-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-yellow-500"
                  >
                    <option value="">-- Code --</option>
                    {availableCodes.map(c => (
                      <option key={c.name} value={c.name}>
                        {c.name}{c.description ? ` — ${c.description}` : ''}
                      </option>
                    ))}
                  </select>

                  {/* Remove — order-3 mobile, order-4 desktop */}
                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    disabled={items.length === 1}
                    className="order-3 sm:order-4 flex-shrink-0 w-8 flex items-center justify-center p-1.5 rounded-md text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                    title="Remove item"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>

                  {/* Description — order-4 mobile (full-width second row), order-2 desktop */}
                  <textarea
                    rows={1}
                    value={item.description}
                    onChange={e => updateItem(item.id, 'description', e.target.value)}
                    onInput={e => {
                      const el = e.currentTarget;
                      el.style.height = 'auto';
                      el.style.height = `${el.scrollHeight}px`;
                    }}
                    placeholder="e.g. 200mm pipe lengths"
                    className="order-4 sm:order-2 w-full sm:flex-1 px-2 py-1.5 text-sm rounded-md border border-yellow-400 dark:border-yellow-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-yellow-500 resize-none overflow-hidden min-h-[34px]"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Attachment */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Attachment (optional)</label>
            <div onClick={() => fileRef.current?.click()}
              className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-dashed border-yellow-400 dark:border-yellow-700 bg-yellow-50 dark:bg-gray-800 cursor-pointer hover:bg-yellow-100 dark:hover:bg-gray-700 transition-colors">
              <Paperclip className="h-4 w-4 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
              <span className="text-gray-700 dark:text-gray-300 truncate">
                {attachmentFile ? attachmentFile.name : 'Click to attach a file'}
              </span>
            </div>
            <input ref={fileRef} type="file" className="hidden" onChange={e => setAttachmentFile(e.target.files?.[0] ?? null)} />
          </div>

          {/* Error */}
          {error && (
            <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">{error}</p>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors font-medium">
              Cancel
            </button>
            <button type="submit" disabled={submitting || nextPONumber === null}
              className="flex-1 px-4 py-2 text-sm rounded-lg bg-yellow-600 hover:bg-yellow-500 text-black font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitting ? 'Submitting...' : `Submit PO${items.length > 1 ? ` (${items.length} items)` : ''}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
