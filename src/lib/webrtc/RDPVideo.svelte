<script lang="ts">
  import { onMount, onDestroy } from 'svelte';

  export let videoStream: MediaStream | null = null;
  export let connected: boolean = false;
  export let connecting: boolean = false;
  export let className: string = '';

  // MQTT frame support (fallback when WebRTC video has no dimensions)
  export let mqttFrame: string | null = null; // base64-encoded JPEG image

  // Input handlers passed from parent
  export let onMouseClick: (e: MouseEvent) => void = () => {};
  export let onMouseDown: (e: MouseEvent) => void = () => {};
  export let onMouseUp: (e: MouseEvent) => void = () => {};
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

  // Phase 1: Wheel with passive:false so preventDefault works (stops page scroll)
  let wheelHandlerRef: ((e: WheelEvent) => void) | null = null;
  let touchHandlerRef: { start: (e: TouchEvent) => void; move: (e: TouchEvent) => void; end: (e: TouchEvent) => void } | null = null;

  let docMouseUpRef: ((e: MouseEvent) => void) | null = null;

  function startDragCapture(downEvent: MouseEvent) {
    if (docMouseUpRef) return;
    const media = getMediaElement();
    if (!media) return;
    const button = downEvent.button;
    const docMouseUp = (e: MouseEvent) => {
      const synth = { clientX: e.clientX, clientY: e.clientY, button, currentTarget: media } as unknown as MouseEvent;
      onMouseUp(synth);
      document.removeEventListener('mouseup', docMouseUp, true);
      docMouseUpRef = null;
    };
    docMouseUpRef = docMouseUp;
    document.addEventListener('mouseup', docMouseUp, true);
  }

  function endDragCapture() {
    if (docMouseUpRef) {
      document.removeEventListener('mouseup', docMouseUpRef, true);
      docMouseUpRef = null;
    }
  }

  function wrappedMouseDown(e: MouseEvent) {
    startDragCapture(e);
    onMouseDown(e);
  }

  function wrappedMouseUp(_e: MouseEvent) {
    endDragCapture();
  }

  function getMediaElement(): HTMLVideoElement | HTMLImageElement | null {
    if (useMqttFrames && imageElement) return imageElement;
    return videoElement || null;
  }

  onMount(() => {
    const wheelHandler = (e: WheelEvent) => {
      onMouseWheel(e);
      e.preventDefault();
      e.stopPropagation();
    };
    wheelHandlerRef = wheelHandler;
    videoContainer?.addEventListener('wheel', wheelHandler, { passive: false });

    // Phase 3: Touch events for swipe - map to mouse down/move/up
    const touchStart = (e: TouchEvent) => {
      if (e.touches.length === 0) return;
      e.preventDefault();
      const touch = e.touches[0];
      const media = getMediaElement();
      if (media) {
        const synth = { clientX: touch.clientX, clientY: touch.clientY, button: 0, currentTarget: media } as unknown as MouseEvent;
        onMouseDown(synth);
      }
    };
    const touchMove = (e: TouchEvent) => {
      if (e.touches.length === 0) return;
      e.preventDefault();
      const touch = e.touches[0];
      const media = getMediaElement();
      if (media) {
        const synth = { clientX: touch.clientX, clientY: touch.clientY, currentTarget: media } as unknown as MouseEvent;
        onMouseMove(synth);
      }
    };
    const touchEnd = (e: TouchEvent) => {
      e.preventDefault();
      const touch = e.changedTouches[0] || e.touches[0];
      if (!touch) return;
      const media = getMediaElement();
      if (media) {
        const synth = { clientX: touch.clientX, clientY: touch.clientY, button: 0, currentTarget: media } as unknown as MouseEvent;
        onMouseUp(synth);
      }
    };
    touchHandlerRef = { start: touchStart, move: touchMove, end: touchEnd };
    videoContainer?.addEventListener('touchstart', touchStart, { passive: false, capture: true });
    videoContainer?.addEventListener('touchmove', touchMove, { passive: false, capture: true });
    videoContainer?.addEventListener('touchend', touchEnd, { passive: false, capture: true });
    videoContainer?.addEventListener('touchcancel', touchEnd, { passive: false, capture: true });
  });

  onDestroy(() => {
    if (wheelHandlerRef && videoContainer) {
      videoContainer.removeEventListener('wheel', wheelHandlerRef);
      wheelHandlerRef = null;
    }
    if (touchHandlerRef && videoContainer) {
      videoContainer.removeEventListener('touchstart', touchHandlerRef.start, { capture: true });
      videoContainer.removeEventListener('touchmove', touchHandlerRef.move, { capture: true });
      videoContainer.removeEventListener('touchend', touchHandlerRef.end, { capture: true });
      videoContainer.removeEventListener('touchcancel', touchHandlerRef.end, { capture: true });
      touchHandlerRef = null;
    }
    endDragCapture(); // Clean up document mouseup listener if still active
  });
  
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

<div class={"w-full aspect-video bg-muted rounded-lg overflow-hidden " + className} bind:this={videoContainer} style="touch-action: none;">
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
            on:mousedown={wrappedMouseDown}
            on:mouseup={wrappedMouseUp}
            on:mousemove={onMouseMove}
            on:contextmenu|preventDefault={onRightClick}
            on:keydown={onKeyDown}
            on:keyup={onKeyUp}
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
        on:mousedown={wrappedMouseDown}
        on:mouseup={wrappedMouseUp}
        on:mousemove={onMouseMove}
        on:contextmenu|preventDefault={onRightClick}
        on:keydown={onKeyDown}
        on:keyup={onKeyUp}
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


