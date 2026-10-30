const { run } = require('./run');
function deleteProduct(db, productId) {
  const products = db.products;
  const carts = structuredClone(db.carts);
  const wishlists = structuredClone(db.wishlists);
  run([
    { execute() { db.products = db.products.filter(p => p.id !== productId); }, undo() { db.products = products; } },
    { execute() { for (const cart of Object.values(db.carts)) cart.items = cart.items.filter(i => i.productId !== productId); }, undo() { db.carts = carts; } },
    { execute() { for (const user of Object.keys(db.wishlists)) db.wishlists[user] = db.wishlists[user].filter(id => id !== productId); }, undo() { db.wishlists = wishlists; } }
  ]);
}
module.exports = { deleteProduct };
