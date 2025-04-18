

import asyncio
import websockets
import json
from typing import Callable, Any, Optional
import traceback
from WebSocketClient import WebSocketClient
from WebRTCClient import WebRTCClient
from loguru import logger

API_KEY     = "295e9daaa70fbfd2140ba42b3ddfab2c92e80c00e18020b953fab6ec3e8feacd"
ROOM_ID     = "53b083ee-431d-4b0f-ae6e-f330b3d6d16b"
PASSWORD    = "5c28fb65-c789-4ba8-9490-096a0245b343"

serverURL = f"ws://localhost:5173/websocket?apiKey={API_KEY}"

async def test_webrtc():
    # Create WebSocket client
    ws_client = WebSocketClient(serverURL)
    
    # Create WebRTC client using the WebSocket client
    webrtc_client = WebRTCClient(ws_client, ROOM_ID, PASSWORD)
    
    # Connect and start WebRTC
    if await ws_client.connect():
        # logger.debug("Connected to WebSocket server")
        pass

    

    await ws_client.run()

async def main():
    await test_webrtc()
       

if __name__ == "__main__":
    asyncio.run(main())
