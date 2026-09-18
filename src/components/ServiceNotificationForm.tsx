import { useState } from 'react';
import { AppUser } from '../services/userManagementService';
import { NotificationChannel } from '../services/notificationRuleService';
import {
  ScheduledNotification,
  ScheduledNotificationInput,
  ServiceNotificationAudience,
  ServiceNotificationFrequency
} from '../services/scheduledNotificationService';

/**
 * Create/edit form for scheduled service notifications - recurring reminders
 * sent to an audience on a daily or weekly cadence (e.g. every Wednesday to
 * everyone with a fleet truck assigned).
 */

const inputClass =
  'w-full px-3 py-2 bg-yellow-200 dark:bg-black border border-yellow-600 rounded-lg text-gray-900 dark:text-yellow-100 focus:outline-none focus:ring-2 focus:ring-yellow-500';
const labelClass = 'block text-sm font-medium text-yellow-700 dark:text-yellow-300 mb-1';

const DAY_OPTIONS = [
  [1, 'Monday'],
  [2, 'Tuesday'],
  [3, 'Wednesday'],
  [4, 'Thursday'],
  [5, 'Friday'],
  [6, 'Saturday'],
  [0, 'Sunday']
] as const;

interface ServiceNotificationFormProps {
  users: AppUser[];
  existingSchedule: ScheduledNotification | null;
  createdBy: string;
  onCancel: () => void;
  onSave: (input: ScheduledNotificationInput) => Promise<void>;
}

