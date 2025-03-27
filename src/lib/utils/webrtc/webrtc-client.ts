/**
 * WebRTC client for data channel testing.
 * Handles WebRTC signaling via WebSockets and supports data channels.
 */
import { writable, type Writable } from 'svelte/store';
import { browser } from '$app/environment';
import { socketStore, onSocketEvent } from '$lib/stores/websocket-store';
import { get } from 'svelte/store';

// Types and stores
export type WebRTCEventType =
  | 'offer'
  | 'answer'
  | 'ice-candidate'
  | 'data-channel-open'
  | 'data-channel-close'
  | 'data-channel-message'
  | 'video-stream';

interface WebRTCEvent {
  type: WebRTCEventType;
  data: any;
  timestamp: number;
  source?: 'local' | 'remote';
}

export const webrtcEvents: Writable<WebRTCEvent[]> = writable([]);
export const videoStream = writable<any | null>(null);
export const webrtcStatus = writable({
  connected: false,
  error: null as string | null,
  lastEventTimestamp: null as number | null,
  peerConnection: null as RTCPeerConnection | null,
  dataChannel: null as RTCDataChannel | null,
  dataChannelState: 'closed' as 'connecting' | 'open' | 'closing' | 'closed',
  hasVideoTrack: false,
  videoTrackState: 'none' as 'none' | 'receiving' | 'active' | 'ended',
  videoPlaybackState: 'none' as 'none' | 'loading' | 'playing' | 'stalled' | 'error',
  videoError: null as string | null
});

let cleanupFunctions: Array<() => void> = [];

/** Log and add a new event; update lastEventTimestamp */
function addEvent(type: WebRTCEventType, data: any, source: 'local' | 'remote' = 'remote') {
  const timestamp = Date.now();
  console.log(`[WebRTC] ${source === 'local' ? 'Sending' : 'Received'} ${type}:`, data);
  const event: WebRTCEvent = { type, data, timestamp, source };
  webrtcEvents.update(events => [...events, event]);
  webrtcStatus.update(s => ({ ...s, lastEventTimestamp: timestamp }));
  return event;
}

/** Initialize WebRTC client; set up socket state and signaling listeners */
export function initWebRTCClient() {
  if (!browser) return;
  console.log('[WebRTC] Initializing client');
  cleanupFunctions.forEach(cleanup => cleanup());
  cleanupFunctions = [];

  const socketStateUnsubscribe = socketStore.subscribe(state => {
    const isConnected = state.status === 'OPEN';
    webrtcStatus.update(s => ({
      ...s,
      connected: isConnected,
      error: state.error ? state.error.message : null
    }));
    if(isConnected) {
     console.log('[WebRTC] Most likely ping', state.status); 
    }else{
      console.log('[WebRTC]', isConnected ? 'Socket connected' : 'Socket disconnected');
    }
  });
  cleanupFunctions.push(socketStateUnsubscribe);

  const cleanup = onSocketEvent('webrtc', (message: any) => {
    console.log('[WebRTC] Received from socket:', message);
    const data = message.data || message;
    if (data?.type === 'offer') {
      let pc = get(webrtcStatus).peerConnection;
      if (!pc) {
        console.log('[WebRTC] No peer connection; creating one...');
        pc = createPeerConnection();
        createDataChannel(pc, 'data-channel');
      }
      handleIncomingMessage(data, pc);
    }
  });
  if (cleanup) cleanupFunctions.push(cleanup);

  return () => {
    cleanupFunctions.forEach(cleanup => cleanup());
    cleanupFunctions = [];
  };
}

/** Send a signaling message via socket */
export function sendWebRTCMessage(type: string, data: any) {
  const message = { type, ...data };
  socketStore.send('webrtc', message);
  addEvent(type as WebRTCEventType, message, 'local');
}

