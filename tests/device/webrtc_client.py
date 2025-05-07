import asyncio
import json
import logging
import time
import uuid
from datetime import datetime
from typing import Dict, Any, Callable, Awaitable

from aiortc import RTCPeerConnection, RTCSessionDescription, RTCIceCandidate, VideoStreamTrack, RTCConfiguration, RTCIceServer
from aiortc.mediastreams import VideoFrame
import numpy as np

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class DummyVideoStreamTrack(VideoStreamTrack):
    """A video track that generates test patterns for the dummy device."""
    def __init__(self):
        super().__init__()
        self.counter = 0
        self.frames_per_second = 30
        self.frame_time = 1 / self.frames_per_second
        self.last_frame_time = time.time()

    async def recv(self):
        # Limit frame rate
        now = time.time()
        wait_time = max(0, self.last_frame_time + self.frame_time - now)
        if wait_time > 0:
            await asyncio.sleep(wait_time)
        
        self.last_frame_time = time.time()
        self.counter += 1
        
        # Create a frame with changing colors
        img = np.zeros((480, 640, 3), dtype=np.uint8)
        img[:, :, 0] = (self.counter * 5) % 256  # Red channel
        img[:, :, 1] = (self.counter * 7) % 256  # Green channel
        img[:, :, 2] = (self.counter * 11) % 256  # Blue channel
        
        # Create VideoFrame from numpy array
        frame = VideoFrame.from_ndarray(img, format="bgr24")
        frame.pts = self.counter
        frame.time_base = 1 / 90000  # MPEG clock rate
        
        return frame


