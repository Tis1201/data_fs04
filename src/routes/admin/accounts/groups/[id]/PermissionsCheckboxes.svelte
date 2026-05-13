<script lang="ts">
  import {
    ADMIN_SIDEBAR_ITEMS,
    USER_SIDEBAR_ITEMS,
    ADMIN_CATEGORIES,
    USER_CATEGORIES,
    getPermissionDependencies,
    type GroupRole,
    type PermissionAction
  } from '$lib/constants/permissions';
  import { Checkbox } from "$lib/components/ui/checkbox";
  import { Badge } from "$lib/components/ui/badge";
  import { Shield, User, CheckCircle2, Circle, Zap } from "lucide-svelte";
  import { Label } from "$lib/components/ui/label";
  import { RadioGroup, RadioGroupItem } from "$lib/components/ui/radio-group";
  import { Button } from "$lib/components/ui/button";
  
  export let permissions: Record<string, boolean> = {};
  export let disabled = false;
  export let groupRole: GroupRole = 'ADMIN'; // Default to ADMIN access
  export let onSave: (() => void) | undefined = undefined;
  export let isLoading = false;
  export let showSaveButton = true; // New prop to control save button visibility
  
  function togglePermission(module: string, action: PermissionAction) {
    const key = `${module}_${action}`;
    const newValue = !permissions[key];
    
    if (newValue) {
      const deps = getPermissionDependencies(action);
      deps.forEach(dep => {
        permissions[`${module}_${dep}`] = true;
      });
    } else {
      permissions[key] = false;
      
      if (action === 'EDIT') {
        permissions[`${module}_DELETE`] = false;
      }
      if (action === 'CREATE') {
        permissions[`${module}_EDIT`] = false;
        permissions[`${module}_DELETE`] = false;
      }
      if (action === 'VIEW') {
        permissions[`${module}_CREATE`] = false;
        permissions[`${module}_EDIT`] = false;
        permissions[`${module}_DELETE`] = false;
      }
    }
    
    permissions = { ...permissions };
  }
  
  function getPermissionKey(module: string, action: PermissionAction): string {
    return `${module}_${action}`;
  }
  
  // Apply permission template
  function applyTemplate(template: 'none' | 'read_only' | 'full_access') {
    const items = groupRole === 'ADMIN' ? ADMIN_SIDEBAR_ITEMS : USER_SIDEBAR_ITEMS;
    
    // Clear all permissions first
    Object.keys(permissions).forEach(key => {
      permissions[key] = false;
    });
    
    if (template === 'none') {
      permissions = { ...permissions };
      return;
    }
    
    Object.entries(items).forEach(([module, config]) => {
      if (template === 'read_only') {
        if (config.actions.includes('VIEW')) {
          permissions[`${module}_VIEW`] = true;
        }
      } else if (template === 'full_access') {
        config.actions.forEach(action => {
          permissions[`${module}_${action}`] = true;
        });
      }
    });
    
    permissions = { ...permissions };
  }
  
  $: sidebarItems = groupRole === 'ADMIN' ? ADMIN_SIDEBAR_ITEMS : USER_SIDEBAR_ITEMS;
  $: categories = groupRole === 'ADMIN' ? ADMIN_CATEGORIES : USER_CATEGORIES;
  
  // Count enabled permissions
  $: enabledCount = Object.values(permissions).filter(v => v).length;
  $: totalCount = Object.keys(sidebarItems).reduce((sum, key) => 
    sum + sidebarItems[key].actions.length, 0
  );
</script>

