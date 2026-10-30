import { Prisma, PrismaClient } from '@prisma/client';
import { Router, Request, Response, RequestHandler } from 'express';
import { randomUUID } from 'node:crypto';
import { requireSession } from '../../auth/database-sessions';
import { publicProfile } from '../../auth/profile';
import { transaction } from '../../db/transaction';
import { WorkflowError } from '../../workflows/errors';
import { cancelOrderIn } from '../../workflows/cancel-order';
import { deleteProductIn } from '../catalog/service';
import { enqueue } from '../../events/outbox';

const productId = (req: Request) => {
  const id = Number(req.params.id);
  if (!/^\d+$/.test(String(req.params.id)) || !Number.isSafeInteger(id) || id < 1 || id > 2147483647) throw new WorkflowError(400, 'Invalid product ID');
  return id;
};
const productData = (body: Record<string, unknown>) => {
  const fields: Record<string,string> = {};
  if(typeof body.name !== 'string' || body.name.trim().length < 3 || body.name.length > 150) fields.name = 'Name must be 3-150 characters';
  if(typeof body.category !== 'string' || !['Electronics','Books','Home','Toys','Fashion'].includes(String(body.category))) fields.category = 'Select a category';
  if(typeof body.price !== 'number' || !Number.isFinite(body.price) || body.price <= 0 || body.price > 9999999999.99 || new Prisma.Decimal(body.price).decimalPlaces() > 2) fields.price = 'Price must be positive with at most two decimal places';
  if(!Number.isSafeInteger(body.stock) || Number(body.stock) < 0 || Number(body.stock) > 2147483647) fields.stock = 'Stock must be a nonnegative whole number';
  if(typeof body.description !== 'string' || body.description.length > 10000) fields.description = 'Description must be at most 10000 characters';
  if(Object.keys(fields).length) return {fields};
  return { data: {name:(body.name as string).trim(), category:body.category as string, price:body.price as number, stock:body.stock as number, description:body.description as string} };
};
const productJson = (p: Prisma.ProductGetPayload<{}>) => ({...p, price:Number(p.price), rating:Number(p.rating)});
const orderJson = (o: Prisma.OrderGetPayload<{include:{lines:true,user:true}}>) => {
  const {user,...order}=o;
  return {...order, username:user.username, total:Number(o.total), lines:o.lines.map(l=>({...l,unitPrice:Number(l.unitPrice)}))};
};

