# NVR with WebRTC Streaming Architecture

## Overview

This document outlines the architecture and implementation of a high-performance Network Video Recorder (NVR) system with WebRTC streaming capabilities. The system is designed to handle video ingest, processing, and browser-based streaming with a clean separation of concerns.

## System Architecture

### 1. Core Components

#### NVR Core (C++)
- Handles camera ingest using FFmpeg/libav
- Manages video decoding/encoding pipelines
- Implements recording and storage
- Performs analytics (CUDA/OpenVINO)
- Exposes raw RTP or encoded H.264 streams

#### WebRTC Gateway (Go / Pion)
- Runs as a separate binary/service
- Wraps RTP input into WebRTC PeerConnections
- Handles WebRTC protocols:
  - Signaling (WebSocket)
  - ICE (STUN/TURN)
  - DTLS-SRTP encryption
  - NACK/PLI/RTCP feedback
- Manages browser connections

#### Control Plane (ZeroRPC)
- Lightweight RPC over ZeroMQ
- Enables communication between NVR and WebRTC gateway
- Handles control messages:
  - Stream start/stop
  - Keyframe requests
  - Viewer count updates
  - Health monitoring

### 2. Data Flow

1. **Ingest**: NVR Core captures and processes video streams
   ```
   Camera → FFmpeg → NVR Core → RTP (local UDP)
   ```

2. **Streaming**: WebRTC Gateway forwards RTP to browsers
   ```
   RTP (UDP) → Pion → WebRTC → Browser
   ```

3. **Control**: ZeroRPC coordinates between components
   ```
   NVR Core ⇄ ZeroMQ ⇄ WebRTC Gateway
   ```

### 3. Benefits

- **Separation of Concerns**:
  - C++ focuses on video processing and analytics
  - Go/Pion handles WebRTC complexity
  - Clear interfaces between components

- **Deployment**:
  - Single binary deployment (NVR + Gateway)
  - Easy cross-compilation
  - Modular design allows component replacement

- **Performance**:
  - Low-latency streaming
  - Efficient resource usage
  - Scalable architecture

## WebRTC Implementation Details

The following sections detail the WebRTC-specific implementation using Pion in Go.

## Architecture Overview

1. **Signaling Server**: WebSocket-based signaling for WebRTC handshake
2. **Media Server**: Handles WebRTC peer connections and media streaming
3. **Client**: Web-based interface for viewing streams

## Key Components

### 1. WebRTC Peer Connection Setup

The WebRTC peer connection is established with the following configuration:

```go
// Create a new WebRTC PeerConnection with STUN server
peerConnection, err := webrtc.NewPeerConnection(webrtc.Configuration{
    ICEServers: []webrtc.ICEServer{{
        URLs: []string{"stun:stun.l.google.com:19302"},
    }},
})

// Set up ICE candidate handling
peerConnection.OnICECandidate(func(c *webrtc.ICECandidate) {
    if c != nil {
        ice := c.ToJSON()
        log.Println("New ICE Candidate:", ice.Candidate)
        sendSignalingMessage(SignalMessage{
            Type: "webrtc",
            Data: SignalData{
                Type: "candidate",
                Candidate: Candidate{
                    Candidate:     ice.Candidate,
                    SDPMid:        ice.SDPMid,
                    SDPMLineIndex: ice.SDPMLineIndex,
                },
            },
        })
    }
})
```

### 2. Video Track Setup

```go
// Create a local video track using H.264
videoTrack, err := webrtc.NewTrackLocalStaticRTP(
    webrtc.RTPCodecCapability{MimeType: webrtc.MimeTypeH264}, 
    "video", 
    "pion",
)

// Add track to peer connection
rtpSender, err := peerConnection.AddTrack(videoTrack)

// Read incoming RTCP packets
go func() {
    rtcpBuf := make([]byte, 1500)
    for {
        if _, _, err := rtpSender.Read(rtcpBuf); err != nil {
            return
        }
    }
}()
```

### 3. SDP Offer/Answer Exchange

