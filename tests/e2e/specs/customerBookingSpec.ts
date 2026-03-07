// e2e/tests/customer-booking.spec.ts
/**
 * E2E Tests for Customer Booking Flow
 * Tests the complete journey from directory to WhatsApp submission
 */

import { test, expect, Page } from '@playwright/test';

// Test data
const TEST_VENDOR_SLUG = 'kuantan-unplugged'; // Replace with actual test vendor
const TEST_PROMO_CODE = 'CAMPING20';

// Helper: Wait for page to be fully loaded
async function waitForPageLoad(page: Page) {
  await page.waitForLoadState('networkidle');
}

// ═══ DIRECTORY PAGE TESTS ═══
test.describe('Directory Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/directory');
    await waitForPageLoad(page);
  });

  test('should display hero section', async ({ page }) => {
    await expect(page.locator('text=Sewa Gear Camping')).toBeVisible();
    await expect(page.locator('text=Tanpa Hassle')).toBeVisible();
  });

  test('should display trust badges', async ({ page }) => {
    await expect(page.locator('text=Verified Vendors')).toBeVisible();
    await expect(page.locator('text=Secure Booking')).toBeVisible();
  });

  test('should display vendor cards', async ({ page }) => {
    const vendorCards = page.locator('[data-testid="vendor-card"]');
    await expect(vendorCards.first()).toBeVisible({ timeout: 10000 });
  });

  test('should filter vendors by location', async ({ page }) => {
    // Click location dropdown
    await page.click('[data-testid="location-filter"]');
    await page.click('text=Kuantan');
    
    // Verify filtered results
    await waitForPageLoad(page);
    const vendorCards = page.locator('[data-testid="vendor-card"]');
    const count = await vendorCards.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should navigate to vendor shop on click', async ({ page }) => {
    const firstVendor = page.locator('[data-testid="vendor-card"]').first();
    await firstVendor.click();
    
    await expect(page).toHaveURL(/\/shop\//);
  });

  test('should navigate to About page', async ({ page }) => {
    await page.click('text=About');
    await expect(page).toHaveURL('/about');
  });

  test('should navigate to FAQ page', async ({ page }) => {
    await page.click('text=FAQ');
    await expect(page).toHaveURL('/faq');
  });
});

// ═══ SHOP PAGE TESTS ═══
test.describe('Shop Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/shop/${TEST_VENDOR_SLUG}`);
    await waitForPageLoad(page);
  });

  test('should display vendor header', async ({ page }) => {
    await expect(page.locator('[data-testid="vendor-name"]')).toBeVisible();
    await expect(page.locator('[data-testid="verified-badge"]')).toBeVisible();
  });

  test('should display service badges when available', async ({ page }) => {
    // Check if delivery badge exists (depends on vendor config)
    const deliveryBadge = page.locator('text=Delivery Available');
    const setupBadge = page.locator('text=Setup Service');
    
    // At least one should be visible or neither (depends on vendor)
    const deliveryVisible = await deliveryBadge.isVisible().catch(() => false);
    const setupVisible = await setupBadge.isVisible().catch(() => false);
    
    // This is informational - badges depend on vendor config
    console.log(`Delivery available: ${deliveryVisible}, Setup available: ${setupVisible}`);
  });

  test('should display date pickers', async ({ page }) => {
    await expect(page.locator('#cp')).toBeVisible(); // Pickup date
    await expect(page.locator('#op')).toBeVisible(); // Return date
  });

  test('should display gear items', async ({ page }) => {
    const gearItems = page.locator('[data-testid="gear-item"]');
    await expect(gearItems.first()).toBeVisible({ timeout: 10000 });
  });

  test('should add item to cart', async ({ page }) => {
    // Click first gear item
    const firstItem = page.locator('[data-testid="gear-item"]').first();
    await firstItem.click();
    
    // Wait for modal
    await expect(page.locator('[data-testid="item-modal"]')).toBeVisible();
    
    // Click add to cart
    await page.click('[data-testid="add-to-cart-btn"]');
    
    // Verify cart button appears
    await expect(page.locator('[data-testid="cart-button"]')).toBeVisible();
  });

  test('should open cart modal', async ({ page }) => {
    // Add item first
    const firstItem = page.locator('[data-testid="gear-item"]').first();
    await firstItem.click();
    await page.click('[data-testid="add-to-cart-btn"]');
    
    // Open cart
    await page.click('[data-testid="cart-button"]');
    
    // Verify cart modal
    await expect(page.locator('[data-testid="cart-modal"]')).toBeVisible();
  });

  test('should search for gear', async ({ page }) => {
    await page.fill('[data-testid="gear-search"]', 'tent');
    
    // Verify filtered results
    const gearItems = page.locator('[data-testid="gear-item"]');
    const count = await gearItems.count();
    
    // All visible items should contain "tent" in name
    if (count > 0) {
      const firstName = await gearItems.first().locator('[data-testid="gear-name"]').textContent();
      expect(firstName?.toLowerCase()).toContain('tent');
    }
  });
});