export function ServiceNotificationForm({
  users,
  existingSchedule,
  createdBy,
  onCancel,
  onSave
}: ServiceNotificationFormProps) {
  const [name, setName] = useState(existingSchedule?.name ?? '');
  const [body, setBody] = useState(existingSchedule?.body ?? '');
  const [audienceType, setAudienceType] = useState<ServiceNotificationAudience>(
    existingSchedule?.audienceType ?? 'fleet'
  );
  const [userIds, setUserIds] = useState<string[]>(existingSchedule?.userIds ?? []);
  const [channels, setChannels] = useState<NotificationChannel[]>(
    existingSchedule?.channels ?? ['inapp']
  );
  const [frequency, setFrequency] = useState<ServiceNotificationFrequency>(
    existingSchedule?.frequency ?? 'weekly'
  );
  const [dayOfWeek, setDayOfWeek] = useState(existingSchedule?.dayOfWeek ?? 3);
  const [timeOfDay, setTimeOfDay] = useState(existingSchedule?.timeOfDay ?? '07:00');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleChannel = (channel: NotificationChannel) => {
    setChannels(prev =>
      prev.includes(channel) ? prev.filter(c => c !== channel) : [...prev, channel]
    );
  };

  const toggleUser = (userId: string) => {
    setUserIds(prev =>
      prev.includes(userId) ? prev.filter(u => u !== userId) : [...prev, userId]
    );
  };

  const handleSubmit = async () => {
    setError(null);
    if (!name.trim()) {
      setError('Give the notification a name');
      return;
    }
    if (!body.trim()) {
      setError('Enter a message for the notification');
      return;
    }
    if (audienceType === 'users' && userIds.length === 0) {
      setError('Pick at least one user');
      return;
    }
    if (channels.length === 0) {
      setError('Select at least one delivery channel');
      return;
    }

    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        body: body.trim(),
        channels,
        audienceType,
        userIds: audienceType === 'users' ? userIds : [],
        frequency,
        timeOfDay,
        dayOfWeek: frequency === 'weekly' ? dayOfWeek : 1,
        utcOffsetMinutes: new Date().getTimezoneOffset(),
        isActive: existingSchedule?.isActive ?? true,
        createdBy: existingSchedule?.createdBy ?? createdBy
      });
    } catch (err: any) {
      setError(err?.message || 'Failed to save notification');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mb-6 p-4 border border-yellow-600 rounded-lg bg-yellow-100 dark:bg-yellow-900 dark:bg-opacity-20">
      <h4 className="text-sm font-semibold text-yellow-700 dark:text-yellow-300 mb-3">
        {existingSchedule ? 'Edit service notification' : 'New service notification'}
      </h4>

      {error && (
        <div className="mb-3 p-2 bg-red-100 dark:bg-red-900 dark:bg-opacity-30 border border-red-600 rounded-lg text-sm text-red-600 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="space-y-3">
        <div>
          <label className={labelClass}>Name</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Weekly truck check"
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass}>Message</label>
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            rows={2}
            placeholder="e.g. Remember to check fluid levels and log any issues on your truck."
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass}>Send to</label>
          <div className="flex flex-wrap gap-4 mb-2">
            {(
              [
                ['all', 'All users'],
                ['fleet', 'Users with a fleet truck'],
                ['users', 'Specific users']
              ] as const
            ).map(([value, label]) => (
              <label
                key={value}
                className="flex items-center gap-2 text-sm text-yellow-700 dark:text-yellow-300"
              >
                <input
                  type="radio"
                  name="serviceAudience"
                  checked={audienceType === value}
                  onChange={() => setAudienceType(value)}
                  className="border-yellow-600 text-yellow-500 focus:ring-yellow-500"
                />
                {label}
              </label>
            ))}
          </div>

          {audienceType === 'fleet' && (
            <p className="text-xs text-yellow-600 dark:text-yellow-500">
              Resolved when the notification sends: anyone whose name is assigned to a unit
              in Fleet at that moment.
            </p>
          )}

          {audienceType === 'users' && (
            <div className="max-h-40 overflow-y-auto border border-yellow-300 dark:border-yellow-800 rounded-lg p-2 space-y-1">
              {users
                .slice()
                .sort((a, b) => a.name.localeCompare(b.name))
                .map(u => (
                  <label
                    key={u.id}
                    className="flex items-center gap-2 text-sm text-yellow-700 dark:text-yellow-300"
                  >
                    <input
                      type="checkbox"
                      checked={userIds.includes(u.id)}
                      onChange={() => toggleUser(u.id)}
                      className="rounded border-yellow-600 text-yellow-500 focus:ring-yellow-500"
                    />
                    {u.name}{' '}
                    <span className="text-yellow-600 dark:text-yellow-500">({u.role})</span>
                  </label>
                ))}
            </div>
          )}
        </div>

        <div>
          <label className={labelClass}>Deliver by</label>
          <div className="flex flex-wrap gap-4">
            {(
              [
                ['inapp', 'In-app pop-up'],
                ['push', 'Push notification'],
                ['email', 'Email']
              ] as const
            ).map(([value, label]) => (
              <label
                key={value}
                className="flex items-center gap-2 text-sm text-yellow-700 dark:text-yellow-300"
              >
                <input
                  type="checkbox"
                  checked={channels.includes(value)}
                  onChange={() => toggleChannel(value)}
                  className="rounded border-yellow-600 text-yellow-500 focus:ring-yellow-500"
                />
                {label}
              </label>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-4">
          <div>
            <label className={labelClass}>Frequency</label>
            <div className="flex gap-4">
              {(
                [
                  ['daily', 'Daily'],
                  ['weekly', 'Weekly']
                ] as const
              ).map(([value, label]) => (
                <label
                  key={value}
                  className="flex items-center gap-2 text-sm text-yellow-700 dark:text-yellow-300"
                >
                  <input
                    type="radio"
                    name="serviceFrequency"
                    checked={frequency === value}
                    onChange={() => setFrequency(value)}
                    className="border-yellow-600 text-yellow-500 focus:ring-yellow-500"
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>

          {frequency === 'weekly' && (
            <div>
              <label className={labelClass}>Day</label>
              <select
                value={dayOfWeek}
                onChange={e => setDayOfWeek(Number(e.target.value))}
                className={inputClass}
              >
                {DAY_OPTIONS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className={labelClass}>Time</label>
            <input
              type="time"
              value={timeOfDay}
              onChange={e => setTimeOfDay(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="px-4 py-2 bg-yellow-600 text-black rounded-lg hover:bg-yellow-500 transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : existingSchedule ? 'Save Changes' : 'Create Notification'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default ServiceNotificationForm;
