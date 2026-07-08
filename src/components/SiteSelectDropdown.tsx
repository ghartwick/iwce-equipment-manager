import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

export interface SiteOption {
  id: string;
  name: string;
  description?: string;
}

interface SiteSelectDropdownProps {
  value: string;
  onChange: (value: string) => void;
  sites: SiteOption[];
  disabled?: boolean;
  placeholder?: string;
  includeOther?: boolean;
  isLocked?: boolean;
}

export function SiteSelectDropdown({
  value,
  onChange,
  sites,
  disabled = false,
  placeholder = 'Select Site',
  includeOther = false,
  isLocked = false,
}: SiteSelectDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const selectedSite = sites.find(s => s.name === value);
  const displayValue = value === 'Other' ? 'Other (specify)' : (selectedSite?.name ?? '');
  const isDisabled = disabled || isLocked;

  const triggerClass = isLocked
    ? 'w-full px-3 py-2 border rounded-lg text-left flex justify-between items-center transition-colors border-red-600 bg-red-100 dark:bg-red-900 dark:bg-opacity-20 text-red-600 dark:text-red-300 cursor-not-allowed'
    : isDisabled
    ? 'w-full px-3 py-2 border rounded-lg text-left flex justify-between items-center transition-colors border-yellow-400 dark:border-yellow-800 bg-yellow-200 dark:bg-black text-gray-900 dark:text-yellow-100 opacity-50 cursor-not-allowed'
    : 'w-full px-3 py-2 border rounded-lg text-left flex justify-between items-center transition-colors border-yellow-400 dark:border-yellow-800 bg-yellow-200 dark:bg-black text-gray-900 dark:text-yellow-100 hover:border-yellow-500 dark:hover:border-yellow-400 focus:outline-none focus:border-yellow-500 dark:focus:border-yellow-400 cursor-pointer';

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={isDisabled}
        onClick={() => !isDisabled && setOpen(prev => !prev)}
        className={triggerClass}
      >
        <span className={!displayValue ? 'text-gray-400 dark:text-yellow-700' : ''}>
          {displayValue || placeholder}
        </span>
        <ChevronDown className={`h-4 w-4 flex-shrink-0 ml-2 transition-transform ${open ? 'rotate-180' : ''} ${isLocked ? 'text-red-400' : 'text-yellow-600 dark:text-yellow-400'}`} />
      </button>

      {open && !isDisabled && (
        <div className="absolute z-50 w-full mt-1 bg-yellow-100 dark:bg-zinc-900 border border-yellow-400 dark:border-yellow-800 rounded-lg shadow-lg max-h-64 overflow-y-auto">
          <div
            onClick={() => { onChange(''); setOpen(false); }}
            className={`px-3 py-2 cursor-pointer hover:bg-yellow-200 dark:hover:bg-yellow-900 dark:hover:bg-opacity-40 text-sm text-gray-400 dark:text-yellow-700 ${!value ? 'bg-yellow-200 dark:bg-yellow-900 dark:bg-opacity-20' : ''}`}
          >
            {placeholder}
          </div>
          {sites.map(site => (
            <div
              key={site.id}
              onClick={() => { onChange(site.name); setOpen(false); }}
              className={`px-3 py-2 cursor-pointer hover:bg-yellow-200 dark:hover:bg-yellow-900 dark:hover:bg-opacity-40 ${value === site.name ? 'bg-yellow-200 dark:bg-yellow-900 dark:bg-opacity-20' : ''}`}
            >
              <div className="text-sm text-gray-900 dark:text-yellow-100">{site.name}</div>
              {site.description && (
                <div className="text-gray-400 dark:text-gray-500 italic mt-0.5 leading-snug" style={{ fontSize: '0.75em' }}>
                  &bull; {site.description}
                </div>
              )}
            </div>
          ))}
          {includeOther && (
            <div
              onClick={() => { onChange('Other'); setOpen(false); }}
              className={`px-3 py-2 cursor-pointer hover:bg-yellow-200 dark:hover:bg-yellow-900 dark:hover:bg-opacity-40 text-sm text-gray-900 dark:text-yellow-100 ${value === 'Other' ? 'bg-yellow-200 dark:bg-yellow-900 dark:bg-opacity-20' : ''}`}
            >
              Other (specify)
            </div>
          )}
        </div>
      )}
    </div>
  );
}
