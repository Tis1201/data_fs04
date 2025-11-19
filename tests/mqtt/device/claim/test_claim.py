import os
import sys
import jwt

import pytest
import requests
from dotenv import load_dotenv
from loguru import logger

import time

sys.path.append("tests")

from mqtt.device.FactoryDevice import FactoryDevice
from _utils.jwt_tools import pretty_print_jwt

load_dotenv()

# Default to INFO for this test client to avoid overly verbose DEBUG output.
# log_level = os.getenv('MQTT_DEVICE_LOG_LEVEL', 'INFO')
# logger.remove()
# logger.add(sys.stderr, level=log_level)

FACTORY_TOKEN = os.getenv('SAMPLE_DEVICE_FACTORY_TOKEN')


def test_claim():
    device = FactoryDevice()
    device.connect()
    
    # Wait a moment for connection to establish
    time.sleep(1)

    try:
        try:
            # Perform registration (get PIN) once from the main thread
            device.start_register()

            # Keep the device connected until explicitly stopped (Ctrl+C)
            logger.info("Device registered; press Ctrl+C to stop the device client")
            while True:
                time.sleep(1)

        except KeyboardInterrupt:
            logger.info("KeyboardInterrupt received, stopping device client")
        except TimeoutError as e:
            logger.warning(e)
        finally:
            device.stop()

if __name__ == "__main__":
    test_claim()