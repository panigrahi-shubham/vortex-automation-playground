const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Prisma } = require('@prisma/client');
const { priceCart } = require('../../dist/modules/cart/pricing');
const price = (amount, coupon = null, method = 'standard') => priceCart(new Prisma.Decimal(amount), amount > 0, coupon, method);
test('discount changes free-shipping eligibility and tax base', () => {
  assert.equal(price(100).shipping, 0);
  assert.deepEqual(price(100, 'SAVE10'), { subtotal: 100, discount: 10, coupon: 'SAVE10', couponError: null, shippingMethod: 'standard', shipping: 5.99, tax: 7.2, total: 103.19 });
  assert.equal(price(200, 'FLAT50').total, 162);
  assert.equal(price(199.99, 'FLAT50').discount, 0);
  assert.match(price(199.99, 'FLAT50').couponError, /0.01/);
});
test('free shipping, empty carts, expiration and cent rounding', () => {
  assert.equal(price(10, 'FREESHIP', 'nextday').total, 10.8);
  assert.equal(price(0, null, 'express').total, 0);
  assert.equal(price(0.05, 'SAVE10').discount, 0.01);
  assert.equal(price(10, 'EXPIRED20').couponError, 'This coupon has expired');
  assert.throws(() => price(10, null, '__proto__'), /Invalid shipping/);
});
