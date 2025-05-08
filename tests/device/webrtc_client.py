import asyncio
import json
import time
import uuid
import sys
import select
from datetime import datetime
from typing import Dict, Any, Optional, Union, List
from fractions import Fraction

from aiortc import RTCPeerConnection, RTCSessionDescription, RTCIceCandidate, RTCConfiguration, RTCIceServer
from loguru import logger

# Import VideoStreamTrack from aiortc
from aiortc import VideoStreamTrack

# Import the video track implementation
from video_track import DummyVideoStreamTrack

class WebRTCClient:
    """WebRTC client for the dummy device to handle WebRTC connections."""
    
    # STUN server configuration
    ICE_SERVERS = [RTCIceServer(urls=['stun:stun.l.google.com:19302'])]
    
    # Connection states
    CONNECTED_STATES = ['connected', 'completed']
    FAILED_STATES = ['failed', 'closed']
    
    ###############################################################################
    #
    # Constructor
    #
    ###############################################################################
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
        self.input_task = None
        self.reconnect_attempts = 0
        self.max_reconnect_attempts = 5
        self.ice_restart_timer = None

        self.initialize()

       

       
    
    ###############################################################################
    #
    # Handling WebRTC messages over Messaging Framework
    #
    ###############################################################################
    async def handle_message(self, message):
        """Handle incoming WebRTC messages."""
        logger.debug(f"Entry to handle_message")
        try:
            payload = message.get('payload', {})
            action = payload.get('action')
            msg_type = payload.get('type')

            logger.debug(f"Received message: {action}:{msg_type}")
            
            # Map message types to handler methods
            handlers = {
                'webrtc:connect': self.handle_connect,
                'webrtc:answer': self.handle_answer,
                'webrtc:ice-candidate': self.handle_ice_candidate
            }
            
            if action == 'message' and msg_type in handlers:
                await handlers[msg_type](message)
            else:
                logger.warning(f"Unknown message type: {msg_type}")
        except Exception as e:
            logger.error(f"Error handling WebRTC message: {str(e)}")
            logger.exception("Detailed error trace:")
        
    ################################################################################
    #
    # Initialize WebRTC connection
    #
    ################################################################################
    def initialize(self):
        """Initialize the WebRTC connection with STUN servers."""
        # Clean up any existing connection first
        if self.pc:
            asyncio.create_task(self.close())
            
        # Reset state
        self.reconnect_attempts = 0
        
        # Create peer connection with STUN server
        self.pc = RTCPeerConnection(configuration=RTCConfiguration(
            iceServers=self.ICE_SERVERS
        ))
        
        
        self.pc.on("icecandidate", self._on_ice_candidate_wrapper)
        self.pc.on("connectionstatechange", self._on_connection_state_change)
        self.pc.on("iceconnectionstatechange", self._on_ice_connection_state_change)
        self.pc.on("datachannel", self._on_data_channel)

        # Add video track
        self.video_track = DummyVideoStreamTrack()
        self.pc.addTrack(self.video_track)
        
        # Create data channel
        self.dc = self.pc.createDataChannel("dummy-device")
        self._setup_data_channel_handlers(self.dc)
        
        logger.info("WebRTC client initialized")
    
    
    def _setup_data_channel_handlers(self, channel):
        """Set up data channel event handlers."""
        channel.on("open", self._on_data_channel_open)
        channel.on("message", self._on_data_channel_message)
        channel.on("close", self._on_data_channel_close)
        channel.on("error", self._on_data_channel_error)
        
    def _generate_message_id(self, prefix="msg"):
        """Generate a unique message ID for deduplication."""
        message_id = f"{prefix}-{datetime.now().isoformat()}-{uuid.uuid4().hex[:8]}"
        self.sent_message_ids.add(message_id)
        return message_id

    async def create_offer(self, ice_restart=False):
        """Create and return a WebRTC offer.
        
        Args:
            ice_restart: Whether to restart ICE during offer creation
        
        Returns:
            Dict containing the formatted offer message
        """
        if not self.pc:
            self.initialize()
        
        # Create offer with optional ICE restart
        if ice_restart:
            offer = await self.pc.createOffer(iceRestart=True)
        else:
            offer = await self.pc.createOffer()
        await self.pc.setLocalDescription(offer)
        
        # Generate message ID and create message
        message_id = self._generate_message_id("offer")
        
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
        
        logger.info("Created WebRTC offer" + (" with ICE restart" if ice_restart else ""))
        return offer_msg
    
    async def handle_answer(self, message):
        """Handle an incoming WebRTC answer."""
        try:
            logger.info("Received WebRTC answer")
            
            payload = message.get('payload', {})
            sdp = payload.get('sdp')
            
            if not sdp:
                logger.error("No SDP in answer message")
                return
            
            # Wait for local ICE candidates to be generated
            logger.info("Waiting for local ICE candidates...")
            await asyncio.sleep(1.0)  # Wait 1 second for local candidates
            
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

        # logger.debug(f"Received ICE candidate: {message}")

        try:
            # Skip if this is our own message
            msg_id = message.get('payload', {}).get('_clientMessageId')
            if msg_id in self.sent_message_ids:
                logger.debug(f"Skipping our own ICE candidate: {msg_id}")
                return
            
            # Skip if we don't have a peer connection
            if not self.pc:
                logger.error("No peer connection available for ICE candidate")
                return
            
            payload = message.get('payload', {})
            candidate_info = payload.get('candidate')
            
            if not candidate_info:
                logger.error("No candidate info in message")
                return
                
            # Parse the candidate string
            candidate_str = candidate_info.get('candidate', '')
            parts = candidate_str.split()
            
            # Check current ICE connection state
            current_ice_state = self.pc.iceConnectionState
            
            # If we're already connected or completed, be more selective about adding candidates
            # if current_ice_state in ['connected', 'completed']:
            #     # For already connected sessions, only add candidates that might improve the connection
            #     # This helps prevent unnecessary connection state changes
            #     candidate_type = parts[7] if len(parts) >= 8 else ''
            #     candidate_lower = candidate_str.lower()
                
            #     # Only add certain types of candidates when already connected
            #     # Typically relay candidates or srflx (STUN-derived) might be useful even after connection
            #     if 'relay' in candidate_lower or 'srflx' in candidate_lower or candidate_type == 'relay' or candidate_type == 'srflx':
            #         logger.info(f"Adding potential improvement candidate despite already being connected: {candidate_type}")
            #     else:
            #         logger.info(f"Ignoring redundant ICE candidate as connection is already established: {candidate_type}")
            #         return  # Skip adding this candidate
            
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
        """Send data through the data channel.
        
        Args:
            data: The data to send. Can be a string, dict, or list.
                 Dicts and lists will be converted to JSON strings.
        
        Returns:
            bool: True if the data was sent successfully, False otherwise.
        """
        if not self.dc or self.dc.readyState != "open":
            logger.warning("Data channel not open, queuing message")
            self.pending_messages.append(data)
            return False
            
        try:
            # If data is a dict or list, convert it to JSON
            if isinstance(data, (dict, list)):
                data = json.dumps(data)
                
            # For plain text, we'll just send it directly
            # The browser side will handle it as a text message
            logger.info(f"Sending data: {data[:50]}{'...' if len(str(data)) > 50 else ''}")
            self.dc.send(data)
            return True
        except Exception as e:
            logger.error(f"Error sending data: {str(e)}")
            return False
    
    def _on_ice_candidate_wrapper(self, candidate):
        """Non-async wrapper for handling ICE candidates"""
        # In aiortc, the event is directly the candidate, not an event object with a candidate property
        if candidate:
            logger.debug(f"Generated local ICE candidate: {candidate.candidate}")
            # Create a task to handle the ICE candidate asynchronously
            asyncio.create_task(self._on_ice_candidate(candidate))

    async def _on_ice_candidate(self, candidate):
        """Handle local ICE candidate generation."""
        if not candidate:
            return
            
        try:
            # Skip sending ICE candidates if we're already connected
            # This helps prevent connection instability
            if self.pc and self.pc.iceConnectionState in ['connected', 'completed']:
                # Only send relay or srflx candidates when already connected
                candidate_str = candidate.candidate.lower()
                if not ('relay' in candidate_str or 'srflx' in candidate_str):
                    logger.info(f"Skipping sending host candidate when already connected")
                    return
            
            # Create message ID for deduplication
            message_id = self._generate_message_id("ice")
            
            # Format the candidate message for the device to send
            candidate_msg = {
                "id": message_id,
                "type": "device",
                "payload": {
                    "action": "message",
                    "type": "webrtc:ice-candidate",
                    "deviceId": self.device.device_id,
                    "candidate": {
                        "candidate": candidate.candidate,
                        "sdpMid": candidate.sdpMid,
                        "sdpMLineIndex": candidate.sdpMLineIndex,
                        "usernameFragment": candidate.usernameFragment
                    },
                    "_clientMessageId": message_id
                }
            }
            
            # Send through the device
            success = self.device.send_message(candidate_msg)
            
            if success:
                logger.info(f"Sent ICE candidate: {candidate.candidate[:30]}...")
            else:
                logger.error("Failed to send ICE candidate message")
            
        except Exception as e:
            logger.error(f"Error sending ICE candidate: {str(e)}")
            logger.exception("Detailed error trace:")
    
    def _on_connection_state_change(self):
        """Handle connection state changes."""
        if not self.pc:
            return
            
        state = self.pc.connectionState
        logger.info(f"Connection state changed: {state}")
        
        if state == "connected":
            logger.info("WebRTC connection established")
            # Reset reconnection attempts on successful connection
            self.reconnect_attempts = 0
            
            # Send a hello message to confirm connection
            hello_msg = {
                'type': 'hello',
                'message': 'Connection established from device',
                'timestamp': datetime.now().isoformat()
            }
            if self.dc and self.dc.readyState == "open":
                asyncio.create_task(self.send_data(hello_msg))
                
            # Start the console input loop
            if self.input_task is None or self.input_task.done():
                logger.info("Starting console input loop")
                self.input_task = asyncio.create_task(self._console_input_loop())
                
        elif state == "disconnected":
            logger.info("WebRTC connection temporarily disconnected")
            # Don't close resources yet, allow for reconnection
            # Don't immediately try to restart ICE - this matches the TypeScript client approach
            # which is more tolerant of temporary disconnections
            
        elif state == "failed":
            logger.error("WebRTC connection failed")
            # Don't immediately attempt reconnection - give it a moment
            # This aligns with the TypeScript client's approach
            logger.info("Scheduling reconnection attempt after brief delay")
            asyncio.create_task(self._schedule_reconnection(2))  # 2 second delay
            
        elif state == "closed":
            logger.error("WebRTC connection closed")
            # Cancel input task if it's running
            if self.input_task and not self.input_task.done():
                self.input_task.cancel()
    
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
                
        elif state == "disconnected":
            logger.warning("ICE connection disconnected - waiting for automatic recovery")
            # Schedule a delayed restart if we stay disconnected
            if not hasattr(self, 'ice_restart_timer') or self.ice_restart_timer is None:
                self.ice_restart_timer = asyncio.create_task(self._delayed_ice_restart())
            
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
            self._setup_data_channel_handlers(channel)
            
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
            
        # Start the console input task
        if self.input_task:
            self.input_task.cancel()
        self.input_task = asyncio.create_task(self._console_input_loop())
    
    def _on_data_channel_message(self, message):
        """Handle incoming data channel message."""
        logger.info(f"Received data channel message: {message}")
        
        try:
            # Parse the message if it's JSON
            if isinstance(message, str) and message.startswith('{'): 
                msg_data = json.loads(message)
                msg_type = msg_data.get('type')
                
                # Handle special message types
                handlers = {
                    'ping': self._handle_ping_message,
                    'close': self._handle_close_message
                }
                
                if msg_type in handlers:
                    handlers[msg_type](msg_data)
                    return
            
            # For other messages, echo them back (for testing)
            asyncio.create_task(self.send_data(message))
            
        except Exception as e:
            logger.error(f"Error processing data channel message: {str(e)}")
    
    def _handle_ping_message(self, msg_data):
        """Handle ping messages with pong response."""
        pong_msg = {
            'type': 'pong',
            'timestamp': datetime.now().isoformat(),
            'echo': msg_data.get('timestamp')
        }
        logger.info("Received ping, sending pong response")
        asyncio.create_task(self.send_data(pong_msg))
    
    def _handle_close_message(self, msg_data):
        """Handle close messages with acknowledgment."""
        logger.info("Received close signal from browser")
        ack_msg = {
            'type': 'close-ack',
            'timestamp': datetime.now().isoformat()
        }
        asyncio.create_task(self.send_data(ack_msg))
    
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
    
    async def _console_input_loop(self):
        """Read user input from console and send over WebRTC data channel."""
        try:
            logger.info("Console input loop started - type messages to send over WebRTC")
            logger.info("Press Ctrl+C to exit")
            
            while True:
                # Check if we should continue
                if not self.pc or self.pc.connectionState in self.FAILED_STATES:
                    logger.warning("Connection no longer active, stopping console input loop")
                    break
                
                # Use asyncio to read from stdin without blocking
                await asyncio.sleep(0.1)
                
                # Check if there's data to read from stdin (non-blocking)
                if select.select([sys.stdin], [], [], 0)[0]:
                    user_input = sys.stdin.readline().strip()
                    await self._send_user_input(user_input)
                
        except asyncio.CancelledError:
            logger.debug("Console input loop cancelled")
        except Exception as e:
            logger.error(f"Error in console input loop: {str(e)}")
            # Restart the console input loop after a short delay if there was an error
            if self.pc and self.pc.connectionState == "connected":
                logger.info("Restarting console input loop after error")
                await asyncio.sleep(1)
                self.input_task = asyncio.create_task(self._console_input_loop())
    
    async def _send_user_input(self, user_input):
        """Send user input over the data channel."""
        # Send the user input if data channel is open
        if self.dc and self.dc.readyState == "open":
            message = {
                'type': 'console',
                'message': user_input,
                'timestamp': datetime.now().isoformat(),
                'id': str(uuid.uuid4())[:8]
            }
            
            success = await self.send_data(message)
            if success:
                logger.info(f"Sent message: {user_input}")
            else:
                logger.warning(f"Failed to send message: {user_input}")
        else:
            logger.warning(f"Data channel not open (state: {self.dc.readyState if self.dc else 'None'}), can't send message")
            print("WebRTC data channel not open. Message not sent.")
                
    async def _delayed_ice_restart(self):
        """Schedule a delayed ICE restart if the connection doesn't recover on its own."""
        try:
            # Wait a longer time to see if ICE reconnects on its own (increased from 3s to 8s)
            # This matches better with the TypeScript client's more patient approach
            await asyncio.sleep(8)
            
            # Check if we still need to restart ICE
            if self.pc and self.pc.iceConnectionState == "disconnected":
                logger.info("ICE still disconnected after delay, attempting restart")
                await self._restart_ice()
            else:
                logger.info("Connection recovered on its own, no ICE restart needed")
        except Exception as e:
            logger.error(f"Error in delayed ICE restart: {str(e)}")

    async def _restart_ice(self):
        """Attempt to restart ICE negotiation."""
        try:
            if not self.pc:
                logger.error("Cannot restart ICE - no peer connection")
                return
                
            logger.info("Attempting ICE restart")
            
            # Create and send a new offer with ICE restart flag
            offer_msg = await self.create_offer(ice_restart=True)
            
            # Send through the device
            self.device.send_message(offer_msg)
            logger.info("Sent ICE restart offer")
            
        except Exception as e:
            logger.error(f"Error restarting ICE: {str(e)}")
            # If ICE restart fails, try a full reconnection
            asyncio.create_task(self._attempt_reconnection())
            
    async def _schedule_reconnection(self, delay_seconds=0):
        """Schedule a reconnection attempt with a delay."""
        if delay_seconds > 0:
            await asyncio.sleep(delay_seconds)
        await self._attempt_reconnection()
    
    async def _attempt_reconnection(self):
        """Attempt to reconnect after connection failure."""
        try:
            self.reconnect_attempts += 1
            
            if self.reconnect_attempts > self.max_reconnect_attempts:
                logger.error(f"Exceeded maximum reconnection attempts ({self.max_reconnect_attempts})")
                return
                
            # Wait before attempting reconnection with exponential backoff
            wait_time = 2 * self.reconnect_attempts
            logger.info(f"Waiting {wait_time} seconds before reconnection attempt {self.reconnect_attempts}")
            await asyncio.sleep(wait_time)
            
            # Clean up existing tasks
            await self._cleanup_tasks()
            
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
    
    async def _cleanup_tasks(self):
        """Clean up any running tasks."""
        # Cancel any existing input task
        if self.input_task and not self.input_task.done():
            self.input_task.cancel()
            self.input_task = None
        
        # Clear any pending ICE restart timer
        if hasattr(self, 'ice_restart_timer') and self.ice_restart_timer and not self.ice_restart_timer.done():
            self.ice_restart_timer.cancel()
            self.ice_restart_timer = None
    
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
