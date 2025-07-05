<script lang="ts">
  import { superForm } from 'sveltekit-superforms/client';
  import { zod } from 'sveltekit-superforms/adapters';
  import { FileText, Building, Users, Shield, Save, X } from 'lucide-svelte';
  import { goto } from "$app/navigation";
  
  import AdminPageLayout from '$lib/components/admin/layout/AdminPageLayout.svelte';
  import AdminCard from '$lib/components/admin/layout/AdminCard.svelte';
  import FormContainer from '$lib/components/ui_components_sveltekit/form/FormContainer.svelte';
  import AccountFormFields from '$lib/components/ui_components_sveltekit/form/AccountFormFields.svelte';
  import EnhancedSelect from '$lib/components/ui_components_sveltekit/form/EnhancedSelect.svelte';
  import RelationshipSection from '$lib/components/ui_components_sveltekit/relationships/RelationshipSection.svelte';
  import { Button } from '$lib/components/ui/button';
  
  import { getDetailPageFormConfigWithGuard, getSelectProps, processFormMessages, useNavigationGuard } from '$lib/utils/formHelpers';
  
  import { accountEditSchema, ACCOUNT_STATUS_OPTIONS } from '../schema';
  
  import ConfirmationDialog from '$lib/components/ui_components_sveltekit/dialog/ConfirmationDialog.svelte';
  
  import type { PageData } from './$types';
  
  export let data: PageData;
  
  const title = `Edit Account: ${data.account.name}`;
  const pageCrumbs = [
    ['Dashboard', '/admin/dashboard'],
    ['Accounts', '/admin/accounts/accounts'],
    [data.account.name, '']
  ] as [string, string][];
  
  // Initialize navigation guard (replaces all the manual dialog state management)
  const navigationGuard = useNavigationGuard("Account");
  const { dialogOpen, dialogTitle, dialogDescription, guardedNavigate, handleConfirm, handleCancel, getDialogProps } = navigationGuard;
  
  // Enhanced SuperForms setup using utilities
  const { form, errors, enhance, submitting, message, delayed, timeout, tainted } = 
    superForm(data.form, {
      validators: zod(accountEditSchema),
      ...getDetailPageFormConfigWithGuard("Account", () => {
        // Reset tainted state on successful submission (handled by the helper)
      })
    });
  
  // Reactive states
  $: isLoading = $submitting || $delayed;
  $: hasTimeout = $timeout;
  $: ({ errorMessage } = processFormMessages($message));
  $: hasChanges = Boolean($tainted && Object.keys($tainted).length > 0);
  
  // Form action URL
  const formAction = '?/updateAccount';
  
  const actionButtons = [
    {
      label: 'View All Accounts',
      onClick: () => {
        guardedNavigate(hasChanges, async () => {
          await goto('/admin/accounts/accounts');
        });
      },
      variant: 'outline' as const
    }
  ];
  
  // Generate slug from name
  function generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }
  
  // Auto-generate slug when name changes
  $: if ($form.name && (!$form.slug || $form.slug === generateSlug(previousName || ''))) {
    $form.slug = generateSlug($form.name);
    previousName = $form.name;
  }
  
  let previousName = data.account.name;
</script>

<AdminPageLayout
    {title}
    crumbs={pageCrumbs}
    {actionButtons}
    loading={isLoading}
    showCreateButton={false}
    compact={true}
    contentSpacing="space-y-4"
>
  <FormContainer 
    method="POST" 
    action={formAction}
    {enhance} 
    novalidate 
    {errorMessage}
    showAlerts={true}
    disabled={isLoading}
    {hasTimeout}
    {isLoading}
    delayed={$delayed}
  >
    <AdminCard
      title="Account Information"
      description="Edit account details"
      icon={FileText}
      compact={true}
      class_name="relative"
    >
      <div class="space-y-6">
        <AccountFormFields
          form={form}
          errors={errors}
          {isLoading}
          showStatus={true}
          showSlug={true}
        >
          <svelte:fragment slot="status-field">
            <EnhancedSelect
              name="status"
              options={ACCOUNT_STATUS_OPTIONS}
              bind:value={$form.status}
              placeholder="Select status"
              {...getSelectProps($errors, 'status', isLoading)}
            />
          </svelte:fragment>
        </AccountFormFields>
      </div>
    </AdminCard>

    <!-- Save Changes Section -->
      <div class="sticky bottom-0 bg-background border-t border-border p-4 -mx-4 -mb-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-2">
            {#if hasChanges && !isLoading}
              <div class="flex items-center space-x-2 text-sm text-muted-foreground">
                <div class="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
                <span>You have unsaved changes</span>
              </div>
            {/if}
          </div>
          
          <div class="flex items-center space-x-2">
            {#if hasChanges && !isLoading}
              <Button 
                type="button" 
                variant="outline"
                on:click={() => {
                  // Use the navigation guard which will show custom dialog if needed
                  guardedNavigate(hasChanges, async () => {
                    await goto('/admin/accounts/accounts');
                  });
                }}
                disabled={isLoading}
              >
                <X class="w-4 h-4 mr-2" />
                Cancel
              </Button>
            {/if}
            
            <Button 
              type="submit" 
              disabled={isLoading || !hasChanges}
              class="min-w-[120px]"
            >
              {#if isLoading}
                <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                Saving...
              {:else}
                <Save class="w-4 h-4 mr-2" />
                Save Changes
              {/if}
            </Button>
          </div>
        </div>
      </div>
  </FormContainer>

  <!-- Relationship Sections -->
  <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
    <!-- Companies Section -->
    <RelationshipSection
      title="Companies"
      description="Companies associated with this account"
      icon={Building}
      relationships={data.relationships.companies}
      availableItems={data.availableCompanies}
      relationshipType="companies"
      canAdd={false}
      canRemove={true}
      canCreate={true}
      viewUrl="/admin/accounts/companies"
      addAction="?/addCompany"
      removeAction="?/removeCompany"
      createAction="?/createAndAddCompany"
      loading={false}
      multiSelect={true}
      destructiveRemoval={true}
      removalWarningMessage="This will permanently delete the company record and all associated data. This action cannot be undone."
      enableCreateDialog={true}
      createDialogTitle="Create New Company"
      createDialogDescription="Create a new company and add it to this account"
    />

    <!-- Members Section -->
    <RelationshipSection
      title="Members"
      description="Users who are members of this account"
      icon={Users}
      relationships={data.relationships.members}
      availableItems={data.availableUsers}
      relationshipType="members"
      canAdd={true}
      canRemove={true}
      canCreate={false}
      viewUrl="/admin/users"
      addAction="?/addMember"
      removeAction="?/removeMember"
      loading={false}
      multiSelect={true}
    />
  </div>

  <!-- Groups Section (Full Width) -->
  <RelationshipSection
    title="Groups"
    description="Groups within this account"
    icon={Shield}
    relationships={data.relationships.groups}
    availableItems={data.availableGroups}
    relationshipType="groups"
    canAdd={true}
    canRemove={true}
    canCreate={false}
    viewUrl="/admin/accounts/groups"
    addAction="?/addGroup"
    removeAction="?/removeGroup"
    loading={false}
    multiSelect={false}
  />
</AdminPageLayout>

<!-- Custom Confirmation Dialog -->
<ConfirmationDialog
  bind:open={$dialogOpen}
  title={$dialogTitle}
  description={$dialogDescription}
  confirmText="Leave without saving"
  cancelText="Stay on page"
  onConfirm={handleConfirm}
  onCancel={handleCancel}
/>
