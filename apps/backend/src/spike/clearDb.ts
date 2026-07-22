import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--------------------------------------------------');
  console.log('TicketFlow Database Purge Utility');
  console.log('--------------------------------------------------');

  try {
    console.log('Deleting OrderItems...');
    const orderItems = await prisma.orderItem.deleteMany({});
    console.log(`Deleted ${orderItems.count} order items.`);

    console.log('Deleting OrderEvents...');
    const orderEvents = await prisma.orderEvent.deleteMany({});
    console.log(`Deleted ${orderEvents.count} order events.`);

    console.log('Deleting KitchenMetrics...');
    const kitchenMetrics = await prisma.kitchenMetric.deleteMany({});
    console.log(`Deleted ${kitchenMetrics.count} kitchen metrics.`);

    console.log('Deleting Orders...');
    const orders = await prisma.order.deleteMany({});
    console.log(`Deleted ${orders.count} orders.`);

    console.log('Deleting Stations...');
    const stations = await prisma.station.deleteMany({});
    console.log(`Deleted ${stations.count} stations.`);

    console.log('Deleting Users...');
    const users = await prisma.user.deleteMany({});
    console.log(`Deleted ${users.count} users.`);

    console.log('Deleting Kitchens...');
    const kitchens = await prisma.kitchen.deleteMany({});
    console.log(`Deleted ${kitchens.count} kitchens.`);

    console.log('\nAll data purged successfully! Database schema is empty and clean.');
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
