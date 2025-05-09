import asyncio
import json
import sys
import select
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional
from aiortc import RTCConfiguration, RTCIceServer
from video_track import DummyVideoStreamTrack
        
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

        
    def __init__(self, device: Any):
        self.device = device
        self._force_connecting = False
        self._ice_gathering_complete = asyncio.Event()
        self.create_peer_connection()
        
    
        

    def handle_message(self, message: Dict[str, Any]) -> None:
        # logger.debug(f"Entry to handle_message: {json.dumps(message,indent=2)}")

        payload     = message.get('payload', {})
        action      = payload.get('action')
        msg_type    = payload.get('type')
        
        logger.debug(f"Received message: {action}: {msg_type}")

        if msg_type=="webrtc:connect":
            logger.debug(f"Entry to create offer")
            asyncio.create_task(self.create_offer(message))

        if msg_type=="webrtc:answer":
            logger.debug(f"Entry to handle answer")
            asyncio.create_task(self.handle_answer(message))

        if msg_type=="webrtc:ice-candidate":
            logger.debug(f"Entry to handle ice-candidate")
            asyncio.create_task(self.handle_ice_candidate(message))

    def create_peer_connection(self):
        """Create a new RTCPeerConnection and set up event handlers."""
        # Configure with STUN server using the correct aiortc format
        self.pc = RTCPeerConnection(configuration=RTCConfiguration(
            iceServers=[
                RTCIceServer(urls="stun:stun.l.google.com:19302"),
                # Optional TURN server for reliability behind NAT/firewalls:
                # RTCIceServer(urls="turn:your.turn.server:3478", username="user", credential="pass")
            ]
        ))
        
        # Setup event handlers
        self.pc.on('icecandidate', self.handle_local_ice_candidate)
        self.pc.on('connectionstatechange', self.on_connection_state_change)
        self.pc.on('iceconnectionstatechange', self.on_ice_connection_state_change)
        
        # Create data channel
        self.dc = self.pc.createDataChannel('chat')
        
        # Add event handlers
        self.dc.on('open', self.on_datachannel_open)
        
        # Start ICE gathering by creating an offer
        # This will trigger the icecandidate event
        # async def start_ice_gathering():
        #     try:
        #         offer = await self.pc.createOffer()
        #         await self.pc.setLocalDescription(offer)
        #         logger.debug("Started ICE gathering")
        #     except Exception as e:
        #         logger.error(f"Error starting ICE gathering: {str(e)}")
        
        # Start ICE gathering in the background
        # asyncio.create_task(start_ice_gathering())
        def on_datachannel_state_change():
            logger.debug(f"Data channel state changed: {self.dc.readyState}")
            
        self.dc.on('statechange', on_datachannel_state_change)

        def _on_icegatheringstatechange():
            if self.pc.iceGatheringState == "complete":
                self._ice_gathering_complete.set()
        self.pc.on("icegatheringstatechange", _on_icegatheringstatechange)

    def on_datachannel_message(self, event):
        """Handle incoming messages on the data channel."""
        message = json.loads(event.data)
        logger.debug(f"Received message: {message}")
        
        # Echo the message back
        self.dc.send(json.dumps({
            "text": f"Echo: {message['text']}",
            "timestamp": datetime.now().isoformat()
        }))


    ################################################################################
    #
    # Create Offer
    #
    ################################################################################
    ################################################################################
    # Create & send offer – only after ICE gathering is finished
    ################################################################################
    async def create_offer(self, message: dict):
        # make connectionId available to the ICE‑candidate callback
        self.connectionId = message["senderConnectionId"]

        # 1) create the SDP offer (no candidates yet)
        offer = await self.pc.createOffer()

        # 2) apply it – this *starts* gathering
        await self.pc.setLocalDescription(offer)

        # 3)  wait for "gathering‑complete" or timeout after 5 s
        try:
            await asyncio.wait_for(self._ice_gathering_complete.wait(), timeout=5)
        except asyncio.TimeoutError:
            logger.warning("ICE gathering timed out after 5 s")

        # 4)  pc.localDescription now contains a=candidate lines
        full_offer = self.pc.localDescription

        # 5)  send the offer through your signalling layer
        self.device.send_message({
            "type": "device",
            "scope": f"connection:{self.connectionId}",
            "payload": {
                "action":   "message",
                "type":     "webrtc:offer",
                "sdp":      full_offer.sdp,
                "deviceId": self.device.device_id,
            }
        })

        logger.debug(f"Sent offer with local candidates: {full_offer.sdp}")

       
    ################################################################################
    #
    # Handle Answer
    #
    ################################################################################
    async def handle_answer(self, message: dict):

        data = message['payload']

        sdp = data['sdp']
       
        logger.debug(f"Handling answer: {sdp}")
        
        # Create RTCSessionDescription from the answer
        answer = RTCSessionDescription(sdp=sdp, type='answer')
        
        # Set the remote description
        await self.pc.setRemoteDescription(answer)
        logger.debug("Set remote description successfully")
        
       
    ################################################################################
    #
    # Handle Local ICE Candidate
    #
    ################################################################################
    async def handle_local_ice_candidate(self, event):
        """Send local ICE candidate to remote peer via signaling server, with timestamp and message ID."""
        
        logger.debug(f"Received local ICE candidate: {event.candidate}")
       
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
                self.device.send_message({
                    'type': 'device',
                    'payload': {
                        'action': 'message',
                        'type': 'webrtc:ice-candidate',
                        'candidate': candidate_data,
                        'timestamp': timestamp,
                        '_clientMessageId': message_id
                    },
                    'scope': f'connection:{self.connectionId}'
                })
                logger.debug(f"Sent local ICE candidate: {candidate_data} (ID: {message_id})")
        except Exception as e:
            logger.error(f"Error sending local ICE candidate: {str(e)}")

    ################################################################################
    #
    # Handle ICE Candidate
    #
    ################################################################################
    async def handle_ice_candidate(self, message: dict):
        data = message['payload']
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

            logger.debug(f"Received ICE candidate: {json.dumps(candidate_info,indent=2)}")

            if not candidate_info:
                logger.warning("No candidate info in ICE candidate message")
                return

            # if candidate_info["type"] == "srflx":
            #     logger.debug("Skipping srflx candidate")
            #     return   

            
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

    ################################################################################
    #
    # Connection State Change
    #
    ################################################################################
    def on_connection_state_change(self):
        logger.debug(f"Connection state changed: {self.pc.connectionState}")
        
        # If connection is connected but data channel isn't open yet, check its state
        if self.pc.connectionState == "connected" and self.dc and self.dc.readyState == "connecting":
            logger.debug("Connection is connected but data channel still connecting. Checking in 1 second...")
            
            # Schedule a check after 1 second to see if we need to manually trigger open
            async def check_datachannel_state():
                await asyncio.sleep(1)
                if not self.dc:
                    logger.warning("Data channel no longer exists")
                    return
                    
                logger.debug(f"Data channel state after delay: {self.dc.readyState}")
                if self.dc.readyState == "open":
                    logger.debug("Data channel is now open, but event might not have fired. Triggering manually.")
                    self.on_datachannel_open()
                elif self.dc.readyState == "connecting":
                    logger.debug("Data channel still connecting after delay. Attempting to use it anyway.")
                    # Set a flag to indicate we're forcing usage of a connecting channel
                    # self._force_connecting = True
                    self.on_datachannel_open()
            
            asyncio.create_task(check_datachannel_state())

    ################################################################################
    #
    # ICE Connection State Change
    #
    ################################################################################
    def on_ice_connection_state_change(self):
        logger.debug(f"ICE connection state changed: {self.pc.iceConnectionState}")

    ################################################################################
    #
    # Data Channel Open
    #
    ################################################################################
    def on_datachannel_open(self):
        
        logger.debug("Data channel opened")
        
        # Check if data channel is actually usable
        if not self.dc:
            logger.error("Data channel is None, cannot proceed")
            return
            
        # Send a test message to verify the connection
        test_message = {
            "text": "Hello from Python client!",
            "timestamp": datetime.now().isoformat()
        }
        self.dc.send(json.dumps(test_message))
        logger.debug(f"Sent test message: {test_message}")