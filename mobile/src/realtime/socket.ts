import { io, Socket } from 'socket.io-client';
import { SOCKET_URL } from '../config';
import { TokenStore } from '../api/client';

let socket: Socket | null = null;
let reconnectAttempts = 0;
const MAX_RECONNECT = 5;

export async function connectSocket(): Promise<Socket> {
  if (socket?.connected) return socket;

  const token = await TokenStore.getAccess();

  socket = io(SOCKET_URL, {
    path: '/socket.io',
    auth: { token: token ?? '' },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: MAX_RECONNECT,
    reconnectionDelay: 1500,
    timeout: 10000,
  });

  socket.on('connect', () => {
    reconnectAttempts = 0;
  });

  socket.on('connect_error', (err) => {
    reconnectAttempts += 1;
    if (reconnectAttempts >= MAX_RECONNECT) {
      socket?.disconnect();
    }
  });

  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function getSocket(): Socket | null {
  return socket;
}

export function emitRefresh(): void {
  socket?.emit('student:refresh');
}
