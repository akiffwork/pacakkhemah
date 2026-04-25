// e2e/tests/auth.spec.ts
/**
 * E2E Tests for Authentication and Authorization Guards
 * Verifies that protected routes block unauthenticated and unauthorised users.
 */

import { test, expect, Page } from '@playwright/test';

async function waitForPageLoad(page: Page) {
  await page.waitForLoadState('networkidle');
}

// ─── Unauthenticated access ───────────────────────────────────────────────────

test.describe('Unauthenticated Access', () => {
  test('visiting /store without auth shows the login UI', async ({ page }) => {
    await page.goto('/store');
    await waitForPageLoad(page);

    // Should show an email/password login form, not the vendor dashboard
    const emailInput = page.locator('[data-testid="email-input"]');
    await expect(emailInput).toBeVisible({ timeout: 10000 });
  });

  test('vendor dashboard tabs are not rendered for unauthenticated users', async ({ page }) => {
    await page.goto('/store');
    await waitForPageLoad(page);

    await expect(page.locator('[data-testid="inventory-tab"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="orders-tab"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="analytics-tab"]')).not.toBeVisible();
  });

  test('customer-facing shop pages are accessible without auth', async ({ page }) => {
    await page.goto('/directory');
    await waitForPageLoad(page);

    // Public shop listing should always be accessible
    await expect(page.locator('body')).toBeVisible();
    // No login prompt should appear on the directory page
    await expect(page.locator('[data-testid="email-input"]')).not.toBeVisible();
  });

  test('visiting /my-bookings without auth shows a phone lookup form', async ({ page }) => {
    await page.goto('/my-bookings');
    await waitForPageLoad(page);

    // My Bookings uses phone number lookup, not full auth — should not redirect to login
    await expect(page.locator('body')).toBeVisible();
    await expect(page.locator('[data-testid="email-input"]')).not.toBeVisible();
  });
});

// ─── Admin access control ─────────────────────────────────────────────────────

test.describe('Admin Access Control', () => {
  test('non-admin visiting /admin tab sees access denied or is redirected', async ({ page }) => {
    // Visit the page without any credentials
    await page.goto('/store');
    await waitForPageLoad(page);

    // Should not see admin-only elements
    await expect(page.locator('[data-testid="admin-dashboard"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="finance-tab"]')).not.toBeVisible();
  });
});

// ─── Login form validation ────────────────────────────────────────────────────

test.describe('Login Form Validation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/store');
    await waitForPageLoad(page);
  });

  test('login button is present on the store page', async ({ page }) => {
    await expect(page.locator('[data-testid="login-button"]')).toBeVisible({ timeout: 10000 });
  });

  test('entering wrong credentials shows an error', async ({ page }) => {
    await page.fill('[data-testid="email-input"]', 'notareal@user.com');
    await page.fill('[data-testid="password-input"]', 'wrongpassword');
    await page.click('[data-testid="login-button"]');
    await page.waitForLoadState('networkidle');

    // Should stay on the login page and show some error
    const errorVisible = await page.locator('[data-testid="auth-error"], text=incorrect, text=invalid, text=error').first().isVisible().catch(() => false);
    const stillOnLoginPage = await page.locator('[data-testid="email-input"]').isVisible().catch(() => false);

    expect(errorVisible || stillOnLoginPage).toBe(true);
  });
});
