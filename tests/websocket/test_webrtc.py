#!/usr/bin/env python3
"""
WebRTC Data Channel Test Client
Creates a WebRTC connection with a data channel through a WebSocket signaling server.
"""

import asyncio, json, signal, sys, time, threading, queue, fractions
import numpy as np, cv2
from datetime import datetime
import logging
import websockets
from aiortc import RTCPeerConnection, RTCSessionDescription, RTCIceCandidate, VideoStreamTrack
from aiortc.rtcconfiguration import RTCConfiguration
from aiortc.rtcicetransport import RTCIceServer
from av import VideoFrame

# Basic logging configuration
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[logging.StreamHandler()]
)
logger = logging.getLogger(__name__)

# Video and connection configuration
VIDEO_WIDTH, VIDEO_HEIGHT, VIDEO_FPS = 640, 480, 15
WS_URL = "ws://localhost:5173/websocket"
API_KEY = "24889110d449389080bd30b9681fbca41105e1b27806f4b1825b930c66511719"
RECONNECT_INTERVAL, MAX_RECONNECT_ATTEMPTS = 5, 5

# Global state variables
peer_connection = None
data_channel = None
ws_connection = None
reconnect_attempts = 0
running = True
input_queue = queue.Queue()
message_event = threading.Event()
video_sender = None
sent_message_ids = set()
client_id = None

# --- WebSocket Signaling Functions ---

async def connect_websocket():
    full_url = f"{WS_URL}?apiKey={API_KEY}"
    logger.info(f"Connecting to {full_url}")
    return await websockets.connect(full_url)

async def send_webrtc_message(ws, msg_type, data):
    message_id = f"{msg_type}-{datetime.now().isoformat()}"
    message = {
        "type": "webrtc",
        "data": {
            "type": msg_type,
            **data,
            "timestamp": datetime.now().isoformat(),
            "_clientMessageId": message_id
        }
    }
    sent_message_ids.add(message_id)
    logger.info(f"Sending {msg_type} message (ID: {message_id})")
    await ws.send(json.dumps(message))

# --- Data Channel Setup ---

async def setup_data_channel(channel):
    global data_channel
    data_channel = channel

    @channel.on("open")
    def on_open():
        logger.info(f"Data channel '{channel.label}' opened")
        asyncio.create_task(send_test_message())

    @channel.on("close")
    def on_close():
        logger.info(f"Data channel '{channel.label}' closed")
        print("\n>>> Data channel closed.")

    @channel.on("message")
    def on_message(message):
        if isinstance(message, str):
            print(f"\n>>> Received: {message}")
            try:
                data = json.loads(message)
                if data.get("type") == "ping":
                    response = {
                        "text": "Response from Python client",
                        "originalMessage": data,
                        "timestamp": datetime.now().isoformat()
                    }
                    data_channel.send(json.dumps(response))
                    logger.info(f"Sent response: {response}")
            except json.JSONDecodeError:
                logger.info("Received non-JSON message")
        else:
            logger.info(f"Received binary message on '{channel.label}': {len(message)} bytes")

async def send_test_message():
    await asyncio.sleep(1)
    if data_channel and data_channel.readyState == "open":
        test_message = {
            "text": "Hello from Python data channel!",
            "timestamp": datetime.now().isoformat(),
            "clientId": client_id
        }
        data_channel.send(json.dumps(test_message))
        logger.info(f"Sent test message: {test_message}")
        print("\n>>> Data channel is open. Type your message (or 'exit' to quit).")

# --- Video Track ---

