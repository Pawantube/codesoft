import { io } from 'socket.io-client';

let socket;

export function initSocket(token) {
  if (socket) {
    if (token && socket.auth && socket.auth.token !== token) {
      socket.auth = { token };
      if (socket.disconnected) {
        socket.connect();
      }
    }
    return socket;
  }

  const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
  socket = io(baseURL, {
    // Be resilient locally: allow polling fallback so dev always connects
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 500,
    reconnectionDelayMax: 5000,
    withCredentials: true,
    auth: { token }
  });
  return socket;
}

export function getSocket() {
  return socket;
}

export function closeSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