export function adminRoutes(db: PrismaClient) {
  const router=Router();
  router.use('/admin',requireSession(db),(req,res,next)=>{ if(res.locals.user.role!=='admin'){res.status(403).json({error:'Admin access required'});return;} next(); });
  const handle=(fn:(req:Request,res:Response)=>Promise<unknown>):RequestHandler=>async(req,res,next)=>{
    try { const data=await fn(req,res); if(!res.headersSent)res.set('Cache-Control','no-store').json(data); }
    catch(error){if(error instanceof WorkflowError){res.status(error.status).json({error:error.message});return;}next(error);}
  };
  const write=<T>(res:Response, op:(tx:Prisma.TransactionClient)=>Promise<T>)=>transaction(db,async tx=>{
    const id:string=res.locals.user.id;
    await tx.$queryRaw`SELECT id FROM orvilo."User" WHERE id=${id} FOR UPDATE`;
    const actor=await tx.user.findUnique({where:{id}}), session=await tx.session.findUnique({where:{tokenHash:res.locals.tokenHash}});
    if(!actor || actor.locked || actor.role!=='admin' || !session || session.expiresAt<=new Date())throw new WorkflowError(403,'Admin access required');
    return op(tx);
  });
  router.get('/admin/stats',handle(async()=>{
    const [products,outOfStock,users,orders,revenue]=await db.$transaction([
      db.product.count({where:{deletedAt:null}}),db.product.count({where:{deletedAt:null,stock:0}}),db.user.count(),db.order.count(),
      db.order.aggregate({where:{status:{not:'Cancelled'}},_sum:{total:true}})
    ],{isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead});
    return {products,outOfStock,users,orders,revenue:Number(revenue._sum.total??0)};
  }));
  router.get('/admin/products',handle(async()=> (await db.product.findMany({where:{deletedAt:null},orderBy:{id:'asc'}})).map(productJson)));
  router.post('/admin/products',handle(async(req,res)=>{
    const parsed=productData(req.body||{}); if(!parsed.data){res.status(422).json({error:'Validation failed',fields:parsed.fields});return;}
    return productJson(await write(res,async tx=>{
      const p=await tx.product.create({data:{...parsed.data!,sku:`ORV-${randomUUID()}`}});
      await enqueue(tx,'product.created',String(p.id),{productId:p.id});return p;
    }));
  }));
  router.put('/admin/products/:id',handle(async(req,res)=>{
    const id=productId(req),parsed=productData(req.body||{});if(!parsed.data){res.status(422).json({error:'Validation failed',fields:parsed.fields});return;}
    return productJson(await write(res,async tx=>{
      if(!await tx.product.findFirst({where:{id,deletedAt:null}}))throw new WorkflowError(404,'Product not found');
      const p=await tx.product.update({where:{id},data:parsed.data});
      await enqueue(tx,'product.updated',String(id),{productId:id});return p;
    }));
  }));
  router.delete('/admin/products/:id',handle(async(req,res)=>{
    const id=productId(req);if(!await write(res,tx=>deleteProductIn(tx,id)))throw new WorkflowError(404,'Product not found');res.status(204).end();
  }));
  router.get('/admin/orders',handle(async()=> (await db.order.findMany({include:{lines:true,user:true},orderBy:{createdAt:'desc'}})).map(orderJson)));
  router.patch('/admin/orders/:id',handle(async(req,res)=>orderJson(await write(res,async tx=>{
    const id=String(req.params.id), status=req.body?.status;
    const flow=['Placed','Processing','Shipped','Delivered'];
    if(![...flow,'Cancelled'].includes(status))throw new WorkflowError(422,'Invalid status');
    const order=await tx.order.findUnique({where:{id},include:{lines:true,user:true}});
    if(!order)throw new WorkflowError(404,'Order not found');
    if(status===order.status)return order;
    if(status==='Cancelled')await cancelOrderIn(tx,order.userId,id);
    else {
      if(order.status==='Cancelled' || flow.indexOf(status)!==flow.indexOf(order.status)+1)throw new WorkflowError(409,'Advance the order by one stage; terminal orders cannot be reopened');
      await tx.order.update({where:{id},data:{status}});await enqueue(tx,'order.status-changed',id,{orderId:id,userId:order.userId,status});
    }
    return tx.order.findUniqueOrThrow({where:{id},include:{lines:true,user:true}});
  }))));
  router.get('/admin/users',handle(async()=> (await db.user.findMany({orderBy:{username:'asc'}})).map(u=>({...publicProfile(u),locked:u.locked}))));
  router.patch('/admin/users/:username',handle(async(req,res)=>write(res,async tx=>{
    const user=await tx.user.findUnique({where:{username:String(req.params.username)}});
    if(!user)throw new WorkflowError(404,'User not found');
    if(user.id===res.locals.user.id || user.role==='admin')throw new WorkflowError(422,'Admin accounts cannot be changed here');
    if(typeof req.body?.locked!=='boolean' || Object.hasOwn(req.body,'role'))throw new WorkflowError(422,'Only a boolean locked value is supported');
    const updated=await tx.user.update({where:{id:user.id},data:{locked:req.body.locked}});
    if(updated.locked){await tx.session.deleteMany({where:{userId:user.id}});await tx.mfaLogin.deleteMany({where:{userId:user.id}});}
    return {...publicProfile(updated),locked:updated.locked};
  })));
  return router;
}