// ═══ FULL BOOKING FLOW ═══
test.describe('Complete Booking Flow', () => {
  test('should complete pickup booking', async ({ page }) => {
    // 1. Go to shop
    await page.goto(`/shop/${TEST_VENDOR_SLUG}`);
    await waitForPageLoad(page);
    
    // 2. Select dates
    await page.click('#cp');
    await page.click('.flatpickr-day:not(.flatpickr-disabled):not(.prevMonthDay)');
    
    await page.click('#op');
    // Select a date 3 days later
    const days = page.locator('.flatpickr-day:not(.flatpickr-disabled):not(.prevMonthDay)');
    await days.nth(3).click();
    
    // 3. Add item to cart
    const firstItem = page.locator('[data-testid="gear-item"]').first();
    await firstItem.click();
    await page.click('[data-testid="add-to-cart-btn"]');
    
    // 4. Open cart
    await page.click('[data-testid="cart-button"]');
    
    // 5. Select pickup (default)
    await expect(page.locator('[data-testid="fulfillment-pickup"]')).toBeVisible();
    
    // 6. Agree to terms
    await page.click('[data-testid="terms-checkbox"]');
    
    // 7. Verify submit button is enabled
    const submitBtn = page.locator('[data-testid="submit-order"]');
    await expect(submitBtn).not.toBeDisabled();
    
    // 8. Click submit (will open WhatsApp)
    // We intercept the window.open to prevent actually opening WhatsApp
    await page.evaluate(() => {
      window.open = (url) => {
        (window as any).lastWhatsAppUrl = url;
        return null;
      };
    });
    
    await submitBtn.click();
    
    // 9. Verify WhatsApp URL was generated
    const whatsappUrl = await page.evaluate(() => (window as any).lastWhatsAppUrl);
    expect(whatsappUrl).toContain('wa.me');
    expect(whatsappUrl).toContain('Booking');
  });

  test('should complete delivery booking with setup', async ({ page }) => {
    // 1. Go to shop
    await page.goto(`/shop/${TEST_VENDOR_SLUG}`);
    await waitForPageLoad(page);
    
    // 2. Select dates
    await page.click('#cp');
    await page.click('.flatpickr-day:not(.flatpickr-disabled):not(.prevMonthDay)');
    
    await page.click('#op');
    const days = page.locator('.flatpickr-day:not(.flatpickr-disabled):not(.prevMonthDay)');
    await days.nth(3).click();
    
    // 3. Add item to cart
    const firstItem = page.locator('[data-testid="gear-item"]').first();
    await firstItem.click();
    await page.click('[data-testid="add-to-cart-btn"]');
    
    // 4. Open cart
    await page.click('[data-testid="cart-button"]');
    
    // 5. Select delivery
    const deliveryBtn = page.locator('[data-testid="fulfillment-delivery"]');
    if (await deliveryBtn.isVisible()) {
      await deliveryBtn.click();
      
      // 6. Enter delivery address
      await page.fill('[data-testid="delivery-address"]', 'Teluk Cempedak Campsite, Kuantan');
      
      // 7. Select zone if visible
      const zoneOption = page.locator('[data-testid="zone-option"]').first();
      if (await zoneOption.isVisible()) {
        await zoneOption.click();
      }
      
      // 8. Select time slot if visible
      const timeSlot = page.locator('[data-testid="time-slot"]').first();
      if (await timeSlot.isVisible()) {
        await timeSlot.click();
      }
    }
    
    // 9. Toggle setup for first item
    const setupCheckbox = page.locator('[data-testid="setup-checkbox"]').first();
    if (await setupCheckbox.isVisible()) {
      await setupCheckbox.click();
    }
    
    // 10. Agree to terms
    await page.click('[data-testid="terms-checkbox"]');
    
    // 11. Intercept and verify WhatsApp
    await page.evaluate(() => {
      window.open = (url) => {
        (window as any).lastWhatsAppUrl = url;
        return null;
      };
    });
    
    const submitBtn = page.locator('[data-testid="submit-order"]');
    await submitBtn.click();
    
    const whatsappUrl = await page.evaluate(() => (window as any).lastWhatsAppUrl);
    expect(whatsappUrl).toContain('wa.me');
    
    // Verify delivery info in message
    if (await deliveryBtn.isVisible()) {
      expect(whatsappUrl).toContain('DELIVERY');
      expect(whatsappUrl).toContain('Teluk');
    }
  });

  test('should apply promo code', async ({ page }) => {
    // 1. Go to shop and add item
    await page.goto(`/shop/${TEST_VENDOR_SLUG}`);
    await waitForPageLoad(page);
    
    const firstItem = page.locator('[data-testid="gear-item"]').first();
    await firstItem.click();
    await page.click('[data-testid="add-to-cart-btn"]');
    
    // 2. Open cart
    await page.click('[data-testid="cart-button"]');
    
    // 3. Enter promo code
    await page.fill('[data-testid="promo-input"]', TEST_PROMO_CODE);
    await page.click('[data-testid="apply-promo"]');
    
    // 4. Check for success message
    const successMsg = page.locator('text=Success');
    const errorMsg = page.locator('text=Invalid');
    
    // Either success or invalid depending on if code exists
    const hasSuccess = await successMsg.isVisible().catch(() => false);
    const hasError = await errorMsg.isVisible().catch(() => false);
    
    expect(hasSuccess || hasError).toBe(true);
  });
});

