const { test } = require('node:test');
const assert = require('node:assert/strict');
const { seed, apply, searchTrips, publicCourses } = require('../../server/business.cjs');
const setup = () => apply(seed(), 'company.save', { name: 'Northline', contact: 'Demo Seller', industry: 'Technology' }).state;
const run = (s, type, payload) => apply(s, type, payload).state;

test('business registration gates all operations and rejects malformed payloads', () => {
  assert.throws(() => run(seed(), 'transfer.send', {}), /profile first/);
  assert.throws(() => run(seed(), 'company.save', { name: '<', contact: 'Seller', industry: 'Tech' }), /Company name/);
  assert.throws(() => run(setup(), 'company.save', null), /Invalid action/);
});
test('seller acceptance reserves stock once; shipping credits revenue once', () => {
  const initial = setup();
  let s = run(initial, 'quote.send', { id: 'RFQ-1042', price: '200.05' });
  s = run(s, 'quote.accept', { id: 'RFQ-1042' });
  assert.equal(s.products[0].stock, 70); assert.equal(initial.products[0].stock, 80);
  assert.throws(() => run(s, 'quote.accept', { id: 'RFQ-1042' }), /Only an open quote/);
  s = run(s, 'order.ship', { id: s.orders[0].id, tracking: 'DEMO-TRACK' });
  assert.equal(s.balanceCents, 2700050);
  assert.throws(() => run(s, 'order.ship', { id: s.orders[0].id, tracking: 'DEMO-TRACK' }), /Only confirmed/);
});
test('inventory enforces unique SKUs, minimum quantities and availability', () => {
  let s = setup();
  assert.throws(() => run(s, 'product.save', { name: 'Another desk', sku: 'VX-DESK-01', price: '12', stock: 10, minimum: 1, status: 'Active' }), /SKU already exists/);
  s = run(s, 'quote.send', { id: 'RFQ-1042', price: '200' });
  s.products[0].stock = 0;
  assert.throws(() => run(s, 'quote.accept', { id: 'RFQ-1042' }), /enough eligible stock/);
});
test('sample buyers can request new listings; cancellation restores reserved inventory without a payment', () => {
  let s = setup();
  s = run(s, 'product.save', { name: 'Conference microphone', sku: 'MIC-NEW', price: '89.95', stock: 60, minimum: 5, status: 'Active' });
  const productId = s.products.at(-1).id;
  assert.throws(() => run(s, 'rfq.create', { productId, buyer: 'Demo Buyer', quantity: 2 }), /minimum order/);
  s = run(s, 'rfq.create', { productId, buyer: 'Demo Buyer', quantity: 10 });
  const rfq = s.rfqs[0];
  s = run(s, 'quote.send', { id: rfq.id, price: '80' });
  s = run(s, 'quote.accept', { id: rfq.id });
  assert.equal(s.products.at(-1).stock, 50);
  const orderId = s.orders[0].id;
  s = run(s, 'order.cancel', { id: orderId });
  assert.equal(s.products.at(-1).stock, 60); assert.equal(s.balanceCents, 2500000);
  assert.throws(() => run(s, 'order.cancel', { id: orderId }), /Only confirmed/);
  assert.throws(() => run(s, 'order.ship', { id: orderId, tracking: 'DEMO-TRACK' }), /Only confirmed/);
});
test('money uses integer cents, rejects invalid amounts and cannot overdraw', () => {
  let s = setup();
  for (const amount of ['-1', '0', '1.005', 'Infinity', '1e4', 100]) assert.throws(() => run(s, 'transfer.send', { beneficiaryId: 'supplier', amount, reference: 'Test transfer' }));
  assert.throws(() => run(s, 'transfer.send', { beneficiaryId: 'supplier', amount: '25000.01', reference: 'Test transfer' }), /Insufficient/);
  s = run(s, 'transfer.send', { beneficiaryId: 'supplier', amount: '0.10', reference: 'Test transfer' });
  assert.equal(s.balanceCents, 2499990); assert.equal(s.ledger[0].amountCents, -10);
  assert.throws(() => run(s, 'beneficiary.add', { name: 'Real account', account: '123456789' }), /DEMO-/);
});
test('booking ignores client fare and refunds exactly once', () => {
  let s = setup();
  const trip = { from: 'Bengaluru', to: 'Delhi', date: '2099-12-20', travellers: 2, tripId: 'morning', traveller: 'Demo Traveller', totalCents: 1 };
  s = run(s, 'travel.book', trip);
  assert.equal(s.bookings[0].totalCents, 24000); assert.equal(s.balanceCents, 2476000);
  s = run(s, 'travel.cancel', { id: s.bookings[0].id });
  assert.equal(s.balanceCents, 2500000);
  assert.throws(() => run(s, 'travel.cancel', { id: s.bookings[0].id }), /already been cancelled/);
});
test('travel rejects same-city routes, invalid dates and unreasonable passenger counts', () => {
  const query = { from: 'Bengaluru', to: 'Delhi', date: '2099-12-20', travellers: 1 };
  assert.throws(() => searchTrips({ ...query, to: query.from }), /different/);
  for (const date of ['2000-01-01', '2099-02-30', 'not-a-date']) assert.throws(() => searchTrips({ ...query, date }), /valid departure/);
  assert.throws(() => searchTrips({ ...query, travellers: 7 }), /Travellers/);
});
test('assessment cannot bypass enrollment or lessons; incorrect answers do not award certificates', () => {
  let s = setup();
  assert.throws(() => run(s, 'quiz.submit', { id: 'seller', answer: 0 }), /Complete every lesson/);
  s = run(s, 'course.enroll', { id: 'seller' });
  assert.throws(() => run(s, 'lesson.complete', { id: 'seller', lesson: 20 }), /Lesson/);
  s = run(s, 'lesson.complete', { id: 'seller', lesson: 0 });
  assert.throws(() => run(s, 'quiz.submit', { id: 'seller', answer: 0 }), /Complete every lesson/);
  s = run(s, 'lesson.complete', { id: 'seller', lesson: 1 });
  assert.throws(() => run(s, 'quiz.submit', { id: 'seller', answer: 2 }), /not correct/);
  s = run(s, 'quiz.submit', { id: 'seller', answer: 0 });
  assert.equal(s.learning.seller.passed, true); assert.match(s.learning.seller.certificate, /^CERT-/);
  assert.equal('answer' in publicCourses()[0], false);
});
