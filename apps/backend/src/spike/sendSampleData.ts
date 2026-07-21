import http from 'http';
import { generateUsers } from 'indseed';

const BACKEND_HOST = 'localhost';
const BACKEND_PORT = 4000;
const KITCHEN_ID = 'kitchen-main';

// Generate synthetic Indian users from indseed package
const indseedUsers = generateUsers(20);

const MEAL_COMBINATIONS = [
  {
    comboName: 'Veggie Delight Combo Meal',
    priority: 'VIP' as const,
    estimatedPrepTime: 10,
    stationId: 'intake' as const,
    items: [
      { id: 'item-1', name: 'Paneer Tikka Butter Masala Pizza', quantity: 1, notes: 'Extra cheese burst crust' },
      { id: 'item-2', name: 'Spicy Paneer Crispy Burger', quantity: 1, notes: 'Extra mint mayo' },
      { id: 'item-3', name: 'Crispy Salted French Fries', quantity: 1 },
      { id: 'item-4', name: 'Chilled Mango Lassi / Cola', quantity: 2 },
    ],
  },
  {
    comboName: 'Chicken Feast Combo Meal',
    priority: 'HIGH' as const,
    estimatedPrepTime: 12,
    stationId: 'prep' as const,
    items: [
      { id: 'item-5', name: 'Chicken Tikka Supreme Pizza', quantity: 1, notes: 'Double chicken tikka, thin crust' },
      { id: 'item-6', name: 'Crispy Chicken Zinger Burger', quantity: 1, notes: 'Spicy mayo & lettuce' },
      { id: 'item-7', name: 'Garlic Cheese Breadsticks', quantity: 1, notes: 'Cheesy dip' },
      { id: 'item-8', name: 'Cold Coffee / Drink', quantity: 2 },
    ],
  },
  {
    comboName: 'Royal Indo-Italian Pizza & Burger Combo',
    priority: 'NORMAL' as const,
    estimatedPrepTime: 14,
    stationId: 'grill' as const,
    items: [
      { id: 'item-9', name: 'Chicken Pepperoni Feast Pizza', quantity: 1, notes: 'Extra chicken pepperoni' },
      { id: 'item-10', name: 'Classic Veggie Herb Burger', quantity: 1, notes: 'Whole wheat bun' },
      { id: 'item-11', name: 'Peri Peri Potato Wedges', quantity: 1 },
    ],
  },
  {
    comboName: 'Corn & Cheese Pizza Burger Special',
    priority: 'VIP' as const,
    estimatedPrepTime: 8,
    stationId: 'intake' as const,
    items: [
      { id: 'item-12', name: 'Golden Corn & Cheese Margherita Pizza', quantity: 1, notes: 'Fresh mozzarella & basil' },
      { id: 'item-13', name: 'Grilled Chicken Cheese Burger', quantity: 1, notes: 'Smoky BBQ sauce' },
      { id: 'item-14', name: 'Masala French Fries', quantity: 1 },
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
  console.log('TicketFlow Real-Time Seeder (Powered by indseed npm)');
  console.log('--------------------------------------------------');
  console.log(`Loaded ${indseedUsers.length} synthetic Indian users from indseed.`);
  console.log(`Connecting to backend API at http://${BACKEND_HOST}:${BACKEND_PORT}...\n`);

  let count = 0;
  for (let cycle = 0; cycle < 2; cycle++) {
    for (let i = 0; i < MEAL_COMBINATIONS.length; i++) {
      count++;
      const combo = MEAL_COMBINATIONS[i];
      const indUser = indseedUsers[(count - 1) % indseedUsers.length];
      const customerName = `${indUser.fullName} - ${combo.comboName}`;

      const orderPayload = {
        customerName,
        priority: combo.priority,
        estimatedPrepTime: combo.estimatedPrepTime,
        stationId: combo.stationId,
        items: combo.items,
      };

      try {
        const result = await postOrder(orderPayload);
        console.log(
          `[Order Created] #${result.orderId ? result.orderId.slice(-6).toUpperCase() : count} | Customer: "${customerName}" | Priority: ${combo.priority} | Seq #${result.event?.sequenceNumber}`
        );
      } catch (err: any) {
        console.error(`[Error] Failed to send order: ${err.message}`);
      }

      await sleep(1000);
    }
  }

  console.log('\nAll sample orders using indseed synthetic data successfully sent to backend.');
  process.exit(0);
}

runSeeder();
