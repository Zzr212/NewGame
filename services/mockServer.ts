import { LobbyState, Player } from '../types';

/**
 * MOCK SERVER LOGIC
 * In a real Node.js app, this logic resides in server.js using socket.io.
 * This class simulates network latency and server state management.
 */

class MockServer {
  private lobbies: Map<string, LobbyState> = new Map();
  private subscribers: Map<string, (state: LobbyState | null, event?: string) => void> = new Map();

  // Helpers
  private generateCode(): string {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  private delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private notify(lobbyCode: string, event?: string) {
    const lobby = this.lobbies.get(lobbyCode);
    if (!lobby) return;
    
    // Notify all players in this lobby
    lobby.players.forEach(p => {
      const cb = this.subscribers.get(p.id);
      if (cb) cb(JSON.parse(JSON.stringify(lobby)), event);
    });
  }

  // --- API Methods ---

  public subscribe(playerId: string, callback: (state: LobbyState | null, event?: string) => void) {
    this.subscribers.set(playerId, callback);
  }

  public async createLobby(hostName: string, hostId: string): Promise<string> {
    await this.delay(600);
    const code = this.generateCode();
    
    const newLobby: LobbyState = {
      code,
      status: 'LOBBY',
      players: [{
        id: hostId,
        name: hostName,
        isAdmin: true,
        isReady: false,
        color: '#0AC8B9', // Hextech Cyan
        avatarIndex: 0
      }]
    };

    this.lobbies.set(code, newLobby);
    this.notify(code);
    return code;
  }

  public async joinLobby(code: string, playerName: string, playerId: string): Promise<boolean> {
    await this.delay(600);
    const lobby = this.lobbies.get(code);
    
    if (!lobby) throw new Error("Lobby not found");
    if (lobby.players.length >= 10) throw new Error("Lobby is full");

    lobby.players.push({
      id: playerId,
      name: playerName,
      isAdmin: false,
      isReady: false,
      color: this.getRandomColor(),
      avatarIndex: Math.floor(Math.random() * 3)
    });

    this.notify(code);
    return true;
  }

  public async toggleReady(code: string, playerId: string) {
    await this.delay(100);
    const lobby = this.lobbies.get(code);
    if (!lobby) return;

    const player = lobby.players.find(p => p.id === playerId);
    if (player) {
      player.isReady = !player.isReady;
      this.notify(code);
    }
  }

  public async kickPlayer(code: string, adminId: string, targetId: string) {
    await this.delay(200);
    const lobby = this.lobbies.get(code);
    if (!lobby) return;

    // Verify admin
    const admin = lobby.players.find(p => p.id === adminId);
    if (!admin || !admin.isAdmin) return;

    lobby.players = lobby.players.filter(p => p.id !== targetId);
    
    // Notify the kicked player specifically (simulated)
    const kickedCb = this.subscribers.get(targetId);
    if (kickedCb) kickedCb(null, 'kicked');

    this.notify(code);
  }

  public async leaveLobby(code: string, playerId: string) {
    const lobby = this.lobbies.get(code);
    if (!lobby) return;

    lobby.players = lobby.players.filter(p => p.id !== playerId);
    
    // If admin leaves, assign new admin or close lobby
    if (lobby.players.length === 0) {
      this.lobbies.delete(code);
    } else if (!lobby.players.some(p => p.isAdmin)) {
      lobby.players[0].isAdmin = true;
    }

    this.notify(code);
  }

  private getRandomColor() {
    const colors = ['#C8AA6E', '#0AC8B9', '#FF4655', '#A09B8C', '#E6E6E6', '#FF9900'];
    return colors[Math.floor(Math.random() * colors.length)];
  }
}

export const mockServer = new MockServer();
