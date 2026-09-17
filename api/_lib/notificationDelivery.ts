import { getMessaging } from 'firebase-admin/messaging';
import { getAdminApp, getDb } from './firebaseAdmin.js';

/**
 * Server-side notification delivery, shared by the manual send endpoint and the
 * scheduled digest job so both behave identically.
 *
 * - `inapp` writes a `userNotifications` document. The app holds a live
 *   subscription to the unread ones, so it pops up immediately if the app is
 *   open and on next open if not.
 * - `push` sends to every device in `pushDevices` (keyed by FCM token, written
 *   by the browser in pushNotificationService).
 */

const DEAD_TOKEN_CODES = [
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument'
];

export type DeliveryChannel = 'inapp' | 'push';

export interface DeliveryRequest {
  userId: string;
  title: string;
  body?: string;
  url?: string;
  channels?: DeliveryChannel[];
  /** Recorded on the in-app document for traceability. */
  eventType?: string;
  ruleId?: string;
}

export interface DeliveryResult {
  inAppId: string | null;
  sent: number;
  failed: number;
  pruned: number;
  reason?: string;
}

export async function deliverNotification(request: DeliveryRequest): Promise<DeliveryResult> {
  const { userId, title } = request;
  const body = request.body ?? '';
  const url = request.url ?? '';
  const channels = request.channels ?? ['inapp', 'push'];

  const db = getDb();
  const result: DeliveryResult = { inAppId: null, sent: 0, failed: 0, pruned: 0 };

  if (channels.includes('inapp')) {
    const created = await db.collection('userNotifications').add({
      userId,
      title,
      body,
      url,
      eventType: request.eventType ?? 'system',
      ruleId: request.ruleId ?? '',
      isRead: false,
      createdAt: new Date().toISOString(),
      readAt: ''
    });
    result.inAppId = created.id;
  }

  if (!channels.includes('push')) return result;

  const snapshot = await db.collection('pushDevices').where('userId', '==', userId).get();
  const tokens = snapshot.docs.map(d => d.id);

  if (tokens.length === 0) {
    result.reason = 'no enrolled devices';
    return result;
  }

  // Data-only payload so the service worker controls rendering consistently
  // across browsers.
  const response = await getMessaging(getAdminApp()).sendEachForMulticast({
    tokens,
    data: { title, body, url: url || '/' },
    webpush: { fcmOptions: { link: url || '/' } }
  });

  // Tokens FCM reports as dead are pruned so the collection does not
  // accumulate stale devices.
  const stale: string[] = [];
  response.responses.forEach((res, index) => {
    const code = (res.error as any)?.code;
    if (!res.success && code && DEAD_TOKEN_CODES.includes(code)) {
      stale.push(tokens[index]);
    }
  });

  if (stale.length > 0) {
    const batch = db.batch();
    for (const token of stale) batch.delete(db.collection('pushDevices').doc(token));
    await batch.commit();
  }

  result.sent = response.successCount;
  result.failed = response.failureCount;
  result.pruned = stale.length;
  return result;
}
