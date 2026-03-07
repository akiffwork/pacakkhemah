# Pacak Khemah - Testing Setup Guide

## 📦 Installation

Add these dependencies to your `package.json`:

```json
{
  "devDependencies": {
    "@testing-library/jest-dom": "^6.1.0",
    "@testing-library/react": "^14.0.0",
    "@testing-library/user-event": "^14.5.0",
    "@playwright/test": "^1.40.0",
    "@types/jest": "^29.5.0",
    "jest": "^29.7.0",
    "jest-environment-jsdom": "^29.7.0",
    "ts-jest": "^29.1.0"
  },
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:e2e:debug": "playwright test --debug",
    "test:all": "npm run test && npm run test:e2e"
  }
}
```

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install --save-dev @testing-library/jest-dom @testing-library/react @testing-library/user-event @playwright/test @types/jest jest jest-environment-jsdom ts-jest
```

### 2. Install Playwright Browsers
```bash
npx playwright install
```

### 3. Copy Test Files
```
your-project/
├── jestConfig.js           # Jest configuration
├── jestSetup.js            # Jest setup & mocks
├── mocks/
│   └── testData.ts         # Mock data for tests
├── unit/
│   └── pricingTest.ts      # Unit tests for pricing
├── components/
│   └── ShopCartTest.tsx    # Component tests
├── e2e/
│   ├── playwrightConfig.ts # Playwright config
│   └── specs/
│       ├── customerBookingSpec.ts  # E2E customer flow
│       └── vendorAdminSpec.ts      # E2E vendor/admin
```

## 📋 Running Tests

### Unit Tests (Jest)
```bash
# Run all unit tests
npm test

# Run tests in watch mode (re-runs on file changes)
npm run test:watch

# Run with coverage report
npm run test:coverage

# Run specific test file
npm test -- pricingTest.ts
```

### E2E Tests (Playwright)
```bash
# Run all E2E tests
npm run test:e2e

# Run with interactive UI
npm run test:e2e:ui

# Run in debug mode (step through)
npm run test:e2e:debug

# Run specific test file
npx playwright test customerBookingSpec.ts

# Run tests for specific browser
npx playwright test --project=chromium
npx playwright test --project="Mobile Safari"
```

### Run All Tests
```bash
npm run test:all
```

## 🔧 Configuration

### Update Test Data
Edit `__mocks__/testData.ts` to match your actual test data:

```typescript
// Use your actual test vendor slug
const TEST_VENDOR_SLUG = 'your-test-vendor-slug';

// Use actual test promo codes
const mockDiscounts = [
  {
    code: 'YOUR_ACTUAL_PROMO',
    discount_percent: 20,
  }
];
```

### Configure Test Credentials
For E2E tests, set up test accounts:

```typescript
// e2e/tests/vendor-admin.spec.ts
const VENDOR_EMAIL = 'your-test-vendor@email.com';
const VENDOR_PASSWORD = 'your-test-password';
```

⚠️ **Never commit real credentials to git!** Use environment variables:

```bash
# .env.test.local
TEST_VENDOR_EMAIL=vendor@test.com
TEST_VENDOR_PASSWORD=password123
TEST_ADMIN_EMAIL=admin@test.com
TEST_ADMIN_PASSWORD=adminpass123
```

Then in tests:
```typescript
const VENDOR_EMAIL = process.env.TEST_VENDOR_EMAIL;
```

## 📊 Test Coverage Goals

| Category | Target |
|----------|--------|
| Unit Tests | 80%+ coverage |
| Component Tests | 70%+ coverage |
| E2E Tests | All critical paths |

## 🎯 What Each Test Type Covers

### Unit Tests (`pricing.test.ts`)
- ✅ Nights calculation
- ✅ Subtotal calculation
- ✅ Auto discount logic
- ✅ Promo code validation
- ✅ Delivery fee (fixed/per-km/zones)
- ✅ Setup fee calculation
- ✅ Combo bundle savings
- ✅ Deposit calculation
- ✅ Total calculation

### Component Tests (`ShopCart.test.tsx`)
- ✅ Cart item rendering
- ✅ Quantity updates
- ✅ Setup checkbox toggle
- ✅ Fulfillment selection
- ✅ Delivery options display
- ✅ Zone selection
- ✅ Form validation
- ✅ Submit button state

### E2E Tests - Customer (`customer-booking.spec.ts`)
- ✅ Directory page load
- ✅ Vendor filtering
- ✅ Shop navigation
- ✅ Date selection
- ✅ Add to cart
- ✅ Promo code
- ✅ Pickup booking flow
- ✅ Delivery booking flow
- ✅ Setup service selection
- ✅ WhatsApp submission
- ✅ Mobile responsiveness

### E2E Tests - Vendor/Admin (`vendor-admin.spec.ts`)
- ✅ Vendor login
- ✅ Settings tab navigation
- ✅ Delivery configuration
- ✅ Zone management
- ✅ Inventory management
- ✅ Discount rules
- ✅ Admin access control
- ✅ Dashboard stats
- ✅ Quick actions
- ✅ Finance transactions
- ✅ Content management
- ✅ Testimonials CRUD
- ✅ Events CRUD
- ✅ Settings management
- ✅ Vendor-to-Shop integration

## 🐛 Debugging Failed Tests

### Jest (Unit/Component)
```bash
# Run with verbose output
npm test -- --verbose

# Run single test
npm test -- -t "should calculate subtotal"

# Debug in VS Code
# Add breakpoints, then run "Jest: Debug" from command palette
```

### Playwright (E2E)
```bash
# Debug mode (step through)
npx playwright test --debug

# Show browser while running
npx playwright test --headed

# Generate trace on failure
npx playwright test --trace on

# View trace
npx playwright show-trace trace.zip
```

## 📝 Adding New Tests

### New Pricing Logic
```typescript
// __tests__/unit/pricing.test.ts
describe('New Feature', () => {
  it('should calculate correctly', () => {
    const result = calculateNewFeature(inputs);
    expect(result).toBe(expectedOutput);
  });
});
```

### New Component
```typescript
// __tests__/components/NewComponent.test.tsx
import { render, screen } from '@testing-library/react';
import NewComponent from '@/components/NewComponent';

describe('NewComponent', () => {
  it('renders correctly', () => {
    render(<NewComponent prop="value" />);
    expect(screen.getByText('expected text')).toBeInTheDocument();
  });
});
```

### New E2E Flow
```typescript
// e2e/tests/new-flow.spec.ts
import { test, expect } from '@playwright/test';

test('new user flow', async ({ page }) => {
  await page.goto('/page');
  await page.click('button');
  await expect(page.locator('text=Success')).toBeVisible();
});
```

## 🔄 CI/CD Integration

### GitHub Actions
```yaml
# .github/workflows/test.yml
name: Tests
on: [push, pull_request]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm test -- --coverage

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npm run test:e2e
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/
```

## ✅ Pre-Deploy Checklist

Run this before every deployment:

```bash
# 1. Run all tests
npm run test:all

# 2. Check coverage
npm run test:coverage

# 3. Run E2E on production build
npm run build
npm run test:e2e
```

---

*Last Updated: March 2026*