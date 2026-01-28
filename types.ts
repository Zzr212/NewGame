export type Role = 'HUNTER' | 'PROP' | null;

export interface Player {
  id: string;
  name: string;
  isReady: boolean;
  isAdmin: boolean;
  color: string;
  avatarIndex: number;
  role?: Role;
  position?: [number, number, number];
  rotation?: [number, number, number];
}

export interface LobbyState {
  code: string;
  players: Player[];
  status: 'LOBBY' | 'STARTING' | 'GAME';
  countdown?: number;
}

export interface GameStartData {
  roles: Record<string, Role>;
  spawnPoints: Record<string, [number, number, number]>;
}

export interface PlayerInput {
  move: { x: number; y: number };
  look: { x: number; y: number };
}

// Events that would fly over Socket.io
export interface ServerEvents {
  'lobby:update': (state: LobbyState) => void;
  'game:starting': (seconds: number) => void;
  'game:start': (data: GameStartData) => void;
  'player:kicked': () => void;
  'player:move': (id: string, pos: [number, number, number], rot: [number, number, number]) => void;
}