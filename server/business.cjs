const { randomUUID } = require('node:crypto');

class BusinessError extends Error {
  constructor(message, status = 422, code) { super(message); this.status = status; this.code = code; }
}
const check = (condition, message, status) => { if (!condition) throw new BusinessError(message, status); };
const text = (value, label, max = 100) => {
  check(typeof value === 'string' && value.trim().length >= 2 && value.trim().length <= max, `${label} must be 2–${max} characters`);
  return value.trim();
};
const integer = (value, label, min = 1, max = 1000000) => {
  check(Number.isSafeInteger(value) && value >= min && value <= max, `${label} must be a whole number from ${min} to ${max}`);
  return value;
};
const money = (value) => {
  check(typeof value === 'string' && /^\d{1,7}(\.\d{1,2})?$/.test(value), 'Enter a positive amount with up to two decimal places');
  return integer(Math.round(Number(value) * 100), 'Amount in cents', 1, 100000000);
};
const COURSES = [
  { id: 'seller', title: 'Your first wholesale order', category: 'Seller essentials', duration: '12 min', color: 'blue',
    lessons: [{ title: 'Build a wholesale listing', body: 'A wholesale listing specifies a unique SKU, a unit price, available stock and a minimum order quantity. Buyers need these details to plan a purchase.' },
      { title: 'Quote and fulfil', body: 'Check available inventory before accepting a quote. Acceptance reserves the requested stock. Ship only confirmed orders and include a tracking reference.' }],
    question: 'What should you check before accepting a wholesale order?', options: ['Available stock and minimum quantity', 'Only the product colour', 'Your browser theme'], answer: 0 },
  { id: 'finance', title: 'Business payment fundamentals', category: 'Finance & banking', duration: '10 min', color: 'green',
    lessons: [{ title: 'Verify a beneficiary', body: 'Confirm the beneficiary name and account reference before sending a payment. A saved beneficiary helps you choose a known destination.' },
      { title: 'Reconcile your ledger', body: 'Match each transfer to a reference and inspect the balance after payment. Never retry an uncertain payment as a new transaction before checking its status.' }],
    question: 'What should you do before retrying an uncertain payment?', options: ['Send the amount again immediately', 'Check the transaction status', 'Delete the beneficiary'], answer: 1 },
  { id: 'travel', title: 'Travel smarter for work', category: 'Business travel', duration: '8 min', color: 'violet',
    lessons: [{ title: 'Plan a business trip', body: 'Select your origin, destination, departure date and number of travellers. Compare the total cost rather than just the price per seat.' },
      { title: 'Manage a reservation', body: 'Keep your booking reference and review the cancellation policy. In this simulated portal, cancelling a confirmed trip returns its full amount to your business balance.' }],
    question: 'Where does a cancelled trip refund appear in this portal?', options: ['In product inventory', 'Nowhere', 'In the business balance and ledger'], answer: 2 }
];
function publicCourses() { return COURSES.map(({ answer, ...course }) => course); }
const cities = ['Bengaluru', 'Delhi', 'Mumbai', 'Hyderabad', 'Chennai'];
function searchTrips(query, now = new Date()) {
  check(cities.includes(query.from) && cities.includes(query.to) && query.from !== query.to, 'Choose two different supported cities');
  const day = String(query.date || '');
  check(/^\d{4}-\d{2}-\d{2}$/.test(day) && Number.isFinite(Date.parse(day)) && new Date(day).toISOString().slice(0, 10) === day && day >= now.toISOString().slice(0, 10), 'Choose a valid departure date today or later');
  const travellers = integer(Number(query.travellers), 'Travellers', 1, 6);
  const base = 8500 + Math.abs(cities.indexOf(query.from) - cities.indexOf(query.to)) * 3500;
  return [
    { id: 'morning', airline: 'Vortex Air', departure: '08:30', arrival: '10:40', fareCents: base },
    { id: 'afternoon', airline: 'Meridian Airways', departure: '14:15', arrival: '16:25', fareCents: base + 2200 },
    { id: 'evening', airline: 'Vortex Air', departure: '19:00', arrival: '21:10', fareCents: base + 1200 }
  ].map(trip => ({ ...trip, from: query.from, to: query.to, date: day, travellers, totalCents: trip.fareCents * travellers }));
}
function seed() {
  return { company: null, products: [
    { id: 'desk', sku: 'VX-DESK-01', name: 'Adjustable office desk', priceCents: 24900, stock: 80, minimum: 5, status: 'Active' },
    { id: 'chair', sku: 'VX-CHAIR-02', name: 'Ergonomic task chair', priceCents: 12900, stock: 120, minimum: 10, status: 'Active' },
    { id: 'hub', sku: 'VX-HUB-03', name: 'USB-C business hub', priceCents: 4900, stock: 250, minimum: 20, status: 'Draft' }
  ], rfqs: [
    { id: 'RFQ-1042', buyer: 'Northstar Studio', productId: 'desk', quantity: 10, status: 'New', quoteCents: null },
    { id: 'RFQ-1043', buyer: 'Atlas Consulting', productId: 'chair', quantity: 20, status: 'New', quoteCents: null }
  ], orders: [], balanceCents: 2500000, beneficiaries: [{ id: 'supplier', name: 'Meridian Supplies', account: 'DEMO-1042' }],
  ledger: [{ id: 'opening', description: 'Opening demo balance', amountCents: 2500000, createdAt: new Date().toISOString(), reference: 'WELCOME' }],
  bookings: [], learning: {}, activity: [], requests: [] };
}
function apply(current, type, payload = {}, now = new Date()) {
  const s = structuredClone(current);
  check(payload && typeof payload === 'object' && !Array.isArray(payload), 'Invalid action details');
  const p = payload;
  const id = prefix => `${prefix}-${randomUUID().slice(0, 8).toUpperCase()}`;
  const find = (items, key, label) => { const item = items.find(x => x.id === key); check(item, `${label} not found`, 404); return item; };
  const ledger = (description, amountCents, reference) => {
    check(Number.isSafeInteger(amountCents) && Number.isSafeInteger(s.balanceCents + amountCents), 'This transaction exceeds the supported balance limit');
    s.balanceCents += amountCents;
    s.ledger.unshift({ id: id('TX'), description, amountCents, reference, createdAt: now.toISOString() });
  };
  let message;
  if (type === 'company.save') {
    s.company = { name: text(p.name, 'Company name'), contact: text(p.contact, 'Contact name'), industry: text(p.industry, 'Industry') };
    message = 'Business profile saved';
  } else {
    check(s.company, 'Set up your business profile first', 403);
    switch (type) {
      case 'product.save': {
        check(s.products.length < 100 || p.id, 'Your workspace supports up to 100 products');
        const sku = text(p.sku, 'SKU', 30).toUpperCase();
        check(!s.products.some(x => x.sku === sku && x.id !== p.id), 'This SKU already exists');
        const product = { id: p.id || id('SKU'), sku, name: text(p.name, 'Product name'), priceCents: money(p.price), stock: integer(p.stock, 'Stock', 0), minimum: integer(p.minimum, 'Minimum order'), status: p.status };
        check(['Active', 'Draft'].includes(product.status), 'Choose Active or Draft');
        if (p.id) Object.assign(find(s.products, p.id, 'Product'), product); else s.products.push(product);
        message = 'Product saved'; break;
      }
      case 'quote.send': {
        const rfq = find(s.rfqs, p.id, 'Request');
        check(rfq.status === 'New', 'This request has already been quoted', 409);
        const product = find(s.products, rfq.productId, 'Product');
        check(product.status === 'Active' && product.stock >= rfq.quantity && rfq.quantity >= product.minimum, 'Listing availability or minimum order does not meet this request');
        rfq.quoteCents = money(p.price); rfq.status = 'Quoted'; message = `Quote sent to ${rfq.buyer}`; break;
      }
      case 'rfq.create': {
        check(s.rfqs.length < 100, 'Your workspace supports up to 100 buyer requests');
        const product = find(s.products, p.productId, 'Product');
        const quantity = integer(p.quantity, 'Requested quantity');
        check(product.status === 'Active', 'Choose an active product');
        check(quantity >= product.minimum && quantity <= product.stock, 'Requested quantity must meet the minimum order and available stock');
        s.rfqs.unshift({ id: id('RFQ'), buyer: text(p.buyer, 'Sample buyer name'), productId: product.id, quantity, status: 'New', quoteCents: null });
        message = 'Sample buyer request created'; break;
      }
      case 'quote.accept': {
        const rfq = find(s.rfqs, p.id, 'Request');
        check(rfq.status === 'Quoted', 'Only an open quote can be accepted', 409);
        const product = find(s.products, rfq.productId, 'Product');
        check(product.status === 'Active' && product.stock >= rfq.quantity && rfq.quantity >= product.minimum, 'There is not enough eligible stock to fulfil this quote');
        product.stock -= rfq.quantity; rfq.status = 'Accepted';
        s.orders.unshift({ id: id('PO'), rfqId: rfq.id, productId: product.id, buyer: rfq.buyer, product: product.name, quantity: rfq.quantity, totalCents: rfq.quoteCents * rfq.quantity, status: 'Confirmed', tracking: '', createdAt: now.toISOString() });
        message = 'Demo buyer accepted the quote; stock reserved'; break;
      }
      case 'order.ship': {
        const order = find(s.orders, p.id, 'Order');
        check(order.status === 'Confirmed', 'Only confirmed orders can be shipped', 409);
        order.tracking = text(p.tracking, 'Tracking reference', 60); order.status = 'Shipped';
        ledger(`Payment from ${order.buyer}`, order.totalCents, order.id);
        message = 'Order shipped and demo payment received'; break;
      }
      case 'order.cancel': {
        const order = find(s.orders, p.id, 'Order');
        check(order.status === 'Confirmed', 'Only confirmed, unshipped orders can be cancelled', 409);
        const product = find(s.products, order.productId, 'Reserved product');
        check(Number.isSafeInteger(product.stock + order.quantity), 'Inventory limit exceeded');
        product.stock += order.quantity; order.status = 'Cancelled';
        message = 'Wholesale order cancelled; reserved stock restored'; break;
      }
      case 'beneficiary.add': {
        check(s.beneficiaries.length < 50, 'Your workspace supports up to 50 beneficiaries');
        const account = text(p.account, 'Demo account reference', 30).toUpperCase();
        check(/^DEMO-[A-Z0-9-]+$/.test(account), 'Use a fictional account reference beginning DEMO-');
        check(!s.beneficiaries.some(x => x.account === account), 'This beneficiary account already exists');
        s.beneficiaries.push({ id: id('BEN'), name: text(p.name, 'Beneficiary name'), account });
        message = 'Beneficiary added'; break;
      }
      case 'transfer.send': {
        const beneficiary = find(s.beneficiaries, p.beneficiaryId, 'Beneficiary');
        const amount = money(p.amount); const reference = text(p.reference, 'Payment reference', 60);
        check(amount <= s.balanceCents, 'Insufficient business balance');
        ledger(`Transfer to ${beneficiary.name}`, -amount, reference); message = 'Simulated transfer completed'; break;
      }
      case 'travel.book': {
        check(s.bookings.length < 100, 'Your workspace supports up to 100 bookings');
        const trip = find(searchTrips(p, now), p.tripId, 'Trip');
        check(trip.totalCents <= s.balanceCents, 'Insufficient business balance for this booking');
        const booking = { ...trip, id: id('TRIP'), status: 'Confirmed', traveller: text(p.traveller, 'Lead traveller'), createdAt: now.toISOString() };
        s.bookings.unshift(booking); ledger(`${trip.from} → ${trip.to} · ${trip.airline}`, -trip.totalCents, booking.id);
        message = `Trip booked · ${booking.id}`; break;
      }
      case 'travel.cancel': {
        const booking = find(s.bookings, p.id, 'Booking');
        check(booking.status === 'Confirmed', 'This booking has already been cancelled', 409);
        booking.status = 'Cancelled'; ledger('Business travel refund', booking.totalCents, booking.id);
        message = 'Booking cancelled; full demo refund credited'; break;
      }
      case 'course.enroll': {
        find(COURSES, p.id, 'Course'); check(!s.learning[p.id], 'Already enrolled', 409);
        s.learning[p.id] = { completed: [], passed: false }; message = 'Course added to your learning'; break;
      }
      case 'lesson.complete': {
        const course = find(COURSES, p.id, 'Course'); const progress = s.learning[p.id];
        check(progress, 'Enrol in this course first'); integer(p.lesson, 'Lesson', 0, course.lessons.length - 1);
        if (!progress.completed.includes(p.lesson)) progress.completed.push(p.lesson);
        message = 'Lesson completed'; break;
      }
      case 'quiz.submit': {
        const course = find(COURSES, p.id, 'Course'); const progress = s.learning[p.id];
        check(progress && progress.completed.length === course.lessons.length, 'Complete every lesson before taking the assessment');
        integer(p.answer, 'Answer', 0, course.options.length - 1);
        check(p.answer === course.answer, 'That answer is not correct. Review the lessons and try again.');
        progress.passed = true; progress.certificate ||= id('CERT'); message = 'Assessment passed; your certificate is ready'; break;
      }
      default: throw new BusinessError('Unknown business action', 400);
    }
  }
  check(s.ledger.length < 1000, 'Demo workspace transaction limit reached');
  s.activity.unshift({ id: id('EV'), message, createdAt: now.toISOString() }); s.activity = s.activity.slice(0, 30);
  return { state: s, message };
}
module.exports = { BusinessError, seed, apply, searchTrips, publicCourses, cities };
