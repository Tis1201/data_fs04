

import asyncio
import websockets
import json
from typing import Callable, Any, Optional
import traceback
from WebSocketClient import WebSocketClient
from WebRTCClient import WebRTCClient
from loguru import logger

API_KEY     = "295e9daaa70fbfd2140ba42b3ddfab2c92e80c00e18020b953fab6ec3e8feacd"

serverURL = f"ws://localhost:5173/websocket?apiKey={API_KEY}"

roomInfoURL = f"http://localhost:5173/api/test/latest-room"

def get_room_info():
    import requests
    import uuid
    
    # Force a new room creation by adding a unique query parameter
    unique_url = f"{roomInfoURL}?_={uuid.uuid4()}"
    response = requests.get(unique_url)
    return response.json()

async def test_webrtc():

    room = get_room_info()
    # logger.debug(f"[Room] Room info: {room}")

    roomId      = room['id']
    password    = room['password']

    logger.debug(f"Using room {roomId} with password {password}")

    # Create WebSocket client
    ws_client = WebSocketClient(serverURL)
    
    # Create WebRTC client using the WebSocket client
    webrtc_client = WebRTCClient(ws_client, roomId, password)
    
    # Connect and start WebRTC
    if await ws_client.connect():
        # logger.debug("Connected to WebSocket server")
        pass

    await ws_client.run()

async def main():
    await test_webrtc()
       

if __name__ == "__main__":
    asyncio.run(main())
