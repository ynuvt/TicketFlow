import React from 'react';
import { Order, OrderStatus, StationId } from '@ticketflow/types';
import { STATIONS } from '../types/kds';
import { OrderTicket } from '../components/OrderTicket';
import { Wifi, WifiOff, ChefHat, CheckCircle2 } from 'lucide-react';

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

        {/* Station Network Control Switch */}
        <div className="flex items-center gap-4 bg-slate-50 p-3 rounded-xl border border-slate-200/80 font-mono text-xs">
          <div>
            <span className="text-slate-500 font-sans">Station Status:</span>
            <span className={`font-bold ml-1.5 ${isStationOnline ? 'text-emerald-600' : 'text-rose-600'}`}>
              {isStationOnline ? 'ONLINE' : 'OFFLINE'}
            </span>
          </div>

          <button
            onClick={() => onToggleStationNetwork(stationId)}
            className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-all ${
              isStationOnline
                ? 'bg-white hover:bg-rose-50 text-rose-600 border-rose-200'
                : 'bg-white hover:bg-emerald-50 text-emerald-600 border-emerald-200 animate-pulse'
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
      {!isStationOnline ? (
        <div className="bg-rose-50/60 border border-dashed border-rose-300 rounded-2xl p-16 text-center space-y-3 shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-rose-100 text-rose-600 mx-auto flex items-center justify-center">
            <WifiOff className="w-7 h-7 animate-pulse" />
          </div>
          <h3 className="text-lg font-bold text-rose-900">Station Network Offline</h3>
          <p className="text-xs text-rose-600 max-w-md mx-auto">
            This station's socket network connection is currently disconnected. Orders are not fetched while offline. Click <strong>Simulate Reconnect</strong> above to re-establish connection and sync tickets.
          </p>
        </div>
      ) : stationOrders.length === 0 ? (
        <div className="bg-white border border-slate-200/80 rounded-2xl p-16 text-center space-y-3 shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center">
            <CheckCircle2 className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-bold text-slate-800">Station Queue Clear</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
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
