<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type { Action } from 'svelte/action';
  import type { RdpDisplayMode } from './rdpPointerMapping';

  export let videoStream: MediaStream | null = null;
  export let connected: boolean = false;
  export let connecting: boolean = false;
  export let className: string = '';
  /** When true, grow with flex to fill available height instead of fixed 16:9 aspect-video. */
  export let fillViewport = false;
  /** Scale to fit viewport vs intrinsic 1:1 with scroll. */
  export let displayMode: RdpDisplayMode = 'bestFit';
  /** Focus video when stream starts playing (e.g. modal keyboard capture). */
  export let autoFocusMedia = false;
  // MQTT frame support (fallback when WebRTC video has no dimensions)
  export let mqttFrame: string | null = null;

  // Input handlers passed from parent
  export let onMouseClick: (e: MouseEvent) => void = () => {};
  export let onMouseDown: (e: MouseEvent) => void = () => {};
  export let onMouseUp: (e: MouseEvent) => void = () => {};
  export let onMouseMove: (e: MouseEvent) => void = () => {};
  export let onRightClick: (e: MouseEvent) => void = () => {};
  export let onKeyDown: (e: KeyboardEvent) => void = () => {};
  export let onKeyUp: (e: KeyboardEvent) => void = () => {};
  export let onMouseWheel: (e: WheelEvent) => void = () => {};

  /** Updated each render so wheel handler reads current mode (closure runs at event time). */
  let wheelMode: RdpDisplayMode = displayMode;
  $: wheelMode = displayMode;

  /** Intrinsic pixel size of the remote frame (from the media stream). Drives aspect ratio. */
  let streamW = 0;
  let streamH = 0;
  /** Stage size (px): fitted in bestFit, intrinsic in original. */
  let stageW = 0;
  let stageH = 0;

  let fitRegionEl: HTMLDivElement | null = null;
  let didAutoFocus = false;

  function readVideoDimensions() {
    if (!videoElement) return;
    const w = videoElement.videoWidth;
    const h = videoElement.videoHeight;
    if (w > 0 && h > 0) {
      streamW = w;
      streamH = h;
    }
  }

  /** Largest size with the same aspect ratio as the remote desktop that fits inside the region. */
  function computeFit(region: HTMLElement) {
    const pw = region.clientWidth;
    const ph = region.clientHeight;
    if (pw < 2 || ph < 2) return;

    const aw = streamW > 0 ? streamW : 16;
    const ah = streamH > 0 ? streamH : 9;
    const ar = aw / ah;

    let w = pw;
    let h = w / ar;
    if (h > ph) {
      h = ph;
      w = h * ar;
    }

    let nw = Math.max(1, Math.floor(w));
    let nh = Math.max(1, Math.round(nw / ar));
    if (nh > ph) {
      nh = Math.max(1, Math.floor(ph));
      nw = Math.max(1, Math.round(nh * ar));
    }
    if (nw > pw) {
      nw = Math.max(1, Math.floor(pw));
      nh = Math.max(1, Math.round(nw / ar));
    }

    if (nw !== stageW || nh !== stageH) {
      stageW = nw;
      stageH = nh;
    }
  }

  function applyFitIfNeeded() {
    if (displayMode !== 'bestFit' || !fitRegionEl) return;
    computeFit(fitRegionEl);
  }

  const fitRegionResize: Action<HTMLElement, RdpDisplayMode> = (region, initialMode) => {
    let mode = initialMode;
    const run = () => {
      if (mode === 'bestFit') computeFit(region);
    };
    const ro = new ResizeObserver(run);
    ro.observe(region);
    queueMicrotask(run);
    return {
      update(newMode: RdpDisplayMode) {
        mode = newMode;
        run();
      },
      destroy() {
        ro.disconnect();
      },
    };
  };

  $: hasStreamDimensions = streamW > 0 && streamH > 0;

  /** Original mode: stage matches intrinsic pixels (placeholder until metadata). */
  $: if (displayMode === 'original') {
    const nw = streamW > 0 ? streamW : 640;
    const nh = streamH > 0 ? streamH : 360;
    if (stageW !== nw || stageH !== nh) {
      stageW = nw;
      stageH = nh;
    }
  }

  let videoContainer: HTMLDivElement;
  let videoElement: HTMLVideoElement;
  let imageElement: HTMLImageElement;

  let isVideoPaused = true;
  let currentVideoStreamId: string | null = null;
  let frameCount = 0;

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
      if (wheelMode === 'original') {
        if (e.ctrlKey || e.metaKey) {
          onMouseWheel(e);
          e.preventDefault();
          e.stopPropagation();
        }
        return;
      }
      onMouseWheel(e);
      e.preventDefault();
      e.stopPropagation();
    };
    wheelHandlerRef = wheelHandler;
    videoContainer?.addEventListener('wheel', wheelHandler, { passive: false });

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
        const synth = { clientX: touch.clientX, clientY: touch.clientY, button: 0, currentTarget: media } as unknown as MouseEvent;
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
    endDragCapture();
  });

  $: useMqttFrames = videoStream && videoElement && videoElement.videoWidth === 0 && videoElement.videoHeight === 0 && mqttFrame;

  $: if (videoStream && videoElement && videoStream.id !== currentVideoStreamId) {
    console.log('[RDPVideo] Connecting video stream, active:', videoStream.active, 'tracks:', videoStream.getTracks().length);

    streamW = 0;
    streamH = 0;
    stageW = 0;
    stageH = 0;
    didAutoFocus = false;

    videoElement.srcObject = videoStream;
    currentVideoStreamId = videoStream.id;

    videoStream.getTracks().forEach((track) => {
      if (track.kind === 'video' && !track.enabled) {
        track.enabled = true;
      }
    });

    setTimeout(() => {
      if (videoElement && videoElement.paused) {
        videoElement.play().catch((err) => {
          console.error('[RDPVideo] Failed to play video:', err);
        });
      }

      if (videoElement.videoWidth === 0 && videoElement.videoHeight === 0) {
        const currentSrc = videoElement.srcObject;
        videoElement.srcObject = null;
        setTimeout(() => {
          videoElement.srcObject = currentSrc;
        }, 100);
      }
    }, 300);
  }
