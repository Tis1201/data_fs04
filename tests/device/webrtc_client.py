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
        for cand in self.pending_local_candidates:
            await self._on_ice_candidate(cand)
        self.pending_local_candidates.clear()
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
            # Create an RTCIceCandidate from the candidate string
            candidate = RTCIceCandidate({
                'candidate': ci.get('candidate'),
                'sdpMid': ci.get('sdpMid'),
                'sdpMLineIndex': ci.get('sdpMLineIndex')
            })
            await self.pc.addIceCandidate(candidate)
            logger.debug("Added remote ICE candidate")
        except Exception as e:
            logger.error(f"Error handling ICE candidate: {e}")

    def initialize(self) -> None:
        if self.pc:
            asyncio.create_task(self.close())
        self.reconnect_attempts = 0
        self.pc = RTCPeerConnection(configuration=RTCConfiguration())
        self.pc.on("icecandidate", self._on_ice_candidate)
        self.pc.on("connectionstatechange", self._on_connection_state_change)
        self.pc.on("iceconnectionstatechange", self._on_ice_connection_state_change)
        self.pc.on("icegatheringstatechange", self._on_ice_gathering_state_change)
        self.pc.on("datachannel", self._on_data_channel)
        self.dc = self.pc.createDataChannel("dummy-device")
        self._setup_data_channel_handlers(self.dc)
        logger.info("WebRTC client initialized")

    async def create_offer(self, ice_restart: bool = False) -> Dict[str, Any]:
        # Create offer
        offer = await self.pc.createOffer()
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
        
        # Generate message ID and create the message
        message_id = self._generate_message_id("offer")
        return {
            "id": message_id,
            "type": "device",
            "payload": {
                "action": "message", 
                "type": "webrtc:offer", 
                "sdp": self.pc.localDescription.sdp, 
                "_clientMessageId": message_id
            },
        }

    async def _on_ice_candidate(self, candidate: Any) -> None:
        if not candidate:
            logger.debug("Received null ICE candidate, gathering complete")
            return
            
        logger.debug(f"Local ICE candidate gathered: {candidate.candidate}")
        logger.debug(f"ICE candidate details - sdpMid: {candidate.sdpMid}, sdpMLineIndex: {candidate.sdpMLineIndex}")
        
        # If remote description is not set yet, buffer the candidate
        if not self.pc.remoteDescription:
            logger.debug(f"Remote description not set yet, buffering ICE candidate")
            self.pending_local_candidates.append(candidate)
            return
        
        # Send the ICE candidate to the remote peer
        mid = self._generate_message_id("ice")
        msg = {
            "id": mid,
            "type": "device",
            "payload": {
                "action": "message",
                "type": "webrtc:ice-candidate",
                "deviceId": self.device.device_id,
                "candidate": {
                    "candidate": candidate.candidate,
                    "sdpMid": candidate.sdpMid,
                    "sdpMLineIndex": candidate.sdpMLineIndex,
                },
                "_clientMessageId": mid,
            },
        }
        
        # Send the message
        self.device.send_message(msg)
        logger.debug(f"ICE candidate sent to remote peer: {candidate.candidate}")

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
