import { useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, RotateCcw, EyeOff, Eye, Layers, Wrench, Info } from 'lucide-react';
import {
  ServiceAnchor,
  ServiceIntervalDef,
  ServiceIntervalOverride,
  ServiceUnit,
} from '../types';
import { newIntervalId } from '../services/serviceScheduleService';

type Scope = 'category' | 'unit';

interface DisplayRow {
  def: ServiceIntervalDef;
  source: Scope;
  isOverridden: boolean;
  isDisabledHere: boolean;
}

interface Draft {
  name: string;
  interval: string;
  unit: ServiceUnit;
  notifyLead: string;
  anchor: ServiceAnchor;
  scope: Scope;
  // Set when editing an existing definition.
  editingId?: string;
  editingSource?: Scope;
  // A category template edited for this unit only becomes an override.
  asOverride?: boolean;
}

interface ServiceIntervalManagerProps {
  categoryName?: string;
  categoryIntervals: ServiceIntervalDef[];
  unitIntervals: ServiceIntervalDef[];
  overrides: Record<string, ServiceIntervalOverride>;
  canEditCategory: boolean;
  onSaveCategoryIntervals: (next: ServiceIntervalDef[]) => Promise<void>;
  onSaveUnitIntervals: (next: ServiceIntervalDef[]) => Promise<void>;
  onSaveOverrides: (next: Record<string, ServiceIntervalOverride>) => Promise<void>;
}

const UNIT_LABEL: Record<ServiceUnit, string> = {
  hours: 'hours',
  km: 'km',
  days: 'days',
};

const emptyDraft = (scope: Scope): Draft => ({
  name: '',
  interval: '',
  unit: 'hours',
  notifyLead: '',
  anchor: 'rolling',
  scope,
});

