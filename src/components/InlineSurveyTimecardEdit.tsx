import { useState, useEffect, useRef, useMemo } from 'react';
import { Save, X, Plus, Trash2 } from 'lucide-react';
import { SurveyTimeEntry, SurveyWorkEntry, SurveyExpenseLine } from '../services/surveyTimecardService';
import { siteManagementService, Site } from '../services/siteManagementService';
import { Expense, expenseManagementService } from '../services/expenseManagementService';

interface InlineSurveyTimecardEditProps {
  entry: SurveyTimeEntry;
  user: { id: string; username: string; role: string; name: string };
  canEdit: boolean;
  onSave: (entryId: string, updates: Partial<SurveyTimeEntry>, editedBy?: string) => Promise<void>;
}

function EditableField({
  displayValue,
  isEditing,
  editingField,
  fieldName,
  onStartEdit,
  children,
  className = '',
}: {
  displayValue: string;
  isEditing: boolean;
  editingField: string | null;
  fieldName: string;
  onStartEdit: (field: string) => void;
  children: React.ReactNode;
  className?: string;
}) {
  if (isEditing && editingField === fieldName) return <>{children}</>;
  if (!isEditing) return <span className={className}>{displayValue}</span>;
  return (
    <span
      className={`${className} cursor-pointer hover:bg-yellow-100 dark:hover:bg-yellow-900 dark:hover:bg-opacity-30 px-0.5 rounded`}
      onClick={(e) => { e.stopPropagation(); onStartEdit(fieldName); }}
    >
      {displayValue || '(click to set)'}
    </span>
  );
}

type WorkEntryDraft = {
  id: string;
  roleName: string;
  roleCostPerHour: number;
  hours: string;
  notes: string;
  expenses: SurveyExpenseLine[];
};

