import { useParams } from 'react-router-dom';
import { cn } from '@/utils';
import useWebRTC, { LOCAL_VIDEO } from '../hooks/useWebRTC';

export default function Room() {
  const { id: roomID } = useParams<{ id: string }>();
  const { clients, provideMediaRef } = useWebRTC(roomID || '');

  const rows = Math.ceil(clients.length / 2);
  const height = clients.length <= 2 ? '100%' : `calc(100% / ${rows})`;

  return (
    <div className='flex h-screen flex-wrap'>
      {clients.map((clientID, index) => {
        const isLastSingle =
          clients.length === 1 || (clients.length % 2 === 1 && index === clients.length - 1);

        return (
          <div
            key={clientID}
            className={cn(isLastSingle ? 'w-full' : 'w-1/2')}
            style={{ height }}
          >
            <video
              className='h-full w-full object-cover'
              ref={(instance) => provideMediaRef(clientID, instance)}
              autoPlay
              playsInline
              muted={clientID === LOCAL_VIDEO}
            />
          </div>
        );
      })}
    </div>
  );
}
