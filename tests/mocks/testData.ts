// __mocks__/testData.ts

// ═══ MOCK VENDOR DATA ═══
export const mockVendor = {
  id: 'vendor-123',
  name: 'Test Camping Gear',
  slug: 'test-camping',
  phone: '60123456789',
  city: 'Kuantan',
  tagline: 'Quality gear for outdoor adventures',
  status: 'approved',
  credits: 50,
  is_vacation: false,
  pickup: ['Kuantan Hub', 'Indera Mahkota'],
  security_deposit: 100,
  security_deposit_type: 'fixed',
  allow_stacking: true,
  rules: [
    'No smoking near gear',
    'Return clean and dry',
  ],
  services: {
    delivery: {
      enabled: true,
      pricingType: 'zones',
      fixedFee: 50,
      perKmRate: 2,
      minFee: 20,
      zones: [
        { name: 'Kuantan Area', fee: 30 },
        { name: 'Pahang', fee: 60 },
      ],
      freeAbove: 500,
      notes: 'Delivery available in Pahang',
    },
    setup: {
      enabled: true,
      fee: 80,
      description: 'Full tent setup at campsite',
    },
    combo: {
      enabled: true,
      fee: 100,
    },
    timeSlots: {
      enabled: true,
      slots: [
        { time: '9:00 AM - 12:00 PM', label: 'Morning' },
        { time: '2:00 PM - 5:00 PM', label: 'Afternoon' },
      ],
    },
  },
};

// ═══ MOCK GEAR DATA ═══
export const mockGear = [
  {
    id: 'gear-1',
    name: 'Naturehike 6P Tent',
    price: 80,
    stock: 5,
    category: 'Tents',
    img: '/test-tent.jpg',
    desc: 'Spacious 6-person tent',
    setup: {
      available: true,
      fee: 80,
      description: 'Full tent pitching',
    },
  },
  {
    id: 'gear-2',
    name: 'Sleeping Bag',
    price: 25,
    stock: 10,
    category: 'Sleeping',
    img: '/test-bag.jpg',
    desc: 'Warm sleeping bag',
    setup: {
      available: true,
      fee: 15,
      description: 'Setup included',
    },
  },
  {
    id: 'gear-3',
    name: 'Camping Chair',
    price: 15,
    stock: 20,
    category: 'Furniture',
    img: '/test-chair.jpg',
    desc: 'Foldable camping chair',
    setup: {
      available: false,
      fee: 0,
      description: '',
    },
  },
];

// ═══ MOCK CART DATA ═══
export const mockCart = [
  { ...mockGear[0], qty: 1, addSetup: true },
  { ...mockGear[1], qty: 2, addSetup: false },
];

// ═══ MOCK DISCOUNTS ═══
export const mockDiscounts = [
  {
    id: 'disc-1',
    type: 'nightly_discount',
    trigger_nights: 3,
    discount_percent: 10,
    is_public: true,
  },
  {
    id: 'disc-2',
    type: 'promo_code',
    code: 'CAMPING20',
    discount_percent: 20,
    is_public: false,
  },
];

// ═══ MOCK ADMIN DATA ═══
export const mockTransactions = [
  {
    id: 'tx-1',
    vendorId: 'vendor-123',
    vendorName: 'Test Camping Gear',
    amount: 100,
    credits: 50,
    type: 'purchase',
    createdAt: { toDate: () => new Date('2026-03-01') },
  },
  {
    id: 'tx-2',
    vendorId: 'vendor-456',
    vendorName: 'Another Vendor',
    amount: 50,
    credits: 25,
    type: 'purchase',
    createdAt: { toDate: () => new Date('2026-03-05') },
  },
];

export const mockTestimonials = [
  {
    id: 'test-1',
    name: 'Ahmad',
    location: 'Kuala Lumpur',
    text: 'Great service!',
    rating: 5,
  },
  {
    id: 'test-2',
    name: 'Sarah',
    location: 'Penang',
    text: 'Easy to use platform',
    rating: 4,
  },
];

export const mockEvents = [
  {
    id: 'event-1',
    name: 'Camping Festival 2026',
    organizer: 'Tourism Malaysia',
    poster: '/event-poster.jpg',
    link: 'https://example.com/event',
  },
];

// ═══ MOCK USER ═══
export const mockAdminUser = {
  uid: 'admin-uid',
  email: 'akiff.work@gmail.com',
};

export const mockVendorUser = {
  uid: 'vendor-uid',
  email: 'vendor@test.com',
};

export const mockCustomerUser = {
  uid: 'customer-uid',
  email: 'customer@test.com',
};