export function InlineSurveyTimecardEdit({ entry, user, canEdit, onSave }: InlineSurveyTimecardEditProps) {
  const [editingField, setEditingField] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const [travelHours, setTravelHours] = useState('');
  const [notes, setNotes] = useState('');
  const [workEntries, setWorkEntries] = useState<WorkEntryDraft[]>([]);

  const [site, setSite] = useState<Site | null>(null);
  const [expenseOptions, setExpenseOptions] = useState<Expense[]>([]);
  const [optionsLoaded, setOptionsLoaded] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const isEditing = canEdit;

  useEffect(() => {
    setTravelHours(entry.travelHours?.toString() || '');
    setNotes(entry.notes || '');
    if (entry.workEntries && entry.workEntries.length > 0) {
      setWorkEntries(entry.workEntries.map((w, i) => ({
        id: w.id || `${Date.now()}-${i}`,
        roleName: w.roleName,
        roleCostPerHour: w.roleCostPerHour,
        hours: w.hours?.toString() || '',
        notes: w.notes || '',
        expenses: [...(w.expenses || [])],
      })));
    } else {
      setWorkEntries([{
        id: `${Date.now()}`,
        roleName: entry.roleName || '',
        roleCostPerHour: entry.roleCostPerHour || 0,
        hours: entry.hours?.toString() || '',
        notes: entry.notes || '',
        expenses: [...(entry.expenses || [])],
      }]);
    }
  }, [entry]);

  useEffect(() => {
    if (!canEdit || optionsLoaded) return;
    (async () => {
      try {
        const [sites, expenses] = await Promise.all([
          siteManagementService.getAllSites(),
          expenseManagementService.getActiveExpenses(),
        ]);
        const matching = sites.find(s => s.clientId === entry.clientId && s.name === entry.site)
          ?? sites.find(s => s.name === entry.site) ?? null;
        setSite(matching);
        setExpenseOptions(expenses);
        setOptionsLoaded(true);
      } catch (err) {
        console.error('Failed to load survey inline edit options', err);
      }
    })();
  }, [canEdit, optionsLoaded, entry.clientId, entry.site]);

  const siteRoles = useMemo(() => site?.roles || [], [site]);

  useEffect(() => {
    if (!editingField) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setEditingField(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [editingField]);

  const markDirty = () => { if (!dirty) setDirty(true); };

  const updateWork = (idx: number, patch: Partial<WorkEntryDraft>) => {
    markDirty();
    setWorkEntries(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  };

  const setWorkRole = (idx: number, roleName: string) => {
    const role = siteRoles.find(r => r.name === roleName);
    updateWork(idx, { roleName, roleCostPerHour: role?.costPerHour || 0 });
  };

  const addWorkEntry = () => {
    markDirty();
    setWorkEntries(prev => [...prev, {
      id: `${Date.now()}-${prev.length}`,
      roleName: '',
      roleCostPerHour: 0,
      hours: '',
      notes: '',
      expenses: [],
    }]);
  };

  const removeWorkEntry = (idx: number) => {
    markDirty();
    setWorkEntries(prev => prev.filter((_, i) => i !== idx));
  };

  const addExpense = (idx: number) => {
    markDirty();
    setWorkEntries(prev => {
      const next = [...prev];
      next[idx] = {
        ...next[idx],
        expenses: [...next[idx].expenses, { expenseId: '', name: '', dollarValue: 0, quantity: 1 }],
      };
      return next;
    });
  };

  const updateExpense = (workIdx: number, expIdx: number, patch: Partial<SurveyExpenseLine>) => {
    markDirty();
    setWorkEntries(prev => {
      const next = [...prev];
      const expenses = [...next[workIdx].expenses];
      expenses[expIdx] = { ...expenses[expIdx], ...patch };
      next[workIdx] = { ...next[workIdx], expenses };
      return next;
    });
  };

  const removeExpense = (workIdx: number, expIdx: number) => {
    markDirty();
    setWorkEntries(prev => {
      const next = [...prev];
      next[workIdx] = { ...next[workIdx], expenses: next[workIdx].expenses.filter((_, i) => i !== expIdx) };
      return next;
    });
  };

  const handleSave = async () => {
    if (!entry.id) return;
    setSaving(true);
    try {
      const built: SurveyWorkEntry[] = workEntries.map(w => ({
        id: w.id,
        roleName: w.roleName,
        roleCostPerHour: w.roleCostPerHour,
        hours: parseFloat(w.hours) || 0,
        notes: w.notes.trim(),
        expenses: w.expenses.filter(e => e.name || e.dollarValue || e.quantity),
      }));
      const first = built[0];
      const updates: Partial<SurveyTimeEntry> = {
        travelHours: travelHours ? parseFloat(travelHours) : 0,
        notes: notes || '',
        workEntries: built,
        // Keep legacy top-level fields in sync with the first work entry
        roleName: first?.roleName || '',
        roleCostPerHour: first?.roleCostPerHour || 0,
        hours: first?.hours || 0,
        expenses: first?.expenses || [],
      };
      const editedBy = entry.userId !== user.id ? user.username : undefined;
      await onSave(entry.id, updates, editedBy);
      setDirty(false);
      setEditingField(null);
    } catch (err) {
      console.error('Failed to save survey time entry', err);
      alert('Failed to save changes.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setTravelHours(entry.travelHours?.toString() || '');
    setNotes(entry.notes || '');
    if (entry.workEntries && entry.workEntries.length > 0) {
      setWorkEntries(entry.workEntries.map((w, i) => ({
        id: w.id || `${Date.now()}-${i}`,
        roleName: w.roleName,
        roleCostPerHour: w.roleCostPerHour,
        hours: w.hours?.toString() || '',
        notes: w.notes || '',
        expenses: [...(w.expenses || [])],
      })));
    } else {
      setWorkEntries([{
        id: `${Date.now()}`,
        roleName: entry.roleName || '',
        roleCostPerHour: entry.roleCostPerHour || 0,
        hours: entry.hours?.toString() || '',
        notes: entry.notes || '',
        expenses: [...(entry.expenses || [])],
      }]);
    }
    setDirty(false);
    setEditingField(null);
  };

  return (
    <div
      ref={containerRef}
      className="mt-3 pt-3 border-t border-yellow-200 dark:border-yellow-700 space-y-2"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Travel hours */}
      <div className="flex items-center gap-2 text-xs text-yellow-700 dark:text-yellow-600">
        <EditableField
          displayValue={`Travel: ${travelHours || '0'}h`}
          isEditing={isEditing}
          editingField={editingField}
          fieldName="travelHours"
          onStartEdit={setEditingField}
          className="text-yellow-700 dark:text-yellow-600"
        >
          <span className="inline-flex items-center gap-1">
            Travel:
            <input
              type="number"
              step="0.25"
              min="0"
              value={travelHours}
              onChange={(e) => { setTravelHours(e.target.value); markDirty(); }}
              onBlur={() => setEditingField(null)}
              autoFocus
              className="w-20 px-2 py-1 text-xs rounded ring-1 ring-yellow-600 bg-yellow-200 dark:bg-black text-gray-900 dark:text-yellow-100 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              onClick={(e) => e.stopPropagation()}
            />
          </span>
        </EditableField>
      </div>

      {/* Work entries */}
      <div className="space-y-2">
        {workEntries.map((w, idx) => (
          <div key={w.id} className="text-xs bg-yellow-50 dark:bg-yellow-900 dark:bg-opacity-20 p-2 rounded space-y-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div className="space-y-1">
                {/* Role */}
                <div className="font-medium text-yellow-800 dark:text-yellow-300">
                  <EditableField
                    displayValue={w.roleName ? `${w.roleName}${w.roleCostPerHour ? ` ($${w.roleCostPerHour.toFixed(2)}/hr)` : ''}` : 'Role'}
                    isEditing={isEditing}
                    editingField={editingField}
                    fieldName={`role-${idx}`}
                    onStartEdit={setEditingField}
                    className="font-medium text-yellow-800 dark:text-yellow-300"
                  >
                    <select
                      value={w.roleName}
                      onChange={(e) => { setWorkRole(idx, e.target.value); setEditingField(null); }}
                      autoFocus
                      className="w-full px-2 py-1 text-xs rounded ring-1 ring-yellow-600 bg-yellow-200 dark:bg-black text-gray-900 dark:text-yellow-100"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <option value="">{siteRoles.length ? 'Select a role' : 'No roles defined for this site'}</option>
                      {siteRoles.map(r => (
                        <option key={r.name} value={r.name}>{r.name} (${r.costPerHour.toFixed(2)}/hr)</option>
                      ))}
                    </select>
                  </EditableField>
                </div>

                {/* Hours */}
                <div className="text-yellow-700 dark:text-yellow-400">
                  <EditableField
                    displayValue={`Hours ${w.hours || '0'}`}
                    isEditing={isEditing}
                    editingField={editingField}
                    fieldName={`hours-${idx}`}
                    onStartEdit={setEditingField}
                    className="text-yellow-700 dark:text-yellow-400"
                  >
                    <span className="inline-flex items-center gap-1">
                      Hours
                      <input
                        type="number"
                        step="0.25"
                        min="0"
                        value={w.hours}
                        onChange={(e) => updateWork(idx, { hours: e.target.value })}
                        onBlur={() => setEditingField(null)}
                        autoFocus
                        className="w-20 px-2 py-1 text-xs rounded ring-1 ring-yellow-600 bg-yellow-200 dark:bg-black text-gray-900 dark:text-yellow-100 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </span>
                  </EditableField>
                </div>
              </div>

              {/* Notes */}
              <div>
                <EditableField
                  displayValue={w.notes || 'Notes'}
                  isEditing={isEditing}
                  editingField={editingField}
                  fieldName={`notes-${idx}`}
                  onStartEdit={setEditingField}
                  className="text-yellow-600 dark:text-yellow-500"
                >
                  <textarea
                    value={w.notes}
                    onChange={(e) => updateWork(idx, { notes: e.target.value })}
                    onBlur={() => setEditingField(null)}
                    autoFocus
                    rows={2}
                    placeholder="Notes"
                    className="w-full px-2 py-1 text-xs rounded ring-1 ring-yellow-600 bg-yellow-200 dark:bg-black text-gray-900 dark:text-yellow-100 resize-none"
                    onClick={(e) => e.stopPropagation()}
                  />
                </EditableField>
              </div>
            </div>

            {/* Expenses */}
            {(w.expenses.length > 0 || isEditing) && (
              <div className="space-y-1">
                {w.expenses.map((ex, exIdx) => (
                  <div key={exIdx} className="flex items-center gap-2">
                    <select
                      value={ex.expenseId || ''}
                      onChange={(e) => {
                        const opt = expenseOptions.find(o => o.id === e.target.value);
                        updateExpense(idx, exIdx, {
                          expenseId: e.target.value,
                          name: opt?.name || '',
                          dollarValue: opt?.dollarValue ?? ex.dollarValue,
                        });
                      }}
                      className="flex-1 px-2 py-1 text-xs rounded ring-1 ring-yellow-600 bg-yellow-200 dark:bg-black text-gray-900 dark:text-yellow-100"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <option value="">Select expense...</option>
                      {expenseOptions.map(o => (
                        <option key={o.id} value={o.id}>{o.name} (${o.dollarValue.toFixed(2)})</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={ex.quantity}
                      onChange={(e) => updateExpense(idx, exIdx, { quantity: parseFloat(e.target.value) || 0 })}
                      className="w-16 px-2 py-1 text-xs rounded ring-1 ring-yellow-600 bg-yellow-200 dark:bg-black text-gray-900 dark:text-yellow-100 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                      onClick={(e) => e.stopPropagation()}
                      title="Quantity"
                    />
                    <button
                      onClick={(e) => { e.stopPropagation(); removeExpense(idx, exIdx); }}
                      className="p-1 text-red-500 hover:text-red-700"
                      title="Remove expense"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                {isEditing && (
                  <button
                    onClick={(e) => { e.stopPropagation(); addExpense(idx); }}
                    className="inline-flex items-center gap-1 text-xs text-yellow-700 dark:text-yellow-400 hover:text-yellow-500"
                  >
                    <Plus className="w-3 h-3" /> Add expense
                  </button>
                )}
              </div>
            )}

            {isEditing && workEntries.length > 1 && (
              <div className="flex justify-end">
                <button
                  onClick={(e) => { e.stopPropagation(); removeWorkEntry(idx); }}
                  className="inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-700"
                >
                  <Trash2 className="w-3 h-3" /> Remove role
                </button>
              </div>
            )}
          </div>
        ))}
        {isEditing && (
          <button
            onClick={(e) => { e.stopPropagation(); addWorkEntry(); }}
            className="inline-flex items-center gap-1 text-xs text-yellow-700 dark:text-yellow-400 hover:text-yellow-500"
          >
            <Plus className="w-3 h-3" /> Add role
          </button>
        )}
      </div>

      {/* Top-level notes fallback (only if no per-work notes are used) */}
      {(!entry.workEntries || entry.workEntries.length === 0) && (
        <div className="text-xs">
          <EditableField
            displayValue={notes || 'Entry notes'}
            isEditing={isEditing}
            editingField={editingField}
            fieldName="entryNotes"
            onStartEdit={setEditingField}
            className="text-yellow-600 dark:text-yellow-500"
          >
            <textarea
              value={notes}
              onChange={(e) => { setNotes(e.target.value); markDirty(); }}
              onBlur={() => setEditingField(null)}
              autoFocus
              rows={2}
              className="w-full px-2 py-1 text-xs rounded ring-1 ring-yellow-600 bg-yellow-200 dark:bg-black text-gray-900 dark:text-yellow-100 resize-none"
              onClick={(e) => e.stopPropagation()}
            />
          </EditableField>
        </div>
      )}

      {isEditing && dirty && (
        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={(e) => { e.stopPropagation(); handleCancel(); }}
            className="flex items-center gap-1 px-3 py-1 text-xs bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          >
            <X className="w-3 h-3" /> Cancel
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleSave(); }}
            disabled={saving}
            className="flex items-center gap-1 px-3 py-1 text-xs bg-yellow-600 text-white rounded hover:bg-yellow-500 transition-colors disabled:opacity-50"
          >
            <Save className="w-3 h-3" /> {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      )}
    </div>
  );
}
