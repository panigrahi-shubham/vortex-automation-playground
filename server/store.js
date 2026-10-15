// In-memory data store. Everything here is wiped by POST /api/reset.
const CATEGORIES = ['Electronics', 'Books', 'Home', 'Toys', 'Fashion'];

const CATALOG = {
  Electronics: [
    ['Wireless Earbuds', 59.99], ['Mechanical Keyboard', 89.5], ['4K Webcam', 74], ['USB-C Hub 7-in-1', 34.99],
    ['Smart Watch S2', 149], ['Bluetooth Speaker', 45.25], ['Portable SSD 1TB', 109.99], ['Noise-Cancelling Headphones', 199]
  ],
  Books: [
    ['The Pragmatic Tester', 24.99], ['Clean Automation', 31.5], ['From Selenium to Playwright', 27], ['API Testing Handbook', 19.99],
    ['Agile QA Field Guide', 22.75], ['Performance Testing 101', 29.99], ['TypeScript for Testers', 33], ['Bug Hunting Notebook', 9.99]
  ],
  Home: [
    ['Ceramic Coffee Mug', 12.5], ['LED Desk Lamp', 38.99], ['Bamboo Cutting Board', 21], ['Knitted Throw Blanket', 49.99],
    ['Minimal Wall Clock', 27.5], ['Plant Pot Set (3)', 18.99], ['Aroma Diffuser', 32], ['Woven Storage Basket', 16.75]
  ],
  Toys: [
    ['Robot Building Kit', 64.99], ['1000-Piece Puzzle', 17.5], ['Wooden Train Set', 42], ['Remote Control Car', 55.99],
    ['Strategy Board Game', 36.25], ['Plush Panda', 14.99], ['Magnetic Tiles (60)', 47.5], ['Rainbow Kite', 11.99]
  ],
  Fashion: [
    ['Classic Hoodie', 44.99], ['Running Shoes', 79.99], ['Denim Jacket', 69.5], ['Cotton T-Shirt', 15.99],
    ['Wool Beanie', 13.5], ['Leather Belt', 25], ['Canvas Backpack', 52.99], ['Sports Socks (3-pack)', 9.5]
  ]
};

function seedProducts() {
  const list = [];
  let id = 1;
  for (let round = 0; round < 8; round++) {
    for (const cat of CATEGORIES) {
      const [name, price] = CATALOG[cat][round];
      const n = id;
      const p = {
        id: n,
        sku: `SL-${cat.slice(0, 3).toUpperCase()}-${String(n).padStart(3, '0')}`,
        name,
        category: cat,
        price,
        // every 7th item is out of stock, every 9th is low stock
        stock: n % 7 === 0 ? 0 : n % 9 === 0 ? 2 : 20 + ((n * 13) % 40),
        rating: 0,
        reviewCount: 0,
        description: `${name} from the ShopLab ${cat} range. Built for testers who like their assertions green. SKU-level data is stable across resets so your tests stay deterministic.`,
        createdAt: new Date(Date.UTC(2026, 0, 1 + n)).toISOString(),
        onSale: n % 6 === 0,
        variants: null
      };
      if (p.onSale) p.originalPrice = +(price * 1.25).toFixed(2);
      if (cat === 'Fashion') {
        p.variants = {
          size: name === 'Running Shoes' ? ['7', '8', '9', '10', '11'] : ['S', 'M', 'L', 'XL'],
          color: ['Black', 'Navy', 'Sand']
        };
      }
      list.push(p);
      id++;
    }
  }
  return list;
}

function seedUsers() {
  const base = (username, extra = {}) => ({
    username,
    password: 'secret123',
    email: `${username}@shoplab.test`,
    name: username.split('_').map(s => s[0].toUpperCase() + s.slice(1)).join(' '),
    phone: '',
    role: 'customer',
    locked: false,
    failedAttempts: 0,
    avatar: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...extra
  });
  return {
    standard_user: base('standard_user'),
    locked_user: base('locked_user', { locked: true }),
    slow_user: base('slow_user', { delay: 3000 }),
    problem_user: base('problem_user', { bug: true }),
    mfa_user: base('mfa_user', { mfa: true }),
    admin_user: base('admin_user', { role: 'admin', name: 'Admin User' })
  };
}

