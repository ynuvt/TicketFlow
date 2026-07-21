import React, { useState } from 'react';
import { StationRoute, StationId } from '@ticketflow/types';
import { useSocketKDS } from './hooks/useSocketKDS';
import { Header } from './components/Header';
import { StationTabs } from './components/StationTabs';
import { OrderCreatorModal } from './components/OrderCreatorModal';
import { EventAuditLog } from './components/EventAuditLog';
import { StationBoardView } from './views/StationBoardView';
import { OverviewBoardView } from './views/OverviewBoardView';
import { ManagerDashboardView } from './views/ManagerDashboardView';

export default function App() {
  const [activeTab, setActiveTab] = useState<StationRoute>('overview');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [isAuditLogOpen, setIsAuditLogOpen] = useState<boolean>(false);

  const {
    orders,
    events,
    lastProcessedSequence,
    connectionStatus,
    stationNetworks,
    reconnectedCount,
    createOrder,
    transitionOrder,
    toggleStationNetwork,
    toggleGlobalNetwork,
  } = useSocketKDS(activeTab);

  const activeOrders = orders.filter((o) => o.status !== 'SERVED');

  const renderActiveView = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <OverviewBoardView
            orders={orders}
            onTransitionOrder={transitionOrder}
            stationNetworks={stationNetworks}
            onToggleStationNetwork={toggleStationNetwork}
          />
        );
      case 'intake':
      case 'prep':
      case 'grill':
      case 'assembly':
      case 'expedite':
        return (
          <StationBoardView
            stationId={activeTab as StationId}
            orders={orders}
            onTransitionOrder={transitionOrder}
            isStationOnline={stationNetworks[activeTab as StationId]}
            onToggleStationNetwork={toggleStationNetwork}
          />
        );
      case 'manager':
        return (
          <ManagerDashboardView
            orders={orders}
            events={events}
            lastProcessedSequence={lastProcessedSequence}
            connectionStatus={connectionStatus}
            stationNetworks={stationNetworks}
            onToggleStationNetwork={toggleStationNetwork}
            onTransitionOrder={transitionOrder}
            onOpenCreateModal={() => setIsCreateModalOpen(true)}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-slate-950">
      {/* Header Bar */}
      <Header
        connectionStatus={connectionStatus}
        lastProcessedSequence={lastProcessedSequence}
        activeOrdersCount={activeOrders.length}
        reconnectedCount={reconnectedCount}
        activeTab={activeTab}
        onOpenCreateModal={() => setIsCreateModalOpen(true)}
        onToggleGlobalNetwork={toggleGlobalNetwork}
        onOpenAuditLog={() => setIsAuditLogOpen(true)}
      />

      {/* Station Tabs Navigation & Per-Station Network Switches */}
      <StationTabs
        activeTab={activeTab}
        onSelectTab={(tab) => setActiveTab(tab)}
        stationNetworks={stationNetworks}
        onToggleStationNetwork={toggleStationNetwork}
      />

      {/* Main View Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6">
        {renderActiveView()}
      </main>

      {/* Modals & Slide-over Drawers */}
      <OrderCreatorModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreateOrder={createOrder}
      />

      <EventAuditLog
        isOpen={isAuditLogOpen}
        onClose={() => setIsAuditLogOpen(false)}
        events={events}
        lastProcessedSequence={lastProcessedSequence}
      />
    </div>
  );
}
