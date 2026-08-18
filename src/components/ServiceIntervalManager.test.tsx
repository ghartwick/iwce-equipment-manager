// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ServiceIntervalManager } from './ServiceIntervalManager';
import { ServiceIntervalDef, ServiceIntervalOverride } from '../types';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const template: ServiceIntervalDef = {
  id: 'cat-500',
  name: '500 Hr Service',
  interval: 500,
  unit: 'hours',
  notifyLead: 50,
  anchor: 'rolling',
  isActive: true,
};

const unitOwn: ServiceIntervalDef = {
  id: 'unit-track',
  name: 'Track Tension',
  interval: 250,
  unit: 'hours',
  notifyLead: 25,
  anchor: 'rolling',
  isActive: true,
};

function setup(props: Partial<React.ComponentProps<typeof ServiceIntervalManager>> = {}) {
  const onSaveCategoryIntervals = vi.fn().mockResolvedValue(undefined);
  const onSaveUnitIntervals = vi.fn().mockResolvedValue(undefined);
  const onSaveOverrides = vi.fn().mockResolvedValue(undefined);

  render(
    <ServiceIntervalManager
      categoryName="Excavators"
      categoryIntervals={[template]}
      unitIntervals={[]}
      overrides={{}}
      canEditCategory
      onSaveCategoryIntervals={onSaveCategoryIntervals}
      onSaveUnitIntervals={onSaveUnitIntervals}
      onSaveOverrides={onSaveOverrides}
      {...props}
    />
  );

  return { onSaveCategoryIntervals, onSaveUnitIntervals, onSaveOverrides };
}

describe('ServiceIntervalManager — provenance', () => {
  it('labels inherited and unit-specific intervals distinctly', () => {
    setup({ unitIntervals: [unitOwn] });
    expect(screen.getByText('500 Hr Service')).toBeTruthy();
    expect(screen.getByText('Category')).toBeTruthy();
    expect(screen.getByText('Track Tension')).toBeTruthy();
    expect(screen.getByText('This unit')).toBeTruthy();
  });

  it('summarises the cadence, warning lead and anchor', () => {
    setup({
      categoryIntervals: [{ ...template, anchor: 'fixed' }],
    });
    expect(
      screen.getByText(/Every 500 hours · warn 50 hours before · fixed schedule/)
    ).toBeTruthy();
  });

  it('marks an overridden inherited interval and shows its local values', () => {
    const overrides: Record<string, ServiceIntervalOverride> = {
      'cat-500': { interval: 400 },
    };
    setup({ overrides });
    expect(screen.getByText('Overridden here')).toBeTruthy();
    expect(screen.getByText(/Every 400 hours/)).toBeTruthy();
  });

  it('keeps a disabled inherited interval visible so it can be re-enabled', () => {
    setup({ overrides: { 'cat-500': { disabled: true } } });
    expect(screen.getByText('Disabled on this unit')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Enable here/ })).toBeTruthy();
  });

  it('hides category-wide editing from users without permission', () => {
    setup({ canEditCategory: false });
    expect(screen.queryByRole('button', { name: /Edit for all units/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Delete from category/ })).toBeNull();
    expect(screen.getByRole('button', { name: /Edit for this unit/ })).toBeTruthy();
  });
});

describe('ServiceIntervalManager — validation', () => {
  it('rejects a nameless interval and blocks saving', async () => {
    setup();
    await userEvent.click(screen.getByRole('button', { name: /Add Service Interval/ }));

    expect(screen.getByText('Give the interval a name.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Save' }).hasAttribute('disabled')).toBe(true);
  });

  it('requires an interval greater than zero', async () => {
    setup();
    await userEvent.click(screen.getByRole('button', { name: /Add Service Interval/ }));
    await userEvent.type(screen.getByPlaceholderText(/^Name/), 'Oil');
    await userEvent.type(screen.getByPlaceholderText('500'), '0');

    expect(screen.getByText('Interval must be greater than zero.')).toBeTruthy();
  });

  it('refuses a warning lead that is not smaller than the interval', async () => {
    setup();
    await userEvent.click(screen.getByRole('button', { name: /Add Service Interval/ }));
    await userEvent.type(screen.getByPlaceholderText(/^Name/), 'Oil');
    await userEvent.type(screen.getByPlaceholderText('500'), '500');
    await userEvent.type(screen.getByPlaceholderText('50'), '500');

    expect(screen.getByText('Notify lead must be smaller than the interval.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Save' }).hasAttribute('disabled')).toBe(true);
  });
});

