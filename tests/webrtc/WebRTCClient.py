import asyncio
from math import log
from aiortc import RTCPeerConnection, RTCSessionDescription, RTCIceCandidate
from typing import Callable, Optional, Dict, Any
from WebSocketClient import WebSocketClient
from loguru import logger   
from RoomClient import RoomClient

PATH_TO_VIDEO = "/Users/bernard/Documents/work/tools/dataset/body/pedestrain/v_01.mp4"

import av
from aiortc import VideoStreamTrack

class VideoFileStreamTrack(VideoStreamTrack):
    def __init__(self, path):
        super().__init__()
        self.container = av.open(path)
        self.stream = self.container.streams.video[0]
        self.frame_iter = self.container.decode(self.stream)

    async def recv(self):
        import asyncio
        frame = next(self.frame_iter, None)
        if frame is None:
            self.container.seek(0)
            self.frame_iter = self.container.decode(self.stream)
            frame = next(self.frame_iter, None)
        await asyncio.sleep(1 / float(self.stream.average_rate))
        return frame

class WebRTCClient(RoomClient):

    def __init__(self, websocket_client: WebSocketClient, room_id: str, password: str):
        super().__init__(websocket_client, room_id, password)
        self.pc = None
        self.dc = None
        self.video_sender = None

    def handle_message(self, message: dict):
        # logger.debug(f"Message received: {message}")
        super().handle_message(message)
        if message['type'] == 'webrtc':
            self.handle_webrtc_message(message)

    #Entry point
    def handle_room_joined(self, message: dict):
        logger.debug(f"Joined room: {message}")
        self.create_webrtc_connection(message)
        # Create offer
        asyncio.create_task(self.create_offer())

    def handle_webrtc_message(self, message: dict):
        """Handle WebRTC-specific messages"""
        # WebRTC message handling logic here
        logger.debug(f"WebRTC message received: {message['data']['type']}")

        data = message['data']

        if data['type'] == 'answer':
            asyncio.create_task(self.handle_answer(data))

        if data['type'] == 'ice-candidate':
            asyncio.create_task(self.handle_ice_candidate(data))
    


    async def handle_answer(self, data: dict):
        """Handle incoming WebRTC answer"""
        try:
            logger.debug(f"Handling answer: {data}")
            
            # Create RTCSessionDescription from the answer
            answer = RTCSessionDescription(sdp=data['sdp'], type='answer')
            
            # Set the remote description
            await self.pc.setRemoteDescription(answer)
            logger.debug("Set remote description successfully")
            
            # If we have a data channel, send a test message
            if self.dc and self.dc.readyState == "open":
                test_message = {
                    "text": "Hello from Python client!",
                    "timestamp": datetime.now().isoformat()
                }
                self.dc.send(json.dumps(test_message))
                logger.debug(f"Sent test message: {test_message}")
                
        except Exception as e:
            logger.error(f"Error handling answer: {str(e)}")
        

    def create_webrtc_connection(self, data):
        logger.debug(f"Creating WebRTC connection: {data}")
        self.pc = RTCPeerConnection()
        
        # Setup event handlers
        self.pc.on('icecandidate', self.handle_local_ice_candidate)
        self.pc.on('connectionstatechange', self.on_connection_state_change)
        self.pc.on('iceconnectionstatechange', self.on_ice_connection_state_change)
        
        # Add video track from file
        video_track = VideoFileStreamTrack(PATH_TO_VIDEO)
        self.video_sender = self.pc.addTrack(video_track)

        # Create data channel
        self.dc = self.pc.createDataChannel('chat')
        self.dc.on('open', self.on_datachannel_open)
        self.dc.on('message', self.on_datachannel_message)

    def on_datachannel_open(self):
        logger.debug("Data channel opened")

    def on_datachannel_message(self, message):
        logger.debug(f"Received message: {message}")
        #echo back
        if self.dc.readyState == "open":
            self.dc.send(message)
        else:
            logger.warning("Data channel not open, cannot send")
               
    def on_connection_state_change(self):
        logger.debug(f"Connection state changed: {self.pc.connectionState}")

    def on_ice_connection_state_change(self):
        logger.debug(f"ICE connection state changed: {self.pc.iceConnectionState}")

    async def create_offer(self):
        """Create and send an offer"""
        try:
            offer = await self.pc.createOffer()
            await self.pc.setLocalDescription(offer)
            
            # Send offer through WebSocket
            await self.websocket_client.send({
                'type': 'webrtc',
                'action': 'offer',
                'data': {
                    'sdp': offer.sdp,
                    'type': offer.type
                }
            })
        except Exception as e:
            logger.error(f"Error creating offer: {str(e)}")

   
    async def handle_local_ice_candidate(self, event):
        """Send local ICE candidate to remote peer via signaling server, with timestamp and message ID."""
        try:
            if event.candidate:
                from datetime import datetime
                import uuid
                candidate_data = {
                    "candidate": event.candidate.candidate,
                    "sdpMid": event.candidate.sdpMid,
                    "sdpMLineIndex": event.candidate.sdpMLineIndex,
                }
                timestamp = datetime.now().isoformat()
                message_id = f"ice-candidate-{timestamp}-{uuid.uuid4()}"
                # Track sent message IDs to avoid processing our own
                if not hasattr(self, 'sent_message_ids'):
                    self.sent_message_ids = set()
                self.sent_message_ids.add(message_id)
                await self.websocket_client.send({
                    "type": "webrtc",
                    "action": "ice-candidate",
                    "data": {
                        "candidate": candidate_data,
                        "timestamp": timestamp,
                        "_clientMessageId": message_id
                    }
                })
                logger.debug(f"Sent local ICE candidate: {candidate_data} (ID: {message_id})")
        except Exception as e:
            logger.error(f"Error sending local ICE candidate: {str(e)}")

    async def handle_ice_candidate(self, data: dict):
        """Handle incoming ICE candidate, skipping those we sent ourselves."""
        try:
            # Deduplicate: skip if this is our own message
            msg_id = None
            if isinstance(data, dict):
                msg_id = data.get("_clientMessageId") or (data.get("candidate", {}) or {}).get("_clientMessageId")
            if hasattr(self, 'sent_message_ids') and msg_id and msg_id in self.sent_message_ids:
                logger.debug(f"Skipping ICE candidate with our own message ID: {msg_id}")
                return

            candidate_info = data.get('candidate')
            if not candidate_info:
                logger.warning("No candidate info in ICE candidate message")
                return
            candidate_str = candidate_info.get("candidate", "")
            sdp_mid = candidate_info.get("sdpMid", "")
            sdp_mline_index = candidate_info.get("sdpMLineIndex", 0)
            parts = candidate_str.split()
            if len(parts) >= 8 and parts[0].startswith("candidate:"):
                foundation = parts[0].split(":")[1]
                candidate = RTCIceCandidate(
                    component=int(parts[1]),
                    foundation=foundation,
                    ip=parts[4],
                    port=int(parts[5]),
                    priority=int(parts[3]),
                    protocol=parts[2],
                    type=parts[7],
                    sdpMid=sdp_mid,
                    sdpMLineIndex=sdp_mline_index
                )
                await self.pc.addIceCandidate(candidate)
                logger.debug(f"Added ICE candidate: {candidate}")
            else:
                logger.error(f"Invalid ICE candidate: {candidate_str}")
        except Exception as e:
            logger.error(f"Error handling ICE candidate: {str(e)}")