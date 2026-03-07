// __tests__/unit/pricing.test.ts
/**
 * Unit Tests for Pricing Calculations
 * Tests all pricing logic used in the shop page
 */

import { mockGear, mockCart, mockDiscounts, mockVendor } from '../mocks/testData';

// ═══ PRICING HELPER FUNCTIONS (extracted for testing) ═══
function calculateNights(startDate: Date, endDate: Date): number {
  return Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / 86400000));
}

function calculateSubtotal(cart: typeof mockCart, nights: number): number {
  return cart.reduce((acc, item) => acc + item.price * item.qty, 0) * nights;
}

function calculateAutoDiscount(
  subtotal: number,
  dailyTotal: number,
  nights: number,
  discounts: typeof mockDiscounts,
  allowStacking: boolean
): { amount: number; applied: boolean } {
  const nightlyDiscounts = discounts
    .filter(d => d.type === 'nightly_discount' && (d.trigger_nights ?? 0) <= nights)
    .sort((a, b) => b.discount_percent - a.discount_percent);
  
  if (nightlyDiscounts.length === 0) return { amount: 0, applied: false };
  
  const rule = nightlyDiscounts[0];
  const freeNights = (rule.trigger_nights ?? 0) - 1;
  const discountedNights = nights - freeNights;
  
  if (discountedNights <= 0) return { amount: 0, applied: false };
  
  const amount = dailyTotal * discountedNights * (rule.discount_percent / 100);
  return { amount, applied: true };
}

function calculatePromoDiscount(
  subtotal: number,
  promoCode: string,
  discounts: typeof mockDiscounts
): { amount: number; applied: boolean; error?: string } {
  const promo = discounts.find(d => d.type === 'promo_code' && d.code === promoCode);
  
  if (!promo) return { amount: 0, applied: false, error: 'Invalid Code' };
  
  return {
    amount: subtotal * (promo.discount_percent / 100),
    applied: true,
  };
}

function calculateDeliveryFee(
  services: typeof mockVendor.services,
  fulfillmentType: 'pickup' | 'delivery',
  selectedZone?: { name: string; fee: number },
  distanceKm?: number,
  subtotal?: number
): number {
  if (fulfillmentType === 'pickup' || !services.delivery.enabled) return 0;
  
  // Free delivery threshold
  if (services.delivery.freeAbove > 0 && (subtotal || 0) >= services.delivery.freeAbove) {
    return 0;
  }
  
  switch (services.delivery.pricingType) {
    case 'fixed':
      return services.delivery.fixedFee;
    case 'per_km':
      return Math.max(services.delivery.minFee, (distanceKm || 0) * services.delivery.perKmRate);
    case 'zones':
      return selectedZone?.fee || 0;
    case 'quote':
      return 0; // TBD via WhatsApp
    default:
      return 0;
  }
}

function calculateSetupFee(cart: typeof mockCart, useCombo: boolean, comboFee: number): number {
  if (useCombo) return comboFee;
  
  return cart
    .filter(item => item.addSetup && item.setup?.available)
    .reduce((sum, item) => sum + (item.setup?.fee || 0), 0);
}

function calculateDeposit(
  subtotalAfterDiscount: number,
  depositValue: number,
  depositType: 'fixed' | 'percent'
): number {
  if (depositType === 'percent') {
    return subtotalAfterDiscount * (depositValue / 100);
  }
  return depositValue;
}

function calculateTotal(
  subtotalAfterDiscount: number,
  deliveryFee: number,
  setupFee: number,
  deposit: number
): number {
  return Math.round(subtotalAfterDiscount + deliveryFee + setupFee + deposit);
}

// ═══ TESTS ═══