```go
// Create and send offer
offer, err := peerConnection.CreateOffer(nil)

// Wait for ICE gathering to complete
gatherComplete := webrtc.GatheringCompletePromise(peerConnection)
if err = peerConnection.SetLocalDescription(offer); err != nil {
    log.Fatal("Failed to set local description:", err)
}
<-gatherComplete

// Send offer through signaling channel
sendSignalingMessage(SignalMessage{
    Type: "webrtc",
    Data: SignalData{
        Type: "offer",
        SDP:  peerConnection.LocalDescription().SDP,
    },
})
```

### 4. RTP Packet Handling

```go
// Open UDP socket for RTP packets
listener, err := net.ListenUDP("udp", 
    &net.UDPAddr{IP: net.ParseIP("0.0.0.0"), Port: rtpPort})

// Read and forward RTP packets to WebRTC track
inboundRTPPacket := make([]byte, 1600)
for {
    n, _, err := listener.ReadFrom(inboundRTPPacket)
    if err != nil {
        log.Printf("RTP Read Error: %s", err)
        continue
    }
    if _, err = videoTrack.Write(inboundRTPPacket[:n]); err != nil {
        if errors.Is(err, io.ErrClosedPipe) {
            return // Peer disconnected
        }
        log.Printf("Failed to write RTP packet: %v", err)
    }
}
```

### 2. Data Channel Setup

```go
// Create a data channel for text messaging
dataChannel, err = peerConnection.CreateDataChannel("chat", nil)
dataChannel.OnOpen(func() {
    log.Println("Data channel opened")
    // Handle data channel open
})

dataChannel.OnMessage(func(msg webrtc.DataChannelMessage) {
    if msg.IsString {
        log.Printf("Received message: %s", string(msg.Data))
    }
})
```

### 3. Video Streaming with FFmpeg

The system uses FFmpeg to stream video to WebRTC peers. Here's the streaming command used in the test script:

```bash
ffmpeg -stream_loop -1 -re \
  -i input.mp4 \
  -c:v libx264 \
  -b:v 2500k -maxrate 5000k -bufsize 5000k \
  -g 50 -keyint_min 50 -sc_threshold 0 -preset veryfast \
  -tune zerolatency -movflags +faststart \
  -an -f rtp rtp://127.0.0.1:5004
```

### 4. Signaling Protocol

Signaling messages are exchanged using WebSocket with the following format:

```go
type SignalMessage struct {
    Type      string     `json:"type"`
    Data      SignalData `json:"data"`
    Timestamp string     `json:"timestamp,omitempty"`
}

type SignalData struct {
    Type      string    `json:"type"`
    SDP       string    `json:"sdp,omitempty"`
    Candidate Candidate `json:"candidate,omitempty"`
    Timestamp string    `json:"timestamp,omitempty"`
}
```

## Video Streaming Flow

1. **Offer/Answer Exchange**:
   - Client creates an offer
   - Server receives offer and creates answer
   - Answer is sent back to client

2. **ICE Candidate Exchange**:
   - Both peers gather ICE candidates
   - Candidates are exchanged via the signaling channel
   - Connections are established between peers

3. **Media Streaming**:
   - FFmpeg streams video to local RTP port (5004)
   - Pion WebRTC forwards RTP packets to connected peers
   - Data channel remains open for control messages

## Testing

To test the WebRTC streaming:

```bash
# Start the WebRTC server
cd support/webrtc
go run main.go

# In another terminal, start the FFmpeg stream
./tests/test_stream_mac.sh
```

## Performance Considerations

- **Latency**: Uses `-tune zerolatency` for minimal delay
- **Bandwidth**: Configurable bitrate (2500k target, 5000k max)
- **Keyframes**: Forced every 50 frames for better seeking
- **CPU**: Uses `veryfast` preset for good performance on most hardware

## Handling Multiple Streams

To handle multiple incoming WebRTC streams, you'll need to manage multiple peer connections and tracks. Here's how to modify the setup:

### 1. Track Management

```go
type Stream struct {
    ID          string
    PeerConn    *webrtc.PeerConnection
    VideoTrack  *webrtc.TrackLocalStaticRTP
    AudioTrack  *webrtc.TrackLocalStaticRTP // Optional audio track
    RTPListener net.PacketConn
}

var activeStreams = make(map[string]*Stream)
```

### 2. Creating Multiple Streams

