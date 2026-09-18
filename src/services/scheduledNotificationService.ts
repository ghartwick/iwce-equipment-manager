import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  updateDoc
} from 'firebase/firestore';
import { db } from '../firebase';
import { NotificationChannel } from './notificationRuleService';

/**
 * Scheduled service notifications: admin-defined reminders that fire on a
 * cadence (daily / weekly) to an audience, independent of any event. Example:
 * "Every Wednesday, remind everyone with a fleet truck to check their unit."
 *
 * Delivery happens server-side in api/notifications/run.ts on the hourly cron;
 * this service is just the CRUD side for the management UI.
 */

export type ServiceNotificationAudience = 'all' | 'fleet' | 'users';
export type ServiceNotificationFrequency = 'daily' | 'weekly';

export interface ScheduledNotification {
  id: string;
  /** Label shown in the list; also used as the notification title. */
  name: string;
  /** Message body sent to recipients. */
  body: string;
  channels: NotificationChannel[];
  /**
   * 'all'   - every active user
   * 'fleet' - users whose name is assigned on a fleetEquipment unit
   * 'users' - the picked userIds below
   */
  audienceType: ServiceNotificationAudience;
  /** Recipient user ids when audienceType is 'users'. */
  userIds: string[];
  frequency: ServiceNotificationFrequency;
  /** 'HH:mm' local send time. */
  timeOfDay: string;
  /** 0 = Sunday. Only used for weekly schedules. */
  dayOfWeek: number;
  /**
   * `Date.getTimezoneOffset()` of whoever saved the schedule, so the cron
   * (which runs in UTC) can work out when `timeOfDay` falls due.
   */
  utcOffsetMinutes: number;
  isActive: boolean;
  /** ISO timestamp of the last send. Set by the scheduler; double-send guard. */
  lastSentAt: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export type ScheduledNotificationInput = Omit<
  ScheduledNotification,
  'id' | 'createdAt' | 'updatedAt' | 'lastSentAt'
>;

const DAY_NAMES = [
  'Sundays',
  'Mondays',
  'Tuesdays',
  'Wednesdays',
  'Thursdays',
  'Fridays',
  'Saturdays'
];

export function describeSchedule(
  schedule: ScheduledNotification,
  userNameById: Record<string, string>
): string {
  let audience: string;
  if (schedule.audienceType === 'fleet') {
    audience = 'users with a fleet truck';
  } else if (schedule.audienceType === 'users') {
    audience = schedule.userIds.length
      ? schedule.userIds.map(id => userNameById[id] ?? 'Unknown user').join(', ')
      : 'no users selected';
  } else {
    audience = 'all users';
  }

  const cadence =
    schedule.frequency === 'weekly'
      ? `every ${DAY_NAMES[schedule.dayOfWeek] ?? 'Monday'} at ${schedule.timeOfDay}`
      : `daily at ${schedule.timeOfDay}`;

  const channelLabels: Record<NotificationChannel, string> = {
    inapp: 'in-app',
    push: 'push',
    email: 'email'
  };
  const channels = schedule.channels.length
    ? schedule.channels.map(c => channelLabels[c] ?? c).join(' + ')
    : 'no channels';

  return `To ${audience}, ${cadence}, via ${channels}`;
}

class ScheduledNotificationService {
  private readonly collectionName = 'scheduledNotifications';

  private toSchedule(id: string, data: any): ScheduledNotification {
    return {
      id,
      name: data.name ?? '',
      body: data.body ?? '',
      channels: data.channels ?? [],
      audienceType: data.audienceType ?? 'all',
      userIds: data.userIds ?? [],
      frequency: data.frequency ?? 'weekly',
      timeOfDay: data.timeOfDay ?? '07:00',
      dayOfWeek: data.dayOfWeek ?? 1,
      utcOffsetMinutes: data.utcOffsetMinutes ?? 420,
      isActive: data.isActive ?? true,
      lastSentAt: data.lastSentAt ?? '',
      createdAt: data.createdAt ?? '',
      updatedAt: data.updatedAt ?? '',
      createdBy: data.createdBy ?? ''
    };
  }

  async getAll(): Promise<ScheduledNotification[]> {
    const q = query(collection(db, this.collectionName), orderBy('name'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => this.toSchedule(d.id, d.data()));
  }

  async create(input: ScheduledNotificationInput): Promise<string> {
    const now = new Date().toISOString();
    const docRef = await addDoc(collection(db, this.collectionName), {
      ...input,
      lastSentAt: '',
      createdAt: now,
      updatedAt: now
    });
    return docRef.id;
  }

  async update(id: string, updates: Partial<ScheduledNotificationInput>): Promise<void> {
    await updateDoc(doc(db, this.collectionName, id), {
      ...updates,
      updatedAt: new Date().toISOString()
    });
  }

  async delete(id: string): Promise<void> {
    await deleteDoc(doc(db, this.collectionName, id));
  }
}

export const scheduledNotificationService = new ScheduledNotificationService();
