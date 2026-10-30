const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID, randomBytes } = require('node:crypto');
const { once } = require('node:events');
const sharp = require('sharp');
require('dotenv').config();

test('avatars validate content, persist thumbnails and invalidate replaced or removed URLs', { skip: !process.env.DATABASE_URL }, async () => {
  const { prisma: db } = require('../../dist/db/client');
  const { tokenHash } = require('../../dist/auth/passwords');
  const { throttleKey } = require('../../dist/auth/throttle');
  const app = require('../../src/app');
  let user, other, server;
  try {
    const marker = randomUUID(), token = randomBytes(32).toString('hex');
    user = await db.user.create({ data: { username:marker, email:`${marker}@example.test`, name:'Avatar fixture', passwordHash:'unused', sessions:{create:{tokenHash:tokenHash(token), expiresAt:new Date(Date.now()+120000)}} } });
    other = await db.user.create({ data: { username:`other-${marker}`, email:`other-${marker}@example.test`, name:'Other fixture', passwordHash:'unused' } });
    server = app.listen(0,'127.0.0.1'); await once(server,'listening');
    const base = `http://127.0.0.1:${server.address().port}`;
    const upload = (data, mime, authorized = true) => fetch(base+'/api/v2/me/avatar?userId='+other.id,{method:'POST',headers:{'Content-Type':mime,...(authorized?{Authorization:`Bearer ${token}`}:{})},body:data});
    const png = await sharp({create:{width:400,height:600,channels:3,background:'red'}}).withMetadata().png().toBuffer();
    assert.equal((await upload(png,'image/png',false)).status,401);
    assert.equal((await upload(Buffer.from('<svg/>'),'image/svg+xml')).status,415);
    assert.equal((await upload(png,'image/jpeg')).status,415);
    assert.equal((await upload(Buffer.from('not an image'),'image/png')).status,415);
    assert.equal((await upload(Buffer.alloc(1024*1024+1),'image/png')).status,413);
    const large = await sharp({create:{width:5000,height:5000,channels:3,background:'red'}}).png().toBuffer();
    assert.equal((await upload(large,'image/png')).status,415);
    const response = await upload(png,'image/png'); assert.equal(response.status,200);
    const first = (await response.json()).avatar;
    assert.equal((await db.user.findUnique({where:{id:other.id}})).avatar,null);
    const photo = await fetch(base+first); assert.equal(photo.status,200);
    assert.match(photo.headers.get('content-type'),/^image\/webp/); assert.equal(photo.headers.get('x-content-type-options'),'nosniff');
    const metadata = await sharp(Buffer.from(await photo.arrayBuffer())).metadata();
    assert.ok(metadata.width<=256 && metadata.height<=256); assert.equal(metadata.exif,undefined);
    assert.equal((await db.user.findUnique({where:{id:user.id}})).avatar,first);
    const second = (await (await upload(png,'image/png')).json()).avatar; assert.notEqual(second,first);
    assert.equal((await fetch(base+first)).status,404);
    assert.equal(await db.avatar.count({where:{userId:user.id}}),1);
    assert.equal((await fetch(base+'/api/v2/me/avatar',{method:'DELETE',headers:{Authorization:`Bearer ${token}`}})).status,200);
    assert.equal((await fetch(base+second)).status,404);
    assert.equal((await db.user.findUnique({where:{id:user.id}})).avatar,null);
    assert.equal(await db.avatar.count({where:{userId:user.id}}),0);
  } finally {
    if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
    if(user){await db.user.delete({where:{id:user.id}});await db.rateLimit.deleteMany({where:{key:throttleKey('avatar',user.id)}});}
    if(other)await db.user.delete({where:{id:other.id}});
    await db.$disconnect();
  }
});
