import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getMessaging } from 'firebase-admin/messaging';
import { getAdminApp, getDb } from '../_lib/firebaseAdmin.js';

/**
 * Delivers a notification to a user over the requested channels.
 *
 * POST /api/push/send
 * {
 *   "userId": "...",
 *   "title": "...",
 *   "body": "...",
 *   "url": "/inventory",
 *   "channels": ["inapp", "push"]   // optional, defaults to both
 * }
 *
 * - `inapp` writes a `userNotifications` document. The app subscribes to the
 *   unread ones, so it pops up immediately if open and on next open if not.
 * - `push` sends to every device in `pushDevices` (keyed by FCM token, written
 *   by the browser in pushNotificationService). Tokens FCM reports as dead are
 *   pruned so the collection does not accumulate stale devices.
 */

const DEAD_TOKEN_CODES = [
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument'
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userId, title, body, url, channels } = (req.body ?? {}) as Record<string, unknown>;

  if (typeof userId !== 'string' || !userId) {
    return res.status(400).json({ error: 'userId is required' });
  }
  if (typeof title !== 'string' || !title) {
    return res.status(400).json({ error: 'title is required' });
  }

  const requested = Array.isArray(channels) ? channels : ['inapp', 'push'];
  const wantsInApp = requested.includes('inapp');
  const wantsPush = requested.includes('push');
  const text = typeof body === 'string' ? body : '';
  const link = typeof url === 'string' ? url : '/';

  try {
    const db = getDb();

    let inAppId: string | null = null;
    if (wantsInApp) {
      const created = await db.collection('userNotifications').add({
        userId,
        title,
        body: text,
        url: typeof url === 'string' ? url : '',
        eventType: 'system',
        ruleId: '',
        isRead: false,
        createdAt: new Date().toISOString(),
        readAt: ''
      });
      inAppId = created.id;
    }

    if (!wantsPush) {
      return res.status(200).json({ inAppId, sent: 0, failed: 0 });
    }

    const snapshot = await db.collection('pushDevices').where('userId', '==', userId).get();
    const tokens = snapshot.docs.map(d => d.id);

    if (tokens.length === 0) {
      return res.status(200).json({ inAppId, sent: 0, failed: 0, reason: 'no enrolled devices' });
    }

    // Data-only payload so the service worker controls rendering consistently
    // across browsers.
    const response = await getMessaging(getAdminApp()).sendEachForMulticast({
      tokens,
      data: { title, body: text, url: link },
      webpush: {
        fcmOptions: { link }
      }
    });

    const stale: string[] = [];
    response.responses.forEach((result, index) => {
      const code = (result.error as any)?.code;
      if (!result.success && code && DEAD_TOKEN_CODES.includes(code)) {
        stale.push(tokens[index]);
      }
    });

    if (stale.length > 0) {
      const batch = db.batch();
      for (const token of stale) batch.delete(db.collection('pushDevices').doc(token));
      await batch.commit();
    }

    return res.status(200).json({
      inAppId,
      sent: response.successCount,
      failed: response.failureCount,
      pruned: stale.length
    });
  } catch (err) {
    console.error('Push send failed:', err);
    return res.status(500).json({ error: (err as Error).message });
  }
}
