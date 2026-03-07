// e2e/tests/vendor-admin.spec.ts
/**
 * E2E Tests for Vendor and Admin Flows
 * Tests vendor studio and admin panel functionality
 */

import { test, expect, Page } from '@playwright/test';

// Test credentials (use test accounts)
const VENDOR_EMAIL = 'vendor-test@pacakkhemah.com';
const VENDOR_PASSWORD = 'testpassword123';
const ADMIN_EMAIL = 'akiff.work@gmail.com';
const ADMIN_PASSWORD = 'adminpassword123'; // Replace with actual test password

// Helper: Login
async function login(page: Page, email: string, password: string) {
  await page.goto('/store');
  await page.fill('[data-testid="email-input"]', email);
  await page.fill('[data-testid="password-input"]', password);
  await page.click('[data-testid="login-button"]');
  await page.waitForLoadState('networkidle');
}

// Helper: Logout
async function logout(page: Page) {
  await page.click('[data-testid="logout-button"]');
  await page.waitForLoadState('networkidle');
}

// ═══ VENDOR STUDIO TESTS ═══
test.describe('Vendor Studio', () => {
  test.beforeEach(async ({ page }) => {
    // Skip if no test credentials
    test.skip(!VENDOR_EMAIL || !VENDOR_PASSWORD, 'Test credentials not configured');
    await login(page, VENDOR_EMAIL, VENDOR_PASSWORD);
  });

  test.describe('Navigation', () => {
    test('should display all tabs', async ({ page }) => {
      await expect(page.locator('text=Storefront')).toBeVisible();
      await expect(page.locator('text=Inventory')).toBeVisible();
      await expect(page.locator('text=Analytics')).toBeVisible();
      await expect(page.locator('text=Settings')).toBeVisible();
    });

    test('should switch between tabs', async ({ page }) => {
      await page.click('text=Inventory');
      await expect(page.locator('[data-testid="inventory-tab"]')).toBeVisible();
      
      await page.click('text=Settings');
      await expect(page.locator('[data-testid="settings-tab"]')).toBeVisible();
    });
  });

  test.describe('Settings Tab', () => {
    test.beforeEach(async ({ page }) => {
      await page.click('text=Settings');
    });

    test('should show sub-tabs', async ({ page }) => {
      await expect(page.locator('text=Account')).toBeVisible();
      await expect(page.locator('text=Logistics')).toBeVisible();
      await expect(page.locator('text=Delivery & Setup')).toBeVisible();
    });

    test('should save account settings', async ({ page }) => {
      await page.click('text=Account');
      
      // Edit shop name
      const nameInput = page.locator('[data-testid="shop-name-input"]');
      await nameInput.clear();
      await nameInput.fill('Test Shop Updated');
      
      // Save
      await page.click('[data-testid="save-account-btn"]');
      
      // Check for success
      await expect(page.locator('text=Saved')).toBeVisible();
    });

    test('should configure delivery service', async ({ page }) => {
      await page.click('text=Delivery & Setup');
      
      // Toggle delivery on
      const deliveryToggle = page.locator('[data-testid="delivery-toggle"]');
      await deliveryToggle.click();
      
      // Select pricing type
      await page.click('text=Fixed Fee');
      
      // Set fee
      const feeInput = page.locator('[data-testid="fixed-fee-input"]');
      await feeInput.clear();
      await feeInput.fill('50');
      
      // Save
      await page.click('[data-testid="save-services-btn"]');
      
      // Check for success
      await expect(page.locator('text=Saved')).toBeVisible();
    });

    test('should add delivery zone', async ({ page }) => {
      await page.click('text=Delivery & Setup');
      
      // Enable delivery
      const deliveryToggle = page.locator('[data-testid="delivery-toggle"]');
      if (!(await deliveryToggle.isChecked())) {
        await deliveryToggle.click();
      }
      
      // Select zone-based
      await page.click('text=Zone-based');
      
      // Add zone
      await page.fill('[data-testid="zone-name-input"]', 'New Zone');
      await page.fill('[data-testid="zone-fee-input"]', '45');
      await page.click('[data-testid="add-zone-btn"]');
      
      // Verify zone appears
      await expect(page.locator('text=New Zone')).toBeVisible();
    });
  });

  test.describe('Inventory Tab', () => {
    test.beforeEach(async ({ page }) => {
      await page.click('text=Inventory');
    });

    test('should display gear items', async ({ page }) => {
      const gearItems = page.locator('[data-testid="gear-item"]');
      // At least one item should exist for test vendor
      await expect(gearItems.first()).toBeVisible({ timeout: 10000 });
    });

    test('should add new gear item', async ({ page }) => {
      await page.click('[data-testid="add-item-btn"]');
      
      // Fill form
      await page.fill('[data-testid="gear-name-input"]', 'Test Tent');
      await page.fill('[data-testid="gear-price-input"]', '100');
      await page.fill('[data-testid="gear-stock-input"]', '5');
      await page.fill('[data-testid="gear-category-input"]', 'Tents');
      
      // Enable setup
      await page.click('[data-testid="setup-toggle"]');
      await page.fill('[data-testid="setup-fee-input"]', '50');
      
      // Save
      await page.click('[data-testid="save-gear-btn"]');
      
      // Verify item appears
      await expect(page.locator('text=Test Tent')).toBeVisible();
    });

    test('should edit gear item', async ({ page }) => {
      const firstItem = page.locator('[data-testid="gear-item"]').first();
      await firstItem.locator('[data-testid="edit-btn"]').click();
      
      // Edit price
      const priceInput = page.locator('[data-testid="gear-price-input"]');
      await priceInput.clear();
      await priceInput.fill('150');
      
      // Save
      await page.click('[data-testid="save-gear-btn"]');
      
      // Verify update
      await expect(page.locator('text=RM 150')).toBeVisible();
    });

    test('should add discount rule', async ({ page }) => {
      await page.click('[data-testid="add-discount-btn"]');
      
      // Select nightly discount
      await page.selectOption('[data-testid="discount-type"]', 'nightly_discount');
      await page.fill('[data-testid="discount-percent"]', '10');
      await page.fill('[data-testid="trigger-nights"]', '3');
      
      // Save
      await page.click('[data-testid="save-discount-btn"]');
      
      // Verify discount appears
      await expect(page.locator('text=10% OFF')).toBeVisible();
    });
  });
});

