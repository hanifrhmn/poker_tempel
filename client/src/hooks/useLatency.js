import { useEffect, useState } from 'react';
import { socket } from '../lib/socket.js';

export function useLatency() {
  const [connected, setConnected] = useState(socket.connected);
  const [latency, setLatency] = useState(null);

  useEffect(() => {
    const onConnect = () => setConnected(true);
    const onDisconnect = () => {
      setConnected(false);
      setLatency(null);
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, []);

  useEffect(() => {
    if (!connected) return;

    let cancelled = false;

    const ping = () => {
      if (!socket.connected) return;
      const sentAt = performance.now();
      socket.timeout(3000).emit('client:ping', sentAt, (error) => {
        if (cancelled || error) return;
        setLatency(Math.round(performance.now() - sentAt));
      });
    };

    ping();
    const interval = setInterval(ping, 5000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [connected]);

  return { connected, latency };
}
