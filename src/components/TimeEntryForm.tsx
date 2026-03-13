import { useState, useEffect, useCallback, useMemo } from 'react';
import { format } from 'date-fns';
import { TimeEntry, User } from '../services/timecardService';
import { siteManagementService } from '../services/siteManagementService';
import { codeManagementService } from '../services/codeManagementService';
import { smallToolsManagementService } from '../services/smallToolsManagementService';
import { equipmentManagementService } from '../services/equipmentManagementService';

interface TimeEntryFormProps {
  selectedDate: Date;
  entry?: TimeEntry;
  user: User;
  onSubmit: (entry: Omit<TimeEntry, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onCancel: () => void;
  canEdit: boolean;
  selectedEntryId?: string | null;
}

// Define the structure for a single work entry
interface WorkEntry {
  id: string;
  notes: string;
  code: string;
  equipment: string;
  machineHours: string;
  labourHours: string;
  productionQuantity: string;
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
  totalMachineHours,
  totalLabourHours,
  codeOptions,
  equipmentOptions,
  smallToolsOptions,
  user
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
  totalMachineHours: number;
  totalLabourHours: number;
  codeOptions: string[];
  equipmentOptions: string[];
  smallToolsOptions: string[];
  user: User;
}) => {
  // Create stable onChange handlers to prevent re-render issues
  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    updateEntryField(entry.id, 'notes', e.target.value);
  };
  
  const handleCodeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    updateEntryField(entry.id, 'code', e.target.value);
  };
  
  const handleEquipmentChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    updateEntryField(entry.id, 'equipment', e.target.value);
  };
  
  const handleMachineHoursChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9.]/g, '');
    // Allow up to 5 characters (e.g., "99.99") and validate decimal places
    if (value.length <= 5) {
      // Check if decimal format is valid (max 2 decimal places)
      const parts = value.split('.');
      if (parts.length <= 2 && (parts[1] === undefined || parts[1].length <= 2)) {
        updateEntryField(entry.id, 'machineHours', value);
      }
    }
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
  
  const handleProductionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9.]/g, '');
    if (value.length <= 3) {
      updateEntryField(entry.id, 'productionQuantity', value);
    }
  };

  return (
    <div className="border border-yellow-800 rounded-lg p-4 space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-yellow-400 font-medium">Entry {entryIndex + 1}</h3>
        <div className="flex items-center gap-2">
          {entryIndex > 0 && (
            <button
              type="button"
              onClick={() => removeEntry(entry.id)}
              disabled={isLocked}
              className="text-red-400 hover:text-red-300 disabled:opacity-50"
            >
              Remove
            </button>
          )}
          <button
            type="button"
            onClick={() => toggleCollapse(entry.id)}
            disabled={isLocked}
            className="text-yellow-400 hover:text-yellow-200 disabled:opacity-50 text-sm"
          >
            {entry.collapsed ? '▶ Expand' : '▼ Collapse'}
          </button>
        </div>
      </div>

      {/* Show content only if not collapsed */}
      {!entry.collapsed && (
        <>
      {/* Code Dropdown */}
      <div>
        <select
          value={entry.code}
          onChange={handleCodeChange}
          disabled={isLocked || user.role === 'field'}
          className="w-full px-3 py-2 bg-black border border-yellow-800 rounded-lg text-yellow-100 focus:outline-none focus:border-yellow-400 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <option value="">Select Code</option>
          {codeOptions.map(codeOption => (
            <option key={codeOption} value={codeOption}>
              {codeOption}
            </option>
          ))}
        </select>
      </div>

        {/* Task Description */}
        <div>
          <textarea
            value={entry.notes}
            onChange={handleNotesChange}
            disabled={isLocked}
            rows={3}
            className="w-full px-3 py-2 bg-black border border-yellow-800 rounded-lg text-yellow-100 focus:outline-none focus:border-yellow-400 disabled:opacity-50 resize-none"
            placeholder="Add any notes about this time entry..."
          />
        </div>

      {/* Equipment Dropdown */}
      <div>
        <select
          value={entry.equipment}
          onChange={handleEquipmentChange}
          disabled={isLocked}
          className="w-full px-3 py-2 bg-black border border-yellow-800 rounded-lg text-yellow-100 focus:outline-none focus:border-yellow-400 disabled:opacity-50"
        >
          <option value="">Select Equipment</option>
          {equipmentOptions.map(equipmentOption => (
            <option key={equipmentOption} value={equipmentOption}>
              {equipmentOption}
            </option>
          ))}
        </select>
      </div>

      {/* Small Tools Dropdown */}
      <div>
        {/* Selected Tools Display */}
        {entry.smallTools.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {entry.smallTools.map((tool, index) => (
              <div
                key={index}
                className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-900 bg-opacity-30 border border-yellow-700 rounded text-yellow-100 text-sm"
              >
                {tool}
                <button
                  type="button"
                  onClick={() => removeSmallTool(entry.id, tool)}
                  disabled={isLocked}
                  className="text-yellow-400 hover:text-yellow-200 disabled:opacity-50"
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
          className="w-full px-3 py-2 bg-black border border-yellow-800 rounded-lg text-yellow-100 focus:outline-none focus:border-yellow-400 disabled:opacity-50"
        >
          <option value="">Select Small Tools</option>
          {smallToolsOptions.filter(option => !entry.smallTools.includes(option)).map(smallToolsOption => (
            <option key={smallToolsOption} value={smallToolsOption}>
              {smallToolsOption}
            </option>
          ))}
        </select>
      </div>

      {/* Machine, Labour & Production Hours */}
      <div className="flex gap-4">
        {/* Machine Hours */}
        <div className="flex-1">
          <label className="block text-xs font-medium text-yellow-600 mb-1">
            Machine Hrs
          </label>
          <input
            type="text"
            value={entry.machineHours}
            onChange={handleMachineHoursChange}
            disabled={isLocked}
            className={`w-full px-2 py-1.5 text-sm bg-black border rounded-lg text-yellow-100 focus:outline-none disabled:opacity-50 [-moz-appearance:_textfield] [&::-webkit-inner-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:m-0 [&::-webkit-outer-spin-button]:appearance-none ${
              !hoursMatch ? 'border-red-500' : 'border-yellow-800'
            }`}
            maxLength={5}
            inputMode="decimal"
            placeholder="0"
          />
        </div>

        {/* Labour Hours */}
        <div className="flex-1">
          <label className="block text-xs font-medium text-yellow-600 mb-1">
            Labour Hrs
          </label>
          <input
            type="text"
            value={entry.labourHours}
            onChange={handleLabourHoursChange}
            disabled={isLocked}
            className={`w-full px-2 py-1.5 text-sm bg-black border rounded-lg text-yellow-100 focus:outline-none disabled:opacity-50 [-moz-appearance:_textfield] [&::-webkit-inner-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:m-0 [&::-webkit-outer-spin-button]:appearance-none ${
              !hoursMatch ? 'border-red-500' : 'border-yellow-800'
            }`}
            maxLength={5}
            inputMode="decimal"
            placeholder="0"
          />
        </div>

        {/* Production Quantity */}
        <div className="flex-1">
          <label className="block text-xs font-medium text-yellow-600 mb-1">
            Quantity
          </label>
          <input
            type="text"
            value={entry.productionQuantity}
            onChange={handleProductionChange}
            disabled={isLocked}
            className="w-full px-2 py-1.5 text-sm bg-black border border-yellow-800 rounded-lg text-yellow-100 focus:outline-none focus:border-yellow-400 disabled:opacity-50 [-moz-appearance:_textfield] [&::-webkit-inner-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:m-0 [&::-webkit-outer-spin-button]:appearance-none"
            maxLength={3}
            inputMode="numeric"
            placeholder="0"
          />
        </div>
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
  selectedEntryId
}: TimeEntryFormProps) => {
  const [clockIn, setClockIn] = useState('');
  const [clockOut, setClockOut] = useState('');
  const [job, setJob] = useState('');
  const [hours, setHours] = useState(0);
  const [jobOptions, setJobOptions] = useState<string[]>([]);
  const [codeOptionsState, setCodeOptionsState] = useState<string[]>([]);
  const [smallToolsOptionsState, setSmallToolsOptionsState] = useState<string[]>([]);
  const [equipmentOptionsState, setEquipmentOptionsState] = useState<string[]>([]);
  const [workEntries, setWorkEntries] = useState<WorkEntry[]>([
    {
      id: '1',
      notes: '',
      code: '',
      equipment: '',
      machineHours: '',
      labourHours: '',
      productionQuantity: '',
      smallTools: [],
      collapsed: false
    }
  ]);

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
                 entryToRemove.equipment || 
                 entryToRemove.machineHours || 
                 entryToRemove.labourHours || 
                 entryToRemove.productionQuantity ||
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
        equipment: '',
        machineHours: '',
        labourHours: '',
        productionQuantity: '',
        smallTools: [],
        collapsed: false
      };
      
      // Collapse the first entry when adding a new one
      const updatedEntries = [...prev];
      if (updatedEntries.length > 0) {
        updatedEntries[0] = { ...updatedEntries[0], collapsed: true };
      }
      
      return [...updatedEntries, newEntry];
    });
  };

  const generateTimeOptions = () => {
    const options = [];
    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += 15) {
        const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
        const period = hour < 12 ? 'AM' : 'PM';
        const displayString = `${displayHour}:${minute.toString().padStart(2, '0')} ${period}`;
        options.push({ value: timeString, label: displayString });
      }
    }
    return options;
  };

  // Load sites, codes, and small tools from database
  useEffect(() => {
    const loadOptions = async () => {
      try {
        const sites = await siteManagementService.getActiveSites();
        setJobOptions(sites.map(site => site.name));
        
        const codes = await codeManagementService.getActiveCodes();
        setCodeOptionsState(codes.map(code => code.name));
        
        const smallTools = await smallToolsManagementService.getActiveSmallTools();
        setSmallToolsOptionsState(smallTools.map(tool => tool.name));
        
        const equipment = await equipmentManagementService.getActiveEquipment();
        setEquipmentOptionsState(equipment.map(item => item.name));
      } catch (error) {
        console.error('Failed to load dropdown options:', error);
      }
    };
    loadOptions();
  }, []);

  // Use state-based code options
  const codeOptions = useMemo(() => codeOptionsState, [codeOptionsState]);

  // Use state-based small tools options
  const smallToolsOptions = useMemo(() => smallToolsOptionsState, [smallToolsOptionsState]);

  // Use state-based equipment options
  const equipmentOptions = useMemo(() => equipmentOptionsState, [equipmentOptionsState]);

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
      
      // Load work entries from existing entry or create default
      if (entry.workEntries && entry.workEntries.length > 0) {
        // Load from new workEntries structure
        setWorkEntries(entry.workEntries.map(workEntry => ({
          id: workEntry.id,
          notes: workEntry.notes || '',
          code: workEntry.code || '',
          equipment: workEntry.equipment || '',
          machineHours: workEntry.machineHours?.toString() || '',
          labourHours: workEntry.labourHours?.toString() || '',
          productionQuantity: workEntry.productionQuantity?.toString() || '',
          smallTools: workEntry.smallTools || [],
          collapsed: true  // Always load collapsed for existing entries
        })));
      } else if (entry.notes || entry.code || entry.equipment || entry.machineHours || entry.labourHours || entry.productionQuantity || entry.smallTools) {
        // Load from legacy single entry structure
        setWorkEntries([{
          id: '1',
          notes: entry.notes || '',
          code: entry.code || '',
          equipment: entry.equipment || '',
          machineHours: entry.machineHours?.toString() || '',
          labourHours: entry.labourHours?.toString() || '',
          productionQuantity: entry.productionQuantity?.toString() || '',
          smallTools: entry.smallTools ? (Array.isArray(entry.smallTools) ? entry.smallTools : [entry.smallTools]) : [],
          collapsed: true
        }]);
      } else {
        // Create default empty entry (collapsed for existing entries)
        setWorkEntries([{
          id: '1',
          notes: '',
          code: '',
          equipment: '',
          machineHours: '',
          labourHours: '',
          productionQuantity: '',
          smallTools: [],
          collapsed: true
        }]);
      }
    } else if (selectedDate) {
      // Reset form for new entry
      setClockIn('');
      setClockOut('');
      setJob('');
      setHours(0);
      setWorkEntries([{
        id: '1',
        notes: '',
        code: '',
        equipment: '',
        machineHours: '',
        labourHours: '',
        productionQuantity: '',
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!clockIn || !clockOut) {
      alert('Please select both clock in and clock out times');
      return;
    }

    const [inHours, inMinutes] = clockIn.split(':').map(Number);
    const [outHours, outMinutes] = clockOut.split(':').map(Number);
    
    const inTime = new Date();
    inTime.setHours(inHours, inMinutes, 0, 0);
    
    const outTime = new Date();
    outTime.setHours(outHours, outMinutes, 0, 0);
    
    const clockInDate = new Date(selectedDate);
    clockInDate.setHours(inHours, inMinutes, 0, 0);
    
    const clockOutDate = new Date(selectedDate);
    clockOutDate.setHours(outHours, outMinutes, 0, 0);

    // Convert work entries to the format expected by the database
    const workEntriesData = workEntries
      .map(entry => ({
        id: entry.id,
        notes: entry.notes || null,
        code: entry.code || null,
        equipment: entry.equipment || null,
        machineHours: entry.machineHours ? parseFloat(entry.machineHours) : null,
        labourHours: entry.labourHours ? parseFloat(entry.labourHours) : null,
        productionQuantity: entry.productionQuantity ? parseFloat(entry.productionQuantity) : null,
        smallTools: entry.smallTools.length > 0 ? entry.smallTools : null,
        collapsed: entry.collapsed || false
      }))
      .filter(entry => 
        entry.notes || 
        entry.code || 
        entry.equipment || 
        entry.machineHours !== null || 
        entry.labourHours !== null || 
        entry.productionQuantity !== null ||
        (entry.smallTools && entry.smallTools.length > 0)
      );

    // Create clean entry data without any undefined/null values
    const cleanEntryData: any = {
      userId: user.id,
      date: selectedDate,
      clockIn: clockInDate,
      clockOut: clockOutDate,
      hours,
      job: job || null,
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
      if (firstEntry.productionQuantity !== null) cleanEntryData.productionQuantity = firstEntry.productionQuantity;
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
      if (firstEntry.productionQuantity) cleanEntryData.productionQuantity = parseFloat(firstEntry.productionQuantity);
      if (firstEntry.machineHours) cleanEntryData.machineHours = parseFloat(firstEntry.machineHours);
      if (firstEntry.labourHours) cleanEntryData.labourHours = parseFloat(firstEntry.labourHours);
      if (firstEntry.smallTools.length > 0) cleanEntryData.smallTools = firstEntry.smallTools;
      if (firstEntry.notes) cleanEntryData.notes = firstEntry.notes;
    }

    // Add optional fields only if they exist
    if (entry?.submittedAt) cleanEntryData.submittedAt = entry.submittedAt;

    // Final cleanup - remove any remaining undefined/null values but keep Date objects
    const finalData = JSON.parse(JSON.stringify(cleanEntryData));
    // Ensure date remains a Date object
    finalData.date = selectedDate;
    finalData.clockIn = clockInDate;
    finalData.clockOut = clockOutDate;
    if (entry?.submittedAt) finalData.submittedAt = entry.submittedAt;

    onSubmit(finalData);
  };

  const handleSubmitSubmit = () => {
    if (!clockIn || !clockOut) {
      alert('Please select both clock in and clock out times before submitting');
      return;
    }

    // Validate that at least one entry has meaningful data
    const hasValidEntry = workEntries.some(entry => 
      entry.notes.trim() || 
      entry.code || 
      entry.equipment || 
      entry.machineHours || 
      entry.labourHours || 
      entry.productionQuantity ||
      entry.smallTools.length > 0
    );

    if (!hasValidEntry) {
      alert('Please add at least one work entry with data before submitting');
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
      
    const clockInDate = new Date(selectedDate);
    clockInDate.setHours(inHours, inMinutes, 0, 0);
      
    const clockOutDate = new Date(selectedDate);
    clockOutDate.setHours(outHours, outMinutes, 0, 0);

    const workEntriesData = workEntries
      .map(entry => ({
        id: entry.id,
        notes: entry.notes || null,
        code: entry.code || null,
        equipment: entry.equipment || null,
        machineHours: entry.machineHours ? parseFloat(entry.machineHours) : null,
        labourHours: entry.labourHours ? parseFloat(entry.labourHours) : null,
        productionQuantity: entry.productionQuantity ? parseFloat(entry.productionQuantity) : null,
        smallTools: entry.smallTools.length > 0 ? entry.smallTools : null,
        collapsed: entry.collapsed || false
      }))
      .filter(entry => 
        entry.notes || 
        entry.code || 
        entry.equipment || 
        entry.machineHours !== null || 
        entry.labourHours !== null || 
        entry.productionQuantity !== null ||
        (entry.smallTools && entry.smallTools.length > 0)
      );

    // Create clean entry data without any undefined/null values
    const cleanEntryData: any = {
      userId: user.id,
      date: selectedDate,
      clockIn: clockInDate,
      clockOut: clockOutDate,
      hours,
      job: job || null,
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
      if (firstEntry.productionQuantity !== null) cleanEntryData.productionQuantity = firstEntry.productionQuantity;
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
    finalData.date = selectedDate;
    finalData.clockIn = clockInDate;
    finalData.clockOut = clockOutDate;
    finalData.submittedAt = new Date();

    onSubmit(finalData);
  };

  // Simplified lock logic: users can always edit their own entries
  const isLocked = entry?.isLocked && entry?.userId !== user?.id;
  
  // Show buttons if: can edit and not locked, OR if creating new entry
  const showButtons = (canEdit && !isLocked) || (!entry && selectedEntryId === null);

  return (
    <div className="bg-black border border-yellow-600 rounded-lg p-6 relative">
      {/* X Button in Top Right Corner */}
      <button
        type="button"
        onClick={onCancel}
        className="absolute top-4 right-4 text-yellow-400 hover:text-yellow-200 text-2xl font-bold leading-none w-8 h-8 flex items-center justify-center rounded hover:bg-yellow-900 hover:bg-opacity-20 transition-colors"
      >
        ×
      </button>
      
      <h3 className="text-lg font-semibold text-yellow-300 mb-1 pr-8">
        {entry ? `Time Card ${entry.entryNumber || 'New'}` : 'New Time Card'} - {selectedDate ? format(selectedDate, 'EEEE, MMMM d, yyyy') : 'Select a Date'}
      </h3>
      
      <div className="text-yellow-600 text-sm mb-4">
        {user.name || user.username}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Site Dropdown */}
        <div>
          <label className="block text-sm font-medium text-yellow-600 mb-1">
            Site
          </label>
          <select
            value={job}
            onChange={(e) => setJob(e.target.value)}
            disabled={isLocked}
            className={`w-full px-3 py-2 bg-black border rounded-lg text-yellow-100 focus:outline-none disabled:cursor-not-allowed transition-colors ${
              isLocked 
                ? 'border-red-600 bg-red-900 bg-opacity-20 text-red-300' 
                : 'border-yellow-800 focus:border-yellow-400 disabled:opacity-50'
            }`}
          >
            <option value="">Select Site</option>
            {jobOptions.map(jobOption => (
              <option key={jobOption} value={jobOption}>
                {jobOption}
              </option>
            ))}
          </select>
        </div>

        {/* Clock In and Clock Out - Side by Side */}
        <div className="flex gap-2 overflow-x-auto">
            {/* Clock In */}
            <div className="flex flex-col flex-shrink-0">
              <label className="block text-xs font-medium text-yellow-600 mb-1">
                Clock In
              </label>
              <select
                value={clockIn}
                onChange={(e) => setClockIn(e.target.value)}
                disabled={isLocked}
                className={`w-auto min-w-[90px] px-2 py-1.5 text-sm bg-black border rounded-lg text-yellow-100 focus:outline-none disabled:cursor-not-allowed transition-colors ${
                  isLocked 
                    ? 'border-red-600 bg-red-900 bg-opacity-20 text-red-300' 
                    : 'border-yellow-800 focus:border-yellow-400 disabled:opacity-50'
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
            <div className="flex flex-col flex-shrink-0">
              <label className="block text-xs font-medium text-yellow-600 mb-1">
                Clock Out
              </label>
              <select
                value={clockOut}
                onChange={(e) => setClockOut(e.target.value)}
                disabled={isLocked}
                className={`w-auto min-w-[90px] px-2 py-1.5 text-sm bg-black border rounded-lg text-yellow-100 focus:outline-none disabled:cursor-not-allowed transition-colors ${
                  isLocked 
                    ? 'border-red-600 bg-red-900 bg-opacity-20 text-red-300' 
                    : 'border-yellow-800 focus:border-yellow-400 disabled:opacity-50'
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

            {/* Total Hours - Evenly spaced */}
            <div className="flex flex-col flex-shrink-0">
              <label className="block text-xs font-medium text-yellow-600 mb-1">
                Total Hours
              </label>
              <input
                type="text"
                value={hours}
                readOnly
                className={`w-auto min-w-[90px] px-2 py-1.5 text-sm rounded-lg text-yellow-100 [-moz-appearance:_textfield] [&::-webkit-inner-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:m-0 [&::-webkit-outer-spin-button]:appearance-none transition-colors ${
                  isLocked 
                    ? 'bg-red-900 bg-opacity-20 border-red-600 text-red-300' 
                    : 'bg-yellow-900 bg-opacity-20 border rounded-lg'
                } ${
                  !isLocked && !hoursMatch ? 'border-red-500' : 
                  !isLocked ? 'border-yellow-800' : ''
                }`}
                maxLength={3}
              />
            </div>
        </div>

        {/* Work Entries */}
        <div className="space-y-4">
          <h3 className="text-yellow-400 font-medium">Work Entries</h3>
          {workEntries.map((entry, index) => (
            <WorkEntrySection 
              key={entry.id} 
              entry={entry} 
              entryIndex={index}
              updateEntryField={updateEntryField}
              addSmallTool={addSmallTool}
              removeSmallTool={removeSmallTool}
              removeEntry={removeEntry}
              toggleCollapse={toggleCollapse}
              isLocked={isLocked || false}
              hoursMatch={hoursMatch}
              totalMachineHours={totalMachineHours}
              totalLabourHours={totalLabourHours}
              codeOptions={codeOptions}
              equipmentOptions={equipmentOptions}
              smallToolsOptions={smallToolsOptions}
              user={user}
            />
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
                  className="flex-1 p-2 bg-yellow-900 bg-opacity-50 text-yellow-300 rounded-lg hover:bg-opacity-70 transition-colors"
                >
                  Submit
                </button>
              )}
              
              {/* Always show submit button for new entries */}
              {selectedEntryId === 'new' && (
                <button
                  type="button"
                  onClick={handleSubmitSubmit}
                  className="flex-1 p-2 bg-yellow-900 bg-opacity-50 text-yellow-300 rounded-lg hover:bg-opacity-70 transition-colors"
                >
                  Submit
                </button>
              )}
            </>
          )}
        </div>

        {isLocked && (
          <div className="bg-red-900 bg-opacity-20 border border-red-600 rounded-lg p-3 mb-4">
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
    </div>
  );
}
