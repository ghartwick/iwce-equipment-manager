import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  where
} from 'firebase/firestore';
import { db } from '../firebase';

/**
 * Read-side for the `notificationHistory` collection written server-side by
 * deliverNotification. One document per recipient per send, covering manual
 * broadcasts, rule-based deliveries and test sends.
 */

const COLLECTION = 'notificationHistory';
const PAGE_SIZE = 100;

export interface NotificationHistoryEntry {
  id: string;
  /** Recipient user id. */
  userId: string;
  title: string;
  body: string;
  url: string;
  channels: string[];
  /** 'manual' | rule event type | 'test' | 'system'. */
  eventType: string;
  ruleId: string;
  /** Admin who triggered a manual send ('' for rule-based sends). */
  senderUserId: string;
  inAppId: string | null;
  pushSent: number;
  pushFailed: number;
  emailSent: boolean | null;
  emailReason: string;
  reason: string;
  createdAt: string;
}

class NotificationHistoryService {
  /**
   * Admins pass no userId to see every send; other users pass their own id to
   * see what was sent to them. The per-user query avoids orderBy so no
   * composite index is required — results are sorted client-side.
   */
  async getHistory(userId?: string): Promise<NotificationHistoryEntry[]> {
    try {
      const col = collection(db, COLLECTION);
      const q = userId
        ? query(col, where('userId', '==', userId), limit(PAGE_SIZE))
        : query(col, orderBy('createdAt', 'desc'), limit(PAGE_SIZE));

      const snapshot = await getDocs(q);
      const entries = snapshot.docs.map(
        d => ({ id: d.id, ...d.data() } as NotificationHistoryEntry)
      );
      entries.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      return entries;
    } catch (error) {
      console.error('Error getting notification history:', error);
      return [];
    }
  }
}

export const notificationHistoryService = new NotificationHistoryService();
