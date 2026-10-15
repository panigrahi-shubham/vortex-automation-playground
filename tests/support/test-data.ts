/** Seed data that never changes between resets — safe to hard-code in tests. */
export const PASSWORD = 'secret123';
export const STRONG_PASSWORD = 'Playwright123';

export const USERS = {
  standard: 'standard_user',
  locked: 'locked_user',
  slow: 'slow_user',
  problem: 'problem_user',
  mfa: 'mfa_user',
  admin: 'admin_user'
} as const;

export const PRODUCTS = {
  earbuds: { id: 1, name: 'Wireless Earbuds', price: 59.99, category: 'Electronics' },
  pragmaticTester: { id: 2, name: 'The Pragmatic Tester', price: 24.99, category: 'Books' },
  mug: { id: 3, name: 'Ceramic Coffee Mug', price: 12.5, category: 'Home' },
  robotKit: { id: 4, name: 'Robot Building Kit', price: 64.99, category: 'Toys' },
  hoodie: { id: 5, name: 'Classic Hoodie', price: 44.99, category: 'Fashion', sizes: ['S', 'M', 'L', 'XL'], colors: ['Black', 'Navy', 'Sand'] },
  keyboard: { id: 6, name: 'Mechanical Keyboard', price: 89.5, category: 'Electronics' },
  outOfStock: { id: 7, name: 'Clean Automation', price: 31.5, category: 'Books' },
  lowStock: { id: 9, name: '1000-Piece Puzzle', price: 17.5, category: 'Toys', stock: 2 },
  headphones: { id: 36, name: 'Noise-Cancelling Headphones', price: 199, category: 'Electronics' }
} as const;

export const CARDS = {
  success: '4242 4242 4242 4242',
  threeDS: '4000 0027 6000 3184',
  declined: '4000 0000 0000 0002',
  insufficientFunds: '4000 0000 0000 9995',
  bankExpired: '4000 0000 0000 0069',
  invalidLuhn: '4242 4242 4242 4241'
} as const;
export const THREE_DS_CODE = '123456';

export const COUPONS = { percent10: 'SAVE10', flat50: 'FLAT50', freeShip: 'FREESHIP', expired: 'EXPIRED20' } as const;

export const ADDRESS = {
  fullName: 'Rupesh Kumar',
  phone: '9876543210',
  line1: 'Flat 12, Ameerpet Main Road',
  line2: '',
  city: 'Hyderabad',
  country: 'IN',
  state: 'Telangana',
  zip: '500016'
};
export const PAYMENT = (cardNumber: string = CARDS.success) => ({ cardNumber, expiry: '12/30', cvv: '123', cardName: 'Rupesh Kumar' });

export const TAX_RATE = 0.08;
export const STANDARD_SHIPPING = 5.99;
export const FREE_SHIPPING_OVER = 100;

/** "$1,234.50" -> 1234.5 */
export const money = (text: string | null) => Number((text ?? '').replace(/[^0-9.-]/g, ''));
export const round2 = (n: number) => Math.round(n * 100) / 100;
/** Unique, valid username (3-20 chars, [a-z0-9_]) — safe for parallel workers. */
export const uniqueName = (prefix = 'pw') => `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.slice(0, 20);
