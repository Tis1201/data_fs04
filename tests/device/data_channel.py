import asyncio
import json
from datetime import datetime
import uuid
from loguru import logger

class DataChannelHandler:
    """Handler for WebRTC data channel operations."""
    
    def __init__(self, client):
        """Initialize the data channel handler.
        
        Args:
            client: The WebRTC client that owns this handler
        """
        self.client = client
        self.pending_messages = []
    
    def setup_handlers(self, channel):
        """Set up data channel event handlers."""
        channel.on("open", self._on_open)
        channel.on("message", self._on_message)
        channel.on("close", self._on_close)
        channel.on("error", self._on_error)

    ################################################################################
    #
    # Event Handlers
    #
    ################################################################################
    def _on_open(self):
        """Handle data channel open event."""
        logger.info("Data channel opened")
        
        # Log data channel info
        if self.client.dc:
            logger.info(f"Data channel info - Label: {self.client.dc.label}, State: {self.client.dc.readyState}, Buffered: {self.client.dc.bufferedAmount}")
            
        # Start the console input task
        if self.client.input_task:
            self.client.input_task.cancel()
        self.client.input_task = asyncio.create_task(self.client._console_input_loop())
    
    def _on_close(self):
        """Handle data channel close event."""
        logger.info("Data channel closed")
        if self.client.dc:
            logger.info(f"Data channel final state - Label: {self.client.dc.label}, State: {self.client.dc.readyState}")
            self.client.dc = None

    def _on_error(self, error):
        """Handle data channel error event."""
        logger.error(f"Data channel error: {error}")
        if self.client.dc:
            logger.error(f"Data channel error state - Label: {self.client.dc.label}, State: {self.client.dc.readyState}")
    
    def _on_message(self, message):
        """Handle incoming data channel message."""
        logger.info(f"Received data channel message: {message}")
        
        try:
            # Parse the message if it's JSON
            if isinstance(message, str) and message.startswith('{'): 
                msg_data = json.loads(message)
                msg_type = msg_data.get('type')
                
                # Handle special message types
                handlers = {
                    'ping': self._handle_ping_message,
                    'close': self._handle_close_message
                }
                
                if msg_type in handlers:
                    handlers[msg_type](msg_data)
                    return
            
            # For other messages, echo them back (for testing)
            asyncio.create_task(self.send_data(message))
            
        except Exception as e:
            logger.error(f"Error processing data channel message: {str(e)}")
    
    ################################################################################
    #
    # Message Handlers
    #
    ################################################################################
    def _handle_ping_message(self, msg_data):
        """Handle ping messages with pong response."""
        pong_msg = {
            'type': 'pong',
            'timestamp': datetime.now().isoformat(),
            'echo': msg_data.get('timestamp')
        }
        logger.info("Received ping, sending pong response")
        asyncio.create_task(self.send_data(pong_msg))
    
    def _handle_close_message(self, msg_data):
        """Handle close messages with acknowledgment."""
        logger.info("Received close signal from browser")
        ack_msg = {
            'type': 'close-ack',
            'timestamp': datetime.now().isoformat()
        }
        asyncio.create_task(self.send_data(ack_msg))
    
    ################################################################################
    #
    # Data Channel Operations
    #
    ################################################################################
    async def send_data(self, data):
        """Send data through the data channel.
        
        Args:
            data: The data to send. Can be a string, dict, or list.
                 Dicts and lists will be converted to JSON strings.
        
        Returns:
            bool: True if the data was sent successfully, False otherwise.
        """
        if not self.client.dc or self.client.dc.readyState != "open":
            logger.warning("Data channel not open, queuing message")
            self.pending_messages.append(data)
            return False
            
        try:
            # If data is a dict or list, convert it to JSON
            if isinstance(data, (dict, list)):
                data = json.dumps(data)
                
            # For plain text, we'll just send it directly
            # The browser side will handle it as a text message
            logger.info(f"Sending data: {data[:50]}{'...' if len(str(data)) > 50 else ''}")
            self.client.dc.send(data)
            return True
        except Exception as e:
            logger.error(f"Error sending data: {str(e)}")
            return False
    
    async def send_user_input(self, user_input):
        """Send user input over the data channel."""
        # Send the user input if data channel is open
        if self.client.dc and self.client.dc.readyState == "open":
            message = {
                'type': 'console',
                'message': user_input,
                'timestamp': datetime.now().isoformat(),
                'id': str(uuid.uuid4())[:8]
            }
            
            success = await self.send_data(message)
            if success:
                logger.info(f"Sent message: {user_input}")
            else:
                logger.warning(f"Failed to send message: {user_input}")
        else:
            logger.warning(f"Data channel not open (state: {self.client.dc.readyState if self.client.dc else 'None'}), can't send message")
            print("WebRTC data channel not open. Message not sent.")
