import asyncio
from math import log
from aiortc import RTCPeerConnection, RTCSessionDescription
from typing import Callable, Optional, Dict, Any
from WebSocketClient import WebSocketClient
from loguru import logger   

class WebRTCClient:
    def __init__(self, websocket_client: WebSocketClient, room_id: str, password: str):
        self.websocket_client = websocket_client
        self.socketId = None
        self.userId = None
        self.authMethod = None
        self.roomId = room_id
        self.password = password
        
        # Register handlers
        self.websocket_client.register_message_handler(self.handle_message)
        self.websocket_client.register_ready_handler(lambda msg: asyncio.create_task(self.handle_ready(msg)))
        self.websocket_client.register_close_handler(lambda: asyncio.create_task(self.handle_close()))
        self.websocket_client.register_error_handler(lambda err: asyncio.create_task(self.handle_error(err)))

    def handle_message(self, message: dict):
        """Handle incoming WebSocket messages"""
        

        if message['type'] == 'room':
            self.handle_room_message(message)
            return

        if message['type'] == 'webrtc':
            self.handle_webrtc_message(message)
            return
        
        logger.debug(f"Received unhandled message: {message}")

    def handle_room_message(self, message: dict):
        

        if message["action"] == "joined":
            # logger.debug(f"Joined room: {message['data']}")
            self.create_webrtc_connection(message['data'])
            return

        logger.debug(f"Room message received: {message}")


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
        
        # Create offer
        asyncio.create_task(self.create_offer())

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

    async def handle_ready(self, message: dict):
        self.socketId = message['data']['socketId']
        self.userId = message['data']['userId']
        self.authMethod = message['data']['authMethod']
        logger.debug(f"Ready event received: {message['data']}")
        logger.debug(f"Socket ID: {message['data']['socketId']}")
        logger.debug(f"User ID: {message['data']['userId']}")

        await self.join_room()

    async def join_room(self):
        message = {
            "type": "room",
            "action": "join",
            "data": {
                "roomId": self.roomId,
                "password": self.password
            }
        }
        await self.websocket_client.send(message) 

    def handle_close(self):
        """Handle WebSocket connection close"""
        logger.debug("WebSocket connection closed")

    def handle_error(self, error: Exception):
        """Handle WebSocket errors"""
        logger.debug(f"WebSocket error: {str(error)}")

    
        