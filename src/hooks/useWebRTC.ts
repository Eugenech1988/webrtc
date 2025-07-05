import { useCallback, useEffect, useRef, useState } from 'react';
import { ACTIONS } from '../constants/actions';
import socket from '../socket';

export const LOCAL_VIDEO = 'LOCAL_VIDEO';

export default function useWebRTC(roomID: string) {
  const [clients, setClients] = useState<string[]>([]);
  const pcs = useRef<Record<string, RTCPeerConnection>>({});
  const localStream = useRef<MediaStream | null>(null);
  const mediaRefs = useRef<Record<string, HTMLVideoElement | null>>({ [LOCAL_VIDEO]: null });

  // Добавление клиента без дубликатов
  const addClient = useCallback((newClient: string) => {
    setClients((prev) => (prev.includes(newClient) ? prev : [...prev, newClient]));
  }, []);

  // Основной эффект для обработки WebRTC соединений
  useEffect(() => {
    const handleAddPeer = async ({ peerID, createOffer }: any) => {
      if (pcs.current[peerID]) return;

      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      });

      pcs.current[peerID] = pc;

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          socket.emit(ACTIONS.RELAY_ICE, { peerID, iceCandidate: e.candidate });
        }
      };

      pc.ontrack = ({ streams: [stream] }) => {
        addClient(peerID);
        const videoElement = mediaRefs.current[peerID];
        if (videoElement) videoElement.srcObject = stream;
      };

      localStream.current?.getTracks().forEach((track) => {
        pc.addTrack(track, localStream.current!);
      });

      if (createOffer) {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit(ACTIONS.RELAY_SDP, { peerID, sessionDescription: offer });
      }
    };

    const handleRemoteEvents = {
      [ACTIONS.SESSION_DESCRIPTION]: async ({ peerID, sessionDescription }: any) => {
        const pc = pcs.current[peerID];
        if (!pc) return;

        await pc.setRemoteDescription(sessionDescription);
        if (sessionDescription.type === 'offer') {
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit(ACTIONS.RELAY_SDP, { peerID, sessionDescription: answer });
        }
      },

      [ACTIONS.ICE_CANDIDATE]: ({ peerID, iceCandidate }: any) => {
        pcs.current[peerID]?.addIceCandidate(iceCandidate);
      },

      [ACTIONS.REMOVE_PEER]: ({ peerID }: any) => {
        pcs.current[peerID]?.close();
        delete pcs.current[peerID];
        delete mediaRefs.current[peerID];
        setClients((prev) => prev.filter((id) => id !== peerID));
      },
    };

    // Подписка на события
    socket.on(ACTIONS.ADD_PEER, handleAddPeer);
    socket.on(ACTIONS.SESSION_DESCRIPTION, handleRemoteEvents[ACTIONS.SESSION_DESCRIPTION]);
    socket.on(ACTIONS.ICE_CANDIDATE, handleRemoteEvents[ACTIONS.ICE_CANDIDATE]);
    socket.on(ACTIONS.REMOVE_PEER, handleRemoteEvents[ACTIONS.REMOVE_PEER]);

    // Отписка при размонтировании
    return () => {
      socket.off(ACTIONS.ADD_PEER, handleAddPeer);
      Object.keys(handleRemoteEvents).forEach((event) => {
        socket.off(event, (handleRemoteEvents as any)[event]);
      });
    };
  }, [addClient]);

  // Эффект для управления медиа-потоком
  useEffect(() => {
    const initMedia = async () => {
      try {
        localStream.current = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });

        addClient(LOCAL_VIDEO);
        const localVideo = mediaRefs.current[LOCAL_VIDEO];
        if (localVideo) localVideo.srcObject = localStream.current;

        socket.emit(ACTIONS.JOIN, { room: roomID });
      } catch (error) {
        console.error('Media stream error:', error);
      }
    };

    initMedia();

    return () => {
      localStream.current?.getTracks().forEach((track) => track.stop());
      Object.values(pcs.current).forEach((pc) => pc.close());
      socket.emit(ACTIONS.LEAVE);
    };
  }, [roomID, addClient]);

  const provideMediaRef = (id: string, element: HTMLVideoElement | null) => {
    mediaRefs.current[id] = element;
    if (id === LOCAL_VIDEO && element) {
      element.srcObject = localStream.current;
    }
  };

  return { clients, provideMediaRef };
}
