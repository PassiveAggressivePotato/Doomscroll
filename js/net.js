// net.js — dead-simple 2-player matchmaking over WebRTC (via the public
// PeerJS cloud broker, so this static site needs no backend of its own).
//
// Everyone who loads the page tries to claim one fixed "lobby" id. First
// one there becomes the HOST; anyone after that finds the id taken and
// becomes a JOINER who can connect to the host directly. If PeerJS fails
// to load, or the broker/WebRTC is unreachable, we fall back to 'solo'
// and the game plays exactly as before.
const LOBBY_ID = 'doomscroll-hangar13-lobby-v1';

export let role = 'pending'; // 'pending' | 'host' | 'join' | 'solo'

let peer = null;
let conn = null;
let handlers = {};

function toSolo() {
  if (role === 'solo') return;
  role = 'solo';
  handlers.onRole?.('solo');
}

function wireConnection(c) {
  conn = c;
  c.on('open', () => handlers.onConnected?.());
  c.on('data', d => handlers.onData?.(d));
  c.on('close', () => { conn = null; handlers.onDisconnected?.(); });
  c.on('error', () => { conn = null; handlers.onDisconnected?.(); });
}

// `handlers`: { onRole(role), onConnected(), onData(msg), onDisconnected() }
export function initNet(h) {
  handlers = h;
  if (typeof Peer === 'undefined') { toSolo(); return; }

  // safety net: never leave the title screen guessing forever
  const giveUp = setTimeout(toSolo, 6000);

  peer = new Peer(LOBBY_ID);
  peer.on('open', () => {
    clearTimeout(giveUp);
    role = 'host';
    handlers.onRole?.('host');
    peer.on('connection', c => {
      if (conn) { c.close(); return; } // one partner at a time, for now
      wireConnection(c);
    });
  });
  peer.on('error', err => {
    clearTimeout(giveUp);
    if (err.type !== 'unavailable-id') { toSolo(); return; }
    // someone's already hosting — become a plain client with a random id
    peer = new Peer();
    peer.on('open', () => { role = 'join'; handlers.onRole?.('join'); });
    peer.on('error', () => toSolo());
  });
}

// Only valid once role === 'join'. Connects to the host; `onConnected`
// fires once the data channel is actually open.
export function joinGame() {
  if (!peer || role !== 'join' || conn) return;
  wireConnection(peer.connect(LOBBY_ID, { reliable: true }));
}

export function send(msg) {
  if (conn && conn.open) conn.send(msg);
}

export function isPaired() {
  return !!(conn && conn.open);
}
