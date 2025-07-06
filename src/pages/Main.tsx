import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { v4 } from 'uuid';
import { ACTIONS } from '../constants/actions.ts';
import socket from '../socket';

const Main = () => {
  const [rooms, updateRooms] = useState<string[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const handleShareRooms = ({ rooms = [] }: { rooms: string[] }) => {
      console.log('📬 Received rooms:', rooms);
      updateRooms(rooms);
    };

    console.log(rooms);

    socket.on(ACTIONS.SHARE_ROOMS, handleShareRooms);
    socket.emit(ACTIONS.GET_ROOMS);

    return () => {
      socket.off(ACTIONS.SHARE_ROOMS, handleShareRooms);
    };
  }, []);

  const handleCreateRoom = () => {
    const roomId = v4();
    socket.emit(ACTIONS.JOIN, { room: roomId });
    navigate(`/room/${roomId}`);
  };

  const handleJoinRoom = (roomId: string) => () => {
    navigate(`/room/${roomId}`);
  };

  return (
    <div className='flex h-screen flex-col items-center justify-center bg-gray-100'>
      {rooms.length > 0 && (
        <h1 className='mb-4 text-center text-xl font-bold uppercase'>Available Rooms</h1>
      )}
      <ul className='moverflow-scroll mb-2 max-h-5'>
        {rooms.map((roomID) => (
          <li
            key={roomID}
            className='space-y-2'
          >
            <span className='mr-4'>{roomID}</span>
            <button
              onClick={handleJoinRoom(roomID)}
              className='mb-3 cursor-pointer rounded-2xl bg-amber-600 px-3 py-1 text-white'
            >
              JOIN ROOM
            </button>
          </li>
        ))}
      </ul>

      <button
        className='cursor-pointer rounded-2xl bg-purple-400 px-4 py-2 font-bold text-white uppercase'
        onClick={handleCreateRoom}
      >
        Create New Room
      </button>
    </div>
  );
};

export default Main;
