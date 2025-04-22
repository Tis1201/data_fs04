import asyncio
import websockets
from typing import Callable, Any, Optional
import json

class WebSocketClient:
    def __init__(self, url: str, reconnect_attempts: int = 3, reconnect_delay: float = 1.0):
        """
        Initialize WebSocket client
        
        Args:
            url: WebSocket server URL
            reconnect_attempts: Number of reconnection attempts
            reconnect_delay: Delay between reconnection attempts
        """
        self.url = url
        self.websocket = None
        self.reconnect_attempts = reconnect_attempts
        self.reconnect_delay = reconnect_delay
        self._connected = False
        self._message_handlers = []
        self._closed_handlers = []
        self._error_handlers = []

    async def connect(self) -> bool:
        """Connect to the WebSocket server"""
        try:
            self.websocket = await websockets.connect(self.url)
            self._connected = True
            return True
        except Exception as e:
            print(f"Connection failed: {str(e)}")
            return False

    async def send(self, message: Any) -> bool:
        """Send a message through the WebSocket connection"""
        if not self._connected:
            print("WebSocket not connected")
            return False

        try:
            await self.websocket.send(json.dumps(message))
            return True
        except Exception as e:
            print(f"Failed to send message: {str(e)}")
            return False

    async def receive(self) -> Optional[dict]:
        """Receive a message from the WebSocket connection"""
        if not self._connected:
            print("WebSocket not connected")
            return None

        try:
            message = await self.websocket.recv()
            return json.loads(message)
        except Exception as e:
            print(f"Failed to receive message: {str(e)}")
            return None

    async def close(self) -> None:
        """Close the WebSocket connection"""
        if self.websocket and self._connected:
            await self.websocket.close()
            self._connected = False

    def register_message_handler(self, handler: Callable[[dict], None]) -> None:
        """Register a message handler function"""
        self._message_handlers.append(handler)

    def register_close_handler(self, handler: Callable[[], None]) -> None:
        """Register a close handler function"""
        self._closed_handlers.append(handler)

    def register_error_handler(self, handler: Callable[[Exception], None]) -> None:
        """Register an error handler function"""
        self._error_handlers.append(handler)

    async def _handle_message(self, message: dict) -> None:
        """Internal method to handle incoming messages"""
        for handler in self._message_handlers:
            try:
                handler(message)
            except Exception as e:
                print(f"Error in message handler: {str(e)}")

    async def _handle_close(self) -> None:
        """Internal method to handle connection close"""
        self._connected = False
        for handler in self._closed_handlers:
            try:
                handler()
            except Exception as e:
                print(f"Error in close handler: {str(e)}")

    async def _handle_error(self, error: Exception) -> None:
        """Internal method to handle errors"""
        for handler in self._error_handlers:
            try:
                handler(error)
            except Exception as e:
                print(f"Error in error handler: {str(e)}")

    async def run(self) -> None:
        """Run the WebSocket client with automatic reconnection"""
        attempts = 0
        
        while attempts < self.reconnect_attempts:
            try:
                if not self._connected:
                    if await self.connect():
                        attempts = 0
                        print("WebSocket connected successfully")
                        break
                    else:
                        attempts += 1
                        await asyncio.sleep(self.reconnect_delay)
                        continue

                while True:
                    message = await self.receive()
                    if message:
                        await self._handle_message(message)
                    else:
                        break

            except websockets.exceptions.ConnectionClosed:
                print("WebSocket connection closed")
                await self._handle_close()
                break
            except Exception as e:
                print(f"WebSocket error: {str(e)}")
                await self._handle_error(e)
                attempts += 1
                await asyncio.sleep(self.reconnect_delay)

        if attempts >= self.reconnect_attempts:
            print("Max reconnection attempts reached")
            await self._handle_close()
