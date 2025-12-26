<script lang="ts">
    import { goto } from '$app/navigation';
    import { ArrowLeft, Mail, Trash2, Save } from 'lucide-svelte';
    import { toast } from 'svelte-sonner';
    import { enhance } from '$app/forms';
    
    // Import layout components
    import AdminPageLayout from "$lib/components/admin/layout/AdminPageLayout.svelte";
    import AdminCard from "$lib/components/admin/layout/AdminCard.svelte";
    import FormContainer from "$lib/components/ui_components_sveltekit/form/FormContainer.svelte";
    import MetadataFooter from "$lib/components/ui_components_sveltekit/metadata/MetadataFooter.svelte";
    // Import form components
    import FormField from "$lib/components/ui_components_sveltekit/form/FormField.svelte";
    import FormRow from "$lib/components/ui_components_sveltekit/form/FormRow.svelte";
    import { Input } from "$lib/components/ui/input";
    import EmailProviderBadge from "$lib/components/ui_components_sveltekit/display/EmailProviderBadge.svelte";
    // Import provider-specific settings components
    import SmtpSettings from './settings_smtp.svelte';
    import ResendSettings from './settings_resend.svelte';
    
    export let data;
    import { truncateText } from "$lib/utils/text-utils";
    const { emailSettings } = data;
    const title = truncateText(emailSettings.name, 40);
    
    // Define breadcrumbs for this page
    const pageCrumbs = [
        ["Home", "/"],
        ["Settings", "/admin/settings"],
        ["Email", "/admin/settings/email"],
        truncateText(emailSettings.name, 40)
    ];
    
    // Handle delete
    function deleteEmailSettings() {
        if (confirm('Are you sure you want to delete these email settings? This action cannot be undone.')) {
            document.getElementById('deleteForm').submit();
        }
    }
    
    // Form submission handler
    let submitting = false;
</script>

<AdminPageLayout
    {title}
    crumbs={pageCrumbs}
    actionButtons={[
      {
        label: "Back",
        icon: ArrowLeft,
        onClick: () => goto('/admin/settings/email'),
        variant: "outline",
        class: "h-9"
      },
      {
        label: "Delete",
        icon: Trash2,
        onClick: deleteEmailSettings,
        variant: "destructive",
        class: "h-9"
      },
      {
        label: "Save",
        icon: Save,
        type: "submit",
        form: "emailSettingsForm",
        class: "h-9"
      }
    ]}
    loading={submitting}
    showCreateButton={false}
    compact={true}
    contentSpacing="space-y-6"
>
    <div class="w-full space-y-6">
        <FormContainer
            id="emailSettingsForm"
            method="POST"
            action="?/updateEmail"
            enhance={() => {
                submitting = true;
                return ({ result }) => {
                    submitting = false;
                    if (result.type === 'success') {
                        toast.success('Email settings updated successfully');
                    } else if (result.type === 'failure') {
                        toast.error(result.data?.message || 'Failed to update email settings');
                    }
                };
            }}
            novalidate
        >
            <AdminCard
                title="Email Settings"
                description="Configure email provider settings"
                icon={Mail}
                compact={true}
            >
                <!-- Common Fields -->
                <div class="space-y-6">
                    <FormRow columns={2}>
                        <FormField 
                            id="name" 
                            label="Provider Name" 
                        >
                            <Input 
                                id="name" 
                                name="name" 
                                value={emailSettings.name}
                                placeholder="Enter provider name"
                                required
                            />
                        </FormField>
                        
                        <FormField 
                            id="type" 
                            label="Provider Type"
                        >
                            <div class="flex items-center h-10  py-2 ">
                                <EmailProviderBadge type={emailSettings.type} />
                            </div>
                        </FormField>
                    </FormRow>
                    
                    

                    <FormRow columns={2}>
                        <FormField
                            label="From Email"
                            description="Default sender email address"
                        >
                            <Input 
                                name="fromEmail" 
                                value={emailSettings.fromEmail || ''}
                                placeholder="noreply@example.com"
                                required
                            />
                        </FormField>
                        
                        <FormField
                            label="From Name"
                            description="Optional sender name"
                        >
                            <Input 
                                name="fromName" 
                                value={emailSettings.fromName || ''}
                                placeholder="Company Name"
                            />
                        </FormField>
                    </FormRow>

                    <!-- <FormRow>
                        <FormField
                            label="Description"
                            description="Optional description for this email provider"
                        >
                            <Input 
                                name="description" 
                                value={emailSettings.description || ''}
                                placeholder="Enter description"
                            />
                        </FormField>
                    </FormRow> -->
                    
                    <!-- Type-specific Fields -->
                    {#if emailSettings.type === 'smtp'}
                        <SmtpSettings {emailSettings} />
                    {:else if emailSettings.type === 'resend'}
                        <ResendSettings {emailSettings} />
                   
                    {/if}
                </div>
                
                
            
            <svelte:fragment slot="footer">
                <MetadataFooter
                    items={[
                        { label: "Created", date: emailSettings.createdAt, icon: 'calendar' },
                        { label: "Last Updated", date: emailSettings.updatedAt, icon: 'clock' },
                        { label: "Type", value: emailSettings.type, icon: 'tag' }
                    ]}
                />
            </svelte:fragment>
            </AdminCard>
        </FormContainer>
    </div>
</AdminPageLayout>

<!-- Hidden form for email settings deletion -->
<form 
    id="deleteForm" 
    method="POST" 
    action="?/deleteEmail" 
    use:enhance={{
        onSubmit: () => {
            return ({ result }) => {
                if (result.type === 'success') {
                    toast.success('Email settings deleted successfully');
                    goto('/admin/settings/email');
                } else if (result.type === 'failure') {
                    toast.error(result.data?.message || 'Failed to delete email settings');
                }
            };
        }
    }}
    class="hidden"
>
    <!-- No additional form fields needed since we're using the ID from the URL params -->
</form>
