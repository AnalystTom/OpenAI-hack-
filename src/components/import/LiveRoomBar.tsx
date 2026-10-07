import { useState } from 'react';
import type { LiveRoomConnection } from '../../integrations/codex/useLiveRoom';

export default function LiveRoomBar({ live, onImport }: { live: LiveRoomConnection; onImport: () => void }) {
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  async function copy() {
    if (!live.inviteUrl) return;
    try { await navigator.clipboard.writeText(live.inviteUrl); setCopied(true); setError(''); }
    catch { setError('Copy the room link below to invite someone.'); }
  }
  return <section className="live-room-bar" aria-label="Live room">
    {live.roomId ? <>
      <b>{live.state === 'connected' ? 'Live room connected' : live.state === 'connecting' ? 'Connecting to room…' : 'Room disconnected'}</b>
      <p>Everyone with this link sees the agents shared here.</p>
      <div className="live-room-actions"><button onClick={onImport}>{live.credential ? 'Connect my Codex' : 'Join with my Codex'}</button><button onClick={copy}>{copied ? 'Link copied' : 'Invite someone'}</button></div>
      <input aria-label="Live room invitation" readOnly value={live.inviteUrl ?? ''} onFocus={e => e.currentTarget.select()} />
      {live.expiresAt && <small>Room expires {new Date(live.expiresAt).toLocaleString()}</small>}
      <div className="live-room-actions">{live.credential && <button onClick={async () => { try { await live.disconnect(); setError(''); } catch (e) { setError(e instanceof Error ? e.message : 'Unable to disconnect.'); } }}>Disconnect my agents</button>}<button onClick={live.leave}>Leave room</button></div>
    </> : <>
      <b>Work together in one room</b>
      <p>Connect your Codex and invite others to bring their agents.</p>
      <button onClick={onImport}>Create a live room</button>
    </>}
    {(error || live.error) && <p role="alert">{error || live.error}</p>}
  </section>;
}
