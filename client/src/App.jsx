import ConnectionBanner from './components/ConnectionBanner.jsx';
import ErrorToast from './components/ErrorToast.jsx';
import GameScreen from './components/GameScreen.jsx';
import HomeScreen from './components/HomeScreen.jsx';
import LobbyScreen from './components/LobbyScreen.jsx';
import { useRoom } from './hooks/useRoom.js';

export default function App() {
  const {
    connected,
    room,
    error,
    busy,
    createRoom,
    joinRoom,
    send,
    leaveRoom,
    clearError,
  } = useRoom();

  return (
    <div className="min-h-dvh bg-emerald-950 text-emerald-50">
      <ConnectionBanner connected={connected} />

      {!room ? (
        <HomeScreen
          connected={connected}
          busy={busy}
          onCreate={createRoom}
          onJoin={joinRoom}
        />
      ) : room.status === 'lobby' ? (
        <LobbyScreen
          room={room}
          onStart={() => send('room:start')}
          onAddBot={() => send('room:addBot')}
          onRemoveBot={(seat) => send('room:removeBot', { seat })}
          onLeave={leaveRoom}
        />
      ) : (
        <GameScreen room={room} send={send} onLeave={leaveRoom} />
      )}

      <ErrorToast message={error} onClose={clearError} />
    </div>
  );
}
