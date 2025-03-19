/**
 * Utility functions for creating synthetic media streams for WebRTC testing
 */

/**
 * Creates a synthetic video stream with animated content
 * @param width Video width (default: 640)
 * @param height Video height (default: 480)
 * @param frameRate Frame rate in fps (default: 30)
 * @param text Optional text to display in the video
 * @returns MediaStream object containing the synthetic video track
 */
export function createSyntheticVideoStream(
  width = 640,
  height = 480,
  frameRate = 30,
  text = 'Synthetic Video Stream'
): MediaStream {
  // Create a canvas element to draw on
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not get canvas context');
  }
  
  // Animation variables
  let frameCount = 0;
  
  // Function to draw a frame
  const drawFrame = () => {
    frameCount++;
    
    // Clear canvas
    ctx.fillStyle = '#1e293b'; // Dark background
    ctx.fillRect(0, 0, width, height);
    
    // Draw animated elements
    // 1. Moving gradient circle
    const time = frameCount / frameRate;
    const circleX = width / 2 + Math.sin(time) * (width / 4);
    const circleY = height / 2 + Math.cos(time * 0.7) * (height / 4);
    
    // Create gradient
    const gradient = ctx.createRadialGradient(
      circleX, circleY, 0,
      circleX, circleY, 100
    );
    gradient.addColorStop(0, 'rgba(74, 222, 128, 1)'); // Green
    gradient.addColorStop(1, 'rgba(59, 130, 246, 0)'); // Blue, transparent
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(circleX, circleY, 100, 0, Math.PI * 2);
    ctx.fill();
    
    // 2. Draw timestamp
    const timestamp = new Date().toISOString().substring(11, 19);
    ctx.fillStyle = 'white';
    ctx.font = '16px monospace';
    ctx.fillText(timestamp, 20, height - 20);
    
    // 3. Draw custom text
    ctx.font = 'bold 24px sans-serif';
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.fillText(text, width / 2, 40);
    
    // 4. Draw frame counter
    ctx.font = '16px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`Frame: ${frameCount}`, width - 20, height - 20);
    
    // Request next frame
    requestAnimationFrame(drawFrame);
  };
  
  // Start animation
  drawFrame();
  
  // Create a media stream from the canvas
  const stream = canvas.captureStream(frameRate);
  
  return stream;
}

/**
 * Creates a synthetic audio stream (silent)
 * @returns MediaStream object containing a silent audio track
 */
export function createSyntheticAudioStream(): MediaStream {
  // Create an audio context
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  
  // Create an oscillator with 0 gain (silent)
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  
  // Set gain to 0 to make it silent
  gainNode.gain.value = 0;
  
  // Connect the oscillator to the gain node
  oscillator.connect(gainNode);
  
  // Connect the gain node to the audio context destination
  gainNode.connect(audioContext.destination);
  
  // Start the oscillator
  oscillator.start();
  
  // Create a media stream destination
  const destination = audioContext.createMediaStreamDestination();
  
  // Connect the gain node to the destination
  gainNode.connect(destination);
  
  return destination.stream;
}

/**
 * Creates a complete synthetic media stream with both video and audio
 * @param width Video width
 * @param height Video height
 * @param frameRate Frame rate in fps
 * @param text Optional text to display in the video
 * @returns MediaStream object containing both synthetic video and audio tracks
 */
export function createSyntheticMediaStream(
  width = 640,
  height = 480,
  frameRate = 30,
  text = 'Synthetic Media Stream'
): MediaStream {
  // Get video and audio streams
  const videoStream = createSyntheticVideoStream(width, height, frameRate, text);
  const audioStream = createSyntheticAudioStream();
  
  // Create a new stream that includes tracks from both
  const combinedStream = new MediaStream();
  
  // Add all video tracks
  videoStream.getVideoTracks().forEach(track => {
    combinedStream.addTrack(track);
  });
  
  // Add all audio tracks
  audioStream.getAudioTracks().forEach(track => {
    combinedStream.addTrack(track);
  });
  
  return combinedStream;
}
