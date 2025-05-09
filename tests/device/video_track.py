import time
import asyncio
from fractions import Fraction
import numpy as np
from aiortc import VideoStreamTrack
from aiortc.mediastreams import VideoFrame
from loguru import logger

class DummyVideoStreamTrack(VideoStreamTrack):
    """A video track that generates test patterns for the dummy device."""
    def __init__(self):
        super().__init__()
        self.counter = 0
        self.frames_per_second = 15  # Reduced from 30 to lower bandwidth
        self.frame_time = 1 / self.frames_per_second
        self.last_frame_time = time.time()
        self.last_frame = None
        self.stopped = False
        self._backpressure_sleep = 0.001  # Start with 1ms sleep
        self._max_backpressure_sleep = 0.1  # Max 100ms sleep
        
        # Error tracking
        self._error_count = 0
        self._max_errors = 5  # Max consecutive errors before reducing quality
        self._recovery_time = time.time()
        self._recovery_interval = 10  # Seconds between recovery attempts
        self._current_quality = 1.0  # Quality multiplier (1.0 = full quality)

    def stop(self):
        """Stop the video track."""
        self.stopped = True

    async def recv(self):
        if self.stopped:
            return None

        try:
            # Dynamic rate limiting with backpressure
            now = time.time()
            elapsed = now - self.last_frame_time
            
            # If we're falling behind, increase backpressure
            if elapsed < self.frame_time:
                self._backpressure_sleep = max(0.001, self._backpressure_sleep * 0.9)  # Reduce sleep time
            else:
                self._backpressure_sleep = min(self._max_backpressure_sleep, 
                                              self._backpressure_sleep * 1.1)  # Increase sleep time
            
            # Apply rate limiting
            wait_time = max(0, self.frame_time - elapsed)
            if wait_time > 0:
                await asyncio.sleep(wait_time)
            
            # Additional backpressure sleep
            await asyncio.sleep(self._backpressure_sleep)
            
            self.last_frame_time = time.time()
            self.counter += 1
            
            # Apply quality settings
            width = int(320 * self._current_quality)
            height = int(240 * self._current_quality)
            width = max(160, width - (width % 2))  # Ensure even dimensions
            height = max(120, height - (height % 2))
            
            # Create a frame with changing colors (dynamic size based on quality)
            img = np.zeros((height, width, 3), dtype=np.uint8)
            img[:, :, 0] = (self.counter * 5) % 256  # Red channel
            img[:, :, 1] = (self.counter * 7) % 256  # Green channel
            img[:, :, 2] = (self.counter * 11) % 256  # Blue channel
            
            # Create VideoFrame from numpy array
            frame = VideoFrame.from_ndarray(img, format="bgr24")
            frame.pts = self.counter
            frame.time_base = Fraction(1, 90000)  # MPEG clock rate
            
            # Reset error count on successful frame
            self._error_count = 0
            
            # Try to recover quality if we've been stable
            if (time.time() - self._recovery_time > self._recovery_interval and 
                self._current_quality < 1.0):
                self._current_quality = min(1.0, self._current_quality + 0.1)
                self._recovery_time = time.time()
                logger.info(f"Increasing video quality to {self._current_quality:.1f}")
            
            self.last_frame = frame
            return frame
            
        except Exception as e:
            logger.error(f"Error in video track: {str(e)}")
            self._error_count += 1
            
            # Reduce quality if we're getting too many errors
            if self._error_count >= self._max_errors:
                self._current_quality = max(0.5, self._current_quality - 0.1)
                logger.warning(f"Reducing video quality to {self._current_quality:.1f} due to errors")
                self._error_count = 0
                self._recovery_time = time.time()
            
            # On error, return the last frame if available, otherwise create a black frame
            if self.last_frame:
                return self.last_frame
            
            # Create a black frame as fallback
            img = np.zeros((240, 320, 3), dtype=np.uint8)
            frame = VideoFrame.from_ndarray(img, format="bgr24")
            frame.pts = self.counter
            frame.time_base = Fraction(1, 90000)
            return frame
