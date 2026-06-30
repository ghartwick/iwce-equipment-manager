import { useState, useEffect, useRef, useMemo } from 'react';
import { format } from 'date-fns';
import { Save, X, Plus } from 'lucide-react';
import { TimeEntry, WorkEntryData, EquipmentEntry } from '../services/timecardService';
import { siteManagementService, Site } from '../services/siteManagementService';
import { codeManagementService } from '../services/codeManagementService';
import { smallToolsManagementService } from '../services/smallToolsManagementService';
import { equipmentManagementService } from '../services/equipmentManagementService';

interface InlineTimecardEditProps {
  entry: TimeEntry;
  user: { id: string; username: string; role: string; name: string };
  canEdit: boolean;
  onSave: (entryId: string, updates: Partial<TimeEntry>, editedBy?: string) => Promise<void>;
  calcHours: (clockIn: any, clockOut: any) => number | null;
}

// Helper to parse Firestore timestamps or Date objects
function toDate(val: any): Date {
  if (val instanceof Date) return val;
  if (val && 'toDate' in val && typeof val.toDate === 'function') return val.toDate();
  return new Date(val);
}

// Clickable field wrapper — shows text normally, input when active
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
  if (isEditing && editingField === fieldName) {
    return <>{children}</>;
  }

  if (!isEditing) {
    return <span className={className}>{displayValue}</span>;
  }

  // In edit mode but this field not active — clickable text, no underline
  return (
    <span
      className={`${className} cursor-pointer hover:bg-yellow-100 dark:hover:bg-yellow-900 dark:hover:bg-opacity-30 px-0.5 rounded`}
      onClick={(e) => {
        e.stopPropagation();
        onStartEdit(fieldName);
      }}
    >
      {displayValue || '(click to set)'}
    </span>
  );
}

