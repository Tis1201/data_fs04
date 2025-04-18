import asyncio
from math import log
from aiortc import RTCPeerConnection, RTCSessionDescription
from typing import Callable, Optional, Dict, Any
from WebSocketClient import WebSocketClient
from loguru import logger   

class RoomClient:
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
        elif message['type'] == 'webrtc':
            pass
        
        # logger.debug(f"Received unhandled message: {message}")

    def handle_room_message(self, message: dict):

        # logger.debug(f"Room message received: {message}")
        
        if message["action"] == "joined":
            # logger.debug(f"Joined room: {message['data']}")
            self.handle_room_joined(message)
            return

        # logger.debug(f"Room message received: {message}")

    def handle_room_joined(self, message: dict):
        logger.debug(f"Joined room: {message}")
        pass

    
    async def handle_ready(self, message: dict):
        self.socketId = message['data']['socketId']
        self.userId = message['data']['userId']
        self.authMethod = message['data']['authMethod']
        logger.debug(f"[Room] Websocket Ready: {message['data']['socketId']}:{message['data']['userId']}")
        await self.join_room()

    async def join_room(self):
        logger.debug(f"[Room] Requesting to join room: {self.roomId}")
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

    
        