</script>

<div
  class={(fillViewport
    ? 'flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-black '
    : 'w-full overflow-hidden rounded-lg bg-muted ') +
    (!fillViewport && !hasStreamDimensions ? 'aspect-video ' : '') +
    className}
  bind:this={videoContainer}
  style:touch-action="none"
  style:aspect-ratio={!fillViewport && hasStreamDimensions ? `${streamW} / ${streamH}` : undefined}
>
  <div
    bind:this={fitRegionEl}
    use:fitRegionResize={displayMode}
    class={fillViewport
      ? displayMode === 'original'
        ? 'min-h-0 w-full flex-1 overflow-auto'
        : 'flex min-h-0 w-full flex-1 items-center justify-center overflow-hidden'
      : displayMode === 'original'
        ? 'h-full min-h-0 w-full overflow-auto'
        : 'flex h-full min-h-0 w-full items-center justify-center overflow-hidden'}
  >
    <div
      class={displayMode === 'original'
        ? 'flex min-h-full min-w-full items-center justify-center'
        : 'contents'}
    >
    <div
      class="relative shrink-0 overflow-hidden bg-black"
      class:mx-auto={displayMode === 'bestFit'}
      style="width: {stageW}px; height: {stageH}px;"
    >
      <video
        bind:this={videoElement}
        class="absolute inset-0 h-full w-full cursor-crosshair bg-black object-contain"
        class:hidden={useMqttFrames}
        autoplay
        playsinline
        controls={false}
        muted={true}
        tabindex="0"
        on:loadedmetadata={() => {
          readVideoDimensions();
          applyFitIfNeeded();
        }}
        on:resize={() => {
          readVideoDimensions();
          applyFitIfNeeded();
        }}
        on:playing={() => {
          readVideoDimensions();
          applyFitIfNeeded();
          isVideoPaused = false;
          if (autoFocusMedia && videoElement && !didAutoFocus) {
            didAutoFocus = true;
            videoElement.focus();
          }
        }}
        on:timeupdate={() => {
          frameCount++;
        }}
        on:loadeddata={() => {
          readVideoDimensions();
          applyFitIfNeeded();
        }}
        on:pause={() => {
          isVideoPaused = true;
        }}
        on:error={(e) => {
          console.error('[RDPVideo] Video error:', e);
        }}
        on:click={onMouseClick}
        on:mousedown={wrappedMouseDown}
        on:mouseup={wrappedMouseUp}
        on:mousemove={onMouseMove}
        on:contextmenu|preventDefault={onRightClick}
        on:keydown={onKeyDown}
        on:keyup={onKeyUp}
      ></video>

      {#if useMqttFrames && mqttFrame}
        <img
          bind:this={imageElement}
          src={`data:image/jpeg;base64,${mqttFrame}`}
          class="absolute inset-0 h-full w-full cursor-crosshair bg-black object-contain"
          alt="RDP Frame"
          tabindex="0"
          on:load={() => {
            if (!imageElement) return;
            streamW = imageElement.naturalWidth;
            streamH = imageElement.naturalHeight;
            applyFitIfNeeded();
          }}
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
          <div class="text-center text-white">
            {#if connecting}
              <div class="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-b-2 border-white"></div>
              <p>Connecting to device...</p>
            {:else if !connected}
              <p>Not connected to device</p>
            {:else}
              <div class="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-b-2 border-white"></div>
              <p>Waiting for video stream...</p>
            {/if}
          </div>
        </div>
      {/if}
    </div>
    </div>
  </div>
</div>
