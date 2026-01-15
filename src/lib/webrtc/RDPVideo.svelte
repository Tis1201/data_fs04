<script lang="ts">
  export let videoStream: MediaStream | null = null;
  export let connected: boolean = false;
  export let connecting: boolean = false;
  export let className: string = '';

  // MQTT frame support (fallback when WebRTC video has no dimensions)
  export let mqttFrame: string | null = null; // base64-encoded JPEG image

  // Input handlers passed from parent
  export let onMouseClick: (e: MouseEvent) => void = () => {};
  export let onMouseMove: (e: MouseEvent) => void = () => {};
  export let onRightClick: (e: MouseEvent) => void = () => {};
  export let onKeyDown: (e: KeyboardEvent) => void = () => {};
  export let onKeyUp: (e: KeyboardEvent) => void = () => {};
  export let onMouseWheel: (e: WheelEvent) => void = () => {};

  let videoContainer: HTMLDivElement;
  let videoElement: HTMLVideoElement;
  let imageElement: HTMLImageElement;

  let isVideoPaused = true;
  let currentVideoStreamId: string | null = null;
  let frameCount = 0;
  
  // Determine if we should use MQTT frames (when WebRTC has no dimensions)
  $: useMqttFrames = videoStream && videoElement && videoElement.videoWidth === 0 && videoElement.videoHeight === 0 && mqttFrame;

  function updateVideoState() {
    if (!videoElement) return;
    isVideoPaused = videoElement.paused;
  }

  $: if (videoStream && videoElement && videoStream.id !== currentVideoStreamId) {
    console.log('[RDPVideo] Connecting video stream, active:', videoStream.active, 'tracks:', videoStream.getTracks().length);

    videoElement.srcObject = videoStream;
    currentVideoStreamId = videoStream.id;

    // Ensure video track is enabled
    videoStream.getTracks().forEach(track => {
      if (track.kind === 'video' && !track.enabled) {
        track.enabled = true;
      }
    });

    setTimeout(() => {
      if (videoElement && videoElement.paused) {
        console.log('[RDPVideo] Attempting to play video...');
        videoElement.play().catch((err) => {
          console.error('[RDPVideo] Failed to play video:', err);
        });
      }
      
      // Force video element to refresh if it's not showing content
      if (videoElement.videoWidth === 0 && videoElement.videoHeight === 0) {
        console.log('[RDPVideo] Video has no dimensions, trying to force refresh...');
        
        // Try to reload the video element
        const currentSrc = videoElement.srcObject;
        videoElement.srcObject = null;
        setTimeout(() => {
          videoElement.srcObject = currentSrc;
          console.log('[RDPVideo] Video element refreshed');
        }, 100);
      }

      // Add detailed video element logging
      console.log('[RDPVideo] Video element details:');
      console.log('[RDPVideo] - videoWidth:', videoElement.videoWidth);
      console.log('[RDPVideo] - videoHeight:', videoElement.videoHeight);
      console.log('[RDPVideo] - readyState:', videoElement.readyState);
      console.log('[RDPVideo] - networkState:', videoElement.networkState);
      console.log('[RDPVideo] - paused:', videoElement.paused);
      console.log('[RDPVideo] - muted:', videoElement.muted);
      console.log('[RDPVideo] - srcObject:', videoElement.srcObject);

      // Check if video has actual content
      if (videoElement.videoWidth > 0 && videoElement.videoHeight > 0) {
        console.log('[RDPVideo] ✅ Video has dimensions - stream should be working');
        console.log('[RDPVideo] Video dimensions:', videoElement.videoWidth, 'x', videoElement.videoHeight);
      } else {
        console.log('[RDPVideo] ❌ Video has no dimensions - stream may be black/empty');
        console.log('[RDPVideo] Video dimensions:', videoElement.videoWidth, 'x', videoElement.videoHeight);
      }

      // Check video stream content
      if (videoElement.srcObject) {
        const stream = videoElement.srcObject as MediaStream;
        console.log('[RDPVideo] Video stream info:');
        console.log('[RDPVideo] - Stream active:', stream.active);
        console.log('[RDPVideo] - Stream tracks:', stream.getTracks().length);
        console.log('[RDPVideo] - Video tracks:', stream.getVideoTracks().length);
        console.log('[RDPVideo] - Audio tracks:', stream.getAudioTracks().length);

        stream.getVideoTracks().forEach((track, index) => {
          console.log(`[RDPVideo] Video track ${index}:`, {
            id: track.id,
            kind: track.kind,
            enabled: track.enabled,
            muted: track.muted,
            readyState: track.readyState,
            label: track.label
          });
        });
      } else {
        console.log('[RDPVideo] ❌ No video stream attached to video element');
      }
    }, 300);
  }
