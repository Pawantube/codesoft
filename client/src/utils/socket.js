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
    transports: ['websocket'],
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
