import { afterEach, describe, expect, it, vi } from 'vitest';
import { timecardService, TimeEntry } from './timecardService';

vi.mock('../firebase', () => ({ db: {} }));
vi.mock('./userManagementService', () => ({
  UserManagementService: class {
    getAllUsers = vi.fn().mockResolvedValue([]);
  }
}));
vi.mock('./fleetManagementService', () => ({ fleetManagementService: {} }));
vi.mock('./notificationDispatchService', () => ({
  notificationDispatchService: { emit: vi.fn().mockResolvedValue(undefined) }
}));

const draft: TimeEntry = {
  id: 'card', userId: 'owner', date: new Date(2026, 10, 18),
  clockIn: new Date(2026, 10, 18, 8), clockOut: new Date(2026, 10, 18, 16),
  hours: 8, status: 'draft', isLocked: false,
  createdAt: new Date(), updatedAt: new Date()
};

afterEach(() => vi.restoreAllMocks());

describe('submitTimeEntry', () => {
  it('saves current form edits and submission status in one update', async () => {
    vi.spyOn(timecardService, 'getTimeEntry').mockResolvedValue(draft);
    const update = vi.spyOn(timecardService, 'updateTimeEntry').mockResolvedValue();
    const edits = {
      clockIn: new Date(2026, 10, 18, 15), clockOut: new Date(2026, 10, 18, 17),
      hours: 2, travelHours: 0.5, job: 'Updated site',
      workEntries: [{ id: 'work', notes: 'Updated work', labourHours: 2 }]
    };
    await timecardService.submitTimeEntry('card', 'original-submitter', edits);
    expect(update).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith('card', expect.objectContaining({
      ...edits, userId: 'owner', status: 'submitted', isLocked: true,
      submittedBy: 'original-submitter', submittedAt: expect.any(Date)
    }));
  });

  it('preserves ownership and the original submitter over form values', async () => {
    vi.spyOn(timecardService, 'getTimeEntry').mockResolvedValue({ ...draft, submittedBy: 'original' });
    const update = vi.spyOn(timecardService, 'updateTimeEntry').mockResolvedValue();
    await timecardService.submitTimeEntry('card', 'supervisor', {
      userId: 'different-owner', submittedBy: 'different-submitter', status: 'draft', isLocked: false
    });
    expect(update).toHaveBeenCalledWith('card', expect.objectContaining({
      userId: 'owner', submittedBy: 'original', status: 'submitted', isLocked: true
    }));
  });

  it('still submits saved cards without form edits', async () => {
    vi.spyOn(timecardService, 'getTimeEntry').mockResolvedValue(draft);
    const update = vi.spyOn(timecardService, 'updateTimeEntry').mockResolvedValue();
    await timecardService.submitTimeEntry('card');
    expect(update).toHaveBeenCalledWith('card', expect.objectContaining({
      userId: 'owner', status: 'submitted', isLocked: true, submittedBy: 'owner'
    }));
  });
});