/** Handle incoming signaling messages to update the peer connection */
function handleIncomingMessage(message: any, peerConnection: RTCPeerConnection): void {
  if (!message?.type) return;
  switch (message.type) {
    case 'offer':
      if (message.sdp) {
        console.log('[WebRTC] Setting remote description from offer');
        peerConnection.setRemoteDescription({ type: 'offer', sdp: message.sdp })
          .then(() => {
            console.log('[WebRTC] Creating answer...');
            return peerConnection.createAnswer();
          })
          .then(answer => {
            console.log('[WebRTC] Setting local description from answer');
            return peerConnection.setLocalDescription(answer);
          })
          .then(() => {
            console.log('[WebRTC] Sending answer...');
            if (peerConnection.localDescription)
              sendWebRTCMessage('answer', { sdp: peerConnection.localDescription.sdp });
          })
          .catch(error => console.error('[WebRTC] Error handling offer:', error));
      }
      break;
    case 'answer':
      if (message.sdp) {
        console.log('[WebRTC] Setting remote description from answer');
        peerConnection.setRemoteDescription({ type: 'answer', sdp: message.sdp })
          .catch(error => console.error('[WebRTC] Error setting remote description:', error));
      }
      break;
    case 'ice-candidate':
      if (message.candidate) {
        console.log('[WebRTC] Adding ICE candidate');
        peerConnection.addIceCandidate({ candidate: message.candidate, sdpMid: message.sdpMid, sdpMLineIndex: message.sdpMLineIndex })
          .catch(error => console.error('[WebRTC] Error adding ICE candidate:', error));
      }
      break;
    case 'data-channel-message':
      console.log('[WebRTC] Received data channel message:', message);
      break;
    default:
      console.log(`[WebRTC] Unhandled message type: ${message.type}`);
  }
}

/** Create a new PeerConnection and set up its event handlers */
export function createPeerConnection(): RTCPeerConnection | null {
  if (!browser) return null;
  try {
    const configuration = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
    const pc = new RTCPeerConnection(configuration);
    webrtcStatus.update(s => ({ ...s, peerConnection: pc }));

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('[WebRTC] New ICE candidate:', event.candidate);
        sendWebRTCMessage('ice-candidate', {
          candidate: event.candidate.candidate,
          sdpMid: event.candidate.sdpMid,
          sdpMLineIndex: event.candidate.sdpMLineIndex
        });
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log('[WebRTC] ICE connection state:', pc.iceConnectionState);
    };

    pc.ondatachannel = (event) => {
      console.log('[WebRTC] Data channel received:', event.channel.label);
      setupDataChannel(event.channel);
    };

    pc.ontrack = (event) => {
      if (event.track.kind === 'video') {
        console.log('[WebRTC:Video] Received video track:', event.track);
        console.log('[WebRTC:Video] Stream:', event.streams[0]);
        videoStream.set(event.streams[0]);
      }
    };

    return pc;
  } catch (error) {
    console.error('[WebRTC] Error creating peer connection:', error);
    return null;
  }
}

/** Create a data channel on the given PeerConnection */
export function createDataChannel(peerConnection: RTCPeerConnection | null = null, label = 'test-channel'): RTCDataChannel | null {
  if (!peerConnection) {
    peerConnection = get(webrtcStatus).peerConnection;
  }
  if (!peerConnection) {
    console.error('[WebRTC] Cannot create data channel: No peer connection');
    return null;
  }
  try {
    const dc = peerConnection.createDataChannel(label, { ordered: true });
    setupDataChannel(dc);
    return dc;
  } catch (error) {
    console.error('[WebRTC] Error creating data channel:', error);
    return null;
  }
}

/** Set up event handlers for a data channel */
function setupDataChannel(dataChannel: RTCDataChannel): void {
  webrtcStatus.update(s => ({ ...s, dataChannel, dataChannelState: dataChannel.readyState as 'connecting' | 'open' | 'closing' | 'closed' }));
  dataChannel.onopen = () => {
    console.log(`[WebRTC] Data channel '${dataChannel.label}' opened`);
    webrtcStatus.update(s => ({ ...s, dataChannelState: 'open' }));
    addEvent('data-channel-open', { label: dataChannel.label, channelId: dataChannel.id }, 'local');
  };
  dataChannel.onclose = () => {
    console.log(`[WebRTC] Data channel '${dataChannel.label}' closed`);
    webrtcStatus.update(s => ({ ...s, dataChannelState: 'closed' }));
    addEvent('data-channel-close', { label: dataChannel.label, channelId: dataChannel.id }, 'local');
  };
  dataChannel.onmessage = (event) => {
    console.log(`[WebRTC] Message on '${dataChannel.label}':`, event.data);
    try {
      const parsed = JSON.parse(event.data);
      const eventData = { label: dataChannel.label, channelId: dataChannel.id, data: parsed };
      addEvent('data-channel-message', eventData, 'remote');
    } catch (error) {
      addEvent('data-channel-message', { label: dataChannel.label, channelId: dataChannel.id, data: { text: event.data } }, 'remote');
    }
  };
  dataChannel.onerror = (error) => {
    console.error(`[WebRTC] Data channel '${dataChannel.label}' error:`, error);
  };
}

