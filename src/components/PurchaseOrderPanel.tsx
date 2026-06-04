import { useEffect, useMemo, useRef, useState } from 'react';
import { Paperclip, Loader2, Plus, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { purchaseOrderService, PurchaseOrder } from '../services/purchaseOrderService';
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
  posForDate: PurchaseOrder[];
  onPOCreated: (poNumber: number) => void;
  onClose?: () => void;
}

export function PurchaseOrderPanel({ date, submittedBy, posForDate, onPOCreated, onClose }: Props) {
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

  const availableCodes = useMemo<{ name: string; description?: string }[]>(() => {
    if (site) {
      const selectedSite = sites.find(s => s.name === site);
      if (selectedSite?.codes && selectedSite.codes.length > 0) {
        return selectedSite.codes;
      }
    }
    return allCodes.map(c => ({ name: c.name, description: c.description }));
  }, [site, sites, allCodes]);

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

  const resetForm = () => {
    setTo('');
    setSite('');
    setItems([emptyItem()]);
    setAttachmentFile(null);
    setError('');
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
      const created = nextPONumber ?? 0;
      resetForm();
      setNextPONumber(created + 1);
      onPOCreated(created);
    } catch {
      setError('Failed to submit PO. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mb-6">
      {/* Form header */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-yellow-700 dark:text-yellow-500">
          {nextPONumber !== null ? `Next PO #${nextPONumber}` : 'Loading PO number...'}
          &nbsp;·&nbsp; {format(date, 'MMMM d, yyyy')} &nbsp;·&nbsp;
          <span className="font-medium">{submittedBy}</span>
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        {/* To + Site */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div>
            <label className="block text-sm font-medium text-yellow-700 dark:text-yellow-600 mb-1">
              To <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={to}
              onChange={e => setTo(e.target.value)}
              placeholder="Vendor / Supplier / Recipient"
              className="w-full px-3 py-2 bg-yellow-200 dark:bg-black border border-yellow-400 dark:border-yellow-700 rounded-lg text-gray-900 dark:text-yellow-100 focus:outline-none focus:border-yellow-500 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-yellow-700 dark:text-yellow-600 mb-1">
              Site <span className="text-red-500">*</span>
            </label>
            <select
              value={site}
              onChange={e => handleSiteChange(e.target.value)}
              className="w-full px-3 py-2 bg-yellow-200 dark:bg-black border border-yellow-400 dark:border-yellow-700 rounded-lg text-gray-900 dark:text-yellow-100 focus:outline-none focus:border-yellow-500 text-sm"
            >
              <option value="">Select Site</option>
              {sites.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
            </select>
          </div>
        </div>

        {/* Line Items */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-sm font-medium text-yellow-700 dark:text-yellow-600">
              Items <span className="text-red-500">*</span>
            </label>
            <button
              type="button"
              onClick={addItem}
              className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-yellow-300 dark:bg-yellow-900/50 text-yellow-900 dark:text-yellow-300 hover:bg-yellow-400 dark:hover:bg-yellow-800/70 font-medium transition-colors"
            >
              <Plus className="h-3 w-3" /> Add Item
            </button>
          </div>

          {/* Desktop column headers */}
          <div className="hidden sm:flex gap-2 px-1 mb-1">
            <span className="w-14 flex-shrink-0 text-xs text-yellow-700 dark:text-yellow-600 font-medium">Qty</span>
            <span className="flex-1 text-xs text-yellow-700 dark:text-yellow-600 font-medium">Description</span>
            <span className="w-44 flex-shrink-0 text-xs text-yellow-700 dark:text-yellow-600 font-medium">Code (optional)</span>
            <span className="w-8 flex-shrink-0" />
          </div>

          <div className="space-y-2">
            {items.map((item, idx) => (
              <div
                key={item.id}
                className="flex flex-wrap sm:flex-nowrap gap-2 items-start bg-yellow-100 dark:bg-gray-900/40 rounded-lg p-2 border border-yellow-300 dark:border-yellow-800"
              >
                {items.length > 1 && (
                  <span className="w-full sm:hidden text-xs font-semibold text-yellow-700 dark:text-yellow-500">
                    Item {idx + 1}
                  </span>
                )}

                {/* Qty */}
                <input
                  type="number"
                  min="1"
                  value={item.quantity}
                  onChange={e => updateItem(item.id, 'quantity', e.target.value)}
                  placeholder="Qty"
                  className="order-1 w-14 flex-shrink-0 px-2 py-1.5 text-sm rounded border border-yellow-400 dark:border-yellow-700 bg-yellow-200 dark:bg-black text-gray-900 dark:text-yellow-100 focus:outline-none focus:border-yellow-500"
                />

                {/* Code */}
                <select
                  value={item.code}
                  onChange={e => updateItem(item.id, 'code', e.target.value)}
                  className="order-2 sm:order-3 flex-1 sm:flex-none sm:w-44 px-2 py-1.5 text-sm rounded border border-yellow-400 dark:border-yellow-700 bg-yellow-200 dark:bg-black text-gray-900 dark:text-yellow-100 focus:outline-none focus:border-yellow-500"
                >
                  <option value="">-- Code --</option>
                  {availableCodes.map(c => (
                    <option key={c.name} value={c.name}>
                      {c.name}{c.description ? ` — ${c.description}` : ''}
                    </option>
                  ))}
                </select>

                {/* Remove */}
                <button
                  type="button"
                  onClick={() => removeItem(item.id)}
                  disabled={items.length === 1}
                  className="order-3 sm:order-4 flex-shrink-0 w-8 flex items-center justify-center p-1.5 rounded text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>

                {/* Description */}
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
                  className="order-4 sm:order-2 w-full sm:flex-1 px-2 py-1.5 text-sm rounded border border-yellow-400 dark:border-yellow-700 bg-yellow-200 dark:bg-black text-gray-900 dark:text-yellow-100 focus:outline-none focus:border-yellow-500 resize-none overflow-hidden min-h-[34px]"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Attachment */}
        <div>
          <label className="block text-sm font-medium text-yellow-700 dark:text-yellow-600 mb-1">
            Attachment (optional)
          </label>
          <div
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-dashed border-yellow-400 dark:border-yellow-700 bg-yellow-100 dark:bg-black cursor-pointer hover:bg-yellow-200 dark:hover:bg-gray-900 transition-colors"
          >
            <Paperclip className="h-4 w-4 text-yellow-600 dark:text-yellow-500 flex-shrink-0" />
            <span className="text-gray-700 dark:text-yellow-400 truncate">
              {attachmentFile ? attachmentFile.name : 'Click to attach a file'}
            </span>
          </div>
          <input ref={fileRef} type="file" className="hidden" onChange={e => setAttachmentFile(e.target.files?.[0] ?? null)} />
        </div>

        {/* Error */}
        {error && (
          <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">
            {error}
          </p>
        )}

        {/* Submit */}
        <div className="flex justify-end gap-2">
          <button
            type="submit"
            disabled={submitting || nextPONumber === null}
            className="px-3 py-1.5 text-sm bg-yellow-600 text-black rounded-lg hover:bg-yellow-500 font-medium transition-colors whitespace-nowrap disabled:opacity-50 flex items-center gap-2"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {submitting ? 'Submitting...' : `Submit PO${items.length > 1 ? ` (${items.length} items)` : ''}`}
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-sm bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-yellow-100 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 font-medium transition-colors whitespace-nowrap"
            >
              Close
            </button>
          )}
        </div>
      </form>

      {/* Existing POs for this date */}
      {posForDate.length > 0 && (
        <div className="mt-4 border-t border-yellow-400 dark:border-yellow-700 pt-4">
          <h4 className="text-sm font-semibold text-yellow-700 dark:text-yellow-300 mb-3">
            Purchase Orders for this date ({posForDate.length})
          </h4>
          <div className="space-y-2">
            {posForDate.map(po => (
              <div
                key={po.id}
                className="bg-yellow-100 dark:bg-black border border-yellow-400 dark:border-yellow-700 rounded-lg p-3"
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <span className="text-sm font-bold text-yellow-800 dark:text-yellow-300">
                    PO #{po.poNumber}
                  </span>
                  <span className="text-xs text-yellow-600 dark:text-yellow-500">
                    {po.submittedBy}
                  </span>
                </div>
                <div className="text-xs text-yellow-700 dark:text-yellow-500 mb-2">
                  <span className="font-medium">To:</span> {po.to}
                  &nbsp;·&nbsp;
                  <span className="font-medium">Site:</span> {po.site}
                </div>
                <div className="space-y-1">
                  {po.items.map((item, i) => (
                    <div key={i} className="flex gap-2 text-xs text-gray-700 dark:text-yellow-400 bg-yellow-50 dark:bg-gray-900/40 rounded px-2 py-1">
                      <span className="font-semibold text-yellow-800 dark:text-yellow-300 w-8 flex-shrink-0">×{item.quantity}</span>
                      <span className="flex-1">{item.description}</span>
                      <span className="text-yellow-600 dark:text-yellow-600 flex-shrink-0">{item.code}</span>
                    </div>
                  ))}
                </div>
                {po.attachmentUrl && (
                  <a
                    href={po.attachmentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    <Paperclip className="h-3 w-3" /> {po.attachmentName ?? 'Attachment'}
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
