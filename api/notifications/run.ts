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
 * How long after its scheduled time a notification may still be sent. GitHub
 * Actions cron ticks are routinely delayed by tens of minutes and sometimes
 * dropped, so requiring the tick to land inside the exact scheduled hour makes
 * notifications silently never fire. Anything not sent within this window is
 * skipped rather than delivered at a surprising time.
 */
const CATCH_UP_MS = 3 * 60 * 60 * 1000;

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
  audienceType: 'all' | 'users' | 'role' | 'group' | 'fleet';
  userIds: string[];
  roles?: string[];
  categoryId?: string;
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
 * Most recent moment at or before `now` that the schedule should have fired.
 * `utcOffsetMinutes` comes from `Date.getTimezoneOffset()`, which is minutes to
 * add to local time to reach UTC, hence the subtraction. Working in that shifted
 * space with UTC getters yields local calendar fields.
 */
function lastOccurrence(
  timeOfDay: string,
  frequency: string,
  dayOfWeek: number,
  utcOffsetMinutes: number,
  now: Date
): Date | null {
  const [hourText, minuteText = '0'] = (timeOfDay || '').split(':');
  const hour = Number(hourText);
  const minute = Number(minuteText);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null;

  const offsetMs = utcOffsetMinutes * 60 * 1000;
  const shiftedNow = now.getTime() - offsetMs;
  const d = new Date(shiftedNow);
  let candidate = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), hour, minute);
  if (candidate > shiftedNow) candidate -= DAY_MS;

  if (frequency === 'weekly') {
    const dow = new Date(candidate).getUTCDay();
    candidate -= ((dow - dayOfWeek + 7) % 7) * DAY_MS;
  }

  return new Date(candidate + offsetMs);
}

/**
 * Is this schedule owed a send? True when its latest occurrence is within the
 * catch-up window and nothing has been sent since. `lastSentAt` is the
 * double-send guard: once stamped at or after the occurrence it stays false.
 */
function isOccurrenceDue(
  timeOfDay: string,
  frequency: string,
  dayOfWeek: number,
  utcOffsetMinutes: number,
  lastSentAt: string,
  now: Date
): boolean {
  const occurrence = lastOccurrence(timeOfDay, frequency, dayOfWeek, utcOffsetMinutes, now);
  if (!occurrence) return false;
  if (now.getTime() - occurrence.getTime() > CATCH_UP_MS) return false;
  if (lastSentAt && new Date(lastSentAt).getTime() >= occurrence.getTime()) return false;
  return true;
}

/** Is this rule due? */
function isDue(rule: RuleDoc, now: Date): boolean {
  return isOccurrenceDue(
    rule.timeOfDay,
    rule.frequency,
    rule.dayOfWeek,
    rule.utcOffsetMinutes,
    rule.lastDigestAt,
    now
  );
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

/** Is this scheduled reminder due? Mirrors isDue. */
function isScheduleDue(schedule: ScheduleDoc, now: Date): boolean {
  return isOccurrenceDue(
    schedule.timeOfDay,
    schedule.frequency,
    schedule.dayOfWeek,
    schedule.utcOffsetMinutes,
    schedule.lastSentAt,
    now
  );
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
  const users = usersSnapshot.docs.map(d => {
    const data = d.data();
    const rawRole = (data.role as string) ?? '';
    return {
      id: d.id,
      name: (data.name as string) ?? '',
      role: rawRole === 'technician' ? 'field' : rawRole
    };
  });

  if (schedule.audienceType === 'all') {
    return users.map(u => u.id);
  }

  if (schedule.audienceType === 'role') {
    const roles = new Set(schedule.roles ?? []);
    return users.filter(u => roles.has(u.role)).map(u => u.id);
  }

  // 'group': names assigned to a unit of that category in any inventory
  // collection. Legacy 'fleet': names assigned to any fleet unit.
  const collections =
    schedule.audienceType === 'group'
      ? ['fleetEquipment', 'heavyEquipment', 'fieldTools']
      : ['fleetEquipment'];
  const snapshots = await Promise.all(collections.map(c => db.collection(c).get()));
  const assignedNames = new Set(
    snapshots
      .flatMap(s => s.docs)
      .filter(d => schedule.audienceType !== 'group' || d.data().category === schedule.categoryId)
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