/** Send a message via the data channel */
export function sendDataChannelMessage(message: any): boolean {
  const { dataChannel, dataChannelState } = get(webrtcStatus);
  if (!dataChannel || dataChannelState !== 'open') {
    console.error('[WebRTC] Data channel not open');
    return false;
  }
  try {
    const messageString = typeof message === 'object' ? JSON.stringify(message) : message;
    dataChannel.send(messageString);
    addEvent('data-channel-message', { label: dataChannel.label, channelId: dataChannel.id, data: message }, 'local');
    return true;
  } catch (error) {
    console.error('[WebRTC] Error sending message:', error);
    return false;
  }
}

/** Create an SDP offer and send it via signaling */
export async function createAndSendOffer(): Promise<boolean> {
  const { peerConnection } = get(webrtcStatus);
  if (!peerConnection) {
    console.error('[WebRTC] No peer connection');
    return false;
  }
  try {
    if (!get(webrtcStatus).dataChannel) createDataChannel();
    const offerOptions: RTCOfferOptions = { offerToReceiveAudio: true, offerToReceiveVideo: true };
    const offer = await peerConnection.createOffer(offerOptions);
    console.log('[WebRTC] Created offer SDP:', offer.sdp);
    if (offer.sdp) {
      offer.sdp = preferH264(offer.sdp);
      console.log('[WebRTC] Modified offer SDP:', offer.sdp);
    }
    await peerConnection.setLocalDescription(offer);
    sendWebRTCMessage('offer', { sdp: offer.sdp });
    return true;
  } catch (error) {
    console.error('[WebRTC] Error creating/sending offer:', error);
    return false;
  }
}

/** Adjust the SDP to prioritize H.264 codecs */
function preferH264(sdp: string): string {
  const videoMediaSection = sdp.match(/m=video [\d\s\w\/]+/g);
  if (!videoMediaSection) {
    console.log('[WebRTC] No video media section in SDP');
    return sdp;
  }
  const lines = sdp.split('\r\n');
  const videoMLineIndex = lines.findIndex(line => line.startsWith('m=video'));
  if (videoMLineIndex === -1) {
    console.log('[WebRTC] No m=video line in SDP');
    return sdp;
  }
  const h264PayloadTypes: string[] = [];
  for (let i = videoMLineIndex; i < lines.length; i++) {
    const line = lines[i];
    if (i > videoMLineIndex && line.startsWith('m=')) break;
    if (line.startsWith('a=rtpmap:') && line.includes('H264')) {
      const payloadType = line.split(':')[1].split(' ')[0];
      h264PayloadTypes.push(payloadType);
      console.log(`[WebRTC] Found H.264 payload type ${payloadType}`);
    }
  }
  if (h264PayloadTypes.length > 0) {
    const mLine = lines[videoMLineIndex];
    const parts = mLine.split(' ');
    const newParts = parts.slice(0, 3);
    newParts.push(...h264PayloadTypes);
    for (let i = 3; i < parts.length; i++) {
      if (!h264PayloadTypes.includes(parts[i])) {
        newParts.push(parts[i]);
      }
    }
    lines[videoMLineIndex] = newParts.join(' ');
    console.log('[WebRTC] Updated m=video line to prioritize H.264');
  }
  return lines.join('\r\n');
}

/** Return the latest events of an optional type (up to a limit) */
export function getLatestEvents(type: WebRTCEventType | null = null, limit = 10): WebRTCEvent[] {
  const events = get(webrtcEvents);
  const filtered = type ? events.filter(event => event.type === type) : events;
  return filtered.sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);
}

/** Clear all events */
export function clearEvents(): void {
  webrtcEvents.set([]);
}

/** Handle incoming media tracks */
function handleIncomingTracks(event: any): void {
  console.log('[WebRTC] Track received:', event.track.kind);
  if (event.track.kind === 'video') {
    console.log('[WebRTC] Video track:', event.track);
    webrtcStatus.update(s => ({ ...s, hasVideoTrack: true, videoTrackState: 'receiving' }));
    event.track.onended = () => {
      console.log('[WebRTC] Video track ended');
      webrtcStatus.update(s => ({ ...s, videoTrackState: 'ended' }));
    };
    event.track.onmute = () => console.log('[WebRTC] Video track muted');
    event.track.onunmute = () => {
      console.log('[WebRTC] Video track unmuted');
      webrtcStatus.update(s => ({ ...s, videoTrackState: 'active' }));
    };
    if (event.streams && event.streams[0]) {
      const vs = event.streams[0];
      console.log('[WebRTC] Emitting video stream');
      webrtcStatus.update(s => ({ ...s, videoStream: vs, videoTrackState: 'active' }));
      addEvent('video-stream', { streamId: vs.id, trackId: event.track.id, trackState: event.track.readyState });
    } else {
      console.warn('[WebRTC] Video track received but no stream attached');
    }
  }
}
