import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  updateDoc,
  where
} from 'firebase/firestore';
import { db } from '../firebase';

/**
 * - `inapp`: shown inside the app as a pop-up/banner next time the user opens it
 * - `push`:  OS-level push notification, delivered even when the app is closed
 * - `email`: currently paused, see EMAIL_DELIVERY_ENABLED
 */
export type NotificationChannel = 'inapp' | 'email' | 'push';

/**
 * Email delivery is intentionally paused: no mail provider is wired up yet.
 * Flip this to true once the sending backend exists and the email channel
 * becomes selectable again in the UI.
 */
export const EMAIL_DELIVERY_ENABLED = false;

export type NotificationEventType =
  | 'daily_shop_analysis'
  | 'repair_needed'
  | 'equipment_moved'
  | 'timecard_submitted'
  | 'service_due';

export type NotificationScopeType = 'all' | 'sites' | 'users';

export type NotificationFrequency = 'immediate' | 'daily' | 'weekly';

export interface NotificationEventDefinition {
  type: NotificationEventType;
  label: string;
  description: string;
  /** Frequencies that make sense for this event, in preferred order. */
  frequencies: NotificationFrequency[];
  /** Scopes this event can be narrowed by. */
  scopes: NotificationScopeType[];
}

/**
 * Catalog of everything a user can subscribe to. Adding an entry here is all
 * that is required for it to appear in the Manage Notifications UI.
 */
export const NOTIFICATION_EVENTS: NotificationEventDefinition[] = [
  {
    type: 'daily_shop_analysis',
    label: 'Shop analysis digest',
    description: 'Summary of shop reports and equipment condition.',
    frequencies: ['daily', 'weekly'],
    scopes: ['all', 'sites', 'users']
  },
  {
    type: 'repair_needed',
    label: 'Unit flagged for repair',
    description: 'A unit has been reported as needing repair.',
    frequencies: ['immediate', 'daily', 'weekly'],
    scopes: ['all', 'sites', 'users']
  },
  {
    type: 'equipment_moved',
    label: 'Equipment moved in inventory',
    description: 'A unit has been transferred between sites.',
    frequencies: ['immediate', 'daily', 'weekly'],
    scopes: ['all', 'sites', 'users']
  },
  {
    type: 'service_due',
    label: 'Service due or overdue',
    description: 'A unit has reached a scheduled service interval.',
    frequencies: ['daily', 'weekly'],
    scopes: ['all', 'sites']
  },
  {
    type: 'timecard_submitted',
    label: 'Timecard submitted',
    description: 'A timecard has been submitted and locked.',
    frequencies: ['immediate', 'daily'],
    scopes: ['all', 'sites', 'users']
  }
];

export function getEventDefinition(type: NotificationEventType): NotificationEventDefinition {
  return NOTIFICATION_EVENTS.find(e => e.type === type) ?? NOTIFICATION_EVENTS[0];
}

