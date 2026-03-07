// jestSetup.js
const matchers = require('@testing-library/jest-dom/matchers');
const { expect } = require('@jest/globals');

expect.extend(matchers);

// Mock Firebase
jest.mock('@/lib/firebase', () => ({
  db: {
    collection: jest.fn(),
    doc: jest.fn(),
  },
  auth: {
    currentUser: null,
    onAuthStateChanged: jest.fn((callback) => {
      callback(null);
      return jest.fn();
    }),
  },
}));

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  }),
  useSearchParams: () => ({
    get: jest.fn(),
  }),
  usePathname: () => '/',
}));

// Mock window.open for WhatsApp
global.open = jest.fn();

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.localStorage = localStorageMock;

// Mock clipboard
Object.assign(navigator, {
  clipboard: {
    writeText: jest.fn(),
  },
  share: jest.fn(),
});

// Mock flatpickr
jest.mock('flatpickr', () => jest.fn(() => ({
  destroy: jest.fn(),
  setDate: jest.fn(),
})));

// Suppress console errors in tests (optional)
// console.error = jest.fn();