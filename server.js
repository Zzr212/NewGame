import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Environment setup
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PORT = process.env.PORT || 3000;

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*", 
    methods: ["GET", "POST"]
  }
});

app.use(express.static(join(__dirname, 'dist')));

app.get('*', (req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});

// --- GAME STATE ---
const lobbies = new Map();

const generateCode = () => Math.random().toString(36).substring(2, 8).toUpperCase();
const getRandomColor = () => {
  const colors = ['#C8AA6E', '#0AC8B9', '#FF4655', '#A09B8C', '#E6E6E6', '#FF9900'];
  return colors[Math.floor(Math.random() * colors.length)];
};

// Simple spawn points generator (safe zones)
const getSpawnPoint = (index) => {
  const angle = (index * 45) * (Math.PI / 180);
  const radius = 5 + Math.random() * 5;
  return [Math.cos(angle) * radius, 5, Math.sin(angle) * radius]; // x, y, z
};

// --- SOCKET LOGIC ---
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Create Lobby
  socket.on('lobby:create', ({ hostName, hostId }, callback) => {
    const code = generateCode();
    
    const newLobby = {
      code,
      status: 'LOBBY',
      players: [{
        id: hostId,
        socketId: socket.id,
        name: hostName,
        isAdmin: true,
        isReady: false,
        color: '#0AC8B9',
        avatarIndex: 0
      }]
    };

    lobbies.set(code, newLobby);
    socket.join(code);
    callback({ success: true, code, state: newLobby });
  });

  // Join Lobby
  socket.on('lobby:join', ({ code, playerName, playerId }, callback) => {
    const lobby = lobbies.get(code);

    if (!lobby) return callback({ success: false, error: "Lobby not found" });
    if (lobby.players.length >= 10) return callback({ success: false, error: "Lobby is full" });
    if (lobby.status !== 'LOBBY') return callback({ success: false, error: "Game already in progress" });

    const newPlayer = {
      id: playerId,
      socketId: socket.id,
      name: playerName,
      isAdmin: false,
      isReady: false,
      color: getRandomColor(),
      avatarIndex: Math.floor(Math.random() * 3)
    };

    lobby.players.push(newPlayer);
    socket.join(code);

    callback({ success: true, state: lobby });
    io.to(code).emit('lobby:update', lobby);
  });

  // Toggle Ready & Start Check
  socket.on('lobby:ready', ({ code, playerId }) => {
    const lobby = lobbies.get(code);
    if (!lobby || lobby.status !== 'LOBBY') return;

    const player = lobby.players.find(p => p.id === playerId);
    if (player) {
      player.isReady = !player.isReady;
      io.to(code).emit('lobby:update', lobby);

      // Check if all ready (min 2 players for dev, usually more)
      const allReady = lobby.players.every(p => p.isReady);
      if (allReady && lobby.players.length >= 1) { // Adjusted to 1 for testing, usually > 1
        startCountdown(lobby);
      }
    }
  });

  const startCountdown = (lobby) => {
    lobby.status = 'STARTING';
    io.to(lobby.code).emit('lobby:update', lobby);
    
    // Broadcast countdown event
    io.to(lobby.code).emit('game:starting', 5);

    setTimeout(() => {
      startGame(lobby);
    }, 5000);
  };

  const startGame = (lobby) => {
    lobby.status = 'GAME';
    
    // Assign Roles
    const hunterIndex = Math.floor(Math.random() * lobby.players.length);
    const roles = {};
    const spawnPoints = {};

    lobby.players.forEach((p, i) => {
      const role = i === hunterIndex ? 'HUNTER' : 'PROP';
      roles[p.id] = role;
      spawnPoints[p.id] = getSpawnPoint(i);
      
      // Update internal state
      p.role = role;
    });

    // Send start data
    io.to(lobby.code).emit('game:start', { roles, spawnPoints });
  };

  // In-Game Movement Relay
  socket.on('player:move', ({ code, id, position, rotation }) => {
    // Optimization: In a real app, use UDP or Volatile broadcast. 
    // Here we just relay to others in room except sender.
    socket.to(code).emit('player:moved', { id, position, rotation });
  });

  socket.on('lobby:kick', ({ code, adminId, targetId }) => {
    const lobby = lobbies.get(code);
    if (!lobby) return;
    const admin = lobby.players.find(p => p.id === adminId);
    if (!admin || !admin.isAdmin) return;

    lobby.players = lobby.players.filter(p => p.id !== targetId);
    io.to(code).emit('player:kicked', targetId);
    io.to(code).emit('lobby:update', lobby);
  });

  const handleLeave = () => {
    for (const [code, lobby] of lobbies.entries()) {
      const playerIndex = lobby.players.findIndex(p => p.socketId === socket.id);
      if (playerIndex !== -1) {
        const player = lobby.players[playerIndex];
        lobby.players.splice(playerIndex, 1);

        if (lobby.players.length === 0) {
          lobbies.delete(code);
        } else {
          if (player.isAdmin && lobby.players.length > 0) lobby.players[0].isAdmin = true;
          io.to(code).emit('lobby:update', lobby);
        }
        break;
      }
    }
  };

  socket.on('lobby:leave', handleLeave);
  socket.on('disconnect', handleLeave);
});

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});