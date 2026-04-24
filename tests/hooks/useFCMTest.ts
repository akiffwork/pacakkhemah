/**
 * Unit tests for src/hooks/useFCM.ts
 * Tests push notification registration and error recovery.
 */

import { renderHook } from '@testing-library/react';
import { act } from 'react';

// ─── module mocks (must be hoisted) ───────────────────────────────────────────

const mockGetToken = jest.fn();
const mockOnMessage = jest.fn();
const mockGetMessagingInstance = jest.fn();
const mockUpdateDoc = jest.fn();
const mockDoc = jest.fn().mockReturnValue('doc-ref');

jest.mock('firebase/messaging', () => ({
  getToken: (...args: unknown[]) => mockGetToken(...args),
  onMessage: (...args: unknown[]) => mockOnMessage(...args),
}));

jest.mock('firebase/firestore', () => ({
  doc: (...args: unknown[]) => mockDoc(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
}));

jest.mock('@/lib/firebase', () => ({
  db: {},
  auth: { currentUser: null, onAuthStateChanged: jest.fn() },
  getMessagingInstance: (...args: unknown[]) => mockGetMessagingInstance(...args),
}));

// ─── import hook after mocks are hoisted ─────────────────────────────────────

import { useFCM } from '@/hooks/useFCM';

// ─── browser API mocks ────────────────────────────────────────────────────────

const mockServiceWorkerRegistration = {
  active: { postMessage: jest.fn() },
};

const mockRequestPermission = jest.fn();
const mockNotificationConstructor = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();

  // Default: permission granted
  mockRequestPermission.mockResolvedValue('granted');
  Object.defineProperty(global, 'Notification', {
    writable: true,
    value: Object.assign(mockNotificationConstructor, {
      requestPermission: mockRequestPermission,
      permission: 'granted',
    }),
  });

  // Default: service worker registers successfully
  Object.defineProperty(navigator, 'serviceWorker', {
    writable: true,
    value: {
      register: jest.fn().mockResolvedValue(mockServiceWorkerRegistration),
      ready: Promise.resolve(mockServiceWorkerRegistration),
    },
  });

  // Default: messaging instance available
  mockGetMessagingInstance.mockResolvedValue({});

  // Default: token returned
  mockGetToken.mockResolvedValue('fake-fcm-token');

  // Default: Firestore write succeeds
  mockUpdateDoc.mockResolvedValue(undefined);

  // Default: onMessage does nothing
  mockOnMessage.mockImplementation(() => {});
});

// ─── tests ────────────────────────────────────────────────────────────────────

describe('useFCM', () => {
  test('does nothing when vendorId is null', async () => {
    renderHook(() => useFCM(null));
    // Give effects time to flush
    await act(async () => {});
    expect(mockGetToken).not.toHaveBeenCalled();
  });

  test('does not request token when Notification permission is denied', async () => {
    mockRequestPermission.mockResolvedValue('denied');

    renderHook(() => useFCM('vendor-1'));
    await act(async () => {});

    expect(mockGetToken).not.toHaveBeenCalled();
  });

  test('saves FCM token to Firestore on success', async () => {
    renderHook(() => useFCM('vendor-1'));
    await act(async () => {});

    expect(mockUpdateDoc).toHaveBeenCalledWith(
      'doc-ref',
      expect.objectContaining({ fcmToken: 'fake-fcm-token' })
    );
  });

  test('includes fcmUpdatedAt timestamp when saving token', async () => {
    renderHook(() => useFCM('vendor-1'));
    await act(async () => {});

    const updateArgs = mockUpdateDoc.mock.calls[0][1];
    expect(updateArgs).toHaveProperty('fcmUpdatedAt');
    expect(typeof updateArgs.fcmUpdatedAt).toBe('string');
  });

  test('does not call updateDoc when getToken returns an empty string', async () => {
    mockGetToken.mockResolvedValue('');

    renderHook(() => useFCM('vendor-1'));
    await act(async () => {});

    expect(mockUpdateDoc).not.toHaveBeenCalled();
  });

  test('does not throw when getMessagingInstance returns null', async () => {
    mockGetMessagingInstance.mockResolvedValue(null);

    expect(() => {
      renderHook(() => useFCM('vendor-1'));
    }).not.toThrow();
    await act(async () => {});
    expect(mockGetToken).not.toHaveBeenCalled();
  });

  test('catches and does not rethrow when getToken throws', async () => {
    mockGetToken.mockRejectedValue(new Error('FCM unavailable'));

    expect(() => {
      renderHook(() => useFCM('vendor-1'));
    }).not.toThrow();
    await act(async () => {});
  });

  test('registers foreground message listener after getting token', async () => {
    renderHook(() => useFCM('vendor-1'));
    await act(async () => {});

    expect(mockOnMessage).toHaveBeenCalledTimes(1);
  });

  test('shows a Notification for foreground messages with a title', async () => {
    let messageCallback: ((payload: unknown) => void) | null = null;
    mockOnMessage.mockImplementation((_messaging: unknown, cb: (payload: unknown) => void) => {
      messageCallback = cb;
    });

    renderHook(() => useFCM('vendor-1'));
    await act(async () => {});

    expect(messageCallback).not.toBeNull();

    act(() => {
      messageCallback!({ data: { title: 'New Order!', body: 'You have a new booking.' } });
    });

    expect(mockNotificationConstructor).toHaveBeenCalledWith(
      'New Order!',
      expect.objectContaining({ body: 'You have a new booking.' })
    );
  });

  test('does not show a Notification for foreground messages without a title', async () => {
    let messageCallback: ((payload: unknown) => void) | null = null;
    mockOnMessage.mockImplementation((_messaging: unknown, cb: (payload: unknown) => void) => {
      messageCallback = cb;
    });

    renderHook(() => useFCM('vendor-1'));
    await act(async () => {});

    act(() => { messageCallback!({ data: {} }); });

    expect(mockNotificationConstructor).not.toHaveBeenCalled();
  });
});
