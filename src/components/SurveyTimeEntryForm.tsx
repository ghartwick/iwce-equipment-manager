import { useState, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import { Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import { SurveyTimeEntry, SurveyExpenseLine } from '../services/surveyTimecardService';
import { Client, clientManagementService } from '../services/clientManagementService';
import { Site, siteManagementService } from '../services/siteManagementService';
import { Expense, expenseManagementService } from '../services/expenseManagementService';

interface FormUser {
  id: string;
  username: string;
  role: 'admin' | 'supervisor' | 'field';
  name: string;
}

interface SurveyWorkEntryState {
  id: string;
  roleName: string;
  hours: string;
  expenses: SurveyExpenseLine[];
  notes: string;
  collapsed: boolean;
  expenseSelect: string;
  expenseQty: string;
}

interface SurveyTimeEntryFormProps {
  selectedDate: Date;
  entry?: SurveyTimeEntry;
  user: FormUser;
  onSubmit: (data: Partial<SurveyTimeEntry> & { isUpdate?: boolean }) => Promise<void>;
  onCancel: () => void;
  canEdit: boolean;
  entryOwnerName?: string;
}

export function SurveyTimeEntryForm({
  selectedDate,
  entry,
  user,
  onSubmit,
  onCancel,
  canEdit,
  entryOwnerName,
}: SurveyTimeEntryFormProps) {
  const [clients, setClients] = useState<Client[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loadingRef, setLoadingRef] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [clientId, setClientId] = useState<string>(entry?.clientId || '');
  const [site, setSite] = useState<string>(entry?.site || '');
  const [travelHours, setTravelHours] = useState<string>(entry ? String(entry.travelHours) : '');
  const [editableDate, setEditableDate] = useState<Date>(selectedDate);
  const [editingDate, setEditingDate] = useState(false);

  const newWorkEntry = (): SurveyWorkEntryState => ({
    id: Date.now().toString() + Math.random(),
    roleName: '',
    hours: '',
    expenses: [],
    notes: '',
    collapsed: false,
    expenseSelect: '',
    expenseQty: '1',
  });

  const [workEntries, setWorkEntries] = useState<SurveyWorkEntryState[]>(() => {
    if (entry) {
      if (entry.workEntries && entry.workEntries.length > 0) {
        return entry.workEntries.map((we, i) => ({
          id: we.id || String(i),
          roleName: we.roleName || '',
          hours: String(we.hours || 0),
          expenses: we.expenses || [],
          notes: we.notes || '',
          collapsed: true,
          expenseSelect: '',
          expenseQty: '1',
        }));
      }
      return [{
        id: '1',
        roleName: entry.roleName || '',
        hours: String(entry.hours || 0),
        expenses: entry.expenses || [],
        notes: entry.notes || '',
        collapsed: false,
        expenseSelect: '',
        expenseQty: '1',
      }];
    }
    return [newWorkEntry()];
  });

  useEffect(() => {
    const load = async () => {
      try {
        const [clientsData, sitesData, expensesData] = await Promise.all([
          clientManagementService.getActiveClients(),
          siteManagementService.getAllSites(),
          expenseManagementService.getActiveExpenses(),
        ]);
        setClients(clientsData);
        setSites(sitesData);
        setExpenses(expensesData);
      } catch (err) {
        console.error('Failed to load survey reference data:', err);
        setError('Failed to load clients/sites/expenses');
      } finally {
        setLoadingRef(false);
      }
    };
    load();
  }, []);

  const selectedClient = useMemo(() => clients.find(c => c.id === clientId), [clients, clientId]);
  const clientSites = useMemo(() => sites.filter(s => s.clientId === clientId && (s.isActive || s.name === site)), [sites, clientId, site]);
  const selectedSite = useMemo(() => sites.find(s => s.clientId === clientId && s.name === site), [sites, clientId, site]);
  const siteRoles = selectedSite?.roles || [];

  const totalWorkedHours = useMemo(
    () => workEntries.reduce((sum, e) => sum + (parseFloat(e.hours) || 0), 0),
    [workEntries]
  );

  const totalCost = useMemo(() => {
    const roleMap = Object.fromEntries(siteRoles.map(r => [r.name, r.costPerHour]));
    const labour = workEntries.reduce((sum, e) => sum + (parseFloat(e.hours) || 0) * (roleMap[e.roleName] || 0), 0);
    const travelCost = (parseFloat(travelHours) || 0) * (roleMap[workEntries[0]?.roleName] || 0);
    const exp = workEntries.reduce((sum, e) => sum + e.expenses.reduce((s, ex) => s + ex.dollarValue * ex.quantity, 0), 0);
    return Math.round((labour + travelCost + exp) * 100) / 100;
  }, [workEntries, travelHours, siteRoles]);

  const handleClientChange = (value: string) => {
    setClientId(value);
    setSite('');
    setWorkEntries(prev => prev.map(e => ({ ...e, roleName: '' })));
  };

  const handleSiteChange = (value: string) => {
    setSite(value);
    setWorkEntries(prev => prev.map(e => ({ ...e, roleName: '' })));
  };

  const updateWorkEntry = (id: string, updates: Partial<SurveyWorkEntryState>) => {
    setWorkEntries(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e));
  };

  const addNewWorkEntry = () => {
    setWorkEntries(prev => [...prev.map(e => ({ ...e, collapsed: true })), newWorkEntry()]);
  };

  const removeWorkEntry = (id: string) => {
    setWorkEntries(prev => prev.filter(e => e.id !== id));
  };

  const addExpenseToEntry = (weId: string) => {
    const we = workEntries.find(e => e.id === weId);
    if (!we) return;
    const expense = expenses.find(e => e.id === we.expenseSelect);
    const qty = parseFloat(we.expenseQty);
    if (!expense) { setError('Select an expense to add'); return; }
    if (isNaN(qty) || qty <= 0) { setError('Enter a valid quantity'); return; }
    setError(null);
    const existingIdx = we.expenses.findIndex(l => l.expenseId === expense.id);
    const updatedExpenses = existingIdx >= 0
      ? we.expenses.map((l, i) => i === existingIdx ? { ...l, quantity: l.quantity + qty } : l)
      : [...we.expenses, { expenseId: expense.id, name: expense.name, dollarValue: expense.dollarValue, quantity: qty }];
    updateWorkEntry(weId, { expenses: updatedExpenses, expenseSelect: '', expenseQty: '1' });
  };

  const buildData = (status: 'draft' | 'submitted', isUpdate: boolean): Partial<SurveyTimeEntry> & { isUpdate?: boolean } => {
    const builtEntries = workEntries.map(e => {
      const role = siteRoles.find(r => r.name === e.roleName);
      return { id: e.id, roleName: e.roleName, roleCostPerHour: role?.costPerHour || 0, hours: parseFloat(e.hours) || 0, expenses: e.expenses, notes: e.notes.trim() };
    });
    const first = builtEntries[0];
    return {
      userId: entry?.userId || user.id,
      date: editableDate,
      clientId,
      clientName: selectedClient?.name || '',
      site,
      roleName: first?.roleName || '',
      roleCostPerHour: first?.roleCostPerHour || 0,
      hours: first?.hours || 0,
      travelHours: parseFloat(travelHours) || 0,
      notes: first?.notes || '',
      expenses: workEntries.flatMap(e => e.expenses),
      workEntries: builtEntries,
      status,
      isUpdate,
    };
  };

  const validate = (): boolean => {
    if (!clientId) { setError('Select a client'); return false; }
    if (!site) { setError('Select a site'); return false; }
    for (let i = 0; i < workEntries.length; i++) {
      if (!workEntries[i].roleName) { setError(`Select a role for Entry ${i + 1}`); return false; }
      if (!workEntries[i].hours || parseFloat(workEntries[i].hours) <= 0) { setError(`Enter hours for Entry ${i + 1}`); return false; }
    }
    setError(null);
    return true;
  };

  const handleSave = async (status: 'draft' | 'submitted') => {
    if (!validate()) return;
    setSaving(true);
    try {
      await onSubmit(buildData(status, !!entry && status === 'draft'));
    } catch (err: any) {
      setError(err?.message || 'Failed to save survey time card');
    } finally {
      setSaving(false);
    }
  };

  if (loadingRef) {
    return <div className="text-yellow-600 dark:text-yellow-400 p-6">Loading...</div>;
  }

  const inputClass = 'w-full px-3 py-2 bg-yellow-200 dark:bg-black border border-yellow-400 dark:border-yellow-800 rounded-lg text-gray-900 dark:text-yellow-100 focus:outline-none focus:border-yellow-500 dark:focus:border-yellow-400 disabled:cursor-not-allowed disabled:opacity-50 transition-colors';
  const labelClass = 'block text-sm font-medium text-yellow-700 dark:text-yellow-600 mb-1';
  const disabled = !canEdit;

  return (
    <div className="bg-yellow-200 dark:bg-black border border-yellow-600 rounded-lg p-2">
      <div>
        {editingDate && canEdit ? (
          <input
            type="date"
            ref={(node) => { if (node) { node.focus(); try { (node as any).showPicker(); } catch {} } }}
            value={format(editableDate, 'yyyy-MM-dd')}
            onChange={(e) => {
              if (e.target.value) {
                const [y, m, d] = e.target.value.split('-').map(Number);
                setEditableDate(new Date(y, m - 1, d, 12, 0, 0));
              }
              setEditingDate(false);
            }}
            onBlur={() => setEditingDate(false)}
            onKeyDown={(e) => { if (e.key === 'Escape') setEditingDate(false); }}
            className="text-lg font-semibold bg-transparent border-b-2 border-yellow-500 text-yellow-700 dark:text-yellow-300 focus:outline-none mb-1"
            style={{ colorScheme: 'dark' }}
          />
        ) : (
          <h3
            onClick={() => { if (canEdit) setEditingDate(true); }}
            className={`text-lg font-semibold text-yellow-700 dark:text-yellow-300 mb-1 pr-8 ${canEdit ? 'cursor-pointer hover:text-yellow-500 dark:hover:text-yellow-200' : ''}`}
            title={canEdit ? 'Click to change date' : undefined}
          >
            {editableDate ? format(editableDate, 'EEEE, MMMM d, yyyy') : 'Select a Date'}
          </h3>
        )}
        <div className="text-yellow-700 dark:text-yellow-600 text-sm mb-4">
          {entryOwnerName || user.name || user.username}
        </div>

        <form onSubmit={(e) => { e.preventDefault(); handleSave('draft'); }} className="space-y-4">
          {error && (
            <div className="p-3 bg-red-100 dark:bg-red-900 dark:bg-opacity-30 border border-red-600 rounded-lg text-red-600 dark:text-red-300">
              {error}
            </div>
          )}

          {/* Client */}
          <div>
            <label className={labelClass}>Client</label>
            <select value={clientId} onChange={(e) => handleClientChange(e.target.value)} className={inputClass} disabled={disabled}>
              <option value="">Select a client</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {/* Site */}
          <div>
            <label className={labelClass}>Site</label>
            <select value={site} onChange={(e) => handleSiteChange(e.target.value)} className={inputClass} disabled={disabled || !clientId}>
              <option value="">{clientId ? 'Select a site' : 'Select a client first'}</option>
              {clientSites.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
            </select>
          </div>

          {/* Worked Hours + Travel Hours — compact row matching field timecard */}
          <div className="flex gap-4 items-start">
            <div className="flex flex-col flex-shrink-0">
              <label className="block text-xs font-medium text-yellow-700 dark:text-yellow-600 mb-0.5 whitespace-nowrap">
                Worked Hours
              </label>
              <input
                type="text"
                value={totalWorkedHours > 0 ? totalWorkedHours : ''}
                readOnly
                placeholder="0"
                className="w-28 px-2 py-1.5 text-sm bg-yellow-100 dark:bg-yellow-900 dark:bg-opacity-20 border border-yellow-400 dark:border-yellow-800 rounded-lg text-gray-900 dark:text-yellow-100 cursor-default"
              />
            </div>
            <div className="flex flex-col flex-shrink-0">
              <label className="block text-xs font-medium text-yellow-700 dark:text-yellow-600 mb-0.5 whitespace-nowrap">
                + Travel Hours
              </label>
              <input
                type="text"
                value={travelHours}
                onChange={(e) => {
                  const v = e.target.value.replace(/[^0-9.]/g, '');
                  if (v.length <= 5) {
                    const parts = v.split('.');
                    if (parts.length <= 2 && (parts[1] === undefined || parts[1].length <= 2)) setTravelHours(v);
                  }
                }}
                disabled={disabled}
                placeholder="0"
                inputMode="decimal"
                className="w-28 px-2 py-1.5 text-sm bg-yellow-200 dark:bg-black border border-yellow-400 dark:border-yellow-800 rounded-lg text-gray-900 dark:text-yellow-100 focus:outline-none focus:border-yellow-500 dark:focus:border-yellow-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              />
            </div>
          </div>

          {/* Work Entries */}
          <div className="space-y-4">
            <h3 className="text-yellow-600 dark:text-yellow-400 font-medium">Work Entries</h3>
            {workEntries.map((we, index) => (
              <div key={we.id} className="border border-yellow-400 dark:border-yellow-800 rounded-lg overflow-hidden">
                {/* Entry header */}
                <div
                  className="flex items-center justify-between px-3 py-2 bg-yellow-100 dark:bg-yellow-900 dark:bg-opacity-20 cursor-pointer select-none"
                  onClick={() => updateWorkEntry(we.id, { collapsed: !we.collapsed })}
                >
                  <div className="flex items-center gap-2 text-sm font-medium text-yellow-700 dark:text-yellow-400">
                    {we.collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    Entry {index + 1}{we.roleName ? ` — ${we.roleName}` : ''}{we.hours ? ` (${we.hours}h)` : ''}
                  </div>
                  {!disabled && workEntries.length > 1 && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); removeWorkEntry(we.id); }}
                      className="text-red-500 hover:text-red-400 text-xl font-bold leading-none px-1"
                    >
                      ×
                    </button>
                  )}
                </div>

                {/* Entry body */}
                {!we.collapsed && (
                  <div className="p-3 space-y-3 bg-yellow-200 dark:bg-black">
                    {/* Role */}
                    <div>
                      <label className={labelClass}>Role</label>
                      <select value={we.roleName} onChange={(e) => updateWorkEntry(we.id, { roleName: e.target.value })} className={inputClass} disabled={disabled || !site}>
                        <option value="">{site ? (siteRoles.length ? 'Select a role' : 'No roles defined') : 'Select a site first'}</option>
                        {siteRoles.map(r => <option key={r.name} value={r.name}>{r.name} (${r.costPerHour.toFixed(2)}/hr)</option>)}
                      </select>
                    </div>

                    {/* Hours */}
                    <div>
                      <label className={labelClass}>Hours</label>
                      <input type="number" min="0" step="0.25" value={we.hours} onChange={(e) => updateWorkEntry(we.id, { hours: e.target.value })} className={inputClass} disabled={disabled} placeholder="0" />
                    </div>

                    {/* Expenses */}
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm font-medium text-yellow-700 dark:text-yellow-600">Expenses</span>
                        {!disabled && (
                          <button
                            type="button"
                            onClick={() => addExpenseToEntry(we.id)}
                            className="w-6 h-6 bg-yellow-600 text-black rounded hover:bg-yellow-500 flex items-center justify-center font-bold text-lg leading-none transition-colors"
                          >
                            +
                          </button>
                        )}
                      </div>
                      {!disabled && (
                        <div className="flex flex-col sm:flex-row gap-2 mb-2">
                          <select value={we.expenseSelect} onChange={(e) => updateWorkEntry(we.id, { expenseSelect: e.target.value })} className={inputClass}>
                            <option value="">Select an expense</option>
                            {expenses.map(e => <option key={e.id} value={e.id}>{e.name} (${e.dollarValue.toFixed(2)})</option>)}
                          </select>
                          <input
                            type="number" min="1" step="1"
                            value={we.expenseQty}
                            onChange={(e) => updateWorkEntry(we.id, { expenseQty: e.target.value })}
                            placeholder="Qty"
                            className="w-full sm:w-28 px-3 py-2 bg-yellow-200 dark:bg-black border border-yellow-400 dark:border-yellow-800 rounded-lg text-gray-900 dark:text-yellow-100 focus:outline-none focus:border-yellow-500 dark:focus:border-yellow-400 transition-colors"
                          />
                        </div>
                      )}
                      {we.expenses.length > 0 ? (
                        <div className="overflow-x-auto border border-yellow-300 dark:border-yellow-700 rounded-lg">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="bg-yellow-600 dark:bg-yellow-900 dark:bg-opacity-30">
                                <th className="px-3 py-2 text-left text-yellow-100 dark:text-yellow-300">Expense</th>
                                <th className="px-3 py-2 text-right text-yellow-100 dark:text-yellow-300">Unit</th>
                                <th className="px-3 py-2 text-right text-yellow-100 dark:text-yellow-300">Qty</th>
                                <th className="px-3 py-2 text-right text-yellow-100 dark:text-yellow-300">Total</th>
                                {!disabled && <th className="px-3 py-2" />}
                              </tr>
                            </thead>
                            <tbody>
                              {we.expenses.map(line => (
                                <tr key={line.expenseId} className="border-b border-yellow-200 dark:border-yellow-800">
                                  <td className="px-3 py-2 text-gray-900 dark:text-yellow-100">{line.name}</td>
                                  <td className="px-3 py-2 text-right text-gray-900 dark:text-yellow-100">${line.dollarValue.toFixed(2)}</td>
                                  <td className="px-3 py-2 text-right text-gray-900 dark:text-yellow-100">{line.quantity}</td>
                                  <td className="px-3 py-2 text-right text-gray-900 dark:text-yellow-100">${(line.dollarValue * line.quantity).toFixed(2)}</td>
                                  {!disabled && (
                                    <td className="px-3 py-2 text-right">
                                      <button type="button" onClick={() => updateWorkEntry(we.id, { expenses: we.expenses.filter(l => l.expenseId !== line.expenseId) })} className="text-red-600 hover:text-red-500">
                                        <Trash2 className="h-4 w-4" />
                                      </button>
                                    </td>
                                  )}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className="text-xs text-yellow-600 dark:text-yellow-500">No expenses added.</p>
                      )}
                    </div>

                    {/* Notes */}
                    <div>
                      <label className={labelClass}>Notes</label>
                      <textarea value={we.notes} onChange={(e) => updateWorkEntry(we.id, { notes: e.target.value })} rows={3} className={inputClass} disabled={disabled} />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Add Entry Button */}
          {!disabled && (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={addNewWorkEntry}
                className="px-4 py-2 bg-yellow-600 text-black rounded-lg hover:bg-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                Add Entry
              </button>
            </div>
          )}

          {/* Total */}
          <div className="flex justify-end">
            <div className="text-sm text-yellow-700 dark:text-yellow-300">
              Estimated total: <span className="font-semibold text-gray-900 dark:text-yellow-100">${totalCost.toFixed(2)}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-3">
            <button type="button" onClick={onCancel} className="flex-1 p-2 bg-gray-600 text-white rounded-lg hover:bg-gray-500 transition-colors">
              Cancel
            </button>
            {canEdit && (
              <>
                <button type="submit" disabled={saving} className="flex-1 p-2 bg-yellow-500 text-black rounded-lg hover:bg-yellow-400 transition-colors">
                  {entry ? 'Update Survey Time Card' : 'Save Survey Time Card'}
                </button>
                {(!entry || entry.status === 'draft') && (
                  <button type="button" onClick={() => handleSave('submitted')} disabled={saving} className="flex-1 p-2 bg-yellow-100 dark:bg-yellow-900 dark:bg-opacity-50 text-yellow-700 dark:text-yellow-300 rounded-lg hover:bg-yellow-200 dark:hover:bg-opacity-70 transition-colors">
                    Submit
                  </button>
                )}
              </>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
