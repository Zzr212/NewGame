import React, { useState, useEffect, useCallback } from 'react';
import { HexButton, HexCard, HexInput, StatusOrb } from './components/HextechUI';
import { GhostScene } from './components/GhostScene';
import { GameScene } from './components/GameScene';
import { socketService } from './services/socket';
import { LobbyState, Player, Role } from './types';

// Constants
const LOCAL_STORAGE_ID_KEY = 'prophunt_player_id';
const LOCAL_STORAGE_NAME_KEY = 'prophunt_player_name';

const App: React.FC = () => {
  // App State
  const [view, setView] = useState<'HOME' | 'LOBBY' | 'GAME'>('HOME');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Transitions
  const [isStarting, setIsStarting] = useState(false); // Vortex animation
  const [countdown, setCountdown] = useState<number | null>(null);
  const [whiteScreen, setWhiteScreen] = useState(false); // Flash bang effect

  // Game Data
  const [gameRoles, setGameRoles] = useState<Record<string, Role>>({});
  const [spawnPoints, setSpawnPoints] = useState<Record<string, [number, number, number]>>({});

  // Player State
  const [playerName, setPlayerName] = useState('');
  const [playerId, setPlayerId] = useState('');

  // Lobby State
  const [lobbyCode, setLobbyCode] = useState(''); // Input value
  const [lobbyState, setLobbyState] = useState<LobbyState | null>(null);

  // Landscape Check
  const [isPortrait, setIsPortrait] = useState(window.innerHeight > window.innerWidth);

  useEffect(() => {
    const handleResize = () => setIsPortrait(window.innerHeight > window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Initialize Player ID
  useEffect(() => {
    let storedId = localStorage.getItem(LOCAL_STORAGE_ID_KEY);
    if (!storedId) {
      storedId = Math.random().toString(36).substr(2, 9);
      localStorage.setItem(LOCAL_STORAGE_ID_KEY, storedId);
    }
    setPlayerId(storedId);

    const storedName = localStorage.getItem(LOCAL_STORAGE_NAME_KEY);
    if (storedName) setPlayerName(storedName);

    // Socket Subscription
    socketService.subscribe(storedId, (state, event, data) => {
      if (event === 'kicked') {
        setLobbyState(null);
        setView('HOME');
        setError("You have been kicked from the lobby.");
        return;
      }
      
      if (event === 'game:starting') {
         // Start Vortex
         setIsStarting(true);
         setCountdown(data as number); // 5s
         // Countdown timer logic
         let c = data as number;
         const timer = setInterval(() => {
             c--;
             setCountdown(c);
             if (c <= 0) {
                 clearInterval(timer);
                 // Flash Bang
                 setWhiteScreen(true);
                 setTimeout(() => setWhiteScreen(false), 2000);
             }
         }, 1000);
      }

      if (event === 'game:start') {
        const { roles, spawnPoints } = data;
        setGameRoles(roles);
        setSpawnPoints(spawnPoints);
        setTimeout(() => {
            setView('GAME');
            setIsStarting(false);
            setCountdown(null);
        }, 1000); // Wait for flash
      }

      if (state) {
        setLobbyState(state);
      }
    });
  }, []);

  // Handlers
  const handleCreateLobby = async () => {
    if (!playerName) { setError("Enter a name first!"); return; }
    localStorage.setItem(LOCAL_STORAGE_NAME_KEY, playerName);
    setIsLoading(true);
    setError(null);
    try {
      const code = await socketService.createLobby(playerName, playerId);
      setLobbyCode(code);
      setView('LOBBY');
    } catch (err: any) {
      setError(err.message || "Failed to create lobby");
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinLobby = async () => {
    if (!playerName) { setError("Enter a name first!"); return; }
    if (!lobbyCode) { setError("Enter a lobby code!"); return; }
    localStorage.setItem(LOCAL_STORAGE_NAME_KEY, playerName);
    setIsLoading(true);
    setError(null);
    try {
      await socketService.joinLobby(lobbyCode.toUpperCase(), playerName, playerId);
      setView('LOBBY');
    } catch (err: any) {
      setError(err.message || "Failed to join lobby");
    } finally {
      setIsLoading(false);
    }
  };

  const handleReady = () => {
    if (lobbyState) socketService.toggleReady(lobbyState.code, playerId);
  };

  const handleKick = (targetId: string) => {
    if (lobbyState) socketService.kickPlayer(lobbyState.code, playerId, targetId);
  };

  const handleLeaveLobby = () => {
    if (lobbyCode) {
        try {
            socketService.leaveLobby(lobbyCode, playerId);
        } catch (e) {
            console.error("Error leaving lobby socket:", e);
        }
    }
    // Force reset state
    setLobbyState(null);
    setLobbyCode('');
    setView('HOME');
    setError(null);
    setIsStarting(false);
    setCountdown(null);
  };

  // Game Input Handler
  const handleGameMove = useCallback((pos: [number, number, number], rot: [number, number, number]) => {
      if (lobbyState) {
          socketService.sendMove(lobbyState.code, playerId, pos, rot);
      }
  }, [lobbyState, playerId]);

  // Renders
  if (view === 'GAME' && lobbyState) {
      return (
          <>
            <GameScene 
                lobbyCode={lobbyState.code}
                players={lobbyState.players}
                localPlayerId={playerId}
                roles={gameRoles}
                spawnPoints={spawnPoints}
                onMove={handleGameMove}
            />
            {whiteScreen && <div className="absolute inset-0 z-[100] bg-white animate-fadeOut pointer-events-none" />}
            {/* Exit Button in Game */}
            <div className="absolute top-4 right-4 z-[90]">
                <button 
                    onClick={handleLeaveLobby}
                    className="bg-black/50 text-white p-2 rounded border border-white/20 hover:bg-red-900/50"
                >
                    EXIT
                </button>
            </div>
          </>
      );
  }

  return (
    <div className="min-h-screen bg-[#010a13] flex items-center justify-center p-4 relative overflow-hidden">
      
      {/* Background Ambience */}
      <div className="absolute inset-0 bg-[url('https://lolstatic-a.akamaihd.net/frontpage/apps/prod/harbinger-l10-website/en-us/production/windows/bg-dark-blue.jpg')] bg-cover bg-center opacity-30" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#010a13] via-transparent to-[#010a13]" />

      {/* LOBBY VIEW - 3D Background */}
      {view === 'LOBBY' && lobbyState && (
         <GhostScene 
            players={lobbyState.players} 
            localPlayerId={playerId} 
            isStarting={isStarting}
            onKick={handleKick}
         />
      )}

      {/* Flash Bang Overlay */}
      {whiteScreen && <div className="absolute inset-0 z-[100] bg-white pointer-events-none transition-opacity duration-1000" />}

      {/* Main UI Container */}
      <div className="relative z-10 w-full max-w-4xl mx-auto pointer-events-none">
        <div className="pointer-events-auto">
            
            {/* Header */}
            <header className="mb-8 text-center">
              <h1 className="text-5xl md:text-7xl font-bold text-transparent bg-clip-text bg-gradient-to-b from-[#C8AA6E] to-[#785A28] hextech-font drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                PROPHUNT 3D
              </h1>
              <div className="h-px w-32 mx-auto bg-[#0AC8B9] mt-2 shadow-[0_0_10px_#0AC8B9]" />
            </header>

            {/* Error Message */}
            {error && (
              <div className="mb-6 mx-auto max-w-md bg-[#280909]/90 border border-[#FF4655] text-[#FF4655] px-4 py-3 rounded shadow-[0_0_15px_#FF4655]">
                 <strong className="font-bold">SYSTEM ERROR: </strong>
                 <span className="block sm:inline">{error}</span>
              </div>
            )}

            {/* VIEWS */}
            {view === 'HOME' && (
              <HexCard className="max-w-md mx-auto backdrop-blur-sm">
                <div className="space-y-6">
                  <div>
                    <label className="block text-[#C8AA6E] text-xs font-bold uppercase tracking-widest mb-2">Identify Yourself</label>
                    <HexInput 
                      placeholder="ENTER AGENT NAME" 
                      value={playerName}
                      onChange={(e) => setPlayerName(e.target.value)}
                      maxLength={12}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                     <HexButton onClick={handleCreateLobby} disabled={isLoading}>
                        {isLoading ? 'INIT...' : 'CREATE'}
                     </HexButton>
                     <HexButton variant="secondary" onClick={() => { if(!playerName) {setError("Name required"); return;} setView('HOME'); /* Just focus input ideally */ }} disabled>
                        JOIN (BELOW)
                     </HexButton>
                  </div>

                  <div className="relative pt-4">
                      <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-[#785A28]/30"></div></div>
                      <div className="relative flex justify-center"><span className="bg-[#091428] px-2 text-[#785A28] text-xs uppercase">Existing Operation</span></div>
                  </div>

                  <div className="flex gap-2">
                    <HexInput 
                        placeholder="LOBBY CODE" 
                        value={lobbyCode}
                        onChange={(e) => setLobbyCode(e.target.value.toUpperCase())}
                        maxLength={6}
                        className="text-center font-mono text-xl uppercase"
                    />
                    <HexButton onClick={handleJoinLobby} disabled={isLoading || !lobbyCode}>
                       CONNECT
                    </HexButton>
                  </div>
                </div>
              </HexCard>
            )}

            {view === 'LOBBY' && (
                <>
                    {/* Top Bar */}
                    <div className="absolute top-0 left-0 w-full flex justify-between items-start px-4">
                        <div className="text-left">
                            <h2 className="text-3xl text-[#F0E6D2] hextech-font">Lobby</h2>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="text-[#C8AA6E] text-sm uppercase tracking-widest">Operation ID:</span>
                                <span className="text-2xl font-mono text-[#0AC8B9] tracking-wider select-all cursor-pointer hover:text-white transition-colors" onClick={() => navigator.clipboard.writeText(lobbyCode)}>
                                    {lobbyCode || "LOADING..."}
                                </span>
                            </div>
                        </div>
                        <div className="pointer-events-auto">
                            <HexButton variant="danger" onClick={handleLeaveLobby}>LEAVE</HexButton>
                        </div>
                    </div>

                    {/* Bottom Controls */}
                    <div className="absolute bottom-8 left-0 w-full flex justify-center pointer-events-none">
                        <div className="pointer-events-auto">
                           {isStarting ? (
                               <div className="text-6xl font-mono text-[#FF4655] animate-pulse drop-shadow-[0_0_20px_#FF4655]">
                                   {countdown}
                               </div>
                           ) : (
                               <HexButton 
                                  onClick={handleReady} 
                                  variant={lobbyState?.players.find(p => p.id === playerId)?.isReady ? "primary" : "secondary"}
                                >
                                  {lobbyState?.players.find(p => p.id === playerId)?.isReady ? 'READY - WAITING' : 'MARK READY'}
                               </HexButton>
                           )}
                        </div>
                    </div>

                     {/* Mobile Warning */}
                     {isPortrait && (
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center bg-black/80 p-4 rounded text-[#FF4655]">
                            <p className="font-bold">ROTATE DEVICE</p>
                            <p className="text-xs text-white">Landscape required for deployment</p>
                        </div>
                     )}
                </>
            )}

        </div>
      </div>
    </div>
  );
};

export default App;