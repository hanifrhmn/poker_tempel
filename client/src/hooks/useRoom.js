import { useCallback, useEffect, useRef, useState } from 'react';
import { emitAck, socket } from '../lib/socket.js';
import {
  clearIdentity,
  loadIdentity,
  saveIdentity,
  setRoomInUrl,
} from '../lib/storage.js';

export function useRoom() {
  const [connected, setConnected] = useState(socket.connected);
  const [room, setRoom] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const identityRef = useRef(loadIdentity());
  const rejoinAttempted = useRef(false);

  useEffect(() => {
    const rejoin = async () => {
      const identity = identityRef.current;
      if (!identity?.code || !identity?.playerId) return;

      const result = await emitAck('room:join', {
        code: identity.code,
        playerId: identity.playerId,
      });

      if (!result.ok) {
        identityRef.current = null;
        clearIdentity();
        setRoom(null);
        return;
      }

      identityRef.current = {
        code: result.code,
        playerId: result.playerId,
        name: identity.name,
      };
      saveIdentity(identityRef.current);
      setRoom(result.state);
    };

    const onConnect = () => {
      setConnected(true);
      rejoin();
    };
    const onDisconnect = () => setConnected(false);
    const onState = (state) => setRoom(state);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('room:state', onState);

    if (socket.connected && !rejoinAttempted.current) {
      rejoinAttempted.current = true;
      rejoin();
    }

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('room:state', onState);
    };
  }, []);

  const persist = useCallback((result, name) => {
    const identity = { code: result.code, playerId: result.playerId, name };
    identityRef.current = identity;
    saveIdentity(identity);
    setRoomInUrl(result.code);
    setRoom(result.state);
  }, []);

  const createRoom = useCallback(
    async (name) => {
      setBusy(true);
      const result = await emitAck('room:create', { name });
      setBusy(false);
      if (!result.ok) {
        setError(result.error);
        return false;
      }
      persist(result, name);
      return true;
    },
    [persist],
  );

  const joinRoom = useCallback(
    async (code, name) => {
      setBusy(true);
      const result = await emitAck('room:join', { code, name });
      setBusy(false);
      if (!result.ok) {
        setError(result.error);
        return false;
      }
      persist(result, name);
      return true;
    },
    [persist],
  );

  const send = useCallback(async (event, payload = {}) => {
    const result = await emitAck(event, payload);
    if (!result?.ok) setError(result?.error ?? 'Request failed');
    return result;
  }, []);

  const leaveRoom = useCallback(async () => {
    if (socket.connected) await emitAck('room:leave');
    identityRef.current = null;
    clearIdentity();
    setRoomInUrl(null);
    setRoom(null);
  }, []);

  const clearError = useCallback(() => setError(''), []);

  return {
    connected,
    room,
    error,
    busy,
    createRoom,
    joinRoom,
    send,
    leaveRoom,
    clearError,
  };
}
