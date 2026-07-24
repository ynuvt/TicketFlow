import React, { useState, useEffect } from 'react';
import { Order, OrderStatus, StationId, KitchenEvent } from '@ticketflow/types';
import { StationNetworkMap } from '../hooks/useSocketKDS';
import { STATIONS } from '../types/kds';
import { useAuth } from '../context/AuthContext';
import {
  ListFilter,
  CheckCircle2,
  Activity,
  Zap,
  Wifi,
  WifiOff,
  RefreshCw,
  Plus,
  Clock,
  Inbox,
  ArrowRight,
  User,
  Receipt,
  Trash2,
} from 'lucide-react';

interface DashboardViewProps {
  orders: Order[];
  events: KitchenEvent[];
  lastProcessedSequence: number;
  connectionStatus: string;
  stationNetworks: StationNetworkMap;
  onToggleStationNetwork: (stationId: StationId) => void;
  onToggleGlobalNetwork: (online: boolean) => void;
  onTransitionOrder: (orderId: string, currentStatus: OrderStatus, newStatus: OrderStatus, stationId?: StationId) => void;
  onOpenCreateModal: () => void;
  onNavigate: (path: string) => void;
  printKotEnabled?: boolean;
  onTogglePrintKot?: () => void;
}

const SEED_CUSTOMERS = [
  'Aarav Sharma', 'Aditi Verma', 'Vihaan Patel', 'Ananya Iyer',
  'Reyansh Gupta', 'Diya Nair', 'Sai Prasad', 'Riya Sen',
  'Arjun Mehta', 'Kavya Rao', 'Ishaan Joshi', 'Myra Kapoor',
  'Aanya Chawla', 'Krishna Murthy', 'Sai Ram', 'Rohan Bhat',
  'Devendra Singh', 'Pooja Hegde', 'Kabir Das', 'Sneha Reddy'
];

const MEAL_COMBINATIONS = [
  {
    comboName: 'Paneer Tikka Pizza & Drink',
    priority: 'NORMAL' as const,
    estimatedPrepTime: 10,
    stationId: 'intake' as const,
    items: [
      { id: 'item-1', name: 'Paneer Tikka Pizza (Veg)', quantity: 1, notes: 'Extra tandoori sauce' },
      { id: 'item-2', name: 'Chilled Mango Lassi', quantity: 1, notes: 'Less sugar' },
    ],
  },
  {
    comboName: 'Chicken Feast Combo Meal',
    priority: 'NORMAL' as const,
    estimatedPrepTime: 12,
    stationId: 'intake' as const,
    items: [
      { id: 'item-3', name: 'Chicken Tikka Supreme Pizza', quantity: 1, notes: 'Double chicken tikka, thin crust' },
      { id: 'item-4', name: 'Crispy Chicken Zinger Burger', quantity: 1, notes: 'Spicy mayo & lettuce' },
      { id: 'item-5', name: 'Cold Coffee', quantity: 2 },
    ],
  },
  {
    comboName: 'Royal Veggie Burger Special',
    priority: 'NORMAL' as const,
    estimatedPrepTime: 8,
    stationId: 'intake' as const,
    items: [
      { id: 'item-6', name: 'Classic Veggie Herb Burger', quantity: 1, notes: 'Whole wheat bun' },
      { id: 'item-7', name: 'Peri Peri Potato Wedges', quantity: 1 },
    ],
  },
  {
    comboName: 'Corn & Cheese Overload Pizza',
    priority: 'NORMAL' as const,
    estimatedPrepTime: 9,
    stationId: 'intake' as const,
    items: [
      { id: 'item-8', name: 'Golden Corn & Cheese Margherita Pizza', quantity: 1, notes: 'Fresh mozzarella & basil' },
      { id: 'item-9', name: 'Masala French Fries', quantity: 1 },
    ],
  },
];

