import http from 'http';

const BACKEND_HOST = 'localhost';
const BACKEND_PORT = 4000;
const KITCHEN_ID = 'kitchen-main';

const ITEMS_PRESET = [
  { id: '1', name: 'Paneer Tikka Pizza (Veg)', quantity: 1, notes: 'Extra tandoori sauce' }
];

function postOrder(i: number): Promise<any> {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      customerName: `LoadTest Customer #${i}`,
      priority: 'NORMAL',
      estimatedPrepTime: 10,
      stationId: 'intake',
      items: ITEMS_PRESET,
      kitchenId: KITCHEN_ID
    });

    const req = http.request(
      {
        hostname: BACKEND_HOST,
        port: BACKEND_PORT,
        path: '/api/orders',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
          'x-user-role': 'MANAGER',
          'x-user-id': 'admin',
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

async function run() {
  console.log('==================================================');
  console.log('Starting high-speed CLI seeder (250 KOTs)...');
  console.log('==================================================');
  
  const startTime = Date.now();
  for (let i = 1; i <= 250; i++) {
    try {
      await postOrder(i);
      if (i % 25 === 0) {
        console.log(`[Seed Progress] Broadcasted ${i}/250 tickets...`);
      }
    } catch (err: any) {
      console.error(`[Error] Failed to post order #${i}:`, err.message);
    }
    // 5ms pacing delay to match UI seeder pacing
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  
  console.log('==================================================');
  console.log(`Successfully completed! Total time: ${((Date.now() - startTime) / 1000).toFixed(2)}s`);
  console.log('==================================================');
}

run();
