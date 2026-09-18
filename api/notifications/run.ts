import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDb } from '../_lib/firebaseAdmin.js';
import { DeliveryChannel, deliverNotification } from '../_lib/notificationDelivery.js';

/**
 * Scheduled evaluation of daily and weekly notification rules.
 *
 * Runs hourly, triggered by the GitHub Actions workflow in
 * .github/workflows/notification-cron.yml (Vercel Hobby only allows daily
 * crons). Immediate rules are not handled here - the app delivers those the
 * moment the event happens, in notificationDispatchService. This job only
 * exists for the digest cadences and scheduled service notifications, which
 * have to fire whether or not anyone has the app open.
 *
 * For each active digest rule it:
 *   1. Works out whether the rule's local send time falls in this hour.
 *   2. Collects queued `notificationEvents` since the rule last ran.
 *   3. Sends one summary notification, then stamps `lastDigestAt`.
 *
 * `lastDigestAt` is both the window start and the double-send guard, so a
 * retried or overlapping invocation cannot notify twice.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Events older than this are deleted. Comfortably longer than the widest digest
 * window (7 days) so nothing still needed is removed.
 */
const EVENT_RETENTION_MS = 30 * DAY_MS;

/** Frequencies this job is responsible for. */
const DIGEST_FREQUENCIES = ['daily', 'weekly'];

/**
 * Minimum gap before a rule may fire again. Comfortably under one period, so a
 * slightly early or late cron tick still fires, but a duplicate tick does not.
 */
const MIN_GAP_MS: Record<string, number> = {
  daily: 20 * 60 * 60 * 1000,
  weekly: 6 * DAY_MS
};

interface RuleDoc {
  id: string;
  ownerUserId: string;
  name: string;
  eventType: string;
  channels: DeliveryChannel[];
  scopeType: 'all' | 'sites' | 'users';
  siteNames: string[];
  subjectUserIds: string[];
  frequency: string;
  timeOfDay: string;
  dayOfWeek: number;
  utcOffsetMinutes: number;
  isActive: boolean;
  lastDigestAt: string;
}

interface EventDoc {
  eventType: string;
  title: string;
  body: string;
  url: string;
  siteName: string;
  subjectUserId: string;
  createdAt: string;
}

/** Admin-defined recurring reminder (scheduledNotifications collection). */
interface ScheduleDoc {
  id: string;
  name: string;
  body: string;
  channels: DeliveryChannel[];
  audienceType: 'all' | 'fleet' | 'users';
  userIds: string[];
  frequency: string;
  timeOfDay: string;
  dayOfWeek: number;
  utcOffsetMinutes: number;
  isActive: boolean;
  lastSentAt: string;
}

/**
 * fleetEquipment.employee values that are statuses, not people. Anything else
 * is a user's display name.
 */
const NON_USER_EMPLOYEE_VALUES = new Set([
  '',
  'Office',
  'Shop',
  'Broken',
  'Out For Repair',
  'Missing'
]);

/**
 * Wall-clock time at the rule's location. `utcOffsetMinutes` comes from
 * `Date.getTimezoneOffset()`, which is minutes to add to local time to reach
 * UTC, hence the subtraction. Reading the shifted instant with UTC getters then
 * yields local calendar fields.
 */
function localParts(now: Date, utcOffsetMinutes: number) {
  const shifted = new Date(now.getTime() - utcOffsetMinutes * 60 * 1000);
  return {
    hour: shifted.getUTCHours(),
    dayOfWeek: shifted.getUTCDay()
  };
}

/** Is this rule due in the current hour? */
function isDue(rule: RuleDoc, now: Date): boolean {
  const [hourText] = (rule.timeOfDay || '').split(':');
  const dueHour = Number(hourText);
  if (!Number.isInteger(dueHour)) return false;

  const local = localParts(now, rule.utcOffsetMinutes);
  if (local.hour !== dueHour) return false;
  if (rule.frequency === 'weekly' && local.dayOfWeek !== rule.dayOfWeek) return false;

  // Guard against a second delivery within the same period.
  if (rule.lastDigestAt) {
    const elapsed = now.getTime() - new Date(rule.lastDigestAt).getTime();
    if (elapsed < (MIN_GAP_MS[rule.frequency] ?? DAY_MS)) return false;
  }

  return true;
}

