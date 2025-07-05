import { io } from 'socket.io-client';
import { ACTIONS } from '../constants/actions.ts';

const URL = import.meta.env.PROD ? 'https://your-production-url.com' : 'http://localhost:3000';

const socket = io(URL, {
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  transports: ['websocket'],
});

socket.on(ACTIONS.CONNECT, () => {
  console.log('✅ Connected to server:', socket.id);
});

socket.on(ACTIONS.CONNECT_ERROR, (err) => {
  console.error('❌ Connection error:', err.message);
});

export default socket;
