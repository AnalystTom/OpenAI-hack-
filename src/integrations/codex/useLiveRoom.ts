import { useCallback, useEffect, useRef, useState } from 'react';
import type { OfficeSnapshot } from '../../types';
import { parseOfficeSnapshot } from '../../snapshot';
import { applyRoomMessage, liveMetadata } from '../../liveRoom';

export interface RoomCredential { roomId: string; memberId: string; uploadToken: string; expiresAt: number; ownerName: string }
export const liveApiBase = (import.meta.env.VITE_LIVE_API_URL ?? window.location.origin).replace(/\/$/, '');
const storageKey = 'dots-live-member-v1';
function roomInUrl() { return window.location.hash.match(/^#live=([a-f0-9-]{36})$/)?.[1] ?? null; }
function savedCredential(): RoomCredential | null {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey) ?? 'null');
    return value && typeof value.roomId === 'string' && typeof value.memberId === 'string' && typeof value.uploadToken === 'string' && value.expiresAt > Date.now() ? value : null;
  } catch { return null; }
}
async function request(path: string, init?: RequestInit) {
  const response = await fetch(`${liveApiBase}/api/live/${path}`, { ...init, cache: 'no-store', signal: AbortSignal.timeout(10_000) });
  if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('The live room service is unavailable. Try again shortly.');
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.error ?? 'Unable to connect to this room.');
    Object.assign(error, { status: response.status });
    throw error;
  }
  return data;
}

export function useLiveRoom() {
  const [roomId, setRoomId] = useState(roomInUrl);
  const [credential, setCredential] = useState(savedCredential);
  const [snapshot, setSnapshot] = useState<OfficeSnapshot>({ version: 1, agents: [] });
  const [state, setState] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [error, setError] = useState('');
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const currentRoom = useRef(roomId);
  const currentSnapshot = useRef(snapshot);
  currentSnapshot.current = snapshot;
  currentRoom.current = roomId;
  useEffect(() => {
    const update = () => { setRoomId(roomInUrl()); setSnapshot({ version: 1, agents: [] }); };
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  }, []);
  useEffect(() => {
    if (!roomId) { setState('disconnected'); return; }
    let cancelled = false, socket: WebSocket;
    let timer: ReturnType<typeof setTimeout>;
    let attempts = 0;
    let generation = 0;
    function closeStream() {
      if (socket) { socket.onclose = null; socket.close(); }
    }
    function offline() {
      generation++;
      clearTimeout(timer);
      closeStream();
      setState('error'); setError('You are offline. Reconnect to rejoin the room.');
    }
    function online() {
      clearTimeout(timer);
      attempts = 0;
      void connect();
    }
    function retry() {
      timer = setTimeout(connect, Math.min(30_000, 3000 * 2 ** Math.min(attempts++, 4)) + Math.random() * 1000);
    }
    async function connect() {
      if (cancelled) return;
      if (!navigator.onLine) { offline(); return; }
      const attempt = ++generation;
      closeStream();
      setState('connecting');
      try {
        const data = await request(`rooms/${roomId}/snapshot`);
        if (cancelled || attempt !== generation) return;
        const initial = parseOfficeSnapshot(JSON.stringify(data));
        currentSnapshot.current = initial;
        setSnapshot(initial);
        setExpiresAt(data.expiresAt);
        const url = new URL(`${liveApiBase}/api/live/rooms/${roomId}/stream`);
        url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
        socket = new WebSocket(url);
        socket.onopen = () => { if (!cancelled && attempt === generation) { attempts = 0; setState('connected'); setError(''); } };
        socket.onmessage = (event) => {
          if (cancelled || attempt !== generation) return;
          try {
            const next = applyRoomMessage(currentSnapshot.current, event.data);
            currentSnapshot.current = next;
            setSnapshot(next);
          }
          catch { setError('The room sent invalid session data.'); setState('error'); socket.close(); }
        };
        socket.onclose = () => {
          if (cancelled || attempt !== generation) return;
          setState('error'); setError('Room connection lost. Reconnecting…');
          retry();
        };
      } catch (e) {
        if (cancelled || attempt !== generation) return;
        setState('error'); setError(e instanceof Error ? e.message : 'Room connection unavailable.');
        if (!(e instanceof Error && 'status' in e && e.status === 410)) retry();
      }
    }
    window.addEventListener('offline', offline);
    window.addEventListener('online', online);
    void connect();
    return () => {
      cancelled = true; generation++; clearTimeout(timer);
      window.removeEventListener('offline', offline);
      window.removeEventListener('online', online);
      closeStream();
    };
  }, [roomId]);

  const join = useCallback(async (ownerName: string, id = currentRoom.current) => {
    if (!id) throw new Error('Create or open a live room first.');
    const name = ownerName.trim();
    if (!name || name.length > 60) throw new Error('Enter your name using 1 to 60 characters.');
    const saved = savedCredential();
    if (saved?.roomId === id && saved.ownerName === name) { setCredential(saved); return saved; }
    const data = await request(`rooms/${id}/join`, { method: 'POST', headers: {
      'Content-Type': 'application/json', ...(saved?.roomId === id ? { Authorization: `Bearer ${saved.uploadToken}` } : {}),
    }, body: JSON.stringify({ ownerName: name }) });
    const next = { roomId: id, ...data } as RoomCredential;
    try { localStorage.setItem(storageKey, JSON.stringify(next)); }
    catch { throw new Error('Browser storage is unavailable. Enable it to keep your room connection.'); }
    setCredential(next);
    return next;
  }, []);
  const create = useCallback(async (ownerName: string) => {
    const { roomId: id } = await request('rooms', { method: 'POST' });
    await join(ownerName, id);
    setRoomId(id);
    window.location.hash = `live=${id}`;
    return id as string;
  }, [join]);
  const publishSnapshot = useCallback(async (source: OfficeSnapshot, ownerName: string) => {
    const id = currentRoom.current ?? await create(ownerName);
    const member = await join(ownerName, id);
    await request(`rooms/${id}/feed?mode=snapshot`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${member.uploadToken}` }, body: JSON.stringify(liveMetadata(source)) });
  }, [create, join]);
  const disconnect = useCallback(async () => {
    const saved = savedCredential();
    if (saved && saved.roomId === currentRoom.current) {
      await request(`rooms/${saved.roomId}/feed`, { method: 'DELETE', headers: { Authorization: `Bearer ${saved.uploadToken}` } });
      localStorage.removeItem(storageKey); setCredential(null);
    }
  }, []);
  const leave = useCallback(() => { window.location.hash = ''; setRoomId(null); setSnapshot({ version: 1, agents: [] }); setError(''); }, []);
  const member = credential?.roomId === roomId ? credential : null;
  return { roomId, credential: member, expiresAt, state, error, create, join, publishSnapshot, disconnect, leave,
    agents: state === 'connected' ? snapshot.agents : [],
    interactions: state === 'connected' ? snapshot.interactions ?? [] : [],
    inviteUrl: roomId ? `${window.location.origin}/#live=${roomId}` : null,
  };
}
export type LiveRoomConnection = ReturnType<typeof useLiveRoom>;