/** Does this event fall inside the rule's scope? Mirrors the client logic. */
function ruleMatchesEvent(rule: RuleDoc, event: EventDoc): boolean {
  if (rule.eventType !== event.eventType) return false;

  if (rule.scopeType === 'sites') {
    return !!event.siteName && (rule.siteNames ?? []).includes(event.siteName);
  }
  if (rule.scopeType === 'users') {
    return !!event.subjectUserId && (rule.subjectUserIds ?? []).includes(event.subjectUserId);
  }
  return true;
}

/** Is this scheduled reminder due in the current hour? Mirrors isDue. */
function isScheduleDue(schedule: ScheduleDoc, now: Date): boolean {
  const [hourText] = (schedule.timeOfDay || '').split(':');
  const dueHour = Number(hourText);
  if (!Number.isInteger(dueHour)) return false;

  const local = localParts(now, schedule.utcOffsetMinutes);
  if (local.hour !== dueHour) return false;
  if (schedule.frequency === 'weekly' && local.dayOfWeek !== schedule.dayOfWeek) return false;

  if (schedule.lastSentAt) {
    const elapsed = now.getTime() - new Date(schedule.lastSentAt).getTime();
    if (elapsed < (MIN_GAP_MS[schedule.frequency] ?? DAY_MS)) return false;
  }

  return true;
}

/**
 * Resolves a schedule's audience to user ids.
 * 'fleet' matches users whose display name is assigned on a fleetEquipment
 * unit - the equipment stores names, not ids, so we join through users.
 */
async function resolveScheduleRecipients(
  db: ReturnType<typeof getDb>,
  schedule: ScheduleDoc
): Promise<string[]> {
  if (schedule.audienceType === 'users') {
    return [...new Set(schedule.userIds ?? [])];
  }

  const usersSnapshot = await db.collection('users').where('isActive', '==', true).get();
  const users = usersSnapshot.docs.map(d => ({ id: d.id, name: (d.data().name as string) ?? '' }));

  if (schedule.audienceType === 'all') {
    return users.map(u => u.id);
  }

  // 'fleet': names assigned to any fleet unit.
  const fleetSnapshot = await db.collection('fleetEquipment').get();
  const assignedNames = new Set(
    fleetSnapshot.docs
      .map(d => (d.data().employee as string) ?? '')
      .filter(name => !NON_USER_EMPLOYEE_VALUES.has(name))
  );
  return users.filter(u => assignedNames.has(u.name)).map(u => u.id);
}

/** Start of the window this digest should cover. */
function windowStart(rule: RuleDoc, now: Date): string {
  if (rule.lastDigestAt) return rule.lastDigestAt;
  const span = rule.frequency === 'weekly' ? 7 * DAY_MS : DAY_MS;
  return new Date(now.getTime() - span).toISOString();
}

/**
 * Deletes events past the retention window. The queue is append-only during
 * normal operation, so without this it would grow without bound.
 */
async function pruneOldEvents(db: ReturnType<typeof getDb>, now: Date): Promise<number> {
  const cutoff = new Date(now.getTime() - EVENT_RETENTION_MS).toISOString();
  const expired = await db
    .collection('notificationEvents')
    .where('createdAt', '<', cutoff)
    .limit(400)
    .get();

  if (expired.empty) return 0;

  const batch = db.batch();
  for (const docSnap of expired.docs) batch.delete(docSnap.ref);
  await batch.commit();
  return expired.size;
}

function summarize(rule: RuleDoc, events: EventDoc[]): { title: string; body: string } {
  const period = rule.frequency === 'weekly' ? 'this week' : 'today';
  const title =
    events.length === 1
      ? events[0].title
      : `${events.length} updates ${period}: ${rule.name}`;

  // Keep the body readable; push payloads get truncated by the OS anyway.
  const lines = events.slice(0, 5).map(e => `\u2022 ${e.title}`);
  if (events.length > lines.length) {
    lines.push(`\u2026 and ${events.length - lines.length} more`);
  }

  return { title, body: lines.join('\n') };
}

/**
 * Sends due scheduled service notifications. Unlike digest rules these are not
 * event-driven: the message is fixed and goes to a resolved audience.
 */