export interface NotificationRule {
  id: string;
  /** The user who receives this notification. */
  ownerUserId: string;
  ownerUserName: string;
  name: string;
  eventType: NotificationEventType;
  channels: NotificationChannel[];
  scopeType: NotificationScopeType;
  /** Site names, when scopeType is 'sites'. Empty otherwise. */
  siteNames: string[];
  /** User ids whose activity triggers the rule, when scopeType is 'users'. */
  subjectUserIds: string[];
  frequency: NotificationFrequency;
  /** 'HH:mm' local send time. Ignored for immediate rules. */
  timeOfDay: string;
  /** 0 = Sunday. Only used for weekly rules. */
  dayOfWeek: number;
  /**
   * `Date.getTimezoneOffset()` of whoever saved the rule, so the scheduler
   * (which runs in UTC) can work out when `timeOfDay` falls due.
   */
  utcOffsetMinutes: number;
  isActive: boolean;
  /** ISO timestamp of the last digest sent for this rule. Set by the scheduler. */
  lastDigestAt: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

/**
 * Default offset for rules saved before the field existed: UTC-7, the timezone
 * the company operates in.
 */
export const DEFAULT_UTC_OFFSET_MINUTES = 420;

export type NotificationRuleInput = Omit<
  NotificationRule,
  'id' | 'createdAt' | 'updatedAt' | 'lastDigestAt'
>;

export function describeRule(rule: NotificationRule, userNameById: Record<string, string>): string {
  const event = getEventDefinition(rule.eventType);

  let scope: string;
  if (rule.scopeType === 'sites') {
    scope = rule.siteNames.length ? rule.siteNames.join(', ') : 'no sites selected';
  } else if (rule.scopeType === 'users') {
    scope = rule.subjectUserIds.length
      ? rule.subjectUserIds.map(id => userNameById[id] ?? 'Unknown user').join(', ')
      : 'no users selected';
  } else {
    scope = 'all sites';
  }

  let cadence: string;
  if (rule.frequency === 'immediate') {
    cadence = 'as it happens';
  } else if (rule.frequency === 'weekly') {
    const days = ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays'];
    cadence = `${days[rule.dayOfWeek] ?? 'Mondays'} at ${rule.timeOfDay}`;
  } else {
    cadence = `daily at ${rule.timeOfDay}`;
  }

  const channelLabels: Record<NotificationChannel, string> = {
    inapp: 'in-app',
    push: 'push',
    email: 'email'
  };

  const channels = rule.channels.length
    ? rule.channels.map(c => channelLabels[c] ?? c).join(' + ')
    : 'no channels';

  return `${event.label} for ${scope}, ${cadence}, via ${channels}`;
}

class NotificationRuleService {
  private readonly collectionName = 'notificationRules';

  private toRule(id: string, data: any): NotificationRule {
    return {
      id,
      ownerUserId: data.ownerUserId ?? '',
      ownerUserName: data.ownerUserName ?? '',
      name: data.name ?? '',
      eventType: data.eventType ?? 'daily_shop_analysis',
      channels: data.channels ?? [],
      scopeType: data.scopeType ?? 'all',
      siteNames: data.siteNames ?? [],
      subjectUserIds: data.subjectUserIds ?? [],
      frequency: data.frequency ?? 'daily',
      timeOfDay: data.timeOfDay ?? '07:00',
      dayOfWeek: data.dayOfWeek ?? 1,
      utcOffsetMinutes: data.utcOffsetMinutes ?? DEFAULT_UTC_OFFSET_MINUTES,
      isActive: data.isActive ?? true,
      lastDigestAt: data.lastDigestAt ?? '',
      createdAt: data.createdAt ?? '',
      updatedAt: data.updatedAt ?? '',
      createdBy: data.createdBy ?? ''
    };
  }

  async getRulesForUser(ownerUserId: string): Promise<NotificationRule[]> {
    const q = query(collection(db, this.collectionName), where('ownerUserId', '==', ownerUserId));
    const snapshot = await getDocs(q);
    return snapshot.docs
      .map(d => this.toRule(d.id, d.data()))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async getAllRules(): Promise<NotificationRule[]> {
    const q = query(collection(db, this.collectionName), orderBy('ownerUserName'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => this.toRule(d.id, d.data()));
  }

  async createRule(input: NotificationRuleInput): Promise<string> {
    const now = new Date().toISOString();
    const docRef = await addDoc(collection(db, this.collectionName), {
      ...input,
      lastDigestAt: '',
      createdAt: now,
      updatedAt: now
    });
    return docRef.id;
  }

  async updateRule(id: string, updates: Partial<NotificationRuleInput>): Promise<void> {
    await updateDoc(doc(db, this.collectionName, id), {
      ...updates,
      updatedAt: new Date().toISOString()
    });
  }

  async deleteRule(id: string): Promise<void> {
    await deleteDoc(doc(db, this.collectionName, id));
  }
}

export const notificationRuleService = new NotificationRuleService();
