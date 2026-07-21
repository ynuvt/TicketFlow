import http from 'http';

const BACKEND_HOST = 'localhost';
const BACKEND_PORT = 4000;
const KITCHEN_ID = 'kitchen-main';

const SAMPLE_ORDERS = [
  {
    customerName: 'Table 7 - Marcus V.',
    priority: 'VIP',
    estimatedPrepTime: 12,
    stationId: 'intake',
    items: [
      { id: 'item-1', name: 'Wagyu Beef Smashburger', quantity: 2, notes: 'Double cheese, brioche bun' },
      { id: 'item-2', name: 'Truffle Parmesan Fries', quantity: 2, notes: 'Garlic aioli on side' },
      { id: 'item-3', name: 'Craft Hazy IPA Pint', quantity: 2 },
    ],
  },
  {
    customerName: 'Order #302 - Elena R.',
    priority: 'HIGH',
    estimatedPrepTime: 10,
    stationId: 'prep',
    items: [
      { id: 'item-4', name: 'Wood-Fired Diavola Pizza', quantity: 1, notes: 'Spicy salami, hot honey' },
      { id: 'item-5', name: 'Burrata Caprese Salad', quantity: 1, notes: 'Balsamic glaze' },
    ],
  },
  {
    customerName: 'Takeout #409 - Tech Team',
    priority: 'NORMAL',
    estimatedPrepTime: 15,
    stationId: 'grill',
    items: [
      { id: 'item-6', name: 'Prime Ribeye Steak (14oz)', quantity: 2, notes: 'Medium rare, chimichurri' },
      { id: 'item-7', name: 'Charred Asparagus Spear', quantity: 2 },
      { id: 'item-8', name: 'Sparkling Mineral Water', quantity: 2 },
    ],
  },
  {
    customerName: 'Table 2 - Sophia L.',
    priority: 'VIP',
    estimatedPrepTime: 8,
    stationId: 'intake',
    items: [
      { id: 'item-9', name: 'Pan-Seared Atlantic Salmon', quantity: 1, notes: 'Lemon dill butter' },
      { id: 'item-10', name: 'Quinoa Power Bowl', quantity: 1 },
    ],
  },
];

function postOrder(payload: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ ...payload, kitchenId: KITCHEN_ID });

    const req = http.request(
      {
        hostname: BACKEND_HOST,
        port: BACKEND_PORT,
        path: '/api/orders',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
        },
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            resolve({ raw: body });
          }
        });
      }
    );

    req.on('error', (err) => reject(err));
    req.write(postData);
    req.end();
  });
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runSeeder() {
  console.log('--------------------------------------------------');
  console.log('🚀 TicketFlow Real-Time Sample Data Stream Generator');
  console.log('--------------------------------------------------');
  console.log(`Connecting to backend API at http://${BACKEND_HOST}:${BACKEND_PORT}...\n`);

  for (let i = 0; i < SAMPLE_ORDERS.length; i++) {
    const orderData = SAMPLE_ORDERS[i];
    try {
      const result = await postOrder(orderData);
      console.log(
        `✅ Created Order #${result.orderId ? result.orderId.slice(-6).toUpperCase() : i + 1} | Customer: "${orderData.customerName}" | Priority: ${orderData.priority} | Seq #${result.event?.sequenceNumber}`
      );
    } catch (err: any) {
      console.error(`❌ Failed to send order: ${err.message}`);
    }
    await sleep(800); // 800ms stagger between order ticket broadcasts
  }

  console.log('\n🎉 All sample orders successfully broadcasted over Socket.IO!');
  console.log('Check your browser at http://localhost:3000 to see live order tickets!');
  process.exit(0);
}

runSeeder();