function seedReviews() {
  // a few deterministic reviews so detail pages are not empty
  const r = [];
  const authors = ['asha_k', 'dev_ravi', 'qa_meera', 'tester_john'];
  const texts = [
    ['Does the job', 'Exactly as described, arrived on time.'],
    ['Great value', 'Better than I expected for the price.'],
    ['Average', 'Works fine but the packaging was damaged.'],
    ['Love it', 'Bought a second one for my team lead.']
  ];
  let id = 1;
  for (let p = 1; p <= 40; p++) {
    const count = p % 4; // 0..3 reviews
    for (let k = 0; k < count; k++) {
      const [title, body] = texts[(p + k) % 4];
      r.push({ id: id++, productId: p, username: authors[(p + k) % 4], rating: 2 + ((p + k * 2) % 4), title, body, createdAt: new Date(Date.UTC(2026, 1, p, k)).toISOString() });
    }
  }
  return r;
}

const COUPONS = {
  SAVE10: { type: 'percent', value: 10, label: '10% off' },
  FLAT50: { type: 'flat', value: 50, min: 200, label: '$50 off orders over $200' },
  FREESHIP: { type: 'shipping', value: 0, label: 'Free shipping' },
  EXPIRED20: { type: 'percent', value: 20, expired: true, label: '20% off (expired)' }
};

const SHIPPING = {
  standard: { label: 'Standard (5-7 days)', price: 5.99, freeOver: 100 },
  express: { label: 'Express (2-3 days)', price: 14.99 },
  nextday: { label: 'Next day', price: 24.99 }
};

const COUNTRIES = {
  IN: { name: 'India', states: ['Telangana', 'Karnataka', 'Maharashtra', 'Tamil Nadu', 'Jharkhand', 'Delhi'], zip: /^\d{6}$/, zipHint: '6 digits' },
  US: { name: 'United States', states: ['California', 'New York', 'Texas', 'Washington', 'Florida'], zip: /^\d{5}$/, zipHint: '5 digits' },
  UK: { name: 'United Kingdom', states: ['England', 'Scotland', 'Wales', 'Northern Ireland'], zip: /^[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}$/i, zipHint: 'UK postcode, e.g. SW1A 1AA' }
};

const DEFAULT_CHAOS = { latencyMs: 0, errorRate: 0, bugMode: false, sessionTtlSec: 3600, orderProgressSec: 15 };

const db = {};
function reset() {
  db.products = seedProducts();
  db.users = seedUsers();
  db.reviews = seedReviews();
  db.sessions = {};      // token -> { username, expiresAt }
  db.mfa = {};           // mfaToken -> { username, code, attempts, expiresAt, remember }
  db.resetCodes = {};    // email -> { code, expiresAt }
  db.carts = {};         // username -> { items:[{productId, qty, variant}], coupon, shipping }
  db.wishlists = {};     // username -> [productId]
  db.orders = [];        // all orders, newest first
  db.challenges = {};    // 3DS challengeId -> { username, payload }
  db.mailbox = [];       // fake email inbox
  db.chaos = { ...DEFAULT_CHAOS };
  db.nextOrder = 100001;
  db.nextProduct = 41;
  db.nextReview = 1000;
  db.nextMail = 1;
  recomputeRatings();
}
function recomputeRatings() {
  for (const p of db.products) {
    const rs = db.reviews.filter(r => r.productId === p.id);
    p.reviewCount = rs.length;
    p.rating = rs.length ? +(rs.reduce((s, r) => s + r.rating, 0) / rs.length).toFixed(1) : 0;
  }
}
reset();

module.exports = { db, reset, recomputeRatings, CATEGORIES, COUPONS, SHIPPING, COUNTRIES, DEFAULT_CHAOS };
