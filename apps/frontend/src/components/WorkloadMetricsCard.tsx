import React, { useState, useEffect } from 'react';
import { ChefHat, Clock, AlertTriangle, Layers, UserCheck, RefreshCw, Zap } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface StationBreakdown {
  workload: number;
  activeCount: number;
  avgTime: number;
  isOverdue: boolean;
}

interface StaffMetric {
  id: string;
  fullName: string;
  username: string;
  assignedStations: string[];
  totalPredictedWorkload: number;
  stationBreakdown: Record<string, StationBreakdown>;
}

interface StationSummary {
  waitingCount: number;
  activeCount: number;
  shortestTimeline: number;
}

interface WorkloadMetricsData {
  staffMetrics: StaffMetric[];
  stationSummaries: Record<string, StationSummary>;
  totalCustomerEtaMinutes: number;
  updatedAt: number;
}

export const WorkloadMetricsCard: React.FC = () => {
  const { authFetch } = useAuth();
  const [data, setData] = useState<WorkloadMetricsData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchMetrics = async () => {
    try {
      const res = await authFetch('http://localhost:4000/api/metrics/workload');
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error('[WorkloadMetricsCard] Failed to fetch workload metrics:', err);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchMetrics();
    // Auto-refresh every 5 seconds for live elapsed-time predictions
    const interval = setInterval(fetchMetrics, 5000);
    return () => clearInterval(interval);
  }, []);

  if (isLoading) {
    return (
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm text-center text-xs text-slate-400 font-medium">
        Loading live workload & station metrics...
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6 font-sans">
      {/* Top Banner: Overall ETA & Live Refresh Ticker */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white rounded-2xl p-6 shadow-lg border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center font-bold">
            <Zap className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold">Time-Based Workload & Dispatch Engine</h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30 font-mono">
                Dynamic Elapsed-Time Engine
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Live predicted cook timelines dynamically calculated using real elapsed prep times and overdue delays.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 bg-white/10 p-3.5 rounded-xl border border-white/10 backdrop-blur-sm self-stretch md:self-auto justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-400" />
            <div>
              <span className="text-[10px] text-slate-300 uppercase tracking-wider font-bold block">Estimated Customer ETA</span>
              <span className="text-xl font-extrabold font-mono text-amber-300">{data.totalCustomerEtaMinutes} mins</span>
            </div>
          </div>

          <button
            onClick={fetchMetrics}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-slate-200 transition-colors"
            title="Refresh Metrics"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Staff Cook Workloads Grid */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <ChefHat className="w-4 h-4 text-blue-600" />
            <span>Cook Workloads per Assigned Station ({data.staffMetrics.length} Staff)</span>
          </h4>
          <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
            20-Min Sliding Timeline Cap
          </span>
        </div>

        {data.staffMetrics.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-400 italic">No kitchen staff accounts registered.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.staffMetrics.map((staff) => {
              const workloadPct = Math.min((staff.totalPredictedWorkload / 20) * 100, 100);
              const isHigh = staff.totalPredictedWorkload >= 18;
              const isMed = staff.totalPredictedWorkload >= 12 && staff.totalPredictedWorkload < 18;

              // Check if any station assigned to cook is overdue
              const hasOverdue = Object.values(staff.stationBreakdown).some((sb) => sb.isOverdue);

              return (
                <div
                  key={staff.id}
                  className={`p-4 rounded-xl border transition-all space-y-3 ${
                    hasOverdue
                      ? 'bg-rose-50/40 border-rose-200/80 shadow-sm'
                      : 'bg-slate-50/50 border-slate-200/80 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-extrabold flex items-center justify-center text-xs">
                        {staff.fullName.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h5 className="text-xs font-bold text-slate-900">{staff.fullName}</h5>
                        <p className="text-[10px] font-mono text-slate-400">@{staff.username}</p>
                      </div>
                    </div>

                    {hasOverdue && (
                      <span className="px-2 py-0.5 rounded text-[9px] font-extrabold bg-rose-100 text-rose-700 border border-rose-200 flex items-center gap-1 animate-pulse">
                        <AlertTriangle className="w-3 h-3" />
                        <span>OVERDUE</span>
                      </span>
                    )}
                  </div>

                  {/* Workload Progress Bar */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] font-bold font-mono">
                      <span className="text-slate-500">Predicted Workload:</span>
                      <span
                        className={
                          isHigh ? 'text-rose-600' : isMed ? 'text-amber-600' : 'text-emerald-600'
                        }
                      >
                        {staff.totalPredictedWorkload.toFixed(1)}m / 20m
                      </span>
                    </div>

                    <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 rounded-full ${
                          isHigh ? 'bg-rose-500' : isMed ? 'bg-amber-500' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${workloadPct}%` }}
                      />
                    </div>
                  </div>

                  {/* Station Breakdown Badges */}
                  <div className="pt-1 flex flex-wrap gap-1.5">
                    {staff.assignedStations.map((stId) => {
                      const breakdown = staff.stationBreakdown[stId];
                      return (
                        <div
                          key={stId}
                          className="px-2 py-1 rounded-lg bg-white border border-slate-200 text-[10px] flex items-center gap-1.5 shadow-2xs font-mono"
                        >
                          <span className="font-bold text-slate-700 uppercase">{stId}</span>
                          <span className="text-slate-400">({breakdown?.avgTime || 5}m avg)</span>
                          <span className="font-bold text-blue-600 ml-1">
                            {breakdown ? `${breakdown.activeCount} orders` : '0'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Station Capacity & Shortest Timelines Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {['prep', 'grill', 'assembly', 'expedite'].map((stId) => {
          const summary = data.stationSummaries[stId] || { waitingCount: 0, activeCount: 0, shortestTimeline: 5 };
          return (
            <div key={stId} className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 uppercase font-mono">{stId} Line</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-100">
                  {summary.activeCount} active
                </span>
              </div>

              <div className="flex items-baseline justify-between pt-1">
                <div>
                  <span className="text-[10px] text-slate-400 block font-medium">Shortest Cook Timeline:</span>
                  <span className="text-base font-extrabold font-mono text-slate-900">{summary.shortestTimeline}m</span>
                </div>

                {summary.waitingCount > 0 && (
                  <div className="text-right">
                    <span className="text-[9px] text-amber-600 font-bold uppercase tracking-wider block">Waiting Pool</span>
                    <span className="text-xs font-mono font-extrabold text-amber-700">{summary.waitingCount} queued</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