export function InlineTimecardEdit({ entry, user, canEdit, onSave, calcHours }: InlineTimecardEditProps) {
  const [editingField, setEditingField] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Edit state mirrors the entry fields
  const [dateStr, setDateStr] = useState('');
  const [clockIn, setClockIn] = useState('');
  const [clockOut, setClockOut] = useState('');
  const [job, setJob] = useState('');
  const [travelHours, setTravelHours] = useState('');
  const [workEntries, setWorkEntries] = useState<WorkEntryData[]>([]);
  const [notes, setNotes] = useState('');

  // Raw data for filtering
  const [sites, setSites] = useState<Site[]>([]);
  const [allCodes, setAllCodes] = useState<string[]>([]);
  const [sitesData, setSitesData] = useState<Site[]>([]);
  const [allEquipmentData, setAllEquipmentData] = useState<{id: string; name: string; site?: string; parentId?: string}[]>([]);
  const [smallToolsOptions, setSmallToolsOptions] = useState<string[]>([]);
  const [optionsLoaded, setOptionsLoaded] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  // Always editing if canEdit — auto-init on mount
  const isEditing = canEdit;

  // Initialize edit values from entry on mount
  useEffect(() => {
    const inDate = entry.clockIn ? toDate(entry.clockIn) : null;
    const outDate = entry.clockOut ? toDate(entry.clockOut) : null;
    const entryDateVal = entry.date ? toDate(entry.date) : null;
    setDateStr(entryDateVal ? format(entryDateVal, 'yyyy-MM-dd') : '');
    setClockIn(inDate ? format(inDate, 'HH:mm') : '');
    setClockOut(outDate ? format(outDate, 'HH:mm') : '');
    setJob(entry.job || '');
    setTravelHours(entry.travelHours?.toString() || '');
    setNotes(entry.notes || '');
    setWorkEntries(
      entry.workEntries && entry.workEntries.length > 0
        ? entry.workEntries.map((we: any) => {
            // Convert legacy equipment to equipmentEntries if needed
            if (!we.equipmentEntries && we.equipment && Array.isArray(we.equipment)) {
              we.equipmentEntries = we.equipment.map((eq: string, idx: number) => ({
                id: Date.now().toString() + idx,
                equipment: eq,
                machineHours: we.machineHours || 0
              }));
            }
            return { ...we };
          })
        : [{
            id: '1',
            notes: '',
            code: '',
            equipment: [],
            equipmentEntries: [],
            machineHours: 0,
            labourHours: 0,
            smallTools: []
          }]
    );
  }, [entry]);

  // Load dropdown options on mount
  useEffect(() => {
    if (!canEdit || optionsLoaded) return;
    const loadOptions = async () => {
      try {
        const [sitesResult, crewSitesResult, codesResult, equipResult, toolsResult] = await Promise.all([
          siteManagementService.getAllSites(),
          siteManagementService.getFieldCrewSites(),
          codeManagementService.getActiveCodes(),
          equipmentManagementService.getAllEquipment(),
          smallToolsManagementService.getAllSmallTools(),
        ]);
        const activeSites = sitesResult.filter((s: Site) => s.isActive);
        // Field crews work a single client: the site selector is limited to the
        // default field-crew client's sites, while full site data is retained
        // for code/equipment filtering.
        setSites(crewSitesResult);
        setSitesData(activeSites);
        setAllCodes(codesResult.map((c: any) => c.name));
        setAllEquipmentData(
          equipResult
            .filter((e: any) => e.isActive && e.showInTimecard)
            .map((e: any) => ({ id: e.id, name: e.name, site: e.site, parentId: e.parentId }))
        );
        setSmallToolsOptions(toolsResult.filter((t: any) => t.isActive).map((t: any) => t.name));
        setOptionsLoaded(true);
      } catch (err) {
        console.error('Failed to load options:', err);
      }
    };
    loadOptions();
  }, [canEdit, optionsLoaded]);

  // Filter codes by selected site (same logic as TimeEntryForm)
  const filteredCodes = useMemo(() => {
    if (job) {
      const selectedSite = sitesData.find(s => s.name === job);
      if (selectedSite && (selectedSite as any).codes && (selectedSite as any).codes.length > 0) {
        return (selectedSite as any).codes as { name: string; description?: string }[];
      }
    }
    return allCodes.map(name => ({ name, description: '' }));
  }, [allCodes, job, sitesData]);

  // Filter equipment by selected site + linked (co-located) sites (both directions)
  const filteredEquipment = useMemo(() => {
    if (!job) return [];
    const selectedSite = sitesData.find(s => s.name === job);
    const forwardLinks = selectedSite?.linkedSites ?? [];
    const reverseLinks = sitesData.filter(s => s.linkedSites?.includes(job)).map(s => s.name);
    const sitesToInclude = [...new Set([job, ...forwardLinks, ...reverseLinks])];
    const parentIdsAtSites = new Set(
      allEquipmentData.filter(item => !item.parentId && sitesToInclude.includes(item.site ?? '')).map(item => item.id)
    );
    return allEquipmentData.filter(item =>
      (!item.parentId && sitesToInclude.includes(item.site ?? '')) ||
      (item.parentId && parentIdsAtSites.has(item.parentId))
    );
  }, [job, allEquipmentData, sitesData]);

  const handleFieldClick = (field: string) => {
    setEditingField(field);
  };

  // Close active field when clicking outside it
  useEffect(() => {
    if (!editingField) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setEditingField(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [editingField]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const targetDate = dateStr ? new Date(dateStr + 'T12:00:00') : toDate(entry.date);
      const [inH, inM] = clockIn.split(':').map(Number);
      const [outH, outM] = clockOut.split(':').map(Number);

      const newClockIn = new Date(targetDate);
      newClockIn.setHours(inH, inM, 0, 0);
      const newClockOut = new Date(targetDate);
      newClockOut.setHours(outH, outM, 0, 0);

      const workedHours = calcHours(newClockIn, newClockOut) ?? 0;

      // Filter out empty equipment entries before saving
      const filteredWorkEntries = workEntries.map(we => ({
        ...we,
        equipmentEntries: we.equipmentEntries && we.equipmentEntries.length > 0
          ? we.equipmentEntries
              .filter(e => e.id !== 'default')
              .filter(e => {
                const hours = typeof e.machineHours === 'string' ? parseFloat(e.machineHours) : e.machineHours;
                return e.equipment && e.equipment.trim() !== '' && hours !== 0 && hours !== 0.00;
              })
          : []
      }));

      const updates: Partial<TimeEntry> = {
        date: targetDate,
        clockIn: newClockIn,
        clockOut: newClockOut,
        hours: workedHours,
        job: job || undefined,
        travelHours: travelHours ? parseFloat(travelHours) : undefined,
        workEntries: filteredWorkEntries.length > 0 ? filteredWorkEntries : undefined,
        notes: notes || undefined,
      };

      const isEditingOthersCard = entry.userId !== user.id;
      const editedBy = isEditingOthersCard ? user.username : undefined;

      await onSave(entry.id!, updates, editedBy);
      setDirty(false);
      setEditingField(null);
    } catch (err) {
      console.error('Failed to save:', err);
      alert('Failed to save changes.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    // Re-init from entry to discard changes
    const inDate = entry.clockIn ? toDate(entry.clockIn) : null;
    const outDate = entry.clockOut ? toDate(entry.clockOut) : null;
    const cancelDateVal = entry.date ? toDate(entry.date) : null;
    setDateStr(cancelDateVal ? format(cancelDateVal, 'yyyy-MM-dd') : '');
    setClockIn(inDate ? format(inDate, 'HH:mm') : '');
    setClockOut(outDate ? format(outDate, 'HH:mm') : '');
    setJob(entry.job || '');
    setTravelHours(entry.travelHours?.toString() || '');
    setNotes(entry.notes || '');
    setWorkEntries(
      entry.workEntries
        ? entry.workEntries.map((we: any) => ({ ...we }))
        : []
    );
    setDirty(false);
    setEditingField(null);
  };

  // Mark dirty on any change
  const markDirty = () => { if (!dirty) setDirty(true); };

  // Update a work entry field
  const updateWorkEntry = (idx: number, field: string, value: any) => {
    markDirty();
    setWorkEntries(prev => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: value };
      return updated;
    });
  };

  // Computed display values
  const inDate = entry.clockIn ? toDate(entry.clockIn) : null;
  const outDate = entry.clockOut ? toDate(entry.clockOut) : null;

  return (
    <div ref={containerRef} className="mt-3 pt-3 border-t border-yellow-200 dark:border-yellow-700 space-y-2" onClick={(e) => e.stopPropagation()}>
      {/* Date - editable */}
      {isEditing && (
        <div className="text-xs">
          <EditableField
            displayValue={dateStr ? format(new Date(dateStr + 'T12:00:00'), 'MMM d, yyyy') : '--'}
            isEditing={isEditing}
            editingField={editingField}
            fieldName="date"
            onStartEdit={handleFieldClick}
            className="text-yellow-700 dark:text-yellow-600 font-medium"
          >
            <span className="inline-flex items-center gap-1">
              Date:
              <input
                type="date"
                value={dateStr}
                onChange={(e) => { setDateStr(e.target.value); markDirty(); setEditingField(null); }}
                autoFocus
                className="px-2 py-1 text-xs rounded ring-1 ring-yellow-600 bg-yellow-200 dark:bg-black text-gray-900 dark:text-yellow-100"
                style={{ colorScheme: 'dark' }}
                onClick={(e) => e.stopPropagation()}
              />
            </span>
          </EditableField>
        </div>
      )}

      {/* Time Details */}
      <div className="flex items-center gap-2 text-xs text-yellow-700 dark:text-yellow-600">
        {(entry.clockIn || isEditing) && (
          <EditableField
            displayValue={inDate ? `In: ${format(inDate, 'HH:mm')}` : 'In: --:--'}
            isEditing={isEditing}
            editingField={editingField}
            fieldName="clockIn"
            onStartEdit={handleFieldClick}
            className="text-yellow-700 dark:text-yellow-600"
          >
            <span className="inline-flex items-center gap-1">
              In:
              <input
                type="time"
                value={clockIn}
                onChange={(e) => { setClockIn(e.target.value); markDirty(); }}
                onBlur={() => setEditingField(null)}
                autoFocus
                className="px-2 py-1 text-xs rounded ring-1 ring-yellow-600 bg-yellow-200 dark:bg-black text-gray-900 dark:text-yellow-100"
                onClick={(e) => e.stopPropagation()}
              />
            </span>
          </EditableField>
        )}
        {(entry.clockOut || isEditing) && (
          <EditableField
            displayValue={outDate ? `Out: ${format(outDate, 'HH:mm')}` : 'Out: --:--'}
            isEditing={isEditing}
            editingField={editingField}
            fieldName="clockOut"
            onStartEdit={handleFieldClick}
            className="text-yellow-700 dark:text-yellow-600"
          >
            <span className="inline-flex items-center gap-1">
              Out:
              <input
                type="time"
                value={clockOut}
                onChange={(e) => { setClockOut(e.target.value); markDirty(); }}
                onBlur={() => setEditingField(null)}
                autoFocus
                className="px-2 py-1 text-xs rounded ring-1 ring-yellow-600 bg-yellow-200 dark:bg-black text-gray-900 dark:text-yellow-100"
                onClick={(e) => e.stopPropagation()}
              />
            </span>
          </EditableField>
        )}
        {travelHours && (
          <EditableField
            displayValue={`Travel: ${travelHours}`}
            isEditing={isEditing}
            editingField={editingField}
            fieldName="travelHours"
            onStartEdit={handleFieldClick}
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
                className="w-16 px-2 py-1 text-xs rounded ring-1 ring-yellow-600 bg-yellow-200 dark:bg-black text-gray-900 dark:text-yellow-100 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                onClick={(e) => e.stopPropagation()}
              />
            </span>
          </EditableField>
        )}
      </div>

      {/* Site/Job - editable */}
      {job && (
        <div className="text-xs">
          <EditableField
            displayValue={`Site: ${job}`}
            isEditing={isEditing}
            editingField={editingField}
            fieldName="job"
            onStartEdit={handleFieldClick}
            className="text-gray-900 dark:text-yellow-100"
          >
            <span className="inline-flex items-center gap-1">
              Site:
              <select
                value={job}
                onChange={(e) => { setJob(e.target.value); markDirty(); setEditingField(null); }}
                autoFocus
                className="px-2 py-1 text-xs rounded ring-1 ring-yellow-600 bg-yellow-200 dark:bg-black text-gray-900 dark:text-yellow-100"
                onClick={(e) => e.stopPropagation()}
              >
                <option value="">Select site...</option>
                {sites.map(s => (
                  <option key={s.id} value={s.name}>{s.name}</option>
                ))}
              </select>
            </span>
          </EditableField>
        </div>
      )}

      {/* Work Entries */}
      {(isEditing || ((isEditing ? workEntries : entry.workEntries) || []).length > 0) && (
        <div className="space-y-1">
          {(isEditing ? workEntries : entry.workEntries || []).map((workEntry: any, idx: number) => (
            <div key={workEntry.id || idx} className="text-xs bg-yellow-50 dark:bg-yellow-900 dark:bg-opacity-20 p-2 rounded">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div className="space-y-0.5">
                  {/* Code - filtered by site */}
                  <div className="font-medium text-yellow-800 dark:text-yellow-300">
                    <EditableField
                      displayValue={(() => {
                        const codeObj = filteredCodes.find(c => c.name === workEntry.code);
                        if (!codeObj) return workEntry.code || '';
                        return codeObj.description ? `${codeObj.name} - ${codeObj.description}` : codeObj.name;
                      })()}
                      isEditing={isEditing}
                      editingField={editingField}
                      fieldName={`code-${idx}`}
                      onStartEdit={handleFieldClick}
                      className="font-medium text-yellow-800 dark:text-yellow-300"
                    >
                      <select
                        value={workEntry.code || ''}
                        onChange={(e) => { updateWorkEntry(idx, 'code', e.target.value); setEditingField(null); }}
                        autoFocus
                        className="w-full px-2 py-1 text-xs rounded ring-1 ring-yellow-600 bg-yellow-200 dark:bg-black text-gray-900 dark:text-yellow-100"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <option value="">Select code...</option>
                        {filteredCodes.map(c => (
                          <option key={c.name} value={c.name}>{c.name}{c.description ? ` - ${c.description}` : ''}</option>
                        ))}
                      </select>
                    </EditableField>
                  </div>

                  {/* Machine Hours */}
                  {workEntry.machineHours && (
                    <div className="text-yellow-700 dark:text-yellow-400">
                      <EditableField
                        displayValue={`Machine ${workEntry.machineHours}`}
                        isEditing={isEditing}
                        editingField={editingField}
                        fieldName={`machineHours-${idx}`}
                        onStartEdit={handleFieldClick}
                        className="text-yellow-700 dark:text-yellow-400"
                      >
                        <span className="inline-flex items-center gap-1">
                          Machine
                          <input
                            type="number"
                            step="0.25"
                            min="0"
                            value={workEntry.machineHours || ''}
                            onChange={(e) => updateWorkEntry(idx, 'machineHours', e.target.value ? parseFloat(e.target.value) : undefined)}
                            onBlur={() => setEditingField(null)}
                            autoFocus
                            className="w-16 px-2 py-1 text-xs rounded ring-1 ring-yellow-600 bg-yellow-200 dark:bg-black text-gray-900 dark:text-yellow-100 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                            onClick={(e) => e.stopPropagation()}
                          />
                        </span>
                      </EditableField>
                    </div>
                  )}

                  {/* Labour Hours */}
                  {workEntry.labourHours && (
                    <div className="text-yellow-700 dark:text-yellow-400">
                      <EditableField
                        displayValue={`Labour ${workEntry.labourHours}`}
                        isEditing={isEditing}
                        editingField={editingField}
                        fieldName={`labourHours-${idx}`}
                        onStartEdit={handleFieldClick}
                        className="text-yellow-700 dark:text-yellow-400"
                      >
                        <span className="inline-flex items-center gap-1">
                          Labour
                          <input
                            type="number"
                            step="0.25"
                            min="0"
                            value={workEntry.labourHours || ''}
                            onChange={(e) => updateWorkEntry(idx, 'labourHours', e.target.value ? parseFloat(e.target.value) : undefined)}
                            onBlur={() => setEditingField(null)}
                            autoFocus
                            className="w-16 px-2 py-1 text-xs rounded ring-1 ring-yellow-600 bg-yellow-200 dark:bg-black text-gray-900 dark:text-yellow-100 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                            onClick={(e) => e.stopPropagation()}
                          />
                        </span>
                      </EditableField>
                    </div>
                  )}

                  {/* Equipment Entries */}
                  {workEntry.equipmentEntries && workEntry.equipmentEntries.filter((e: EquipmentEntry) => {
                    const hours = typeof e.machineHours === 'string' ? parseFloat(e.machineHours) : e.machineHours;
                    return e.equipment && e.equipment.trim() !== '' && hours !== 0 && hours !== 0.00;
                  }).length > 0 && (
                    <div className="text-yellow-700 dark:text-yellow-400">
                    <EditableField
                      displayValue={workEntry.equipmentEntries
                        .filter((e: EquipmentEntry) => {
                          const hours = typeof e.machineHours === 'string' ? parseFloat(e.machineHours) : e.machineHours;
                          return e.equipment && e.equipment.trim() !== '' && hours !== 0 && hours !== 0.00;
                        })
                        .map((e: EquipmentEntry) => `${e.equipment} - ${e.machineHours} hrs`).join(', ')}
                      isEditing={isEditing}
                      editingField={editingField}
                      fieldName={`equipment-${idx}`}
                      onStartEdit={handleFieldClick}
                    >
                      <div className="space-y-1">
                        {(workEntry.equipmentEntries && workEntry.equipmentEntries.length > 0 ? workEntry.equipmentEntries : [{ id: 'default', equipment: '', machineHours: 0 }]).map((equipEntry: EquipmentEntry, eqIdx: number) => (
                          <div key={equipEntry.id} className="flex items-center gap-2">
                            <select
                              value={equipEntry.equipment}
                              onChange={(e) => {
                                let updated = [...(workEntry.equipmentEntries || [])];
                                // If this is the default row and we're adding the first equipment, replace it
                                if (equipEntry.id === 'default' && e.target.value) {
                                  updated = [{ id: Date.now().toString(), equipment: e.target.value, machineHours: equipEntry.machineHours }];
                                } else {
                                  updated[eqIdx] = { ...updated[eqIdx], equipment: e.target.value };
                                }
                                updateWorkEntry(idx, 'equipmentEntries', updated);
                                // Calculate the sum of all equipment machine hours
                                const totalMachineHours = updated.reduce((sum, item) => {
                                  const hours = parseFloat(item.machineHours) || 0;
                                  return sum + hours;
                                }, 0);
                                updateWorkEntry(idx, 'machineHours', totalMachineHours.toString());
                              }}
                              className="flex-1 px-2 py-1 text-xs rounded ring-1 ring-yellow-600 bg-yellow-200 dark:bg-black text-gray-900 dark:text-yellow-100"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <option value="">Select Equipment</option>
                              {filteredEquipment.map(e => (
                                <option key={e.id} value={e.name}>{e.name}</option>
                              ))}
                            </select>
                            <input
                              type="text"
                              value={equipEntry.machineHours}
                              onChange={(e) => {
                                const value = e.target.value.replace(/[^0-9.]/g, '');
                                if (value.length <= 5) {
                                  const parts = value.split('.');
                                  if (parts.length <= 2 && (parts[1] === undefined || parts[1].length <= 2)) {
                                    let updated = [...(workEntry.equipmentEntries || [])];
                                    if (equipEntry.id === 'default' && value) {
                                      updated = [{ id: Date.now().toString(), equipment: equipEntry.equipment, machineHours: value }];
                                    } else if (equipEntry.id !== 'default') {
                                      updated[eqIdx] = { ...updated[eqIdx], machineHours: value };
                                    }
                                    updateWorkEntry(idx, 'equipmentEntries', updated);
                                    const totalMachineHours = updated.reduce((sum, item) => {
                                      const hours = parseFloat(item.machineHours) || 0;
                                      return sum + hours;
                                    }, 0);
                                    updateWorkEntry(idx, 'machineHours', totalMachineHours.toString());
                                  }
                                }
                              }}
                              placeholder="0"
                              maxLength={5}
                              inputMode="decimal"
                              className="w-16 px-2 py-1 text-xs rounded ring-1 ring-yellow-600 bg-yellow-200 dark:bg-black text-gray-900 dark:text-yellow-100 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                              onClick={(e) => e.stopPropagation()}
                            />
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const newEntry: EquipmentEntry = {
                                  id: Date.now().toString(),
                                  equipment: '',
                                  machineHours: 0
                                };
                                const updated = [...(workEntry.equipmentEntries || []), newEntry];
                                updateWorkEntry(idx, 'equipmentEntries', updated);
                                const totalMachineHours = updated.reduce((sum, item) => {
                                  const hours = parseFloat(item.machineHours) || 0;
                                  return sum + hours;
                                }, 0);
                                updateWorkEntry(idx, 'machineHours', totalMachineHours.toString());
                              }}
                              className="p-1 text-yellow-600 dark:text-yellow-400 hover:text-yellow-500 dark:hover:text-yellow-300"
                              title="Add Equipment"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </EditableField>
                  </div>
                )}

                  {/* Small Tools */}
                  {workEntry.smallTools?.length > 0 && (
                    <div className="text-yellow-700 dark:text-yellow-400">
                      <EditableField
                        displayValue={`${Array.isArray(workEntry.smallTools) ? workEntry.smallTools.join(', ') : workEntry.smallTools}`}
                        isEditing={isEditing}
                        editingField={editingField}
                        fieldName={`smallTools-${idx}`}
                        onStartEdit={handleFieldClick}
                        className="text-yellow-700 dark:text-yellow-400"
                      >
                        <div className="space-y-1" onClick={(e) => e.stopPropagation()}>
                          {Array.isArray(workEntry.smallTools) && workEntry.smallTools.map((tool: string, tIdx: number) => (
                            <span key={tIdx} className="inline-flex items-center gap-1 bg-yellow-200 dark:bg-yellow-800 px-1 rounded text-xs mr-1">
                              {tool}
                              <button onClick={() => {
                                const updated = workEntry.smallTools.filter((_: any, i: number) => i !== tIdx);
                                updateWorkEntry(idx, 'smallTools', updated);
                              }} className="text-red-500 hover:text-red-700">&times;</button>
                            </span>
                          ))}
                          <select
                            value=""
                            onChange={(e) => {
                              if (e.target.value) {
                                const current = Array.isArray(workEntry.smallTools) ? workEntry.smallTools : [];
                                updateWorkEntry(idx, 'smallTools', [...current, e.target.value]);
                              }
                            }}
                            className="w-full px-2 py-1 text-xs rounded ring-1 ring-yellow-600 bg-yellow-200 dark:bg-black text-gray-900 dark:text-yellow-100"
                          >
                            <option value="">Add tool...</option>
                            {smallToolsOptions.map(t => (
                              <option key={t} value={t}>{t}</option>
                            ))}
                          </select>
                        </div>
                      </EditableField>
                    </div>
                  )}
                </div>

                {/* Notes */}
                <div>
                  {workEntry.notes && (
                    <EditableField
                      displayValue={workEntry.notes}
                      isEditing={isEditing}
                      editingField={editingField}
                      fieldName={`notes-${idx}`}
                      onStartEdit={handleFieldClick}
                      className="text-yellow-600 dark:text-yellow-500"
                    >
                      <textarea
                        value={workEntry.notes || ''}
                        onChange={(e) => updateWorkEntry(idx, 'notes', e.target.value)}
                        onBlur={() => setEditingField(null)}
                        autoFocus
                        rows={2}
                        className="w-full px-2 py-1 text-xs rounded ring-1 ring-yellow-600 bg-yellow-200 dark:bg-black text-gray-900 dark:text-yellow-100 resize-none"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </EditableField>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Legacy single entry display (no workEntries) */}
      {!entry.workEntries && !isEditing && (entry.code || entry.equipment || entry.machineHours || entry.labourHours || entry.notes) && (
        <div className="text-xs bg-yellow-50 dark:bg-yellow-900 dark:bg-opacity-20 p-2 rounded">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div>
              {entry.code && (
                <div className="font-medium text-yellow-800 dark:text-yellow-300">
                  {(() => {
                    const codeObj = filteredCodes.find(c => c.name === entry.code);
                    if (!codeObj) return entry.code;
                    return codeObj.description ? `${codeObj.name} - ${codeObj.description}` : codeObj.name;
                  })()}
                </div>
              )}
              {entry.machineHours && (
                <div className="text-yellow-700 dark:text-yellow-400">Machine {entry.machineHours}</div>
              )}
              {entry.labourHours && (
                <div className="text-yellow-700 dark:text-yellow-400">Labour {entry.labourHours}</div>
              )}
              {entry.equipment && (
                <div className="text-yellow-700 dark:text-yellow-400">{entry.equipment}</div>
              )}
              {entry.smallTools && (
                <div className="text-yellow-700 dark:text-yellow-400">
                  {Array.isArray(entry.smallTools) ? entry.smallTools.join(', ') : entry.smallTools}
                </div>
              )}
            </div>
            {entry.notes && (
              <div className="text-yellow-600 dark:text-yellow-500">{entry.notes}</div>
            )}
          </div>
        </div>
      )}

      {/* Save / Cancel bar — only show when changes have been made */}
      {isEditing && dirty && (
        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={(e) => { e.stopPropagation(); handleCancel(); }}
            className="flex items-center gap-1 px-3 py-1 text-xs bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          >
            <X className="w-3 h-3" />
            Cancel
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleSave(); }}
            disabled={saving}
            className="flex items-center gap-1 px-3 py-1 text-xs bg-yellow-600 text-white rounded hover:bg-yellow-500 transition-colors disabled:opacity-50"
          >
            <Save className="w-3 h-3" />
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      )}
    </div>
  );
}
