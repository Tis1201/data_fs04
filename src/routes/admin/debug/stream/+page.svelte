<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { Button } from '$lib/components/ui/button';
    import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '$lib/components/ui/select';
    import { Trash2, Send } from 'lucide-svelte';
    import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '$lib/components/ui/breadcrumb';
    import { initWebRTCClient, webrtcEvents, webrtcStatus, clearEvents, sendWebRTCMessage, sendDataChannelMessage, videoStream } from '$lib/utils/webrtc/webrtc-client';
    import { socketStore } from '$lib/stores/websocket-store';
    import { get } from 'svelte/store';
    import { webRTCStore } from '$lib/stores/webrtc-store';
    import { roomStore } from '$lib/stores/room-store';

    let unsubscribe;
    let events = [];
    let filteredEvents = [];
    let selectedEventType = "all";
    let message = '';
    let messages = [];
    let videoElement: HTMLVideoElement;
    let isVideoLoading = true;
    let isVideoPaused = true;
    let webrtcState;
    let unsubscribeRTC;
    let roomState;
    let unsubscribeRoom;

    const eventTypeOptions = [
      { value: "offer", label: "Offer" },
      { value: "answer", label: "Answer" },
      { value: "ice-candidate", label: "ICE Candidate" },
      { value: "error", label: "Error" }
    ];

    // Track the current video stream ID to avoid redundant updates
    let currentVideoStreamId = '';
    let playAttemptInProgress = false;
    let playAttemptTimeout: ReturnType<typeof setTimeout> | null = null;
    
    // Function to safely play the video with debouncing
    function safePlayVideo() {
      if (playAttemptInProgress || !videoElement) return;
      
      // Clear any pending timeout
      if (playAttemptTimeout) {
        clearTimeout(playAttemptTimeout);
        playAttemptTimeout = null;
      }
      
      // Set a small delay to debounce multiple play attempts
      playAttemptTimeout = setTimeout(() => {
        if (!videoElement) return;
        
        playAttemptInProgress = true;
        console.log('[WebRTC] Attempting to play video...');
        
        const playPromise = videoElement.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              console.log('[WebRTC] Video playback started successfully');
              isVideoLoading = false;
              isVideoPaused = false;
              playAttemptInProgress = false;
            })
            .catch(error => {
              console.error('[WebRTC] Error playing video:', error);
              playAttemptInProgress = false;
              
              // If autoplay was prevented, we can try again with user interaction
              if (error.name === 'NotAllowedError') {
                console.log('[WebRTC] Autoplay prevented, waiting for user interaction');
              } else if (error.name === 'AbortError') {
                console.log('[WebRTC] Play request was aborted, will retry in 1s');
                // Try again after a short delay
                setTimeout(safePlayVideo, 1000);
              }
            });
        } else {
          playAttemptInProgress = false; 
        } 
      }, 250); // 250ms debounce delay
    }
    
    // When a video stream is available, bind it to the video element.
    $: if ($videoStream && videoElement && (!currentVideoStreamId || currentVideoStreamId !== $videoStream.id)) {
      console.log('[WebRTC] Setting video stream to element:', $videoStream.id);
      currentVideoStreamId = $videoStream.id;
      
      // Only set srcObject if it's a different stream
      if (videoElement.srcObject !== $videoStream) {
        videoElement.srcObject = $videoStream;
        // Attempt to play the video
        safePlayVideo();
      }
    }

    function updateFilteredEvents() {
      filteredEvents = selectedEventType === "all"
        ? events
        : events.filter(event => event.type === selectedEventType);
    }

    function handleClearEvents() {
      console.log('[WebRTC] Clearing events');
      clearEvents();
    }

    function sendMessage() {
      if (message.trim()) {
        const success = sendDataChannelMessage(message);
        // The message will be added to the store in the sendDataChannelMessage function
        // We don't need to manually add it to the messages array anymore
        message = '';
      }
    }

    // Monitor video play/pause state
    function updateVideoState() {
      if (!videoElement) return;
      
      isVideoPaused = videoElement.paused;
      
      // Set up event listeners for play/pause state changes
      if (!videoElement._hasPlayPauseListeners) {
        videoElement._hasPlayPauseListeners = true;
        
        videoElement.addEventListener('play', () => {
          console.log('[WebRTC] Video play event');
          isVideoPaused = false;
        });
        
        videoElement.addEventListener('pause', () => {
          console.log('[WebRTC] Video pause event');
          isVideoPaused = true;
        });
      }
    }
    
    // Update video state whenever the video element or stream changes
    $: if (videoElement) {
      updateVideoState();
    }
    
    onMount(() => {
      unsubscribeRoom = roomStore.subscribe(state => {
    console.log('[roomState]', state);
        roomState = state;
        if (roomState?.roomId && !unsubscribe) {
          unsubscribe = initWebRTCClient();

          // Subscribe to webRTCStore
          unsubscribeRTC = webRTCStore.subscribe(state => {
            webrtcState = state;
          });

          const eventsUnsubscribe = webrtcEvents.subscribe(value => {
            events = value;
            updateFilteredEvents();
          });

          const statusUnsubscribe = webrtcStatus.subscribe(status => {
            // We don't need to manually handle data channel messages anymore
            // as they're now handled in the webrtc-client.ts and stored in the webRTCStore
            console.log('[WebRTC] Status updated:', status);
          });

          const originalUnsubscribe = unsubscribe;
          unsubscribe = () => {
            console.log('[WebRTC] Cleaning up subscriptions');
            eventsUnsubscribe();
            statusUnsubscribe();
            if (originalUnsubscribe) originalUnsubscribe();
          };
        } else if (!roomState?.roomId && !roomState?.error) {
          roomStore.createRoom();
        }
      });
      const tempVideoElement = document.createElement('video');
      const isH264Supported = tempVideoElement.canPlayType('video/mp4; codecs="avc1.42E01E, mp4a.40.2"');
      console.log('H.264 Supported:', isH264Supported);
    });

    onDestroy(() => {
      if (unsubscribe) unsubscribe();
      if (unsubscribeRTC) unsubscribeRTC();
      if (unsubscribeRoom) unsubscribeRoom();
    });

    $: if (events) updateFilteredEvents();
  </script>

  <div class="space-y-4 p-4">
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <a href="/admin" class="text-sm font-medium underline-offset-4 hover:underline">Main</a>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>WebRTC Debug</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>

    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-semibold">WebRTC Debug Console</h1>
      <div class="flex space-x-2">
        <Button size="sm" variant="outline" on:click={handleClearEvents}>
          <Trash2 class="mr-2 h-4 w-4" /> Clear Events
        </Button>
      </div>
    </div>

    {#if roomState?.roomId}
      <div class="bg-white p-4 rounded-md shadow mb-4">
        <h2 class="text-lg font-medium mb-2">Room Info</h2>
        <div class="flex flex-col space-y-2">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="text-sm text-gray-500">Room ID:</span>
              <code class="px-1.5 py-0.5 rounded bg-gray-100 font-mono text-xs">{roomState.roomId}</code>
            </div>
            <button 
              class="text-gray-500 hover:text-gray-700" 
              title="Copy Room ID"
              on:click={() => navigator.clipboard.writeText(roomState.roomId)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
            </button>
          </div>
          
          {#if roomState.status?.password}
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="text-sm text-gray-500">Password:</span>
                <code class="px-1.5 py-0.5 rounded bg-gray-100 font-mono text-xs">{roomState.status.password}</code>
              </div>
              <button 
                class="text-gray-500 hover:text-gray-700" 
                title="Copy Password"
                on:click={() => navigator.clipboard.writeText(roomState.status.password)}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
              </button>
            </div>
          {/if}
          
          <div class="grid grid-cols-2 gap-2 text-xs">
            {#if roomState.status?.createdAt}
              <div>
                <span class="text-gray-500">Created:</span>
                <span class="ml-1">{new Date(roomState.status.createdAt).toLocaleString()}</span>
              </div>
            {/if}
            {#if roomState.status?.createdBy}
              <div>
                <span class="text-gray-500">By:</span>
                <span class="ml-1 font-mono">{roomState.status.createdBy}</span>
              </div>
            {/if}
            {#if typeof roomState.status?.participantCount === 'number'}
              <div>
                <span class="text-gray-500">Participants:</span>
                <span class="ml-1">{roomState.status.participantCount}</span>
              </div>
            {/if}
            {#if roomState.status?.lastActivity}
              <div>
                <span class="text-gray-500">Last Activity:</span>
                <span class="ml-1">{new Date(roomState.status.lastActivity).toLocaleString()}</span>
              </div>
            {/if}
          </div>
          
          <details class="mt-1">
            <summary class="text-xs text-gray-500 cursor-pointer">More details</summary>
            <div class="mt-2 p-2 bg-gray-50 rounded-md text-xs">
              {#if roomState.status?.admins && roomState.status.admins.length > 0}
                <div class="mb-2">
                  <span class="font-semibold">Admins:</span>
                  {#each roomState.status.admins as admin, i}
                    <span class="font-mono">{admin}</span>{i < roomState.status.admins.length - 1 ? ', ' : ''}
                  {/each}
                </div>
              {/if}
              
              {#if roomState.status?.participants && roomState.status.participants.length > 0}
                <div class="mb-2">
                  <span class="font-semibold">Participants:</span>
                  <ul class="ml-2 mt-1 space-y-1">
                    {#each roomState.status.participants as p}
                      <li class="flex items-center gap-2">
                        <span class="font-mono">{p.userId}</span>
                        {#if p.socketId}
                          <span class="text-gray-400">({p.socketId})</span>
                        {/if}
                        {#if p.isAdmin}
                          <span class="bg-yellow-100 text-yellow-800 px-1 rounded text-xs">admin</span>
                        {/if}
                      </li>
                    {/each}
                  </ul>
                </div>
              {/if}
              
              {#if roomState.status?.metadata}
                <div>
                  <span class="font-semibold">Metadata:</span>
                  <pre class="bg-gray-100 p-2 rounded text-xs mt-1 overflow-x-auto">{JSON.stringify(roomState.status.metadata, null, 2)}</pre>
                </div>
              {/if}
            </div>
          </details>
        </div>
      </div>
    {:else if roomState?.error}
      <div class="bg-red-50 border border-red-200 rounded-md p-4 mb-4 text-red-700">
        Error: {roomState.error}
      </div>
    {:else}
      <div class="bg-gray-50 border border-gray-200 rounded-md p-4 mb-4 text-gray-700">
        Creating room...
      </div>
    {/if}
    
    <!-- Video Stream Panel -->
    <div class="bg-white p-4 rounded-md shadow">
      <h2 class="text-lg font-medium mb-4">Video Stream</h2>
      <div class="relative aspect-video bg-black rounded-md overflow-hidden">
        {#if $videoStream}
          <video 
            bind:this={videoElement} 
            playsinline 
            muted 
            class="w-full h-full object-contain"
            on:click={safePlayVideo}
          ></video>
          
          <!-- Play button overlay - only show when video is paused -->
          {#if isVideoPaused}
            <div 
              class="absolute inset-0 flex items-center justify-center bg-black bg-opacity-40 cursor-pointer" 
              on:click={safePlayVideo}
            >
              <div class="rounded-full bg-white bg-opacity-80 p-3 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polygon points="5 3 19 12 5 21 5 3"></polygon>
                </svg>
              </div>
            </div>
          {/if}
        {:else}
          <div class="absolute inset-0 flex items-center justify-center text-white">
            <p>Waiting for video stream...</p>
          </div>
        {/if}
      </div>
      <div class="mt-2 text-sm text-gray-500 flex items-center space-x-2">
        <span>Status:
          {#if !$videoStream}
            <span class="text-red-600">No stream</span>
          {:else if !videoElement?.paused}
            <span class="text-green-600">Playing</span>
          {:else if videoElement?.paused}
            <span class="text-yellow-600">Stopped</span>
          {/if}
        </span>
        <span>{$videoStream?.id}</span>
      </div>
    </div>

    <!-- Connection Status Panel -->
    <div class="bg-white p-4 rounded-md shadow">
      <h2 class="text-lg font-medium mb-4">Connection Status</h2>
      <div class="space-y-2">
        <div class="flex items-center">
          <span class="font-medium mr-2">Socket:</span>
          {#if webrtcState?.connectionStatus === 'connected'}
            <span class="text-green-600 font-medium flex items-center">
              <span class="inline-block w-2 h-2 bg-green-600 rounded-full mr-2"></span>Connected
            </span>
          {:else if webrtcState?.connectionStatus === 'disconnected'}
            <span class="text-red-600 font-medium flex items-center">
              <span class="inline-block w-2 h-2 bg-red-600 rounded-full mr-2"></span>Disconnected
            </span>
          {:else}
            <span class="text-yellow-600 font-medium flex items-center">
              <span class="inline-block w-2 h-2 bg-yellow-600 rounded-full mr-2"></span>Error: {webrtcState?.error}
            </span>
          {/if}
        </div>
        {#if webrtcState?.error}
          <div class="mt-2 p-2 bg-red-50 border border-red-200 rounded-md">
            <p class="text-red-600 text-sm">Error: {webrtcState?.error}</p>
          </div>
        {/if}
        {#if webrtcState?.lastEventTimestamp}
          <div>
            <span class="text-gray-500 text-sm">Last event:</span>
            <span class="text-gray-700 text-sm ml-1">{new Date(webrtcState?.lastEventTimestamp).toLocaleString()}</span>
          </div>
        {/if}
        <div class="mt-4">
          <span class="text-gray-500 text-sm">Total events: {events.length}</span>
        </div>
      </div>
    </div>

    <!-- Data Channel Chat -->
    <div class="md:col-span-2 bg-white p-4 rounded-md shadow">
      <h2 class="text-lg font-medium mb-4">Data Channel Chat</h2>
      {#if !webrtcState?.dataChannel || webrtcState?.dataChannelStatus !== 'open'}
        <div class="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
          <p class="text-yellow-700">Data channel is not ready. Establish a WebRTC connection first.</p>
        </div>
      {:else}
        <div class="space-y-4">
          <div class="border border-gray-200 rounded-md p-2 h-64 overflow-y-auto">
            {#if !webrtcState?.dataChannelMessages || webrtcState.dataChannelMessages.length === 0}
              <div class="text-gray-400 text-center p-4">No messages yet</div>
            {:else}
              {#each webrtcState.dataChannelMessages as msg}
                <div class="mb-2 p-2 rounded-md {msg.direction === 'sent' ? 'bg-blue-100 ml-auto max-w-[80%]' : 'bg-gray-100 mr-auto max-w-[80%]'}">
                  <div class="break-words">{msg.content}</div>
                  <div class="text-xs text-gray-500 mt-1">{msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString() : ''}</div>
                </div>
              {/each}
            {/if}
          </div>
          <div class="flex items-center space-x-2">
            <input 
              type="text" 
              class="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground"
              placeholder="Type a message..." 
              bind:value={message}
              on:keydown={(e) => e.key === 'Enter' && message.trim() && sendMessage()}
            />
            <Button on:click={sendMessage} disabled={!message.trim()}>
              <Send class="mr-2 h-4 w-4" /> Send
            </Button>
          </div>
        </div>
      {/if}
    </div>

    <!-- Event Log Panel -->
    <div class="bg-white p-4 rounded-md shadow">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-lg font-medium">Event Log</h2>
        <div class="flex items-center space-x-2">
          <span class="text-sm text-gray-500">Filter:</span>
          <Select value={selectedEventType} on:change={(e) => { selectedEventType = e.detail; updateFilteredEvents(); }}>
            <SelectTrigger class="w-[180px]">
              <SelectValue placeholder="Filter events" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Events</SelectItem>
              {#each eventTypeOptions as option}
                <SelectItem value={option.value}>{option.label}</SelectItem>
              {/each}
            </SelectContent>
          </Select>
        </div>
      </div>
      {#if filteredEvents.length === 0}
        <div class="p-8 text-center">
          <p class="text-gray-500 italic">No events received yet</p>
        </div>
      {:else}
        <div class="space-y-3 max-h-[500px] overflow-y-auto pr-2">
          {#each filteredEvents as event}
            <div class="border border-gray-200 rounded-md p-3 {event.source === 'local' ? 'bg-blue-50' : ''}">
              <div class="flex justify-between items-center">
                <div class="flex items-center">
                  <span class="font-medium">{event.type}</span>
                  {#if event.source === 'local'}
                    <span class="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">Sent</span>
                  {:else}
                    <span class="ml-2 text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">Received</span>
                  {/if}
                </div>
                <span class="text-sm text-gray-500">{new Date(event.timestamp).toLocaleTimeString()}</span>
              </div>
              <div class="relative group mt-2">
                <button class="text-xs text-blue-600 hover:text-blue-800 flex items-center">
                  <span>View JSON data</span>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="ml-1">
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                </button>
                <div class="hidden group-hover:block absolute z-10 mt-1 w-full max-w-md bg-white border border-gray-200 rounded-md shadow-lg p-2">
                  <pre class="bg-gray-50 p-2 rounded text-xs whitespace-pre-wrap break-all max-h-64 overflow-y-auto">
                    {JSON.stringify(event.data, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>