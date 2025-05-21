<script lang="ts">
  import { 
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuLabel,
    DropdownMenuSeparator
  } from "$lib/components/ui/dropdown-menu";
  import { Badge } from "$lib/components/ui/badge";
  import { Check, ChevronDown, Building } from "lucide-svelte";
  import { goto } from "$app/navigation";
  import { page } from "$app/stores";
  import { toast } from 'svelte-sonner';
  import { onMount } from 'svelte';
  
  // Types for account memberships
  type Account = {
    id: string;
    name: string;
    slug: string;
  };
  
  type AccountMembership = {
    id: string;
    role: string;
    account?: Account;
    name?: string; // For flattened structure
  };
  
  // Props
  export let currentAccount: AccountMembership | null = null;
  export let accountMemberships: AccountMembership[] = [];
  
  // Derived from page store if not provided
  $: {
    if (!currentAccount && $page.data.currentAccount) {
      currentAccount = $page.data.currentAccount;
    }
    
    if (!accountMemberships.length && $page.data.accountMemberships) {
      accountMemberships = $page.data.accountMemberships;
    }
  }
  
  // For debugging
  $: console.log('AccountSelector - currentAccount:', currentAccount);
  $: console.log('AccountSelector - accountMemberships:', accountMemberships);
  
  // Make sure we always have the latest data from the page store
  $: currentAccountName = currentAccount?.account?.name || // Nested structure
                          currentAccount?.name || // Flattened structure
                          $page.data?.currentAccount?.account?.name || // Nested from page
                          $page.data?.currentAccount?.name || // Flattened from page
                          'Select Account';
  
  // Switch account function
  async function switchAccount(accountId: string) {
    // Debug the account ID being switched to
    console.log('Switching to account ID:', accountId);
    try {
      const response = await fetch('/api/account/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId })
      });
      
      const result = await response.json();
      
      if (result.success) {
        // Reload the page to reflect the new account context
        toast.success(`Now using ${result.account.name}`);
        
        // Reload the current page to refresh data with new account context
        goto(window.location.pathname, { replaceState: true });
      } else {
        toast.error(result.message || "Failed to switch account");
      }
    } catch (error) {
      console.error('Error switching account:', error);
      toast.error("An unexpected error occurred");
    }
  }
  
  // Helper to get role badge variant
  function getRoleBadgeVariant(role: string) {
    switch (role) {
      case 'OWNER': return "default"; // Primary color
      case 'ADMIN': return "secondary"; // Secondary color
      case 'MEMBER': return "outline"; // Outlined style
      default: return "outline";
    }
  }
</script>

<DropdownMenu>
  <DropdownMenuTrigger class="flex items-center gap-2 px-3 py-1.5 rounded-md bg-background hover:bg-accent/50 transition-colors border border-input shadow-sm">
    <Building class="h-4 w-4 text-primary" />
    <span class="max-w-[150px] font-medium truncate">
      {currentAccountName}
    </span>
    {#if currentAccount}
      <Badge variant={getRoleBadgeVariant(currentAccount.role)} class="ml-1">
        {currentAccount.role}
      </Badge>
    {/if}
    <ChevronDown class="h-4 w-4 ml-1 text-muted-foreground" />
  </DropdownMenuTrigger>
  
  <DropdownMenuContent align="end" class="w-60">
    <DropdownMenuLabel>Your Accounts</DropdownMenuLabel>
    <DropdownMenuSeparator />
    
    {#if accountMemberships.length === 0}
      <div class="px-2 py-1.5 text-sm text-muted-foreground">
        No accounts available
      </div>
    {:else}
      {#each accountMemberships as membership}
        <DropdownMenuItem 
          on:click={() => switchAccount(membership.account?.id || membership.id)}
          class="flex justify-between cursor-pointer {(currentAccount?.account?.id === membership.account?.id || currentAccount?.id === membership.id) ? 'bg-accent/50' : ''}"
        >
          <div class="flex items-center gap-2">
            {#if currentAccount?.account?.id === membership.account?.id || currentAccount?.id === membership.id}
              <Check class="h-4 w-4 text-primary" />
            {:else}
              <span class="w-4"></span>
            {/if}
            <span class="truncate font-medium">{membership.account?.name || membership.name || 'Unknown Account'}</span>
          </div>
          
          <Badge variant={getRoleBadgeVariant(membership.role)}>
            {membership.role}
          </Badge>
        </DropdownMenuItem>
      {/each}
    {/if}
    
    <DropdownMenuSeparator />
    <div class="px-2 py-1.5 text-xs text-muted-foreground">
      Switch accounts to access different workspaces
    </div>
  </DropdownMenuContent>
</DropdownMenu>
