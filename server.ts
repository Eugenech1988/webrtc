import { createServer } from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
// import type { Request, Response } from 'express';
import express from 'express';
import { Server, Socket } from 'socket.io';
import { validate, version } from 'uuid';
import { ACTIONS } from './src/constants/actions.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:5173',
    methods: ['GET', 'POST'],
  },
});

const PORT = Number(process.env.PORT) || 3000;

interface JoinPayload {
  room: string;
}

interface RTCSessionDescriptionInit {
  type?: 'offer' | 'answer' | 'rollback';
  sdp?: string;
}

interface RelaySDP {
  peerID: string;
  sessionDescription: RTCSessionDescriptionInit;
}

interface RTCIceCandidateInit {
  candidate?: string;
  sdpMid?: string | null;
  sdpMLineIndex?: number | null;
  usernameFragment?: string | null;
}

interface RelayICE {
  peerID: string;
  iceCandidate: RTCIceCandidateInit;
}

function getClientRooms() {
  const { rooms } = io.sockets.adapter;

  return Array.from(rooms.keys()).filter(
    (roomID) => typeof roomID === 'string' && validate(roomID) && version(roomID) === 4
  );
}

function shareRoomsInfo(): void {
  io.emit(ACTIONS.SHARE_ROOMS, {
    rooms: getClientRooms(),
  });
}

io.on('connection', (socket: Socket) => {
  console.log('✅ New connection:', socket.id);
  shareRoomsInfo();

  socket.on(ACTIONS.JOIN, ({ room }: JoinPayload) => {
    if (socket.rooms.has(room)) {
      return console.warn(`⚠️ Already joined to ${room}`);
    }

    const clients = Array.from(io.sockets.adapter.rooms.get(room) || []);

    clients.forEach((clientID) => {
      io.to(clientID).emit(ACTIONS.ADD_PEER, {
        peerID: socket.id,
        createOffer: false,
      });

      socket.emit(ACTIONS.ADD_PEER, {
        peerID: clientID,
        createOffer: true,
      });
    });

    socket.join(room);
    shareRoomsInfo();
  });

  const leaveRoom = () => {
    const { rooms } = socket;

    Array.from(rooms)
      .filter((roomID) => validate(roomID) && version(roomID) === 4)
      .forEach((roomID) => {
        const clients = Array.from(io.sockets.adapter.rooms.get(roomID) || []);

        clients.forEach((clientID) => {
          io.to(clientID).emit(ACTIONS.REMOVE_PEER, { peerID: socket.id });
          socket.emit(ACTIONS.REMOVE_PEER, { peerID: clientID });
        });

        socket.leave(roomID);
      });

    shareRoomsInfo();
  };

  socket.on(ACTIONS.LEAVE, leaveRoom);
  socket.on('disconnecting', leaveRoom);

  socket.on(ACTIONS.RELAY_SDP, ({ peerID, sessionDescription }: RelaySDP) => {
    io.to(peerID).emit(ACTIONS.SESSION_DESCRIPTION, {
      peerID: socket.id,
      sessionDescription,
    });
  });

  socket.on(ACTIONS.RELAY_ICE, ({ peerID, iceCandidate }: RelayICE) => {
    io.to(peerID).emit(ACTIONS.ICE_CANDIDATE, {
      peerID: socket.id,
      iceCandidate,
    });
  });
});

const publicPath = path.join(__dirname, 'build');
app.use(express.static(publicPath));

// app.get('*', (_req: Request, res: Response) => {
//   res.sendFile(path.join(publicPath, 'index.html'));
// });

server.listen(PORT, () => {
  console.log(`🚀 Server started on http://localhost:${PORT}`);
});
