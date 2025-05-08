// -----------------------------------------------------------------------------
//  WebRTCClient.ts – Resilient client with active keep‑alive and auto‑re‑sync  
// -----------------------------------------------------------------------------
//  ▸ Works with socketStore / webRTCStore (SvelteKit + Vite)                   
//  ▸ Grace‑period for transient “disconnected” flips (4 s)                    
//  ▸ Automatic ICE‑restart, then full back‑off reconnect if needed            
//  ▸ Lightweight data‑channel keep‑alive (ping / pong every 10 s)             
//  ▸ Exports helper:  createClientMessage()                                   
// -----------------------------------------------------------------------------

import { socketStore } from "$lib/stores/websocket-store";
import { webRTCStore } from "$lib/stores/webrtc-store";
import type {
  WebRTCMessage,
  DataChannelMessage,
} from "$lib/stores/webrtc-store";

/* -------------------------------------------------------------------------- */
/*  Helper                                                                     */
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
  } as const;
}

/* -------------------------------------------------------------------------- */
/*  WebRTC client                                                              */
/* -------------------------------------------------------------------------- */
export class WebRTCClient {
  private pc: RTCPeerConnection | null = null;
  private dc: RTCDataChannel | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private disconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private terminalCB: ((m: string) => void) | null = null;

  constructor(private deviceId: string) {}

  /* ---------------- public API ------------------------------------------- */
  setTerminalCallback(cb: (s: string) => void) {
    this.terminalCB = cb;
  }

  connect() {
    this.buildPeer();
    this.signal(
      createClientMessage("device", `device:${this.deviceId}`, {
        action: "message",
        type: "webrtc:connect",
        deviceId: this.deviceId,
      }),
    );
    this.log("\r\n\x1b[1;32mWebRTC connect request sent\x1b[0m\r\n");
  }

  cleanup() {
    this.stopPing();
    this.dc?.close();
    this.pc?.close();
    this.pc = null;
  }

  /* ---------------- signalling dispatcher -------------------------------- */
  handleWebRTCMessage(msg: WebRTCMessage) {
    if (msg.deviceId && msg.deviceId !== this.deviceId) return;
    if (!this.pc) this.buildPeer();
    const pc = this.pc!;

    switch (msg.type) {
      case "webrtc:offer":
        pc.setRemoteDescription({ type: "offer", sdp: msg.sdp })
          .then(() => pc.createAnswer())
          .then((ans) => pc.setLocalDescription(ans))
          .then(() => {
            this.signal(
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

  /* ---------------------------------------------------------------------- */
  /*  Internals                                                              */
  /* ---------------------------------------------------------------------- */

  private buildPeer() {
    // fresh pc every time – simpler than untangling old handlers
    this.stopPing();
    this.pc?.close();

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    /* ---------- local ICE candidates ------------- */
    pc.onicecandidate = (e) => {
      if (!e.candidate) return;
      if (pc.iceConnectionState === "connected") return; // don't spam when stable
      this.signal(
        createClientMessage("device", `device:${this.deviceId}`, {
          action: "message",
          type: "webrtc:ice-candidate",
          deviceId: this.deviceId,
          candidate: e.candidate.toJSON(),
        }),
      );
    };

    /* ---------- connection state ----------------- */
    pc.oniceconnectionstatechange = () => {
      const s = pc.iceConnectionState;
      console.log("[WebRTC] ice state", s);
      switch (s) {
        case "connected":
        case "completed":
          clearTimeout(this.disconnectTimer as unknown as number);
          this.disconnectTimer = null;
          this.reconnectAttempts = 0;
          webRTCStore.update((st) => ({ ...st, connectionStatus: "connected" }));
          this.startPing();
          break;

        case "disconnected":
          if (!this.disconnectTimer) {
            this.disconnectTimer = setTimeout(() => this.attemptRecovery(), 4000);
          }
          break;

        case "failed":
          this.attemptRecovery(true);
          break;
      }
    };

    /* ---------- remote tracks -------------------- */
    pc.ontrack = (ev) => {
      if (ev.streams[0])
        webRTCStore.update((s) => ({ ...s, videoStream: ev.streams[0] }));
    };

    /* ---------- data‑channel --------------------- */
    pc.ondatachannel = (ev) => this.attachDC(ev.channel);

    this.pc = pc;
    webRTCStore.update((s) => ({ ...s, peerConnection: pc }));
  }

  private attachDC(dc: RTCDataChannel) {
    this.dc = dc;

    dc.onopen = () => {
      webRTCStore.update((s) => ({ ...s, dataChannelStatus: "open" }));
      this.startPing();
    };

    dc.onclose = () => {
      webRTCStore.update((s) => ({ ...s, dataChannelStatus: "closed" }));
      this.stopPing();
    };

    dc.onmessage = (ev) => {
      try {
        const m: DataChannelMessage = JSON.parse(ev.data);
        if (m.type === "ping") {
          this.dc?.send(JSON.stringify({ type: "pong", echo: m.timestamp }));
          return;
        }
      } catch {/* plain text – ignore */}
      console.log("[WebRTC] data", ev.data);
    };
  }

  /* ---------- keep‑alive ping ------------------- */
  private startPing() {
    this.stopPing();
    if (!this.dc) return;
    this.pingTimer = setInterval(() => {
      if (this.dc && this.dc.readyState === "open") {
        this.dc.send(
          JSON.stringify({ type: "ping", timestamp: Date.now() }),
        );
      }
    }, 10000);
  }
  private stopPing() {
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.pingTimer = null;
  }

  /* ---------- recovery logic -------------------- */
  private attemptRecovery(full = false) {
    if (full) {
      this.reconnectAttempts += 1;
      if (this.reconnectAttempts > 5) return;
      console.warn("[WebRTC] ICE failed – full reconnect", this.reconnectAttempts);
      this.connect();
    } else if (this.pc) {
      console.warn("[WebRTC] ICE disconnected – restarting ICE");
      this.pc.restartIce();
    }
  }

  /* ---------- misc helpers ---------------------- */
  private signal(obj: Record<string, unknown>) {
    socketStore.send(obj);
  }

  private log(m: string) {
    this.terminalCB?.(m);
  }
}
