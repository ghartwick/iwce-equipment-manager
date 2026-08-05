import { useState, useEffect, useCallback, useMemo } from 'react';
import { format } from 'date-fns';
import { ChevronDown, ChevronUp, Plus } from 'lucide-react';
import { TimeEntry, User } from '../services/timecardService';
import { Site, siteManagementService, normalizeSiteName } from '../services/siteManagementService';
import { codeManagementService } from '../services/codeManagementService';
import { smallToolsManagementService } from '../services/smallToolsManagementService';
import { equipmentManagementService } from '../services/equipmentManagementService';
import { fleetManagementService } from '../services/fleetManagementService';
import { Equipment } from '../types';
import { Alert } from './Alert';
import { SiteSelectDropdown, SiteOption } from './SiteSelectDropdown';

interface TimeEntryFormProps {
  selectedDate: Date;
  entry?: TimeEntry;
  user: User;
  onSubmit: (entry: Omit<TimeEntry, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onCancel: () => void;
  canEdit: boolean;
  selectedEntryId?: string | null;
  entryOwnerName?: string;
  isInline?: boolean;
  showCancelButton?: boolean;
}

// Define the structure for a single work entry
interface WorkEntry {
  id: string;
  notes: string;
  code: string;
  equipment: string[]; // Legacy - kept for backward compatibility
  equipmentEntries?: { id: string; equipment: string; machineHours: number | string }[];
  machineHours: string;
  labourHours: string;
  smallTools: string[];
  collapsed: boolean;
}

// Component to render a single work entry (moved outside to prevent re-renders)
const WorkEntrySection = ({ 
  entry, 
  entryIndex, 
  updateEntryField, 
  addSmallTool, 
  removeSmallTool, 
  removeEntry,
  toggleCollapse,
  isLocked,
  hoursMatch,
  codeOptionsWithDetails,
  equipmentOptions,
  smallToolsOptions
}: {
  entry: WorkEntry;
  entryIndex: number;
  updateEntryField: (entryId: string, field: keyof WorkEntry, value: any) => void;
  addSmallTool: (entryId: string, tool: string) => void;
  removeSmallTool: (entryId: string, toolToRemove: string) => void;
  removeEntry: (entryId: string) => void;
  toggleCollapse: (entryId: string) => void;
  isLocked: boolean;
  hoursMatch: boolean;
  codeOptionsWithDetails: { name: string; description?: string }[];
  equipmentOptions: { name: string; description?: string }[];
  smallToolsOptions: string[];
}) => {
  // Create stable onChange handlers to prevent re-render issues
  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    updateEntryField(entry.id, 'notes', e.target.value);
  };
  
