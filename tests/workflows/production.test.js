const { test } = require('node:test');
const assert = require('node:assert/strict');
const { guard } = require('../../src/test-hooks/guard');
test('production blocks reset, chaos, inbox and ignores injected failures', () => {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  try {
    for (const path of ['/reset','/chaos','/test/mailbox']) {
      let status;
      guard({path}, {status(code) {status=code;return this;},json(){}}, () => assert.fail('test control was allowed'));
      assert.equal(status,404);
    }
    const req = {path:'/products',headers:{'x-shoplab-fail':'500','x-shoplab-bugs':'1','x-shoplab-latency':'10000'}};
    let called = false;
    guard(req,{},() => { called = true; });
    assert.equal(called,true);
    assert.deepEqual(req.headers,{});
  } finally {
    if (previous === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous;
  }
});
