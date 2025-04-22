

import asyncio
import websockets
import json
from typing import Callable, Any, Optional
import traceback
from loguru import logger


class WebSocketClient:
    def __init__(self, url: str):
        self.url = url
        self.websocket = None
        self._connected = False
        self._message_handlers = []
        self._closed_handlers = []
        self._error_handlers = []

    async def connect(self) -> bool:
        try:
            self.websocket = await websockets.connect(self.url)
            self._connected = True
            logger.debug("[WebSocket] connected")
            return True
        except Exception as e:
            logger.debug(f"[WebSocket] Connection failed: {str(e)}")
            return False

    async def send(self, message: Any) -> bool:
        if not self._connected:
            logger.debug("WebSocket not connected")
            return False

        try:
            await self.websocket.send(json.dumps(message))
            return True
        except Exception as e:
            logger.debug(f"Failed to send message: {str(e)}")
            return False

    async def receive(self) -> Optional[dict]:
        if not self._connected:
            logger.debug("WebSocket not connected")
            return None

        try:
            message = await self.websocket.recv()
            return json.loads(message)
        except Exception as e:
            logger.debug(f"Failed to receive message: {str(e)}")
            return None

    async def close(self) -> None:
        if self.websocket and self._connected:
            await self.websocket.close()
            self._connected = False

    def register_message_handler(self, handler: Callable[[dict], None]) -> None:
        self._message_handlers.append(handler)

    def register_ready_handler(self, handler: Callable[[dict], None]) -> None:
        """Register a handler for the ready event (when welcome message is received)"""
        self._ready_handlers = []
        self._ready_handlers.append(handler)

    def register_close_handler(self, handler: Callable[[], None]) -> None:
        self._closed_handlers.append(handler)

    def register_error_handler(self, handler: Callable[[Exception], None]) -> None:
        self._error_handlers.append(handler)

    async def _handle_message(self, message: dict) -> None:
        # Handle ready event (welcome message)
        if message.get('type') == 'welcome':
            for handler in self._ready_handlers:
                try:
                    handler(message)
                except Exception as e:
                    logger.debug(f"Error in ready handler: {str(e)}")
            return
        
        # Handle regular message handlers
        for handler in self._message_handlers:
            try:
                handler(message)
            except Exception as e:
                logger.debug(f"Error in message handler: {str(e)}")

    async def _handle_close(self) -> None:
        self._connected = False
        for handler in self._closed_handlers:
            try:
                handler()
            except Exception as e:
                logger.debug(f"Error in close handler: {str(e)}")

    async def _handle_error(self, error: Exception) -> None:
        for handler in self._error_handlers:
            try:
                handler(error)
            except Exception as e:
                logger.debug(f"Error in error handler: {str(e)}")

    async def run(self) -> None:
        try:
            while True:
                message = await self.receive()
                if message:
                    await self._handle_message(message)
                else:
                    break
        except websockets.exceptions.ConnectionClosed:
            logger.debug("WebSocket connection closed")
            await self._handle_close()
        except Exception as e:
            logger.debug(f"WebSocket error: {str(e)}")
            await self._handle_error(e)

