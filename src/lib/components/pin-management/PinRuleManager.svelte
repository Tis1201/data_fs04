<script lang="ts">
  import { onMount } from 'svelte';
  import { toast } from 'svelte-sonner';
  import { Plus, Edit, Trash2, Eye, Settings, Filter, Search, RefreshCw, ChevronDown, ChevronUp } from 'lucide-svelte';

  interface PinRule {
    id: string;
    ruleType: 'admin_default' | 'user_default' | 'admin_custom' | 'user_custom';
    name: string;
    description: string | null;
    apps: string[];
    targetType: string | null;
    targetValue: string[];
    priority: number;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
    createdByUser: {
      id: string;
      name: string;
      email: string;
    };
    account: {
      id: string;
      name: string;
      slug: string;
    } | null;
    _count: {
      devicePins: number;
      userActions: number;
    };
  }

  export let mode: 'admin' | 'user' = 'admin';
  let rules: PinRule[] = [];
  let loading = false;
  let error: string | null = null;
  let searchTerm = '';
  let filterType = '';
  let showCreateForm = false;
  let showEditForm = false;
  let editingRule: PinRule | null = null;
  let showRuleDetails = false;
  let selectedRule: PinRule | null = null;

  // Form data
  let formData = {
    name: '',
    description: '',
    apps: [] as string[],
    targetType: 'all',
    targetValue: [] as string[],
    isActive: true
  };

  // Available apps for selection
  let availableApps: Array<{ package_name: string; app_name: string }>= [];
  let loadingApps = false;
  let appSearchTerm = '';
  let currentAppPage = 1;
  let appsPerPage = 50; // Increased for better performance
  let totalAppPages = 1;
  let totalApps = 0;
  let appSearchTimeout: NodeJS.Timeout;

  onMount(() => {
    loadRules();
    loadAvailableApps();
  });

  // Handle Escape key to close modals
  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      if (showCreateForm || showEditForm) {
        resetForm();
      } else if (showRuleDetails) {
        showRuleDetails = false;
        selectedRule = null;
      }
    }
  }

  async function loadRules() {
    try {
      loading = true;
      error = null;

      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (filterType) params.append('ruleType', filterType);

      const response = await fetch(`/api/pin-rules?${params.toString()}`);
      const result = await response.json();

      if (result.success) {
        rules = result.data.rules;
      } else {
        throw new Error(result.message || 'Failed to load pin rules');
      }

    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load rules';
      toast.error('Failed to load pin rules', {
        description: error
      });
    } finally {
      loading = false;
    }
  }

  async function loadAvailableApps() {
    try {
      loadingApps = true;
      
      // Build query parameters
      const params = new URLSearchParams({
        page: currentAppPage.toString(),
        limit: appsPerPage.toString()
      });
      
      if (appSearchTerm) {
        params.append('search', appSearchTerm);
      }
      
      // Fetch paginated package names from ClickHouse via API
      const response = await fetch(`/api/apps/available?${params.toString()}`);
      const result = await response.json();

      if (result.success) {
        availableApps = (result.data.apps || []) as Array<{ package_name: string; app_name: string }>;
        totalApps = result.data.pagination.total;
        totalAppPages = result.data.pagination.totalPages;
        
        console.log(`Loaded ${availableApps.length} apps (page ${currentAppPage}/${totalAppPages}) from ClickHouse`);
      } else {
        throw new Error(result.message || 'Failed to load apps');
      }

    } catch (err) {
      console.error('Failed to load available apps:', err);
      toast.error('Failed to load available apps', {
        description: err instanceof Error ? err.message : 'Unknown error'
      });
      
      // Fallback to empty array if API fails
      availableApps = [];
      totalApps = 0;
      totalAppPages = 1;
    } finally {
      loadingApps = false;
    }
  }

  async function createRule() {
    try {
      // Automatically set rule type based on mode
      const ruleData = {
        ...formData,
        ruleType: mode === 'admin' ? 'admin_custom' : 'user_custom'
      };

      const response = await fetch('/api/pin-rules', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(ruleData)
      });

      const result = await response.json();

      if (result.success) {
        toast.success('Pin rule created successfully', {
          description: `Rule "${formData.name}" has been created`
        });
        
        resetForm();
        await loadRules();
      } else {
        throw new Error(result.message || 'Failed to create rule');
      }

    } catch (err) {
      toast.error('Failed to create pin rule', {
        description: err instanceof Error ? err.message : 'Unknown error'
      });
    }
  }

  async function updateRule() {
    if (!editingRule) return;

    try {
      // Include the original rule type when updating
      const ruleData = {
        ...formData,
        ruleType: editingRule.ruleType
      };

      const response = await fetch(`/api/pin-rules/${editingRule.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(ruleData)
      });

      const result = await response.json();

      if (result.success) {
        toast.success('Pin rule updated successfully', {
          description: `Rule "${formData.name}" has been updated`
        });
        
        resetForm();
        await loadRules();
      } else {
        throw new Error(result.message || 'Failed to update rule');
      }

    } catch (err) {
      toast.error('Failed to update pin rule', {
        description: err instanceof Error ? err.message : 'Unknown error'
      });
    }
  }

  async function deleteRule(rule: PinRule) {
    // Prevent deletion of admin default rules
    if (rule.ruleType === 'admin_default' || rule.ruleType === 'user_default') {
      toast.error('Cannot delete admin default rules', {
        description: 'Admin default rules are system-managed and cannot be deleted'
      });
      return;
    }

    if (!confirm(`Are you sure you want to delete the rule "${rule.name}"?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/pin-rules/${rule.id}`, {
        method: 'DELETE'
      });

      const result = await response.json();

      if (result.success) {
        toast.success('Pin rule deleted successfully', {
          description: `Rule "${rule.name}" has been deleted`
        });
        
        await loadRules();
      } else {
        throw new Error(result.message || 'Failed to delete rule');
      }

    } catch (err) {
      toast.error('Failed to delete pin rule', {
        description: err instanceof Error ? err.message : 'Unknown error'
      });
    }
  }

  function resetForm() {
    formData = {
      name: '',
      description: '',
      apps: [],
      targetType: 'all',
      targetValue: [],
      isActive: true
    };
    appSearchTerm = '';
    currentAppPage = 1;
    showCreateForm = false;
    showEditForm = false;
    editingRule = null;
  }

  function startEdit(rule: PinRule) {
    editingRule = rule;
    formData = {
      name: rule.name,
      description: rule.description || '',
      apps: [...rule.apps],
      targetType: rule.targetType || 'all',
      targetValue: [...rule.targetValue],
      isActive: rule.isActive
    };
    showEditForm = true;
  }

  function showDetails(rule: PinRule) {
    selectedRule = rule;
    showRuleDetails = true;
  }

  function toggleAppSelection(app: string) {
    if (formData.apps.includes(app)) {
      formData.apps = formData.apps.filter(a => a !== app);
    } else {
      formData.apps = [...formData.apps, app];
    }
  }

  function getRuleTypeColor(ruleType: string): string {
    switch (ruleType) {
      case 'admin_default': return 'text-red-600 bg-red-50';
      case 'user_default': return 'text-blue-600 bg-blue-50';
      case 'admin_custom': return 'text-red-600 bg-red-50';
      case 'user_custom': return 'text-green-600 bg-green-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  }

  function getRuleTypeLabel(ruleType: string): string {
    switch (ruleType) {
      case 'admin_default': return 'Admin Default';
      case 'user_default': return 'Account Default';
      case 'admin_custom': return 'Admin Custom';
      case 'user_custom': return 'User Custom';
      default: return ruleType;
    }
  }

  function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString();
  }

  // Computed properties for app display
  $: paginatedApps = availableApps; // Apps are already paginated from server

  function nextAppPage() {
    if (currentAppPage < totalAppPages) {
      currentAppPage++;
      loadAvailableApps();
    }
  }

  function prevAppPage() {
    if (currentAppPage > 1) {
      currentAppPage--;
      loadAvailableApps();
    }
  }

  function resetAppPagination() {
    currentAppPage = 1;
  }

  // Handle search with debouncing
  $: if (appSearchTerm !== undefined) {
    clearTimeout(appSearchTimeout);
    appSearchTimeout = setTimeout(() => {
      resetAppPagination();
      loadAvailableApps();
    }, 300); // 300ms debounce
  }

  function handleModalBackdropClick(event: MouseEvent) {
    // Only close if clicking on the backdrop (not the modal content)
    if (event.target === event.currentTarget) {
      if (showCreateForm || showEditForm) {
        resetForm();
      } else if (showRuleDetails) {
        showRuleDetails = false;
        selectedRule = null;
      }
    }
  }

  // A11y: provide keyboard equivalent for backdrop click (Enter/Space)
  function handleModalBackdropKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' || event.key === ' ') {
      if (showCreateForm || showEditForm) {
        resetForm();
      } else if (showRuleDetails) {
        showRuleDetails = false;
        selectedRule = null;
      }
    }
  }
</script>
<svelte:window on:keydown={handleKeydown} />

<div class="space-y-6">
  <!-- Header -->
  <div class="flex items-center justify-between">
    <div>
      <h1 class="text-3xl font-bold text-gray-900">Pin Rule Management</h1>
      <p class="text-gray-600 mt-1">Manage hierarchical pin rules for device apps</p>
    </div>
    
    <button
      on:click={() => showCreateForm = true}
      class="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
    >
      <Plus class="w-4 h-4" />
      <span>Create Rule</span>
    </button>
  </div>

  <!-- Filters -->
  <div class="flex items-center space-x-4">
    <div class="flex-1">
      <div class="relative">
        <Search class="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
        <input
          type="text"
          placeholder="Search rules..."
          bind:value={searchTerm}
          on:input={loadRules}
          class="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>
    </div>
  </div>

  <!-- Rules List -->
  {#if loading}
    <div class="flex items-center justify-center py-12">
      <RefreshCw class="w-8 h-8 animate-spin text-gray-400" />
      <span class="ml-3 text-gray-600">Loading rules...</span>
    </div>
  {:else if error}
    <div class="text-center py-12">
      <div class="text-red-600 mb-2">Failed to load rules</div>
      <div class="text-gray-600 text-sm">{error}</div>
      <button
        on:click={loadRules}
        class="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
      >
        Retry
      </button>
    </div>
  {:else if rules.length === 0}
    <div class="text-center py-12">
      <Settings class="w-12 h-12 mx-auto mb-4 text-gray-300" />
      <div class="text-gray-500 mb-2">No pin rules found</div>
      <div class="text-gray-400 text-sm">Create your first pin rule to get started</div>
    </div>
  {:else}
    <div class="space-y-8">
      <!-- Admin Rules (visible for admins; in user mode only as fallback when no user_custom exists) -->
      {#if (rules.filter(r => r.ruleType === 'admin_default' ).length > 0)
          || (mode === 'user' && rules.filter(r => r.ruleType === 'user_custom').length === 0 && rules.filter(r => r.ruleType === 'admin_custom').length > 0)}
        <div>
          <div class="flex items-center space-x-3 mb-4">
            <h2 class="text-xl font-semibold text-gray-900">{mode === 'admin' ? 'Admin Rules' : 'Default Rules (Admin)'}</h2>
            <span class="px-2 py-1 text-xs rounded-full bg-red-100 text-red-800">
              System Managed
            </span>
          </div>
          <p class="text-sm text-gray-600 mb-4">
            {mode === 'admin'
              ? 'These rules are created by system administrators and apply based on targeting. They cannot be deleted but can be edited by admins.'
              : 'Your account has no default rules yet. Admin defaults are currently applied.'}
          </p>
          <div class="grid gap-4">
            {#each rules.filter(r => r.ruleType === 'admin_custom' || r.ruleType === 'admin_default') as rule}
              <div class="bg-white border border-red-200 rounded-lg p-6 hover:shadow-md transition-shadow">
                <div class="flex items-start justify-between">
                  <div class="flex-1">
                    <div class="flex items-center space-x-3 mb-2">
                      <h3 class="text-lg font-semibold text-gray-900">{rule.name}</h3>
                      <span class="px-2 py-1 text-xs rounded-full {getRuleTypeColor(rule.ruleType)}">
                        {getRuleTypeLabel(rule.ruleType)}
                      </span>
                      <span class="px-2 py-1 text-xs rounded-full {rule.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
                        {rule.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    
                    {#if rule.description}
                      <p class="text-gray-600 mb-3">{rule.description}</p>
                    {/if}
                    
                    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
                      <div>
                        <span class="font-medium">Apps:</span> {rule.apps.length}
                      </div>
                      <div>
                        <span class="font-medium">Target:</span> {rule.targetType || 'all'}
                      </div>
                      <div>
                        <span class="font-medium">Priority:</span> {rule.priority}
                      </div>
                      <div>
                        <span class="font-medium">Devices:</span> {rule._count.devicePins}
                      </div>
                    </div>
                    
                    <div class="mt-3 text-xs text-gray-500">
                      Created by {rule.createdByUser.name} on {formatDate(rule.createdAt)}
                    </div>
                  </div>
                  
                  <div class="flex items-center space-x-2 ml-4">
                    <button
                      on:click={() => showDetails(rule)}
                      class="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                      title="View Details"
                    >
                      <Eye class="w-4 h-4" />
                    </button>
                    
                    <button
                      on:click={() => startEdit(rule)}
                      class="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                      title="Edit Rule (Admin Only)"
                    >
                      <Edit class="w-4 h-4" />
                    </button>
                    {#if rule.ruleType === 'admin_default'}
                      <button
                        disabled
                        class="p-2 text-gray-300 cursor-not-allowed"
                        title="Cannot delete admin default rules"
                      >
                        <Trash2 class="w-4 h-4" />
                      </button>
                    {:else}
                      <button
                        on:click={() => deleteRule(rule)}
                        class="p-2 text-gray-400 hover:text-red-600 transition-colors"
                        title="Delete Rule"
                      >
                        <Trash2 class="w-4 h-4" />
                      </button>
                    {/if}
                  </div>
                </div>
              </div>
            {/each}
          </div>
        </div>
      {/if}


      <!-- User Custom Rules -->
      {#if rules.filter(r => r.ruleType === 'user_custom' || r.ruleType === 'user_default').length > 0}
        <div>
          <div class="flex items-center space-x-3 mb-4">
            <h2 class="text-xl font-semibold text-gray-900">My Custom Rules</h2>
            <span class="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">
              Personal
            </span>
          </div>
          <p class="text-sm text-gray-600 mb-4">
            These are your personal pin rules that you can create, edit, and delete as needed.
          </p>
          <div class="grid gap-4">
            {#each rules.filter(r => r.ruleType === 'user_custom'|| r.ruleType === 'user_default') as rule}
              <div class="bg-white border border-green-200 rounded-lg p-6 hover:shadow-md transition-shadow">
                <div class="flex items-start justify-between">
                  <div class="flex-1">
                    <div class="flex items-center space-x-3 mb-2">
                      <h3 class="text-lg font-semibold text-gray-900">{rule.name}</h3>
                      <span class="px-2 py-1 text-xs rounded-full {getRuleTypeColor(rule.ruleType)}">
                        {getRuleTypeLabel(rule.ruleType)}
                      </span>
                      <span class="px-2 py-1 text-xs rounded-full {rule.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
                        {rule.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    
                    {#if rule.description}
                      <p class="text-gray-600 mb-3">{rule.description}</p>
                    {/if}
                    
                    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
                      <div>
                        <span class="font-medium">Apps:</span> {rule.apps.length}
                      </div>
                      <div>
                        <span class="font-medium">Target:</span> {rule.targetType || 'all'}
                      </div>
                      <div>
                        <span class="font-medium">Priority:</span> {rule.priority}
                      </div>
                      <div>
                        <span class="font-medium">Devices:</span> {rule._count.devicePins}
                      </div>
                    </div>
                    
                    <div class="mt-3 text-xs text-gray-500">
                      Created by {rule.createdByUser.name} on {formatDate(rule.createdAt)}
                      {#if rule.account}
                        • Account: {rule.account.name}
                      {/if}
                    </div>
                  </div>
                  
                  <div class="flex items-center space-x-2 ml-4">
                    <button
                      on:click={() => showDetails(rule)}
                      class="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                      title="View Details"
                    >
                      <Eye class="w-4 h-4" />
                    </button>
                    
                    <button
                      on:click={() => startEdit(rule)}
                      class="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                      title="Edit Rule"
                    >
                      <Edit class="w-4 h-4" />
                    </button>

                    {#if rule.ruleType === 'user_default'}
                      <button
                        disabled
                        class="p-2 text-gray-300 cursor-not-allowed"
                        title="Cannot delete account default rules"
                      >
                        <Trash2 class="w-4 h-4" />
                      </button>
                    {:else}
                      <button
                        on:click={() => deleteRule(rule)}
                        class="p-2 text-gray-400 hover:text-red-600 transition-colors"
                        title="Delete Rule"
                      >
                        <Trash2 class="w-4 h-4" />
                      </button>
                    {/if}
                  </div>
                </div>
              </div>
            {/each}
          </div>
        </div>
      {/if}
    </div>
  {/if}

  <!-- Create/Edit Form Modal -->
  {#if showCreateForm || showEditForm}
    <div 
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      on:click={handleModalBackdropClick}
      on:keydown={handleModalBackdropKeydown}
      role="button"
      tabindex="0"
      aria-label="Close modal"
      aria-modal="true"
    >
      <div class="bg-white rounded-lg p-6 w-full max-w-6xl max-h-[95vh] overflow-y-auto">
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-xl font-semibold text-gray-900">
            {showCreateForm ? 'Create Pin Rule' : 'Edit Pin Rule'}
          </h2>
          <button
            on:click={resetForm}
            class="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <ChevronUp class="w-6 h-6" />
          </button>
        </div>
        
        <form on:submit|preventDefault={showCreateForm ? createRule : updateRule} class="space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label for="targetType" class="block text-sm font-medium text-gray-700 mb-1">Target Type</label>
              <select id="targetType" bind:value={formData.targetType} class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                <option value="all">All Devices</option>
                <option value="tags">By Tags</option>
                <option value="os">By OS</option>
                <option value="devices">Specific Devices</option>
              </select>
            </div>
          </div>
          
          <div>
            <label for="ruleName" class="block text-sm font-medium text-gray-700 mb-1">Rule Name</label>
            <input
              id="ruleName"
              type="text"
              bind:value={formData.name}
              placeholder="Enter rule name"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          
          <div>
            <label for="ruleDescription" class="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              id="ruleDescription"
              bind:value={formData.description}
              placeholder="Enter rule description"
              rows="3"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            ></textarea>
          </div>
          
          <div>
            <label for="appsToPin" class="block text-sm font-medium text-gray-700 mb-1">Apps to Pin</label>
            
            <!-- App Search and Controls -->
            <div class="mb-3 flex items-center space-x-3">
              <div class="relative flex-1">
                <Search class="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  bind:value={appSearchTerm}
                  placeholder="Search apps by name or package..."
                  class="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <button
                type="button"
                on:click={loadAvailableApps}
                disabled={loadingApps}
                class="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                title="Refresh apps from ClickHouse"
              >
                <RefreshCw class="w-4 h-4 {loadingApps ? 'animate-spin' : ''}" />
                <span>Refresh</span>
              </button>
            </div>

            <!-- App Selection Area -->
            <div id="appsToPin" class="border border-gray-300 rounded-lg p-4 max-h-80 overflow-y-auto">
              {#if loadingApps}
                <div class="text-center py-8 text-gray-500">Loading apps...</div>
              {:else if availableApps.length === 0}
                <div class="text-center py-8 text-gray-500">
                  {#if appSearchTerm}
                    No apps found matching "{appSearchTerm}"
                  {:else}
                    No apps available
                  {/if}
                </div>
              {:else}
                <!-- Selected Apps Summary -->
                {#if formData.apps.length > 0}
                  <div class="mb-4 p-3 bg-blue-50 rounded-lg">
                    <div class="flex items-center justify-between">
                      <span class="text-sm font-medium text-blue-800">
                        {formData.apps.length} app{formData.apps.length === 1 ? '' : 's'} selected
                      </span>
                      <button
                        type="button"
                        on:click={() => formData.apps = []}
                        class="text-xs text-blue-600 hover:text-blue-800 underline"
                      >
                        Clear all
                      </button>
                    </div>
                  </div>
                {/if}

                <!-- Apps Grid -->
                <div class="grid grid-cols-1 gap-2 mb-4">
                  {#each paginatedApps as app}
                    <label class="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.apps.includes(app.package_name)}
                        on:change={() => toggleAppSelection(app.package_name)}
                        class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span class="text-sm text-gray-700 flex-1">
                        {app.app_name || app.package_name}
                        <span class="text-gray-400"> — {app.package_name}</span>
                      </span>
                      {#if formData.apps.includes(app.package_name)}
                        <span class="text-xs text-blue-600 font-medium">Selected</span>
                      {/if}
                    </label>
                  {/each}
                </div>

                <!-- Pagination Controls -->
                {#if totalAppPages > 1}
                  <div class="flex items-center justify-between border-t border-gray-200 pt-4">
                    <div class="flex items-center space-x-2">
                      <button
                        type="button"
                        on:click={prevAppPage}
                        disabled={currentAppPage === 1 || loadingApps}
                        class="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Previous
                      </button>
                      <span class="text-sm text-gray-600">
                        Page {currentAppPage} of {totalAppPages}
                      </span>
                      <button
                        type="button"
                        on:click={nextAppPage}
                        disabled={currentAppPage === totalAppPages || loadingApps}
                        class="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Next
                      </button>
                    </div>
                    <div class="text-sm text-gray-500">
                      Showing {((currentAppPage - 1) * appsPerPage) + 1}-{Math.min(currentAppPage * appsPerPage, totalApps)} of {totalApps} apps
                      {#if appSearchTerm}
                        (filtered by "{appSearchTerm}")
                      {/if}
                    </div>
                  </div>
                {/if}
              {/if}
            </div>
          </div>
          
          <div class="flex items-center justify-end space-x-3">
            <button
              type="button"
              on:click={resetForm}
              class="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              {showCreateForm ? 'Create Rule' : 'Update Rule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  {/if}

  <!-- Rule Details Modal -->
  {#if showRuleDetails && selectedRule}
    <div 
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      on:click={handleModalBackdropClick}
      on:keydown={handleModalBackdropKeydown}
      role="button"
      tabindex="0"
      aria-label="Close modal"
      aria-modal="true"
    >
      <div class="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-xl font-semibold text-gray-900">Rule Details</h2>
          <button
            on:click={() => showRuleDetails = false}
            class="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <ChevronUp class="w-6 h-6" />
          </button>
        </div>
        
        <div class="space-y-6">
          <div>
            <h3 class="text-lg font-medium text-gray-900 mb-2">{selectedRule.name}</h3>
            <div class="flex items-center space-x-3 mb-4">
              <span class="px-2 py-1 text-xs rounded-full {getRuleTypeColor(selectedRule.ruleType)}">
                {getRuleTypeLabel(selectedRule.ruleType)}
              </span>
              <span class="px-2 py-1 text-xs rounded-full {selectedRule.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
                {selectedRule.isActive ? 'Active' : 'Inactive'}
              </span>
              <span class="text-sm text-gray-500">Priority: {selectedRule.priority}</span>
            </div>
            
            {#if selectedRule.description}
              <p class="text-gray-600 mb-4">{selectedRule.description}</p>
            {/if}
          </div>
          
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 class="font-medium text-gray-900 mb-2">Targeting</h4>
              <div class="text-sm text-gray-600">
                <p><strong>Type:</strong> {selectedRule.targetType || 'all'}</p>
                {#if selectedRule.targetValue.length > 0}
                  <p><strong>Values:</strong> {selectedRule.targetValue.join(', ')}</p>
                {/if}
              </div>
            </div>
            
            <div>
              <h4 class="font-medium text-gray-900 mb-2">Statistics</h4>
              <div class="text-sm text-gray-600">
                <p><strong>Apps:</strong> {selectedRule.apps.length}</p>
                <p><strong>Devices:</strong> {selectedRule._count.devicePins}</p>
                <p><strong>Actions:</strong> {selectedRule._count.userActions}</p>
              </div>
            </div>
          </div>
          
          <div>
            <h4 class="font-medium text-gray-900 mb-2">Apps to Pin</h4>
            <div class="bg-gray-50 rounded-lg p-3">
              <div class="grid grid-cols-1 gap-1">
                {#each selectedRule.apps as app}
                  <div class="text-sm text-gray-700">{app}</div>
                {/each}
              </div>
            </div>
          </div>
          
          <div class="text-sm text-gray-500">
            <p><strong>Created by:</strong> {selectedRule.createdByUser.name} ({selectedRule.createdByUser.email})</p>
            <p><strong>Created:</strong> {formatDate(selectedRule.createdAt)}</p>
            <p><strong>Updated:</strong> {formatDate(selectedRule.updatedAt)}</p>
            {#if selectedRule.account}
              <p><strong>Account:</strong> {selectedRule.account.name}</p>
            {/if}
          </div>
        </div>
        
        <div class="flex items-center justify-end mt-6">
          <button
            on:click={() => showRuleDetails = false}
            class="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>
