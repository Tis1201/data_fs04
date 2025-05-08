// -----------------------------------------------------------------------------
//  WebRTCClient.ts – drop‑in replacement you can import directly in +page.svelte
// -----------------------------------------------------------------------------
//  ▸ Handles signalling over your existing `socketStore`
//  ▸ Automatically restarts ICE or the whole peer‑connection when needed
//  ▸ Exposes a helper `createClientMessage` identical to the one you used before
// -----------------------------------------------------------------------------

import { socketStore } from "$lib/stores/websocket-store";
import { webRTCStore } from "$lib/stores/webrtc-store";
import type {
  WebRTCMessage,
  DataChannelMessage,
} from "$lib/stores/webrtc-store";

/* -------------------------------------------------------------------------- */
/*  Utility                                                                   */
/* -------------------------------------------------------------------------- */

export function createClientMessage(
  type: string,
  scope: string,
  payload: Record<string, unknown>,
) {
  return {
    type,
    scope: `subscription:${scope}`,
    payload: {
      ...payload,
      timestamp: new Date().toISOString(),
      _clientMessageId: `${type}-${Date.now().toString(36)}-${Math.random()
        .toString(36)
        .slice(2, 8)}`,
    },
  };
}

/* -------------------------------------------------------------------------- */
/*  WebRTC client                                                             */
/* -------------------------------------------------------------------------- */

export class WebRTCClient {
  private peerConnection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private terminalCallback: ((msg: string) => void) | null = null;
  private reconnectAttempts = 0;
  private disconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private deviceId: string) {}

  /* ------------------------------ callbacks --------------------------------- */
  setTerminalCallback(cb: (msg: string) => void) {
    this.terminalCallback = cb;
  }

  /* -------------------------- signalling helpers --------------------------- */
  private sendSignal(msg: Record<string, unknown>) {
    socketStore.send(msg);
  }

  private push(msg: string) {
    this.terminalCallback?.(msg);
  }

  /* -------------------------- peer‑connection ------------------------------ */
  private buildPeerConnection() {
    if (this.peerConnection) this.peerConnection.close();

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    /* ---------- local ICE ---------- */
    pc.onicecandidate = (e) => {
      if (!e.candidate) return;
      if (pc.iceConnectionState === "connected") return; // no spam

      this.sendSignal(
        createClientMessage("device", `device:${this.deviceId}`, {
          action: "message",
          type: "webrtc:ice-candidate",
          deviceId: this.deviceId,
          candidate: e.candidate.toJSON(),
        }),
      );
    };

    /* ---------- ICE state changes ---------- */
    pc.oniceconnectionstatechange = () => {
      const s = pc.iceConnectionState;
      console.log("[WebRTC] ice state", s);
      if (s === "connected" || s === "completed") {
        clearTimeout(this.disconnectTimer as unknown as number);
        this.reconnectAttempts = 0;
        webRTCStore.update((st) => ({ ...st, connectionStatus: "connected" }));
      } else if (s === "disconnected") {
        this.disconnectTimer = setTimeout(() => this.recover(), 4000);
      } else if (s === "failed") {
        this.recover(true);
      }
    };

    /* ---------- remote data‑channel ---------- */
    pc.ondatachannel = (evt) => this.attachDataChannel(evt.channel);

    this.peerConnection = pc;
  }

  private attachDataChannel(dc: RTCDataChannel) {
    this.dataChannel = dc;
    dc.onopen = () =>
      webRTCStore.update((s) => ({ ...s, dataChannelStatus: "open" }));
    dc.onclose = () =>
      webRTCStore.update((s) => ({ ...s, dataChannelStatus: "closed" }));
    dc.onmessage = (ev) => console.log("[WebRTC] data", ev.data);
  }

  /* ------------------------ outward API ----------------------------------- */
  connect() {
    this.buildPeerConnection();
    this.sendSignal(
      createClientMessage("device", `device:${this.deviceId}`, {
        action: "message",
        type: "webrtc:connect",
        deviceId: this.deviceId,
      }),
    );
    this.push("\r\n\x1b[1;32mWebRTC connection request sent!\x1b[0m\r\n");
  }

  cleanup() {
    this.dataChannel?.close();
    this.peerConnection?.close();
    this.peerConnection = null;
  }

  /* --------------------- handle incoming messages -------------------------- */
  handleWebRTCMessage(msg: WebRTCMessage) {
    if (msg.deviceId && msg.deviceId !== this.deviceId) return;

    if (!this.peerConnection) this.buildPeerConnection();
    const pc = this.peerConnection!;

    switch (msg.type) {
      case "webrtc:offer":
        pc.setRemoteDescription({ type: "offer", sdp: msg.sdp })
          .then(() => pc.createAnswer())
          .then((ans) => pc.setLocalDescription(ans))
          .then(() => {
            this.sendSignal(
              createClientMessage("device", `device:${this.deviceId}`, {
                action: "message",
                type: "webrtc:answer",
                deviceId: this.deviceId,
                sdp: pc.localDescription!.sdp,
              }),
            );
          });
        break;
      case "webrtc:answer":
        if (pc.signalingState === "have-local-offer")
          pc.setRemoteDescription({ type: "answer", sdp: msg.sdp });
        break;
      case "webrtc:ice-candidate":
        if (msg.candidate?.candidate)
          pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
        break;
    }
  }

  /* --------------------------- recovery ----------------------------------- */
  private recover(full = false) {
    if (full) {
      this.reconnectAttempts += 1;
      if (this.reconnectAttempts > 5) return;
      this.connect();
    } else {
      this.peerConnection?.restartIce();
    }
  }
}
