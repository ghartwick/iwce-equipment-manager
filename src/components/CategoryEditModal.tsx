import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Category } from '../types';

export const ALL_MAINTENANCE_ITEMS = [
  { key: 'greased', label: 'Greased' },
  { key: 'stepsHandRails', label: 'Steps/Hand Rails' },
  { key: 'tiresTracks', label: 'Tires/Tracks' },
  { key: 'bucket', label: 'Bucket' },
  { key: 'cuttingEdgeTeeth', label: 'Cutting Edge/Teeth' },
  { key: 'hoses', label: 'Hoses' },
  { key: 'batteryCableBeltHosesFilterGuards', label: 'Battery Cable, Belt, Hoses, Filter, Guards' },
  { key: 'backupAlarm', label: 'Backup Alarm' },
  { key: 'fireExtinguisher', label: 'Fire Extinguisher' },
  { key: 'gauges', label: 'Gauges' },
  { key: 'horn', label: 'Horn' },
  { key: 'spillKit', label: 'Spill Kit' },
  { key: 'glass', label: 'Glass (all sides)' },
  { key: 'mirror', label: 'Mirror' },
  { key: 'rollOverProtection', label: 'Roll Over Protection' },
  { key: 'seatBeltSeat', label: 'Seat Belt/Seat' },
  { key: 'allFluidsLevel', label: 'All Fluids Level' },
];

interface CategoryEditModalProps {
  category: Category;
  onSave: (categoryId: string, category: Omit<Category, 'id'>) => void;
  onDelete: (categoryId: string) => void;
  onClose: () => void;
}

