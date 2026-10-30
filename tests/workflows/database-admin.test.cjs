const {test}=require('node:test');
const assert=require('node:assert/strict');
const {randomUUID,randomBytes}=require('node:crypto');
const {once}=require('node:events');
require('dotenv').config();
test('admin authorization, product lifecycle, order transitions and session revocation',{skip:!process.env.DATABASE_URL},async()=>{
 const {prisma:db}=require('../../dist/db/client'),{tokenHash}=require('../../dist/auth/passwords'),app=require('../../src/app');
 const users=[],tokens=[],products=[],orderIds=[];let server;
 try{
  for(const role of ['admin','customer']){
   const name=randomUUID(),token=randomBytes(32).toString('hex');tokens.push(token);
   users.push(await db.user.create({data:{username:name,email:`${name}@example.test`,name:'Admin fixture',passwordHash:'unused',role,sessions:{create:{tokenHash:tokenHash(token),expiresAt:new Date(Date.now()+180000)}}}}));
  }
  server=app.listen(0,'127.0.0.1');await once(server,'listening');const base=`http://127.0.0.1:${server.address().port}/api/v2`;
  const request=(path,method='GET',body,token=tokens[0])=>fetch(base+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`} : {}),'Idempotency-Key':randomUUID()},...(body===undefined?{}:{body:JSON.stringify(body)})});
  assert.equal((await request('/admin/stats','GET',undefined,'')).status,401);
  for(const path of ['/admin/products','/admin/orders','/admin/users','/admin/stats'])assert.equal((await request(path,'GET',undefined,tokens[1])).status,403);
  const data={name:'Admin-created item',category:'Books',price:12.34,stock:5,description:'Integration fixture'};
  assert.equal((await request('/admin/products','POST',data,tokens[1])).status,403);
  assert.equal((await request('/admin/products','POST',{...data,category:['Books']})).status,422);
  const created=await request('/admin/products','POST',data);assert.equal(created.status,200);const product=await created.json();products.push(product.id);
  const updated=await request(`/admin/products/${product.id}`,'PUT',{...data,price:15,role:'admin',sku:'injected'});assert.equal(updated.status,200);assert.equal((await updated.json()).sku,product.sku);
  const checkout=async()=>{
   assert.equal((await request('/cart','POST',{productId:product.id,qty:1},tokens[1])).status,200);
   const r=await request('/checkout','POST',{address:{name:'Tester',line1:'1 Road',city:'Mumbai',postalCode:'400001',country:'IN'},testPayment:'approved',acceptTerms:true},tokens[1]);assert.equal(r.status,200);const o=(await r.json()).order;orderIds.push(o.id);return o;
  };
  const first=await checkout();
  for(let i=0;i<2;i++)assert.equal((await request(`/admin/orders/${first.id}`,'PATCH',{status:'Cancelled'})).status,200);
  assert.equal((await db.product.findUnique({where:{id:product.id}})).stock,5);
  const second=await checkout();
  assert.equal((await request(`/admin/orders/${second.id}`,'PATCH',{status:'Delivered'})).status,409);
  for(const status of ['Processing','Shipped','Delivered'])assert.equal((await request(`/admin/orders/${second.id}`,'PATCH',{status})).status,200);
  assert.equal((await request(`/admin/orders/${second.id}`,'PATCH',{status:'Cancelled'})).status,409);
  await request('/cart','POST',{productId:product.id,qty:1},tokens[1]);await request('/wishlist','POST',{productId:product.id},tokens[1]);
  assert.equal((await request(`/admin/products/${product.id}`,'DELETE')).status,204);
  assert.equal(await db.cartLine.count({where:{productId:product.id}}),0);assert.equal(await db.wishlistEntry.count({where:{productId:product.id}}),0);
  assert.equal(await db.orderLine.count({where:{productId:product.id}}),2);
  assert.equal((await request(`/products/${product.id}`)).status,404);
  const list=await (await request('/admin/users')).json();assert.ok(list.every(u=>u.passwordHash===undefined));
  assert.equal((await request(`/admin/users/${users[0].username}`,'PATCH',{locked:true})).status,422);
  assert.equal((await request(`/admin/users/${users[1].username}`,'PATCH',{locked:false,role:'admin'})).status,422);
  assert.equal((await request(`/admin/users/${users[1].username}`,'PATCH',{locked:true})).status,200);
  assert.equal((await request('/me','GET',undefined,tokens[1])).status,401);
  await db.user.update({where:{id:users[0].id},data:{role:'customer'}});
  assert.equal((await request('/admin/stats')).status,403);
 }finally{
  if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}
  await db.outboxEvent.deleteMany({where:{aggregateId:{in:[...orderIds,...products.map(String)]}}});
  await db.order.deleteMany({where:{userId:{in:users.map(u=>u.id)}}});await db.user.deleteMany({where:{id:{in:users.map(u=>u.id)}}});await db.product.deleteMany({where:{id:{in:products}}});await db.$disconnect();
 }
});
