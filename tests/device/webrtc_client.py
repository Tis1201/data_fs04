import asyncio
import json
import sys
import select
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from aiortc import (
    RTCPeerConnection,
    RTCSessionDescription,
    RTCConfiguration,
    RTCIceServer,
    RTCDataChannel,
    RTCIceCandidate,
)
from loguru import logger

from data_channel import DataChannelHandler

class WebRTCClient:
    """WebRTC client for the dummy device to handle WebRTC connections."""

    CONNECTED_STATES = ['connected', 'completed']
    FAILED_STATES = ['failed', 'closed']

    def _generate_message_id(self, prefix: str = "msg") -> str:
        message_id = f"{prefix}-{datetime.now().isoformat()}-{uuid.uuid4().hex[:8]}"
        self.sent_message_ids.add(message_id)
        return message_id

    def __init__(self, device: Any):
        self.device = device
        self.pc: Optional[RTCPeerConnection] = None
        self.dc = None
        self.sent_message_ids: set[str] = set()
        self.pending_local_candidates: List[Any] = []
        self.input_task = None
        self.reconnect_attempts = 0
        self.max_reconnect_attempts = 5
        self.dc_handler = DataChannelHandler(self)

    async def handle_message(self, message: Dict[str, Any]) -> None:
        logger.debug("Entry to handle_message")
        payload = message.get('payload', {})
        action = payload.get('action')
        msg_type = payload.get('type')
        handlers = {
            'webrtc:connect': self.handle_connect,
            'webrtc:answer': self.handle_answer,
            'webrtc:ice-candidate': self.handle_remote_ice_candidate,
        }
        if action == 'message' and msg_type in handlers:
            await handlers[msg_type](message)
        else:
            logger.warning(f"Unknown message type: {msg_type}")

    async def handle_connect(self, message: Dict[str, Any]) -> None:
        self.initialize()
        offer_msg = await self.create_offer()
        if 'senderConnectionId' in message:
            offer_msg['scope'] = f"connection:{message['senderConnectionId']}"
        self.device.send_message(offer_msg)
        logger.info("Sent WebRTC offer in response to connect request")
        
        # After sending the offer, explicitly send all local ICE candidates
        await self._send_all_local_ice_candidates(message.get('senderConnectionId'))

    async def handle_answer(self, message: Dict[str, Any]) -> None:
        logger.info("Received WebRTC answer")
        payload = message.get('payload', {})
        sdp = payload.get('sdp')
        if not sdp:
            logger.error("No SDP in answer message")
            return
        answer = RTCSessionDescription(sdp=sdp, type='answer')
        await self.pc.setRemoteDescription(answer)
        logger.info("Set remote description from answer")
        
        # Send any pending local candidates now that we have the remote description
        connection_id = message.get('senderConnectionId')
        for cand in self.pending_local_candidates:
            try:
                await self._send_ice_candidate(cand, connection_id)
            except Exception as e:
                logger.error(f"Error sending pending ICE candidate: {e}")
        self.pending_local_candidates.clear()
        
        # Also send all local candidates that might not have been sent yet
        await self._send_all_local_ice_candidates(connection_id)
        
        # Send initial message if data channel is open
        if self.dc and self.dc.readyState == "open":
            msg = {"text": "Hello from device!", "timestamp": datetime.now().isoformat()}
            await self.send_data(msg)

    async def handle_remote_ice_candidate(self, message: Dict[str, Any]) -> None:
        payload = message.get('payload', {})
        ci = payload.get('candidate', {})
        
        if not isinstance(ci, dict):
            logger.error("ICE candidate format invalid or missing")
            return
        
        msg_id = payload.get('_clientMessageId')
        if msg_id in self.sent_message_ids:
            return
        
        try:
            # Log the full candidate message for debugging
            logger.debug(f"Received ICE candidate message: {message}")
            
            # Extract candidate information
            candidate_str = ci.get('candidate', '')
            sdp_mid = ci.get('sdpMid', '')
            sdp_mline_index = ci.get('sdpMLineIndex', 0)
            
            # Parse the candidate string
            parts = candidate_str.split()
            if len(parts) >= 8 and parts[0].startswith('candidate:'):
                foundation = parts[0].split(':')[1]
                component = int(parts[1])
                ip = parts[4]
                port = int(parts[5])
                protocol = parts[6]
                type_ = parts[7]
                
                # Create the ICE candidate with all required parameters
                candidate = RTCIceCandidate(
                    component=component,
                    foundation=foundation,
                    ip=ip,
                    port=port,
                    priority=int(parts[3]),
                    protocol=protocol,
                    type=type_,
                    sdpMid=sdp_mid,
                    sdpMLineIndex=sdp_mline_index
                )
                
                logger.debug(f"Parsed ICE candidate: {candidate}")
                await self.pc.addIceCandidate(candidate)
                logger.debug("Added remote ICE candidate")
            else:
                logger.error(f"Invalid candidate string format: {candidate_str}")
        except Exception as e:
            logger.error(f"Error handling ICE candidate: {e}")

    def initialize(self) -> None:
        if self.pc:
            asyncio.create_task(self.close())
        self.reconnect_attempts = 0
        
        # Create RTCPeerConnection with ICE servers configuration
        ice_servers = [RTCIceServer(urls="stun:stun.l.google.com:19302")]
        config = RTCConfiguration(iceServers=ice_servers)
        self.pc = RTCPeerConnection(configuration=config)
        
        # Set up event handlers
        self.pc.on("icecandidate", self._on_ice_candidate)
        self.pc.on("connectionstatechange", self._on_connection_state_change)
        self.pc.on("iceconnectionstatechange", self._on_ice_connection_state_change)
        self.pc.on("icegatheringstatechange", self._on_ice_gathering_state_change)
        self.pc.on("datachannel", self._on_data_channel)
        
        # Create data channel
        self.dc = self.pc.createDataChannel("dummy-device")
        self._setup_data_channel_handlers(self.dc)
        logger.info("WebRTC client initialized with STUN server")

    async def create_offer(self, ice_restart: bool = False) -> Dict[str, Any]:
        # Create offer with ice_restart option if specified
        offer_options = {}
        if ice_restart:
            offer_options = {'iceRestart': True}
            
        offer = await self.pc.createOffer(**offer_options)
        logger.debug(f"Created offer: {offer.sdp}")
        
        # Set local description to trigger ICE gathering
        await self.pc.setLocalDescription(offer)
        logger.debug("Local description set, ICE gathering started")
        
        # Wait for ICE gathering to complete
        logger.debug(f"Initial ICE gathering state: {self.pc.iceGatheringState}")
        while self.pc.iceGatheringState != "complete":
            logger.debug(f"Waiting for ICE gathering to complete. Current state: {self.pc.iceGatheringState}")
            await asyncio.sleep(0.1)
        
        logger.debug(f"ICE gathering completed. Final SDP: {self.pc.localDescription.sdp}")
        
        # Generate message ID and create the message for the offer
        message_id = self._generate_message_id("offer")
        offer_msg = {
            "id": message_id,
            "type": "device",
            "payload": {
                "action": "message", 
                "type": "webrtc:offer", 
                "sdp": self.pc.localDescription.sdp, 
                "_clientMessageId": message_id
            },
        }
        
        # Return the offer message
        return offer_msg

    async def _on_ice_candidate(self, candidate: Any) -> None:
        if not candidate:
            logger.debug("Received null ICE candidate, gathering complete")
            return
            
        logger.debug(f"Local ICE candidate gathered: {candidate}")
        
        # Extract candidate information if it's a string
        if isinstance(candidate, str):
            logger.debug(f"Candidate is a string: {candidate}")
            # Parse the candidate string
            if candidate.startswith('candidate:'):
                parts = candidate.split()
                if len(parts) >= 8:
                    foundation = parts[0].split(':')[1]
                    component = int(parts[1])
                    protocol = parts[2]
                    priority = int(parts[3])
                    ip = parts[4]
                    port = int(parts[5])
                    typ = parts[7]
                    
                    # Create RTCIceCandidate object
                    candidate = RTCIceCandidate(
                        component=component,
                        foundation=foundation,
                        ip=ip,
                        port=port,
                        priority=priority,
                        protocol=protocol,
                        type=typ,
                        sdpMid="0",  # Default to first media section
                        sdpMLineIndex=0
                    )
        
        # Log candidate details
        if isinstance(candidate, RTCIceCandidate):
            logger.debug(f"ICE candidate details - candidate: {candidate.candidate}, sdpMid: {candidate.sdpMid}, sdpMLineIndex: {candidate.sdpMLineIndex}")
        else:
            logger.debug(f"ICE candidate details - string: {candidate}")
        
        # If remote description is not set yet, buffer the candidate
        if not self.pc.remoteDescription:
            logger.debug(f"Remote description not set yet, buffering ICE candidate")
            self.pending_local_candidates.append(candidate)
            return
        
        # Send the ICE candidate to the remote peer
        await self._send_ice_candidate(candidate)
    
    async def _send_ice_candidate(self, candidate: Any, connection_id: Optional[str] = None) -> None:
        """Send a single ICE candidate to the remote peer."""
        message_id = self._generate_message_id("ice")
        
        # Create the candidate dictionary based on the candidate type
        if isinstance(candidate, dict) and "candidate" in candidate:
            # Already a properly formatted candidate dict
            candidate_dict = candidate
        elif isinstance(candidate, RTCIceCandidate) and hasattr(candidate, 'candidate'):
            # RTCIceCandidate with candidate attribute
            candidate_dict = {
                "candidate": candidate.candidate,
                "sdpMid": candidate.sdpMid,
                "sdpMLineIndex": candidate.sdpMLineIndex
            }
        elif isinstance(candidate, str):
            # String candidate
            candidate_dict = {
                "candidate": candidate,
                "sdpMid": "0",
                "sdpMLineIndex": 0
            }
        else:
            # Unknown format, log and skip
            logger.error(f"Unknown candidate format: {type(candidate)}, {candidate}")
            return
        
        msg = {
            "id": message_id,
            "type": "device",
            "payload": {
                "action": "message",
                "type": "webrtc:ice-candidate",
                "candidate": candidate_dict,
                "_clientMessageId": message_id
            }
        }
        
        # Add connection scope if provided
        if connection_id:
            msg['scope'] = f"connection:{connection_id}"
            
        self.device.send_message(msg)
        logger.debug(f"ICE candidate sent to remote peer: {candidate_dict['candidate']}")
        
    async def _send_all_local_ice_candidates(self, connection_id: Optional[str] = None) -> None:
        """Send all gathered local ICE candidates to the remote peer."""
        logger.debug("Sending all local ICE candidates to remote peer")
        
        # Extract candidates from SDP
        local_candidates = []
        if self.pc and self.pc.localDescription and self.pc.localDescription.sdp:
            sdp_lines = self.pc.localDescription.sdp.split('\n')
            for line in sdp_lines:
                if line.startswith('a=candidate:'):
                    # Extract candidate string (remove 'a=' prefix)
                    candidate_str = line[2:]
                    local_candidates.append({
                        "candidate": candidate_str,
                        "sdpMid": "0",  # Default to first media section
                        "sdpMLineIndex": 0
                    })
                    logger.debug(f"Extracted candidate from SDP: {candidate_str}")
        
        # Send each candidate individually
        for candidate_dict in local_candidates:
            try:
                message_id = self._generate_message_id("ice")
                msg = {
                    "id": message_id,
                    "type": "device",
                    "payload": {
                        "action": "message",
                        "type": "webrtc:ice-candidate",
                        "candidate": candidate_dict,
                        "_clientMessageId": message_id
                    }
                }
                
                # Add connection scope if provided
                if connection_id:
                    msg['scope'] = f"connection:{connection_id}"
                    
                self.device.send_message(msg)
                logger.debug(f"ICE candidate sent to remote peer: {candidate_dict['candidate']}")
            except Exception as e:
                logger.error(f"Error sending ICE candidate: {e}")
            
        logger.debug(f"Sent {len(local_candidates)} local ICE candidates to remote peer")

    def _on_connection_state_change(self) -> None:
        state = self.pc.connectionState
        logger.info(f"Connection state changed: {state}")
        if state == 'connected' and (not self.input_task or self.input_task.done()):
            self.input_task = asyncio.create_task(self._console_input_loop())
        elif state in self.FAILED_STATES:
            logger.info("Connection failed, restarting ICE")
            self.pc.restartIce()

    def _on_ice_connection_state_change(self) -> None:
        logger.debug(f"ICE connection state: {self.pc.iceConnectionState}")

    def _on_ice_gathering_state_change(self) -> None:
        logger.debug(f"ICE gathering state: {self.pc.iceGatheringState}")
        
        # When ICE gathering is complete, process any candidates that may have been gathered
        if self.pc.iceGatheringState == "complete":
            logger.debug("ICE gathering completed, processing candidates")
            
            # Register candidates with the icecandidate handler if they're not already registered
            if self.pc.localDescription and self.pc.localDescription.sdp:
                sdp_lines = self.pc.localDescription.sdp.split('\n')
                for line in sdp_lines:
                    if line.startswith('a=candidate:'):
                        logger.debug(f"Found candidate in SDP: {line}")

    def _setup_data_channel_handlers(self, channel: Any) -> None:
        self.dc_handler.setup_handlers(channel)

    def _on_data_channel(self, channel: Any) -> None:
        self.dc = channel
        self._setup_data_channel_handlers(channel)

    async def send_data(self, data: Any) -> Any:
        return await self.dc_handler.send_data(data)

    async def _console_input_loop(self) -> None:
        try:
            while True:
                if not self.pc or self.pc.connectionState in self.FAILED_STATES:
                    break
                await asyncio.sleep(0.1)
                if select.select([sys.stdin], [], [], 0)[0]:
                    await self._send_user_input(sys.stdin.readline().strip())
        except asyncio.CancelledError:
            pass

    async def _send_user_input(self, user_input: str) -> None:
        await self.dc_handler.send_user_input(user_input)

    async def close(self) -> None:
        if self.dc and self.dc.readyState == 'open':
            await self.send_data({'type': 'goodbye', 'timestamp': datetime.now().isoformat()})
        if self.pc:
            await self.pc.close()
            self.pc = None
            logger.info("WebRTC connection closed")