class CustomVideoStreamTrack(VideoStreamTrack):
    def __init__(self, camera_index=0, use_camera=False):
        super().__init__()
        self.frame_count = 0
        self.use_camera = use_camera
        self.cap = None
        if use_camera:
            self.cap = cv2.VideoCapture("file:///Users/bernard/Documents/work/projects/nicekey/video_search/frigate/media/recordings/2024-10-05/13/my_webcam/00.06.mp4")
            if not self.cap.isOpened():
                logger.error("Failed to open camera, using test pattern")
                self.use_camera = False
            else:
                self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, VIDEO_WIDTH)
                self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, VIDEO_HEIGHT)
                logger.info("Camera opened")

    async def recv(self):
        self.frame_count += 1
        if self.use_camera and self.cap and self.cap.isOpened():
            ret, frame = self.cap.read()
            if not ret:
                logger.warning("Camera frame read failed; using test pattern")
                frame = self._create_test_frame()
            frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        else:
            frame = self._create_test_frame()
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
        cv2.putText(frame, f"Frame: {self.frame_count} - {timestamp}", (10, 30),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255,255,255), 2)
        video_frame = VideoFrame.from_ndarray(frame, format="rgb24")
        video_frame.pts = self.frame_count
        video_frame.time_base = fractions.Fraction(1, VIDEO_FPS)
        await asyncio.sleep(1/VIDEO_FPS)
        return video_frame

    def _create_test_frame(self):
        frame = np.zeros((VIDEO_HEIGHT, VIDEO_WIDTH, 3), dtype=np.uint8)
        t = self.frame_count % 100 / 10.0
        for y in range(VIDEO_HEIGHT):
            for x in range(VIDEO_WIDTH):
                r = int(128 + 127 * np.sin(x / 50.0 + t))
                g = int(128 + 127 * np.sin(y / 50.0 + t * 0.7))
                b = int(128 + 127 * np.sin((x + y) / 100.0 + t * 1.3))
                frame[y, x] = [r, g, b]
        center_x = int(VIDEO_WIDTH/2 + VIDEO_WIDTH/4 * np.sin(t * 0.5))
        center_y = int(VIDEO_HEIGHT/2 + VIDEO_HEIGHT/4 * np.cos(t * 0.5))
        cv2.circle(frame, (center_x, center_y), 50, (0,0,0), -1)
        cv2.circle(frame, (center_x, center_y), 45, (255,255,255), -1)
        cv2.putText(frame, "WebRTC Test Stream", (int(VIDEO_WIDTH/2)-120, int(VIDEO_HEIGHT/2)+5),
                    cv2.FONT_HERSHEY_SIMPLEX, 1.0, (0,0,0), 4)
        return frame

    def __del__(self):
        if self.cap and self.cap.isOpened():
            self.cap.release()
            logger.info("Camera released")

# --- Peer Connection Offer/Answer & ICE ---

async def generate_data_channel_offer():
    global peer_connection, video_sender
    try:
        config = RTCConfiguration(iceServers=[RTCIceServer(urls=["stun:stun.l.google.com:19302"])])
        peer_connection = RTCPeerConnection(configuration=config)
        logger.info("Created peer connection")

        @peer_connection.on("connectionstatechange")
        async def on_connectionstatechange():
            logger.info(f"Connection state: {peer_connection.connectionState}")
            if peer_connection.connectionState == "connected" and data_channel and data_channel.readyState == "open":
                await send_test_message()
            elif peer_connection.connectionState in ["failed", "disconnected"]:
                logger.warning("Connection failed/disconnected; reconnecting...")

        channel = peer_connection.createDataChannel("test-channel", ordered=True)
        logger.info(f"Created data channel: {channel.label}")
        await setup_data_channel(channel)

        @peer_connection.on("datachannel")
        def on_datachannel(incoming_channel):
            logger.info(f"Incoming data channel: {incoming_channel.label}")
            asyncio.create_task(setup_data_channel(incoming_channel))

        try:
            video_track = CustomVideoStreamTrack(camera_index=0, use_camera=True)
            video_sender = peer_connection.addTrack(video_track)
            logger.info("Added video track")
        except Exception as e:
            logger.error(f"Error adding video track: {e}")

        @peer_connection.on("icecandidate")
        async def on_ice_candidate(event):
            if event.candidate and ws_connection:
                candidate_data = {
                    "candidate": event.candidate.candidate,
                    "sdpMid": event.candidate.sdpMid,
                    "sdpMLineIndex": event.candidate.sdpMLineIndex,
                }
                await send_webrtc_message(ws_connection, "ice-candidate", candidate_data)
                logger.info("Sent ICE candidate")

        offer = await peer_connection.createOffer()
        await peer_connection.setLocalDescription(offer)
        logger.info(f"Created offer SDP")
        return {"sdp": offer.sdp}
    except Exception as e:
        logger.error(f"Error generating offer: {e}")
        raise

