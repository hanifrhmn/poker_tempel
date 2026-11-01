import { useEffect, useRef, useState } from 'react';
import { socket } from '../lib/socket.js';
import { playSound } from '../lib/audio.js';
import { classifyGameEvent, nextLastPlayAt } from '../lib/effectRules.js';

export function useGameEffects({ room, mySeat }) {
  const [effect, setEffect] = useState(null);
  const lastPlayAtRef = useRef(null);
  const clearTimerRef = useRef(null);
  const previousTurnRef = useRef(null);

  useEffect(() => {
    const onEvent = (payload) => {
      const event = payload?.event;
      if (!event) return;

      const classified = classifyGameEvent(event, lastPlayAtRef.current);
      lastPlayAtRef.current = nextLastPlayAt(event, lastPlayAtRef.current);
      if (!classified) return;

      if (classified.sound) playSound(classified.sound);

      if (
        [
          'bomb',
          'slam',
          'finish',
          'win',
          'tempelanAccepted',
          'tempelanRejected',
          'selfBomb',
          'bombBattle',
        ].includes(classified.kind)
      ) {
        setEffect({
          kind: classified.kind,
          id: `${event.type}-${event.at}-${Math.random()}`,
          event,
          delta: classified.delta,
        });

        if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
        const holdMs =
          classified.kind === 'bomb'
            ? 1400
            : classified.kind === 'selfBomb' || classified.kind === 'bombBattle'
              ? 2200
              : classified.kind === 'tempelanAccepted' ||
                  classified.kind === 'tempelanRejected'
                ? 1600
                : 1100;
        clearTimerRef.current = setTimeout(() => setEffect(null), holdMs);
      }
    };

    socket.on('game:event', onEvent);

    return () => {
      socket.off('game:event', onEvent);
      if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!room) return;

    if (
      room.status === 'playing' &&
      room.turn === mySeat &&
      previousTurnRef.current !== null &&
      previousTurnRef.current !== mySeat
    ) {
      playSound('turn');
    }
    previousTurnRef.current = room.turn;
  }, [room, mySeat]);

  useEffect(() => {
    lastPlayAtRef.current = null;
  }, [room?.round]);

  return effect;
}
