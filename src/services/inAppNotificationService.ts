import {
  addDoc,
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  updateDoc,
  where,
  writeBatch
} from 'firebase/firestore';
import { db } from '../firebase';
import { NotificationEventType } from './notificationRuleService';

/**
 * In-app notifications.
 *
 * These are plain Firestore documents in `userNotifications`, one per delivered
 * message per recipient. The app subscribes to the unread ones for the signed-in
 * user, so anything queued while they were away pops up the next time they open
 * the app, and anything created while they are looking at the app appears live.
 *
 * This is deliberately separate from push: push reaches a device's OS, whereas
 * these render inside the app. A rule can ask for either or both.
 */

const COLLECTION = 'userNotifications';

export interface InAppNotification {
  id: string;
  userId: string;
  title: string;
  body: string;
  /** Optional in-app route to open when the notification is clicked. */
  url: string;
  /** Which rule/event produced this, when it came from the rules engine. */
  eventType: NotificationEventType | 'test' | 'system' | 'manual';
  /** Id of the rule that produced this, when applicable. */
  ruleId: string;
  isRead: boolean;
  createdAt: string;
  readAt: string;
}

export type InAppNotificationInput = Pick<InAppNotification, 'userId' | 'title'> &
  Partial<Pick<InAppNotification, 'body' | 'url' | 'eventType' | 'ruleId'>>;

function toNotification(id: string, data: any): InAppNotification {
  return {
    id,
    userId: data.userId ?? '',
    title: data.title ?? 'Notification',
    body: data.body ?? '',
    url: data.url ?? '',
    eventType: data.eventType ?? 'system',
    ruleId: data.ruleId ?? '',
    isRead: data.isRead ?? false,
    createdAt: data.createdAt ?? '',
    readAt: data.readAt ?? ''
  };
}

/** Newest first. */
function byNewest(a: InAppNotification, b: InAppNotification): number {
  return b.createdAt.localeCompare(a.createdAt);
}

class InAppNotificationService {
  /**
   * Live subscription to a user's unread notifications. Fires immediately with
   * whatever is already queued, then again on every change. Returns the
   * unsubscribe function.
   *
   * Sorting is done client-side so the query needs no composite index.
   */
  subscribeToUnread(
    userId: string,
    onChange: (notifications: InAppNotification[]) => void,
    onError?: (error: Error) => void
  ): () => void {
    const q = query(
      collection(db, COLLECTION),
      where('userId', '==', userId),
      where('isRead', '==', false)
    );

    return onSnapshot(
      q,
      snapshot => {
        onChange(snapshot.docs.map(d => toNotification(d.id, d.data())).sort(byNewest));
      },
      error => {
        console.error('In-app notification subscription failed:', error);
        onError?.(error);
      }
    );
  }

  /** Full history for a user, read and unread. Used by the notifications page. */
  async getAllForUser(userId: string): Promise<InAppNotification[]> {
    const q = query(collection(db, COLLECTION), where('userId', '==', userId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => toNotification(d.id, d.data())).sort(byNewest);
  }

  async create(input: InAppNotificationInput): Promise<string> {
    const docRef = await addDoc(collection(db, COLLECTION), {
      userId: input.userId,
      title: input.title,
      body: input.body ?? '',
      url: input.url ?? '',
      eventType: input.eventType ?? 'system',
      ruleId: input.ruleId ?? '',
      isRead: false,
      createdAt: new Date().toISOString(),
      readAt: ''
    });
    return docRef.id;
  }

  async markRead(id: string): Promise<void> {
    await updateDoc(doc(db, COLLECTION, id), {
      isRead: true,
      readAt: new Date().toISOString()
    });
  }

  async markAllRead(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const readAt = new Date().toISOString();

    // Firestore caps a batch at 500 writes.
    for (let i = 0; i < ids.length; i += 450) {
      const batch = writeBatch(db);
      for (const id of ids.slice(i, i + 450)) {
        batch.update(doc(db, COLLECTION, id), { isRead: true, readAt });
      }
      await batch.commit();
    }
  }
}

export const inAppNotificationService = new InAppNotificationService();