async def process_answer(answer_sdp):
    global peer_connection
    if not peer_connection:
        logger.error("No peer connection")
        return
    try:
        remote_desc = RTCSessionDescription(sdp=answer_sdp, type="answer")
        await peer_connection.setRemoteDescription(remote_desc)
        logger.info("Set remote description")
    except Exception as e:
        logger.error(f"Error setting remote description: {e}")

async def process_ice_candidate(candidate_data):
    global peer_connection
    if not peer_connection:
        logger.error("No peer connection")
        return
    try:
        candidate_str = candidate_data.get("candidate", "")
        sdp_mid = candidate_data.get("sdpMid", "")
        sdp_m_line_index = candidate_data.get("sdpMLineIndex", 0)
        if not candidate_str:
            logger.warning("Empty ICE candidate")
            return
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
                sdpMLineIndex=sdp_m_line_index
            )
            await peer_connection.addIceCandidate(candidate)
            logger.info("Added ICE candidate")
        else:
            logger.error(f"Invalid ICE candidate: {candidate_str}")
    except Exception as e:
        logger.error(f"Error adding ICE candidate: {e}")

# --- WebSocket Message Handling & Signaling ---

async def handle_websocket_messages(ws):
    global reconnect_attempts, client_id
    try:
        async for message in ws:
            try:
                msg_data = json.loads(message)
                if msg_data.get("type") == "welcome" and msg_data.get("data"):
                    client_id = msg_data["data"].get("socketId")
                    logger.info(f"Client ID: {client_id}")
                if msg_data.get("type") == "webrtc" and msg_data.get("data"):
                    webrtc_data = msg_data["data"]
                    if webrtc_data.get("_clientMessageId") in sent_message_ids:
                        logger.info("Ignoring own message")
                        continue
                    logger.info(f"Received WebRTC message: {webrtc_data}")
                    if webrtc_data.get("type") == "answer" and webrtc_data.get("sdp"):
                        await process_answer(webrtc_data["sdp"])
                    elif webrtc_data.get("type") == "ice-candidate":
                        await process_ice_candidate(webrtc_data)
            except json.JSONDecodeError as e:
                logger.error(f"JSON parse error: {e}")
    except websockets.exceptions.ConnectionClosed:
        logger.info("WebSocket closed")
        if reconnect_attempts < MAX_RECONNECT_ATTEMPTS:
            reconnect_attempts += 1
            logger.info(f"Reconnecting ({reconnect_attempts}/{MAX_RECONNECT_ATTEMPTS})...")
            await asyncio.sleep(RECONNECT_INTERVAL)
            await setup_webrtc_signaling()
        else:
            logger.info("Max reconnection attempts reached.")

async def setup_webrtc_signaling():
    global ws_connection, reconnect_attempts
    try:
        ws_connection = await connect_websocket()
        reconnect_attempts = 0
        asyncio.create_task(handle_websocket_messages(ws_connection))
        logger.info("Initiating WebRTC offer...")
        await asyncio.sleep(1)
        offer = await generate_data_channel_offer()
        await send_webrtc_message(ws_connection, "offer", offer)
        return ws_connection
    except Exception as e:
        logger.error(f"Signaling setup error: {e}")
        if reconnect_attempts < MAX_RECONNECT_ATTEMPTS:
            reconnect_attempts += 1
            await asyncio.sleep(RECONNECT_INTERVAL)
            return await setup_webrtc_signaling()
        else:
            return None

async def send_periodic_ping():
    while running:
        await asyncio.sleep(30)
        if ws_connection:
            try:
                await ws_connection.send(json.dumps({"type": "ping", "timestamp": datetime.now().isoformat()}))
            except Exception as e:
                logger.error(f"Ping error: {e}")
        if data_channel and data_channel.readyState == "open":
            try:
                ping_message = {"type": "ping", "timestamp": datetime.now().isoformat(), "clientId": client_id}
                data_channel.send(json.dumps(ping_message))
                logger.info("Sent data channel ping")
            except Exception as e:
                logger.error(f"Data channel ping error: {e}")

