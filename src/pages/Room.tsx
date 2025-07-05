// Room.tsx
import { useParams } from 'react-router-dom';
import useWebRTC, { LOCAL_VIDEO } from '../hooks/useWebRTC';

export default function Room() {
  const { id: roomID } = useParams<{ id: string }>();
  const { clients, provideMediaRef } = useWebRTC(roomID || '');

  return (
    <div className='flex h-screen flex-wrap'>
      {clients.map((clientID, index) => (
        <div
          key={clientID}
          className={
            clients.length === 1
              ? 'w-full'
              : clients.length % 2 === 1 && index === clients.length - 1
                ? 'w-full'
                : 'w-1/2'
          }
          style={{
            height: clients.length <= 2 ? '100%' : `calc(100% / ${Math.ceil(clients.length / 2)})`,
          }}
        >
          <video
            className='h-full w-full object-cover'
            ref={(instance) => provideMediaRef(clientID, instance)}
            autoPlay
            playsInline
            muted={clientID === LOCAL_VIDEO}
          />
        </div>
      ))}
    </div>
  );
}
