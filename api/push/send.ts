import type { VercelRequest, VercelResponse } from '@vercel/node';
import { DeliveryChannel, deliverNotification } from '../_lib/notificationDelivery.js';

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
 * The delivery itself lives in `_lib/notificationDelivery` so this endpoint and
 * the scheduled digest job stay consistent.
 */

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

  try {
    const result = await deliverNotification({
      userId,
      title,
      body: typeof body === 'string' ? body : '',
      url: typeof url === 'string' ? url : '',
      channels: Array.isArray(channels) ? (channels as DeliveryChannel[]) : undefined
    });
    return res.status(200).json(result);
  } catch (err) {
    console.error('Notification send failed:', err);
    return res.status(500).json({ error: (err as Error).message });
  }
}
