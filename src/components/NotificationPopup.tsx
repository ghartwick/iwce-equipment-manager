import { useNavigate } from 'react-router-dom';
import { BellRing, X } from 'lucide-react';
import { useNotifications } from '../context/NotificationContext';
import { InAppNotification } from '../services/inAppNotificationService';

/**
 * Modal that surfaces unread in-app notifications. Opens automatically the
 * first time unread items load after sign-in, and on demand from the header
 * bell.
 */

function formatWhen(iso: string): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';

  const minutes = Math.floor((Date.now() - date.getTime()) / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 60 * 24) return `${Math.floor(minutes / 60)}h ago`;

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

export function NotificationPopup() {
  const { history, unread, isPopupOpen, closePopup, dismiss, dismissAll } =
    useNotifications();
  const navigate = useNavigate();

  if (!isPopupOpen) return null;

  const handleOpen = async (notification: InAppNotification) => {
    if (!notification.isRead) await dismiss(notification.id);
    closePopup();
    if (notification.url) navigate(notification.url);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center p-4 sm:p-6 bg-black bg-opacity-50">
      <div className="mt-10 w-full max-w-md bg-yellow-100 dark:bg-black border border-yellow-600 rounded-lg shadow-xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-yellow-300 dark:border-yellow-800">
          <div className="flex items-center gap-2">
            <BellRing className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
            <h2 className="text-lg font-semibold text-yellow-700 dark:text-yellow-300">
              Notifications
              {unread.length > 0 && (
                <span className="ml-2 text-sm font-normal text-yellow-600 dark:text-yellow-500">
                  {unread.length} unread
                </span>
              )}
            </h2>
          </div>
          <button
            onClick={closePopup}
            className="p-1 text-yellow-600 hover:text-yellow-500"
            title="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-yellow-300 dark:divide-yellow-800">
          {history.length === 0 ? (
            <p className="p-4 text-sm text-yellow-600 dark:text-yellow-500">
              No notifications yet.
            </p>
          ) : (
            history.map(notification => (
              <div
                key={notification.id}
                className={`p-4 ${
                  notification.isRead
                    ? 'opacity-60'
                    : 'bg-yellow-200/50 dark:bg-yellow-900/20'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 dark:text-yellow-100 break-words">
                      {!notification.isRead && (
                        <span className="inline-block w-2 h-2 mr-2 bg-yellow-500 rounded-full align-middle" />
                      )}
                      {notification.title}
                    </p>
                    {notification.body && (
                      <p className="mt-1 text-sm text-yellow-700 dark:text-yellow-400 break-words">
                        {notification.body}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-yellow-600 dark:text-yellow-600">
                      {formatWhen(notification.createdAt)}
                    </p>
                  </div>
                  {!notification.isRead && (
                    <button
                      onClick={() => dismiss(notification.id)}
                      className="shrink-0 p-1 text-yellow-600 hover:text-yellow-500"
                      title="Mark as read"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {notification.url && (
                  <button
                    onClick={() => handleOpen(notification)}
                    className="mt-2 text-sm font-medium text-yellow-700 dark:text-yellow-300 underline hover:text-yellow-600"
                  >
                    View details
                  </button>
                )}
              </div>
            ))
          )}
        </div>

        <div className="flex gap-2 p-4 border-t border-yellow-300 dark:border-yellow-800">
          {unread.length > 0 && (
            <button
              onClick={dismissAll}
              className="px-4 py-2 bg-yellow-500 text-black rounded-lg hover:bg-yellow-600 transition-colors"
            >
              Mark all as read
            </button>
          )}
          <button
            onClick={closePopup}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default NotificationPopup;
