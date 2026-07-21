import React from 'react';
import { Order, OrderStatus, StationId } from '@ticketflow/types';
import { STATIONS } from '../types/kds';
import { OrderTicket } from '../components/OrderTicket';
import { StationNetworkMap } from '../hooks/useSocketKDS';
import { Wifi, WifiOff } from 'lucide-react';

interface OverviewBoardViewProps {
  orders: Order[];
  onTransitionOrder: (orderId: string, currentStatus: OrderStatus, newStatus: OrderStatus, stationId?: StationId) => void;
  stationNetworks: StationNetworkMap;
  onToggleStationNetwork: (stationId: StationId) => void;
}

export const OverviewBoardView: React.FC<OverviewBoardViewProps> = ({
  orders,
  onTransitionOrder,
  stationNetworks,
  onToggleStationNetwork,
}) => {
  const stationKeys: StationId[] = ['intake', 'prep', 'grill', 'assembly', 'expedite'];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
      {stationKeys.map((stId) => {
        const config = STATIONS[stId];
        const isOnline = stationNetworks[stId];

        const columnOrders = orders.filter((o) => {
          if (o.status === 'SERVED') return false;
          return o.currentStationId === stId;
        });

        return (
          <div key={stId} className="flex flex-col bg-slate-900/80 border border-slate-800 rounded-2xl p-3.5 min-h-[500px]">
            {/* Column Header */}
            <div className="pb-3 border-b border-slate-800 mb-3 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="text-sm font-bold text-white">{config.name}</h3>
                  <span className="text-xs font-mono font-bold text-amber-400">({columnOrders.length})</span>
                </div>
                <span className={`inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${config.badgeColor}`}>
                  {stId}
                </span>
              </div>

              {/* Network Toggle Button for Column */}
              <button
                onClick={() => onToggleStationNetwork(stId)}
                className={`p-1.5 rounded-lg border transition-colors ${
                  isOnline
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                    : 'bg-rose-500/20 text-rose-400 border-rose-500/30 hover:bg-rose-500/30 animate-pulse'
                }`}
                title={`Toggle station network ${isOnline ? 'OFF' : 'ON'}`}
              >
                {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
              </button>
            </div>

            {/* Column Order Tickets */}
            <div className="flex-1 space-y-4">
              {columnOrders.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-500 font-mono border border-dashed border-slate-800 rounded-xl">
                  No active tickets
                </div>
              ) : (
                columnOrders.map((order) => (
                  <OrderTicket
                    key={order.id}
                    order={order}
                    onTransitionOrder={onTransitionOrder}
                    activeStationId={stId}
                  />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