<div class="space-y-6">
  <!-- Role Selection -->
  <div class="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950/30 dark:to-blue-950/30 border-2 border-purple-200 dark:border-purple-800 rounded-lg p-5">
    <div class="flex items-center justify-between mb-4">
      <div>
        <h3 class="text-lg font-semibold text-foreground">Access Level</h3>
        <p class="text-sm text-muted-foreground mt-1">Choose the type of access this group will have</p>
      </div>
      <Badge variant="outline" class="text-sm px-3 py-1">
        {enabledCount} of {totalCount} permissions
      </Badge>
    </div>
    
    <RadioGroup bind:value={groupRole} class="grid grid-cols-2 gap-4" {disabled}>
      <div class="relative">
        <RadioGroupItem value="ADMIN" id="role-admin" {disabled} class="peer sr-only" />
        <Label 
          for="role-admin" 
          class="flex flex-col items-center justify-between rounded-lg border-2 border-muted bg-white dark:bg-slate-900 p-4 hover:bg-purple-50 dark:hover:bg-purple-950/20 peer-data-[state=checked]:border-purple-600 peer-data-[state=checked]:bg-purple-50 dark:peer-data-[state=checked]:bg-purple-950/30 cursor-pointer transition-all"
        >
          <Shield class="h-8 w-8 mb-2 text-purple-600" />
          <div class="space-y-1 text-center">
            <span class="text-base font-semibold">Admin Access</span>
            <p class="text-xs text-muted-foreground">Full system control & management</p>
          </div>
        </Label>
      </div>
      
      <div class="relative">
        <RadioGroupItem value="USER" id="role-user" {disabled} class="peer sr-only" />
        <Label 
          for="role-user" 
          class="flex flex-col items-center justify-between rounded-lg border-2 border-muted bg-white dark:bg-slate-900 p-4 hover:bg-blue-50 dark:hover:bg-blue-950/20 peer-data-[state=checked]:border-blue-600 peer-data-[state=checked]:bg-blue-50 dark:peer-data-[state=checked]:bg-blue-950/30 cursor-pointer transition-all"
        >
          <User class="h-8 w-8 mb-2 text-blue-600" />
          <div class="space-y-1 text-center">
            <span class="text-base font-semibold">User Access</span>
            <p class="text-xs text-muted-foreground">Limited to user features</p>
          </div>
        </Label>
      </div>
    </RadioGroup>
  </div>

  <!-- Quick Templates -->
  <div class="flex items-center gap-3 p-4 bg-muted/30 rounded-lg">
    <Zap class="h-5 w-5 text-amber-600" />
    <span class="text-sm font-medium">Quick Templates:</span>
    <div class="flex gap-2">
      <Button 
        type="button" 
        variant="outline" 
        size="sm" 
        on:click={() => applyTemplate('none')}
        {disabled}
      >
        <Circle class="h-3 w-3 mr-1" />
        None
      </Button>
      <Button 
        type="button" 
        variant="outline" 
        size="sm" 
        on:click={() => applyTemplate('read_only')}
        {disabled}
      >
        <Circle class="h-3 w-3 mr-1" />
        View Only
      </Button>
      <Button 
        type="button" 
        variant="outline" 
        size="sm" 
        on:click={() => applyTemplate('full_access')}
        {disabled}
      >
        <CheckCircle2 class="h-3 w-3 mr-1" />
        Full Access
      </Button>
    </div>
  </div>

  <!-- Save Button (only show if onSave is provided and showSaveButton is true) -->
  {#if showSaveButton && onSave}
    <div class="flex justify-end">
      <Button 
        type="button"
        on:click={onSave} 
        disabled={isLoading}
        size="default"
        class="min-w-[180px]"
      >
        <Shield class="h-4 w-4 mr-2" />
        {isLoading ? 'Saving...' : 'Save Permissions'}
      </Button>
    </div>
  {/if}

  <!-- Permissions Table/Matrix -->
  <div class="border rounded-lg overflow-hidden">
    <div class="bg-muted/50 px-4 py-3 border-b">
      <h3 class="font-semibold text-base flex items-center gap-2">
        {#if groupRole === 'ADMIN'}
          <Shield class="h-5 w-5 text-purple-600" />
          Admin Permissions
        {:else}
          <User class="h-5 w-5 text-blue-600" />
          User Permissions
        {/if}
      </h3>
      <p class="text-sm text-muted-foreground mt-1">
        Manage what this group can access and modify
      </p>
    </div>

    <div class="divide-y">
      {#each Object.entries(categories) as [categoryName, moduleKeys]}
        {@const categoryModules = moduleKeys.map(key => ({ key, config: sidebarItems[key] })).filter(({ config }) => config)}
        
        {#if categoryModules.length > 0}
          <!-- Category Header -->
          <div class="bg-gradient-to-r from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-900 px-4 py-2.5 border-l-4 border-l-blue-500">
            <h4 class="text-sm font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wide">
              {categoryName}
            </h4>
          </div>
          
          <!-- Modules in Category -->
          {#each categoryModules as { key: module, config }}
            <div class="px-4 py-3 hover:bg-muted/30 transition-colors">
              <div class="flex items-start justify-between gap-4">
                <!-- Module Name -->
                <div class="flex-1 min-w-0">
                  <div class="font-medium text-sm">{config.label}</div>
                  {#if config.href}
                    <div class="text-xs text-muted-foreground mt-0.5 truncate">{config.href}</div>
                  {/if}
                </div>
                
                <!-- Permission Checkboxes (Horizontal) -->
                <div class="flex items-center gap-6">
                  {#each config.actions as action}
                    {@const key = getPermissionKey(module, action)}
                    {@const isChecked = permissions[key] || false}
                    <label class="flex items-center gap-2 cursor-pointer group" title="{action} permission">
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={() => togglePermission(module, action)}
                        {disabled}
                        class="cursor-pointer"
                      />
                      <span class="text-xs font-medium min-w-[50px] group-hover:text-foreground transition-colors
                        {isChecked ? 'text-foreground' : 'text-muted-foreground'}">
                        {action}
                      </span>
                    </label>
                  {/each}
                </div>
              </div>
            </div>
          {/each}
        {/if}
      {/each}
    </div>
  </div>

  <!-- Info Footer -->
  <div class="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg text-sm">
    <div class="text-blue-600 dark:text-blue-400 mt-0.5">
      <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    </div>
    <div class="flex-1 text-blue-900 dark:text-blue-100">
      <p class="font-medium mb-1">Permission Dependencies</p>
      <ul class="text-xs space-y-1 text-blue-700 dark:text-blue-300">
        <li>• <strong>Edit</strong> requires <strong>View + Create</strong></li>
        <li>• <strong>Delete</strong> requires <strong>View + Create + Edit</strong></li>
        <li>• Unchecking a permission will automatically uncheck dependent permissions</li>
      </ul>
    </div>
  </div>
</div>
