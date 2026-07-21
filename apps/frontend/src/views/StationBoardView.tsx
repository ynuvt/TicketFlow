import React from 'react';
import { Order, OrderStatus, StationId } from '@ticketflow/types';
import { STATIONS } from '../types/kds';
import { OrderTicket } from '../components/OrderTicket';
import { Wifi, WifiOff, RefreshCw, ChefHat, CheckCircle2 } from 'lucide-react';

interface StationBoardViewProps {
  stationId: StationId;
  orders: Order[];
  onTransitionOrder: (orderId: string, currentStatus: OrderStatus, newStatus: OrderStatus, stationId?: StationId) => void;
  isStationOnline: boolean;
  onToggleStationNetwork: (stationId: StationId) => void;
}

export const StationBoardView: React.FC<StationBoardViewProps> = ({
  stationId,
  orders,
  onTransitionOrder,
  isStationOnline,
  onToggleStationNetwork,
}) => {
  const stationConfig = STATIONS[stationId] || STATIONS.intake;

  // Filter orders applicable to this station
  const stationOrders = orders.filter((o) => {
    if (o.status === 'SERVED') return false; // Served orders hidden from station displays
    return o.currentStationId === stationId || stationConfig.allowedStatuses.includes(o.status);
  });

  return (
    <div className="space-y-6">
      {/* Station Control & Information Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center border ${stationConfig.badgeColor}`}>
            <ChefHat className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-white">{stationConfig.name}</h2>
              <span className={`px-2.5 py-0.5 rounded text-xs font-bold uppercase border ${stationConfig.badgeColor}`}>
                {stationConfig.allowedStatuses.join(' / ')}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">{stationConfig.description}</p>
          </div>
        </div>

        {/* Station Network Control Switch */}
        <div className="flex items-center gap-4 bg-slate-950 p-3 rounded-xl border border-slate-800 font-mono text-xs">
          <div>
            <span className="text-slate-500">Station Status:</span>
            <span className={`font-bold ml-1.5 ${isStationOnline ? 'text-emerald-400' : 'text-rose-400'}`}>
              {isStationOnline ? 'ONLINE' : 'OFFLINE'}
            </span>
          </div>

          <button
            onClick={() => onToggleStationNetwork(stationId)}
            className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-all ${
              isStationOnline
                ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border-rose-500/30'
                : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/30 animate-pulse'
            }`}
          >
            {isStationOnline ? (
              <>
                <WifiOff className="w-3.5 h-3.5" />
                <span>Simulate Drop</span>
              </>
            ) : (
              <>
                <Wifi className="w-3.5 h-3.5" />
                <span>Simulate Reconnect</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Ticket Grid Display */}
      {stationOrders.length === 0 ? (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-12 text-center space-y-3">
          <CheckCircle2 className="w-12 h-12 text-emerald-500/50 mx-auto" />
          <h3 className="text-lg font-bold text-slate-300">Station Queue Clear</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            No active tickets pending at {stationConfig.name}. Incoming order transitions will stream here automatically.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {stationOrders.map((order) => (
            <OrderTicket
              key={order.id}
              order={order}
              onTransitionOrder={onTransitionOrder}
              activeStationId={stationId}
            />
          ))}
        </div>
      )}
    </div>
  );
};
