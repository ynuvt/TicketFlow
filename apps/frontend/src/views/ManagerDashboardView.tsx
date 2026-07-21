import React from 'react';
import { Order, OrderStatus, StationId, KitchenEvent } from '@ticketflow/types';
import { StationNetworkMap } from '../hooks/useSocketKDS';
import { STATIONS } from '../types/kds';
import { PlusCircle, Activity, Layers, Wifi, WifiOff, Clock, User, CheckCircle2, ShieldCheck, Flame, UtensilsCrossed } from 'lucide-react';

interface ManagerDashboardViewProps {
  orders: Order[];
  events: KitchenEvent[];
  lastProcessedSequence: number;
  connectionStatus: string;
  stationNetworks: StationNetworkMap;
  onToggleStationNetwork: (stationId: StationId) => void;
  onTransitionOrder: (orderId: string, currentStatus: OrderStatus, newStatus: OrderStatus, stationId?: StationId) => void;
  onOpenCreateModal: () => void;
}

export const ManagerDashboardView: React.FC<ManagerDashboardViewProps> = ({
  orders,
  events,
  lastProcessedSequence,
  connectionStatus,
  stationNetworks,
  onToggleStationNetwork,
  onTransitionOrder,
  onOpenCreateModal,
}) => {
  const activeOrders = orders.filter((o) => o.status !== 'SERVED');
  const servedOrders = orders.filter((o) => o.status === 'SERVED');
  const vipOrders = orders.filter((o) => o.priority === 'VIP' && o.status !== 'SERVED');

  const stationKeys: StationId[] = ['intake', 'prep', 'grill', 'assembly', 'expedite'];

  return (
    <div className="space-y-8">
      {/* Top Banner / Metrics Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between shadow-lg">
          <div>
            <p className="text-xs text-slate-400 font-mono">ACTIVE TICKETS</p>
            <p className="text-2xl font-bold text-amber-400">{activeOrders.length}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
            <UtensilsCrossed className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between shadow-lg">
          <div>
            <p className="text-xs text-slate-400 font-mono">SERVED COMPLETED</p>
            <p className="text-2xl font-bold text-emerald-400">{servedOrders.length}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between shadow-lg">
          <div>
            <p className="text-xs text-slate-400 font-mono">MONOTONIC SEQUENCE</p>
            <p className="text-2xl font-bold text-sky-400">#{lastProcessedSequence}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-sky-500/20 text-sky-400 border border-sky-500/30 flex items-center justify-center">
            <Layers className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between shadow-lg">
          <div>
            <p className="text-xs text-slate-400 font-mono">VIP / RUSH TICKETS</p>
            <p className="text-2xl font-bold text-rose-400">{vipOrders.length}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center">
            <Flame className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Station Network Matrix Controls */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Wifi className="w-5 h-5 text-amber-400" />
              Kitchen Station Network Status Matrix
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Manually toggle network connectivity per station to simulate offline drops & test reconnect replay sync
            </p>
          </div>
          <button
            onClick={onOpenCreateModal}
            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 flex items-center gap-1.5 transition-all"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Create Order</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {stationKeys.map((stId) => {
            const config = STATIONS[stId];
            const isOnline = stationNetworks[stId];

            return (
              <div
                key={stId}
                className="bg-slate-950 border border-slate-800 p-4 rounded-xl flex flex-col justify-between space-y-3"
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-white">{config.name}</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                        isOnline ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400 animate-pulse'
                      }`}
                    >
                      {isOnline ? 'ONLINE' : 'OFFLINE'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">{config.description}</p>
                </div>

                <button
                  onClick={() => onToggleStationNetwork(stId)}
                  className={`w-full py-1.5 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                    isOnline
                      ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border-rose-500/30'
                      : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                  }`}
                >
                  {isOnline ? (
                    <>
                      <WifiOff className="w-3.5 h-3.5" />
                      <span>Turn OFFLINE</span>
                    </>
                  ) : (
                    <>
                      <Wifi className="w-3.5 h-3.5" />
                      <span>Turn ONLINE</span>
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Active Orders Summary Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <h3 className="text-lg font-bold text-white">Active Order Queue Overview</h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs text-slate-300">
            <thead>
              <tr className="border-b border-slate-800 text-slate-500 uppercase">
                <th className="pb-3 font-semibold">Order ID</th>
                <th className="pb-3 font-semibold">Customer</th>
                <th className="pb-3 font-semibold">Items</th>
                <th className="pb-3 font-semibold">Priority</th>
                <th className="pb-3 font-semibold">Current Station</th>
                <th className="pb-3 font-semibold">Status</th>
                <th className="pb-3 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {orders.map((ord) => (
                <tr key={ord.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="py-3 font-bold text-amber-400">#{ord.id.slice(-6).toUpperCase()}</td>
                  <td className="py-3 font-semibold text-white">{ord.customerName}</td>
                  <td className="py-3 text-slate-400">
                    {ord.items.map((i) => `${i.quantity}x ${i.name}`).join(', ')}
                  </td>
                  <td className="py-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        ord.priority === 'VIP'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : ord.priority === 'HIGH'
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {ord.priority}
                    </span>
                  </td>
                  <td className="py-3 text-purple-400 font-bold">{ord.currentStationId.toUpperCase()}</td>
                  <td className="py-3">
                    <span className="px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 font-bold border border-sky-500/20">
                      {ord.status}
                    </span>
                  </td>
                  <td className="py-3 text-right">
                    {ord.status === 'PLACED' && (
                      <button
                        onClick={() => onTransitionOrder(ord.id, ord.status, 'PREPARING', 'prep')}
                        className="px-2.5 py-1 rounded bg-amber-500 text-slate-950 font-bold hover:bg-amber-400"
                      >
                        Start Prep
                      </button>
                    )}
                    {ord.status === 'PREPARING' && (
                      <button
                        onClick={() => onTransitionOrder(ord.id, ord.status, 'READY', 'assembly')}
                        className="px-2.5 py-1 rounded bg-purple-500 text-white font-bold hover:bg-purple-400"
                      >
                        Mark Ready
                      </button>
                    )}
                    {ord.status === 'READY' && (
                      <button
                        onClick={() => onTransitionOrder(ord.id, ord.status, 'SERVED', 'expedite')}
                        className="px-2.5 py-1 rounded bg-emerald-500 text-slate-950 font-bold hover:bg-emerald-400"
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
      </div>
    </div>
  );
};