async function runScheduledNotifications(
  db: ReturnType<typeof getDb>,
  now: Date
): Promise<{ evaluated: number; due: number; sent: number }> {
  const snapshot = await db
    .collection('scheduledNotifications')
    .where('isActive', '==', true)
    .get();

  const due = snapshot.docs
    .map(d => ({ id: d.id, ...d.data() } as ScheduleDoc))
    .filter(s => (s.channels ?? []).length > 0)
    .filter(s => isScheduleDue(s, now));

  let sent = 0;
  for (const schedule of due) {
    const recipients = await resolveScheduleRecipients(db, schedule);
    for (const userId of recipients) {
      try {
        await deliverNotification({
          userId,
          title: schedule.name,
          body: schedule.body ?? '',
          channels: schedule.channels,
          eventType: 'service_reminder',
          ruleId: schedule.id
        });
        sent += 1;
      } catch (err) {
        console.error(`Scheduled notification ${schedule.id} failed for ${userId}:`, err);
      }
    }
  }

  if (due.length > 0) {
    const stampedAt = now.toISOString();
    const batch = db.batch();
    for (const schedule of due) {
      batch.update(db.collection('scheduledNotifications').doc(schedule.id), {
        lastSentAt: stampedAt
      });
    }
    await batch.commit();
  }

  return { evaluated: snapshot.size, due: due.length, sent };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Vercel Cron sends this header; a matching CRON_SECRET keeps the endpoint
  // from being triggered by anyone who finds the URL.
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.authorization;
    if (auth !== `Bearer ${secret}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  const now = new Date();

  try {
    const db = getDb();
    const rulesSnapshot = await db
      .collection('notificationRules')
      .where('isActive', '==', true)
      .get();

    const dueRules = rulesSnapshot.docs
      .map(d => ({ id: d.id, ...d.data() } as RuleDoc))
      .filter(rule => DIGEST_FREQUENCIES.includes(rule.frequency))
      .filter(rule => (rule.channels ?? []).length > 0)
      .filter(rule => isDue(rule, now));

    if (dueRules.length === 0) {
      const pruned = await pruneOldEvents(db, now);
      const scheduled = await runScheduledNotifications(db, now);
      return res
        .status(200)
        .json({ evaluated: rulesSnapshot.size, due: 0, sent: 0, pruned, scheduled });
    }

    // One read of the event queue covers every due rule.
    const earliest = dueRules
      .map(rule => windowStart(rule, now))
      .reduce((a, b) => (a < b ? a : b));

    const eventsSnapshot = await db
      .collection('notificationEvents')
      .where('createdAt', '>=', earliest)
      .get();

    const events = eventsSnapshot.docs.map(d => d.data() as EventDoc);

    let sent = 0;
    const skipped: string[] = [];

    for (const rule of dueRules) {
      const start = windowStart(rule, now);
      const matching = events.filter(
        event => event.createdAt >= start && ruleMatchesEvent(rule, event)
      );

      if (matching.length === 0) {
        // Nothing happened. Still advance the window so the next run does not
        // re-scan an already-covered period.
        skipped.push(rule.id);
        continue;
      }

      const { title, body } = summarize(rule, matching);

      await deliverNotification({
        userId: rule.ownerUserId,
        title,
        body,
        url: matching.length === 1 ? matching[0].url : '',
        channels: rule.channels,
        eventType: rule.eventType,
        ruleId: rule.id
      });
      sent += 1;
    }

    // Stamp every rule that was due, sent or not, so the guard holds.
    const stampedAt = now.toISOString();
    const batch = db.batch();
    for (const rule of dueRules) {
      batch.update(db.collection('notificationRules').doc(rule.id), {
        lastDigestAt: stampedAt
      });
    }
    await batch.commit();

    const pruned = await pruneOldEvents(db, now);

    const scheduled = await runScheduledNotifications(db, now);

    return res.status(200).json({
      evaluated: rulesSnapshot.size,
      due: dueRules.length,
      sent,
      empty: skipped.length,
      pruned,
      scheduled
    });
  } catch (err) {
    console.error('Notification run failed:', err);
    return res.status(500).json({ error: (err as Error).message });
  }
}
