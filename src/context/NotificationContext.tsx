import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import {
  InAppNotification,
  inAppNotificationService
} from '../services/inAppNotificationService';
import { pushNotificationService } from '../services/pushNotificationService';

/**
 * Holds the signed-in user's unread in-app notifications and keeps them live.
 *
 * Mounted once around the app shell so both the header bell and the pop-up read
 * from the same subscription instead of each opening their own listener.
 */

interface NotificationContextValue {
  unread: InAppNotification[];
  unreadCount: number;
  /** True until the first snapshot arrives, so the UI can avoid flashing. */
  isLoading: boolean;
  /** Whether the pop-up is currently open. */
  isPopupOpen: boolean;
  openPopup: () => void;
  closePopup: () => void;
  dismiss: (id: string) => Promise<void>;
  dismissAll: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [unread, setUnread] = useState<InAppNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  // Tracks whether we have already auto-opened for this sign-in, so the pop-up
  // appears once on open rather than every time a snapshot arrives.
  const [hasAutoOpened, setHasAutoOpened] = useState(false);

  useEffect(() => {
    if (!user?.id) {
      setUnread([]);
      setIsLoading(false);
      setHasAutoOpened(false);
      return;
    }

    setIsLoading(true);
    const unsubscribe = inAppNotificationService.subscribeToUnread(
      user.id,
      next => {
        setUnread(next);
        setIsLoading(false);
      },
      () => setIsLoading(false)
    );

    return unsubscribe;
  }, [user?.id]);

  // Anything queued while the user was away pops up as soon as it loads.
  useEffect(() => {
    if (isLoading || hasAutoOpened || unread.length === 0) return;
    setIsPopupOpen(true);
    setHasAutoOpened(true);
  }, [isLoading, hasAutoOpened, unread.length]);

  // A push arriving while the app is focused is not displayed by the browser,
  // so surface it in the pop-up instead.
  useEffect(() => {
    if (!user?.id) return;

    let unsubscribe: (() => void) | undefined;
    let cancelled = false;

    pushNotificationService
      .listenInForeground(() => {
        // The delivery backend also writes a Firestore record, which the
        // subscription above picks up; just make sure the pop-up is visible.
        setIsPopupOpen(true);
      })
      .then(fn => {
        if (cancelled) fn();
        else unsubscribe = fn;
      })
      .catch(() => {
        // Push is optional; in-app notifications work without it.
      });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [user?.id]);

  const dismiss = useCallback(async (id: string) => {
    // Drop it locally right away so the pop-up feels responsive; the
    // subscription will confirm.
    setUnread(prev => prev.filter(n => n.id !== id));
    await inAppNotificationService.markRead(id);
  }, []);

  const dismissAll = useCallback(async () => {
    const ids = unread.map(n => n.id);
    setUnread([]);
    setIsPopupOpen(false);
    await inAppNotificationService.markAllRead(ids);
  }, [unread]);

  const value: NotificationContextValue = {
    unread,
    unreadCount: unread.length,
    isLoading,
    isPopupOpen,
    openPopup: () => setIsPopupOpen(true),
    closePopup: () => setIsPopupOpen(false),
    dismiss,
    dismissAll
  };

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications(): NotificationContextValue {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used inside a NotificationProvider');
  }
  return context;
}
