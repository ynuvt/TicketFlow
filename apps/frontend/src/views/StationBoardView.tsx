import React, { useState, useEffect } from 'react';
import { Order, OrderStatus, StationId } from '@ticketflow/types';
import { STATIONS } from '../types/kds';
import { OrderTicket } from '../components/OrderTicket';
import { Wifi, WifiOff, ChefHat, CheckCircle2, Layers, AlertCircle, Clock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface StationBoardViewProps {
  stationId: StationId;
  orders: Order[];
  onTransitionOrder: (orderId: string, currentStatus: OrderStatus, newStatus: OrderStatus, stationId?: StationId) => void;
  isStationOnline: boolean;
  onToggleStationNetwork: (stationId: StationId) => void;
  onOpenCreateModal?: () => void;
}

export const StationBoardView: React.FC<StationBoardViewProps> = ({
  stationId,
  orders,
  onTransitionOrder,
  isStationOnline,
  onToggleStationNetwork,
  onOpenCreateModal,
}) => {
  const { user, authFetch } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [customerEta, setCustomerEta] = useState<number | null>(null);
  const [stationSummaries, setStationSummaries] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const stationConfig = STATIONS[stationId] || STATIONS.intake;

  // Fetch live Customer ETA metrics for Intake board
  useEffect(() => {
    if (stationId === 'intake') {
      const loadEta = () => {
        authFetch('http://localhost:4000/api/metrics/workload')
          .then((res) => res.json())
          .then((data) => {
            if (data.totalCustomerEtaMinutes !== undefined) {
              setCustomerEta(data.totalCustomerEtaMinutes);
            }
            if (data.stationSummaries) {
              setStationSummaries(data.stationSummaries);
            }
          })
          .catch((err) => console.error('[StationBoard] ETA fetch failed:', err));
      };
      loadEta();
      const interval = setInterval(loadEta, 5000);
      return () => clearInterval(interval);
    }
  }, [stationId, authFetch]);

  // Fetch users if manager so we can map assignedUserId to actual staff names
  useEffect(() => {
    if (user?.role === 'MANAGER') {
      authFetch('http://localhost:4000/api/users')
        .then((res) => res.json())
        .then((data) => {
          if (data.users) setUsers(data.users);
        })
        .catch((err) => console.error('[StationBoard] Failed to fetch users:', err));
    }
  }, [user, authFetch]);

  // Map user ID to name
  const getAssignedUserName = (userId?: string | null) => {
    if (!userId) return 'Unassigned';
    const match = users.find((u) => u.id === userId);
    return match ? match.fullName : 'Kitchen Staff';
  };

  // Filter orders at this station S that are currently in the waiting list (assignedUserId === null)
  const waitingOrders = orders.filter((o) => {
    if (o.status === 'SERVED') return false;
    return o.currentStationId === stationId && !o.assignedUserId;
  });

  // Filter active orders at this station S (assignedUserId !== null)
  const activeOrders = orders.filter((o) => {
    if ((o.status as string) === 'SERVED') return false;
    
    // Intake station (Receptionist) sees all active kitchen orders to track ETAs and completion
    if (stationId === 'intake') {
      return (o.status as string) !== 'SERVED';
    }

    if (o.currentStationId !== stationId) return false;

    if (user?.role === 'STAFF') {
      // Staff sees orders assigned to their user ID, username, or deterministic user-ID
      return (
        o.assignedUserId === user.id ||
        o.assignedUserId === user.username ||
        o.assignedUserId === `user-${user.username}`
      );
    } else {
      // Manager/Receptionist sees all assigned orders at S
      return !!o.assignedUserId;
    }
  });

  const calculateOrderEstimatedServingTime = (order: Order, summaries: any) => {
    const stationsOrder = ['prep', 'grill', 'assembly', 'expedite'];
    const currentIdx = stationsOrder.indexOf(order.currentStationId || 'prep');
    if (currentIdx === -1) return 0;

    const defaultPrepTimes: Record<string, number> = {
      prep: 5,
      grill: 6,
      assembly: 5,
      expedite: 4
    };

    // 1. Sum up default prep times for all stations starting from the current station
    let totalEst = 0;
    for (let i = currentIdx; i < stationsOrder.length; i++) {
      const stId = stationsOrder[i];
      totalEst += defaultPrepTimes[stId] || 5;
    }

    // 2. Subtract the elapsed time that the order has spent at its current station
    const elapsedMinutes = (Date.now() - new Date(order.updatedAt).getTime()) / 60000;
    
    // We cap subtraction at current station's avg prep time to avoid negative estimates
    const currentStationAvg = defaultPrepTimes[order.currentStationId || 'prep'] || 5;
    const currentStationProgress = Math.min(elapsedMinutes, currentStationAvg);
    
    totalEst = totalEst - currentStationProgress;

    // 3. Add queue delays from summaries if there are waiting orders
    for (let i = currentIdx; i < stationsOrder.length; i++) {
      const stId = stationsOrder[i];
      const summary = summaries?.[stId];
      if (summary && summary.waitingCount > 0) {
        totalEst += (summary.waitingCount * 2);
      }
    }

    return Math.max(Math.round(totalEst), 1);
  };

  const displayedOrders = activeOrders.filter((o) => {
    if (stationId !== 'intake' || !searchQuery) return true;
    const term = searchQuery.toLowerCase().trim();
    const kotId = `#${o.id.slice(-6).toUpperCase()}`;
    const customer = o.customerName.toLowerCase();
    return kotId.includes(term) || o.id.toLowerCase().includes(term) || customer.includes(term);
  });

  return (
    <div className="space-y-6 font-sans">
      {/* Intake Dashboard Metrics Panel */}
      {stationId === 'intake' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm font-mono text-slate-900">
          {/* Total Orders Card */}
          <div className="bg-slate-50 border border-slate-200 p-5 rounded-xl flex flex-col justify-between">
            <div>
              <p className="text-xs font-black text-slate-500 uppercase tracking-wider">Total Active Orders</p>
              <h3 className="text-4xl font-black text-slate-900 mt-2">
                {orders.filter(o => (o.status as string) !== 'SERVED').length} <span className="text-xs font-medium text-slate-450">KOTs</span>
              </h3>
            </div>
            <div className="text-[10px] text-slate-500 mt-4 leading-normal font-sans">
              Live tickets currently being prepared or processed across the kitchen pipeline.
            </div>
          </div>

          {/* Station Backlog Columns */}
          <div className="lg:col-span-2 space-y-4">
            <p className="text-xs font-black text-slate-500 uppercase tracking-wider">Kitchen Stations Status</p>
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 font-black text-slate-700">
                    <th className="p-3">STATION</th>
                    <th className="p-3 text-center">WAITING</th>
                    <th className="p-3 text-center">ACTIVE</th>
                    <th className="p-3 text-center">AVG. PREP</th>
                    <th className="p-3 text-right">STATION ETA</th>
                  </tr>
                </thead>
                <tbody className="font-bold text-slate-800">
                  {[
                    { id: 'prep', name: 'Prep Line', avg: '5m' },
                    { id: 'grill', name: 'Grill & Cook', avg: '6m' },
                    { id: 'assembly', name: 'Plate & Assembly', avg: '5m' },
                    { id: 'expedite', name: 'Expedite & Pass', avg: '4m' }
                  ].map((st) => {
                    const summary = stationSummaries?.[st.id];
                    return (
                      <tr key={st.id} className="border-b border-slate-200 hover:bg-slate-50/50">
                        <td className="p-3 font-black text-slate-900">{st.name}</td>
                        <td className="p-3 text-center font-mono text-amber-700">
                          {summary ? summary.waitingCount : 0}
                        </td>
                        <td className="p-3 text-center font-mono text-blue-700">
                          {summary ? summary.activeCount : 0}
                        </td>
                        <td className="p-3 text-center text-slate-500">{st.avg}</td>
                        <td className="p-3 text-right font-mono font-black text-slate-900">
                          {summary ? summary.shortestTimeline : 5} mins
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Station Control Banner */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center font-bold">
            <ChefHat className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-slate-900">{stationConfig.name}</h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                {stationConfig.allowedStatuses.join(' / ')}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5 font-medium">{stationConfig.description}</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full md:w-auto">
          {stationId === 'intake' && (
            <input
              type="text"
              placeholder="Search KOT / Customer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-slate-50 border border-slate-200/80 rounded-xl px-3.5 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white text-slate-900 w-48 transition-all"
            />
          )}

          {stationId === 'intake' && onOpenCreateModal && (
            <button
              onClick={onOpenCreateModal}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 shadow-sm transition-all whitespace-nowrap self-stretch sm:self-auto justify-center"
            >
              ＋ Add New Order
            </button>
          )}

          {/* Station Network status */}
          <div className="flex items-center gap-4 bg-slate-50 p-3 rounded-xl border border-slate-200/80 font-mono text-xs w-full sm:w-auto justify-between sm:justify-start">
            <div>
              <span className="text-slate-500 font-sans">Station:</span>
              <span className={`font-bold ml-1.5 ${isStationOnline ? 'text-emerald-600' : 'text-rose-600'}`}>
                {isStationOnline ? 'ONLINE' : 'OFFLINE'}
              </span>
            </div>

            <button
              onClick={() => onToggleStationNetwork(stationId)}
              className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-all ${
                isStationOnline
                  ? 'bg-white hover:bg-rose-50 text-rose-600 border-rose-200'
                  : 'bg-white hover:bg-emerald-50 text-emerald-600 border-emerald-200'
              }`}
            >
              {isStationOnline ? 'Simulate Drop' : 'Simulate Reconnect'}
            </button>
          </div>
        </div>
      </div>

      {/* Network offline screen */}
      {!isStationOnline ? (
        <div className="bg-rose-50/60 border border-dashed border-rose-300 rounded-2xl p-16 text-center space-y-3 shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-rose-100 text-rose-600 mx-auto flex items-center justify-center">
            <WifiOff className="w-7 h-7 animate-pulse" />
          </div>
          <h3 className="text-lg font-bold text-rose-900">Station Network Offline</h3>
          <p className="text-xs text-rose-600 max-w-md mx-auto">
            This station's socket network connection is offline. Simulation mode active.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Waiting List Bar (circular queue indicators at top of dashboard) */}
          {stationId !== 'intake' && (
            <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row items-center gap-4 justify-between">
              <div className="flex items-center gap-3.5 w-full sm:w-auto">
                <div className="relative flex">
                  {waitingOrders.length > 0 && (
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  )}
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs ${
                    waitingOrders.length > 0 ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-400'
                  }`}>
                    {waitingOrders.length}
                  </div>
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-amber-500" />
                    Waiting Queue Pool
                  </h3>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    Sliding window buffer (capped at 20-min active workload per staff member)
                  </p>
                </div>
              </div>

              {/* Scrollable list of waiting orders */}
              <div className="flex-1 flex gap-2 overflow-x-auto py-1 px-2 scrollbar-none justify-start w-full sm:w-auto">
                {waitingOrders.length === 0 ? (
                  <span className="text-[11px] text-slate-400 font-semibold italic">No tickets waiting. Active slots available.</span>
                ) : (
                  waitingOrders.map((o) => {
                    const totalQty = o.items.reduce((acc, item) => acc + item.quantity, 0);
                    return (
                      <div
                        key={o.id}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-[11px] font-bold shrink-0 shadow-sm transition-transform hover:scale-105 ${
                          o.priority === 'VIP'
                            ? 'bg-amber-50 text-amber-800 border-amber-300'
                            : o.priority === 'HIGH'
                            ? 'bg-rose-50 text-rose-800 border-rose-300'
                            : 'bg-slate-50 text-slate-700 border-slate-200'
                        }`}
                        title={`${o.customerName} - ${totalQty} items`}
                      >
                        <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
                        <span>#{o.id.slice(-4).toUpperCase()}</span>
                        <span className="text-[9px] font-normal opacity-60">({totalQty} items)</span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* Active queue displays */}
          {displayedOrders.length === 0 ? (
            <div className="bg-white border border-slate-200/80 rounded-2xl p-16 text-center space-y-3 shadow-sm">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-bold text-slate-800">Your Queue is Clear</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                {user?.role === 'STAFF'
                  ? 'Great job! You have no active tickets assigned to you at the moment.'
                  : 'No active assigned tickets pending at this station.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {displayedOrders.map((order) => {
                const orderEta = calculateOrderEstimatedServingTime(order, stationSummaries);
                return (
                  <div key={order.id} className="relative group">
                    <OrderTicket
                      order={order}
                      onTransitionOrder={onTransitionOrder}
                      activeStationId={stationId}
                      assignedStaffName={getAssignedUserName(order.assignedUserId)}
                    />
                    {stationId === 'intake' && (
                      <div className="mt-2 bg-slate-900 border border-slate-900 text-white p-2.5 rounded-xl text-[10px] font-mono font-black flex items-center justify-between shadow-sm">
                        <span>EST. TIME TO SERVE:</span>
                        <span className="text-amber-300 font-extrabold text-xs">{orderEta} mins</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
