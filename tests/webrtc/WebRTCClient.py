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
        logger.debug(f"WebRTC message received: {message}")
        pass

    def create_webrtc_connection(self, data):
        logger.debug(f"Creating WebRTC connection: {data}")
        self.pc = RTCPeerConnection()
        
        # Setup event handlers
        self.pc.on('iceConnectionStateChange', lambda state: logger.debug(f"ICE connection state: {state}"))
        self.pc.on('iceGatheringStateChange', lambda state: logger.debug(f"ICE gathering state: {state}"))
        self.pc.on('icecandidate', self.handle_ice_candidate)
        self.pc.on('connectionstatechange', lambda state: logger.debug(f"Connection state: {state}"))
        
        # Create data channel
        self.dc = self.pc.createDataChannel('chat')
        self.dc.on('open', lambda: logger.debug("Data channel opened"))
        self.dc.on('message', lambda message: logger.debug(f"Received message: {message}"))
        
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

    def handle_webrtc_message(self, message: dict):
        logger.debug(f"WebRTC message received: {message}")