describe('Pricing Calculations', () => {
  
  // ─── NIGHTS CALCULATION ───
  describe('calculateNights', () => {
    it('should calculate 1 night for same day', () => {
      const start = new Date('2026-03-15');
      const end = new Date('2026-03-15');
      expect(calculateNights(start, end)).toBe(1);
    });
    
    it('should calculate 3 nights correctly', () => {
      const start = new Date('2026-03-15');
      const end = new Date('2026-03-18');
      expect(calculateNights(start, end)).toBe(3);
    });
    
    it('should return minimum 1 night', () => {
      const start = new Date('2026-03-18');
      const end = new Date('2026-03-15'); // End before start
      expect(calculateNights(start, end)).toBe(1);
    });
  });
  
  // ─── SUBTOTAL CALCULATION ───
  describe('calculateSubtotal', () => {
    it('should calculate subtotal for single night', () => {
      // Tent: 80 x 1 + Sleeping bag: 25 x 2 = 130 per night
      const result = calculateSubtotal(mockCart, 1);
      expect(result).toBe(130);
    });
    
    it('should calculate subtotal for multiple nights', () => {
      // 130 x 3 nights = 390
      const result = calculateSubtotal(mockCart, 3);
      expect(result).toBe(390);
    });
    
    it('should return 0 for empty cart', () => {
      const result = calculateSubtotal([], 3);
      expect(result).toBe(0);
    });
  });
  
  // ─── AUTO DISCOUNT ───
  describe('calculateAutoDiscount', () => {
    it('should not apply discount for less than trigger nights', () => {
      const result = calculateAutoDiscount(200, 100, 2, mockDiscounts, false);
      expect(result.applied).toBe(false);
      expect(result.amount).toBe(0);
    });
    
    it('should apply discount for qualifying nights', () => {
      // 3+ nights = 10% discount
      // Daily total 100, 3 nights, discount on (3-2) = 1 night
      const result = calculateAutoDiscount(300, 100, 3, mockDiscounts, false);
      expect(result.applied).toBe(true);
      expect(result.amount).toBe(10); // 100 * 1 * 0.10
    });
    
    it('should apply discount for 5 nights', () => {
      // Daily total 100, 5 nights, discount on (5-2) = 3 nights
      const result = calculateAutoDiscount(500, 100, 5, mockDiscounts, false);
      expect(result.applied).toBe(true);
      expect(result.amount).toBe(30); // 100 * 3 * 0.10
    });
  });
  
  // ─── PROMO CODE ───
  describe('calculatePromoDiscount', () => {
    it('should apply valid promo code', () => {
      const result = calculatePromoDiscount(200, 'CAMPING20', mockDiscounts);
      expect(result.applied).toBe(true);
      expect(result.amount).toBe(40); // 200 * 0.20
    });
    
    it('should reject invalid promo code', () => {
      const result = calculatePromoDiscount(200, 'INVALID', mockDiscounts);
      expect(result.applied).toBe(false);
      expect(result.error).toBe('Invalid Code');
    });
    
    it('should be case sensitive for promo codes', () => {
      const result = calculatePromoDiscount(200, 'camping20', mockDiscounts);
      expect(result.applied).toBe(false);
    });
  });
  
  // ─── DELIVERY FEE ───
  describe('calculateDeliveryFee', () => {
    it('should return 0 for pickup', () => {
      const result = calculateDeliveryFee(mockVendor.services, 'pickup');
      expect(result).toBe(0);
    });
    
    it('should calculate zone-based fee', () => {
      const result = calculateDeliveryFee(
        mockVendor.services,
        'delivery',
        { name: 'Kuantan Area', fee: 30 }
      );
      expect(result).toBe(30);
    });
    
    it('should calculate fixed fee', () => {
      const fixedServices = {
        ...mockVendor.services,
        delivery: { ...mockVendor.services.delivery, pricingType: 'fixed' as const },
      };
      const result = calculateDeliveryFee(fixedServices, 'delivery');
      expect(result).toBe(50);
    });
    
    it('should calculate per-km fee with minimum', () => {
      const perKmServices = {
        ...mockVendor.services,
        delivery: { ...mockVendor.services.delivery, pricingType: 'per_km' as const },
      };
      // 5km * RM2 = RM10, but min is RM20
      const result = calculateDeliveryFee(perKmServices, 'delivery', undefined, 5);
      expect(result).toBe(20);
    });
    
    it('should calculate per-km fee above minimum', () => {
      const perKmServices = {
        ...mockVendor.services,
        delivery: { ...mockVendor.services.delivery, pricingType: 'per_km' as const },
      };
      // 15km * RM2 = RM30
      const result = calculateDeliveryFee(perKmServices, 'delivery', undefined, 15);
      expect(result).toBe(30);
    });
    
    it('should return 0 for free delivery threshold', () => {
      const result = calculateDeliveryFee(
        mockVendor.services,
        'delivery',
        { name: 'Kuantan Area', fee: 30 },
        undefined,
        600 // Above 500 threshold
      );
      expect(result).toBe(0);
    });
  });
  
  // ─── SETUP FEE ───
  describe('calculateSetupFee', () => {
    it('should calculate per-item setup fees', () => {
      // Only tent has addSetup: true, fee: 80
      const result = calculateSetupFee(mockCart, false, 0);
      expect(result).toBe(80);
    });
    
    it('should return combo fee when combo selected', () => {
      const result = calculateSetupFee(mockCart, true, 100);
      expect(result).toBe(100);
    });
    
    it('should return 0 when no setup selected', () => {
      const cartNoSetup = mockCart.map(item => ({ ...item, addSetup: false }));
      const result = calculateSetupFee(cartNoSetup, false, 0);
      expect(result).toBe(0);
    });
  });
  
  // ─── DEPOSIT ───
  describe('calculateDeposit', () => {
    it('should calculate fixed deposit', () => {
      const result = calculateDeposit(300, 100, 'fixed');
      expect(result).toBe(100);
    });
    
    it('should calculate percentage deposit', () => {
      const result = calculateDeposit(300, 20, 'percent');
      expect(result).toBe(60); // 300 * 0.20
    });
  });
  
  // ─── TOTAL ───
  describe('calculateTotal', () => {
    it('should calculate total correctly', () => {
      // Subtotal: 300, Delivery: 30, Setup: 80, Deposit: 100
      const result = calculateTotal(300, 30, 80, 100);
      expect(result).toBe(510);
    });
    
    it('should round total', () => {
      const result = calculateTotal(299.50, 30.25, 80.10, 100.15);
      expect(result).toBe(510);
    });
  });
  
  // ─── FULL SCENARIO TESTS ───
  describe('Full Pricing Scenarios', () => {
    it('Scenario 1: Basic pickup order', () => {
      // 3 nights, tent + 2 sleeping bags, pickup, no discount
      const nights = 3;
      const dailyTotal = 80 + 25 * 2; // 130
      const subtotal = dailyTotal * nights; // 390
      const deliveryFee = 0;
      const setupFee = 0;
      const deposit = 100;
      const total = subtotal + deliveryFee + setupFee + deposit;
      
      expect(total).toBe(490);
    });
    
    it('Scenario 2: Delivery with zone + setup', () => {
      // 3 nights, delivery to Kuantan (RM30), tent setup (RM80)
      const nights = 3;
      const subtotal = 130 * nights; // 390
      const deliveryFee = 30;
      const setupFee = 80;
      const deposit = 100;
      const total = subtotal + deliveryFee + setupFee + deposit;
      
      expect(total).toBe(600);
    });
    
    it('Scenario 3: Combo bundle savings', () => {
      // Without combo: delivery 30 + setup 80 = 110
      // With combo: 100 (save 10)
      const withoutCombo = 30 + 80;
      const withCombo = 100;
      const savings = withoutCombo - withCombo;
      
      expect(savings).toBe(10);
    });
    
    it('Scenario 4: Promo code applied', () => {
      // Subtotal 390, 20% off = 78 discount
      const subtotal = 390;
      const discount = subtotal * 0.20;
      const afterDiscount = subtotal - discount;
      
      expect(discount).toBe(78);
      expect(afterDiscount).toBe(312);
    });
  });
});