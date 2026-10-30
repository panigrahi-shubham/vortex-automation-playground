const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Prisma } = require('@prisma/client');
const { transaction } = require('../../dist/db/transaction');

for (const [label, meta] of [
  ['legacy serialization failure', { code: '40001' }],
  ['adapter serialization failure', { driverAdapterError: { cause: { originalCode: '40001' } } }],
  ['adapter deadlock', { driverAdapterError: { cause: { originalCode: '40P01' } } }]
]) {
  test(`retries a rolled-back ${label} before returning the committed result`, async () => {
    let attempts = 0;
    const db = { $transaction: async operation => {
      attempts++;
      if (attempts === 1) throw new Prisma.PrismaClientKnownRequestError('Rolled back', { code: 'P2010', clientVersion: 'test', meta });
      return operation({ committed: true });
    } };
    assert.equal(await transaction(db, async tx => tx.committed), true);
    assert.equal(attempts, 2);
  });
}

test('does not repeat a transaction for unrelated SQL errors', async () => {
  let attempts = 0;
  const error = new Prisma.PrismaClientKnownRequestError('Invalid relation', { code: 'P2010', clientVersion: 'test', meta: { driverAdapterError: { cause: { originalCode: '42P01' } } } });
  const db = { $transaction: async () => { attempts++; throw error; } };
  await assert.rejects(transaction(db, async () => {}), actual => actual === error);
  assert.equal(attempts, 1);
});

test('retries adapter conflicts raised before Prisma wraps BEGIN or COMMIT', async () => {
  let attempts = 0;
  const error = Object.assign(new Error('TransactionWriteConflict'), { name: 'DriverAdapterError', cause: { kind: 'TransactionWriteConflict' } });
  const db = { $transaction: async operation => {
    attempts++;
    if (attempts === 1) throw error;
    return operation({});
  } };
  assert.equal(await transaction(db, async () => 'committed'), 'committed');
  assert.equal(attempts, 2);
});
