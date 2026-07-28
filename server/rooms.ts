import WebSocket from 'ws';
import { DrawingState, Point } from './drawing-state';

export interface UserSession {
  id: string;
  name: string;
  color: string;
  roomId: string;
  ws: WebSocket;
  cursor?: Point;
}

const USER_COLORS = [
  '#FF3B30', '#FF9500', '#FFCC00', '#34C759', '#00C7BE',
  '#30B0C7', '#32ADE6', '#007AFF', '#5856D6', '#AF52DE',
  '#FF2D55', '#A2845E'
];

const USER_ADJECTIVES = [
  'Cosmic', 'Neon', 'Swift', 'Vivid', 'Cyber', 'Starlight',
  'Pixel', 'Electric', 'Solar', 'Lunar', 'Quantum', 'Aura'
];

const USER_NOUNS = [
  'Otter', 'Falcon', 'Panther', 'Fox', 'Bear', 'Owl',
  'Tiger', 'Lynx', 'Phoenix', 'Dragon', 'Eagle', 'Wolf'
];

export class RoomManager {
  private rooms = new Map<string, { state: DrawingState; users: Map<string, UserSession> }>();
  private userIndex = 0;

  public getOrCreateRoom(roomId: string) {
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, {
        state: new DrawingState(),
        users: new Map<string, UserSession>()
      });
    }
    return this.rooms.get(roomId)!;
  }

  public createUserSession(ws: WebSocket, roomId: string, customName?: string): UserSession {
    const room = this.getOrCreateRoom(roomId);
    const colorIndex = this.userIndex % USER_COLORS.length;
    const adj = USER_ADJECTIVES[Math.floor(Math.random() * USER_ADJECTIVES.length)];
    const noun = USER_NOUNS[Math.floor(Math.random() * USER_NOUNS.length)];
    const defaultName = customName || `${adj} ${noun}`;

    this.userIndex++;

    const userId = 'usr_' + Math.random().toString(36).substring(2, 9);
    const userSession: UserSession = {
      id: userId,
      name: defaultName,
      color: USER_COLORS[colorIndex],
      roomId,
      ws
    };

    room.users.set(userId, userSession);
    return userSession;
  }

  public removeUserSession(userId: string, roomId: string): UserSession | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    const user = room.users.get(userId) || null;
    if (user) {
      room.users.delete(userId);
    }
    if (room.users.size === 0) {
      // Keep state in memory or cleanup empty rooms
    }
    return user;
  }

  public getUsersInRoom(roomId: string): Array<{ id: string; name: string; color: string }> {
    const room = this.rooms.get(roomId);
    if (!room) return [];

    return Array.from(room.users.values()).map((u) => ({
      id: u.id,
      name: u.name,
      color: u.color
    }));
  }

  public broadcastToRoom(roomId: string, message: any, excludeUserId?: string) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const json = JSON.stringify(message);
    room.users.forEach((user) => {
      if (user.id !== excludeUserId && user.ws.readyState === WebSocket.OPEN) {
        user.ws.send(json);
      }
    });
  }
}