export function ServiceIntervalManager({
  categoryName,
  categoryIntervals,
  unitIntervals,
  overrides,
  canEditCategory,
  onSaveCategoryIntervals,
  onSaveUnitIntervals,
  onSaveOverrides,
}: ServiceIntervalManagerProps) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  // Includes disabled inherited intervals so they can be re-enabled, which is
  // why this does not reuse resolveIntervalsForUnit.
  const rows = useMemo<DisplayRow[]>(() => {
    const inherited: DisplayRow[] = categoryIntervals.map(template => {
      const override = overrides[template.id];
      const { disabled, ...patch } = override ?? {};
      return {
        def: { ...template, ...patch, id: template.id },
        source: 'category',
        isOverridden: Object.keys(patch).length > 0,
        isDisabledHere: !!disabled,
      };
    });
    const own: DisplayRow[] = unitIntervals.map(def => ({
      def,
      source: 'unit',
      isOverridden: false,
      isDisabledHere: false,
    }));
    return [...inherited, ...own];
  }, [categoryIntervals, unitIntervals, overrides]);

  const validation = useMemo(() => {
    if (!draft) return null;
    const interval = Number(draft.interval);
    const notifyLead = draft.notifyLead === '' ? 0 : Number(draft.notifyLead);
    if (!draft.name.trim()) return 'Give the interval a name.';
    if (!draft.interval || Number.isNaN(interval) || interval <= 0) return 'Interval must be greater than zero.';
    if (Number.isNaN(notifyLead) || notifyLead < 0) return 'Notify lead cannot be negative.';
    if (notifyLead >= interval) return 'Notify lead must be smaller than the interval.';
    return null;
  }, [draft]);

  const beginEdit = (row: DisplayRow, asOverride: boolean) => {
    setDraft({
      name: row.def.name,
      interval: String(row.def.interval),
      unit: row.def.unit,
      notifyLead: String(row.def.notifyLead ?? 0),
      anchor: row.def.anchor,
      scope: row.source,
      editingId: row.def.id,
      editingSource: row.source,
      asOverride,
    });
  };

  const run = async (action: () => Promise<void>) => {
    setSaving(true);
    try {
      await action();
    } catch (error) {
      console.error('Failed to save service intervals:', error);
      alert('Error saving service intervals. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!draft || validation) return;
    const def: ServiceIntervalDef = {
      id: draft.editingId ?? newIntervalId(),
      name: draft.name.trim(),
      interval: Number(draft.interval),
      unit: draft.unit,
      notifyLead: draft.notifyLead === '' ? 0 : Number(draft.notifyLead),
      anchor: draft.anchor,
      isActive: true,
    };

    await run(async () => {
      // Editing a category template for this unit alone writes an override and
      // leaves the shared template untouched.
      if (draft.editingSource === 'category' && draft.asOverride) {
        const existing = overrides[def.id] ?? {};
        await onSaveOverrides({
          ...overrides,
          [def.id]: {
            ...existing,
            name: def.name,
            interval: def.interval,
            unit: def.unit,
            notifyLead: def.notifyLead,
            anchor: def.anchor,
          },
        });
      } else if (draft.editingSource === 'category') {
        await onSaveCategoryIntervals(categoryIntervals.map(t => (t.id === def.id ? def : t)));
      } else if (draft.editingSource === 'unit') {
        await onSaveUnitIntervals(unitIntervals.map(t => (t.id === def.id ? def : t)));
      } else if (draft.scope === 'category') {
        await onSaveCategoryIntervals([...categoryIntervals, def]);
      } else {
        await onSaveUnitIntervals([...unitIntervals, def]);
      }
      setDraft(null);
    });
  };

  const handleToggleDisabled = (row: DisplayRow) => run(async () => {
    const existing = overrides[row.def.id] ?? {};
    await onSaveOverrides({
      ...overrides,
      [row.def.id]: { ...existing, disabled: !row.isDisabledHere },
    });
  });

  const handleResetOverride = (row: DisplayRow) => run(async () => {
    const next = { ...overrides };
    delete next[row.def.id];
    await onSaveOverrides(next);
  });

  const handleDelete = (row: DisplayRow) => run(async () => {
    if (row.source === 'unit') {
      if (!confirm(`Remove "${row.def.name}" from this unit?`)) return;
      await onSaveUnitIntervals(unitIntervals.filter(d => d.id !== row.def.id));
      return;
    }
    if (!confirm(`Remove "${row.def.name}" from every unit in ${categoryName || 'this category'}?\n\nService history is kept, but the interval will no longer be scheduled.`)) return;
    await onSaveCategoryIntervals(categoryIntervals.filter(d => d.id !== row.def.id));
  });

  const inputClass = 'w-full px-2 py-1.5 border border-yellow-600 rounded-md text-xs bg-yellow-200 dark:bg-black text-gray-900 dark:text-yellow-100 focus:outline-none focus:ring-2 focus:ring-yellow-500 [-moz-appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none';
  const actionClass = 'inline-flex items-center gap-1 text-[11px] text-yellow-700 dark:text-yellow-400 hover:text-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed';

  return (
    <div className="mb-4">
      <label className="block text-xs text-yellow-700 dark:text-yellow-300 mb-2">Service Intervals</label>

      {rows.length > 0 && (
        <div className="space-y-1.5 mb-2">
          {rows.map(row => (
            <div
              key={`${row.source}-${row.def.id}`}
              className={`px-2 py-1.5 border rounded-md text-xs ${
                row.isDisabledHere
                  ? 'border-gray-400 dark:border-gray-700 bg-gray-100 dark:bg-gray-900/40 opacity-70'
                  : 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/10'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-gray-900 dark:text-yellow-100 font-medium truncate">{row.def.name}</span>
                    <span
                      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                        row.source === 'category'
                          ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                          : 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300'
                      }`}
                      title={row.source === 'category'
                        ? `Inherited from ${categoryName || 'category'}`
                        : 'Applies to this unit only'}
                    >
                      {row.source === 'category'
                        ? <><Layers className="h-2.5 w-2.5" />Category</>
                        : <><Wrench className="h-2.5 w-2.5" />This unit</>}
                    </span>
                    {row.isOverridden && !row.isDisabledHere && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">
                        Overridden here
                      </span>
                    )}
                    {row.isDisabledHere && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                        Disabled on this unit
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-yellow-700 dark:text-yellow-300 mt-0.5">
                    Every {row.def.interval.toLocaleString()} {UNIT_LABEL[row.def.unit]}
                    {row.def.notifyLead > 0 && ` · warn ${row.def.notifyLead.toLocaleString()} ${UNIT_LABEL[row.def.unit]} before`}
                    {row.def.anchor === 'fixed' && ' · fixed schedule'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                {row.source === 'category' ? (
                  <>
                    <button type="button" onClick={() => beginEdit(row, true)} disabled={saving} className={actionClass}>
                      <Pencil className="h-3 w-3" />Edit for this unit
                    </button>
                    {canEditCategory && (
                      <button type="button" onClick={() => beginEdit(row, false)} disabled={saving} className={actionClass}>
                        <Pencil className="h-3 w-3" />Edit for all units
                      </button>
                    )}
                    {row.isOverridden && (
                      <button type="button" onClick={() => handleResetOverride(row)} disabled={saving} className={actionClass}>
                        <RotateCcw className="h-3 w-3" />Reset to category
                      </button>
                    )}
                    <button type="button" onClick={() => handleToggleDisabled(row)} disabled={saving} className={actionClass}>
                      {row.isDisabledHere
                        ? <><Eye className="h-3 w-3" />Enable here</>
                        : <><EyeOff className="h-3 w-3" />Disable here</>}
                    </button>
                    {canEditCategory && (
                      <button
                        type="button"
                        onClick={() => handleDelete(row)}
                        disabled={saving}
                        className="inline-flex items-center gap-1 text-[11px] text-red-600 dark:text-red-400 hover:text-red-500 disabled:opacity-50"
                      >
                        <Trash2 className="h-3 w-3" />Delete from category
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <button type="button" onClick={() => beginEdit(row, false)} disabled={saving} className={actionClass}>
                      <Pencil className="h-3 w-3" />Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(row)}
                      disabled={saving}
                      className="inline-flex items-center gap-1 text-[11px] text-red-600 dark:text-red-400 hover:text-red-500 disabled:opacity-50"
                    >
                      <Trash2 className="h-3 w-3" />Remove
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {draft ? (
        <div className="border border-yellow-500 rounded-md p-2 bg-yellow-50 dark:bg-yellow-900/10 space-y-2">
          <input
            type="text"
            placeholder="Name (e.g. 500 Hr Service, Annual Inspection)"
            value={draft.name}
            onChange={e => setDraft({ ...draft, name: e.target.value })}
            className={inputClass}
          />
          <div className="grid grid-cols-3 gap-1.5">
            <div>
              <label className="block text-[10px] text-yellow-700 dark:text-yellow-300 mb-0.5">Every</label>
              <input
                type="number"
                placeholder="500"
                value={draft.interval}
                onChange={e => setDraft({ ...draft, interval: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-[10px] text-yellow-700 dark:text-yellow-300 mb-0.5">Unit</label>
              <select
                value={draft.unit}
                onChange={e => setDraft({ ...draft, unit: e.target.value as ServiceUnit })}
                className={inputClass}
              >
                <option value="hours">Hours</option>
                <option value="km">Kilometres</option>
                <option value="days">Days</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-yellow-700 dark:text-yellow-300 mb-0.5">Warn before</label>
              <input
                type="number"
                placeholder="50"
                value={draft.notifyLead}
                onChange={e => setDraft({ ...draft, notifyLead: e.target.value })}
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] text-yellow-700 dark:text-yellow-300 mb-0.5">Schedule</label>
            <select
              value={draft.anchor}
              onChange={e => setDraft({ ...draft, anchor: e.target.value as ServiceAnchor })}
              className={inputClass}
            >
              <option value="rolling">Rolling — next due counts from the last actual service</option>
              <option value="fixed">Fixed — always lands on set milestones, never drifts</option>
            </select>
            <p className="flex items-start gap-1 mt-1 text-[10px] text-yellow-700/80 dark:text-yellow-300/70 leading-snug">
              <Info className="h-2.5 w-2.5 mt-0.5 shrink-0" />
              <span>
                {draft.anchor === 'rolling'
                  ? 'Serviced early or late, the next one shifts with it. Right for most routine work.'
                  : 'Serviced early or late, the next one stays on the original milestone. Right for OEM and warranty schedules.'}
              </span>
            </p>
          </div>

          {!draft.editingId && (
            <div>
              <label className="block text-[10px] text-yellow-700 dark:text-yellow-300 mb-0.5">Applies to</label>
              <select
                value={draft.scope}
                onChange={e => setDraft({ ...draft, scope: e.target.value as Scope })}
                disabled={!canEditCategory}
                className={inputClass}
              >
                <option value="unit">This unit only</option>
                <option value="category">
                  {`Every unit in ${categoryName || 'this category'}`}
                </option>
              </select>
            </div>
          )}

          {draft.editingSource === 'category' && draft.asOverride && (
            <p className="text-[10px] text-amber-700 dark:text-amber-400 leading-snug">
              Saving creates an override for this unit. Other units in {categoryName || 'the category'} are unaffected.
            </p>
          )}

          {validation && <p className="text-[11px] text-red-600 dark:text-red-400">{validation}</p>}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={saving || !!validation}
              className="px-3 py-1.5 text-xs text-yellow-600 dark:text-yellow-400 hover:text-yellow-500 border border-yellow-600 rounded hover:bg-yellow-100 dark:hover:bg-yellow-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setDraft(null)}
              disabled={saving}
              className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 border border-gray-400 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setDraft(emptyDraft(canEditCategory ? 'category' : 'unit'))}
          disabled={saving}
          className="w-full inline-flex items-center justify-center gap-1 px-2 py-1.5 border border-dashed border-yellow-600 rounded-md text-xs text-yellow-700 dark:text-yellow-300 hover:bg-yellow-100 dark:hover:bg-yellow-900/30 transition-colors disabled:opacity-50"
        >
          <Plus className="h-3 w-3" />
          Add Service Interval
        </button>
      )}
    </div>
  );
}
