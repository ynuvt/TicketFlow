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
    <div className="flex md:grid md:grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-5 overflow-x-auto pb-4 snap-x snap-mandatory">
      {stationKeys.map((stId) => {
        const config = STATIONS[stId];
        const isOnline = stationNetworks[stId];

        const columnOrders = orders.filter((o) => {
          if (o.status === 'SERVED') return false;
          return o.currentStationId === stId;
        });

        return (
          <div
            key={stId}
            className="w-[85vw] sm:w-[320px] md:w-auto shrink-0 snap-center flex flex-col bg-white border border-slate-200/80 rounded-2xl p-4 min-h-[500px] shadow-sm"
          >
            {/* Column Header */}
            <div className="pb-3 border-b border-slate-200/80 mb-4 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="text-sm font-bold text-slate-900">{config.name}</h3>
                  <span className="text-xs font-mono font-bold text-blue-600">({columnOrders.length})</span>
                </div>
                <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-600">
                  {stId}
                </span>
              </div>

              {/* Network Toggle Button */}
              <button
                onClick={() => onToggleStationNetwork(stId)}
                className={`p-1.5 rounded-lg border transition-colors ${
                  isOnline
                    ? 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100'
                    : 'bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100 animate-pulse'
                }`}
                title={`Toggle station network ${isOnline ? 'OFF' : 'ON'}`}
              >
                {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
              </button>
            </div>

            {/* Column Order Tickets */}
            <div className="flex-1 space-y-4 overflow-y-auto max-h-[70vh]">
              {columnOrders.length === 0 ? (
                <div className="py-16 text-center text-xs font-medium text-slate-400 border border-dashed border-slate-200 rounded-xl">
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