</script>

<div class={"w-full aspect-video bg-muted rounded-lg overflow-hidden " + className} bind:this={videoContainer}>
  <div class="relative w-full h-full">
    <!-- WebRTC Video Stream -->
    <video
            bind:this={videoElement}
            class="w-full h-full object-contain bg-black cursor-crosshair"
            class:hidden={useMqttFrames}
            autoplay
            playsinline
            controls={false}
            muted={true}
            tabindex="0"
                on:loadedmetadata={() => {
            console.log('[RDPVideo] Video metadata loaded:', videoElement.videoWidth, 'x', videoElement.videoHeight);
          }}
            on:playing={() => {
        console.log('[RDPVideo] Video started playing:', videoElement.videoWidth, 'x', videoElement.videoHeight);
        isVideoPaused = false;
      }}
            on:timeupdate={() => {
        frameCount++;
        if (frameCount % 300 === 0) { // Log every 300 frames (about 10 seconds at 30fps)
          console.log(`[RDPVideo] Video playing - ${frameCount} frames rendered`);
        }
      }}
            on:progress={() => {
        // Video data is being received
      }}
            on:loadeddata={() => {
        console.log('[RDPVideo] First video frame loaded:', videoElement.videoWidth, 'x', videoElement.videoHeight);
      }}
            on:pause={() => {
        console.log('[RDPVideo] Video paused');
        isVideoPaused = true;
      }}
            on:error={(e) => {
        console.error('[RDPVideo] Video error:', e);
      }}
            on:loadstart={() => {
        // Video load started
      }}
            on:canplay={() => {
        // Video can play
      }}
            on:canplaythrough={() => {
        // Video can play through
      }}
            on:waiting={() => {
        // Video waiting for data
      }}
            on:stalled={() => {
        // Video stalled
      }}
            on:click={onMouseClick}
            on:mousemove={onMouseMove}
            on:contextmenu|preventDefault={onRightClick}
            on:keydown={onKeyDown}
            on:keyup={onKeyUp}
            on:wheel={onMouseWheel}
    ></video>

    <!-- MQTT Frame Display (fallback when WebRTC has no dimensions) -->
    {#if useMqttFrames && mqttFrame}
      <img
        bind:this={imageElement}
        src={`data:image/jpeg;base64,${mqttFrame}`}
        class="w-full h-full object-contain bg-black cursor-crosshair"
        alt="RDP Frame"
        tabindex="0"
        on:click={onMouseClick}
        on:mousemove={onMouseMove}
        on:contextmenu|preventDefault={onRightClick}
        on:keydown={onKeyDown}
        on:keyup={onKeyUp}
        on:wheel={onMouseWheel}
      />
    {/if}

    {#if !videoStream && !mqttFrame}
      <div class="absolute inset-0 flex items-center justify-center bg-black bg-opacity-75">
        <div class="text-white text-center">
          {#if connecting}
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
            <p>Connecting to device...</p>
          {:else if !connected}
            <p>Not connected to device</p>
          {:else}
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
            <p>Waiting for video stream...</p>
          {/if}
        </div>
      </div>
    {/if}
  </div>
</div>


