import { useCallback, useEffect, useRef } from 'react';
import { ACTIONS } from '@/constants/actions';
import socket from '@/socket';
import useStateWithCallback from './useStateWithCallBack.tsx';

export const LOCAL_VIDEO = 'LOCAL_VIDEO';

interface AddPeerPayload {
  peerID: string;
  createOffer: boolean;
}

interface SessionDescriptionPayload {
  peerID: string;
  sessionDescription: RTCSessionDescriptionInit;
}

interface IceCandidatePayload {
  peerID: string;
  iceCandidate: RTCIceCandidateInit;
}

export default function useWebRTC(roomID: string) {
  const [clients, updateClients] = useStateWithCallback<string[]>([]);

  // Добавляем клиента один раз
  const addClient = useCallback(
    (id: string, cb?: () => void) =>
      updateClients((list) => (list.includes(id) ? list : [...list, id]), cb),
    [updateClients]
  );

  // Словарь RTCPeerConnection
  const pcs = useRef<Record<string, RTCPeerConnection>>({});
  // Локальный медиапоток
  const localStream = useRef<MediaStream | null>(null);
  // Ссылки на video-элементы
  const mediaEls = useRef<Record<string, HTMLVideoElement | null>>({
    [LOCAL_VIDEO]: null,
  });

  // 1) Сигнальный канал: обработка ADD_PEER, SDP, ICE и REMOVE_PEER
  useEffect(() => {
    // Когда приходит новый peer — соединяемся
    const handleAddPeer = async ({ peerID, createOffer }: AddPeerPayload) => {
      if (pcs.current[peerID]) return;
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      });
      pcs.current[peerID] = pc;

      // Пересылаем ICE-кандидаты
      pc.onicecandidate = (e) => {
        if (e.candidate) {
          socket.emit(ACTIONS.RELAY_ICE, {
            peerID,
            iceCandidate: e.candidate,
          });
        }
      };

      // Сразу отображаем первый же приходящий медиапоток
      pc.ontrack = ({ streams: [stream] }) => {
        addClient(peerID, () => {
          const el = mediaEls.current[peerID];
          if (el) {
            el.srcObject = stream;
          }
        });
      };

      // Добавляем локальные дорожки
      localStream.current?.getTracks().forEach((track) => pc.addTrack(track, localStream.current!));

      // Создаём или отвечаем на Offer
      if (createOffer) {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit(ACTIONS.RELAY_SDP, { peerID, sessionDescription: offer });
      }
    };

    // Когда приходит SDP — устанавливаем удалённое описание
    const handleSession = async ({ peerID, sessionDescription }: SessionDescriptionPayload) => {
      const pc = pcs.current[peerID];
      if (!pc) return;
      await pc.setRemoteDescription(new RTCSessionDescription(sessionDescription));
      if (sessionDescription.type === 'offer') {
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit(ACTIONS.RELAY_SDP, { peerID, sessionDescription: answer });
      }
    };

    // Когда приходит ICE-кандидат
    const handleIce = ({ peerID, iceCandidate }: IceCandidatePayload) => {
      pcs.current[peerID]?.addIceCandidate(new RTCIceCandidate(iceCandidate));
    };

    // Когда peer ушёл
    const handleRemove = ({ peerID }: { peerID: string }) => {
      pcs.current[peerID]?.close();
      delete pcs.current[peerID];
      delete mediaEls.current[peerID];
      updateClients((list) => list.filter((id) => id !== peerID));
    };

    socket.on(ACTIONS.ADD_PEER, handleAddPeer);
    socket.on(ACTIONS.SESSION_DESCRIPTION, handleSession);
    socket.on(ACTIONS.ICE_CANDIDATE, handleIce);
    socket.on(ACTIONS.REMOVE_PEER, handleRemove);

    return () => {
      socket.off(ACTIONS.ADD_PEER, handleAddPeer);
      socket.off(ACTIONS.SESSION_DESCRIPTION, handleSession);
      socket.off(ACTIONS.ICE_CANDIDATE, handleIce);
      socket.off(ACTIONS.REMOVE_PEER, handleRemove);
    };
  }, [addClient, updateClients]);

  // 2) Захват локального видео и JOIN/LEAVE
  useEffect(() => {
    (async () => {
      localStream.current = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true,
      });

      // Показываем своё видео
      addClient(LOCAL_VIDEO, () => {
        const el = mediaEls.current[LOCAL_VIDEO];
        if (el) el.srcObject = localStream.current!;
      });

      // Входим в комнату
      socket.emit(ACTIONS.JOIN, { room: roomID });
    })().catch(console.error);

    return () => {
      localStream.current?.getTracks().forEach((t) => t.stop());
      socket.emit(ACTIONS.LEAVE);
    };
  }, [roomID, addClient]);

  // 3) Фабрика ref’ов для video-элементов
  const provideMediaRef = useCallback((id: string, node: HTMLVideoElement | null) => {
    mediaEls.current[id] = node;
  }, []);

  return { clients, provideMediaRef };
}
