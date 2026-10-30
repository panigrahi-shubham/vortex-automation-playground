require('dotenv').config({ path: require('node:path').join(__dirname, '../.env') });
const { Prisma } = require('@prisma/client');
const { db: source } = require('../server/store');
const db = require('../server/database.cjs').createPrismaClient();
async function main() {
  // SKU is the seed identity. Never overwrite user edits or reset live stock.
  await db.$transaction(source.products.map(p => db.product.upsert({
    where: { sku: p.sku }, update: {},
    create: { sku: p.sku, name: p.name, description: p.description.replaceAll('ShopLab', 'Orvilo'), category: p.category, price: p.price, stock: p.stock, ...(p.variants ? { variants: p.variants } : {}), createdAt: new Date(p.createdAt) }
  })));
  for (const p of source.products.filter(p => p.variants)) {
    await db.product.updateMany({ where: { sku: p.sku, variants: { equals: Prisma.DbNull } }, data: { variants: p.variants } });
  }
  console.log('Catalog seed complete; existing product edits and stock preserved, missing seeded options filled.');
}
main().catch(() => { console.error('Catalog seed failed; check database configuration.'); process.exitCode = 1; }).finally(() => db.$disconnect());

