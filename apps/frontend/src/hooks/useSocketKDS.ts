import { useEffect, useState, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import {
  KitchenEvent,
  Order,
  OrderStatus,
  StationId,
  CreateOrderPayload,
  ReplayResponsePayload,
} from '@ticketflow/types';
import { kitchenAudio } from '../utils/audio';
import { User } from '../context/AuthContext';

const SOCKET_URL = (import.meta as any).env?.VITE_BACKEND_URL || 'http://localhost:4000';
const KITCHEN_ID = 'kitchen-main';

export interface StationNetworkMap {
  intake: boolean;
  prep: boolean;
  grill: boolean;
  assembly: boolean;
  expedite: boolean;
}

const SESSION_STORAGE_KEY = 'ticketflow_station_networks';

const DEFAULT_STATION_NETWORKS: StationNetworkMap = {
  intake: true,
  prep: true,
  grill: true,
  assembly: true,
  expedite: true,
};

function getInitialStationNetworks(): StationNetworkMap {
  try {
    const saved = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (saved) {
      return { ...DEFAULT_STATION_NETWORKS, ...JSON.parse(saved) };
    }
  } catch {
    // Fallback if unavailable
  }
  return DEFAULT_STATION_NETWORKS;
}

export function useSocketKDS(activeStationId: StationId | 'overview' | 'manager', user: User | null) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [events, setEvents] = useState<KitchenEvent[]>([]);
  const [lastProcessedSequence, setLastProcessedSequence] = useState<number>(0);
  const [connectionStatus, setConnectionStatus] = useState<'CONNECTING' | 'ONLINE' | 'SYNCING' | 'DISCONNECTED'>(
    'CONNECTING'
  );
  const [stationNetworks, setStationNetworks] = useState<StationNetworkMap>(getInitialStationNetworks);
  const [reconnectedCount, setReconnectedCount] = useState<number>(0);

  const socketRef = useRef<Socket | null>(null);
  const liveBufferRef = useRef<KitchenEvent[]>([]);
  const lastSeqRef = useRef<number>(0);
  const statusRef = useRef<'CONNECTING' | 'ONLINE' | 'SYNCING' | 'DISCONNECTED'>('CONNECTING');
  const stationNetworksRef = useRef<StationNetworkMap>(DEFAULT_STATION_NETWORKS);

  // Sync refs with state
  lastSeqRef.current = lastProcessedSequence;
  statusRef.current = connectionStatus;
  stationNetworksRef.current = stationNetworks;

  // Apply single sequence event to order state projection
  const applyEventToOrders = useCallback((event: KitchenEvent) => {
    setOrders((prevOrders) => {
      const orderMap = new Map<string, Order>(prevOrders.map((o) => [o.id, o]));
      const payload = event.payload;

      if (event.type === 'ORDER_CREATED') {
        const newOrder: Order = {
          id: event.orderId,
          kitchenId: event.kitchenId,
          customerName: payload.customerName || 'Walk-in Customer',
          items: payload.items || [],
          priority: payload.priority || 'NORMAL',
          estimatedPrepTime: payload.estimatedPrepTime || 10,
          status: (payload as any).status || payload.newStatus || 'PLACED',
          currentStationId: payload.stationId || 'intake',
          assignedUserId: payload.assignedUserId || null,
          createdAt: event.timestamp,
          updatedAt: event.timestamp,
        };
        orderMap.set(event.orderId, newOrder);

        // Sound trigger for new order
        if (payload.priority === 'VIP' || payload.priority === 'HIGH') {
          kitchenAudio.playVipTicketSound();
        } else {
          kitchenAudio.playNewTicketSound();
        }
      } else if (event.type === 'ORDER_TRANSITIONED') {
        const existing = orderMap.get(event.orderId);
        const updated: Order = {
          id: event.orderId,
          kitchenId: event.kitchenId,
          customerName: existing ? existing.customerName : (payload.customerName || 'Kitchen Order'),
          items: existing ? existing.items : (payload.items || []),
          priority: existing ? existing.priority : (payload.priority || 'NORMAL'),
          estimatedPrepTime: existing ? existing.estimatedPrepTime : 10,
          createdAt: existing ? existing.createdAt : event.timestamp,
          status: payload.newStatus,
          currentStationId: payload.stationId || (existing ? existing.currentStationId : 'prep'),
          assignedUserId: payload.assignedUserId !== undefined ? payload.assignedUserId : (existing ? existing.assignedUserId : null),
          updatedAt: event.timestamp,
        };
        orderMap.set(event.orderId, updated);

        // Sound trigger for state transition or served
        if (payload.newStatus === 'SERVED') {
          kitchenAudio.playServedSound();
        } else {
          kitchenAudio.playStatusTransitionSound();
        }
      }

      return Array.from(orderMap.values());
    });

    setEvents((prev) => {
      if (prev.some((e) => e.sequenceNumber === event.sequenceNumber)) {
        return prev;
      }
      return [...prev, event].sort((a, b) => a.sequenceNumber - b.sequenceNumber);
    });

    setLastProcessedSequence(event.sequenceNumber);
  }, []);

  // Check if target station network is active
  const isStationOnline = useCallback((stationId?: StationId | string) => {
    if (!stationId || stationId === 'overview' || stationId === 'manager') {
      return Object.values(stationNetworksRef.current).some((v) => v);
    }
    const key = stationId as StationId;
    return stationNetworksRef.current[key] ?? true;
  }, []);

  // Request replay from backend
  const requestReplay = useCallback(() => {
    if (!socketRef.current || !socketRef.current.connected) return;
    setConnectionStatus('SYNCING');
    console.log(`[KDS Engine] Requesting sequence replay from seq ${lastSeqRef.current}...`);
    socketRef.current.emit('order:replayRequest', {
      kitchenId: KITCHEN_ID,
      stationId: activeStationId,
      lastProcessedSequence: lastSeqRef.current,
    });
  }, [activeStationId]);

  // Handle incoming live event
  const handleIncomingEvent = useCallback(
    (event: KitchenEvent) => {
      if (statusRef.current === 'SYNCING') {
        liveBufferRef.current.push(event);
        return;
      }

      if (event.sequenceNumber <= lastSeqRef.current) {
        return;
      }

      if (event.sequenceNumber === lastSeqRef.current + 1) {
        applyEventToOrders(event);
        return;
      }

      if (event.sequenceNumber > lastSeqRef.current + 1) {
        console.warn(
          `[KDS Engine] GAP DETECTED! Expected Seq #${lastSeqRef.current + 1}, Received #${event.sequenceNumber}`
        );
        liveBufferRef.current.push(event);
        requestReplay();
      }
    },
    [activeStationId, isStationOnline, applyEventToOrders, requestReplay]
  );

  // Handle replay response payload
  const handleReplayResponse = useCallback(
    (response: ReplayResponsePayload) => {
      console.log(
        `[KDS Engine] Replay response received. Replaying ${response.events.length} missed events (Seq #${response.fromSequence} -> #${response.toSequence})`
      );

      const sortedReplayed = [...response.events].sort((a, b) => a.sequenceNumber - b.sequenceNumber);
      for (const evt of sortedReplayed) {
        if (evt.sequenceNumber > lastSeqRef.current) {
          applyEventToOrders(evt);
        }
      }

      const sortedBuffer = [...liveBufferRef.current].sort((a, b) => a.sequenceNumber - b.sequenceNumber);
      liveBufferRef.current = [];

      for (const evt of sortedBuffer) {
        if (evt.sequenceNumber > lastSeqRef.current) {
          if (evt.sequenceNumber === lastSeqRef.current + 1) {
            applyEventToOrders(evt);
          } else if (evt.sequenceNumber > lastSeqRef.current + 1) {
            liveBufferRef.current.push(evt);
            requestReplay();
            return;
          }
        }
      }

      setConnectionStatus('ONLINE');
      setReconnectedCount((prev) => prev + 1);
    },
    [applyEventToOrders, requestReplay]
  );

  // Initialize socket connection
  useEffect(() => {
    const socket = io(SOCKET_URL, {
      autoConnect: true,
      reconnectionAttempts: 10,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log(`[Socket] Connected to backend on ${SOCKET_URL}`);
      socket.emit('station:join', { 
        kitchenId: KITCHEN_ID, 
        stationId: activeStationId,
        userId: user?.id,
        userRole: user?.role,
        userAssignedStations: user?.assignedStations,
      });

      if (lastSeqRef.current > 0) {
        requestReplay();
      } else {
        setConnectionStatus('ONLINE');
        socket.emit('order:replayRequest', {
          kitchenId: KITCHEN_ID,
          stationId: activeStationId,
          lastProcessedSequence: 0,
        });
      }
    });

    socket.on('disconnect', () => {
      console.warn('[Socket] Disconnected from server');
      setConnectionStatus('DISCONNECTED');
    });

    socket.on('order:transition', (event: KitchenEvent) => {
      handleIncomingEvent(event);
    });

    socket.on('order:replayResponse', (response: ReplayResponsePayload) => {
      handleReplayResponse(response);
    });

    socket.on('order:reset', () => {
      console.log('[Socket] Database reset notification received. Clearing local dashboard state...');
      setOrders([]);
      setEvents([]);
      setLastProcessedSequence(0);
      lastSeqRef.current = 0;
    });

    return () => {
      socket.disconnect();
    };
  }, [activeStationId, handleIncomingEvent, handleReplayResponse, requestReplay, user]);

  // Methods to interact with server
  const createOrder = useCallback(
    (payload: Omit<CreateOrderPayload, 'kitchenId'>) => {
      if (!socketRef.current || !socketRef.current.connected) return;
      socketRef.current.emit('order:create', {
        ...payload,
        kitchenId: KITCHEN_ID,
        userId: user?.id,
        userRole: user?.role,
      });
    },
    [user]
  );

  const transitionOrder = useCallback(
    (orderId: string, currentStatus: OrderStatus, newStatus: OrderStatus, stationId?: StationId) => {
      // Optimistic local state update
      setOrders((prevOrders) =>
        prevOrders.map((o) => {
          if (o.id === orderId) {
            return {
              ...o,
              status: newStatus,
              currentStationId: stationId || o.currentStationId,
              updatedAt: Date.now(),
            };
          }
          return o;
        })
      );

      if (!socketRef.current || !socketRef.current.connected) return;
      socketRef.current.emit('order:transition', {
        kitchenId: KITCHEN_ID,
        orderId,
        currentStatus,
        newStatus,
        stationId,
        userId: user?.id,
        userRole: user?.role,
      });
    },
    [user]
  );

  // Toggle station network ON/OFF manually
  const toggleStationNetwork = useCallback(
    (stationId: StationId) => {
      setStationNetworks((prev) => {
        const updated = { ...prev, [stationId]: !prev[stationId] };
        try {
          sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(updated));
        } catch {}

        const isTurningOn = updated[stationId];
        if (isTurningOn) {
          console.log(`[Network Simulation] Station '${stationId}' network turned ON. Triggering replay sync...`);
          setTimeout(() => {
            requestReplay();
          }, 100);
        } else {
          console.log(`[Network Simulation] Station '${stationId}' network turned OFFLINE.`);
        }

        return updated;
      });
    },
    [requestReplay]
  );

  // Toggle all stations global network ON/OFF
  const toggleGlobalNetwork = useCallback(
    (online: boolean) => {
      const newNetworks: StationNetworkMap = {
        intake: online,
        prep: online,
        grill: online,
        assembly: online,
        expedite: online,
      };
      try {
        sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(newNetworks));
      } catch {}

      setStationNetworks(newNetworks);

      if (online) {
        setConnectionStatus('SYNCING');
        requestReplay();
      } else {
        setConnectionStatus('DISCONNECTED');
      }
    },
    [requestReplay]
  );

  return {
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
    requestReplay,
  };
}
