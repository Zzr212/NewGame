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
             if (c <= 0) clearInterval(timer);
         }, 1000);
      }

      if (event === 'game:start') {
          // Trigger White Screen
          setWhiteScreen(true);
          const { roles, spawnPoints } = data;
          setGameRoles(roles);
          setSpawnPoints(spawnPoints);
          
          setTimeout(() => {
              setView('GAME');
              setIsStarting(false);
              // Fade out white screen
              setTimeout(() => setWhiteScreen(false), 2000);
          }, 500); // Short delay to ensure white screen is fully visible
      }

      if (state) setLobbyState(state);
    });
  }, []);

  // Handlers
  const handleAction = async () => {
    if (lobbyCode.trim().length > 0) {
      await handleJoinLobby();
    } else {
      await handleCreateLobby();
    }
  };

  const handleCreateLobby = async () => {
    if (!playerName.trim()) {
      setError("ENTER SUMMONER NAME");
      return;
    }
    setIsLoading(true);
    setError(null);
    localStorage.setItem(LOCAL_STORAGE_NAME_KEY, playerName);

    try {
      const code = await socketService.createLobby(playerName, playerId);
      // Wait for subscription update to trigger UI change, but setting view here ensures responsiveness
      setView('LOBBY');
    } catch (e) {
      setError("Failed to create lobby");
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinLobby = async () => {
    if (!playerName.trim()) {
      setError("ENTER SUMMONER NAME");
      return;
    }
    setIsLoading(true);
    setError(null);
    localStorage.setItem(LOCAL_STORAGE_NAME_KEY, playerName);

    try {
      await socketService.joinLobby(lobbyCode, playerName, playerId);
      setView('LOBBY');
    } catch (e: any) {
      setError(e.message || "Failed to join lobby");
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleReady = () => {
    if (lobbyState) {
      socketService.toggleReady(lobbyState.code, playerId);
    }
  };

  const handleKickPlayer = (targetId: string) => {
    if (lobbyState && lobbyState.players.find(p => p.id === playerId)?.isAdmin) {
      socketService.kickPlayer(lobbyState.code, playerId, targetId);
    }
  };

  const handleLeaveLobby = () => {
    if (lobbyState) {
      socketService.leaveLobby(lobbyState.code, playerId);
      setLobbyState(null);
      setView('HOME');
    }
  };
  
  const handleGameMove = (pos: [number, number, number], rot: [number, number, number]) => {
     if (lobbyState) {
         socketService.sendMove(lobbyState.code, playerId, pos, rot);
     }
  }

  const localPlayer = lobbyState?.players.find(p => p.id === playerId);
  const isAllReady = lobbyState?.players.every(p => p.isReady) && (lobbyState?.players.length ?? 0) > 1;

  // --- Views ---

  // White Screen Transition
  if (whiteScreen) {
      return <div className="fixed inset-0 bg-white z-[100] transition-opacity duration-1000 animate-pulse"></div>;
  }

  // Portrait Lock Overlay (Only for GAME view usually, but good to enforce early)
  if (view === 'GAME' && isPortrait) {
      return (
          <div className="fixed inset-0 bg-black z-[200] flex flex-col items-center justify-center p-8 text-center">
              <div className="text-[#C8AA6E] text-6xl mb-4">↻</div>
              <h2 className="text-[#F0E6D2] text-xl font-bold uppercase tracking-widest">Rotate Your Device</h2>
              <p className="text-[#A09B8C] mt-2">Prop Hunt requires landscape mode.</p>
          </div>
      );
  }

  if (view === 'GAME') {
      return (
          <GameScene 
            lobbyCode={lobbyState?.code || ''}
            players={lobbyState?.players || []}
            localPlayerId={playerId}
            roles={gameRoles}
            spawnPoints={spawnPoints}
            onMove={handleGameMove}
          />
      );
  }

  if (view === 'HOME') {
    return (
      <div className="min-h-screen relative overflow-hidden bg-[url('https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=2670&auto=format&fit=crop')] bg-cover bg-center">
        {/* Overlays for that cinematic feel */}
        <div className="absolute inset-0 bg-[#010a13]/80" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#010a13] via-transparent to-[#010a13]/50" />
        
        {/* Decorative Border Frame */}
        <div className="absolute inset-4 border border-[#C8AA6E]/30 pointer-events-none z-0">
            <div className="absolute top-0 left-0 w-32 h-32 border-t-2 border-l-2 border-[#C8AA6E]" />
            <div className="absolute top-0 right-0 w-32 h-32 border-t-2 border-r-2 border-[#C8AA6E]" />
            <div className="absolute bottom-0 left-0 w-32 h-32 border-b-2 border-l-2 border-[#C8AA6E]" />
            <div className="absolute bottom-0 right-0 w-32 h-32 border-b-2 border-r-2 border-[#C8AA6E]" />
        </div>

        {/* TOP BAR */}
        <div className="relative z-10 p-8 flex justify-between items-start">
            {/* Title Section */}
            <div>
                <h1 className="text-5xl hextech-font text-[#C8AA6E] tracking-widest drop-shadow-[0_0_15px_rgba(200,170,110,0.6)]">
                    PROP HUNT
                </h1>
                <div className="flex items-center gap-2 mt-1">
                    <div className="h-[1px] w-12 bg-[#0AC8B9]" />
                    <span className="text-[#A09B8C] text-xs uppercase tracking-[0.4em]">3D Multiplayer</span>
                </div>
            </div>

            {/* Profile Section */}
            <div className="flex items-center gap-4 bg-[#091428]/80 border border-[#C8AA6E]/30 p-2 pr-6 rounded-l-full backdrop-blur-sm">
                <div className="w-12 h-12 rounded-full border-2 border-[#C8AA6E] bg-[#010a13] flex items-center justify-center shadow-[0_0_10px_#C8AA6E40]">
                    <span className="hextech-font text-[#C8AA6E] text-xl">P</span>
                </div>
                <div className="flex flex-col items-end">
                    <label className="text-[#A09B8C] text-[10px] uppercase tracking-widest mb-1 font-bold">Summoner Name</label>
                    <input
                        className="bg-transparent border-b border-[#C8AA6E]/50 text-right text-[#F0E6D2] focus:outline-none focus:border-[#0AC8B9] transition-colors font-bold uppercase tracking-widest w-40 placeholder-[#4a4a4a]"
                        value={playerName}
                        onChange={(e) => setPlayerName(e.target.value)}
                        placeholder="ENTER NAME"
                        maxLength={12}
                    />
                </div>
            </div>
        </div>

        {/* BOTTOM CENTER ACTION ZONE */}
        <div className="absolute bottom-12 left-0 right-0 flex flex-col items-center z-20 gap-4">
            
            {/* Error Message */}
            {error && (
               <div className="absolute -top-16 text-[#FF4655] bg-[#280909]/90 border border-[#FF4655] px-6 py-2 uppercase tracking-widest text-xs font-bold animate-bounce">
                 {error}
               </div>
            )}

            {/* Lobby Code Input (Floating above button) */}
            <div className="relative group w-80">
                <div className="absolute inset-0 bg-[#091428] transform -skew-x-12 border border-[#785A28]"></div>
                <input
                    value={lobbyCode}
                    onChange={(e) => setLobbyCode(e.target.value.toUpperCase())}
                    placeholder="ENTER LOBBY ID TO JOIN"
                    maxLength={6}
                    className="
                        relative w-full bg-transparent text-center text-[#0AC8B9] py-3 px-8 
                        focus:outline-none placeholder-[#785A28]/50
                        tracking-[0.2em] font-mono text-lg uppercase transition-all
                    "
                />
            </div>

            {/* Main Action Button */}
            <button
                onClick={handleAction}
                disabled={isLoading}
                className={`
                    relative w-64 h-16 group transition-all duration-300
                    ${isLoading ? 'opacity-50 cursor-wait' : 'hover:scale-105'}
                `}
            >
                {/* Button Backgrounds */}
                <div className="absolute inset-0 bg-[#1E2328] border-2 border-[#C8AA6E] shadow-[0_0_20px_rgba(0,0,0,0.5)]"></div>
                <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-t ${lobbyCode ? 'from-[#0AC8B9]/20' : 'from-[#C8AA6E]/20'} to-transparent`}></div>
                
                {/* Button Content */}
                <div className="absolute inset-0 flex items-center justify-center">
                    {/* Decorative Diamonds */}
                    <div className="absolute left-2 w-2 h-2 bg-[#C8AA6E] transform rotate-45"></div>
                    <div className="absolute right-2 w-2 h-2 bg-[#C8AA6E] transform rotate-45"></div>
                    
                    <span className={`
                        hextech-font text-2xl tracking-[0.1em] drop-shadow-md transition-colors duration-300
                        ${lobbyCode ? 'text-[#0AC8B9] group-hover:text-white group-hover:drop-shadow-[0_0_8px_#0AC8B9]' : 'text-[#F0E6D2] group-hover:text-white group-hover:drop-shadow-[0_0_8px_#C8AA6E]'}
                    `}>
                        {isLoading ? 'PROCESSING...' : (lobbyCode ? 'JOIN LOBBY' : 'CREATE LOBBY')}
                    </span>
                </div>
            </button>
            
            <div className="text-[#A09B8C] text-[10px] uppercase tracking-widest mt-2 opacity-50">
               {lobbyCode ? 'Joining Existing Game' : 'Hosting New Game'}
            </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative flex flex-col">
      {/* 3D Background Layer */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-[#010a13]/80 z-10 pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_transparent_0%,_#010a13_100%)] z-10 pointer-events-none" />
        {lobbyState && (
          <GhostScene 
            players={lobbyState.players} 
            localPlayerId={playerId} 
            isStarting={isStarting}
            onKick={handleKickPlayer}
          />
        )}
      </div>

      {/* Countdown Overlay */}
      {isStarting && countdown !== null && (
          <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none">
              <div className="text-9xl hextech-font text-[#0AC8B9] drop-shadow-[0_0_25px_#0AC8B9] animate-ping opacity-80">
                  {countdown}
              </div>
          </div>
      )}

      {/* UI Overlay */}
      <div className={`relative z-20 flex flex-col h-full flex-grow p-4 md:p-8 pointer-events-none transition-opacity duration-500 ${isStarting ? 'opacity-0' : 'opacity-100'}`}>
        
        {/* Header (Pointer events auto to allow interaction with Leave button) */}
        <div className="flex justify-between items-start mb-8 pointer-events-auto">
          <div className="flex flex-col">
            <h2 className="text-3xl hextech-font text-[#F0E6D2]">Lobby</h2>
            <div className="flex items-center gap-3 mt-1">
               <span className="text-[#A09B8C] text-sm uppercase tracking-widest">ID:</span>
               <span className="text-[#0AC8B9] font-mono text-xl tracking-widest select-all cursor-pointer hover:text-white transition-colors">
                 {lobbyState?.code}
               </span>
            </div>
          </div>
          <div className="flex gap-2">
            <HexButton variant="danger" onClick={handleLeaveLobby}>Leave</HexButton>
          </div>
        </div>

        {/* Main Content Area - Empty to reveal 3D scene */}
        <div className="flex-grow"></div>

        {/* Footer Actions (Pointer events auto) */}
        <div className="mt-6 flex justify-center md:justify-end items-center gap-4 pointer-events-auto">
          <div className="hidden md:block text-[#A09B8C] text-xs uppercase tracking-widest mr-4">
             {localPlayer?.isReady ? 'Starting soon...' : 'Are you ready?'}
          </div>
          
          <HexButton 
            onClick={handleToggleReady}
            variant={localPlayer?.isReady ? 'secondary' : 'primary'}
          >
            {localPlayer?.isReady ? 'Not Ready' : 'Ready Up'}
          </HexButton>

          {localPlayer?.isAdmin && (
             <HexButton 
               disabled={!isAllReady} 
               variant="primary"
               onClick={() => {}}
             >
               Wait for Ready
             </HexButton>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;