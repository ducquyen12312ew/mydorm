import { io } from 'socket.io-client';

export function createStudentSocket() {
  return io(import.meta.env.VITE_SOCKET_URL || window.location.origin, {
    path: '/socket.io',
    withCredentials: true,
    transports: ['websocket', 'polling']
  });
}