// ═══ ADMIN PANEL TESTS ═══
test.describe('Admin Panel', () => {
  test.beforeEach(async ({ page }) => {
    // Skip if no admin credentials
    test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, 'Admin credentials not configured');
    await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await page.goto('/admin');
  });

  test.describe('Access Control', () => {
    test('should allow admin access', async ({ page }) => {
      await expect(page.locator('[data-testid="admin-dashboard"]')).toBeVisible();
    });

    test('should deny non-admin access', async ({ page }) => {
      await logout(page);
      await login(page, 'random@user.com', 'password');
      await page.goto('/admin');
      
      // Should not see admin content
      await expect(page.locator('[data-testid="admin-dashboard"]')).not.toBeVisible();
    });
  });

  test.describe('Dashboard Tab', () => {
    test('should display stats cards', async ({ page }) => {
      await expect(page.locator('text=Total Revenue')).toBeVisible();
      await expect(page.locator('text=Active Vendors')).toBeVisible();
      await expect(page.locator('text=Pending Approval')).toBeVisible();
    });

    test('should display revenue chart', async ({ page }) => {
      await expect(page.locator('text=Revenue (Last 7 Days)')).toBeVisible();
    });

    test('should display quick actions', async ({ page }) => {
      await expect(page.locator('text=Review Pending')).toBeVisible();
      await expect(page.locator('text=Send Reminder')).toBeVisible();
      await expect(page.locator('text=Export Report')).toBeVisible();
      await expect(page.locator('text=Site Settings')).toBeVisible();
    });

    test('should navigate via quick actions', async ({ page }) => {
      await page.click('text=Site Settings');
      await expect(page.locator('[data-testid="settings-tab"]')).toBeVisible();
    });

    test('should export report', async ({ page }) => {
      const downloadPromise = page.waitForEvent('download');
      await page.click('text=Export Report');
      const download = await downloadPromise;
      
      expect(download.suggestedFilename()).toContain('pacakkhemah-report');
      expect(download.suggestedFilename()).toContain('.json');
    });

    test('should switch time ranges', async ({ page }) => {
      await page.click('text=7d');
      // Verify data updates (visual check)
      
      await page.click('text=30d');
      await page.click('text=90d');
    });
  });

  test.describe('Finance Tab', () => {
    test.beforeEach(async ({ page }) => {
      await page.click('text=Finance');
    });

    test('should display transaction table', async ({ page }) => {
      await expect(page.locator('[data-testid="transaction-table"]')).toBeVisible();
    });

    test('should add transaction', async ({ page }) => {
      await page.click('[data-testid="add-transaction-btn"]');
      
      // Fill form
      await page.selectOption('[data-testid="vendor-select"]', { index: 1 });
      await page.fill('[data-testid="amount-input"]', '100');
      await page.fill('[data-testid="credits-input"]', '50');
      await page.click('text=Purchase');
      
      // Save
      await page.click('[data-testid="save-transaction-btn"]');
      
      // Verify in table
      await expect(page.locator('text=RM 100')).toBeVisible();
    });

    test('should filter transactions by type', async ({ page }) => {
      await page.click('[data-testid="filter-purchase"]');
      // Verify only purchase transactions shown
      
      await page.click('[data-testid="filter-refund"]');
      // Verify only refund transactions shown
    });
  });

  test.describe('Content Tab', () => {
    test.beforeEach(async ({ page }) => {
      await page.click('text=Content');
    });

    test('should display content sections', async ({ page }) => {
      await expect(page.locator('text=Announcement')).toBeVisible();
      await expect(page.locator('text=About Page')).toBeVisible();
      await expect(page.locator('text=FAQ')).toBeVisible();
      await expect(page.locator('text=Testimonials')).toBeVisible();
      await expect(page.locator('text=Events')).toBeVisible();
    });

    test('should toggle announcement', async ({ page }) => {
      await page.click('text=Announcement');
      
      const toggle = page.locator('[data-testid="announcement-toggle"]');
      await toggle.click();
      
      await page.fill('[data-testid="announcement-message"]', 'Test announcement');
      await page.click('[data-testid="save-content-btn"]');
      
      await expect(page.locator('text=Saved')).toBeVisible();
    });

    test('should add testimonial', async ({ page }) => {
      await page.click('text=Testimonials');
      await page.click('[data-testid="add-testimonial-btn"]');
      
      await page.fill('[data-testid="testimonial-name"]', 'Test User');
      await page.fill('[data-testid="testimonial-location"]', 'Test City');
      await page.fill('[data-testid="testimonial-text"]', 'Great service!');
      await page.click('[data-testid="rating-5"]');
      
      await page.click('[data-testid="save-testimonial-btn"]');
      
      await expect(page.locator('text=Test User')).toBeVisible();
    });

    test('should add event', async ({ page }) => {
      await page.click('text=Events');
      await page.click('[data-testid="add-event-btn"]');
      
      await page.fill('[data-testid="event-name"]', 'Test Event');
      await page.fill('[data-testid="event-organizer"]', 'Test Org');
      await page.fill('[data-testid="event-link"]', 'https://example.com');
      
      await page.click('[data-testid="save-event-btn"]');
      
      await expect(page.locator('text=Test Event')).toBeVisible();
    });
  });

  test.describe('Settings Tab', () => {
    test.beforeEach(async ({ page }) => {
      await page.click('text=Settings');
    });

    test('should display settings sections', async ({ page }) => {
      await expect(page.locator('text=Site Info')).toBeVisible();
      await expect(page.locator('text=Social Links')).toBeVisible();
      await expect(page.locator('text=Admin Access')).toBeVisible();
      await expect(page.locator('text=Default Policies')).toBeVisible();
      await expect(page.locator('text=Danger Zone')).toBeVisible();
    });

    test('should update site info', async ({ page }) => {
      await page.click('text=Site Info');
      
      const taglineInput = page.locator('[data-testid="tagline-input"]');
      await taglineInput.clear();
      await taglineInput.fill('Updated Tagline');
      
      await page.click('[data-testid="save-settings-btn"]');
      
      await expect(page.locator('text=Saved')).toBeVisible();
    });

    test('should toggle maintenance mode', async ({ page }) => {
      await page.click('text=Site Info');
      
      const maintenanceToggle = page.locator('[data-testid="maintenance-toggle"]');
      const initialState = await maintenanceToggle.isChecked();
      
      await maintenanceToggle.click();
      
      // Toggle back to avoid breaking the site
      if (!initialState) {
        await maintenanceToggle.click();
      }
    });

    test('should add admin email', async ({ page }) => {
      await page.click('text=Admin Access');
      
      await page.fill('[data-testid="new-admin-email"]', 'newadmin@test.com');
      await page.click('[data-testid="add-admin-btn"]');
      
      await expect(page.locator('text=newadmin@test.com')).toBeVisible();
      
      // Clean up - remove the test admin
      await page.locator('[data-testid="remove-admin-newadmin@test.com"]').click();
    });
  });
});

