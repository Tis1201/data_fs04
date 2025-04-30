<script lang="ts">
  import { z } from 'zod';
  import { createEventDispatcher } from 'svelte';
  import { superForm } from 'sveltekit-superforms';
  import { MessageSquare, Send, Loader2 } from 'lucide-svelte';
  import { Button } from '$lib/components/ui/button';
  import * as Sheet from '$lib/components/ui/sheet';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import { Textarea } from '$lib/components/ui/textarea';

  export let accountId: string;
  export let open = false;
  
  const dispatch = createEventDispatcher();
  
  // Zod schema for validation
  const messageSchema = z.object({
    to: z.string().min(1, 'Recipient phone number is required'),
    message: z.string().min(1, 'Message cannot be empty'),
  });
  
  // Form state
  let to = '85298710992'; // No + sign as Baileys will format it correctly
  let message = 'Test';
  let sending = false;
  let error = '';
  let success = false;
  
  // Conversation history
  let messages = [];
  let loadingHistory = false;

  // Reset form whe
  // n opening the sheet
  $: if (open) {
    to = '85298710992';
    message = 'Test';
    error = '';
    success = false;
    messages = [];
  }
  
  // Load message history when recipient changes
  let debounceTimer;
  $: {
    if (to.trim() && accountId) {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        fetchMessageHistory(to.trim());
      }, 500); // Debounce for 500ms to avoid too many requests while typing
    }
  }
  
  async function fetchMessageHistory(recipient) {
    if (!recipient || !accountId) return;
    
    loadingHistory = true;
    try {
      const response = await fetch(`/api/whatsapp/messages?accountId=${accountId}&contact=${encodeURIComponent(recipient)}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.messages) {
          messages = data.messages;
        }
      }
    } catch (err) {
      console.error('Error fetching message history:', err);
    } finally {
      loadingHistory = false;
    }
  }

  function closeSheet() {
    open = false;
    dispatch('close');
  }

  async function sendMessage() {
    if (!to.trim()) {
      error = 'Recipient phone number is required';
      return;
    }
    
    if (!message.trim()) {
      error = 'Message cannot be empty';
      return;
    }
    
    const messageToSend = message.trim();
    error = '';
    success = false;
    sending = true;
    
    try {
      console.log(`Sending message to ${to.trim()} with accountId ${accountId}`);
      
      // Call backend API to send message
      const response = await fetch(`/api/whatsapp/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          accountId: accountId,
          to: to.trim(),
          message: messageToSend
        })
      });
      
      const result = await response.json();
      console.log('Message send response:', result);
      
      if (!response.ok) {
        error = result.error || 'Failed to send message';
        console.error('Error sending message:', error);
      } else {
        success = true;
        // Add the sent message to the conversation
        messages = [...messages, {
          id: Date.now().toString(),
          direction: 'outgoing',
          content: messageToSend,
          timestamp: new Date().toISOString(),
          status: 'sent'
        }];
        message = '';
        dispatch('sent', { success: true });
      }
    } catch (err) {
      console.error('Exception during message send:', err);
      error = err.message || 'An unexpected error occurred';
    } finally {
      sending = false;
    }
  }
</script>

<Sheet.Root bind:open>
  <Sheet.Content side="right" class="w-[400px] sm:w-[540px] max-w-full">
    <Sheet.Header>
      <Sheet.Title class="flex items-center gap-2">
        <MessageSquare size={18} />
        <span>Send WhatsApp Message</span>
      </Sheet.Title>
      <Sheet.Description>
        Send a direct message to this WhatsApp account
      </Sheet.Description>
    </Sheet.Header>
    
    <div class="py-6">
      <div class="space-y-4 mb-4">
        <div class="grid gap-2">
          <Label for="recipient-input">Recipient</Label>
          <div class="relative">
            <Input id="recipient-input" bind:value={to} placeholder="Phone number (e.g. 6597350605)" />
            {#if loadingHistory}
              <div class="absolute right-3 top-1/2 -translate-y-1/2">
                <div class="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
              </div>
            {/if}
          </div>
        </div>
        
        <div class="grid gap-2">
          <Label for="message-input">Message</Label>
          <Textarea id="message-input" bind:value={message} placeholder="Type your message here" class="min-h-[100px]" />
        </div>
        
        <!-- Conversation History -->
        {#if loadingHistory}
          <div class="space-y-2">
            <Label for="conversation-history-loading">Conversation History</Label>
            <div id="conversation-history-loading" class="border rounded-md p-3 h-60 flex items-center justify-center bg-gray-50">
              <div class="text-sm text-gray-500">Loading messages...</div>
            </div>
          </div>
        {:else if messages.length > 0}
          <div class="space-y-2">
            <Label for="conversation-history">Conversation History</Label>
            <div id="conversation-history" class="border rounded-md p-3 h-60 overflow-y-auto bg-gray-50">
              <div class="space-y-3">
                {#each messages as msg}
                  <div class="flex flex-col {msg.direction === 'outgoing' ? 'items-end' : 'items-start'}">
                    <div class="{msg.direction === 'outgoing' ? 'bg-blue-100 text-blue-800' : 'bg-gray-200'} px-3 py-2 rounded-lg max-w-[80%] break-words">
                      {msg.content}
                    </div>
                    <span class="text-xs text-gray-500 mt-1">
                      {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      {#if msg.direction === 'outgoing'}
                        · {msg.status}
                      {/if}
                    </span>
                  </div>
                {/each}
              </div>
            </div>
          </div>
        {/if}
        
        {#if error}
          <p class="text-sm text-destructive mt-2">{error}</p>
        {/if}
        {#if success}
          <p class="text-sm text-green-600 mt-2">Message sent successfully!</p>
        {/if}
      </div>
    </div>
    
    <Sheet.Footer class="flex justify-end gap-2">
      <Button 
        variant="outline"
        size="sm"
        on:click={closeSheet} 
        disabled={sending}
      >
        Cancel
      </Button>
      <Button 
        variant="default"
        size="sm"
        on:click={sendMessage} 
        disabled={sending || !to.trim() || !message.trim()}
      >
        {#if sending}
          <Loader2 class="mr-2 h-4 w-4 animate-spin" />
          Sending...
        {:else}
          <Send class="mr-2 h-4 w-4" />
          Send Message
        {/if}
      </Button>
    </Sheet.Footer>
  </Sheet.Content>
</Sheet.Root>
