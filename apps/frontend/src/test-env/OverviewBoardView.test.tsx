import React, { useState, useEffect } from 'react';
import { Order, OrderStatus, StationId } from '@ticketflow/types';
import { STATIONS } from '../types/kds';
import { OrderTicket } from '../components/OrderTicket';
import { StationNetworkMap } from '../hooks/useSocketKDS';
import { Wifi, WifiOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface OverviewBoardViewProps {
  orders: Order[];
  onTransitionOrder: (orderId: string, currentStatus: OrderStatus, newStatus: OrderStatus, stationId?: StationId) => void;
  stationNetworks: StationNetworkMap;
  onToggleStationNetwork: (stationId: StationId) => void;
  onlineUserIds: Set<string>;
}

export const OverviewBoardView: React.FC<OverviewBoardViewProps> = ({
  orders,
  onTransitionOrder,
  stationNetworks,
  onToggleStationNetwork,
  onlineUserIds,
}) => {
  const { authFetch } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [acknowledgedAlerts, setAcknowledgedAlerts] = useState<Set<string>>(new Set());
  const stationKeys: StationId[] = ['intake', 'prep', 'grill', 'assembly', 'expedite'];

  useEffect(() => {
    authFetch('http://localhost:4000/api/users')
      .then((res) => res.json())
      .then((data) => {
        if (data.users) setUsers(data.users);
      })
      .catch((err) => console.error('[OverviewBoard] Failed to fetch users:', err));
  }, [authFetch]);

  const getAssignedUserName = (userId?: string | null) => {
    if (!userId) return undefined;
    const match = users.find((u) => u.id === userId);
    return match ? match.fullName : undefined;
  };

  // Check if a station is collectively offline
  const isStationCollectivelyOffline = (stId: StationId) => {
    if (!stationNetworks[stId]) return true;
    if (stId === 'intake') return false; // Intake has no assigned cooks

    const stationCooks = users.filter((u) => u.role === 'STAFF' && u.assignedStations?.includes(stId));
    if (stationCooks.length === 0) return false;

    // Station is collectively offline if all cooks assigned to it are offline
    return stationCooks.every((cook) => !onlineUserIds.has(cook.id));
  };

  // Compile active alerts that are not acknowledged
  const activeAlerts: { key: string; message: string }[] = [];

  users.filter((u) => u.role === 'STAFF').forEach((cook) => {
    const isOffline = !onlineUserIds.has(cook.id);
    const alertKey = `cook-${cook.id}`;
    if (isOffline && !acknowledgedAlerts.has(alertKey)) {
      const stationsStr = cook.assignedStations?.join(', ') || 'N/A';
      activeAlerts.push({
        key: alertKey,
        message: `Cook "${cook.fullName}" is OFFLINE! Assigned station: [${stationsStr}]`,
      });
    }
  });

  stationKeys.forEach((stId) => {
    if (stId === 'intake') return;
    const isOffline = isStationCollectivelyOffline(stId);
    const alertKey = `station-${stId}`;
    if (isOffline && !acknowledgedAlerts.has(alertKey)) {
      const config = STATIONS[stId];
      activeAlerts.push({
        key: alertKey,
        message: `Station "${config.name}" has lost all staff socket links!`,
      });
    }
  });

  // Re-enable alerts automatically if cooks or stations reconnect
  useEffect(() => {
    setAcknowledgedAlerts((prev) => {
      const next = new Set(prev);
      let changed = false;

      users.forEach((u) => {
        if (onlineUserIds.has(u.id) && next.has(`cook-${u.id}`)) {
          next.delete(`cook-${u.id}`);
          changed = true;
        }
      });

      stationKeys.forEach((stId) => {
        if (!isStationCollectivelyOffline(stId) && next.has(`station-${stId}`)) {
          next.delete(`station-${stId}`);
          changed = true;
        }
      });

      return changed ? next : prev;
    });
  }, [onlineUserIds, stationNetworks, users]);

  const handleAcknowledgeAlert = (key: string) => {
    setAcknowledgedAlerts((prev) => {
      const next = new Set(prev);
      next.add(key);
      return next;
    });
  };

  return (
    <div className="relative space-y-6 font-sans">
      {/* Admin Sharp Critical Alert Modal */}
      {activeAlerts.length > 0 && (
        <div className="fixed bottom-6 right-6 z-50 max-w-sm w-full bg-slate-900 border-2 border-rose-600 text-white rounded-2xl p-4 shadow-2xl space-y-3 font-mono">
          <div className="flex items-center gap-2 text-rose-500 font-black text-xs">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
            <span className="uppercase tracking-wider">CRITICAL NETWORK ALERT</span>
          </div>
          <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
            {activeAlerts.map((alert) => (
              <div key={alert.key} className="flex items-start justify-between gap-3 text-[11px] bg-slate-800 p-2 rounded-lg border border-slate-700 font-bold leading-normal">
                <span>{alert.message}</span>
                <button
                  onClick={() => handleAcknowledgeAlert(alert.key)}
                  className="text-[10px] text-amber-300 hover:text-amber-100 uppercase shrink-0 font-black cursor-pointer bg-transparent border-0"
                >
                  [Dismiss]
                </button>
              </div>
            ))}
          </div>
          <div className="text-[9px] text-slate-400 font-sans leading-normal">
            Tickets on offline stations or assigned to offline cooks turn red below.
          </div>
        </div>
      )}

      {/* Main Grid columns */}
      <div className="flex md:grid md:grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-5 overflow-x-auto pb-4 snap-x snap-mandatory">
        {stationKeys.map((stId) => {
          const config = STATIONS[stId];
          const isSimulatedOnline = stationNetworks[stId];
          const isCollectivelyOffline = isStationCollectivelyOffline(stId);

          const columnOrders = isSimulatedOnline
            ? orders
                .filter((o) => {
                  if ((o.status as string) === 'SERVED') return false;
                  return o.currentStationId === stId;
                })
                .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
            : [];

          return (
            <div
              key={stId}
              className={`w-[85vw] sm:w-[320px] md:w-auto shrink-0 snap-center flex flex-col border rounded-2xl p-4 min-h-[500px] shadow-sm transition-all ${
                isSimulatedOnline 
                  ? isCollectivelyOffline 
                    ? 'bg-rose-50/20 border-rose-300'
                    : 'bg-white border-slate-200/80' 
                  : 'bg-rose-50/40 border-rose-200/80'
              }`}
            >
              {/* Column Header */}
              <div className="pb-3 border-b border-slate-200/80 mb-4 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-sm font-bold text-slate-900">{config.name}</h3>
                    <span className="text-xs font-mono font-bold text-blue-600">({columnOrders.length})</span>
                  </div>
                  <span className={`inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                    isCollectivelyOffline
                      ? 'bg-rose-100 text-rose-700 border-rose-200 animate-pulse font-black'
                      : 'bg-slate-100 text-slate-600 border-slate-200'
                  }`}>
                    {stId} {isCollectivelyOffline ? '• OFFLINE' : '• ONLINE'}
                  </span>
                </div>

                {/* Network Toggle Button */}
                <button
                  onClick={() => onToggleStationNetwork(stId)}
                  className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                    isSimulatedOnline
                      ? 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100'
                      : 'bg-rose-100 text-rose-700 border-rose-300 hover:bg-rose-200 animate-pulse'
                  }`}
                  title={`Toggle station network ${isSimulatedOnline ? 'OFF' : 'ON'}`}
                >
                  {isSimulatedOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
                </button>
              </div>

              {/* Column Order Tickets */}
              <div className="flex-1 space-y-4 overflow-y-auto max-h-[70vh]">
                {!isSimulatedOnline ? (
                  <div className="py-16 text-center text-xs font-medium text-rose-500 border border-dashed border-rose-300 rounded-xl bg-rose-50/60 p-4 space-y-2">
                    <WifiOff className="w-6 h-6 mx-auto text-rose-400 animate-pulse" />
                    <p className="font-bold">Station Network Offline</p>
                    <p className="text-[11px] text-rose-400">
                      No orders fetched while disconnected. Click Wifi icon above to reconnect and sync tickets.
                    </p>
                  </div>
                ) : columnOrders.length === 0 ? (
                  <div className="py-16 text-center text-xs font-medium text-slate-400 border border-dashed border-slate-200 rounded-xl">
                    No active tickets
                  </div>
                ) : (
                  columnOrders.map((order) => {
                    const isCookOffline = order.assignedUserId ? !onlineUserIds.has(order.assignedUserId) : false;
                    const highlightRed = isCookOffline || isCollectivelyOffline;
                    return (
                      <div 
                        key={order.id} 
                        className={`rounded-2xl p-1 transition-all ${
                          highlightRed 
                            ? 'border-2 border-rose-600 bg-rose-50/50 shadow-md shadow-rose-600/10' 
                            : 'border-transparent'
                        }`}
                      >
                        {highlightRed && (
                          <div className="bg-rose-600 text-white text-[9px] font-black text-center py-1 rounded-t-lg font-mono uppercase tracking-wider mb-1.5 flex items-center justify-center gap-1">
                            <WifiOff className="w-3.5 h-3.5 animate-pulse" />
                            <span>No Socket Connection</span>
                          </div>
                        )}
                        <OrderTicket
                          order={order}
                          onTransitionOrder={onTransitionOrder}
                          activeStationId={stId}
                          assignedStaffName={getAssignedUserName(order.assignedUserId)}
                        />
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
