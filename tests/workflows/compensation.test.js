const { test } = require('node:test');
const assert = require('node:assert/strict');
const { run } = require('../../src/workflows/run');
const { deleteProduct } = require('../../src/workflows/delete-product');
test('rolls back a partially executed step and earlier steps in reverse order', () => {
  const state = [];
  assert.throws(() => run([
    { execute() { state.push('first'); }, undo() { assert.equal(state.pop(), 'first'); } },
    { execute() { state.push('second'); throw Error('injected'); }, undo() { assert.equal(state.pop(), 'second'); } }
  ]), /injected/);
  assert.deepEqual(state, []);
});
test('deleting a product clears active references and preserves order history', () => {
  const db = { products: [{id:1},{id:2}], carts: {alice:{items:[{productId:1},{productId:2}]}}, wishlists:{alice:[1,2]}, orders:[{items:[{productId:1}]}] };
  deleteProduct(db,1);
  assert.deepEqual(db.products,[{id:2}]);
  assert.deepEqual(db.carts.alice.items,[{productId:2}]);
  assert.deepEqual(db.wishlists.alice,[2]);
  assert.equal(db.orders[0].items[0].productId,1);
});