  const handleCodeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    updateEntryField(entry.id, 'code', e.target.value);
  };
  
  const handleMachineHoursChange = () => {
    // This field is now read-only and calculated from equipment entries
    // So we don't allow direct editing
  };
  
  const handleLabourHoursChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9.]/g, '');
    // Allow up to 5 characters (e.g., "99.99") and validate decimal places
    if (value.length <= 5) {
      // Check if decimal format is valid (max 2 decimal places)
      const parts = value.split('.');
      if (parts.length <= 2 && (parts[1] === undefined || parts[1].length <= 2)) {
        updateEntryField(entry.id, 'labourHours', value);
      }
    }
  };
  

  return (
    <div className="border border-yellow-400 dark:border-yellow-800 rounded-lg p-3 sm:p-4 bg-yellow-50 dark:bg-black bg-opacity-50">
      {/* Header */}
      <div 
        className="cursor-pointer"
        onClick={() => !isLocked && toggleCollapse(entry.id)}
      >
        <div className="flex justify-between items-center">
          <h3 className="text-yellow-600 dark:text-yellow-400 font-medium">
            Entry {entryIndex + 1}
          </h3>
          <div className="flex items-center gap-2">
            {entryIndex > 0 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removeEntry(entry.id);
                }}
                disabled={isLocked}
                className="text-red-600 dark:text-red-400 hover:text-red-500 dark:hover:text-red-300 disabled:opacity-50"
              >
                Remove
              </button>
            )}
            <button
              type="button"
              className="text-yellow-600 dark:text-yellow-400 hover:text-yellow-500 dark:hover:text-yellow-200 disabled:opacity-50"
              disabled={isLocked}
            >
              {entry.collapsed ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
            </button>
          </div>
        </div>

        {/* Show summary when collapsed */}
        {entry.collapsed && (
          <div className="mt-2 text-sm text-yellow-700 dark:text-yellow-500">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div>
                {entry.code && (
                  <div><span className="font-medium">Code:</span> {entry.code}</div>
                )}
                {entry.machineHours && (
                  <div><span className="font-medium">Machine:</span> {entry.machineHours}</div>
                )}
                {entry.labourHours && (
                  <div><span className="font-medium">Labour:</span> {entry.labourHours}</div>
                )}
                {(entry.equipmentEntries && entry.equipmentEntries.filter(e => e.equipment && e.equipment.trim() !== '' && e.machineHours !== 0 && e.machineHours !== '0' && e.machineHours !== '0.00').length > 0) && (
                  <div>
                    {entry.equipmentEntries
                      .filter(e => e.equipment && e.equipment.trim() !== '' && e.machineHours !== 0 && e.machineHours !== '0' && e.machineHours !== '0.00')
                      .map((equipEntry, idx) => (
                      <div key={idx}>
                        {equipEntry.equipment} - {equipEntry.machineHours} hrs
                      </div>
                    ))}
                  </div>
                )}
                {entry.equipment.length > 0 && !entry.equipmentEntries && (
                  <div>{entry.equipment.join(', ')}</div>
                )}
                {entry.smallTools.length > 0 && (
                  <div>{entry.smallTools.join(', ')}</div>
                )}
              </div>
              {entry.notes && (
                <div className="text-yellow-600 dark:text-yellow-500">
                  {entry.notes}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Show content only if not collapsed */}
      {!entry.collapsed && (
        <>
        {/* Code Dropdown */}
        <div className="mb-3">
            <select
              value={entry.code}
              onChange={handleCodeChange}
              disabled={isLocked}
              className="w-full px-3 py-2 bg-yellow-200 dark:bg-black border border-yellow-600 dark:border-yellow-800 rounded-lg text-gray-900 dark:text-yellow-100 focus:outline-none focus:border-yellow-400 disabled:opacity-50"
            >
              <option value="">Select Code</option>
              {codeOptionsWithDetails.map(codeOption => (
                <option key={codeOption.name} value={codeOption.name}>
                  {codeOption.name}{codeOption.description ? ` - ${codeOption.description}` : ''}
                </option>
              ))}
            </select>
          </div>

        {/* Machine & Labour Hours */}
        <div className="flex gap-2 sm:gap-4 overflow-x-auto mb-3">
          {/* Machine Hours */}
          <div className="flex flex-col flex-shrink-0 min-w-0">
            <label className="block text-xs font-medium text-yellow-600 dark:text-yellow-600 mb-1 whitespace-nowrap">
              Machine Hrs
            </label>
            <input
              type="text"
              value={entry.machineHours}
              onChange={handleMachineHoursChange}
              disabled={isLocked || true}
              readOnly
              className={`w-20 sm:w-auto px-1 sm:px-2 py-1.5 text-xs sm:text-sm bg-yellow-100 dark:bg-gray-800 border rounded-lg text-gray-700 dark:text-yellow-200 focus:outline-none disabled:opacity-50 [-moz-appearance:_textfield] [&::-webkit-inner-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:m-0 [&::-webkit-outer-spin-button]:appearance-none cursor-not-allowed ${
                !hoursMatch ? 'border-red-500' : 'border-yellow-400 dark:border-yellow-800'
              }`}
              maxLength={5}
              inputMode="decimal"
              placeholder="0"
              title="Auto-calculated from equipment hours"
            />
          </div>

          {/* Labour Hours */}
          <div className="flex flex-col flex-shrink-0 min-w-0">
            <label className="block text-xs font-medium text-yellow-700 dark:text-yellow-600 mb-1 whitespace-nowrap">
              Labour Hrs
            </label>
            <input
              type="text"
              value={entry.labourHours}
              onChange={handleLabourHoursChange}
              disabled={isLocked}
              className={`w-20 sm:w-auto px-1 sm:px-2 py-1.5 text-xs sm:text-sm bg-yellow-200 dark:bg-black border rounded-lg text-gray-900 dark:text-yellow-100 focus:outline-none disabled:opacity-50 [-moz-appearance:_textfield] [&::-webkit-inner-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:m-0 [&::-webkit-outer-spin-button]:appearance-none ${
                !hoursMatch ? 'border-red-500' : 'border-yellow-400 dark:border-yellow-800'
              }`}
              maxLength={5}
              inputMode="decimal"
              placeholder="0"
            />
          </div>
        </div>

        {/* Equipment Entries - Always visible */}
        <div className="space-y-2 mb-3">
          {(entry.equipmentEntries && entry.equipmentEntries.length > 0 ? entry.equipmentEntries : [{ id: 'default', equipment: '', machineHours: 0 }]).map((equipEntry, eqIdx) => (
            <div key={equipEntry.id} className="flex items-center gap-2">
              <select
                value={equipEntry.equipment}
                onChange={(e) => {
                  let updated = [...(entry.equipmentEntries || [])];
                  // If this is the default row and we're adding the first equipment, replace it
                  if (equipEntry.id === 'default' && e.target.value) {
                    updated = [{ id: Date.now().toString(), equipment: e.target.value, machineHours: typeof equipEntry.machineHours === 'number' ? equipEntry.machineHours : parseFloat(equipEntry.machineHours) || 0 }];
                  } else {
                    updated[eqIdx] = { ...updated[eqIdx], equipment: e.target.value };
                  }
                  updateEntryField(entry.id, 'equipmentEntries', updated);
                  
                  // Calculate the sum of all equipment machine hours
                  const totalMachineHours = updated.reduce((sum, item) => {
                    const hours = typeof item.machineHours === 'string' ? parseFloat(item.machineHours) || 0 : item.machineHours || 0;
                    return sum + hours;
                  }, 0);
                  
                  // Update the main machine hours field with the sum
                  updateEntryField(entry.id, 'machineHours', totalMachineHours.toString());
                }}
                disabled={isLocked}
                className="flex-1 min-w-0 max-w-48 sm:max-w-none px-3 py-2 bg-yellow-200 dark:bg-black border border-yellow-600 dark:border-yellow-800 rounded-lg text-gray-900 dark:text-yellow-100 focus:outline-none focus:border-yellow-400 disabled:opacity-50"
              >
                <option value="">Select Equipment</option>
                {equipmentOptions.map(equipmentOption => (
                  <option key={equipmentOption.name} value={equipmentOption.name}>
                    {equipmentOption.name}{equipmentOption.description ? ` - ${equipmentOption.description}` : ''}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={equipEntry.machineHours?.toString() || ''}
                onChange={(e) => {
                  const value = e.target.value.replace(/[^0-9.]/g, '');
                  // Allow up to 5 characters (e.g., "99.99") and validate decimal places
                  if (value.length <= 5) {
                    // Check if decimal format is valid (max 2 decimal places)
                    const parts = value.split('.');
                    if (parts.length <= 2 && (parts[1] === undefined || parts[1].length <= 2)) {
                      let updated = [...(entry.equipmentEntries || [])];
                      // Store as string during typing, convert to number on blur
                      const displayValue = value;
                      const numValue = parseFloat(value) || 0;
                      // If this is the default row and we're adding hours, replace it
                      if (equipEntry.id === 'default' && value) {
                        updated = [{ id: Date.now().toString(), equipment: equipEntry.equipment, machineHours: displayValue.endsWith('.') ? displayValue : numValue }];
                      } else if (equipEntry.id !== 'default') {
                        updated[eqIdx] = { ...updated[eqIdx], machineHours: displayValue.endsWith('.') ? displayValue : numValue };
                      }
                      updateEntryField(entry.id, 'equipmentEntries', updated);
                      
                      // Calculate the sum of all equipment machine hours
                      const totalMachineHours = updated.reduce((sum, item) => {
                        const hours = typeof item.machineHours === 'string' ? parseFloat(item.machineHours) || 0 : item.machineHours || 0;
                        return sum + hours;
                      }, 0);
                      
                      // Update the main machine hours field with the sum
                      updateEntryField(entry.id, 'machineHours', totalMachineHours.toString());
                    }
                  }
                }}
                onBlur={(e) => {
                  const value = e.target.value;
                  const numValue = parseFloat(value) || 0;
                  let updated = [...(entry.equipmentEntries || [])];
                  if (equipEntry.id === 'default' && value) {
                    updated = [{ id: Date.now().toString(), equipment: equipEntry.equipment, machineHours: numValue }];
                  } else if (equipEntry.id !== 'default') {
                    updated[eqIdx] = { ...updated[eqIdx], machineHours: numValue };
                  }
                  updateEntryField(entry.id, 'equipmentEntries', updated);
                  
                  // Recalculate sum
                  const totalMachineHours = updated.reduce((sum, item) => {
                    const hours = typeof item.machineHours === 'string' ? parseFloat(item.machineHours) || 0 : item.machineHours || 0;
                    return sum + hours;
                  }, 0);
                  updateEntryField(entry.id, 'machineHours', totalMachineHours.toString());
                }}
                placeholder="0"
                disabled={isLocked}
                maxLength={5}
                inputMode="decimal"
                className="w-20 sm:w-32 px-1 sm:px-2 py-1.5 text-xs sm:text-sm bg-yellow-200 dark:bg-black border border-yellow-600 dark:border-yellow-800 rounded-lg text-gray-900 dark:text-yellow-100 focus:outline-none disabled:opacity-50 [-moz-appearance:_textfield] [&::-webkit-inner-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:m-0 [&::-webkit-outer-spin-button]:appearance-none"
              />
              <button
                  type="button"
                  onClick={() => {
                    const newEntry = {
                      id: Date.now().toString(),
                      equipment: '',
                      machineHours: 0
                    };
                    const updated = [...(entry.equipmentEntries || []), newEntry];
                    updateEntryField(entry.id, 'equipmentEntries', updated);
                    
                    // Calculate the sum of all equipment machine hours
                    const totalMachineHours = updated.reduce((sum, item) => {
                      const hours = typeof item.machineHours === 'string' ? parseFloat(item.machineHours) || 0 : item.machineHours || 0;
                      return sum + hours;
                    }, 0);
                    
                    // Update the main machine hours field with the sum
                    updateEntryField(entry.id, 'machineHours', totalMachineHours.toString());
                  }}
                  disabled={isLocked}
                  className="p-2 text-yellow-600 dark:text-yellow-400 hover:text-yellow-500 dark:hover:text-yellow-300 disabled:opacity-50"
                  title="Add Equipment"
                >
                  <Plus className="w-4 h-4" />
                </button>
            </div>
          ))}
        </div>

        {/* Small Tools Dropdown */}
        <div className="mb-3">
          {/* Selected Tools Display */}
          {entry.smallTools.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {entry.smallTools.map((tool, index) => (
                <div
                  key={index}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 dark:bg-yellow-900 dark:bg-opacity-30 border border-yellow-400 dark:border-yellow-700 rounded text-gray-800 dark:text-yellow-100 text-sm"
                >
                  {tool}
                  <button
                    type="button"
                    onClick={() => removeSmallTool(entry.id, tool)}
                    disabled={isLocked}
                    className="text-yellow-600 dark:text-yellow-400 hover:text-yellow-500 dark:hover:text-yellow-200 disabled:opacity-50"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
          
          {/* Add Tool Dropdown */}
          <select
            value=""
            onChange={(e) => {
              if (e.target.value) {
                addSmallTool(entry.id, e.target.value);
                e.target.value = '';
              }
            }}
            disabled={isLocked}
            className="w-full px-3 py-2 bg-yellow-200 dark:bg-black border border-yellow-600 dark:border-yellow-800 rounded-lg text-gray-900 dark:text-yellow-100 focus:outline-none focus:border-yellow-400 disabled:opacity-50"
          >
            <option value="">Select Small Tools</option>
            {smallToolsOptions.filter(option => !entry.smallTools.includes(option)).map(smallToolsOption => (
              <option key={smallToolsOption} value={smallToolsOption}>
                {smallToolsOption}
              </option>
            ))}
          </select>
        </div>

        {/* Task Description */}
        <div className="flex flex-col">
          <label className="block text-xs font-medium text-yellow-600 dark:text-yellow-600 mb-1 whitespace-nowrap">
            Notes
          </label>
          <textarea
            value={entry.notes}
            onChange={handleNotesChange}
            disabled={isLocked}
            rows={3}
            className="w-full px-3 py-2 bg-yellow-200 dark:bg-black border border-yellow-600 dark:border-yellow-800 rounded-lg text-gray-900 dark:text-yellow-100 focus:outline-none focus:border-yellow-400 disabled:opacity-50 resize-none"
            placeholder="Add any notes about this time entry..."
          />
        </div>
        </>
      )}
    </div>
  );
};

export const TimeEntryForm: React.FC<TimeEntryFormProps> = ({
  selectedDate,
  entry,
  user,
  onSubmit, 
  onCancel, 
  canEdit,
  selectedEntryId,
  entryOwnerName,
  isInline = false,
  showCancelButton = false
}: TimeEntryFormProps) => {
  const [clockIn, setClockIn] = useState('');
  const [clockOut, setClockOut] = useState('');
  const [job, setJob] = useState('');
  const [customSite, setCustomSite] = useState('');
  const [hours, setHours] = useState(0);
  const [travelHours, setTravelHours] = useState('');
  const [jobOptions, setJobOptions] = useState<SiteOption[]>([]);
  const [codeOptionsState, setCodeOptionsState] = useState<string[]>([]);
  const [sitesData, setSitesData] = useState<Site[]>([]);
  const [smallToolsOptionsState, setSmallToolsOptionsState] = useState<string[]>([]);
  const [allEquipmentData, setAllEquipmentData] = useState<{id: string; name: string; description?: string; site?: string; parentId?: string}[]>([]);
  const [fleetEquipment, setFleetEquipment] = useState<Equipment[]>([]);
  const [truckNumber, setTruckNumber] = useState('');
  const [workEntries, setWorkEntries] = useState<WorkEntry[]>([
    {
      id: '1',
      notes: '',
      code: '',
      equipment: [],
      equipmentEntries: [],
      machineHours: '',
      labourHours: '',
      smallTools: [],
      collapsed: false
    }
  ]);

  // Alert state
  const [alert, setAlert] = useState<{ message: string; type: 'error' | 'warning' | 'info' } | null>(null);
  const [editableDate, setEditableDate] = useState<Date>(selectedDate);
  const [editingDate, setEditingDate] = useState(false);

  const showAlert = (message: string, type: 'error' | 'warning' | 'info' = 'error') => {
    setAlert({ message, type });
  };

  // Calculate validation for hours matching (sum of ALL work entries)
  const totalMachineHours = workEntries.reduce((sum, entry) => {
    return sum + (parseFloat(entry.machineHours || '0') || 0);
  }, 0);
  const totalLabourHours = workEntries.reduce((sum, entry) => {
    return sum + (parseFloat(entry.labourHours || '0') || 0);
  }, 0);
  const totalMachineLabourHours = totalMachineHours + totalLabourHours;
  const hoursMatch = Math.abs(totalMachineLabourHours - hours) < 0.01; // Allow for small floating point differences

  // Add tool to small tools array for specific entry
  const addSmallTool = useCallback((entryId: string, tool: string) => {
    setWorkEntries(prev => prev.map(entry => {
      if (entry.id === entryId && tool && !entry.smallTools.includes(tool)) {
        return { ...entry, smallTools: [...entry.smallTools, tool] };
      }
      return entry;
    }));
  }, []);

  // Remove tool from small tools array for specific entry
  const removeSmallTool = useCallback((entryId: string, toolToRemove: string) => {
    setWorkEntries(prev => prev.map(entry => {
      if (entry.id === entryId) {
        return { ...entry, smallTools: entry.smallTools.filter(tool => tool !== toolToRemove) };
      }
      return entry;
    }));
  }, []);

  // Update field for specific entry
  const updateEntryField = useCallback((entryId: string, field: keyof WorkEntry, value: any) => {
    setWorkEntries(prev => prev.map(entry => {
      if (entry.id === entryId) {
        return { ...entry, [field]: value };
      }
      return entry;
    }));
  }, []);

  // Toggle collapse state for specific entry
  const toggleCollapse = useCallback((entryId: string) => {
    setWorkEntries(prev => prev.map(entry => {
      if (entry.id === entryId) {
        return { ...entry, collapsed: !entry.collapsed };
      }
      return entry;
    }));
  }, []);

  const removeEntry = useCallback((entryId: string) => {
  if (workEntries.length <= 1) return; // Can't remove last entry
  
  // Find the entry to check if it has data
  const entryToRemove = workEntries.find(entry => entry.id === entryId);
  if (!entryToRemove) return;
  
  // Check if entry has any meaningful data
  const hasData = entryToRemove.notes.trim() || 
                 entryToRemove.code || 
                 entryToRemove.equipment.length > 0 || 
                 entryToRemove.machineHours || 
                 entryToRemove.labourHours || 
                 entryToRemove.smallTools.length > 0;
  
  // Show confirmation if entry has data
  if (hasData) {
    const confirmRemove = window.confirm(
      'Are you sure you want to remove this work entry?\n\n' +
      'All data in this entry will be permanently deleted.'
    );
    if (!confirmRemove) return;
  }
  
  // Remove the entry
  setWorkEntries(prev => prev.filter(entry => entry.id !== entryId));
}, [workEntries]);

  // Add new entry
  const addNewEntry = () => {
    setWorkEntries(prev => {
      const newEntry: WorkEntry = {
        id: Date.now().toString(),
        notes: '',
        code: '',
        equipment: [],
        equipmentEntries: [],
        machineHours: '',
        labourHours: '',
        smallTools: [],
        collapsed: false
      };
      
      // Collapse all existing entries when adding a new one
      const updatedEntries = prev.map(entry => ({ ...entry, collapsed: true }));
      
      return [...updatedEntries, newEntry];
    });
    
    // Scroll to the new entry after a brief delay to allow re-render
    setTimeout(() => {
      const newEntryElement = document.getElementById(`work-entry-${Date.now().toString()}`);
      if (newEntryElement) {
        newEntryElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        // Fallback: scroll to the bottom of the work entries container
        const container = document.getElementById('work-entries-container');
        if (container) {
          container.scrollTop = container.scrollHeight;
        }
      }
    }, 100);
  };

  // Generate time options for clock in/out (half-hour increments)
  const generateTimeOptions = () => {
    const options = [];
    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        const displayTime = hour === 0 ? `12:${minute.toString().padStart(2, '0')} AM` : 
                           hour === 12 ? `12:${minute.toString().padStart(2, '0')} PM` : 
                           hour < 12 ? `${hour}:${minute.toString().padStart(2, '0')} AM` : 
                           `${hour - 12}:${minute.toString().padStart(2, '0')} PM`;
        options.push({ value: time, label: displayTime });
      }
    }
    return options;
  };

  // Load sites, codes, and small tools from database
  useEffect(() => {
    const loadOptions = async () => {
      try {
        const sites = await siteManagementService.getActiveSites();
        setSitesData(sites);
        // Field/supervisor crews work a single client: limit the site selector
        // to the default field-crew client's sites. Admins and surveyors work
        // across clients so they see every active site.
        const isCrossClientUser = user.role === 'admin' || !!user.isSurveyor;
        const jobSites = isCrossClientUser
          ? sites
          : await siteManagementService.getFieldCrewSites();
        setJobOptions(jobSites.map(site => ({ id: site.id, name: site.name, description: site.description })));
        
        const codes = await codeManagementService.getActiveCodes();
        setCodeOptionsState(codes.map(code => code.name));
        
        const smallTools = await smallToolsManagementService.getActiveSmallTools();
        setSmallToolsOptionsState(smallTools.map(tool => tool.name));
        
        const equipment = await equipmentManagementService.getTimecardEquipment();
        const equipmentData = equipment.map(item => ({ id: item.id, name: item.name, description: item.description || '', site: item.site, parentId: item.parentId }));
        setAllEquipmentData(equipmentData);

        const fleet = await fleetManagementService.getAllEquipment();
        setFleetEquipment(fleet.filter(t => t.isActive));
      } catch (error) {
        console.error('Failed to load dropdown options:', error);
      }
    };
    loadOptions();
  }, []);

  // Use state-based code options, filtered by selected site
  const codeOptionsWithDetails = useMemo(() => {
    if (job) {
      const selectedSite = sitesData.find(s => normalizeSiteName(s.name) === normalizeSiteName(job));
      if (selectedSite && selectedSite.codes && selectedSite.codes.length > 0) {
        return selectedSite.codes;
      }
    }
    // Fall back to all codes if no site selected or site has no codes
    return codeOptionsState.map(name => ({ name, description: '' }));
  }, [codeOptionsState, job, sitesData]);

  // Use state-based small tools options
  const smallToolsOptions = useMemo(() => smallToolsOptionsState, [smallToolsOptionsState]);

  // Use state-based equipment options, filtered by selected site + any linked (co-located) sites
  const equipmentOptions = useMemo(() => {
    if (!job) return [];
    const selectedSite = sitesData.find(s => normalizeSiteName(s.name) === normalizeSiteName(job));
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

  useEffect(() => {
    if (entry) {
      // Handle Firestore Timestamps for clockIn and clockOut
      let clockInDate = entry.clockIn;
      let clockOutDate = entry.clockOut;
      
      if (entry.clockIn && 'toDate' in entry.clockIn && typeof (entry.clockIn as any).toDate === 'function') {
        clockInDate = (entry.clockIn as any).toDate();
      }
      
      if (entry.clockOut && 'toDate' in entry.clockOut && typeof (entry.clockOut as any).toDate === 'function') {
        clockOutDate = (entry.clockOut as any).toDate();
      }
      
      setClockIn(format(clockInDate, 'HH:mm'));
      setClockOut(format(clockOutDate, 'HH:mm'));
      setJob(entry.job || '');
      setHours(entry.hours);
      setTravelHours(entry.travelHours?.toString() || '');
      setTruckNumber((entry as any).truckNumber || '');
      
      // Load work entries from existing entry or create default
      if (entry.workEntries && entry.workEntries.length > 0) {
        // Load from new workEntries structure
        setWorkEntries(entry.workEntries.map(workEntry => {
          // Convert legacy equipment to equipmentEntries if needed
          let equipmentEntries = workEntry.equipmentEntries || [];
          if (!equipmentEntries.length && workEntry.equipment && Array.isArray(workEntry.equipment)) {
            equipmentEntries = workEntry.equipment.map((eq: string, idx: number) => ({
              id: Date.now().toString() + idx,
              equipment: eq,
              machineHours: workEntry.machineHours || 0
            }));
          }
          
          return {
            id: workEntry.id,
            notes: workEntry.notes || '',
            code: workEntry.code || '',
            equipment: Array.isArray(workEntry.equipment) ? workEntry.equipment : (workEntry.equipment ? [workEntry.equipment] : []),
            equipmentEntries: equipmentEntries,
            machineHours: workEntry.machineHours?.toString() || '',
            labourHours: workEntry.labourHours?.toString() || '',
            smallTools: workEntry.smallTools || [],
            collapsed: true  // Always load collapsed for existing entries
          };
        }));
      } else if (entry.notes || entry.code || entry.equipment || entry.machineHours || entry.labourHours || entry.smallTools) {
        // Load from legacy single entry structure
        const legacyEquipment = entry.equipment ? [entry.equipment] : [];
        const legacyEquipmentEntries = entry.equipmentEntries || (legacyEquipment.length > 0 && entry.equipment ? [{
          id: '1',
          equipment: entry.equipment,
          machineHours: entry.machineHours || 0
        }] : []);
        
        setWorkEntries([{
          id: '1',
          notes: entry.notes || '',
          code: entry.code || '',
          equipment: legacyEquipment,
          equipmentEntries: legacyEquipmentEntries,
          machineHours: entry.machineHours?.toString() || '',
          labourHours: entry.labourHours?.toString() || '',
          smallTools: entry.smallTools ? (Array.isArray(entry.smallTools) ? entry.smallTools : [entry.smallTools]) : [],
          collapsed: true
        }]);
      } else {
        // Create default empty entry (collapsed for existing entries)
        setWorkEntries([{
          id: '1',
          notes: '',
          code: '',
          equipment: [],
          equipmentEntries: [],
          machineHours: '',
          labourHours: '',
          smallTools: [],
          collapsed: false
        }]);
      }
    } else if (selectedDate) {
      setEditableDate(selectedDate);
      // Reset form for new entry
      setClockIn('');
      setClockOut('');
      setJob('');
      setHours(0);
      setTravelHours('');
      setTruckNumber('');
      setWorkEntries([{
        id: '1',
        notes: '',
        code: '',
        equipment: [],
        equipmentEntries: [],
        machineHours: '',
        labourHours: '',
        smallTools: [],
        collapsed: false
      }]);
    }
  }, [entry, selectedDate]);

  useEffect(() => {
    // Calculate hours when clock in/out change
    if (clockIn && clockOut) {
      const [inHours, inMinutes] = clockIn.split(':').map(Number);
      const [outHours, outMinutes] = clockOut.split(':').map(Number);
      
      const inTime = new Date();
      inTime.setHours(inHours, inMinutes, 0, 0);
      
      const outTime = new Date();
      outTime.setHours(outHours, outMinutes, 0, 0);
      
      if (outTime > inTime) {
        const diff = outTime.getTime() - inTime.getTime();
        const calculatedHours = diff / (1000 * 60 * 60);
        setHours(Math.round(calculatedHours * 100) / 100);
      }
    }
  }, [clockIn, clockOut]);

  // Handle custom site initialization when editing existing entries.
  // Validate against the full site list (sitesData), not the client-restricted
  // jobOptions quick-pick list — a site can be a real, valid site without
  // belonging to the default field-crew client's restricted dropdown.
  useEffect(() => {
    const entryJob = entry?.job;
    if (entryJob && sitesData.length > 0) {
      if (!sitesData.some(s => normalizeSiteName(s.name) === normalizeSiteName(entryJob))) {
        setJob('Other');
        setCustomSite(entryJob);
      } else {
        setJob(entryJob);
        setCustomSite('');
      }
    }
  }, [entry, sitesData]);

  const assignTruckToEmployee = async () => {
    if (!truckNumber) return;
    const truck = fleetEquipment.find(t => t.name === truckNumber);
    if (!truck) return;
    if (truck.employee === user.name) return;
    try {
      await fleetManagementService.updateEquipment(
        truck.id,
        { employee: user.name },
        { username: user.username, role: user.role }
      );
    } catch (error) {
      console.error('Failed to assign truck to employee:', error);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!clockIn || !clockOut) {
      showAlert('Please select both clock in and clock out times');
      return;
    }

    // Validate site selection
    if (!job) {
      showAlert('Please select a site');
      return;
    }

    if (job === 'Other' && !customSite.trim()) {
      showAlert('Please specify the site name');
      return;
    }

    // Hours matching validation removed for save/update
    const [inHours, inMinutes] = clockIn.split(':').map(Number);
    const [outHours, outMinutes] = clockOut.split(':').map(Number);
    
    const inTime = new Date();
    inTime.setHours(inHours, inMinutes, 0, 0);
    
    const outTime = new Date();
    outTime.setHours(outHours, outMinutes, 0, 0);
    
    const clockInDate = new Date(editableDate);
    clockInDate.setHours(inHours, inMinutes, 0, 0);
    
    const clockOutDate = new Date(editableDate);
    clockOutDate.setHours(outHours, outMinutes, 0, 0);

    // Convert work entries to the format expected by the database
    const workEntriesData = workEntries
      .map(entry => ({
        id: entry.id,
        notes: entry.notes || null,
        code: entry.code || null,
        equipment: entry.equipment.length > 0 ? entry.equipment : null,
        equipmentEntries: entry.equipmentEntries && entry.equipmentEntries.length > 0 
          ? entry.equipmentEntries
              .filter(e => e.id !== 'default')
              .filter(e => e.equipment && e.equipment.trim() !== '' && (e.machineHours !== 0 && e.machineHours !== '0' && e.machineHours !== '0.00'))
          : null,
        machineHours: entry.machineHours ? parseFloat(entry.machineHours) : null,
        labourHours: entry.labourHours ? parseFloat(entry.labourHours) : null,
        smallTools: entry.smallTools.length > 0 ? entry.smallTools : null,
        collapsed: entry.collapsed || false
      }))
      .filter(entry => 
        entry.notes || 
        entry.code || 
        (entry.equipment && entry.equipment.length > 0) || 
        (entry.equipmentEntries && entry.equipmentEntries.length > 0) ||
        entry.machineHours !== null || 
        entry.labourHours !== null ||
        (entry.smallTools && entry.smallTools.length > 0)
      );

    // Create clean entry data without any undefined/null values
    const cleanEntryData: any = {
      // Preserve original userId for existing entries
      userId: entry?.userId || user.id,
      date: editableDate,
      clockIn: clockInDate,
      clockOut: clockOutDate,
      hours,
      travelHours: parseFloat(travelHours) || 0,
      job: job === 'Other' ? customSite.trim() : job,
      status: entry?.status || 'draft',
      isLocked: entry?.isLocked || false,
    };

    // Add workEntries if there are valid entries
    if (workEntriesData.length > 0) {
      cleanEntryData.workEntries = workEntriesData;
      
      // Add legacy fields only if first entry has data
      const firstEntry = workEntriesData[0];
      if (firstEntry.code) cleanEntryData.code = firstEntry.code;
      if (firstEntry.equipment) cleanEntryData.equipment = firstEntry.equipment;
      if (firstEntry.machineHours !== null) cleanEntryData.machineHours = firstEntry.machineHours;
      if (firstEntry.labourHours !== null) cleanEntryData.labourHours = firstEntry.labourHours;
      if (firstEntry.smallTools) cleanEntryData.smallTools = firstEntry.smallTools;
      if (firstEntry.notes) cleanEntryData.notes = firstEntry.notes;
    } else {
      // No work entries, but still save basic time data
      // Add legacy fields from the first work entry even if empty
      const firstEntry = workEntries[0];
      if (firstEntry.code) cleanEntryData.code = firstEntry.code;
      if (firstEntry.equipment) cleanEntryData.equipment = firstEntry.equipment;
      if (firstEntry.machineHours) cleanEntryData.machineHours = parseFloat(firstEntry.machineHours);
      if (firstEntry.labourHours) cleanEntryData.labourHours = parseFloat(firstEntry.labourHours);
      if (firstEntry.smallTools.length > 0) cleanEntryData.smallTools = firstEntry.smallTools;
      if (firstEntry.notes) cleanEntryData.notes = firstEntry.notes;
    }

    // Add optional fields only if they exist
    if (entry?.submittedAt) cleanEntryData.submittedAt = entry.submittedAt;
    // Always preserve status for existing entries
    if (entry?.status) cleanEntryData.status = entry.status;
    if (entry?.isLocked !== undefined) cleanEntryData.isLocked = entry.isLocked;
    if (entry?.submittedBy) cleanEntryData.submittedBy = entry.submittedBy;
    if (entry?.lastEditedBy) cleanEntryData.lastEditedBy = entry.lastEditedBy;
    if (entry?.lastEditedAt) cleanEntryData.lastEditedAt = entry.lastEditedAt;
    if (truckNumber) cleanEntryData.truckNumber = truckNumber;

    // Create final data object without JSON stringify/parse to preserve all fields
    const finalData: any = {
      ...cleanEntryData,
      date: editableDate,
      clockIn: clockInDate,
      clockOut: clockOutDate,
      // Add flag to indicate this is an update, not a submit
      isUpdate: true,
    };

    assignTruckToEmployee();
    onSubmit(finalData);
  };

  const handleSubmitSubmit = async () => {
    if (!clockIn || !clockOut) {
      showAlert('Please select both clock in and clock out times before submitting');
      return;
    }

    // Validate site selection
    if (!job) {
      showAlert('Please select a site');
      return;
    }

    if (job === 'Other' && !customSite.trim()) {
      showAlert('Please specify the site name');
      return;
    }

    // Validate that at least one entry has meaningful data
    const hasValidEntry = workEntries.some(entry => 
      entry.notes.trim() || 
      entry.code || 
      entry.equipment || 
      entry.machineHours || 
      entry.labourHours ||
      entry.smallTools.length > 0
    );

    if (!hasValidEntry) {
      showAlert('Please add at least one work entry with data before submitting');
      return;
    }

    // Validate that total hours match the sum of machine and labour hours
    if (!hoursMatch) {
      showAlert(`Total hours (${hours}) must match the sum of machine and labour hours (${totalMachineLabourHours}). Please check your entries.`);
      return;
    }

    // Show confirmation dialog
    const confirmSubmit = window.confirm(
      'By submitting this form, I confirm that, to the best of my knowledge, all assigned work has been completed and that I departed the worksite without injury, illness, or incident at the time of departure.\n\n' +
      'Once submitted the card is locked.'
    );

    if (!confirmSubmit) {
      return;
    }

    // Create the same data as handleSubmit but with 'submitted' status
    const [inHours, inMinutes] = clockIn.split(':').map(Number);
    const [outHours, outMinutes] = clockOut.split(':').map(Number);
      
    const clockInDate = new Date(editableDate);
    clockInDate.setHours(inHours, inMinutes, 0, 0);
      
    const clockOutDate = new Date(editableDate);
    clockOutDate.setHours(outHours, outMinutes, 0, 0);

    const workEntriesData = workEntries
      .map(entry => ({
        id: entry.id,
        notes: entry.notes || null,
        code: entry.code || null,
        equipment: entry.equipment.length > 0 ? entry.equipment : null,
        equipmentEntries: entry.equipmentEntries && entry.equipmentEntries.length > 0 ? entry.equipmentEntries.filter(e => e.id !== 'default') : null,
        machineHours: entry.machineHours ? parseFloat(entry.machineHours) : null,
        labourHours: entry.labourHours ? parseFloat(entry.labourHours) : null,
        smallTools: entry.smallTools.length > 0 ? entry.smallTools : null,
        collapsed: entry.collapsed || false
      }))
      .filter(entry => 
        entry.notes || 
        entry.code || 
        (entry.equipment && entry.equipment.length > 0) || 
        (entry.equipmentEntries && entry.equipmentEntries.length > 0) ||
        entry.machineHours !== null || 
        entry.labourHours !== null ||
        (entry.smallTools && entry.smallTools.length > 0)
      );

    // Create clean entry data without any undefined/null values
    const cleanEntryData: any = {
      userId: entry?.userId || user.id,
      date: editableDate,
      clockIn: clockInDate,
      clockOut: clockOutDate,
      hours,
      travelHours: parseFloat(travelHours) || 0,
      job: job === 'Other' ? customSite.trim() : job,
      status: 'submitted',
      submittedAt: new Date(),
      isLocked: true, // Submitted entries are locked
    };

    // Only add workEntries if there are valid entries
    if (workEntriesData.length > 0) {
      cleanEntryData.workEntries = workEntriesData;
      
      // Add legacy fields only if first entry has data
      const firstEntry = workEntriesData[0];
      if (firstEntry.code) cleanEntryData.code = firstEntry.code;
      if (firstEntry.equipment) cleanEntryData.equipment = firstEntry.equipment;
      if (firstEntry.machineHours !== null) cleanEntryData.machineHours = firstEntry.machineHours;
      if (firstEntry.labourHours !== null) cleanEntryData.labourHours = firstEntry.labourHours;
      if (firstEntry.smallTools) cleanEntryData.smallTools = firstEntry.smallTools;
      if (firstEntry.notes) cleanEntryData.notes = firstEntry.notes;
    }

    // Add optional fields only if they exist
    if (entry?.submittedAt) cleanEntryData.submittedAt = entry.submittedAt;

    // Final cleanup - remove any remaining undefined/null values but keep Date objects
    const finalData = JSON.parse(JSON.stringify(cleanEntryData));
    // Ensure date remains a Date object
    finalData.date = editableDate;
    finalData.clockIn = clockInDate;
    finalData.clockOut = clockOutDate;
    finalData.submittedAt = new Date();

    if (truckNumber) finalData.truckNumber = truckNumber;

    try {
      assignTruckToEmployee();
      await onSubmit(finalData);
    } catch (error) {
      showAlert((error as Error).message);
    }
  };

  // Lock logic: only field users are affected by lock status
  // Admins/supervisors can always edit
  const isLocked = (user.role === 'field') ? (entry?.isLocked || false) : false;
  
  // Show buttons if: can edit and not locked, OR if creating new entry
  const showButtons = (canEdit && !isLocked) || (!entry && selectedEntryId === null);

  return (
    <div className={`bg-yellow-200 dark:bg-black relative ${isInline ? 'w-full' : 'border border-yellow-600 rounded-lg p-2'}`}>
      {/* X Button in Top Right Corner - hidden when showCancelButton is true */}
      {!showCancelButton && (
        <button
          type="button"
          onClick={onCancel}
          className="absolute top-4 right-4 text-yellow-600 dark:text-yellow-400 hover:text-yellow-500 dark:hover:text-yellow-200 text-2xl font-bold leading-none w-8 h-8 flex items-center justify-center rounded hover:bg-yellow-100 dark:hover:bg-yellow-900 dark:hover:bg-opacity-20 transition-colors"
        >
          ×
        </button>
      )}
      
      <div className={isInline ? 'p-6 w-full' : ''}>
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

      <form onSubmit={handleSubmit} className={`space-y-4 ${isInline ? 'w-full' : ''}`}>
        {/* Site Dropdown */}
        <div>
          <label className="block text-sm font-medium text-yellow-700 dark:text-yellow-600 mb-1">
            Site
          </label>
          <SiteSelectDropdown
            value={job}
            onChange={(val) => { setJob(val); if (val !== 'Other') setCustomSite(''); }}
            sites={jobOptions}
            disabled={false}
            isLocked={isLocked}
            placeholder="Select Site"
            includeOther
          />
          
          {/* Custom Site Input - Shows when "Other" is selected */}
          {job === 'Other' && (
            <div className="mt-2">
              <label className="block text-sm font-medium text-yellow-700 dark:text-yellow-600 mb-1">
                Specify Site
              </label>
              <input
                type="text"
                value={customSite}
                onChange={(e) => setCustomSite(e.target.value)}
                disabled={isLocked}
                placeholder="Enter site name"
                className={`w-full px-3 py-2 bg-yellow-200 dark:bg-black border rounded-lg text-gray-900 dark:text-yellow-100 focus:outline-none disabled:cursor-not-allowed transition-colors ${
                  isLocked 
                    ? 'border-red-600 bg-red-100 dark:bg-red-900 dark:bg-opacity-20 text-red-600 dark:text-red-300' 
                    : 'border-yellow-400 dark:border-yellow-800 focus:border-yellow-500 dark:focus:border-yellow-400 disabled:opacity-50'
                }`}
                required
              />
            </div>
          )}
        </div>

        {/* Clock In and Clock Out - Horizontal layout */}
        <div className="flex gap-2 sm:gap-2 overflow-x-auto items-start justify-around sm:justify-start">
            {/* Time Inputs Section - Mobile: Stacked Column 1 */}
            <div className="flex flex-col gap-0.5 sm:flex-row flex-1 sm:flex-initial">
                {/* Clock In */}
                <div className="flex flex-col flex-shrink-0 min-w-0">
                  <label className="block text-xs font-medium text-yellow-700 dark:text-yellow-600 mb-0.5 whitespace-nowrap">
                    In
                  </label>
                  <select
                    value={clockIn}
                    onChange={(e) => setClockIn(e.target.value)}
                    disabled={isLocked}
                    className={`w-20 sm:w-auto px-1 sm:px-2 py-1.5 text-xs sm:text-sm bg-yellow-200 dark:bg-black border rounded-lg text-gray-900 dark:text-yellow-100 focus:outline-none disabled:cursor-not-allowed transition-colors ${
                      isLocked 
                        ? 'border-red-600 bg-red-100 dark:bg-red-900 dark:bg-opacity-20 text-red-600 dark:text-red-300' 
                        : 'border-yellow-400 dark:border-yellow-800 focus:border-yellow-500 dark:focus:border-yellow-400 disabled:opacity-50'
                    }`}
                    required
                  >
                    <option value="">Select time</option>
                    {generateTimeOptions().map(time => (
                      <option key={time.value} value={time.value}>
                        {time.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Clock Out */}
                <div className="flex flex-col flex-shrink-0 min-w-0">
                  <label className="block text-xs font-medium text-yellow-700 dark:text-yellow-600 mb-0.5 whitespace-nowrap">
                    Out
                  </label>
                  <select
                    value={clockOut}
                    onChange={(e) => setClockOut(e.target.value)}
                    disabled={isLocked}
                    className={`w-20 sm:w-auto px-1 sm:px-2 py-1.5 text-xs sm:text-sm bg-yellow-200 dark:bg-black border rounded-lg text-gray-900 dark:text-yellow-100 focus:outline-none disabled:cursor-not-allowed transition-colors ${
                      isLocked 
                        ? 'border-red-600 bg-red-100 dark:bg-red-900 dark:bg-opacity-20 text-red-600 dark:text-red-300' 
                        : 'border-yellow-400 dark:border-yellow-800 focus:border-yellow-500 dark:focus:border-yellow-400 disabled:opacity-50'
                    }`}
                    required
                  >
                    <option value="">Select time</option>
                    {generateTimeOptions().map(time => (
                      <option key={time.value} value={time.value}>
                        {time.label}
                      </option>
                    ))}
                  </select>
                </div>
            </div>

            {/* Worked Hours and Travel Hours Section - Mobile: Stacked Column 2 */}
            <div className="flex flex-col gap-0.5 sm:flex-row flex-1 sm:flex-initial">
                {/* Worked Hours */}
                <div className="flex flex-col flex-shrink-0 min-w-0">
                  <label className="block text-xs font-medium text-yellow-700 dark:text-yellow-600 mb-0.5 whitespace-nowrap">
                    Worked Hours
                  </label>
                  <input
                    type="text"
                    value={hours}
                    readOnly
                    className={`w-20 sm:w-auto px-1 sm:px-2 py-1.5 text-xs sm:text-sm rounded-lg text-gray-900 dark:text-yellow-100 [-moz-appearance:_textfield] [&::-webkit-inner-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:m-0 [&::-webkit-outer-spin-button]:appearance-none transition-colors ${
                      isLocked 
                        ? 'bg-red-100 dark:bg-red-900 dark:bg-opacity-20 border-red-600 text-red-600 dark:text-red-300' 
                        : 'bg-yellow-100 dark:bg-yellow-900 dark:bg-opacity-20 border rounded-lg'
                    } ${
                      !isLocked && !hoursMatch ? 'border-red-500' : 
                      !isLocked ? 'border-yellow-400 dark:border-yellow-800' : ''
                    }`}
                    maxLength={3}
                  />
                </div>

                {/* Travel Hours */}
                <div className="flex flex-col flex-shrink-0 min-w-0">
                  <label className="block text-xs font-medium text-yellow-700 dark:text-yellow-600 mb-0.5 whitespace-nowrap">
                    + Travel Hours
                  </label>
                  <input
                    type="text"
                    value={travelHours}
                    onChange={(e) => {
                      const value = e.target.value.replace(/[^0-9.]/g, '');
                      // Allow up to 5 characters (e.g., "99.99") and validate decimal places
                      if (value.length <= 5) {
                        // Check if decimal format is valid (max 2 decimal places)
                        const parts = value.split('.');
                        if (parts.length <= 2 && (parts[1] === undefined || parts[1].length <= 2)) {
                          setTravelHours(value);
                        }
                      }
                    }}
                    disabled={isLocked}
                    className={`w-20 sm:w-auto px-1 sm:px-2 py-1.5 text-xs sm:text-sm bg-yellow-200 dark:bg-black border rounded-lg text-gray-900 dark:text-yellow-100 [-moz-appearance:_textfield] [&::-webkit-inner-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:m-0 [&::-webkit-outer-spin-button]:appearance-none focus:outline-none transition-colors ${
                      isLocked 
                        ? 'border-red-600 bg-red-100 dark:bg-red-900 dark:bg-opacity-20 text-red-600 dark:text-red-300' 
                        : 'border-yellow-400 dark:border-yellow-800 focus:border-yellow-500 dark:focus:border-yellow-400 disabled:opacity-50'
                    }`}
                    placeholder="0"
                    maxLength={5}
                    inputMode="decimal"
                  />
                </div>
            </div>

            {/* Truck# Section - Mobile: Single Column 3 */}
            <div className="flex flex-col sm:flex-row flex-1 sm:flex-initial">
                {/* Truck# */}
                <div className="flex flex-col flex-shrink-0 min-w-0">
                  <label className="block text-xs font-medium text-yellow-700 dark:text-yellow-600 mb-0.5 whitespace-nowrap">
                    Truck #
                  </label>
                  <select
                    value={truckNumber}
                    onChange={(e) => setTruckNumber(e.target.value)}
                    disabled={isLocked}
                    className={`w-20 sm:w-auto px-1 sm:px-2 py-1.5 text-xs sm:text-sm bg-yellow-200 dark:bg-black border rounded-lg text-gray-900 dark:text-yellow-100 focus:outline-none disabled:cursor-not-allowed transition-colors ${
                      isLocked
                        ? 'border-red-600 bg-red-100 dark:bg-red-900 dark:bg-opacity-20 text-red-600 dark:text-red-300'
                        : 'border-yellow-400 dark:border-yellow-800 focus:border-yellow-500 dark:focus:border-yellow-400 disabled:opacity-50'
                    }`}
                  >
                    <option value="">—</option>
                    {fleetEquipment.map(truck => (
                      <option key={truck.id} value={truck.name}>{truck.name}</option>
                    ))}
                  </select>
                </div>
            </div>
        </div>

        {/* Work Entries */}
        <div id="work-entries-container" className="space-y-4">
          <h3 className="text-yellow-600 dark:text-yellow-400 font-medium">Work Entries</h3>
          {workEntries.map((entry, index) => (
            <div key={entry.id} id={`work-entry-${entry.id}`}>
              <WorkEntrySection 
              entry={entry} 
              entryIndex={index}
              updateEntryField={updateEntryField}
              addSmallTool={addSmallTool}
              removeSmallTool={removeSmallTool}
              removeEntry={removeEntry}
              toggleCollapse={toggleCollapse}
              isLocked={isLocked || false}
              hoursMatch={hoursMatch}
              codeOptionsWithDetails={codeOptionsWithDetails}
              equipmentOptions={equipmentOptions}
              smallToolsOptions={smallToolsOptions}
            />
            </div>
          ))}
        </div>

        {/* Add Entry Button */}
        <div className="flex justify-center">
          <button
            type="button"
            onClick={addNewEntry}
            disabled={isLocked}
            className="px-4 py-2 bg-yellow-600 text-black rounded-lg hover:bg-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            Add Entry
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex space-x-3">
          {showCancelButton && (
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 p-2 bg-gray-600 text-white rounded-lg hover:bg-gray-500 transition-colors"
            >
              Cancel
            </button>
          )}
          {showButtons && (
            <>
              <button
                type="submit"
                className="flex-1 p-2 bg-yellow-500 text-black rounded-lg hover:bg-yellow-400 transition-colors"
              >
                {entry ? 'Update Time Card' : 'Save Time Card'}
              </button>
              {(!entry || entry.status === 'draft') && (
                <button
                  type="button"
                  onClick={handleSubmitSubmit}
                  className="flex-1 p-2 bg-yellow-100 dark:bg-yellow-900 dark:bg-opacity-50 text-yellow-700 dark:text-yellow-300 rounded-lg hover:bg-yellow-200 dark:hover:bg-opacity-70 transition-colors"
                >
                  Submit
                </button>
              )}
              
              {/* Always show submit button for new entries */}
              {selectedEntryId === 'new' && (
                <button
                  type="button"
                  onClick={handleSubmitSubmit}
                  className="flex-1 p-2 bg-yellow-100 dark:bg-yellow-900 dark:bg-opacity-50 text-yellow-700 dark:text-yellow-300 rounded-lg hover:bg-yellow-200 dark:hover:bg-opacity-70 transition-colors"
                >
                  Submit
                </button>
              )}
            </>
          )}
        </div>

        {isLocked && (
          <div className="bg-red-100 dark:bg-red-900 dark:bg-opacity-20 border border-red-600 rounded-lg p-3 mb-4">
            <div className="flex items-center justify-center space-x-2">
              <span className="text-red-400 text-lg">🔒</span>
              <p className="text-sm text-red-400 font-medium text-center">
                This time card belongs to another user and cannot be edited
              </p>
              <span className="text-red-400 text-lg">🔒</span>
            </div>
            <p className="text-xs text-red-500 text-center mt-1">
              Status: {entry?.status?.toUpperCase()} - Contact the owner or supervisor for changes
            </p>
          </div>
        )}
      </form>
      
      {/* Alert Component */}
      {alert && (
        <Alert
          message={alert.message}
          type={alert.type}
          onClose={() => setAlert(null)}
        />)}
      </div>
    </div>
  );
}