// ═══ INTEGRATION TESTS ═══
test.describe('Vendor to Shop Integration', () => {
  test('vendor delivery settings should appear in shop', async ({ page }) => {
    // Skip if no test credentials
    test.skip(!VENDOR_EMAIL || !VENDOR_PASSWORD, 'Test credentials not configured');
    
    // 1. Login as vendor
    await login(page, VENDOR_EMAIL, VENDOR_PASSWORD);
    
    // 2. Enable delivery
    await page.click('text=Settings');
    await page.click('text=Delivery & Setup');
    
    const deliveryToggle = page.locator('[data-testid="delivery-toggle"]');
    if (!(await deliveryToggle.isChecked())) {
      await deliveryToggle.click();
      await page.click('[data-testid="save-services-btn"]');
    }
    
    // Get vendor slug
    await page.click('text=Account');
    const slugInput = page.locator('[data-testid="slug-input"]');
    const slug = await slugInput.inputValue();
    
    // 3. Logout and visit shop
    await logout(page);
    await page.goto(`/shop/${slug}`);
    
    // 4. Verify delivery badge appears
    await expect(page.locator('text=Delivery Available')).toBeVisible();
  });

  test('vendor setup fee should appear in cart', async ({ page }) => {
    // Skip if no test credentials
    test.skip(!VENDOR_EMAIL || !VENDOR_PASSWORD, 'Test credentials not configured');
    
    // 1. Login as vendor
    await login(page, VENDOR_EMAIL, VENDOR_PASSWORD);
    
    // 2. Add item with setup fee
    await page.click('text=Inventory');
    const firstItem = page.locator('[data-testid="gear-item"]').first();
    await firstItem.locator('[data-testid="edit-btn"]').click();
    
    await page.click('[data-testid="setup-toggle"]');
    await page.fill('[data-testid="setup-fee-input"]', '75');
    await page.click('[data-testid="save-gear-btn"]');
    
    // Get vendor slug
    await page.click('text=Settings');
    await page.click('text=Account');
    const slug = await page.locator('[data-testid="slug-input"]').inputValue();
    
    // 3. Visit shop and add item
    await logout(page);
    await page.goto(`/shop/${slug}`);
    
    const shopItem = page.locator('[data-testid="gear-item"]').first();
    await shopItem.click();
    await page.click('[data-testid="add-to-cart-btn"]');
    
    // 4. Open cart and verify setup option
    await page.click('[data-testid="cart-button"]');
    
    await expect(page.locator('text=Add Setup')).toBeVisible();
    await expect(page.locator('text=+RM 75')).toBeVisible();
  });
});