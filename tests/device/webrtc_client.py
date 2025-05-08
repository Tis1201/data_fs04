import asyncio
import json
import logging
import time
import uuid
from datetime import datetime
from typing import Dict, Any, Callable, Awaitable
from fractions import Fraction

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
        self.frames_per_second = 15  # Reduced from 30 to lower bandwidth
        self.frame_time = 1 / self.frames_per_second
        self.last_frame_time = time.time()
        self.last_frame = None
        self.stopped = False
        self._backpressure_sleep = 0.001  # Start with 1ms sleep
        self._max_backpressure_sleep = 0.1  # Max 100ms sleep
        
        # Error tracking
        self._error_count = 0
        self._max_errors = 5  # Max consecutive errors before reducing quality
        self._recovery_time = time.time()
        self._recovery_interval = 10  # Seconds between recovery attempts
        self._current_quality = 1.0  # Quality multiplier (1.0 = full quality)

    def stop(self):
        """Stop the video track."""
        self.stopped = True

    async def recv(self):
        if self.stopped:
            return None

        try:
            # Dynamic rate limiting with backpressure
            now = time.time()
            elapsed = now - self.last_frame_time
            
            # If we're falling behind, increase backpressure
            if elapsed < self.frame_time:
                self._backpressure_sleep = max(0.001, self._backpressure_sleep * 0.9)  # Reduce sleep time
            else:
                self._backpressure_sleep = min(self._max_backpressure_sleep, 
                                              self._backpressure_sleep * 1.1)  # Increase sleep time
            
            # Apply rate limiting
            wait_time = max(0, self.frame_time - elapsed)
            if wait_time > 0:
                await asyncio.sleep(wait_time)
            
            # Additional backpressure sleep
            await asyncio.sleep(self._backpressure_sleep)
            
            self.last_frame_time = time.time()
            self.counter += 1
            
            # Apply quality settings
            width = int(320 * self._current_quality)
            height = int(240 * self._current_quality)
            width = max(160, width - (width % 2))  # Ensure even dimensions
            height = max(120, height - (height % 2))
            
            # Create a frame with changing colors (dynamic size based on quality)
            img = np.zeros((height, width, 3), dtype=np.uint8)
            img[:, :, 0] = (self.counter * 5) % 256  # Red channel
            img[:, :, 1] = (self.counter * 7) % 256  # Green channel
            img[:, :, 2] = (self.counter * 11) % 256  # Blue channel
            
            # Create VideoFrame from numpy array
            frame = VideoFrame.from_ndarray(img, format="bgr24")
            frame.pts = self.counter
            frame.time_base = Fraction(1, 90000)  # MPEG clock rate
            
            # Reset error count on successful frame
            self._error_count = 0
            
            # Try to recover quality if we've been stable
            if (time.time() - self._recovery_time > self._recovery_interval and 
                self._current_quality < 1.0):
                self._current_quality = min(1.0, self._current_quality + 0.1)
                self._recovery_time = time.time()
                logger.info(f"Increasing video quality to {self._current_quality:.1f}")
            
            self.last_frame = frame
            return frame
            
        except Exception as e:
            logger.error(f"Error in video track: {str(e)}")
            self._error_count += 1
            
            # Reduce quality if we're getting too many errors
            if self._error_count >= self._max_errors:
                self._current_quality = max(0.5, self._current_quality - 0.1)
                logger.warning(f"Reducing video quality to {self._current_quality:.1f} due to errors")
                self._error_count = 0
                self._recovery_time = time.time()
            
            # On error, return the last frame if available, otherwise create a black frame
            if self.last_frame:
                return self.last_frame
            
            # Create a black frame as fallback
            img = np.zeros((240, 320, 3), dtype=np.uint8)
            frame = VideoFrame.from_ndarray(img, format="bgr24")
            frame.pts = self.counter
            frame.time_base = Fraction(1, 90000)
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
        self.last_ping_time = time.time()
        self.ping_interval = 5  # Send ping every 5 seconds (reduced from 10)
        self.ping_task = None
        self.reconnect_attempts = 0
        self.max_reconnect_attempts = 5  # Increased from 3
        self.ice_restart_timer = None
        
    def initialize(self):
        """Initialize the WebRTC connection with STUN servers."""
        # Clean up any existing connection first
        if self.pc:
            asyncio.create_task(self.close())
            
        # Reset state
        self.reconnect_attempts = 0
        
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
            # First check if we have a valid peer connection
            if not self.pc:
                logger.error("No peer connection available")
                return
                
            payload = message.get('payload', {})
            sdp = payload.get('sdp')
            
            if not sdp:
                logger.error("No SDP in answer message")
                return
                
            answer = RTCSessionDescription(sdp=sdp, type='answer')
            
            # Create a task for setting remote description
            task = asyncio.create_task(self.pc.setRemoteDescription(answer))
            await task
            
            logger.info("Set remote description from answer")
            
            # If we have a data channel, send a test message
            if self.dc and self.dc.readyState == "open":
                test_message = {
                    "text": "Hello from device!",
                    "timestamp": datetime.now().isoformat()
                }
                await self.send_data(test_message)
                
        except Exception as e:
            logger.error(f"Error handling answer: {str(e)}")
            logger.exception("Detailed error trace:")
    
    async def handle_ice_candidate(self, message):
        """Handle an incoming ICE candidate."""
        try:
            # Skip if this is our own message
            msg_id = message.get('payload', {}).get('_clientMessageId')
            if msg_id in self.sent_message_ids:
                logger.debug(f"Skipping our own ICE candidate: {msg_id}")
                return
            
            payload = message.get('payload', {})
            candidate_info = payload.get('candidate')
            
            if not candidate_info:
                logger.error("No candidate info in message")
                return
                
            # Parse the candidate string
            candidate_str = candidate_info.get('candidate', '')
            parts = candidate_str.split()
            
            if len(parts) >= 8 and parts[0].startswith('candidate:'):
                foundation = parts[0].split(':')[1]
                # Create candidate with proper parameters
                candidate = RTCIceCandidate(
                    component=int(parts[1]),
                    foundation=foundation,
                    ip=parts[4],
                    port=int(parts[5]),
                    priority=int(parts[3]),
                    protocol=parts[2],
                    type=parts[7],
                    sdpMid=candidate_info.get('sdpMid'),
                    sdpMLineIndex=candidate_info.get('sdpMLineIndex')
                )
                
                # Create a task for adding the candidate
                task = asyncio.create_task(self.pc.addIceCandidate(candidate))
                await task
                logger.debug(f"Added ICE candidate: {candidate_str[:30]}...")
            else:
                logger.error(f"Invalid ICE candidate format: {candidate_str}")
            
        except Exception as e:
            logger.error(f"Error handling ICE candidate: {str(e)}")
            logger.exception("Detailed error trace:")
    
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
            logger.info(f"Sent ICE candidate: {event.candidate.candidate[:30]}...")
            
        except Exception as e:
            logger.error(f"Error sending ICE candidate: {str(e)}")
    
    def _on_connection_state_change(self):
        """Handle connection state changes."""
        if not self.pc:
            return
            
        state = self.pc.connectionState
        logger.info(f"Connection state changed: {state}")
        
        if state == "connected":
            logger.info("WebRTC connection established")
            # Send a hello message to confirm connection
            hello_msg = {
                'type': 'hello',
                'message': 'Connection established from device',
                'timestamp': datetime.now().isoformat()
            }
            if self.dc and self.dc.readyState == "open":
                asyncio.create_task(self.send_data(hello_msg))
                
            # Start the ping loop to keep the connection alive
            if self.ping_task is None or self.ping_task.done():
                logger.info("Starting ping loop to maintain connection")
                self.ping_task = asyncio.create_task(self._ping_loop())
                
        elif state == "disconnected":
            logger.info("WebRTC connection temporarily disconnected")
            # Don't close resources yet, allow for reconnection
            # Try an immediate ICE restart to recover quickly
            asyncio.create_task(self._restart_ice())
            
        elif state == "failed":
            logger.error("WebRTC connection failed")
            # Schedule a delayed reconnection attempt
            asyncio.create_task(self._attempt_reconnection())
            
        elif state == "closed":
            logger.error("WebRTC connection closed")
            # Cancel ping task if it's running
            if self.ping_task and not self.ping_task.done():
                self.ping_task.cancel()
    
    def _on_ice_connection_state_change(self):
        """Handle ICE connection state changes."""
        if not self.pc:
            return
            
        state = self.pc.iceConnectionState
        logger.info(f"ICE connection state changed: {state}")
        
        if state == "connected" or state == "completed":
            # Reset reconnection attempts on successful connection
            self.reconnect_attempts = 0
            
            # Send any pending messages that may have been queued during reconnection
            if self.pending_messages and self.dc and self.dc.readyState == "open":
                logger.info(f"Sending {len(self.pending_messages)} pending messages after reconnection")
                for msg in self.pending_messages:
                    asyncio.create_task(self.send_data(msg))
                self.pending_messages.clear()
                
            # Ensure ping loop is running
            if (self.ping_task is None or self.ping_task.done()) and self.dc and self.dc.readyState == "open":
                logger.info("Starting ping loop after ICE connection established")
                self.ping_task = asyncio.create_task(self._ping_loop())
                
        elif state == "disconnected":
            logger.warning("ICE connection disconnected - may recover automatically")
            # Schedule a delayed ICE restart if it doesn't recover quickly
            asyncio.create_task(self._delayed_ice_restart())
            
        elif state == "failed":
            logger.error("ICE connection failed - attempting ICE restart")
            # Try to restart ICE immediately
            if self.pc:
                asyncio.create_task(self._restart_ice())
    
    def _on_data_channel(self, channel):
        """Handle incoming data channel."""
        logger.info(f"Received data channel: {channel.label}")
        
        if not self.dc:
            self.dc = channel
            self.dc.on("open", self._on_data_channel_open)
            self.dc.on("message", self._on_data_channel_message)
            self.dc.on("close", self._on_data_channel_close)
            self.dc.on("error", self._on_data_channel_error)
            
            # Log current state
            logger.info(f"Data channel state: {self.dc.readyState}")
    
    def _on_data_channel_open(self):
        """Handle data channel open event."""
        logger.info("Data channel opened")
        
        # Log data channel info
        if self.dc:
            logger.info(f"Data channel info - Label: {self.dc.label}, State: {self.dc.readyState}, Buffered: {self.dc.bufferedAmount}")
        
        # Send any pending messages
        if self.pending_messages:
            logger.info(f"Sending {len(self.pending_messages)} pending messages")
            for msg in self.pending_messages:
                asyncio.create_task(self.send_data(msg))
            self.pending_messages.clear()
            
        # Start the ping task to keep the connection alive
        self.last_ping_time = time.time()
        if self.ping_task:
            self.ping_task.cancel()
        self.ping_task = asyncio.create_task(self._ping_loop())
    
    def _on_data_channel_message(self, message):
        """Handle incoming data channel message."""
        logger.info(f"Received data channel message: {message}")
        
        try:
            # Parse the message if it's JSON
            if isinstance(message, str) and message.startswith('{'): 
                msg_data = json.loads(message)
                msg_type = msg_data.get('type')
                
                # Handle ping messages specially
                if msg_type == 'ping':
                    # Send a pong response
                    pong_msg = {
                        'type': 'pong',
                        'timestamp': datetime.now().isoformat(),
                        'echo': msg_data.get('timestamp')
                    }
                    logger.info(f"Received ping, sending pong response")
                    asyncio.create_task(self.send_data(pong_msg))
                    return
                    
                # Handle close messages
                if msg_type == 'close':
                    logger.info(f"Received close signal from browser")
                    # Don't close immediately, just acknowledge
                    ack_msg = {
                        'type': 'close-ack',
                        'timestamp': datetime.now().isoformat()
                    }
                    asyncio.create_task(self.send_data(ack_msg))
                    return
            
            # For other messages, echo them back (for testing)
            asyncio.create_task(self.send_data(message))
            
        except Exception as e:
            logger.error(f"Error processing data channel message: {str(e)}")
    
    def _on_data_channel_close(self):
        """Handle data channel close event."""
        logger.info("Data channel closed")
        if self.dc:
            logger.info(f"Data channel final state - Label: {self.dc.label}, State: {self.dc.readyState}")
            self.dc = None
            
    def _on_data_channel_error(self, error):
        """Handle data channel error event."""
        logger.error(f"Data channel error: {error}")
        if self.dc:
            logger.error(f"Data channel error state - Label: {self.dc.label}, State: {self.dc.readyState}")
    
    async def _ping_loop(self):
        """Send periodic pings to keep the connection alive."""
        try:
            logger.info("Ping loop started")
            while True:
                # Check if we should continue
                if not self.pc or self.pc.connectionState in ["failed", "closed"]:
                    logger.warning("Connection no longer active, stopping ping loop")
                    break
                    
                # Wait for ping interval (shorter interval for better connection maintenance)
                await asyncio.sleep(self.ping_interval)
                
                # Send ping if data channel is open
                if self.dc and self.dc.readyState == "open":
                    ping_msg = {
                        'type': 'ping',
                        'timestamp': datetime.now().isoformat(),
                        'id': str(uuid.uuid4())[:8]  # Add unique ID to prevent deduplication issues
                    }
                    await self.send_data(ping_msg)
                    logger.debug("Sent keep-alive ping")
                    self.last_ping_time = time.time()
                else:
                    logger.warning(f"Data channel not open (state: {self.dc.readyState if self.dc else 'None'}), pausing pings")
                    # Don't break, just wait and try again
        except asyncio.CancelledError:
            logger.debug("Ping loop cancelled")
        except Exception as e:
            logger.error(f"Error in ping loop: {str(e)}")
            # Restart the ping loop after a short delay if there was an error
            if self.pc and self.pc.connectionState == "connected" and self.dc and self.dc.readyState == "open":
                logger.info("Restarting ping loop after error")
                await asyncio.sleep(1)
                self.ping_task = asyncio.create_task(self._ping_loop())
                
    async def _delayed_ice_restart(self):
        """Schedule a delayed ICE restart if the connection doesn't recover on its own."""
        try:
            # Wait a short time to see if ICE reconnects on its own
            await asyncio.sleep(3)
            
            # Check if we still need to restart ICE
            if self.pc and self.pc.iceConnectionState == "disconnected":
                logger.info("ICE still disconnected after delay, attempting restart")
                await self._restart_ice()
        except Exception as e:
            logger.error(f"Error in delayed ICE restart: {str(e)}")

    async def _restart_ice(self):
        """Attempt to restart ICE negotiation."""
        try:
            if not self.pc:
                logger.error("Cannot restart ICE - no peer connection")
                return
                
            logger.info("Attempting ICE restart")
            # Create a new offer with ICE restart flag
            offer = await self.pc.createOffer({"iceRestart": True})
            await self.pc.setLocalDescription(offer)
            
            # Create message ID for deduplication
            message_id = f"restart-{datetime.now().isoformat()}-{uuid.uuid4().hex[:8]}"
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
            
            # Send through the device
            self.device.send_message(offer_msg)
            logger.info("Sent ICE restart offer")
            
        except Exception as e:
            logger.error(f"Error restarting ICE: {str(e)}")
            # If ICE restart fails, try a full reconnection
            asyncio.create_task(self._attempt_reconnection())
            
    async def _attempt_reconnection(self):
        """Attempt to reconnect after connection failure."""
        try:
            self.reconnect_attempts += 1
            
            if self.reconnect_attempts > self.max_reconnect_attempts:
                logger.error(f"Exceeded maximum reconnection attempts ({self.max_reconnect_attempts})")
                return
                
            # Wait before attempting reconnection
            wait_time = 2 * self.reconnect_attempts  # Exponential backoff
            logger.info(f"Waiting {wait_time} seconds before reconnection attempt {self.reconnect_attempts}")
            await asyncio.sleep(wait_time)
            
            # Cancel any existing ping task
            if self.ping_task and not self.ping_task.done():
                self.ping_task.cancel()
                self.ping_task = None
            
            # Try to restart ICE first if connection still exists
            if self.pc and self.pc.connectionState != "closed":
                await self._restart_ice()
            else:
                # Reinitialize if connection is fully closed
                logger.info("Reinitializing WebRTC connection")
                self.initialize()
                # Create and send a new offer
                offer_msg = await self.create_offer()
                self.device.send_message(offer_msg)
                
        except Exception as e:
            logger.error(f"Error during reconnection attempt: {str(e)}")
    
    async def close(self):
        """Close the WebRTC connection."""
        if self.video_track:
            self.video_track.stop()
            self.video_track = None
            logger.info("Video track stopped")
            
        if self.dc and self.dc.readyState == "open":
            try:
                # Send a goodbye message
                goodbye_msg = {
                    'type': 'goodbye',
                    'message': 'Device closing connection',
                    'timestamp': datetime.now().isoformat()
                }
                self.dc.send(json.dumps(goodbye_msg))
                logger.info("Sent goodbye message before closing")
            except Exception as e:
                logger.error(f"Error sending goodbye message: {str(e)}")
            
        if self.pc:
            await self.pc.close()
            self.pc = None
            logger.info("WebRTC connection closed")
