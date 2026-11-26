jest.mock('@/lib/firebase', () => ({ db: {} }));
jest.mock('firebase/firestore', () => ({ doc: jest.fn(), setDoc: jest.fn(), serverTimestamp: jest.fn() }));

import { describeLastActive, ONLINE_WINDOW_MS, HEARTBEAT_MS } from '@/lib/presence';

const now = new Date('2026-11-26T15:00:00+08:00').getTime();
const MIN = 60_000;

describe('describeLastActive', () => {
  test('constants', () => {
    expect(ONLINE_WINDOW_MS).toBe(3 * MIN);
    expect(HEARTBEAT_MS).toBe(2 * MIN);
  });

  test('never active', () => {
    expect(describeLastActive(undefined, now)).toEqual({ online: false, label: 'Last active: never' });
  });

  test('active in the last 3 minutes is online', () => {
    expect(describeLastActive(now - MIN, now)).toEqual({ online: true, label: 'Online' });
  });

  test('slightly in the future (clock skew) is online', () => {
    expect(describeLastActive(now + 5000, now).online).toBe(true);
  });

  test('exactly 3 minutes old is not online', () => {
    const r = describeLastActive(now - 3 * MIN, now);
    expect(r.online).toBe(false);
    expect(r.label).toMatch(/^Last active 3 minutes ago/);
  });

  test('hours ago shows relative time plus date and time', () => {
    const r = describeLastActive(now - 3 * 60 * MIN, now);
    expect(r.online).toBe(false);
    expect(r.label).toMatch(/^Last active 3 hours ago \(26 Nov, 12:00\s?pm\)$/i);
  });

  test('days ago', () => {
    expect(describeLastActive(now - 2 * 24 * 60 * MIN, now).label).toMatch(/^Last active 2 days ago \(24 Nov,/);
  });

  test('singular units', () => {
    expect(describeLastActive(now - 60 * MIN, now).label).toMatch(/^Last active 1 hour ago/);
    expect(describeLastActive(now - 24 * 60 * MIN, now).label).toMatch(/^Last active 1 day ago/);
  });
});

describe('startPresenceHeartbeat', () => {
  const { setDoc } = jest.requireMock('firebase/firestore') as { setDoc: jest.Mock };
  let visibility: DocumentVisibilityState = 'visible';
  beforeAll(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility }); });
  beforeEach(() => { jest.useFakeTimers(); setDoc.mockReset().mockResolvedValue(undefined); visibility = 'visible'; });
  afterEach(() => jest.useRealTimers());

  test('writes now, then every 2 minutes, and stops on cleanup', () => {
    const { startPresenceHeartbeat } = jest.requireActual('@/lib/presence');
    const stop = startPresenceHeartbeat('v1');
    expect(setDoc).toHaveBeenCalledTimes(1);
    expect(setDoc.mock.calls[0][2]).toEqual({ merge: true });
    jest.advanceTimersByTime(HEARTBEAT_MS);
    expect(setDoc).toHaveBeenCalledTimes(2);
    stop();
    jest.advanceTimersByTime(HEARTBEAT_MS * 3);
    expect(setDoc).toHaveBeenCalledTimes(2);
  });

  test('skips while hidden, writes at once when visible again', () => {
    const { startPresenceHeartbeat } = jest.requireActual('@/lib/presence');
    visibility = 'hidden';
    const stop = startPresenceHeartbeat('v1');
    jest.advanceTimersByTime(HEARTBEAT_MS * 2);
    expect(setDoc).not.toHaveBeenCalled();
    visibility = 'visible';
    document.dispatchEvent(new Event('visibilitychange'));
    expect(setDoc).toHaveBeenCalledTimes(1);
    stop();
  });
});
