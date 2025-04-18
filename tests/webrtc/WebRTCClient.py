import asyncio
from math import log
from aiortc import RTCPeerConnection, RTCSessionDescription
from typing import Callable, Optional, Dict, Any
from WebSocketClient import WebSocketClient
from loguru import logger   
from RoomClient import RoomClient

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
        self.pc.on('icecandidate', self.handle_ice_candidate)
        self.pc.on('connectionstatechange', self.on_connection_state_change)
        self.pc.on('iceconnectionstatechange', self.on_ice_connection_state_change)
        
        # Create data channel
        self.dc = self.pc.createDataChannel('chat')
        self.dc.on('open', self.on_datachannel_open)
        self.dc.on('message', self.on_datachannel_message)

    def on_datachannel_open(self):
        logger.debug("Data channel opened")

    def on_datachannel_message(self, message):
        logger.debug(f"Received message: {message}")

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

    def handle_ice_candidate(self, event):
        """Handle ICE candidates"""
        if event.candidate:
            logger.debug(f"Sending ICE candidate: {event.candidate}")
            asyncio.create_task(self.websocket_client.send({
                'type': 'webrtc',
                'action': 'candidate',
                'data': {
                    'candidate': event.candidate.candidate,
                    'sdpMid': event.candidate.sdpMid,
                    'sdpMLineIndex': event.candidate.sdpMLineIndex
                }
            }))        

   