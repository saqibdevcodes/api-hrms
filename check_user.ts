import { PrismaClient } from './src/generated/prisma';

const prisma = new PrismaClient();

async function checkUser() {
  const email = 'saqibiris.co@gmail.com';
  console.log(`Checking for user with email: ${email}`);

  const user = await prisma.user.findFirst({
    where: {
      email: email
    }
  });

  if (user) {
    console.log('User found:', user);
  } else {
    console.log('User NOT found with exact match.');
    
    // Try finding similar emails
    const allUsers = await prisma.user.findMany({
      select: { email: true }
    });
    console.log('All user emails:', allUsers.map((u: { email: string }) => u.email));
  }
}

checkUser()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });

