import React, { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { AppUser } from '../services/userManagementService';
import { Site } from '../services/siteManagementService';
import {
  EMAIL_DELIVERY_ENABLED,
  NOTIFICATION_EVENTS,
  NotificationChannel,
  NotificationEventType,
  NotificationFrequency,
  NotificationRule,
  NotificationRuleInput,
  NotificationScopeType,
  getEventDefinition
} from '../services/notificationRuleService';

const inputClass =
  'w-full px-3 py-2 bg-yellow-200 dark:bg-black border border-yellow-600 rounded-lg text-gray-900 dark:text-yellow-100 focus:outline-none focus:ring-2 focus:ring-yellow-500';
const labelClass = 'block text-sm font-medium text-yellow-700 dark:text-yellow-300 mb-1';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const SCOPE_LABELS: Record<NotificationScopeType, string> = {
  all: 'Everything',
  sites: 'Specific sites',
  users: 'Specific users'
};

const FREQUENCY_LABELS: Record<NotificationFrequency, string> = {
  immediate: 'As it happens',
  daily: 'Daily digest',
  weekly: 'Weekly digest'
};

interface NotificationRuleFormProps {
  owner: AppUser;
  sites: Site[];
  users: AppUser[];
  existingRule: NotificationRule | null;
  createdBy: string;
  onCancel: () => void;
  onSave: (input: NotificationRuleInput) => Promise<void>;
}

export function NotificationRuleForm({
  owner,
  sites,
  users,
  existingRule,
  createdBy,
  onCancel,
  onSave
}: NotificationRuleFormProps) {
  const [name, setName] = useState(existingRule?.name ?? '');
  const [eventType, setEventType] = useState<NotificationEventType>(
    existingRule?.eventType ?? 'daily_shop_analysis'
  );
  const [channels, setChannels] = useState<NotificationChannel[]>(existingRule?.channels ?? ['push']);
  const [scopeType, setScopeType] = useState<NotificationScopeType>(existingRule?.scopeType ?? 'all');
  const [siteNames, setSiteNames] = useState<string[]>(existingRule?.siteNames ?? []);
  const [subjectUserIds, setSubjectUserIds] = useState<string[]>(existingRule?.subjectUserIds ?? []);
  const [frequency, setFrequency] = useState<NotificationFrequency>(existingRule?.frequency ?? 'daily');
  const [timeOfDay, setTimeOfDay] = useState(existingRule?.timeOfDay ?? '07:00');
  const [dayOfWeek, setDayOfWeek] = useState(existingRule?.dayOfWeek ?? 1);
  const [isActive, setIsActive] = useState(existingRule?.isActive ?? true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const definition = useMemo(() => getEventDefinition(eventType), [eventType]);

  // While email delivery is paused, the channel is never persisted even if an
  // older rule still carries it.
  const effectiveChannels = useMemo(
    () => (EMAIL_DELIVERY_ENABLED ? channels : channels.filter(c => c !== 'email')),
    [channels]
  );

  const handleEventChange = (next: NotificationEventType) => {
    const nextDefinition = getEventDefinition(next);
    setEventType(next);
    if (!nextDefinition.frequencies.includes(frequency)) {
      setFrequency(nextDefinition.frequencies[0]);
    }
    if (!nextDefinition.scopes.includes(scopeType)) {
      setScopeType(nextDefinition.scopes[0]);
    }
  };

  const toggleChannel = (channel: NotificationChannel) => {
    setChannels(prev =>
      prev.includes(channel) ? prev.filter(c => c !== channel) : [...prev, channel]
    );
  };

  const toggleSite = (siteName: string) => {
    setSiteNames(prev =>
      prev.includes(siteName) ? prev.filter(s => s !== siteName) : [...prev, siteName]
    );
  };

  const toggleSubjectUser = (userId: string) => {
    setSubjectUserIds(prev =>
      prev.includes(userId) ? prev.filter(u => u !== userId) : [...prev, userId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setError('Give this notification a name');
      return;
    }
    if (effectiveChannels.length === 0) {
      setError('Select at least one delivery channel');
      return;
    }
    if (EMAIL_DELIVERY_ENABLED && channels.includes('email') && !owner.email?.trim()) {
      setError(`${owner.name} has no email address on file. Add one before enabling email delivery.`);
      return;
    }
    if (scopeType === 'sites' && siteNames.length === 0) {
      setError('Select at least one site');
      return;
    }
    if (scopeType === 'users' && subjectUserIds.length === 0) {
      setError('Select at least one user');
      return;
    }

    setError(null);
    setSaving(true);
    try {
      await onSave({
        ownerUserId: owner.id,
        ownerUserName: owner.name,
        name: name.trim(),
        eventType,
        channels: effectiveChannels,
        scopeType,
        siteNames: scopeType === 'sites' ? siteNames : [],
        subjectUserIds: scopeType === 'users' ? subjectUserIds : [],
        frequency,
        timeOfDay: frequency === 'immediate' ? '' : timeOfDay,
        dayOfWeek: frequency === 'weekly' ? dayOfWeek : 1,
        isActive,
        createdBy
      });
    } catch (err: any) {
      setError(err?.message || 'Failed to save notification');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900 dark:bg-opacity-20 border border-yellow-300 dark:border-yellow-700 rounded-lg">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-yellow-700 dark:text-yellow-300">
          {existingRule ? 'Edit Notification' : 'New Notification'}
        </h3>
        <button
          type="button"
          onClick={onCancel}
          className="p-1 text-yellow-600 hover:text-yellow-500"
          title="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-100 dark:bg-red-900 dark:bg-opacity-30 border border-red-600 rounded-lg text-red-600 dark:text-red-300">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Morning shop digest"
              className={inputClass}
              required
            />
          </div>
          <div>
            <label className={labelClass}>Notify me about</label>
            <select
              value={eventType}
              onChange={e => handleEventChange(e.target.value as NotificationEventType)}
              className={inputClass}
            >
              {NOTIFICATION_EVENTS.map(event => (
                <option key={event.type} value={event.type}>
                  {event.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-yellow-600 dark:text-yellow-500">{definition.description}</p>
          </div>
        </div>

        {/* Channels */}
        <div>
          <label className={labelClass}>Deliver by</label>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm text-yellow-700 dark:text-yellow-300">
              <input
                type="checkbox"
                checked={channels.includes('push')}
                onChange={() => toggleChannel('push')}
                className="rounded border-yellow-600 text-yellow-500 focus:ring-yellow-500"
              />
              Push notification
            </label>
            <label
              className={`flex items-center gap-2 text-sm ${
                EMAIL_DELIVERY_ENABLED
                  ? 'text-yellow-700 dark:text-yellow-300'
                  : 'text-gray-400 dark:text-gray-500 cursor-not-allowed'
              }`}
              title={EMAIL_DELIVERY_ENABLED ? undefined : 'Email delivery is paused'}
            >
              <input
                type="checkbox"
                disabled={!EMAIL_DELIVERY_ENABLED}
                checked={EMAIL_DELIVERY_ENABLED && channels.includes('email')}
                onChange={() => toggleChannel('email')}
                className="rounded border-yellow-600 text-yellow-500 focus:ring-yellow-500 disabled:opacity-50"
              />
              {EMAIL_DELIVERY_ENABLED
                ? `Email ${owner.email ? `(${owner.email})` : '(no address on file)'}`
                : 'Email (paused)'}
            </label>
          </div>
        </div>

        {/* Scope */}
        <div>
          <label className={labelClass}>Limit to</label>
          <div className="flex flex-wrap gap-4 mb-2">
            {definition.scopes.map(scope => (
              <label key={scope} className="flex items-center gap-2 text-sm text-yellow-700 dark:text-yellow-300">
                <input
                  type="radio"
                  name="scopeType"
                  checked={scopeType === scope}
                  onChange={() => setScopeType(scope)}
                  className="border-yellow-600 text-yellow-500 focus:ring-yellow-500"
                />
                {SCOPE_LABELS[scope]}
              </label>
            ))}
          </div>

          {scopeType === 'sites' && (
            <div className="max-h-48 overflow-y-auto border border-yellow-300 dark:border-yellow-800 rounded-lg p-2 space-y-1">
              {sites.length === 0 ? (
                <p className="text-sm text-yellow-600 dark:text-yellow-500">No sites available.</p>
              ) : (
                sites.map(site => (
                  <label
                    key={site.id}
                    className="flex items-center gap-2 text-sm text-yellow-700 dark:text-yellow-300"
                  >
                    <input
                      type="checkbox"
                      checked={siteNames.includes(site.name)}
                      onChange={() => toggleSite(site.name)}
                      className="rounded border-yellow-600 text-yellow-500 focus:ring-yellow-500"
                    />
                    {site.name}
                  </label>
                ))
              )}
            </div>
          )}

          {scopeType === 'users' && (
            <div className="max-h-48 overflow-y-auto border border-yellow-300 dark:border-yellow-800 rounded-lg p-2 space-y-1">
              {users.length === 0 ? (
                <p className="text-sm text-yellow-600 dark:text-yellow-500">No users available.</p>
              ) : (
                users.map(u => (
                  <label
                    key={u.id}
                    className="flex items-center gap-2 text-sm text-yellow-700 dark:text-yellow-300"
                  >
                    <input
                      type="checkbox"
                      checked={subjectUserIds.includes(u.id)}
                      onChange={() => toggleSubjectUser(u.id)}
                      className="rounded border-yellow-600 text-yellow-500 focus:ring-yellow-500"
                    />
                    {u.name}
                  </label>
                ))
              )}
            </div>
          )}
        </div>

        {/* Schedule */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className={labelClass}>How often</label>
            <select
              value={frequency}
              onChange={e => setFrequency(e.target.value as NotificationFrequency)}
              className={inputClass}
            >
              {definition.frequencies.map(f => (
                <option key={f} value={f}>
                  {FREQUENCY_LABELS[f]}
                </option>
              ))}
            </select>
          </div>
          {frequency !== 'immediate' && (
            <div>
              <label className={labelClass}>Send at</label>
              <input
                type="time"
                value={timeOfDay}
                onChange={e => setTimeOfDay(e.target.value)}
                className={inputClass}
              />
            </div>
          )}
          {frequency === 'weekly' && (
            <div>
              <label className={labelClass}>Day of week</label>
              <select
                value={dayOfWeek}
                onChange={e => setDayOfWeek(Number(e.target.value))}
                className={inputClass}
              >
                {DAY_NAMES.map((day, index) => (
                  <option key={day} value={index}>
                    {day}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <label className="flex items-center gap-2 text-sm text-yellow-700 dark:text-yellow-300">
          <input
            type="checkbox"
            checked={isActive}
            onChange={e => setIsActive(e.target.checked)}
            className="rounded border-yellow-600 text-yellow-500 focus:ring-yellow-500"
          />
          Active
        </label>

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-yellow-500 text-black rounded-lg hover:bg-yellow-600 transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : existingRule ? 'Update Notification' : 'Add Notification'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
