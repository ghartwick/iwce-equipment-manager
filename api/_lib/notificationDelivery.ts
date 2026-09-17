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
 * - `email` sends through Resend (https://resend.com) using the recipient's
 *   `email` field on their `users` document. Requires RESEND_API_KEY and
 *   EMAIL_FROM env vars. Email failures are recorded on the result rather
 *   than thrown, so a missing provider cannot break the other channels or
 *   abort a digest run.
 */

const DEAD_TOKEN_CODES = [
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument'
];

export type DeliveryChannel = 'inapp' | 'push' | 'email';

export interface DeliveryRequest {
  userId: string;
  title: string;
  body?: string;
  url?: string;
  channels?: DeliveryChannel[];
  /** Recorded on the in-app document for traceability. */
  eventType?: string;
  ruleId?: string;
  /** Admin who triggered a manual send, recorded in the history log. */
  senderUserId?: string;
}

export interface DeliveryResult {
  inAppId: string | null;
  sent: number;
  failed: number;
  pruned: number;
  /** True when the email channel was requested and the send succeeded. */
  emailSent?: boolean;
  /** Why email was not sent (no address, provider not configured, API error). */
  emailReason?: string;
  reason?: string;
}

/**
 * Sends one email through Resend's REST API. No SDK is needed, matching the
 * provider adapters used elsewhere in this codebase.
 */
async function sendEmail(to: string, title: string, body: string, url: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    throw new Error('Email is not configured. Set RESEND_API_KEY and EMAIL_FROM in Vercel env vars.');
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: title,
      text: url ? `${body}\n\n${url}` : body
    })
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Email provider returned ${response.status}${detail ? `: ${detail}` : ''}`);
  }
}

export async function deliverNotification(request: DeliveryRequest): Promise<DeliveryResult> {
  const result = await deliver(request);

  // Chronicle every delivery attempt for the history view. A logging failure
  // must never break the notification itself.
  try {
    await getDb()
      .collection('notificationHistory')
      .add({
        userId: request.userId,
        title: request.title,
        body: request.body ?? '',
        url: request.url ?? '',
        channels: request.channels ?? ['inapp', 'push'],
        eventType: request.eventType ?? 'system',
        ruleId: request.ruleId ?? '',
        senderUserId: request.senderUserId ?? '',
        inAppId: result.inAppId,
        pushSent: result.sent,
        pushFailed: result.failed,
        emailSent: result.emailSent ?? null,
        emailReason: result.emailReason ?? '',
        reason: result.reason ?? '',
        createdAt: new Date().toISOString()
      });
  } catch (err) {
    console.error('Failed to record notification history:', err);
  }

  return result;
}

async function deliver(request: DeliveryRequest): Promise<DeliveryResult> {
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

  if (channels.includes('email')) {
    try {
      const userSnap = await db.collection('users').doc(userId).get();
      const email = (userSnap.data()?.email ?? '').trim();
      if (!email) {
        result.emailSent = false;
        result.emailReason = 'no email address on file';
      } else {
        await sendEmail(email, title, body, url);
        result.emailSent = true;
      }
    } catch (err) {
      result.emailSent = false;
      result.emailReason = (err as Error).message;
    }
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
