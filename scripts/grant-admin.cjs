require('dotenv').config({path:require('node:path').join(__dirname,'../.env')});
const db=require('../server/database.cjs').createPrismaClient();
async function main(){
  const username=process.argv[2];
  if(!username || process.env.NODE_ENV==='production' || process.env.VERCEL_ENV==='production')throw Error();
  await db.$transaction(async tx=>{
    const user=await tx.user.findUniqueOrThrow({where:{username}});
    await tx.user.update({where:{id:user.id},data:{role:'admin'}});
    await tx.session.deleteMany({where:{userId:user.id}});
    await tx.mfaLogin.deleteMany({where:{userId:user.id}});
    await tx.outboxEvent.create({data:{type:'user.role-changed',aggregateId:user.id,payload:{userId:user.id,role:'admin',source:'local-operator'}}});
  });
  console.log('Admin role granted. Sign in again to refresh permissions.');
}
main().catch(()=>{console.error('Grant failed. Usage: npm run admin:grant -- existing_username (development database only).');process.exitCode=1;}).finally(()=>db.$disconnect());
