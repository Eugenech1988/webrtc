import { useEffect } from 'react';
import { Route, Routes } from 'react-router-dom';
import Main from './pages/Main.tsx';
import NotFound404 from './pages/NotFound404.tsx';
import Room from './pages/Room.tsx';
import socket from './socket';

const App = () => {
  useEffect(() => {
    socket.connect();

    return () => {
      socket.disconnect();
    };
  });
  return (
    <Routes>
      <Route
        path='/'
        element={<Main />}
      />
      <Route
        path='/room/:id'
        element={<Room />}
      />
      <Route
        path='*'
        element={<NotFound404 />}
      />
    </Routes>
  );
};

export default App;
