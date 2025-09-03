'use client';

import { useEffect, useRef, useState } from 'react';
import { wsClient } from '@/lib/websocket-client';
import type { WebSocketEvent } from '@/types';

export function useWebSocket() {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionState, setConnectionState] = useState('CLOSED');

  useEffect(() => {
    const updateConnectionState = () => {
      setIsConnected(wsClient.isConnected);
      setConnectionState(wsClient.connectionState);
    };

    const unsubscribeConnect = wsClient.onConnect(updateConnectionState);
    const unsubscribeDisconnect = wsClient.onDisconnect(updateConnectionState);
    const unsubscribeError = wsClient.onError(updateConnectionState);

    // Initial connection
    wsClient.connect();
    updateConnectionState();

    return () => {
      unsubscribeConnect();
      unsubscribeDisconnect();
      unsubscribeError();
    };
  }, []);

  return {
    isConnected,
    connectionState,
    send: wsClient.send.bind(wsClient),
    subscribe: wsClient.subscribe.bind(wsClient),
  };
}

export function useWebSocketEvent<T = unknown>(
  eventType: string,
  handler: (data: T) => void,
  deps: React.DependencyList = []
) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const unsubscribe = wsClient.subscribe(eventType, (event: WebSocketEvent) => {
      handlerRef.current(event.data as T);
    });

    return unsubscribe;
  }, [eventType, ...deps]);
}
