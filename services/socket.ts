import { io, Socket } from 'socket.io-client';
import { LobbyState, GameStartData } from '../types';

const socket: Socket = io();

class SocketService {
  constructor() {
    socket.on('connect', () => {
      console.log('Connected to server via Socket.io');
    });
  }

  public subscribe(
    playerId: string, 
    callback: (state: LobbyState | null, event?: string, data?: any) => void
  ) {
    socket.on('lobby:update', (state: LobbyState) => {
      callback(state, 'update');
    });

    socket.on('player:kicked', (kickedId: string) => {
      if (kickedId === playerId) {
        callback(null, 'kicked');
      }
    });

    socket.on('game:starting', (seconds: number) => {
      callback(null, 'game:starting', seconds);
    });

    socket.on('game:start', (data: GameStartData) => {
      callback(null, 'game:start', data);
    });
    
    // In-game movement updates from others
    socket.on('player:moved', (data: { id: string, position: any, rotation: any }) => {
        // We handle this inside GameScene directly usually, 
        // but passing it through callback is one way. 
        // Better pattern: emit a custom event to window or a store.
        window.dispatchEvent(new CustomEvent('player-moved', { detail: data }));
    });
  }

  public createLobby(hostName: string, hostId: string): Promise<string> {
    return new Promise((resolve, reject) => {
      socket.emit('lobby:create', { hostName, hostId }, (response: any) => {
        if (response.success) resolve(response.code);
        else reject(response.error);
      });
    });
  }

  public joinLobby(code: string, playerName: string, playerId: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      socket.emit('lobby:join', { code, playerName, playerId }, (response: any) => {
        if (response.success) resolve(true);
        else reject(new Error(response.error));
      });
    });
  }

  public toggleReady(code: string, playerId: string) {
    socket.emit('lobby:ready', { code, playerId });
  }

  public kickPlayer(code: string, adminId: string, targetId: string) {
    socket.emit('lobby:kick', { code, adminId, targetId });
  }

  public leaveLobby(code: string, playerId: string) {
    socket.emit('lobby:leave');
  }

  // --- GAME ACTIONS ---
  public sendMove(code: string, id: string, position: [number, number, number], rotation: [number, number, number]) {
    socket.emit('player:move', { code, id, position, rotation });
  }
}

export const socketService = new SocketService();