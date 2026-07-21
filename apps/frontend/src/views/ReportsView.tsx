import React from 'react';
import { Order } from '@ticketflow/types';
import { BarChart3, TrendingUp, Clock, CheckCircle2, Flame, Award } from 'lucide-react';

interface ReportsViewProps {
  orders: Order[];
}

export const ReportsView: React.FC<ReportsViewProps> = ({ orders }) => {
  const servedCount = orders.filter((o) => o.status === 'SERVED').length;
  const activeCount = orders.filter((o) => o.status !== 'SERVED').length;
  const vipCount = orders.filter((o) => o.priority === 'VIP' || o.priority === 'HIGH').length;

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-6">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-600" />
            Kitchen Analytics & Reports
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time performance metrics, ticket throughput, and station efficiency analytics
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="bg-slate-50 border border-slate-200/80 p-5 rounded-2xl">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-500">Kitchen Throughput</span>
              <TrendingUp className="w-4 h-4 text-emerald-600" />
            </div>
            <p className="text-2xl font-bold text-slate-900">{servedCount} Orders</p>
            <p className="text-xs text-slate-400 mt-1">Completed today</p>
          </div>

          <div className="bg-slate-50 border border-slate-200/80 p-5 rounded-2xl">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-500">Active Queue Load</span>
              <Clock className="w-4 h-4 text-blue-600" />
            </div>
            <p className="text-2xl font-bold text-slate-900">{activeCount} Orders</p>
            <p className="text-xs text-slate-400 mt-1">In prep & assembly</p>
          </div>

          <div className="bg-slate-50 border border-slate-200/80 p-5 rounded-2xl">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-500">Priority Ratio</span>
              <Flame className="w-4 h-4 text-rose-600" />
            </div>
            <p className="text-2xl font-bold text-slate-900">
              {orders.length > 0 ? Math.round((vipCount / orders.length) * 100) : 0}% VIP/Rush
            </p>
            <p className="text-xs text-slate-400 mt-1">High urgency requests</p>
          </div>
        </div>
      </div>
    </div>
  );
};
