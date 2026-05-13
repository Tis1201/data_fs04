<script lang="ts">
  import { Popover, PopoverContent, PopoverTrigger } from "$lib/components/ui/popover";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Check, ChevronsUpDown, Loader2, Search, User } from "lucide-svelte";
  import { tick } from "svelte";
  
  // The users array should be an array of AccountMembership objects
  export let users = [];
  export let selectedUser = '';
  export let onSelect: (userId: string) => void;
  export let error = '';
  export let loading = false;
  export let disabled = false;
  export let placeholder = 'Select a user...';
  
  let open = false;
  let searchQuery = '';
  let searchInput: HTMLInputElement;
  
  // Get the selected user's display name
  $: selectedUserName = selectedUser ? 
                      getUserDisplayName(users.find(m => m.id === selectedUser)) : '';
  
  // Always show all users in admin panel, only filter if search query exists
  $: filteredUsers = Array.isArray(users) ? users.filter(member => {
    if (!searchQuery) return true; // Show all users when no search query
    const query = searchQuery.toLowerCase();
    const name = member.user?.name?.toLowerCase() || '';
    const email = member.user?.email?.toLowerCase() || '';
    return name.includes(query) || email.includes(query);
  }) : [];
  
  // Helper function to get user display name
  function getUserDisplayName(member) {
    if (!member) return '';
    return member.user?.name || member.user?.email || 'Unknown User';
  }
  
  function handleSelect(userId: string) {
    onSelect(userId);
    open = false;
  }
  
  // Focus search input when popover opens
  $: if (open) {
    tick().then(() => {
      // Make sure searchInput exists and has a focus method before calling it
      if (searchInput && typeof searchInput.focus === 'function') {
        searchInput.focus();
      }
    });
  }
  
  // Clear search input when dropdown closes
  $: if (!open) {
    tick().then(() => {
      searchQuery = '';
    });
  }
  
  // Handle keyboard navigation
  function handleKeyDown(event: KeyboardEvent, userId?: string) {
    if (event.key === 'Enter' && userId) {
      handleSelect(userId);
      event.preventDefault();
    } else if (event.key === 'Escape') {
      open = false;
      event.preventDefault();
    }
  }
</script>

<div class="relative w-full">
  <Popover bind:open>
    <PopoverTrigger asChild let:builder>
      <Button
        builders={[builder]}
        variant="outline"
        role="combobox"
        aria-expanded={open}
        class="w-full justify-between"
        disabled={disabled || loading}
      >
        <div class="flex items-center gap-2 flex-1 min-w-0">
          {#if selectedUser}
            <div class="bg-muted p-1 rounded-full">
              <User class="h-3 w-3 text-muted-foreground" />
            </div>
          {/if}
          <span class="truncate">
            {selectedUser ? selectedUserName : placeholder}
          </span>
        </div>
        <div class="flex items-center">
          {#if loading}
            <Loader2 class="h-4 w-4 animate-spin" />
          {:else}
            <ChevronsUpDown class="h-4 w-4 opacity-50" />
          {/if}
        </div>
      </Button>
    </PopoverTrigger>
    <PopoverContent class="w-[300px] p-0" align="start">
      <div class="p-2 border-b relative">
        <Search class="h-4 w-4 absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          bind:this={searchInput}
          bind:value={searchQuery}
          placeholder="Search by name or email..."
          class="h-9 pl-8 w-full"
          on:keydown={handleKeyDown}
        />
      </div>
      <div class="max-h-[300px] overflow-y-auto py-1">
        {#if filteredUsers.length === 0}
          <div class="py-6 text-center text-sm text-muted-foreground">
            {#if searchQuery}
              <p>No users found matching "{searchQuery}"</p>
              <p class="text-xs mt-1">Try a different search term</p>
            {:else}
              <p>No users available to add</p>
              <p class="text-xs mt-1">All users are already in this group or no users exist in this account</p>
            {/if}
          </div>
        {:else}
          {#each filteredUsers as member}
            <button
              type="button"
              class="w-full text-left px-2 py-1.5 hover:bg-muted flex items-center justify-between rounded-sm
                {selectedUser === member.id ? 'bg-accent' : ''}"
              on:click={() => handleSelect(member.id)}
              on:keydown={(e) => handleKeyDown(e, member.id)}
              aria-selected={selectedUser === member.id}
              role="option"
            >
              <div class="flex items-center gap-2 flex-1 min-w-0">
                <div class="bg-muted p-1.5 rounded-full">
                  <User class="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <div class="flex-1 min-w-0">
                  <div class="font-medium truncate">
                    {member.user?.name || 'Unnamed User'}
                  </div>
                  {#if member.user?.email}
                    <div class="text-xs text-muted-foreground truncate">
                      {member.user.email}
                    </div>
                  {/if}
                </div>
              </div>
              {#if selectedUser === member.id}
                <Check class="h-4 w-4 ml-2 text-primary flex-shrink-0" />
              {/if}
            </button>
          {/each}
        {/if}
      </div>
    </PopoverContent>
  </Popover>
  {#if error}
    <p class="mt-1 text-sm text-destructive">{error}</p>
  {/if}
</div>
