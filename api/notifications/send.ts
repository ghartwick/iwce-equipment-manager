import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDb } from '../_lib/firebaseAdmin.js';
import { DeliveryChannel, deliverNotification } from '../_lib/notificationDelivery.js';

/**
 * Manual broadcast endpoint.
 *
 * POST /api/notifications/send
 * {
 *   "senderUserId": "...",          // must resolve to an admin user
 *   "userIds": ["...", "..."],      // resolved client-side (all / role / picked)
 *   "title": "...",
 *   "body": "...",
 *   "url": "/timecard",             // optional in-app link
 *   "channels": ["inapp", "push", "email"]
 * }
 *
 * Auth note: the app uses custom (non-Firebase) auth, so there is no signed
 * session token to verify. Like the agent endpoint, we accept the claimed
 * sender id and check the AUTHORITATIVE role stored in Firestore. Only admins
 * may broadcast.
 */

const VALID_CHANNELS: DeliveryChannel[] = ['inapp', 'push', 'email'];
const MAX_RECIPIENTS = 200;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { senderUserId, userIds, title, body, url, channels } = (req.body ?? {}) as Record<
    string,
    unknown
  >;

  if (typeof senderUserId !== 'string' || !senderUserId) {
    return res.status(400).json({ error: 'senderUserId is required' });
  }
  if (!Array.isArray(userIds) || userIds.length === 0) {
    return res.status(400).json({ error: 'userIds must be a non-empty array' });
  }
  if (typeof title !== 'string' || !title.trim()) {
    return res.status(400).json({ error: 'title is required' });
  }

  const requested = Array.isArray(channels) ? channels : [];
  const validChannels = requested.filter((c): c is DeliveryChannel =>
    VALID_CHANNELS.includes(c as DeliveryChannel)
  );
  if (validChannels.length === 0) {
    return res.status(400).json({ error: 'Select at least one channel: inapp, push, email' });
  }

  try {
    const db = getDb();

    const senderSnap = await db.collection('users').doc(senderUserId).get();
    if (!senderSnap.exists) {
      return res.status(401).json({ error: 'Unable to verify sender. Please sign in again.' });
    }
    const senderData = senderSnap.data() as any;
    const senderRole = senderData.role === 'technician' ? 'field' : senderData.role;
    if (senderRole !== 'admin') {
      return res.status(403).json({ error: 'Only admins can send manual notifications.' });
    }

    const recipients = [...new Set(userIds.filter((id): id is string => typeof id === 'string'))]
      .slice(0, MAX_RECIPIENTS);

    const results = [] as Array<Record<string, unknown>>;
    for (const userId of recipients) {
      try {
        const result = await deliverNotification({
          userId,
          title: title.trim(),
          body: typeof body === 'string' ? body : '',
          url: typeof url === 'string' ? url : '',
          channels: validChannels,
          eventType: 'manual',
          senderUserId
        });
        results.push({ userId, ok: true, ...result });
      } catch (err) {
        results.push({ userId, ok: false, error: (err as Error).message });
      }
    }

    return res.status(200).json({
      recipients: recipients.length,
      delivered: results.filter(r => r.ok).length,
      results
    });
  } catch (err) {
    console.error('Manual notification send failed:', err);
    return res.status(500).json({ error: (err as Error).message });
  }
}
