import { Bell } from 'lucide-react';
import { useNotifications } from '../context/NotificationContext';

/**
 * Header bell for in-app notifications, badged with the unread count. Distinct
 * from the equipment alerts bell next to it.
 */
export function NotificationBell({ className = '' }: { className?: string }) {
  const { unreadCount, openPopup } = useNotifications();

  return (
    <button
      onClick={openPopup}
      className={`relative p-2 text-yellow-600 dark:text-yellow-400 hover:text-yellow-500 dark:hover:text-yellow-300 transition-colors ${className}`}
      title={unreadCount > 0 ? `${unreadCount} unread notifications` : 'Notifications'}
    >
      <Bell className="h-5 w-5" />
      {unreadCount > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[1.05rem] h-[1.05rem] px-1 flex items-center justify-center text-[0.65rem] font-bold bg-red-600 text-white rounded-full">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </button>
  );
}

export default NotificationBell;