export function CategoryEditModal({ category, onSave, onDelete, onClose }: CategoryEditModalProps) {
  const [name, setName] = useState(category.name);
  const [group, setGroup] = useState<'heavy' | 'field' | 'fleet' | ''>(category.managementGroup || '');
  const [notificationType, setNotificationType] = useState<'fleet' | 'heavy' | 'none'>(category.notificationType || 'none');
  const [allocationDefault, setAllocationDefault] = useState<'site' | 'employee' | ''>(category.allocationDefault || '');
  const [selectedItems, setSelectedItems] = useState<string[]>(category.maintenanceItems || []);
  const [customItemInput, setCustomItemInput] = useState('');

  const handleAddCustomItem = () => {
    const label = customItemInput.trim();
    if (!label) return;
    const key = `custom:${label}`;
    if (!selectedItems.includes(key)) setSelectedItems(prev => [...prev, key]);
    setCustomItemInput('');
  };

  const handleSave = () => {
    if (!name.trim()) return;
    onSave(category.id, {
      name: name.trim(),
      description: '',
      color: '#FFB700',
      ...(group ? { managementGroup: group } : {}),
      notificationType,
      maintenanceItems: selectedItems,
      ...(allocationDefault ? { allocationDefault } : {}),
    });
    onClose();
  };

  const handleDelete = () => {
    if (window.confirm(`Are you sure you want to delete the category "${category.name}"?`)) {
      onDelete(category.id);
      onClose();
    }
  };

  const allKeys = ALL_MAINTENANCE_ITEMS.map(i => i.key);
  const allSelected = allKeys.every(k => selectedItems.includes(k));

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-yellow-100 dark:bg-gray-900 border border-yellow-500 dark:border-yellow-700 rounded-lg shadow-2xl p-6 w-[32rem] max-w-[95vw] space-y-4 max-h-[90vh] overflow-y-auto">
        <h3 className="text-sm font-semibold text-yellow-700 dark:text-yellow-300">Edit Category</h3>
        <input
          type="text"
          placeholder="Category name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') onClose(); }}
          autoFocus
          className="w-full px-3 py-2 border border-yellow-600 rounded-md bg-yellow-200 dark:bg-black text-gray-900 dark:text-yellow-100 placeholder-yellow-500 dark:placeholder-yellow-600 focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 outline-none text-sm"
        />
        <select
          value={group}
          onChange={(e) => setGroup(e.target.value as 'heavy' | 'field' | 'fleet' | '')}
          className="w-full px-3 py-2 border border-yellow-600 rounded-md bg-yellow-200 dark:bg-black text-gray-900 dark:text-yellow-100 focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 outline-none text-sm"
        >
          <option value="">— No Management Group —</option>
          <option value="heavy">Heavy Equipment</option>
          <option value="field">Field Tools</option>
          <option value="fleet">Fleet</option>
        </select>
        <div>
          <p className="text-xs font-medium text-yellow-700 dark:text-yellow-300 mb-1.5">Maintenance Notification Type</p>
          <div className="flex flex-col space-y-1 mb-3">
            {(['none', 'fleet', 'heavy'] as const).map((type) => (
              <label key={type} className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="radio"
                  name="edit-notif-type"
                  value={type}
                  checked={notificationType === type}
                  onChange={() => setNotificationType(type)}
                  className="text-yellow-600 focus:ring-yellow-500"
                />
                <span className="text-xs text-gray-900 dark:text-yellow-100">
                  {type === 'none' ? 'None' : type === 'fleet' ? 'Fleet Maintenance' : 'Heavy Equipment'}
                </span>
              </label>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs font-medium text-yellow-700 dark:text-yellow-300 mb-1.5">Allocation</p>
          <select
            value={allocationDefault}
            onChange={(e) => setAllocationDefault(e.target.value as 'site' | 'employee' | '')}
            className="w-full px-3 py-2 border border-yellow-600 rounded-md bg-yellow-200 dark:bg-black text-gray-900 dark:text-yellow-100 focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 outline-none text-sm"
          >
            <option value="">— No Default —</option>
            <option value="site">Allocated to Site</option>
            <option value="employee">Allocated to Employee</option>
          </select>
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-yellow-700 dark:text-yellow-300">Maintenance Items</p>
            <button
              type="button"
              onClick={() => {
                if (allSelected) {
                  setSelectedItems(prev => prev.filter(k => k.startsWith('custom:')));
                } else {
                  setSelectedItems(prev => [...new Set([...prev, ...allKeys])]);
                }
              }}
              className="px-2 py-1 text-xs bg-yellow-200 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300 border border-yellow-500 rounded hover:bg-yellow-300 dark:hover:bg-yellow-800 font-medium"
            >
              {allSelected ? 'Deselect All' : 'Select All'}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2 pr-1 pb-3">
            {ALL_MAINTENANCE_ITEMS.map(({ key, label }) => (
              <label key={key} className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedItems.includes(key)}
                  onChange={(e) => {
                    if (e.target.checked) setSelectedItems(prev => [...prev, key]);
                    else setSelectedItems(prev => prev.filter(k => k !== key));
                  }}
                  className="rounded border-yellow-600 text-yellow-600 focus:ring-yellow-500"
                />
                <span className="text-xs text-gray-900 dark:text-yellow-100">{label}</span>
              </label>
            ))}
            {selectedItems.filter(k => k.startsWith('custom:')).map(k => (
              <label key={k} className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked
                  onChange={() => setSelectedItems(prev => prev.filter(i => i !== k))}
                  className="rounded border-yellow-600 text-yellow-600 focus:ring-yellow-500"
                />
                <span className="text-xs text-gray-900 dark:text-yellow-100">{k.slice(7)}</span>
              </label>
            ))}
          </div>
          <div className="flex space-x-2 pt-1">
            <input
              type="text"
              value={customItemInput}
              onChange={(e) => setCustomItemInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAddCustomItem(); }}
              placeholder="New item name..."
              className="flex-1 px-2 py-1 border border-yellow-600 rounded text-xs bg-yellow-200 dark:bg-black text-gray-900 dark:text-yellow-100 placeholder-yellow-500 dark:placeholder-yellow-600 focus:outline-none focus:ring-1 focus:ring-yellow-500"
            />
            <button
              type="button"
              onClick={handleAddCustomItem}
              disabled={!customItemInput.trim()}
              className="px-2 py-1 bg-yellow-500 text-black text-xs rounded hover:bg-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              Add Item
            </button>
          </div>
        </div>
        <div className="flex justify-between space-x-2">
          <button
            onClick={handleDelete}
            className="flex items-center space-x-1 px-3 py-1.5 btn-delete text-sm rounded font-medium"
          >
            <Trash2 className="h-3 w-3" />
            <span>Delete</span>
          </button>
          <div className="flex space-x-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm rounded hover:bg-gray-300 dark:hover:bg-gray-600"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-3 py-1.5 bg-yellow-500 text-black text-sm rounded hover:bg-yellow-600 font-medium"
            >
              Update
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
