import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getMessaging } from 'firebase-admin/messaging';
import { getAdminApp, getDb } from '../_lib/firebaseAdmin.js';

/**
 * Sends a web push notification to every device enrolled by a user.
 *
 * POST /api/push/send
 * { "userId": "...", "title": "...", "body": "...", "url": "/inventory" }
 *
 * Tokens live in the `pushDevices` collection, keyed by FCM token (written by
 * the browser in pushNotificationService). Tokens that FCM reports as dead are
 * pruned so the collection does not accumulate stale devices.
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

  const { userId, title, body, url } = (req.body ?? {}) as Record<string, unknown>;

  if (typeof userId !== 'string' || !userId) {
    return res.status(400).json({ error: 'userId is required' });
  }
  if (typeof title !== 'string' || !title) {
    return res.status(400).json({ error: 'title is required' });
  }

  try {
    const db = getDb();
    const snapshot = await db.collection('pushDevices').where('userId', '==', userId).get();
    const tokens = snapshot.docs.map(d => d.id);

    if (tokens.length === 0) {
      return res.status(200).json({ sent: 0, failed: 0, reason: 'no enrolled devices' });
    }

    // Data-only payload so the service worker controls rendering consistently
    // across browsers.
    const response = await getMessaging(getAdminApp()).sendEachForMulticast({
      tokens,
      data: {
        title,
        body: typeof body === 'string' ? body : '',
        url: typeof url === 'string' ? url : '/'
      },
      webpush: {
        fcmOptions: { link: typeof url === 'string' ? url : '/' }
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
      sent: response.successCount,
      failed: response.failureCount,
      pruned: stale.length
    });
  } catch (err) {
    console.error('Push send failed:', err);
    return res.status(500).json({ error: (err as Error).message });
  }
}