class WebRTCClient:
    """WebRTC client for the dummy device to handle WebRTC connections."""
    
    def __init__(self, device):
        """Initialize the WebRTC client.
        
        Args:
            device: The dummy device instance that will use this client
        """
        self.device = device
        self.pc = None
        self.dc = None
        self.video_track = None
        self.sent_message_ids = set()
        self.pending_messages = []
        
    def initialize(self):
        """Initialize the WebRTC connection with STUN servers."""
        # Create peer connection with STUN server
        self.pc = RTCPeerConnection(configuration=RTCConfiguration(
            iceServers=[RTCIceServer(
                urls=['stun:stun.l.google.com:19302']
            )]
        ))
        
        # Set up event handlers
        self.pc.on("icecandidate", self._on_ice_candidate)
        self.pc.on("connectionstatechange", self._on_connection_state_change)
        self.pc.on("iceconnectionstatechange", self._on_ice_connection_state_change)
        self.pc.on("datachannel", self._on_data_channel)
        
        # Add video track
        self.video_track = DummyVideoStreamTrack()
        self.pc.addTrack(self.video_track)
        
        # Create data channel
        self.dc = self.pc.createDataChannel("dummy-device")
        self.dc.on("open", self._on_data_channel_open)
        self.dc.on("message", self._on_data_channel_message)
        self.dc.on("close", self._on_data_channel_close)
        
        logger.info("WebRTC client initialized")
        
    async def create_offer(self):
        """Create and return a WebRTC offer."""
        if not self.pc:
            self.initialize()
            
        offer = await self.pc.createOffer()
        await self.pc.setLocalDescription(offer)
        
        # Create message ID for deduplication
        message_id = f"offer-{datetime.now().isoformat()}-{uuid.uuid4().hex[:8]}"
        self.sent_message_ids.add(message_id)
        
        # Format the offer message for the device to send
        offer_msg = {
            "id": message_id,
            "type": "device",
            "payload": {
                "action": "message",
                "type": "webrtc:offer",
                "sdp": offer.sdp,
                "_clientMessageId": message_id
            }
        }
        
        logger.info("Created WebRTC offer")
        return offer_msg
    
    async def handle_answer(self, message):
        """Handle an incoming WebRTC answer."""
        try:
            payload = message.get('payload', {})
            sdp = payload.get('sdp')
            
            if not sdp:
                logger.error("No SDP in answer message")
                return
                
            answer = RTCSessionDescription(sdp=sdp, type='answer')
            await self.pc.setRemoteDescription(answer)
            logger.info("Set remote description from answer")
            
        except Exception as e:
            logger.error(f"Error handling answer: {str(e)}")
    
    async def handle_ice_candidate(self, message):
        """Handle an incoming ICE candidate."""
        try:
            payload = message.get('payload', {})
            candidate_data = payload.get('candidate', {})
            
            # Skip if this is our own message
            msg_id = payload.get('_clientMessageId')
            if msg_id and msg_id in self.sent_message_ids:
                logger.debug(f"Skipping our own ICE candidate: {msg_id}")
                return
                
            if not candidate_data:
                logger.warning("No candidate data in message")
                return
                
            candidate = RTCIceCandidate(
                candidate=candidate_data.get('candidate', ''),
                sdpMid=candidate_data.get('sdpMid'),
                sdpMLineIndex=candidate_data.get('sdpMLineIndex')
            )
            
            await self.pc.addIceCandidate(candidate)
            logger.info("Added remote ICE candidate")
            
        except Exception as e:
            logger.error(f"Error handling ICE candidate: {str(e)}")
    
    async def handle_connect(self, message):
        """Handle a WebRTC connect request."""
        try:
            # Create and send an offer in response to the connect request
            offer_msg = await self.create_offer()
            
            # Set the correct scope for the response
            if 'senderConnectionId' in message:
                offer_msg['scope'] = f"connection:{message['senderConnectionId']}"
            
            # Send the offer through the device
            self.device.send_message(offer_msg)
            logger.info("Sent WebRTC offer in response to connect request")
            
        except Exception as e:
            logger.error(f"Error handling connect request: {str(e)}")
    
    async def send_data(self, data):
        """Send data through the data channel."""
        if not self.dc or self.dc.readyState != "open":
            logger.warning("Data channel not open, queuing message")
            self.pending_messages.append(data)
            return False
            
        try:
            if isinstance(data, (dict, list)):
                data = json.dumps(data)
            self.dc.send(data)
            return True
        except Exception as e:
            logger.error(f"Error sending data: {str(e)}")
            return False
    
    async def _on_ice_candidate(self, event):
        """Handle local ICE candidate generation."""
        if not event.candidate:
            return
            
        try:
            # Create message ID for deduplication
            message_id = f"ice-{datetime.now().isoformat()}-{uuid.uuid4().hex[:8]}"
            self.sent_message_ids.add(message_id)
            
            # Format the candidate message for the device to send
            candidate_msg = {
                "id": message_id,
                "type": "device",
                "payload": {
                    "action": "message",
                    "type": "webrtc:candidate",
                    "candidate": {
                        "candidate": event.candidate.candidate,
                        "sdpMid": event.candidate.sdpMid,
                        "sdpMLineIndex": event.candidate.sdpMLineIndex,
                    },
                    "_clientMessageId": message_id
                }
            }
            
            # Send through the device
            self.device.send_message(candidate_msg)
            logger.debug(f"Sent ICE candidate: {event.candidate.candidate[:30]}...")
            
        except Exception as e:
            logger.error(f"Error sending ICE candidate: {str(e)}")
    
    def _on_connection_state_change(self):
        """Handle connection state changes."""
        if not self.pc:
            return
            
        state = self.pc.connectionState
        logger.info(f"Connection state changed: {state}")
    
    def _on_ice_connection_state_change(self):
        """Handle ICE connection state changes."""
        if not self.pc:
            return
            
        state = self.pc.iceConnectionState
        logger.info(f"ICE connection state changed: {state}")
    
    def _on_data_channel(self, channel):
        """Handle incoming data channel."""
        logger.info(f"Received data channel: {channel.label}")
        
        if not self.dc:
            self.dc = channel
            self.dc.on("open", self._on_data_channel_open)
            self.dc.on("message", self._on_data_channel_message)
            self.dc.on("close", self._on_data_channel_close)
    
    def _on_data_channel_open(self):
        """Handle data channel open event."""
        logger.info("Data channel opened")
        
        # Send any pending messages
        if self.pending_messages:
            logger.info(f"Sending {len(self.pending_messages)} pending messages")
            for msg in self.pending_messages:
                asyncio.create_task(self.send_data(msg))
            self.pending_messages.clear()
    
    def _on_data_channel_message(self, message):
        """Handle incoming data channel message."""
        logger.info(f"Received data channel message: {message}")
        
        # Echo the message back (for testing)
        asyncio.create_task(self.send_data(message))
    
    def _on_data_channel_close(self):
        """Handle data channel close event."""
        logger.info("Data channel closed")
    
    async def close(self):
        """Close the WebRTC connection."""
        if self.pc:
            await self.pc.close()
            self.pc = None
            logger.info("WebRTC connection closed")
