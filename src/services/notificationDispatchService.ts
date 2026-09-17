import { addDoc, collection } from 'firebase/firestore';
import { db } from '../firebase';
import { inAppNotificationService } from './inAppNotificationService';
import {
  NotificationEventType,
  NotificationRule,
  notificationRuleService
} from './notificationRuleService';

/**
 * Turns things that happen in the app into notifications, by matching them
 * against the rules users have configured.
 *
 * Every event does two things:
 *
 *  1. Gets appended to the `notificationEvents` collection. This is the queue
 *     the scheduled digest job reads, so daily/weekly rules can summarise a
 *     period without the app having to be open.
 *  2. Gets delivered right away to any matching rule with `immediate` frequency.
 *
 * Emitting is always best-effort. A notification failing must never break the
 * action that triggered it, so every path here swallows its errors after
 * logging them.
 */

const EVENTS_COLLECTION = 'notificationEvents';

export interface NotificationEvent {
  eventType: NotificationEventType;
  /** Headline, e.g. 'Excavator 12 flagged for repair'. */
  title: string;
  /** Supporting detail. */
  body: string;
  /** In-app route to open from the notification. */
  url?: string;
  /** Site the event relates to, used to match rules scoped to sites. */
  siteName?: string;
  /**
   * The user the event is *about* (e.g. whose timecard was submitted), used to
   * match rules scoped to users.
   */
  subjectUserId?: string;
  /**
   * Who performed the action. Rules owned by this user are skipped so nobody is
   * notified about their own action.
   */
  actorUserId?: string;
}

/** Does this event fall inside the rule's scope? */
export function ruleMatchesEvent(rule: NotificationRule, event: NotificationEvent): boolean {
  if (!rule.isActive) return false;
  if (rule.eventType !== event.eventType) return false;

  // Don't tell someone about something they just did themselves.
  if (event.actorUserId && rule.ownerUserId === event.actorUserId) return false;

  if (rule.scopeType === 'sites') {
    return !!event.siteName && rule.siteNames.includes(event.siteName);
  }
  if (rule.scopeType === 'users') {
    return !!event.subjectUserId && rule.subjectUserIds.includes(event.subjectUserId);
  }
  return true;
}

/**
 * Sends a push to a user's enrolled devices via the serverless endpoint.
 * Only push is requested here; the in-app copy is written directly by the
 * caller so it works even without the API (e.g. `vite dev`).
 */
async function sendPush(userId: string, event: NotificationEvent): Promise<void> {
  const response = await fetch('/api/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId,
      title: event.title,
      body: event.body,
      url: event.url ?? '/',
      channels: ['push']
    })
  });

  if (!response.ok) {
    throw new Error(`Push endpoint returned ${response.status}`);
  }
}

export type ManualNotificationChannel = 'inapp' | 'push' | 'email';

export interface ManualSendResult {
  userId: string;
  ok: boolean;
  inAppId?: string | null;
  sent?: number;
  failed?: number;
  emailSent?: boolean;
  emailReason?: string;
  reason?: string;
  error?: string;
}

/**
 * Sends an ad-hoc notification to a resolved list of users via the broadcast
 * endpoint. Audience resolution (all / role / picked users) happens in the UI;
 * this just ships the user id list.
 */
export async function sendManualNotification(input: {
  senderUserId: string;
  userIds: string[];
  title: string;
  body: string;
  url?: string;
  channels: ManualNotificationChannel[];
}): Promise<{ recipients: number; delivered: number; results: ManualSendResult[] }> {
  const response = await fetch('/api/notifications/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input)
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `Send failed (${response.status})`);
  }
  return data;
}

class NotificationDispatchService {
  /** Appends the event to the queue the digest job reads. */
  private async queueEvent(event: NotificationEvent): Promise<void> {
    await addDoc(collection(db, EVENTS_COLLECTION), {
      eventType: event.eventType,
      title: event.title,
      body: event.body,
      url: event.url ?? '',
      siteName: event.siteName ?? '',
      subjectUserId: event.subjectUserId ?? '',
      actorUserId: event.actorUserId ?? '',
      createdAt: new Date().toISOString()
    });
  }

  private async deliver(rule: NotificationRule, event: NotificationEvent): Promise<void> {
    if (rule.channels.includes('inapp')) {
      await inAppNotificationService.create({
        userId: rule.ownerUserId,
        title: event.title,
        body: event.body,
        url: event.url,
        eventType: event.eventType,
        ruleId: rule.id
      });
    }

    if (rule.channels.includes('push')) {
      try {
        await sendPush(rule.ownerUserId, event);
      } catch (err) {
        // The in-app copy above still landed, so the user is not left unaware.
        console.warn('Push delivery failed, in-app notification still sent:', err);
      }
    }
  }

  /**
   * Records an event and fans it out to matching immediate rules.
   *
   * Safe to call from anywhere, including inside a write path: it never throws
   * and never rejects.
   */
  async emit(event: NotificationEvent): Promise<void> {
    try {
      await this.queueEvent(event);

      const rules = await notificationRuleService.getAllRules();
      const matching = rules.filter(
        rule => rule.frequency === 'immediate' && ruleMatchesEvent(rule, event)
      );

      // One rule per recipient at a time; a user with two matching rules gets
      // two notifications, which is what they asked for by creating both.
      await Promise.all(matching.map(rule => this.deliver(rule, event)));
    } catch (err) {
      console.error('Failed to dispatch notification event:', err);
    }
  }
}

export const notificationDispatchService = new NotificationDispatchService();
