<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { Button } from '$lib/components/ui/button';
    import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '$lib/components/ui/select';
    import { Trash2, Send } from 'lucide-svelte';
    import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '$lib/components/ui/breadcrumb';
    import { initWebRTCClient, webrtcEvents, webrtcStatus, clearEvents, sendWebRTCMessage, sendDataChannelMessage, videoStream } from '$lib/utils/webrtc/webrtc-client';
    import { socketStore } from '$lib/stores/websocket-store';
    import { get } from 'svelte/store';
  
    let unsubscribe;
    let events = [];
    let filteredEvents = [];
    let selectedEventType = "all";
    let message = '';
    let messages = [];
    let videoElement: HTMLVideoElement;
    let isVideoLoading = true;
  
    const eventTypeOptions = [
      { value: "offer", label: "Offer" },
      { value: "answer", label: "Answer" },
      { value: "ice-candidate", label: "ICE Candidate" },
      { value: "error", label: "Error" }
    ];
  
    // When a video stream is available, bind it to the video element.
    $: if ($videoStream && videoElement) {
      videoElement.srcObject = $videoStream;
      videoElement.play();
      isVideoLoading = false;
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
      if (message.trim() && get(webrtcStatus).dataChannel) {
        sendDataChannelMessage(message);
        messages = [...messages, { text: message, sent: true, timestamp: new Date() }];
        message = '';
      }
    }
  
    onMount(() => {
      console.log('[WebRTC] Initializing client');
      unsubscribe = initWebRTCClient();
  
      const eventsUnsubscribe = webrtcEvents.subscribe(value => {
        events = value;
        updateFilteredEvents();
        // console.log('[WebRTC] Events updated:', events);
      });
  
      const statusUnsubscribe = webrtcStatus.subscribe(status => {
        if (status.dataChannel) {
          status.dataChannel.onmessage = (event) => {
            try {
              const msgText = typeof event.data === 'string' ? event.data : '[Binary data]';
              messages = [...messages, { text: msgText, sent: false, timestamp: new Date() }];
            } catch (error) {
              console.error('[WebRTC] Data channel message error:', error);
            }
          };
        }
      });
  
      const originalUnsubscribe = unsubscribe;
      unsubscribe = () => {
        console.log('[WebRTC] Cleaning up subscriptions');
        eventsUnsubscribe();
        statusUnsubscribe();
        if (originalUnsubscribe) originalUnsubscribe();
      };
  
      const tempVideoElement = document.createElement('video');
      const isH264Supported = tempVideoElement.canPlayType('video/mp4; codecs="avc1.42E01E, mp4a.40.2"');
      console.log('H.264 Supported:', isH264Supported);
    });
  
    onDestroy(() => {
      if (unsubscribe) unsubscribe();
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
  
    <!-- Video Stream Panel -->
    <div class="bg-white p-4 rounded-md shadow">
      <h2 class="text-lg font-medium mb-4">Video Stream</h2>
      <div class="relative aspect-video bg-black rounded-md overflow-hidden">
        {#if $videoStream}
          <video bind:this={videoElement} autoplay playsinline muted class="w-full h-full object-contain"></video>
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
          {#if $webrtcStatus.connected}
            <span class="text-green-600 font-medium flex items-center">
              <span class="inline-block w-2 h-2 bg-green-600 rounded-full mr-2"></span>Connected
            </span>
          {:else}
            <span class="text-red-600 font-medium flex items-center">
              <span class="inline-block w-2 h-2 bg-red-600 rounded-full mr-2"></span>Disconnected
            </span>
          {/if}
        </div>
        {#if $webrtcStatus.error}
          <div class="mt-2 p-2 bg-red-50 border border-red-200 rounded-md">
            <p class="text-red-600 text-sm">Error: {$webrtcStatus.error}</p>
          </div>
        {/if}
        {#if $webrtcStatus.lastEventTimestamp}
          <div>
            <span class="text-gray-500 text-sm">Last event:</span>
            <span class="text-gray-700 text-sm ml-1">{new Date($webrtcStatus.lastEventTimestamp).toLocaleString()}</span>
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
      {#if !$webrtcStatus.dataChannel || $webrtcStatus.dataChannel.readyState !== 'open'}
        <div class="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
          <p class="text-yellow-700">Data channel is not ready. Establish a WebRTC connection first.</p>
        </div>
      {:else}
        <div class="space-y-4">
          <div class="border border-gray-200 rounded-md p-2 h-64 overflow-y-auto">
            {#if messages.length === 0}
              <div class="text-gray-400 text-center p-4">No messages yet</div>
            {:else}
              {#each messages as msg}
                <div class="mb-2 p-2 rounded-md {msg.sent ? 'bg-blue-100 ml-auto max-w-[80%]' : 'bg-gray-100 mr-auto max-w-[80%]'}">
                  <div class="break-words">{msg.text}</div>
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
  