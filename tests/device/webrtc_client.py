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

# Import the video track and data channel implementations
from video_track import DummyVideoStreamTrack
from data_channel import DataChannelHandler

class WebRTCClient:
    """WebRTC client for the dummy device to handle WebRTC connections."""
    
    # STUN server configuration
    ICE_SERVERS = [RTCIceServer(urls=['stun:stun.l.google.com:19302'])]
    
    # Connection states
    CONNECTED_STATES = ['connected', 'completed']
    FAILED_STATES = ['failed', 'closed']

    ###############################################################################
    #
    # Convenience Methods
    #
    ###############################################################################

    def _generate_message_id(self, prefix="msg"):
        """Generate a unique message ID for deduplication."""
        message_id = f"{prefix}-{datetime.now().isoformat()}-{uuid.uuid4().hex[:8]}"
        self.sent_message_ids.add(message_id)
        return message_id

    
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
        self.input_task = None
        self.reconnect_attempts = 0
        self.max_reconnect_attempts = 5
        self.ice_restart_timer = None
        
        # Initialize data channel handler
        self.dc_handler = DataChannelHandler(self)

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
                'webrtc:ice-candidate': self.handle_remote_ice_candidate
            }
            
            if action == 'message' and msg_type in handlers:
                await handlers[msg_type](message)
            else:
                logger.warning(f"Unknown message type: {msg_type}")
        except Exception as e:
            logger.error(f"Error handling WebRTC message: {str(e)}")
            logger.exception("Detailed error trace:")

    ###############################################################################
    #
    # Handle Connect Request
    #
    ###############################################################################
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
    
    ###############################################################################
    #
    # Handle Answer Message
    #
    ###############################################################################
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
    
    ###############################################################################
    #
    # Handle Remote Ice Candidate Message
    #
    ###############################################################################
    async def handle_remote_ice_candidate(self, message):
        
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
        
        self.pc.on("icecandidate", self._on_ice_candidate)
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
    
    ################################################################################
    #
    # Create Offer
    #
    ################################################################################
    async def create_offer(self, ice_restart=False):
        
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
    
    
    
    ################################################################################
    #
    # [Ice Candidate]
    #
    ################################################################################
    async def _on_ice_candidate(self, candidate):

        logger.debug("Entry to _on_ice_candidate")
        """Handle local ICE candidate generation."""
        if not candidate:
            return
            
        logger.debug(f"Generated local ICE candidate: {candidate.candidate}")
        
        # Skip sending ICE candidates if we're already connected
        # This helps prevent connection instability
        if self.pc and self.pc.iceConnectionState in ['connected', 'completed']:
            # Only send relay or srflx candidates when already connected
            candidate_str = candidate.candidate.lower()
            if not ('relay' in candidate_str or 'srflx' in candidate_str):
                logger.info(f"Skipping sending host candidate when already connected")
                return
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

    
    
    ################################################################################
    #
    # Connection State
    #
    ################################################################################
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

            # if self.dc and self.dc.readyState == "open":
            #     asyncio.create_task(self.send_data(hello_msg))
                
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
    
    ################################################################################
    #
    # On ICE Connection State
    #
    ################################################################################
    def _on_ice_connection_state_change(self):
        """Handle ICE connection state changes."""
        if not self.pc:
            return

        state = self.pc.iceConnectionState
        # logger.info(f"ICE connection state changed: {state}")
    
    ################################################################################
    #
    # [Data Channel] Setup Handlers
    #
    ################################################################################
    def _setup_data_channel_handlers(self, channel):
        """Set up data channel event handlers."""
        self.dc_handler.setup_handlers(channel)

    ################################################################################
    #
    # [Data Channel] Initiated by Remote Peer
    #
    ################################################################################
    def _on_data_channel(self, channel):
        """Handle incoming data channel."""
        logger.info(f"Received data channel: {channel.label}")
        
        if not self.dc:
            self.dc = channel
            self._setup_data_channel_handlers(channel)
            
            # Log current state
            logger.info(f"Data channel state: {self.dc.readyState}")
    
    ################################################################################
    #
    # [Data Channel] Operations
    #
    ################################################################################
    async def send_data(self, data):
        """Send data through the data channel."""
        return await self.dc_handler.send_data(data)
    
    
    ################################################################################
    #
    # [Console] Read from Console
    #
    ################################################################################    
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
    
    ################################################################################
    #
    # [Console] Send user input
    #
    ################################################################################    
    async def _send_user_input(self, user_input):
        """Send user input over the data channel."""
        await self.dc_handler.send_user_input(user_input)
                
    ################################################################################
    #
    # [Cleanup] Close
    #
    ################################################################################    
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
                await self.send_data(goodbye_msg)
                logger.info("Sent goodbye message before closing")
            except Exception as e:
                logger.error(f"Error sending goodbye message: {str(e)}")
            
        if self.pc:
            await self.pc.close()
            self.pc = None
            logger.info("WebRTC connection closed")
