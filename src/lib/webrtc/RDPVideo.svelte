<script lang="ts">
  export let videoStream: MediaStream | null = null;
  export let connected: boolean = false;
  export let connecting: boolean = false;
  export let className: string = '';

  // Input handlers passed from parent
  export let onMouseClick: (e: MouseEvent) => void = () => {};
  export let onMouseMove: (e: MouseEvent) => void = () => {};
  export let onRightClick: (e: MouseEvent) => void = () => {};
  export let onKeyDown: (e: KeyboardEvent) => void = () => {};
  export let onKeyUp: (e: KeyboardEvent) => void = () => {};
  export let onMouseWheel: (e: WheelEvent) => void = () => {};

  let videoContainer: HTMLDivElement;
  let videoElement: HTMLVideoElement;

  let isVideoPaused = true;
  let currentVideoStreamId: string | null = null;

  function updateVideoState() {
    if (!videoElement) return;
    isVideoPaused = videoElement.paused;
  }

  $: if (videoStream && videoElement && videoStream.id !== currentVideoStreamId) {
    videoElement.srcObject = videoStream;
    currentVideoStreamId = videoStream.id;
    setTimeout(() => {
      if (videoElement && videoElement.paused) {
        videoElement.play().catch(() => {});
      }
    }, 300);
  }
</script>

<div class={"w-full aspect-video bg-muted rounded-lg overflow-hidden " + className} bind:this={videoContainer}>
  <div class="relative w-full h-full">
    <video
      bind:this={videoElement}
      class="w-full h-full object-contain bg-black cursor-crosshair"
      autoplay
      playsinline
      controls={false}
      muted={true}
      tabindex="0"
      on:loadedmetadata={() => {}}
      on:playing={() => { isVideoPaused = false; }}
      on:pause={() => { isVideoPaused = true; }}
      on:error
      on:click={onMouseClick}
      on:mousemove={onMouseMove}
      on:contextmenu|preventDefault={onRightClick}
      on:keydown={onKeyDown}
      on:keyup={onKeyUp}
      on:wheel={onMouseWheel}
    ></video>

    {#if !videoStream}
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


