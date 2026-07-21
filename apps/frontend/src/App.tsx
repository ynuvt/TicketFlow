import React, { useState } from 'react';
import { StationId, StationRoute } from '@ticketflow/types';
import { useRouter } from './hooks/useRouter';
import { useSocketKDS } from './hooks/useSocketKDS';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { OrderCreatorModal } from './components/OrderCreatorModal';
import { EventAuditLog } from './components/EventAuditLog';

import { DashboardView } from './views/DashboardView';
import { OverviewBoardView } from './views/OverviewBoardView';
import { StationBoardView } from './views/StationBoardView';
import { OrdersView } from './views/OrdersView';
import { ReportsView } from './views/ReportsView';
import { AlertsView } from './views/AlertsView';
import { SettingsView } from './views/SettingsView';

export default function App() {
  const { currentPath, navigate } = useRouter();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [isAuditLogOpen, setIsAuditLogOpen] = useState<boolean>(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);

  // Derive station route from path for socket engine
  const getStationIdFromPath = (path: string): StationId | 'overview' | 'manager' => {
    switch (path) {
      case '/intake':
        return 'intake';
      case '/prep':
        return 'prep';
      case '/grill':
        return 'grill';
      case '/assembly':
        return 'assembly';
      case '/expedite':
        return 'expedite';
      case '/all-stations':
        return 'overview';
      default:
        return 'manager';
    }
  };

  const activeStation = getStationIdFromPath(currentPath);

  const {
    orders,
    events,
    lastProcessedSequence,
    connectionStatus,
    stationNetworks,
    createOrder,
    transitionOrder,
    toggleStationNetwork,
    toggleGlobalNetwork,
    requestReplay,
  } = useSocketKDS(activeStation);

  const isOnline = connectionStatus === 'ONLINE';

  // Get Page Title & Subtitle based on route
  const getHeaderMeta = () => {
    switch (currentPath) {
      case '/':
      case '/dashboard':
        return {
          title: 'Dashboard',
          subtitle: 'Real-time overview of kitchen operations',
        };
      case '/all-stations':
        return {
          title: 'All Stations Matrix',
          subtitle: 'Simultaneous overview of all 5 kitchen work lines',
        };
      case '/intake':
        return {
          title: 'Order Intake Board',
          subtitle: 'New orders placed from POS and manager dashboard',
        };
      case '/prep':
        return {
          title: 'Prep Line Display Board',
          subtitle: 'Food preparation, vegetable chopping, and sauce mixing queue',
        };
      case '/grill':
        return {
          title: 'Grill & Cooking Display Board',
          subtitle: 'Hot cooking line, searing, frying, and oven roasting queue',
        };
      case '/assembly':
        return {
          title: 'Plate & Assembly Board',
          subtitle: 'Plating, garnishing, packaging, and tray loading queue',
        };
      case '/expedite':
        return {
          title: 'Expedite & Pass Display Board',
          subtitle: 'Final order inspection and customer server pickup queue',
        };
      case '/orders':
        return {
          title: 'Master Orders List',
          subtitle: 'Complete kitchen order history and active state tracking',
        };
      case '/reports':
        return {
          title: 'Kitchen Reports & Analytics',
          subtitle: 'Throughput metrics, prep times, and station performance',
        };
      case '/alerts':
        return {
          title: 'System Alerts & Log',
          subtitle: 'Monotonic sequence audit stream and reconnect logs',
        };
      case '/settings':
        return {
          title: 'System Settings',
          subtitle: 'KDS options, WebSocket parameters, and monorepo settings',
        };
      default:
        return {
          title: 'Dashboard',
          subtitle: 'Real-time overview of kitchen operations',
        };
    }
  };

  const headerMeta = getHeaderMeta();

  const renderCurrentView = () => {
    switch (currentPath) {
      case '/':
      case '/dashboard':
        return (
          <DashboardView
            orders={orders}
            events={events}
            lastProcessedSequence={lastProcessedSequence}
            connectionStatus={connectionStatus}
            stationNetworks={stationNetworks}
            onToggleStationNetwork={toggleStationNetwork}
            onToggleGlobalNetwork={toggleGlobalNetwork}
            onTransitionOrder={transitionOrder}
            onOpenCreateModal={() => setIsCreateModalOpen(true)}
            onNavigate={navigate}
          />
        );

      case '/all-stations':
        return (
          <OverviewBoardView
            orders={orders}
            onTransitionOrder={transitionOrder}
            stationNetworks={stationNetworks}
            onToggleStationNetwork={toggleStationNetwork}
          />
        );

      case '/intake':
      case '/prep':
      case '/grill':
      case '/assembly':
      case '/expedite':
        const stId = currentPath.replace('/', '') as StationId;
        return (
          <StationBoardView
            stationId={stId}
            orders={orders}
            onTransitionOrder={transitionOrder}
            isStationOnline={stationNetworks[stId]}
            onToggleStationNetwork={toggleStationNetwork}
          />
        );

      case '/orders':
        return <OrdersView orders={orders} onTransitionOrder={transitionOrder} />;

      case '/reports':
        return <ReportsView orders={orders} />;

      case '/alerts':
        return <AlertsView events={events} lastProcessedSequence={lastProcessedSequence} />;

      case '/settings':
        return <SettingsView />;

      default:
        return (
          <DashboardView
            orders={orders}
            events={events}
            lastProcessedSequence={lastProcessedSequence}
            connectionStatus={connectionStatus}
            stationNetworks={stationNetworks}
            onToggleStationNetwork={toggleStationNetwork}
            onToggleGlobalNetwork={toggleGlobalNetwork}
            onTransitionOrder={transitionOrder}
            onOpenCreateModal={() => setIsCreateModalOpen(true)}
            onNavigate={navigate}
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex font-sans selection:bg-blue-600 selection:text-white">
      {/* Sidebar Navigation (Desktop & Mobile Drawer) */}
      <Sidebar
        currentPath={currentPath}
        onNavigate={navigate}
        isSystemOnline={isOnline}
        isOpenMobile={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
      />

      {/* Main App Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header Bar */}
        <Header
          title={headerMeta.title}
          subtitle={headerMeta.subtitle}
          isOnline={isOnline}
          onRefresh={requestReplay}
          onOpenAuditLog={() => setIsAuditLogOpen(true)}
          onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
        />

        {/* Dynamic Route View */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">{renderCurrentView()}</main>
      </div>

      {/* Create Order Modal */}
      <OrderCreatorModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreateOrder={createOrder}
      />

      {/* Real-time Event Audit Log Drawer */}
      <EventAuditLog
        isOpen={isAuditLogOpen}
        onClose={() => setIsAuditLogOpen(false)}
        events={events}
        lastProcessedSequence={lastProcessedSequence}
      />
    </div>
  );
}