```go
func createNewStream(streamID string) (*Stream, error) {
    // Create peer connection
    peerConnection, err := webrtc.NewPeerConnection(webrtc.Configuration{
        ICEServers: []webrtc.ICEServer{{URLs: []string{"stun:stun.l.google.com:19302"}}},
    })
    if err != nil {
        return nil, err
    }

    // Create video track
    videoTrack, err := webrtc.NewTrackLocalStaticRTP(
        webrtc.RTPCodecCapability{MimeType: webrtc.MimeTypeH264},
        "video",
        streamID,
    )
    if err != nil {
        return nil, err
    }

    // Add video track to peer connection
    rtpSender, err := peerConnection.AddTrack(videoTrack)
    if err != nil {
        return nil, err
    }

    // Create and store stream
    stream := &Stream{
        ID:         streamID,
        PeerConn:   peerConnection,
        VideoTrack: videoTrack,
    }

    // Set up ICE candidate handling
    peerConnection.OnICECandidate(createICECandidateHandler(streamID))
    
    // Set up connection state change handling
    peerConnection.OnConnectionStateChange(func(s webrtc.PeerConnectionState) {
        log.Printf("Stream %s connection state: %s", streamID, s.String())
        if s == webrtc.PeerConnectionStateFailed || s == webrtc.PeerConnectionStateClosed {
            // Clean up when connection is closed
            if stream, exists := activeStreams[streamID]; exists {
                stream.PeerConn.Close()
                if stream.RTPListener != nil {
                    stream.RTPListener.Close()
                }
                delete(activeStreams, streamID)
            }
        }
    })

    // Start reading RTCP packets
    go readRTCP(rtpSender, streamID)
    
    activeStreams[streamID] = stream
    return stream, nil
}
```

### 3. Handling Multiple RTP Streams

```go
func startRTPListener(streamID string, port int) error {
    stream, exists := activeStreams[streamID]
    if !exists {
        return fmt.Errorf("stream %s not found", streamID)
    }

    // Open UDP port for RTP
    listener, err := net.ListenUDP("udp", &net.UDPAddr{
        IP:   net.ParseIP("0.0.0.0"),
        Port: port,
    })
    if err != nil {
        return err
    }
    
    stream.RTPListener = listener

    // Handle incoming RTP packets
    go func() {
        buffer := make([]byte, 1600) // MTU size
        for {
            n, _, err := listener.ReadFrom(buffer)
            if err != nil {
                if !errors.Is(err, net.ErrClosed) {
                    log.Printf("RTP read error for stream %s: %v", streamID, err)
                }
                return
            }
            
            // Write to the appropriate track
            if _, err := stream.VideoTrack.Write(buffer[:n]); err != nil {
                if !errors.Is(err, io.ErrClosedPipe) {
                    log.Printf("Failed to write RTP packet for stream %s: %v", streamID, err)
                }
                return
            }
        }
    }()
    
    return nil
}
```

### 4. Managing Multiple Peer Connections

```go
// Create a new stream handler
func handleNewStream(streamID string, offer webrtc.SessionDescription) (*webrtc.SessionDescription, error) {
    stream, err := createNewStream(streamID)
    if err != nil {
        return nil, err
    }

    // Set remote description
    if err := stream.PeerConn.SetRemoteDescription(offer); err != nil {
        return nil, err
    }

    // Create answer
    answer, err := stream.PeerConn.CreateAnswer(nil)
    if err != nil {
        return nil, err
    }

    // Set local description
    gatherComplete := webrtc.GatheringCompletePromise(stream.PeerConn)
    if err = stream.PeerConn.SetLocalDescription(answer); err != nil {
        return nil, err
    }
    <-gatherComplete

    // Start RTP listener on a unique port
    port := 5004 + len(activeStreams) // Simple port assignment strategy
    if err := startRTPListener(streamID, port); err != nil {
        return nil, err
    }

    return stream.PeerConn.LocalDescription(), nil
}
```

### 5. Cleanup

```go
func removeStream(streamID string) {
    if stream, exists := activeStreams[streamID]; exists {
        if stream.PeerConn != nil {
            stream.PeerConn.Close()
        }
        if stream.RTPListener != nil {
            stream.RTPListener.Close()
        }
        delete(activeStreams, streamID)
    }
}
```

## Security and Signaling Requirements

