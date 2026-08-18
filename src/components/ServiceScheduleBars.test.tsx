// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ServiceScheduleBars } from './ServiceScheduleBars';
import { ServiceDueState, dayNumber } from '../services/serviceScheduleService';

afterEach(cleanup);

function state(overrides: Partial<ServiceDueState> & { intervalId: string }): ServiceDueState {
  return {
    name: overrides.intervalId,
    unit: 'hours',
    interval: 500,
    anchor: 'rolling',
    status: 'ok',
    current: 100,
    lastDoneAt: 0,
    lastDoneDate: '2026-01-01',
    dueAt: 500,
    notifyAt: 450,
    remaining: 400,
    progressPct: 20,
    notifyPct: 90,
    ...overrides,
  };
}

describe('ServiceScheduleBars', () => {
  it('renders nothing when there are no intervals', () => {
    const { container } = render(<ServiceScheduleBars states={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows one row per interval instead of a single blended bar', () => {
    render(
      <ServiceScheduleBars
        states={[state({ intervalId: 'a', name: '500 Hr' }), state({ intervalId: 'b', name: '1000 Hr' })]}
        initiallyExpanded={2}
      />
    );
    expect(screen.getAllByText('500 Hr').length).toBeGreaterThan(0);
    expect(screen.getAllByText('1000 Hr').length).toBeGreaterThan(0);
  });

  it('orders the most urgent interval first', () => {
    render(
      <ServiceScheduleBars
        states={[
          state({ intervalId: 'ok', name: 'Healthy', status: 'ok' }),
          state({ intervalId: 'late', name: 'Late One', status: 'overdue', remaining: -100 }),
        ]}
        initiallyExpanded={1}
      />
    );
    // Only the single most urgent row is expanded, so the overdue one must win.
    expect(screen.getByText('100 hrs over')).toBeTruthy();
    expect(screen.queryByText('400 hrs left')).toBeNull();
  });

  it('collapses extra intervals behind a disclosure and expands on click', async () => {
    render(
      <ServiceScheduleBars
        states={[
          state({ intervalId: 'a', name: 'A', remaining: 10 }),
          state({ intervalId: 'b', name: 'B', remaining: 20 }),
          state({ intervalId: 'c', name: 'C', remaining: 30 }),
        ]}
        initiallyExpanded={1}
      />
    );

    const toggle = screen.getByRole('button', { name: /Show 2 more intervals/ });
    expect(screen.queryByText('20 hrs left')).toBeNull();

    await userEvent.click(toggle);

    expect(screen.getByText('20 hrs left')).toBeTruthy();
    expect(screen.getByText('30 hrs left')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Show less/ })).toBeTruthy();
  });

  it('uses the singular form for a single hidden interval', () => {
    render(
      <ServiceScheduleBars
        states={[state({ intervalId: 'a' }), state({ intervalId: 'b' })]}
        initiallyExpanded={1}
      />
    );
    expect(screen.getByRole('button', { name: /Show 1 more interval$/ })).toBeTruthy();
  });

  it('flags an overdue interval and reports how far past it is', () => {
    render(
      <ServiceScheduleBars
        states={[state({ intervalId: 'a', status: 'overdue', remaining: -250 })]}
      />
    );
    expect(screen.getByText('OVERDUE')).toBeTruthy();
    expect(screen.getByText('250 hrs over')).toBeTruthy();
  });

  it('asks for a baseline instead of drawing a misleading bar', () => {
    render(
      <ServiceScheduleBars
        states={[
          state({
            intervalId: 'a',
            status: 'no-baseline',
            dueAt: null,
            remaining: null,
            notifyAt: null,
          }),
        ]}
      />
    );
    expect(screen.getByText(/Log a service card for this interval/)).toBeTruthy();
    expect(screen.getByText('—')).toBeTruthy();
  });

  it('fills the bar to the reported progress, not to a colour gradient', () => {
    const { container } = render(
      <ServiceScheduleBars states={[state({ intervalId: 'a', progressPct: 42, status: 'ok' })]} />
    );
    const fill = container.querySelector('.bg-green-500') as HTMLElement;
    expect(fill).toBeTruthy();
    expect(fill.style.width).toBe('42%');
  });

  it('colours by status even when progress is low', () => {
    const { container } = render(
      <ServiceScheduleBars
        states={[state({ intervalId: 'a', progressPct: 12, status: 'overdue' })]}
      />
    );
    // The old bar keyed colour off position, so an overdue interval could read green.
    expect(container.querySelector('.bg-red-800')).toBeTruthy();
    expect(container.querySelector('.bg-green-500')).toBeNull();
  });

  it('places the warning marker only when it falls inside the bar', () => {
    const { container: inside } = render(
      <ServiceScheduleBars states={[state({ intervalId: 'a', notifyPct: 90 })]} />
    );
    const marker = inside.querySelector('[title^="Warning at"]') as HTMLElement;
    expect(marker).toBeTruthy();
    expect(marker.style.left).toBe('90%');

    cleanup();

    const { container: outside } = render(
      <ServiceScheduleBars states={[state({ intervalId: 'a', notifyPct: 100 })]} />
    );
    expect(outside.querySelector('[title^="Warning at"]')).toBeNull();
  });

  it('reads day based intervals as calendar dates rather than meters', () => {
    const due = dayNumber('2026-06-01T00:00:00Z');
    render(
      <ServiceScheduleBars
        states={[
          state({
            intervalId: 'annual',
            name: 'Annual Inspection',
            unit: 'days',
            dueAt: due,
            current: dayNumber('2026-05-01T00:00:00Z'),
            remaining: 31,
          }),
        ]}
      />
    );
    expect(screen.getByText('31 days left')).toBeTruthy();
    const expected = new Date(due * 86400000).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    });
    expect(screen.getByText(`Due: ${expected}`)).toBeTruthy();
  });
});
