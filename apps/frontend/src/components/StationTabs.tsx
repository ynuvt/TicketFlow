import React from 'react';
import { StationRoute, StationId } from '@ticketflow/types';
import { STATIONS } from '../types/kds';
import { StationNetworkMap } from '../hooks/useSocketKDS';
import { LayoutGrid, Flame, UtensilsCrossed, PackageCheck, ConciergeBell, ClipboardList, ShieldAlert, Wifi, WifiOff } from 'lucide-react';

interface StationTabsProps {
  activeTab: StationRoute;
  onSelectTab: (route: StationRoute) => void;
  stationNetworks: StationNetworkMap;
  onToggleStationNetwork: (stationId: StationId) => void;
}

export const StationTabs: React.FC<StationTabsProps> = ({
  activeTab,
  onSelectTab,
  stationNetworks,
  onToggleStationNetwork,
}) => {
  const getStationIcon = (id: StationRoute) => {
    switch (id) {
      case 'overview':
        return <LayoutGrid className="w-4 h-4" />;
      case 'intake':
        return <ClipboardList className="w-4 h-4" />;
      case 'prep':
        return <UtensilsCrossed className="w-4 h-4" />;
      case 'grill':
        return <Flame className="w-4 h-4" />;
      case 'assembly':
        return <PackageCheck className="w-4 h-4" />;
      case 'expedite':
        return <ConciergeBell className="w-4 h-4" />;
      case 'manager':
        return <ShieldAlert className="w-4 h-4" />;
      default:
        return <LayoutGrid className="w-4 h-4" />;
    }
  };

  const stationList: { route: StationRoute; label: string; stationId?: StationId }[] = [
    { route: 'overview', label: 'All Stations' },
    { route: 'intake', label: 'Intake', stationId: 'intake' },
    { route: 'prep', label: 'Prep Line', stationId: 'prep' },
    { route: 'grill', label: 'Grill & Cook', stationId: 'grill' },
    { route: 'assembly', label: 'Assembly', stationId: 'assembly' },
    { route: 'expedite', label: 'Expedite', stationId: 'expedite' },
    { route: 'manager', label: 'Manager Dashboard' },
  ];

  return (
    <div className="bg-slate-900 border-b border-slate-800 px-4 py-2.5">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 overflow-x-auto no-scrollbar">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 min-w-max">
          {stationList.map((item) => {
            const isActive = activeTab === item.route;
            const isStation = item.stationId !== undefined;
            const isOnline = isStation ? stationNetworks[item.stationId!] : true;

            return (
              <div
                key={item.route}
                className={`group flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20 font-bold'
                    : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/60'
                }`}
                onClick={() => onSelectTab(item.route)}
              >
                <div className="flex items-center gap-1.5">
                  {getStationIcon(item.route)}
                  <span>{item.label}</span>
                </div>

                {/* Per-Station Network ON/OFF Toggle Switch inside tab */}
                {isStation && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleStationNetwork(item.stationId!);
                    }}
                    className={`ml-1 px-1.5 py-0.5 rounded flex items-center gap-1 text-[10px] font-mono transition-colors ${
                      isOnline
                        ? isActive
                          ? 'bg-slate-950/30 text-slate-950 hover:bg-slate-950/50'
                          : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30'
                        : isActive
                        ? 'bg-rose-950/60 text-rose-200 hover:bg-rose-950'
                        : 'bg-rose-500/20 text-rose-400 border border-rose-500/30 hover:bg-rose-500/30 animate-pulse'
                    }`}
                    title={`Toggle station network ${isOnline ? 'OFF' : 'ON'}`}
                  >
                    {isOnline ? (
                      <>
                        <Wifi className="w-3 h-3 text-emerald-400" />
                        <span>ON</span>
                      </>
                    ) : (
                      <>
                        <WifiOff className="w-3 h-3 text-rose-400" />
                        <span>OFF</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Global Network Simulation Summary Badge */}
        <div className="hidden lg:flex items-center gap-2 text-xs font-mono text-slate-400 min-w-max">
          <span className="text-slate-500">Station Links:</span>
          {Object.entries(stationNetworks).map(([stId, online]) => (
            <span
              key={stId}
              onClick={() => onToggleStationNetwork(stId as StationId)}
              className={`px-2 py-0.5 rounded cursor-pointer text-[10px] uppercase font-bold border transition-colors ${
                online
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
                  : 'bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500/20 animate-pulse'
              }`}
              title={`Click to toggle ${stId} network`}
            >
              {stId}: {online ? 'ON' : 'OFF'}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};
