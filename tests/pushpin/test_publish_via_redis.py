#!/usr/bin/env python3
import os
import sys
import redis
import json
import time
from loguru import logger
from dotenv import load_dotenv

# Load environment variables from .env file if it exists
load_dotenv()

REDIS_HOST          = os.getenv("REDIS_HOST")
REDIS_PORT          = os.getenv("REDIS_PORT")
REDIS_DB            = os.getenv("REDIS_DB")
REDIS_PASSWORD      = os.getenv("REDIS_PASSWORD")
REDIS_PUSHPIN_CHANNEL_NAME  = os.getenv("REDIS_PUSHPIN_CHANNEL_NAME", "pushpin_publish")


def publish_test_message():
    try:
        # Debug log the connection details (without password)
        logger.debug(f"Connecting to Redis at {REDIS_HOST}:{REDIS_PORT}, DB: {REDIS_DB}, PASSWORD: {REDIS_PASSWORD}")
        logger.debug(f"Using channel: {REDIS_PUSHPIN_CHANNEL_NAME}")
        
        # Connect to Redis using the same configuration as publisher_worker.py
        client = redis.Redis(
            host=REDIS_HOST,
            port=int(REDIS_PORT),  # Ensure port is an integer
            password=REDIS_PASSWORD or None,  # Use None if password is empty string
            db=int(REDIS_DB) if REDIS_DB else 0,  # Default to DB 0 if not specified
            socket_timeout=5,
            socket_connect_timeout=5,
            decode_responses=True
        )
        
        # Test the connection
        client.ping()
        logger.debug("Successfully connected to Redis")

        # Create a test message
        test_message = {
            'channel': 'registration:1555b31f-eb9c-43c3-ba4a-0e670389f789',
            'payload': {
                'action': 'reboot',
                'request_id': f'req_{int(time.time())}'
            },
            'content': 'Test message from test_redis_publish.py',
            'timestamp': time.time()
        }

        # Publish the message to Redis Pub/Sub channel
        subscribers = client.publish(
            REDIS_PUSHPIN_CHANNEL_NAME,
            json.dumps(test_message) + "\n\n"
        )

        logger.success(f"✅ Published to channel {REDIS_PUSHPIN_CHANNEL_NAME}: {test_message}")
        logger.info(f"Message delivered to {subscribers} subscriber(s)")
        return True
        
    except Exception as e:
        logger.error(f"❌ Failed to publish to Redis: {str(e)}")
        return False

def setup_logging():
    # Configure loguru to show debug logs
    logger.remove()  # Remove default handler
    logger.add(
        sys.stderr,
        format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - <level>{message}</level>"
    )
    logger.add("test_redis_publish.log", rotation="10 MB", level="DEBUG")

if __name__ == "__main__":
    setup_logging()
    logger.info("Starting Redis publisher test...")
    logger.info(f"Using Redis at {REDIS_HOST}:{REDIS_PORT} (DB: {REDIS_DB or 0})")
    
    if publish_test_message():
        logger.success("✅ Test message sent successfully!")
    else:
        logger.error("❌ Failed to send test message")
    
    logger.info("Test completed")
