import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface AlertProps {
  message: string;
  onClose: () => void;
  type?: 'error' | 'warning' | 'info';
}

export function Alert({ message, onClose, type = 'error' }: AlertProps) {
  const alertRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (alertRef.current && !alertRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  const getAlertStyles = () => {
    switch (type) {
      case 'error':
        return 'bg-red-100 dark:bg-red-900 dark:bg-opacity-30 border-red-600 text-red-700 dark:text-red-300';
      case 'warning':
        return 'bg-yellow-100 dark:bg-yellow-900 dark:bg-opacity-30 border-yellow-600 text-yellow-700 dark:text-yellow-300';
      case 'info':
        return 'bg-blue-100 dark:bg-blue-900 dark:bg-opacity-30 border-blue-600 text-blue-700 dark:text-blue-300';
      default:
        return 'bg-red-100 dark:bg-red-900 dark:bg-opacity-30 border-red-600 text-red-700 dark:text-red-300';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div ref={alertRef} className={`max-w-md w-full mx-4 p-4 rounded-lg shadow-lg border ${getAlertStyles()}`}>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium">{message}</p>
          </div>
          <button
            onClick={onClose}
            className="ml-3 inline-flex text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