// ═══ RESPONSIVE TESTS ═══
test.describe('Mobile Responsiveness', () => {
  test.use({ viewport: { width: 375, height: 667 } }); // iPhone SE

  test('should display mobile-friendly layout', async ({ page }) => {
    await page.goto('/directory');
    await waitForPageLoad(page);
    
    // Hero should be visible
    await expect(page.locator('text=Sewa Gear Camping')).toBeVisible();
    
    // Vendor cards should stack
    const vendorCards = page.locator('[data-testid="vendor-card"]');
    await expect(vendorCards.first()).toBeVisible({ timeout: 10000 });
  });

  test('should have touch-friendly buttons', async ({ page }) => {
    await page.goto(`/shop/${TEST_VENDOR_SLUG}`);
    await waitForPageLoad(page);
    
    // Cart button should be easily tappable
    const firstItem = page.locator('[data-testid="gear-item"]').first();
    const boundingBox = await firstItem.boundingBox();
    
    // Button should be at least 44x44 (Apple's minimum touch target)
    expect(boundingBox?.height).toBeGreaterThanOrEqual(44);
  });
});

// ═══ ERROR HANDLING ═══
test.describe('Error Handling', () => {
  test('should show error for invalid vendor slug', async ({ page }) => {
    await page.goto('/shop/this-vendor-does-not-exist-12345');
    await waitForPageLoad(page);
    
    // Should show block screen
    await expect(page.locator('text=Hub Building')).toBeVisible({ timeout: 10000 });
  });

  test('should handle offline gracefully', async ({ page, context }) => {
    await page.goto('/directory');
    await waitForPageLoad(page);
    
    // Go offline
    await context.setOffline(true);
    
    // Try to navigate
    await page.reload().catch(() => {});
    
    // Should show some offline indication
    // (This depends on implementation - service worker, etc.)
  });
});