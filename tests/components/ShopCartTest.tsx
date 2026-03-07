// __tests__/components/ShopCart.test.tsx
/**
 * Component Tests for Shop Cart Modal
 * Tests cart functionality, fulfillment selection, and checkout
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockVendor, mockGear, mockCart, mockDiscounts } from '../mocks/testData';

// Mock Cart Component (simplified for testing)
function CartModal({
  cart,
  vendor,
  onUpdateQty,
  onToggleSetup,
  onFulfillmentChange,
  onSubmit,
}: {
  cart: typeof mockCart;
  vendor: typeof mockVendor;
  onUpdateQty: (id: string, delta: number) => void;
  onToggleSetup: (id: string) => void;
  onFulfillmentChange: (type: 'pickup' | 'delivery') => void;
  onSubmit: () => void;
}) {
  const [fulfillmentType, setFulfillmentType] = React.useState<'pickup' | 'delivery'>('pickup');
  const [deliveryAddress, setDeliveryAddress] = React.useState('');
  const [selectedZone, setSelectedZone] = React.useState<{ name: string; fee: number } | null>(null);
  const [termsAgreed, setTermsAgreed] = React.useState(false);

  const handleFulfillmentChange = (type: 'pickup' | 'delivery') => {
    setFulfillmentType(type);
    onFulfillmentChange(type);
  };

  const canSubmit = cart.length > 0 && termsAgreed && 
    (fulfillmentType === 'pickup' || (fulfillmentType === 'delivery' && deliveryAddress));

  return (
    <div data-testid="cart-modal">
      <h2>Your Cart</h2>
      
      {/* Cart Items */}
      <div data-testid="cart-items">
        {cart.map(item => (
          <div key={item.id} data-testid={`cart-item-${item.id}`}>
            <span>{item.name}</span>
            <span>Qty: {item.qty}</span>
            <button onClick={() => onUpdateQty(item.id, -1)} data-testid={`decrease-${item.id}`}>-</button>
            <button onClick={() => onUpdateQty(item.id, 1)} data-testid={`increase-${item.id}`}>+</button>
            {item.setup?.available && (
              <label>
                <input
                  type="checkbox"
                  checked={item.addSetup || false}
                  onChange={() => onToggleSetup(item.id)}
                  data-testid={`setup-${item.id}`}
                />
                Add Setup +RM{item.setup.fee}
              </label>
            )}
          </div>
        ))}
      </div>

      {/* Fulfillment Selection */}
      {vendor.services?.delivery?.enabled && (
        <div data-testid="fulfillment-section">
          <button
            onClick={() => handleFulfillmentChange('pickup')}
            data-testid="btn-pickup"
            className={fulfillmentType === 'pickup' ? 'active' : ''}
          >
            Self Pickup
          </button>
          <button
            onClick={() => handleFulfillmentChange('delivery')}
            data-testid="btn-delivery"
            className={fulfillmentType === 'delivery' ? 'active' : ''}
          >
            Delivery
          </button>
          
          {fulfillmentType === 'delivery' && (
            <div data-testid="delivery-options">
              <input
                type="text"
                placeholder="Enter delivery address"
                value={deliveryAddress}
                onChange={e => setDeliveryAddress(e.target.value)}
                data-testid="delivery-address"
              />
              
              {vendor.services.delivery.pricingType === 'zones' && (
                <div data-testid="zone-selection">
                  {vendor.services.delivery.zones.map(zone => (
                    <label key={zone.name}>
                      <input
                        type="radio"
                        name="zone"
                        checked={selectedZone?.name === zone.name}
                        onChange={() => setSelectedZone(zone)}
                        data-testid={`zone-${zone.name.replace(/\s/g, '-')}`}
                      />
                      {zone.name} - RM{zone.fee}
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Terms */}
      <label>
        <input
          type="checkbox"
          checked={termsAgreed}
          onChange={e => setTermsAgreed(e.target.checked)}
          data-testid="terms-checkbox"
        />
        I agree to the terms
      </label>

      {/* Submit */}
      <button
        onClick={onSubmit}
        disabled={!canSubmit}
        data-testid="submit-order"
      >
        Submit Order via WhatsApp
      </button>
    </div>
  );
}

describe('CartModal Component', () => {
  const mockUpdateQty = jest.fn();
  const mockToggleSetup = jest.fn();
  const mockFulfillmentChange = jest.fn();
  const mockSubmit = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── RENDERING ───
  describe('Rendering', () => {
    it('should render cart items', () => {
      render(
        <CartModal
          cart={mockCart}
          vendor={mockVendor}
          onUpdateQty={mockUpdateQty}
          onToggleSetup={mockToggleSetup}
          onFulfillmentChange={mockFulfillmentChange}
          onSubmit={mockSubmit}
        />
      );

      expect(screen.getByTestId('cart-item-gear-1')).toBeInTheDocument();
      expect(screen.getByTestId('cart-item-gear-2')).toBeInTheDocument();
    });

    it('should show fulfillment options when delivery enabled', () => {
      render(
        <CartModal
          cart={mockCart}
          vendor={mockVendor}
          onUpdateQty={mockUpdateQty}
          onToggleSetup={mockToggleSetup}
          onFulfillmentChange={mockFulfillmentChange}
          onSubmit={mockSubmit}
        />
      );

      expect(screen.getByTestId('btn-pickup')).toBeInTheDocument();
      expect(screen.getByTestId('btn-delivery')).toBeInTheDocument();
    });

    it('should show setup checkbox for items with setup available', () => {
      render(
        <CartModal
          cart={mockCart}
          vendor={mockVendor}
          onUpdateQty={mockUpdateQty}
          onToggleSetup={mockToggleSetup}
          onFulfillmentChange={mockFulfillmentChange}
          onSubmit={mockSubmit}
        />
      );

      // Tent has setup available
      expect(screen.getByTestId('setup-gear-1')).toBeInTheDocument();
      // Sleeping bag also has setup
      expect(screen.getByTestId('setup-gear-2')).toBeInTheDocument();
    });
  });

  // ─── INTERACTIONS ───
  describe('Interactions', () => {
    it('should call onUpdateQty when quantity buttons clicked', async () => {
      const user = userEvent.setup();
      
      render(
        <CartModal
          cart={mockCart}
          vendor={mockVendor}
          onUpdateQty={mockUpdateQty}
          onToggleSetup={mockToggleSetup}
          onFulfillmentChange={mockFulfillmentChange}
          onSubmit={mockSubmit}
        />
      );

      await user.click(screen.getByTestId('increase-gear-1'));
      expect(mockUpdateQty).toHaveBeenCalledWith('gear-1', 1);

      await user.click(screen.getByTestId('decrease-gear-1'));
      expect(mockUpdateQty).toHaveBeenCalledWith('gear-1', -1);
    });

    it('should call onToggleSetup when setup checkbox clicked', async () => {
      const user = userEvent.setup();
      
      render(
        <CartModal
          cart={mockCart}
          vendor={mockVendor}
          onUpdateQty={mockUpdateQty}
          onToggleSetup={mockToggleSetup}
          onFulfillmentChange={mockFulfillmentChange}
          onSubmit={mockSubmit}
        />
      );

      await user.click(screen.getByTestId('setup-gear-1'));
      expect(mockToggleSetup).toHaveBeenCalledWith('gear-1');
    });

    it('should show delivery options when delivery selected', async () => {
      const user = userEvent.setup();
      
      render(
        <CartModal
          cart={mockCart}
          vendor={mockVendor}
          onUpdateQty={mockUpdateQty}
          onToggleSetup={mockToggleSetup}
          onFulfillmentChange={mockFulfillmentChange}
          onSubmit={mockSubmit}
        />
      );

      await user.click(screen.getByTestId('btn-delivery'));
      
      expect(screen.getByTestId('delivery-options')).toBeInTheDocument();
      expect(screen.getByTestId('delivery-address')).toBeInTheDocument();
      expect(mockFulfillmentChange).toHaveBeenCalledWith('delivery');
    });

    it('should show zone selection for zone-based delivery', async () => {
      const user = userEvent.setup();
      
      render(
        <CartModal
          cart={mockCart}
          vendor={mockVendor}
          onUpdateQty={mockUpdateQty}
          onToggleSetup={mockToggleSetup}
          onFulfillmentChange={mockFulfillmentChange}
          onSubmit={mockSubmit}
        />
      );

      await user.click(screen.getByTestId('btn-delivery'));
      
      expect(screen.getByTestId('zone-selection')).toBeInTheDocument();
      expect(screen.getByTestId('zone-Kuantan-Area')).toBeInTheDocument();
      expect(screen.getByTestId('zone-Pahang')).toBeInTheDocument();
    });
  });

  // ─── FORM VALIDATION ───
  describe('Form Validation', () => {
    it('should disable submit when terms not agreed', () => {
      render(
        <CartModal
          cart={mockCart}
          vendor={mockVendor}
          onUpdateQty={mockUpdateQty}
          onToggleSetup={mockToggleSetup}
          onFulfillmentChange={mockFulfillmentChange}
          onSubmit={mockSubmit}
        />
      );

      expect(screen.getByTestId('submit-order')).toBeDisabled();
    });

    it('should enable submit when terms agreed (pickup)', async () => {
      const user = userEvent.setup();
      
      render(
        <CartModal
          cart={mockCart}
          vendor={mockVendor}
          onUpdateQty={mockUpdateQty}
          onToggleSetup={mockToggleSetup}
          onFulfillmentChange={mockFulfillmentChange}
          onSubmit={mockSubmit}
        />
      );

      await user.click(screen.getByTestId('terms-checkbox'));
      
      expect(screen.getByTestId('submit-order')).not.toBeDisabled();
    });

    it('should disable submit when delivery selected but no address', async () => {
      const user = userEvent.setup();
      
      render(
        <CartModal
          cart={mockCart}
          vendor={mockVendor}
          onUpdateQty={mockUpdateQty}
          onToggleSetup={mockToggleSetup}
          onFulfillmentChange={mockFulfillmentChange}
          onSubmit={mockSubmit}
        />
      );

      await user.click(screen.getByTestId('btn-delivery'));
      await user.click(screen.getByTestId('terms-checkbox'));
      
      expect(screen.getByTestId('submit-order')).toBeDisabled();
    });

    it('should enable submit when delivery address entered', async () => {
      const user = userEvent.setup();
      
      render(
        <CartModal
          cart={mockCart}
          vendor={mockVendor}
          onUpdateQty={mockUpdateQty}
          onToggleSetup={mockToggleSetup}
          onFulfillmentChange={mockFulfillmentChange}
          onSubmit={mockSubmit}
        />
      );

      await user.click(screen.getByTestId('btn-delivery'));
      await user.type(screen.getByTestId('delivery-address'), 'Teluk Cempedak Campsite');
      await user.click(screen.getByTestId('terms-checkbox'));
      
      expect(screen.getByTestId('submit-order')).not.toBeDisabled();
    });
  });

  // ─── SUBMIT ───
  describe('Submit Order', () => {
    it('should call onSubmit when form is valid', async () => {
      const user = userEvent.setup();
      
      render(
        <CartModal
          cart={mockCart}
          vendor={mockVendor}
          onUpdateQty={mockUpdateQty}
          onToggleSetup={mockToggleSetup}
          onFulfillmentChange={mockFulfillmentChange}
          onSubmit={mockSubmit}
        />
      );

      await user.click(screen.getByTestId('terms-checkbox'));
      await user.click(screen.getByTestId('submit-order'));
      
      expect(mockSubmit).toHaveBeenCalled();
    });
  });
});

// ─── EDGE CASES ───
describe('CartModal Edge Cases', () => {
  const mockUpdateQty = jest.fn();
  const mockToggleSetup = jest.fn();
  const mockFulfillmentChange = jest.fn();
  const mockSubmit = jest.fn();

  it('should handle empty cart', () => {
    render(
      <CartModal
        cart={[]}
        vendor={mockVendor}
        onUpdateQty={mockUpdateQty}
        onToggleSetup={mockToggleSetup}
        onFulfillmentChange={mockFulfillmentChange}
        onSubmit={mockSubmit}
      />
    );

    expect(screen.getByTestId('submit-order')).toBeDisabled();
  });

  it('should handle vendor without delivery service', () => {
    const vendorNoDelivery = {
      ...mockVendor,
      services: {
        ...mockVendor.services,
        delivery: { ...mockVendor.services.delivery, enabled: false },
      },
    };

    render(
      <CartModal
        cart={mockCart}
        vendor={vendorNoDelivery}
        onUpdateQty={mockUpdateQty}
        onToggleSetup={mockToggleSetup}
        onFulfillmentChange={mockFulfillmentChange}
        onSubmit={mockSubmit}
      />
    );

    expect(screen.queryByTestId('fulfillment-section')).not.toBeInTheDocument();
  });
});