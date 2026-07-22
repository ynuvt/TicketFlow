import http from 'http';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function callServerClearApi(): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.request(
      {
        hostname: 'localhost',
        port: 4000,
        path: '/api/db/clear',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          if (res.statusCode === 200) {
            console.log('Successfully called backend /api/db/clear endpoint.');
            resolve(true);
          } else {
            resolve(false);
          }
        });
      }
    );

    req.on('error', () => resolve(false));
    req.end();
  });
}

async function main() {
  console.log('--------------------------------------------------');
  console.log('TicketFlow Database & Memory Store Purge Utility');
  console.log('--------------------------------------------------');

  const serverCleared = await callServerClearApi();

  if (serverCleared) {
    console.log('Database, server memory cache, and client screens wiped clean!');
    return;
  }

  // Fallback if backend server is not running
  try {
    console.log('Backend server offline. Performing direct Prisma database cleanup...');
    await prisma.orderItem.deleteMany({});
    await prisma.orderEvent.deleteMany({});
    await prisma.kitchenMetric.deleteMany({});
    await prisma.order.deleteMany({});
    await prisma.station.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.kitchen.deleteMany({});

    console.log('\nAll database tables purged successfully!');
  } catch (err: any) {
    console.error('Failed to purge database:', err.message);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
