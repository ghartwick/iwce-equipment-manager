import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Bell, BellRing, Clock, Edit2, History, Plus, Send, Smartphone, Trash2, X } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { AppUser, userManagementService } from '../services/userManagementService';
import { Site, siteManagementService } from '../services/siteManagementService';
import {
  EMAIL_DELIVERY_ENABLED,
  NotificationRule,
  NotificationRuleInput,
  describeRule,
  notificationRuleService
} from '../services/notificationRuleService';
import {
  PushDevice,
  PushPermission,
  isPushConfigured,
  pushNotificationService
} from '../services/pushNotificationService';
import { inAppNotificationService } from '../services/inAppNotificationService';
import {
  ManualNotificationChannel,
  sendManualNotification
} from '../services/notificationDispatchService';
import { NotificationRuleForm } from '../components/NotificationRuleForm';
import {
  NotificationHistoryEntry,
  notificationHistoryService
} from '../services/notificationHistoryService';
import {
  ScheduledNotification,
  ScheduledNotificationInput,
  describeSchedule,
  scheduledNotificationService
} from '../services/scheduledNotificationService';
import { ServiceNotificationForm } from '../components/ServiceNotificationForm';

const inputClass =
  'w-full px-3 py-2 bg-yellow-200 dark:bg-black border border-yellow-600 rounded-lg text-gray-900 dark:text-yellow-100 focus:outline-none focus:ring-2 focus:ring-yellow-500';
const labelClass = 'block text-sm font-medium text-yellow-700 dark:text-yellow-300 mb-1';

export default function NotificationManagementPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [users, setUsers] = useState<AppUser[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [rules, setRules] = useState<NotificationRule[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingRule, setEditingRule] = useState<NotificationRule | null>(null);
  const [emailDraft, setEmailDraft] = useState('');
  const [savingEmail, setSavingEmail] = useState(false);
  const [devices, setDevices] = useState<PushDevice[]>([]);
  const [pushPermission, setPushPermission] = useState<PushPermission>('default');
  const [enrolling, setEnrolling] = useState(false);

  // Manual broadcast composer (admin only)
  const [sendBody, setSendBody] = useState('');
  const [audience, setAudience] = useState<'all' | 'roles' | 'users'>('all');
  const [audienceRoles, setAudienceRoles] = useState<string[]>([]);
  const [audienceUserIds, setAudienceUserIds] = useState<string[]>([]);
  const [sendChannels, setSendChannels] = useState<ManualNotificationChannel[]>(['inapp']);
  const [sending, setSending] = useState(false);
  const [sendSummary, setSendSummary] = useState<string | null>(null);

  // Notification history
  const [showHistory, setShowHistory] = useState(false);
  const [historyEntries, setHistoryEntries] = useState<NotificationHistoryEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Scheduled service notifications (admin only)
  const [schedules, setSchedules] = useState<ScheduledNotification[]>([]);
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<ScheduledNotification | null>(null);

  const owner = useMemo(
    () => users.find(u => u.id === selectedUserId) ?? null,
    [users, selectedUserId]
  );

  const userNameById = useMemo(
    () => Object.fromEntries(users.map(u => [u.id, u.name])),
    [users]
  );

  useEffect(() => {
    const load = async () => {
      try {
        const [usersData, sitesData] = await Promise.all([
          userManagementService.getAllUsers(),
          siteManagementService.getAllSites()
        ]);
        setUsers(usersData.filter(u => u.isActive));
        setSites(sitesData.filter(s => s.isActive).sort((a, b) => a.name.localeCompare(b.name)));
        setSelectedUserId(user?.id ?? '');
        if (user?.role === 'admin') {
          setSchedules(await scheduledNotificationService.getAll());
        }
      } catch (err: any) {
        setError(err?.message || 'Failed to load notification settings');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user?.id]);

  useEffect(() => {
    if (!selectedUserId) return;
    setEmailDraft(users.find(u => u.id === selectedUserId)?.email ?? '');
    setShowForm(false);
    setEditingRule(null);
    loadRules(selectedUserId);
    loadDevices(selectedUserId);
    // Intentionally keyed on selectedUserId only: refreshing `users` after an
    // email save must not close an open rule form.
  }, [selectedUserId]);

  useEffect(() => {
    pushNotificationService.getPermissionState().then(setPushPermission);
  }, []);

  const loadRules = async (ownerUserId: string) => {
    try {
      setRules(await notificationRuleService.getRulesForUser(ownerUserId));
    } catch (err: any) {
      setError(err?.message || 'Failed to load notifications');
    }
  };

  const loadDevices = async (ownerUserId: string) => {
    try {
      setDevices(await pushNotificationService.getDevicesForUser(ownerUserId));
    } catch (err: any) {
      setError(err?.message || 'Failed to load push devices');
    }
  };

  const handleEnablePush = async () => {
    if (!owner) return;
    setEnrolling(true);
    setError(null);
    try {
      await pushNotificationService.enrollCurrentDevice(owner.id, owner.name);
      setPushPermission(await pushNotificationService.getPermissionState());
      await loadDevices(owner.id);
      setSuccess('This device will now receive push notifications');
    } catch (err: any) {
      setError(err?.message || 'Failed to enable push notifications');
    } finally {
      setEnrolling(false);
    }
  };

  const handleRemoveDevice = async (device: PushDevice) => {
    if (!window.confirm(`Stop sending push notifications to "${device.label}"?`)) return;
    try {
      await pushNotificationService.removeDevice(device.token);
      setDevices(prev => prev.filter(d => d.token !== device.token));
      setSuccess('Device removed');
    } catch (err: any) {
      setError(err?.message || 'Failed to remove device');
    }
  };

  const handleTestPush = async () => {
    try {
      await pushNotificationService.sendTestNotification();
    } catch (err: any) {
      setError(err?.message || 'Failed to show test notification');
    }
  };

  const handleTestInApp = async () => {
    if (!owner) return;
    try {
      await inAppNotificationService.create({
        userId: owner.id,
        title: 'Test in-app notification',
        body: 'In-app notifications are working. This is what a pop-up looks like.',
        eventType: 'test'
      });
      setSuccess(
        owner.id === user?.id
          ? 'Test queued. The pop-up appears right away, or next time you open the app.'
          : `Test queued for ${owner.name}. They will see it next time they open the app.`
      );
    } catch (err: any) {
      setError(err?.message || 'Failed to queue in-app notification');
    }
  };

  const handleSaveEmail = async () => {
    if (!owner) return;
    setSavingEmail(true);
    setError(null);
    try {
      await userManagementService.updateUser(owner.id, { email: emailDraft.trim() });
      setUsers(prev => prev.map(u => (u.id === owner.id ? { ...u, email: emailDraft.trim() } : u)));
      setSuccess('Delivery email saved');
    } catch (err: any) {
      setError(err?.message || 'Failed to save email');
    } finally {
      setSavingEmail(false);
    }
  };

  const resolveAudience = (): AppUser[] => {
    if (audience === 'all') return users;
    if (audience === 'roles') return users.filter(u => audienceRoles.includes(u.role));
    return users.filter(u => audienceUserIds.includes(u.id));
  };

  const toggleSendChannel = (channel: ManualNotificationChannel) => {
    setSendChannels(prev =>
      prev.includes(channel) ? prev.filter(c => c !== channel) : [...prev, channel]
    );
  };

  const toggleAudienceRole = (role: string) => {
    setAudienceRoles(prev =>
      prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]
    );
  };

  const toggleAudienceUser = (userId: string) => {
    setAudienceUserIds(prev =>
      prev.includes(userId) ? prev.filter(u => u !== userId) : [...prev, userId]
    );
  };

  const handleSendManual = async () => {
    if (!user) return;
    setError(null);
    setSendSummary(null);

    const recipients = resolveAudience();
    if (!sendBody.trim()) {
      setError('Enter a message for the notification');
      return;
    }
    if (recipients.length === 0) {
      setError('No recipients match the selected audience');
      return;
    }
    if (sendChannels.length === 0) {
      setError('Select at least one delivery channel');
      return;
    }

    setSending(true);
    try {
      const res = await sendManualNotification({
        senderUserId: user.id,
        userIds: recipients.map(r => r.id),
        title: `Message from ${user.name}`,
        body: sendBody.trim(),
        channels: sendChannels
      });

      const pushSent = res.results.reduce((n, r) => n + (r.sent ?? 0), 0);
      const emailSent = res.results.filter(r => r.emailSent).length;
      const emailMissing = res.results.filter(
        r => r.emailReason === 'no email address on file'
      ).length;
      const emailFailed = res.results.filter(
        r => r.emailReason && r.emailReason !== 'no email address on file'
      ).length;
      const failed = res.results.filter(r => !r.ok).length;

      const parts = [`Delivered to ${res.delivered}/${res.recipients} user(s)`];
      if (sendChannels.includes('push')) parts.push(`push: ${pushSent} device(s)`);
      if (sendChannels.includes('email')) {
        parts.push(
          `email: ${emailSent} sent` +
            (emailMissing ? `, ${emailMissing} missing address` : '') +
            (emailFailed ? `, ${emailFailed} failed` : '')
        );
      }
      if (failed) parts.push(`${failed} recipient(s) failed`);

      setSendSummary(parts.join(' \u00b7 '));
      setSendBody('');
    } catch (err: any) {
      setError(err?.message || 'Failed to send notification');
    } finally {
      setSending(false);
    }
  };

  const handleOpenHistory = async () => {
    setShowHistory(true);
    setLoadingHistory(true);
    try {
      // Admins see every send; other users see what was sent to them.
      const entries = await notificationHistoryService.getHistory(
        isAdmin ? undefined : user?.id
      );
      setHistoryEntries(entries);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleSaveSchedule = async (input: ScheduledNotificationInput) => {
    if (editingSchedule) {
      await scheduledNotificationService.update(editingSchedule.id, input);
      setSuccess('Service notification updated');
    } else {
      await scheduledNotificationService.create(input);
      setSuccess('Service notification created');
    }
    setShowScheduleForm(false);
    setEditingSchedule(null);
    setSchedules(await scheduledNotificationService.getAll());
  };

  const handleToggleSchedule = async (schedule: ScheduledNotification) => {
    try {
      await scheduledNotificationService.update(schedule.id, { isActive: !schedule.isActive });
      setSchedules(prev =>
        prev.map(s => (s.id === schedule.id ? { ...s, isActive: !s.isActive } : s))
      );
    } catch (err: any) {
      setError(err?.message || 'Failed to update service notification');
    }
  };

  const handleDeleteSchedule = async (schedule: ScheduledNotification) => {
    if (!window.confirm(`Delete service notification "${schedule.name}"?`)) return;
    try {
      await scheduledNotificationService.delete(schedule.id);
      setSchedules(prev => prev.filter(s => s.id !== schedule.id));
      setSuccess('Service notification deleted');
    } catch (err: any) {
      setError(err?.message || 'Failed to delete service notification');
    }
  };

  const handleSaveRule = async (input: NotificationRuleInput) => {
    if (editingRule) {
      await notificationRuleService.updateRule(editingRule.id, input);
      setSuccess('Notification updated');
    } else {
      await notificationRuleService.createRule(input);
      setSuccess('Notification created');
    }
    setShowForm(false);
    setEditingRule(null);
    await loadRules(input.ownerUserId);
  };

  const handleToggleActive = async (rule: NotificationRule) => {
    try {
      await notificationRuleService.updateRule(rule.id, { isActive: !rule.isActive });
      setRules(prev => prev.map(r => (r.id === rule.id ? { ...r, isActive: !r.isActive } : r)));
    } catch (err: any) {
      setError(err?.message || 'Failed to update notification');
    }
  };

  const handleDeleteRule = async (rule: NotificationRule) => {
    if (!window.confirm(`Delete notification "${rule.name}"?`)) return;
    try {
      await notificationRuleService.deleteRule(rule.id);
      setRules(prev => prev.filter(r => r.id !== rule.id));
      setSuccess('Notification deleted');
    } catch (err: any) {
      setError(err?.message || 'Failed to delete notification');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-yellow-100 dark:bg-black text-gray-900 dark:text-yellow-100 px-2 sm:px-4 py-4 -mx-2 sm:-mx-4 lg:mx-0 lg:p-2">
        <div className="max-w-5xl mx-auto">
          <div className="bg-yellow-200 dark:bg-black border border-yellow-600 rounded-lg p-6">
            <div className="text-yellow-600 dark:text-yellow-400">Loading notifications...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-yellow-100 dark:bg-black text-gray-900 dark:text-yellow-100 px-2 sm:px-4 py-4 -mx-2 sm:-mx-4 lg:mx-0 lg:p-2">
      <div className="max-w-5xl mx-auto">
        <div className="bg-yellow-200 dark:bg-black border border-yellow-600 rounded-lg shadow-xl dark:shadow-yellow-900/20 dark:shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-yellow-700 dark:bg-yellow-900 dark:bg-opacity-30 px-6 py-4 border-b border-yellow-300 dark:border-yellow-700 flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate(-1)}
                className="p-2 text-yellow-100 dark:text-yellow-400 hover:text-yellow-200 dark:hover:text-yellow-300 transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <h2 className="text-xl font-semibold text-yellow-100 dark:text-yellow-300">
                Manage Notifications
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleOpenHistory}
                className="flex items-center space-x-2 px-4 py-2 border border-yellow-600 text-yellow-100 dark:text-yellow-300 rounded-lg hover:bg-yellow-600 hover:text-black transition-colors"
              >
                <History className="h-4 w-4" />
                <span>History</span>
              </button>
              {isAdmin && (
                <button
                  onClick={() => {
                    setEditingRule(null);
                    setShowForm(true);
                  }}
                  className="flex items-center space-x-2 px-4 py-2 bg-yellow-600 text-black rounded-lg hover:bg-yellow-500 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  <span>Add Notification</span>
                </button>
              )}
            </div>
          </div>

          <div className="p-6">
            {error && (
              <div className="mb-4 p-3 bg-red-100 dark:bg-red-900 dark:bg-opacity-30 border border-red-600 rounded-lg text-red-600 dark:text-red-300">
                {error}
              </div>
            )}
            {success && (
              <div className="mb-4 p-3 bg-green-100 dark:bg-green-900 dark:bg-opacity-30 border border-green-600 rounded-lg text-green-700 dark:text-green-300">
                {success}
              </div>
            )}

            <div className="mb-6 p-3 bg-yellow-100/60 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-800 rounded-lg text-sm text-yellow-700 dark:text-yellow-400">
              In-app and push notifications are active. Email sends through Resend &mdash; set
              <code> RESEND_API_KEY</code> and <code>EMAIL_FROM</code> in the Vercel env vars, and
              make sure each recipient has a delivery email saved below.
            </div>

            {/* Manual broadcast composer (admin only) */}
            {isAdmin && (
              <div className="mb-6 p-4 border border-yellow-300 dark:border-yellow-800 rounded-lg">
                <h3 className="text-sm font-semibold text-yellow-700 dark:text-yellow-300 flex items-center gap-2 mb-3">
                  <Send className="h-4 w-4" /> Send a notification
                </h3>

                <div className="space-y-3">
                  <div>
                    <label className={labelClass}>Message</label>
                    <textarea
                      value={sendBody}
                      onChange={e => setSendBody(e.target.value)}
                      rows={2}
                      placeholder="Details shown in the notification body"
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>Send to</label>
                    <div className="flex flex-wrap gap-4 mb-2">
                      {(
                        [
                          ['all', 'All users'],
                          ['roles', 'A group (by role)'],
                          ['users', 'Specific users']
                        ] as const
                      ).map(([value, label]) => (
                        <label
                          key={value}
                          className="flex items-center gap-2 text-sm text-yellow-700 dark:text-yellow-300"
                        >
                          <input
                            type="radio"
                            name="audience"
                            checked={audience === value}
                            onChange={() => setAudience(value)}
                            className="border-yellow-600 text-yellow-500 focus:ring-yellow-500"
                          />
                          {label}
                        </label>
                      ))}
                    </div>

                    {audience === 'roles' && (
                      <div className="flex flex-wrap gap-4 border border-yellow-300 dark:border-yellow-800 rounded-lg p-2">
                        {(['admin', 'supervisor', 'field'] as const).map(role => (
                          <label
                            key={role}
                            className="flex items-center gap-2 text-sm text-yellow-700 dark:text-yellow-300 capitalize"
                          >
                            <input
                              type="checkbox"
                              checked={audienceRoles.includes(role)}
                              onChange={() => toggleAudienceRole(role)}
                              className="rounded border-yellow-600 text-yellow-500 focus:ring-yellow-500"
                            />
                            {role} ({users.filter(u => u.role === role).length})
                          </label>
                        ))}
                      </div>
                    )}

                    {audience === 'users' && (
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
                                checked={audienceUserIds.includes(u.id)}
                                onChange={() => toggleAudienceUser(u.id)}
                                className="rounded border-yellow-600 text-yellow-500 focus:ring-yellow-500"
                              />
                              {u.name} <span className="text-yellow-600 dark:text-yellow-500">({u.role})</span>
                            </label>
                          ))}
                      </div>
                    )}

                    <p className="mt-1 text-xs text-yellow-600 dark:text-yellow-500">
                      {resolveAudience().length} recipient(s) selected
                      {sendChannels.includes('email') &&
                        resolveAudience().filter(u => !u.email?.trim()).length > 0 &&
                        ` \u2014 ${resolveAudience().filter(u => !u.email?.trim()).length} have no email on file`}
                    </p>
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
                            checked={sendChannels.includes(value)}
                            onChange={() => toggleSendChannel(value)}
                            className="rounded border-yellow-600 text-yellow-500 focus:ring-yellow-500"
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                  </div>

                  {sendSummary && (
                    <div className="p-3 bg-green-100 dark:bg-green-900 dark:bg-opacity-30 border border-green-600 rounded-lg text-sm text-green-700 dark:text-green-300">
                      {sendSummary}
                    </div>
                  )}

                  <div>
                    <button
                      type="button"
                      onClick={handleSendManual}
                      disabled={sending}
                      className="flex items-center gap-2 px-4 py-2 bg-yellow-600 text-black rounded-lg hover:bg-yellow-500 transition-colors disabled:opacity-50"
                    >
                      <Send className="h-4 w-4" />
                      {sending ? 'Sending...' : 'Send Notification'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Scheduled service notifications (admin only) */}
            {isAdmin && (
              <div className="mb-6 p-4 border border-yellow-300 dark:border-yellow-800 rounded-lg">
                <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                  <h3 className="text-sm font-semibold text-yellow-700 dark:text-yellow-300 flex items-center gap-2">
                    <Clock className="h-4 w-4" /> Service notifications
                  </h3>
                  {!showScheduleForm && (
                    <button
                      onClick={() => {
                        setEditingSchedule(null);
                        setShowScheduleForm(true);
                      }}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm bg-yellow-600 text-black rounded-lg hover:bg-yellow-500 transition-colors"
                    >
                      <Plus className="h-4 w-4" />
                      Add Service Notification
                    </button>
                  )}
                </div>
                <p className="text-sm text-yellow-600 dark:text-yellow-500 mb-3">
                  Recurring reminders sent on a schedule &mdash; e.g. every Wednesday to everyone
                  with a fleet truck assigned.
                </p>

                {showScheduleForm && (
                  <ServiceNotificationForm
                    users={users}
                    existingSchedule={editingSchedule}
                    createdBy={user?.username ?? ''}
                    onCancel={() => {
                      setShowScheduleForm(false);
                      setEditingSchedule(null);
                    }}
                    onSave={handleSaveSchedule}
                  />
                )}

                {schedules.length === 0 && !showScheduleForm ? (
                  <p className="text-sm text-yellow-600 dark:text-yellow-500">
                    No service notifications set up yet.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {schedules.map(schedule => (
                      <div
                        key={schedule.id}
                        className="flex items-start justify-between gap-3 p-3 bg-yellow-50 dark:bg-yellow-900 dark:bg-opacity-20 border border-yellow-300 dark:border-yellow-800 rounded-lg"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-gray-900 dark:text-yellow-100">
                              {schedule.name}
                            </span>
                            <span
                              className={`px-2 py-0.5 text-xs rounded-full ${
                                schedule.isActive
                                  ? 'bg-green-100 dark:bg-green-900 dark:bg-opacity-30 text-green-700 dark:text-green-400'
                                  : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                              }`}
                            >
                              {schedule.isActive ? 'Active' : 'Paused'}
                            </span>
                          </div>
                          <p className="text-sm text-yellow-700 dark:text-yellow-500 mt-0.5">
                            {describeSchedule(schedule, userNameById)}
                          </p>
                          {schedule.body && (
                            <p className="text-xs text-yellow-600 dark:text-yellow-600 mt-0.5">
                              {schedule.body}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            onClick={() => handleToggleSchedule(schedule)}
                            className="px-2 py-1 text-xs text-yellow-700 dark:text-yellow-400 hover:text-yellow-500"
                            title={schedule.isActive ? 'Pause notification' : 'Resume notification'}
                          >
                            {schedule.isActive ? 'Pause' : 'Resume'}
                          </button>
                          <button
                            onClick={() => {
                              setEditingSchedule(schedule);
                              setShowScheduleForm(true);
                            }}
                            className="p-1 text-yellow-600 hover:text-yellow-500"
                            title="Edit service notification"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteSchedule(schedule)}
                            className="p-1 text-red-600 hover:text-red-500"
                            title="Delete service notification"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Admin user switcher */}
            {isAdmin && (
              <div className="mb-6">
                <label className={labelClass}>Managing notifications for</label>
                <select
                  value={selectedUserId}
                  onChange={e => setSelectedUserId(e.target.value)}
                  className={inputClass}
                >
                  {users
                    .slice()
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map(u => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                        {u.id === user?.id ? ' (you)' : ''} — {u.role}
                      </option>
                    ))}
                </select>
              </div>
            )}

            {/* In-app notifications */}
            {owner && (
              <div className="mb-6 p-4 border border-yellow-300 dark:border-yellow-800 rounded-lg">
                <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
                  <h3 className="text-sm font-semibold text-yellow-700 dark:text-yellow-300 flex items-center gap-2">
                    <BellRing className="h-4 w-4" /> In-app pop-ups
                  </h3>
                  <button
                    onClick={handleTestInApp}
                    className="px-3 py-1.5 text-sm text-yellow-700 dark:text-yellow-400 border border-yellow-600 rounded-lg hover:bg-yellow-100 dark:hover:bg-yellow-900/30 transition-colors"
                  >
                    Send Test
                  </button>
                </div>
                <p className="text-sm text-yellow-600 dark:text-yellow-500">
                  Always on, nothing to enable. Notifications appear as a pop-up while the app is
                  open, and anything that arrives beforehand is shown the next time it is opened.
                  Unread items stay on the bell in the header.
                </p>
              </div>
            )}

            {/* Push devices */}
            {owner && (
              <div className="mb-6 p-4 border border-yellow-300 dark:border-yellow-800 rounded-lg">
                <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
                  <h3 className="text-sm font-semibold text-yellow-700 dark:text-yellow-300 flex items-center gap-2">
                    <Smartphone className="h-4 w-4" /> Push devices for {owner.name}
                  </h3>
                  <div className="flex items-center gap-2">
                    {pushPermission === 'granted' && (
                      <button
                        onClick={handleTestPush}
                        className="px-3 py-1.5 text-sm text-yellow-700 dark:text-yellow-400 border border-yellow-600 rounded-lg hover:bg-yellow-100 dark:hover:bg-yellow-900/30 transition-colors"
                      >
                        Send Test
                      </button>
                    )}
                    <button
                      onClick={handleEnablePush}
                      disabled={enrolling || !isPushConfigured() || pushPermission === 'unsupported'}
                      className="px-3 py-1.5 text-sm bg-yellow-600 text-black rounded-lg hover:bg-yellow-500 transition-colors disabled:opacity-50"
                    >
                      {enrolling ? 'Enabling...' : 'Enable On This Device'}
                    </button>
                  </div>
                </div>

                {!isPushConfigured() && (
                  <p className="text-sm text-red-600 dark:text-red-400 mb-2">
                    Push is not configured. Add <code>VITE_FIREBASE_VAPID_KEY</code> to your
                    environment (Firebase Console &rarr; Project settings &rarr; Cloud Messaging &rarr;
                    Web Push certificates) and restart the dev server.
                  </p>
                )}
                {pushPermission === 'unsupported' && (
                  <p className="text-sm text-red-600 dark:text-red-400 mb-2">
                    This browser does not support web push notifications.
                  </p>
                )}
                {pushPermission === 'denied' && (
                  <p className="text-sm text-red-600 dark:text-red-400 mb-2">
                    Notifications are blocked for this site. Allow them in your browser settings,
                    then enable this device again.
                  </p>
                )}
                {isAdmin && owner.id !== user?.id && (
                  <p className="text-sm text-yellow-600 dark:text-yellow-500 mb-2">
                    &quot;Enable On This Device&quot; registers the browser you are using right now
                    against {owner.name}. Have them enable it on their own device instead.
                  </p>
                )}

                {devices.length === 0 ? (
                  <p className="text-sm text-yellow-600 dark:text-yellow-500">
                    No devices enrolled yet. Push notifications will not be delivered until at least
                    one device is enabled.
                  </p>
                ) : (
                  <ul className="space-y-1">
                    {devices.map(device => (
                      <li
                        key={device.token}
                        className="flex items-center justify-between gap-2 text-sm text-yellow-700 dark:text-yellow-300"
                      >
                        <span>
                          {device.label}
                          {device.isCurrentDevice && (
                            <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                              This device
                            </span>
                          )}
                        </span>
                        <button
                          onClick={() => handleRemoveDevice(device)}
                          className="p-1 text-red-600 hover:text-red-500"
                          title="Remove device"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* Delivery email - stored now, used once email delivery resumes */}
            {owner && (
              <div className="mb-6">
                <label className={labelClass}>
                  Delivery email for {owner.name}
                  {!EMAIL_DELIVERY_ENABLED && (
                    <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                      Paused
                    </span>
                  )}
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="email"
                    value={emailDraft}
                    onChange={e => setEmailDraft(e.target.value)}
                    placeholder="name@example.com"
                    className={`${inputClass} flex-1`}
                  />
                  <button
                    onClick={handleSaveEmail}
                    disabled={savingEmail || emailDraft.trim() === (owner.email ?? '')}
                    className="px-4 py-2 bg-yellow-600 text-black rounded-lg hover:bg-yellow-500 transition-colors whitespace-nowrap disabled:opacity-50"
                  >
                    {savingEmail ? 'Saving...' : 'Save Email'}
                  </button>
                </div>
                {!EMAIL_DELIVERY_ENABLED && (
                  <p className="mt-1 text-xs text-yellow-600 dark:text-yellow-500">
                    Saved for later. No email is sent while email delivery is paused.
                  </p>
                )}
              </div>
            )}

            {/* Rule form */}
            {showForm && owner && (
              <NotificationRuleForm
                owner={owner}
                sites={sites}
                users={users}
                existingRule={editingRule}
                createdBy={user?.username ?? ''}
                onCancel={() => {
                  setShowForm(false);
                  setEditingRule(null);
                }}
                onSave={handleSaveRule}
              />
            )}

            {/* Rules list */}
            <h3 className="text-lg font-medium text-yellow-700 dark:text-yellow-300 mb-3">
              Notifications
            </h3>
            {rules.length === 0 ? (
              <div className="text-center py-8 text-yellow-600 dark:text-yellow-400">
                <Bell className="h-8 w-8 mx-auto mb-2 opacity-60" />
                No notifications set up yet.
              </div>
            ) : (
              <div className="space-y-2">
                {rules.map(rule => (
                  <div
                    key={rule.id}
                    className="flex items-start justify-between gap-3 p-3 bg-yellow-50 dark:bg-yellow-900 dark:bg-opacity-20 border border-yellow-300 dark:border-yellow-800 rounded-lg"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-gray-900 dark:text-yellow-100">
                          {rule.name}
                        </span>
                        <span
                          className={`px-2 py-0.5 text-xs rounded-full ${
                            rule.isActive
                              ? 'bg-green-100 dark:bg-green-900 dark:bg-opacity-30 text-green-700 dark:text-green-400'
                              : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                          }`}
                        >
                          {rule.isActive ? 'Active' : 'Paused'}
                        </span>
                      </div>
                      <p className="text-sm text-yellow-700 dark:text-yellow-500 mt-0.5">
                        {describeRule(rule, userNameById)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => handleToggleActive(rule)}
                        className="px-2 py-1 text-xs text-yellow-700 dark:text-yellow-400 hover:text-yellow-500"
                        title={rule.isActive ? 'Pause notification' : 'Resume notification'}
                      >
                        {rule.isActive ? 'Pause' : 'Resume'}
                      </button>
                      {isAdmin && (
                        <>
                          <button
                            onClick={() => {
                              setEditingRule(rule);
                              setShowForm(true);
                            }}
                            className="p-1 text-yellow-600 hover:text-yellow-500"
                            title="Edit notification"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteRule(rule)}
                            className="p-1 text-red-600 hover:text-red-500"
                            title="Delete notification"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Notification history modal */}
      {showHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 p-4">
          <div className="w-full max-w-2xl max-h-[80vh] flex flex-col bg-yellow-50 dark:bg-gray-900 border border-yellow-600 rounded-lg shadow-xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-yellow-600">
              <h3 className="text-lg font-semibold text-yellow-700 dark:text-yellow-300 flex items-center gap-2">
                <History className="h-5 w-5" /> Notification History
              </h3>
              <button
                onClick={() => setShowHistory(false)}
                className="p-1 text-yellow-700 dark:text-yellow-400 hover:text-yellow-500"
                title="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="overflow-y-auto p-4 space-y-2">
              {loadingHistory ? (
                <p className="text-sm text-yellow-600 dark:text-yellow-500">Loading history...</p>
              ) : historyEntries.length === 0 ? (
                <p className="text-sm text-yellow-600 dark:text-yellow-500">
                  No notifications have been sent yet.
                </p>
              ) : (
                historyEntries.map(entry => (
                  <div
                    key={entry.id}
                    className="p-3 border border-yellow-300 dark:border-yellow-800 rounded-lg"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 dark:text-yellow-100">
                          {entry.title}
                        </p>
                        {entry.body && (
                          <p className="text-sm text-yellow-700 dark:text-yellow-400 mt-0.5">
                            {entry.body}
                          </p>
                        )}
                      </div>
                      <span className="text-xs text-yellow-600 dark:text-yellow-500 whitespace-nowrap flex-shrink-0">
                        {new Date(entry.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-yellow-600 dark:text-yellow-500">
                      <span>
                        To:{' '}
                        <span className="text-yellow-700 dark:text-yellow-300">
                          {userNameById[entry.userId] ?? 'Unknown user'}
                        </span>
                      </span>
                      {entry.senderUserId && (
                        <span>
                          From:{' '}
                          <span className="text-yellow-700 dark:text-yellow-300">
                            {userNameById[entry.senderUserId] ?? 'Unknown user'}
                          </span>
                        </span>
                      )}
                      <span className="flex gap-1">
                        {entry.channels.map(c => (
                          <span
                            key={c}
                            className="px-1.5 py-0.5 bg-yellow-200 dark:bg-yellow-900 dark:bg-opacity-40 rounded text-yellow-800 dark:text-yellow-300"
                          >
                            {c}
                          </span>
                        ))}
                      </span>
                      {entry.channels.includes('push') && (
                        <span>
                          push: {entry.pushSent} sent
                          {entry.pushFailed > 0 && `, ${entry.pushFailed} failed`}
                          {entry.reason === 'no enrolled devices' && ' (no devices)'}
                        </span>
                      )}
                      {entry.channels.includes('email') && (
                        <span>
                          email:{' '}
                          {entry.emailSent
                            ? 'sent'
                            : entry.emailReason || 'not sent'}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