async def cleanup():
    global running, peer_connection, ws_connection, video_sender
    logger.info("Closing connections...")
    running = False
    if data_channel:
        try:
            data_channel.close()
            logger.info("Data channel closed")
        except Exception as e:
            logger.error(f"Data channel close error: {e}")
    if video_sender and hasattr(video_sender, 'track') and video_sender.track:
        if hasattr(video_sender.track, 'cap') and video_sender.track.cap:
            try:
                video_sender.track.cap.release()
                logger.info("Camera released")
            except Exception as e:
                logger.error(f"Camera release error: {e}")
    if peer_connection:
        try:
            await peer_connection.close()
            logger.info("Peer connection closed")
        except Exception as e:
            logger.error(f"Peer connection close error: {e}")
    if ws_connection:
        try:
            await ws_connection.close()
            logger.info("WebSocket closed")
        except Exception as e:
            logger.error(f"WebSocket close error: {e}")
    message_event.set()
    if not asyncio.get_event_loop().is_running():
        sys.exit(0)

# --- User Input Handling ---

def input_reader():
    global running, input_queue, message_event
    while running:
        try:
            user_input = input("")
            if user_input.lower() == 'exit':
                print("Exiting...")
                running = False
                break
            input_queue.put(user_input)
            message_event.set()
        except EOFError:
            running = False
            break
        except Exception as e:
            print(f"Input error: {e}")

async def process_user_input():
    global running, data_channel, input_queue, message_event
    while running:
        await asyncio.sleep(0.1)
        if message_event.is_set():
            message_event.clear()
            while not input_queue.empty():
                try:
                    user_input = input_queue.get_nowait()
                    if data_channel and data_channel.readyState == "open":
                        message = {"text": user_input, "timestamp": datetime.now().isoformat(), "clientId": client_id}
                        data_channel.send(json.dumps(message))
                        logger.info(f"Sent message: {message}")
                        print(f">>> Sent: {user_input}")
                    else:
                        print(">>> Data channel not open. Message not sent.")
                    input_queue.task_done()
                except queue.Empty:
                    break
                except Exception as e:
                    logger.error(f"User input processing error: {e}")

# --- Main Execution ---

async def main():
    global running
    loop = asyncio.get_running_loop()
    def signal_handler():
        logger.info("Interrupt received, shutting down...")
        global running
        running = False
        asyncio.create_task(cleanup())
    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, signal_handler)
    try:
        logger.info("Starting WebRTC data channel test client")
        await setup_webrtc_signaling()
        ping_task = asyncio.create_task(send_periodic_ping())
        input_task = asyncio.create_task(process_user_input())
        threading.Thread(target=input_reader, daemon=True).start()
        logger.info("Client running. Press Ctrl+C to exit.")
        while running:
            await asyncio.sleep(0.1)
        logger.info("Main loop exiting, cleaning up...")
        ping_task.cancel()
        input_task.cancel()
        try:
            await ping_task
            await input_task
        except asyncio.CancelledError:
            logger.info("Tasks cancelled")
    except Exception as e:
        logger.error(f"Error in main: {e}")
    finally:
        await cleanup()

if __name__ == "__main__":
    def custom_exception_handler(loop, context):
        exception = context.get('exception')
        if isinstance(exception, KeyboardInterrupt):
            logger.info("KeyboardInterrupt caught")
            return
        logger.error(f"Unhandled exception: {context['message']}")
        if exception:
            import traceback
            logger.error(''.join(traceback.format_exception(type(exception), exception, exception.__traceback__)))
    try:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        loop.set_exception_handler(custom_exception_handler)
        loop.run_until_complete(main())
    except KeyboardInterrupt:
        logger.info("Keyboard interrupt received, exiting...")
    except Exception as e:
        logger.error(f"Unhandled exception: {e}")
        import traceback
        logger.error(''.join(traceback.format_exception(type(e), e, e.__traceback__)))
        sys.exit(1)
    finally:
        if 'loop' in locals() and loop.is_running():
            loop.close()
    logger.info("Clean exit")
    sys.exit(0)
