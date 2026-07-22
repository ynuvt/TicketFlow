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
    if (o.status === 'SERVED') return false;
    
    // Intake station orders are never assigned (they are created by reception and sent forward)
    if (stationId === 'intake') {
      return o.currentStationId === 'intake';
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

  return (
    <div className="space-y-6 font-sans">
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
          {stationId === 'intake' && customerEta !== null && (
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200/90 px-3.5 py-2 rounded-xl text-amber-800 text-xs font-bold font-mono shadow-2xs">
              <Clock className="w-4 h-4 text-amber-600" />
              <span>Est. Preparation Time: <strong className="text-amber-950 text-xs font-extrabold ml-1">{customerEta} mins</strong></span>
            </div>
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
          {activeOrders.length === 0 ? (
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
              {activeOrders.map((order) => (
                <div key={order.id} className="relative group">
                  <OrderTicket
                    order={order}
                    onTransitionOrder={onTransitionOrder}
                    activeStationId={stationId}
                    assignedStaffName={getAssignedUserName(order.assignedUserId)}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