describe('ServiceIntervalManager — saving', () => {
  it('adds a new interval to the unit only', async () => {
    const { onSaveUnitIntervals, onSaveCategoryIntervals } = setup({ canEditCategory: false });
    await userEvent.click(screen.getByRole('button', { name: /Add Service Interval/ }));
    await userEvent.type(screen.getByPlaceholderText(/^Name/), 'Hydraulic Filter');
    await userEvent.type(screen.getByPlaceholderText('500'), '750');
    await userEvent.type(screen.getByPlaceholderText('50'), '75');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(onSaveUnitIntervals).toHaveBeenCalledTimes(1));
    const [saved] = onSaveUnitIntervals.mock.calls[0];
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({
      name: 'Hydraulic Filter',
      interval: 750,
      notifyLead: 75,
      unit: 'hours',
      anchor: 'rolling',
      isActive: true,
    });
    expect(saved[0].id).toBeTruthy();
    expect(onSaveCategoryIntervals).not.toHaveBeenCalled();
  });

  it('appends to the category template list without dropping existing ones', async () => {
    const { onSaveCategoryIntervals } = setup();
    await userEvent.click(screen.getByRole('button', { name: /Add Service Interval/ }));
    await userEvent.type(screen.getByPlaceholderText(/^Name/), 'Annual Inspection');
    await userEvent.type(screen.getByPlaceholderText('500'), '365');
    await userEvent.selectOptions(screen.getByDisplayValue('Hours'), 'days');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(onSaveCategoryIntervals).toHaveBeenCalledTimes(1));
    const [saved] = onSaveCategoryIntervals.mock.calls[0];
    expect(saved.map((d: ServiceIntervalDef) => d.name)).toEqual([
      '500 Hr Service',
      'Annual Inspection',
    ]);
    expect(saved[1].unit).toBe('days');
  });

  it('writes an override when a template is edited for this unit alone', async () => {
    const { onSaveOverrides, onSaveCategoryIntervals } = setup();
    await userEvent.click(screen.getByRole('button', { name: /Edit for this unit/ }));
    expect(screen.getByText(/Saving creates an override for this unit/)).toBeTruthy();

    const intervalInput = screen.getByDisplayValue('500');
    await userEvent.clear(intervalInput);
    await userEvent.type(intervalInput, '400');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(onSaveOverrides).toHaveBeenCalledTimes(1));
    expect(onSaveOverrides.mock.calls[0][0]).toEqual({
      'cat-500': {
        name: '500 Hr Service',
        interval: 400,
        unit: 'hours',
        notifyLead: 50,
        anchor: 'rolling',
      },
    });
    expect(onSaveCategoryIntervals).not.toHaveBeenCalled();
  });

  it('edits the shared template in place when changing it for all units', async () => {
    const { onSaveCategoryIntervals, onSaveOverrides } = setup();
    await userEvent.click(screen.getByRole('button', { name: /Edit for all units/ }));

    const intervalInput = screen.getByDisplayValue('500');
    await userEvent.clear(intervalInput);
    await userEvent.type(intervalInput, '600');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(onSaveCategoryIntervals).toHaveBeenCalledTimes(1));
    const [saved] = onSaveCategoryIntervals.mock.calls[0];
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ id: 'cat-500', interval: 600 });
    expect(onSaveOverrides).not.toHaveBeenCalled();
  });

  it('does not offer a scope choice when editing an existing interval', async () => {
    setup();
    await userEvent.click(screen.getByRole('button', { name: /Edit for this unit/ }));
    expect(screen.queryByText('Applies to')).toBeNull();
  });
});

describe('ServiceIntervalManager — disable, reset and delete', () => {
  it('disables an inherited interval for this unit without touching the template', async () => {
    const { onSaveOverrides, onSaveCategoryIntervals } = setup();
    await userEvent.click(screen.getByRole('button', { name: /Disable here/ }));

    await waitFor(() => expect(onSaveOverrides).toHaveBeenCalledTimes(1));
    expect(onSaveOverrides.mock.calls[0][0]).toEqual({ 'cat-500': { disabled: true } });
    expect(onSaveCategoryIntervals).not.toHaveBeenCalled();
  });

  it('re-enables a disabled interval', async () => {
    const { onSaveOverrides } = setup({ overrides: { 'cat-500': { disabled: true } } });
    await userEvent.click(screen.getByRole('button', { name: /Enable here/ }));

    await waitFor(() => expect(onSaveOverrides).toHaveBeenCalledTimes(1));
    expect(onSaveOverrides.mock.calls[0][0]).toEqual({ 'cat-500': { disabled: false } });
  });

  it('drops the local override on reset, leaving other overrides intact', async () => {
    const { onSaveOverrides } = setup({
      categoryIntervals: [template, { ...template, id: 'cat-1000', name: '1000 Hr Service' }],
      overrides: { 'cat-500': { interval: 400 }, 'cat-1000': { interval: 900 } },
    });
    await userEvent.click(screen.getAllByRole('button', { name: /Reset to category/ })[0]);

    await waitFor(() => expect(onSaveOverrides).toHaveBeenCalledTimes(1));
    expect(onSaveOverrides.mock.calls[0][0]).toEqual({ 'cat-1000': { interval: 900 } });
  });

  it('confirms before removing a unit interval', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { onSaveUnitIntervals } = setup({ unitIntervals: [unitOwn] });

    await userEvent.click(screen.getByRole('button', { name: /Remove/ }));

    await waitFor(() => expect(onSaveUnitIntervals).toHaveBeenCalledTimes(1));
    expect(confirmSpy).toHaveBeenCalled();
    expect(onSaveUnitIntervals.mock.calls[0][0]).toEqual([]);
  });

  it('does not delete when the confirmation is declined', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const { onSaveCategoryIntervals } = setup();

    await userEvent.click(screen.getByRole('button', { name: /Delete from category/ }));

    expect(onSaveCategoryIntervals).not.toHaveBeenCalled();
  });

  it('surfaces a save failure instead of silently discarding the edit', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const onSaveOverrides = vi.fn().mockRejectedValue(new Error('offline'));

    render(
      <ServiceIntervalManager
        categoryName="Excavators"
        categoryIntervals={[template]}
        unitIntervals={[]}
        overrides={{}}
        canEditCategory
        onSaveCategoryIntervals={vi.fn()}
        onSaveUnitIntervals={vi.fn()}
        onSaveOverrides={onSaveOverrides}
      />
    );

    await userEvent.click(screen.getByRole('button', { name: /Disable here/ }));

    await waitFor(() => expect(alertSpy).toHaveBeenCalled());
    // Still interactive after the failure, so the user can retry.
    expect(
      screen.getByRole('button', { name: /Disable here/ }).hasAttribute('disabled')
    ).toBe(false);
  });
});