WebRTC requires successful signaling before any media streaming can occur. Here's how security is enforced:

### 1. Signaling Prerequisites

- **Mandatory SDP Exchange**:
  ```go
  // Both offer and answer must be exchanged before connection
  offer, err := peerConnection.CreateOffer(nil)
  // ... set local description
  // Send offer to remote peer
  
  // Remote peer must create and send back an answer
  answer, err := peerConnection.CreateAnswer(nil)
  // ... set remote description with the answer
  ```

- **ICE Candidate Exchange**:
  ```go
  peerConnection.OnICECandidate(func(c *webrtc.ICECandidate) {
      if c != nil {
          // Must exchange ICE candidates for NAT traversal
          sendSignalingMessage(SignalMessage{
              Type: "candidate",
              Candidate: c.ToJSON(),
          })
      }
  })
  ```

### 2. Connection State Flow

1. **Signaling State**: Must be "stable" before creating offers/answers
2. **ICE Gathering**: Must complete before sending offers
3. **Connection State**: Media only flows when state is "connected"

```go
peerConnection.OnConnectionStateChange(func(s webrtc.PeerConnectionState) {
    log.Printf("Connection State: %s", s.String())
    switch s {
    case webrtc.PeerConnectionStateConnected:
        // Media can now flow
    case webrtc.PeerConnectionStateFailed:
        // Handle failure
    }
})
```

### 3. Security Implications

- **No Direct Connections** without successful signaling
- **Authentication Required** at signaling layer
- **Media Encryption**: All WebRTC media is encrypted using DTLS-SRTP

## Complete Streaming Flow: FFmpeg → Pion → Browser

### 1. FFmpeg to Pion (RTP Streaming)

FFmpeg encodes and streams video to Pion using RTP:

```bash
# Example FFmpeg command streaming H.264 video to Pion
ffmpeg -i input.mp4 \
  -c:v libx264 -profile:v high -level 4.2 \
  -preset veryfast -tune zerolatency \
  -f rtp rtp://127.0.0.1:5004
```

### 2. Pion's Role (RTP to WebRTC Bridge)

Pion acts as a bridge between RTP and WebRTC:

```go
// 1. Create RTP listener
listener, _ := net.ListenPacket("udp", "0.0.0.0:5004")

// 2. Forward RTP to WebRTC track
go func() {
    buf := make([]byte, 1600) // Standard MTU size
    for {
        n, _, err := listener.ReadFrom(buf)
        if err != nil {
            log.Printf("RTP read error: %v", err)
            continue
        }
        
        // Forward to WebRTC track
        if _, err := videoTrack.Write(buf[:n]); err != nil {
            if !errors.Is(err, io.ErrClosedPipe) {
                log.Printf("Failed to forward RTP: %v", err)
            }
            return
        }
    }
}()
```

### 3. WebRTC Connection Handling

Pion manages the WebRTC connection to the browser:

```go
// Create peer connection with appropriate codecs
peerConnection, _ := webrtc.NewPeerConnection(webrtc.Configuration{
    ICEServers: []webrtc.ICEServer{
        {URLs: []string{"stun:stun.l.google.com:19302"}},
    },
})

// Add video track to connection
rtpSender, _ := peerConnection.AddTrack(videoTrack)

// Handle RTCP (for PLI, FIR, NACK)
go func() {
    rtcpBuf := make([]byte, 1500)
    for {
        if _, _, err := rtpSender.Read(rtcpBuf); err != nil {
            return
        }
    }
}()
```

### 4. Browser-Side Handling

The browser receives and renders the WebRTC stream:

```javascript
// In browser JavaScript
const pc = new RTCPeerConnection({
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
});

pc.ontrack = (event) => {
    // Attach media stream to video element
    document.getElementById('video').srcObject = event.streams[0];};

// Handle ICE candidates, SDP exchange, etc.
```

### 5. End-to-End Encryption

- **FFmpeg → Pion**: RTP (unencrypted on localhost)
- **Pion → Browser**: DTLS-SRTP (encrypted)
- **Signaling**: Secured via WSS (WebSocket Secure)

## Dependencies

- Pion WebRTC v3
- FFmpeg with H.264 support
- Gorilla WebSocket for signaling
- Modern web browser with WebRTC support