export const DashboardView: React.FC<DashboardViewProps> = ({
  orders,
  events,
  lastProcessedSequence,
  connectionStatus,
  stationNetworks,
  onToggleStationNetwork,
  onToggleGlobalNetwork,
  onTransitionOrder,
  onOpenCreateModal,
  onNavigate,
  printKotEnabled = false,
  onTogglePrintKot,
}) => {
  const { authFetch } = useAuth();
  const [lastUpdatedTime, setLastUpdatedTime] = useState<string>('');
  const [seedCount, setSeedCount] = useState<number | ''>(10);
  const [seedingProgress, setSeedingProgress] = useState<number | null>(null);
  const [isSeeding, setIsSeeding] = useState<boolean>(false);
  const seedingStopRef = React.useRef<boolean>(false);

  const handleSeedOrders = async () => {
    if (isSeeding) return;
    setIsSeeding(true);
    setSeedingProgress(0);
    seedingStopRef.current = false;

    const countToSeed = Math.max(1, typeof seedCount === 'number' ? seedCount : 10);

    for (let i = 0; i < countToSeed; i++) {
      if (seedingStopRef.current) {
        break;
      }

      const customer = SEED_CUSTOMERS[Math.floor(Math.random() * SEED_CUSTOMERS.length)];
      const combo = MEAL_COMBINATIONS[Math.floor(Math.random() * MEAL_COMBINATIONS.length)];

      const payload = {
        customerName: `${customer} - ${combo.comboName}`,
        priority: combo.priority,
        estimatedPrepTime: combo.estimatedPrepTime,
        stationId: combo.stationId,
        items: combo.items,
      };

      try {
        await authFetch('http://localhost:4000/api/orders', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });
        setSeedingProgress(i + 1);
      } catch (err) {
        console.error('Failed to post seed order:', err);
      }

      // Pacing delay (300ms)
      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    setIsSeeding(false);
    setSeedingProgress(null);
  };

  const handleStopSeeding = () => {
    seedingStopRef.current = true;
    setIsSeeding(false);
  };

  const handleClearDb = async () => {
    if (!window.confirm('Are you sure you want to clear the entire database? All orders will be permanently deleted.')) {
      return;
    }
    try {
      const res = await authFetch('http://localhost:4000/api/db/clear', {
        method: 'POST',
      });
      if (res.ok) {
        alert('Database cleared successfully!');
      } else {
        alert('Failed to clear database.');
      }
    } catch (err: any) {
      alert('Error clearing database: ' + err.message);
    }
  };


  useEffect(() => {
    setLastUpdatedTime(new Date().toLocaleTimeString());
  }, [events, orders]);

  const activeOrders = orders.filter((o) => o.status !== 'SERVED');
  const servedOrders = orders.filter((o) => o.status === 'SERVED');
  const vipOrders = orders.filter((o) => (o.priority === 'VIP' || o.priority === 'HIGH') && o.status !== 'SERVED');

  const stationList: { id: StationId; title: string; desc: string }[] = [
    {
      id: 'intake',
      title: 'Order Intake',
      desc: 'New orders placed from POS and manager dashboard',
    },
    {
      id: 'prep',
      title: 'Prep Line',
      desc: 'Food preparation, vegetable chopping, and sauce mixing',
    },
    {
      id: 'grill',
      title: 'Grill & Cooking',
      desc: 'Hot cooking line, searing, frying, and oven roasting',
    },
    {
      id: 'assembly',
      title: 'Plate & Assembly',
      desc: 'Plating, garnishing, packaging, and tray loading',
    },
    {
      id: 'expedite',
      title: 'Expedite & Pass',
      desc: 'Final order inspection and customer server pickup',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Brand Hero Welcome Banner */}
      <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-200/80 rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-4 text-center sm:text-left">
          <img
            src="/logo.png"
            alt="TicketFlow Master Chef Logo"
            className="w-16 h-16 sm:w-20 sm:h-20 object-contain rounded-2xl border-2 border-amber-300 bg-white p-1 shadow-md shrink-0"
          />
          <div>
            <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold text-[10px] uppercase tracking-wider">
              Master Kitchen Display System
            </span>
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-1">Welcome to TicketFlow KDS</h2>
            <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
              Real-time event-sourced order routing, station connectivity matrix & queue telemetry
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 shrink-0">
          {/* Print KOT Auto-Print Control */}
          <div className="flex items-center gap-2.5 bg-white px-4 py-2 rounded-xl border border-slate-200/80 shadow-sm select-none">
            <Receipt className="w-3.5 h-3.5 text-blue-600" />
            <span className="text-xs font-bold text-slate-700">Print KOT</span>
            <button
              onClick={onTogglePrintKot}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 focus:outline-none ${
                printKotEnabled ? 'bg-blue-600' : 'bg-slate-200'
              }`}
              aria-label="Toggle Print KOT"
            >
              <span
                className="inline-block h-3 w-3 transform rounded-full bg-white transition-transform duration-200"
                style={{ transform: printKotEnabled ? 'translateX(20px)' : 'translateX(4px)' }}
              />
            </button>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-mono bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            <span>Updated: {lastUpdatedTime || '10:24:30 AM'}</span>
          </div>
        </div>
      </div>

      {/* Top 3 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {/* Active Tickets */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 flex items-start justify-between shadow-sm">
          <div>
            <p className="text-xs font-semibold text-slate-500">Active Tickets</p>
            <p className="text-3xl font-bold text-slate-900 mt-1">{activeOrders.length}</p>
            <p className="text-xs text-slate-400 mt-1">Currently in queue</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <ListFilter className="w-5 h-5" />
          </div>
        </div>

        {/* Served Completed */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 flex items-start justify-between shadow-sm">
          <div>
            <p className="text-xs font-semibold text-slate-500">Served Completed</p>
            <p className="text-3xl font-bold text-slate-900 mt-1">{servedOrders.length}</p>
            <p className="text-xs text-slate-400 mt-1">Completed today</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        {/* Monotonic Sequence */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 flex items-start justify-between shadow-sm">
          <div>
            <p className="text-xs font-semibold text-slate-500">Monotonic Sequence</p>
            <p className="text-3xl font-bold text-slate-900 mt-1">#{lastProcessedSequence}</p>
            <p className="text-xs text-slate-400 mt-1">Current sequence</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
            <Activity className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Kitchen Station Network Status Card */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Wifi className="w-5 h-5 text-blue-600" />
              Kitchen Station Network Status
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Monitor and manage connectivity of all kitchen stations. Toggle offline mode for testing and maintenance.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => onToggleGlobalNetwork(connectionStatus !== 'ONLINE')}
              className="px-4 py-2 rounded-xl border border-blue-200 bg-white hover:bg-blue-50 text-blue-600 text-xs font-semibold flex items-center gap-2 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Simulate Reconnect</span>
            </button>

            <button
              onClick={onOpenCreateModal}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-blue-500/20 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Create Order</span>
            </button>
          </div>
        </div>

        {/* Seeding & DB Control Bar */}
        <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <div className="flex items-center gap-2">
              <label htmlFor="seed-orders-count" className="text-xs font-semibold text-slate-600 shrink-0">
                Seed Count:
              </label>
              <input
                id="seed-orders-count"
                type="number"
                min="1"
                max="500"
                value={seedCount}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '') {
                    setSeedCount('');
                  } else {
                    const parsed = parseInt(val, 10);
                    setSeedCount(isNaN(parsed) ? '' : parsed);
                  }
                }}
                disabled={isSeeding}
                className="w-16 px-2.5 py-1.5 text-xs font-bold text-slate-900 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 bg-white disabled:bg-slate-100"
              />
            </div>

            <button
              onClick={handleSeedOrders}
              disabled={isSeeding}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 shadow-xs"
            >
              <Activity className="w-3.5 h-3.5 animate-pulse" />
              <span>{isSeeding ? 'Seeding...' : 'Seed Orders'}</span>
            </button>

            {isSeeding && (
              <button
                onClick={handleStopSeeding}
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors flex items-center gap-1.5 shadow-xs animate-bounce"
              >
                <WifiOff className="w-3.5 h-3.5" />
                <span>Stop Seeding</span>
              </button>
            )}

            {isSeeding && seedingProgress !== null && (
              <span className="text-xs font-bold text-indigo-600 animate-pulse bg-indigo-50 px-2.5 py-1 rounded-md">
                Progress: {seedingProgress} / {seedCount}
              </span>
            )}
          </div>

          <button
            onClick={handleClearDb}
            disabled={isSeeding}
            className="px-4 py-2 rounded-lg bg-rose-50 border border-rose-200 hover:bg-rose-100 hover:border-rose-300 text-rose-700 text-xs font-bold transition-colors disabled:opacity-50 flex items-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear Database</span>
          </button>
        </div>

        {/* 5 Station Status Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {stationList.map((st) => {
            const isOnline = stationNetworks[st.id];

            return (
              <button
                key={st.id}
                onClick={() => onToggleStationNetwork(st.id)}
                className={`bg-white border rounded-xl p-4 text-left transition-all shadow-xs w-full hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  isOnline ? 'border-slate-200/80 hover:border-slate-300' : 'border-rose-200 bg-rose-50/20 hover:border-rose-300'
                }`}
                title={`Click to toggle ${st.title} online/offline`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <h3 className="text-xs font-bold text-slate-900">{st.title}</h3>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      isOnline ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                    }`}
                  >
                    {isOnline ? 'ONLINE' : 'OFFLINE'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">{st.desc}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Order Queue Overview Table Card */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-4">
        <h2 className="text-base font-bold text-slate-900">Active Order Queue Overview</h2>

        {activeOrders.length === 0 ? (
          /* Empty State Matching Screenshot */
          <div className="py-16 text-center flex flex-col items-center justify-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-500 flex items-center justify-center">
              <Inbox className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">No active orders in queue</h3>
              <p className="text-xs text-slate-400 mt-1">New orders will appear here in real-time</p>
            </div>
          </div>
        ) : (
          /* Populated Table */
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-medium text-slate-600">
              <thead>
                <tr className="border-b border-slate-200/80 text-slate-400 uppercase text-[10px] tracking-wider">
                  <th className="pb-3 font-semibold">ORDER ID</th>
                  <th className="pb-3 font-semibold">CUSTOMER</th>
                  <th className="pb-3 font-semibold">ITEMS</th>
                  <th className="pb-3 font-semibold">CURRENT STATION</th>
                  <th className="pb-3 font-semibold">STATUS</th>
                  <th className="pb-3 font-semibold">TIME IN QUEUE</th>
                  <th className="pb-3 font-semibold text-right">ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {activeOrders.map((ord) => (
                  <tr key={ord.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 font-mono font-bold text-slate-900">
                      #{ord.id.slice(-6).toUpperCase()}
                    </td>
                    <td className="py-3.5 font-bold text-slate-900 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      {ord.customerName}
                    </td>
                    <td className="py-3.5 text-slate-600">
                      {ord.items.map((i) => `${i.quantity}x ${i.name}`).join(', ')}
                    </td>
                    <td className="py-3.5 font-bold uppercase text-purple-700">
                      {STATIONS[ord.currentStationId]?.name || ord.currentStationId}
                    </td>
                    <td className="py-3.5">
                      <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-bold text-[10px]">
                        {ord.status}
                      </span>
                    </td>
                    <td className="py-3.5 font-mono text-slate-500">
                      {Math.floor((Date.now() - ord.createdAt) / 60000)}m ago
                    </td>
                    <td className="py-3.5 text-right">
                      {ord.status === 'PLACED' && (
                        <button
                          onClick={() => onTransitionOrder(ord.id, ord.status, 'PREPARING', 'prep')}
                          className="px-3 py-1 rounded-lg bg-blue-600 text-white font-bold text-xs hover:bg-blue-700"
                        >
                          Start Prep
                        </button>
                      )}
                      {ord.status === 'PREPARING' && (
                        <button
                          onClick={() => onTransitionOrder(ord.id, ord.status, 'READY', 'assembly')}
                          className="px-3 py-1 rounded-lg bg-purple-600 text-white font-bold text-xs hover:bg-purple-700"
                        >
                          Mark Ready
                        </button>
                      )}
                      {ord.status === 'READY' && (
                        <button
                          onClick={() => onTransitionOrder(ord.id, ord.status, 'SERVED', 'expedite')}
                          className="px-3 py-1 rounded-lg bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700"
                        >
                          Serve
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
