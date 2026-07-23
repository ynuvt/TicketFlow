import React from 'react';
import { Order, OrderStatus, StationId } from '@ticketflow/types';
import { STATIONS } from '../types/kds';
import { Receipt, CheckCircle2, Clock, User, ArrowRight } from 'lucide-react';

interface OrdersViewProps {
  orders: Order[];
  onTransitionOrder: (orderId: string, currentStatus: OrderStatus, newStatus: OrderStatus, stationId?: StationId) => void;
}

export const OrdersView: React.FC<OrdersViewProps> = ({ orders, onTransitionOrder }) => {
  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Receipt className="w-5 h-5 text-blue-600" />
              All Master Kitchen Orders ({orders.length})
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Complete historical and active order list synchronized via monotonic event stream
            </p>
          </div>
        </div>

        {orders.length === 0 ? (
          <div className="py-16 text-center text-xs text-slate-400 font-mono">No orders found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-medium text-slate-600">
              <thead>
                <tr className="border-b border-slate-200/80 text-slate-400 uppercase text-[10px] tracking-wider">
                  <th className="pb-3 font-semibold">ORDER ID</th>
                  <th className="pb-3 font-semibold">CUSTOMER</th>
                  <th className="pb-3 font-semibold">ITEMS</th>
                  <th className="pb-3 font-semibold">STATION</th>
                  <th className="pb-3 font-semibold">STATUS</th>
                  <th className="pb-3 font-semibold">CREATED</th>
                  <th className="pb-3 font-semibold text-right">ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.map((ord) => (
                  <tr key={ord.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 font-mono font-bold text-slate-900">
                      #{ord.id.slice(-6).toUpperCase()}
                    </td>
                    <td className="py-3.5 font-bold text-slate-900">{ord.customerName}</td>
                    <td className="py-3.5 text-slate-600">
                      {ord.items.map((i) => `${i.quantity}x ${i.name}`).join(', ')}
                    </td>
                    <td className="py-3.5 font-bold uppercase text-purple-700">
                      {STATIONS[ord.currentStationId]?.name || ord.currentStationId}
                    </td>
                    <td className="py-3.5">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          ord.status === 'SERVED'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-blue-50 text-blue-700'
                        }`}
                      >
                        {ord.status}
                      </span>
                    </td>
                    <td className="py-3.5 font-mono text-slate-400">
                      {new Date(ord.createdAt).toLocaleTimeString()}
                    </td>
                    <td className="py-3.5 text-right">
                      {ord.status === 'PLACED' && (
                        <button
                          onClick={() => onTransitionOrder(ord.id, ord.status, 'PREPARING', 'prep')}
                          className="px-2.5 py-1 rounded-lg bg-blue-600 text-white font-bold text-[11px] hover:bg-blue-700"
                        >
                          Start Prep
                        </button>
                      )}
                      {ord.status === 'PREPARING' && (
                        <button
                          onClick={() => onTransitionOrder(ord.id, ord.status, 'READY', 'assembly')}
                          className="px-2.5 py-1 rounded-lg bg-purple-600 text-white font-bold text-[11px] hover:bg-purple-700"
                        >
                          Mark Ready
                        </button>
                      )}
                      {ord.status === 'READY' && (
                        <button
                          onClick={() => onTransitionOrder(ord.id, ord.status, 'SERVED', 'expedite')}
                          className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-bold text-[11px] hover:bg-emerald-700"
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
