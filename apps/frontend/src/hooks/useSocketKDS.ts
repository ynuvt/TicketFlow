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
import { printKot } from '../utils/kot';

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
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const [printKotEnabled, setPrintKotEnabled] = useState<boolean>(false);

  const socketRef = useRef<Socket | null>(null);
  const liveBufferRef = useRef<KitchenEvent[]>([]);
  const lastSeqRef = useRef<number>(0);
  const statusRef = useRef<'CONNECTING' | 'ONLINE' | 'SYNCING' | 'DISCONNECTED'>('CONNECTING');
  const stationNetworksRef = useRef<StationNetworkMap>(DEFAULT_STATION_NETWORKS);
  const printKotEnabledRef = useRef<boolean>(false);

  // Sync refs with state (but NEVER overwrite lastSeqRef — it is managed synchronously)
  statusRef.current = connectionStatus;
  stationNetworksRef.current = stationNetworks;
  printKotEnabledRef.current = printKotEnabled;

  const activeStationIdRef = useRef(activeStationId);
  activeStationIdRef.current = activeStationId;

  const handleIncomingEventRef = useRef<any>(null);
  const handleReplayResponseRef = useRef<any>(null);

  // Apply single sequence event to order state projection
  const applyEventToOrders = useCallback((event: KitchenEvent) => {
    setOrders((prevOrders) => {
      const orderMap = new Map<string, Order>(prevOrders.map((o) => [o.id, o]));
      const payload = event.payload
        ? (typeof event.payload === 'string' ? JSON.parse(event.payload) : event.payload)
        : {};

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
        // if (payload.priority === 'VIP' || payload.priority === 'HIGH') {
        //   kitchenAudio.playVipTicketSound();
        // } else {
        //   kitchenAudio.playNewTicketSound();
        // }
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
        // if (payload.newStatus === 'SERVED') {
        //   kitchenAudio.playServedSound();
        // } else {
        //   kitchenAudio.playStatusTransitionSound();
        // }
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

  // Request replay from backend — uses refs only, so the identity is stable across re-renders
  const requestReplay = useCallback((forceFullReplay?: boolean) => {
    if (!socketRef.current || !socketRef.current.connected) return;

    if (forceFullReplay) {
      console.log(`[KDS Engine] Forcing full sequence replay from 0...`);
      lastSeqRef.current = 0;
      setLastProcessedSequence(0);
      setOrders([]);
      setEvents([]);
      setConnectionStatus('SYNCING');
      socketRef.current.emit('order:replayRequest', {
        kitchenId: KITCHEN_ID,
        stationId: activeStationIdRef.current,
        lastProcessedSequence: 0,
      });
      return;
    }

    setConnectionStatus('SYNCING');
    console.log(`[KDS Engine] Requesting sequence replay from seq ${lastSeqRef.current}...`);
    socketRef.current.emit('order:replayRequest', {
      kitchenId: KITCHEN_ID,
      stationId: activeStationIdRef.current,
      lastProcessedSequence: lastSeqRef.current,
    });
  }, []);

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
        lastSeqRef.current = event.sequenceNumber;
        setLastProcessedSequence(event.sequenceNumber);
        
        // Auto print KOT on new live order creation if enabled on Intake Dashboard
        if (
          event.type === 'ORDER_CREATED' &&
          activeStationIdRef.current === 'intake' &&
          printKotEnabledRef.current
        ) {
          const payload = event.payload
            ? (typeof event.payload === 'string' ? JSON.parse(event.payload) : event.payload)
            : {};
          const newOrder: Order = {
            id: event.orderId,
            kitchenId: event.kitchenId,
            customerName: payload.customerName || 'Walk-in Customer',
            items: payload.items || [],
            priority: payload.priority || 'NORMAL',
            estimatedPrepTime: payload.estimatedPrepTime || 10,
            status: 'PLACED',
            currentStationId: payload.stationId || 'intake',
            assignedUserId: payload.assignedUserId || null,
            createdAt: event.timestamp,
            updatedAt: event.timestamp,
          };
          printKot(newOrder);
        }
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
    [applyEventToOrders, requestReplay]
  );

  // Handle replay response payload
  const handleReplayResponse = useCallback(
    (response: ReplayResponsePayload) => {
      console.log(
        `[KDS Engine] Replay response received. Replaying ${response.events.length} missed events (Seq #${response.fromSequence} -> #${response.toSequence})`
      );

      // Self-healing: if the server sequence number is less than client state, the DB was cleared/restored.
      // Clear local state and request a full fresh replay.
      if (response.toSequence < lastSeqRef.current) {
        console.warn(
          `[KDS Engine] Server sequence mismatch! Client has Seq #${lastSeqRef.current}, Server has Seq #${response.toSequence}. Resetting state and requesting full replay...`
        );
        setOrders([]);
        setEvents([]);
        lastSeqRef.current = 0;
        setLastProcessedSequence(0);
        requestReplay(true);
        return;
      }

      let currentSeq = lastSeqRef.current;

      const sortedReplayed = [...response.events].sort((a, b) => a.sequenceNumber - b.sequenceNumber);
      for (const evt of sortedReplayed) {
        if (evt.sequenceNumber > currentSeq) {
          applyEventToOrders(evt);
          currentSeq = evt.sequenceNumber;
        }
      }

      const sortedBuffer = [...liveBufferRef.current].sort((a, b) => a.sequenceNumber - b.sequenceNumber);
      liveBufferRef.current = [];

      for (const evt of sortedBuffer) {
        if (evt.sequenceNumber > currentSeq) {
          if (evt.sequenceNumber === currentSeq + 1) {
            applyEventToOrders(evt);
            currentSeq = evt.sequenceNumber;
          } else if (evt.sequenceNumber > currentSeq + 1) {
            liveBufferRef.current.push(evt);
            requestReplay();
            lastSeqRef.current = currentSeq;
            setLastProcessedSequence(currentSeq);
            return;
          }
        }
      }

      lastSeqRef.current = currentSeq;
      setLastProcessedSequence(currentSeq);
      setConnectionStatus('ONLINE');
      setReconnectedCount((prev) => prev + 1);
    },
    [applyEventToOrders, requestReplay]
  );

  // Fetch print settings on mount
  useEffect(() => {
    fetch(`${SOCKET_URL}/api/settings`)
      .then((res) => res.json())
      .then((data) => {
        if (data.printKotEnabled !== undefined) {
          setPrintKotEnabled(data.printKotEnabled);
        }
      })
      .catch((err) => console.error('[Socket] Failed to fetch settings:', err));
  }, []);

  handleIncomingEventRef.current = handleIncomingEvent;
  handleReplayResponseRef.current = handleReplayResponse;

  // Listen for tab focus/visibility changes to sync KDS state instantly
  useEffect(() => {
    const handleSyncOnFocus = () => {
      if (document.visibilityState === 'visible') {
        console.log('[KDS Engine] Tab/Window focused. Checking socket state...');
        if (socketRef.current) {
          if (!socketRef.current.connected) {
            console.log('[KDS Engine] Socket disconnected. Reconnecting immediately...');
            socketRef.current.connect();
          } else {
            console.log('[KDS Engine] Socket online. Fetching missed events...');
            requestReplay();
          }
        }
      }
    };

    document.addEventListener('visibilitychange', handleSyncOnFocus);
    window.addEventListener('focus', handleSyncOnFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleSyncOnFocus);
      window.removeEventListener('focus', handleSyncOnFocus);
    };
  }, [requestReplay]);

  // Initialize socket connection
  useEffect(() => {
    const isStationOnline = stationNetworksRef.current[activeStationIdRef.current as StationId] !== false;
    const socket = io(SOCKET_URL, {
      autoConnect: isStationOnline,
      reconnectionAttempts: 10,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log(`[Socket] Connected to backend on ${SOCKET_URL}`);
      
      const isOnline = stationNetworksRef.current[activeStationIdRef.current as StationId] !== false;
      if (!isOnline) {
        console.log(`[KDS Engine] Socket connected, but station '${activeStationIdRef.current}' is simulated offline. Disconnecting socket.`);
        socket.disconnect();
        return;
      }

      socket.emit('station:join', { 
        kitchenId: KITCHEN_ID, 
        stationId: activeStationIdRef.current,
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
          stationId: activeStationIdRef.current,
          lastProcessedSequence: 0,
        });
      }
    });

    socket.on('disconnect', () => {
      console.warn('[Socket] Disconnected from server');
      setConnectionStatus('DISCONNECTED');
    });

    socket.on('order:transition', (event: KitchenEvent) => {
      handleIncomingEventRef.current(event);
    });

    socket.on('settings:update', (data: { printKotEnabled: boolean }) => {
      setPrintKotEnabled(data.printKotEnabled);
      console.log('[KDS Engine] printKotEnabled updated via socket:', data.printKotEnabled);
    });

    socket.on('order:replayResponse', (response: ReplayResponsePayload) => {
      handleReplayResponseRef.current(response);
    });

    socket.on('order:reset', () => {
      console.log('[Socket] Database reset notification received. Clearing local dashboard state...');
      setOrders([]);
      setEvents([]);
      setLastProcessedSequence(0);
      lastSeqRef.current = 0;
    });

    socket.on('order:delete', (data: { orderId: string }) => {
      console.log(`[Socket] Order ${data.orderId} deleted notification received.`);
      setOrders((prev) => prev.filter((o) => o.id !== data.orderId));
    });

    socket.on('order:update', (updatedOrder: Order) => {
      console.log('[Socket] Order update received:', updatedOrder);
      setOrders((prev) => prev.map((o) => (o.id === updatedOrder.id ? updatedOrder : o)));
    });

    socket.on('user:connection_change', (data: { userId: string; online: boolean }) => {
      setOnlineUserIds((prev) => {
        const next = new Set(prev);
        if (data.online) {
          next.add(data.userId);
        } else {
          next.delete(data.userId);
        }
        return next;
      });
    });

    socket.on('station:networks', (networks: StationNetworkMap) => {
      console.log('[Socket] Initial station networks received:', networks);
      setStationNetworks(networks);
    });

    socket.on('station:network_change', (data: { stationId: StationId; online: boolean }) => {
      console.log(`[Socket] Station network changed: ${data.stationId} -> ${data.online ? 'ONLINE' : 'OFFLINE'}`);
      setStationNetworks((prev) => ({
        ...prev,
        [data.stationId]: data.online,
      }));
    });

    // Initial fetch of online users
    fetch(`${SOCKET_URL}/api/users/online`)
      .then((res) => res.json())
      .then((data) => {
        if (data.onlineUserIds) {
          setOnlineUserIds(new Set(data.onlineUserIds));
        }
      })
      .catch((err) => console.error('[Socket] Failed to fetch online users list:', err));

    return () => {
      console.log('[KDS Engine] Disconnecting persistent socket...');
      socket.disconnect();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Join the active station whenever activeStationId changes (without disconnecting socket!)
  useEffect(() => {
    const socket = socketRef.current;
    if (socket && socket.connected) {
      console.log(`[KDS Engine] Station switched to '${activeStationId}'. Emitting station:join...`);
      socket.emit('station:join', { 
        kitchenId: KITCHEN_ID, 
        stationId: activeStationId,
        userId: user?.id,
        userRole: user?.role,
        userAssignedStations: user?.assignedStations,
      });
      // Sync events for the new station
      requestReplay();
    }
  }, [activeStationId, user, requestReplay]);

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

  const deleteOrder = useCallback(
    (orderId: string) => {
      if (!socketRef.current || !socketRef.current.connected) return;
      socketRef.current.emit('order:delete', {
        orderId,
        kitchenId: KITCHEN_ID,
        userId: user?.id,
        userRole: user?.role,
      });
    },
    [user]
  );

  const updateOrder = useCallback(
    (orderId: string, payload: Omit<CreateOrderPayload, 'kitchenId'>) => {
      if (!socketRef.current || !socketRef.current.connected) return;
      socketRef.current.emit('order:update', {
        orderId,
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
      const isCurrentlyOnline = stationNetworksRef.current[stationId] !== false;
      const nextOnlineState = !isCurrentlyOnline;

      console.log(`[Network Simulation] Toggling station '${stationId}' network to: ${nextOnlineState ? 'ONLINE' : 'OFFLINE'}`);

      // Emit to server so all clients sync
      if (socketRef.current && socketRef.current.connected) {
        socketRef.current.emit('station:network_toggle', { stationId, online: nextOnlineState });
      }

      if (nextOnlineState) {
        if (activeStationIdRef.current === stationId) {
          socketRef.current?.connect();
          socketRef.current?.once('connect', () => {
            socketRef.current?.emit('station:network_toggle', { stationId, online: true });
          });
        }
        setTimeout(() => {
          requestReplay();
        }, 100);
      } else {
        if (activeStationIdRef.current === stationId) {
          socketRef.current?.emit('station:drop', {
            stationId,
            userId: user?.id,
          });
          socketRef.current?.disconnect();
        }
      }

      setStationNetworks((prev) => {
        const updated = { ...prev, [stationId]: nextOnlineState };
        try {
          sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(updated));
        } catch {}
        return updated;
      });
    },
    [requestReplay, user]
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

      if (socketRef.current && socketRef.current.connected) {
        Object.keys(newNetworks).forEach((stationId) => {
          socketRef.current?.emit('station:network_toggle', { stationId, online });
        });
      }

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

  const togglePrintKot = useCallback(async () => {
    const newValue = !printKotEnabled;
    setPrintKotEnabled(newValue);
    try {
      await fetch(`${SOCKET_URL}/api/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ printKotEnabled: newValue }),
      });
    } catch (err) {
      console.error('[Socket] Failed to update settings:', err);
      // Revert if error
      setPrintKotEnabled(!newValue);
    }
  }, [printKotEnabled]);

  return {
    orders,
    events,
    lastProcessedSequence,
    connectionStatus,
    stationNetworks,
    onlineUserIds,
    reconnectedCount,
    printKotEnabled,
    togglePrintKot,
    createOrder,
    deleteOrder,
    updateOrder,
    transitionOrder,
    toggleStationNetwork,
    toggleGlobalNetwork,
    requestReplay,
  };
}
