<script lang="ts">
    import { goto } from "$app/navigation";
    import { ArrowLeft, Save, Mail, Server, Key, Globe, Cloud } from "lucide-svelte";
    import { Button } from "$lib/components/ui/button";
    import { Input } from "$lib/components/ui/input";
    import { Textarea } from "$lib/components/ui/textarea";
    import { Skeleton } from "$lib/components/ui/skeleton";
    import { Switch } from "$lib/components/ui/switch";
    import { Label } from "$lib/components/ui/label";
    import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "$lib/components/ui/card";
    import { Tabs, TabsContent, TabsList, TabsTrigger } from "$lib/components/ui/tabs";
    
    // Import the correct AdminPageLayout component with actionButtons support
    import AdminPageLayout from "$lib/components/admin/layout/AdminPageLayout.svelte";
    import AdminCard from "$lib/components/admin/layout/AdminCard.svelte";
    
    // Import form components
    import FormContainer from "$lib/components/ui_components_sveltekit/form/FormContainer.svelte";
    import FormRow from "$lib/components/ui_components_sveltekit/form/FormRow.svelte";
    import FormField from "$lib/components/ui_components_sveltekit/form/FormField.svelte";
    
    import type { PageData } from "./$types";
    
    export let data: PageData;
    const title = "Create Email Provider";

    // Define breadcrumbs for this page
    const pageCrumbs = [
        ["Admin", "/admin"],
        ["Settings", "/admin/settings"],
        ["Email", "/admin/settings/email"],
        "New Provider"
    ];
    
    // Import the reusable form handler
    import { createFormHandler } from '$lib/components/ui_components_sveltekit/form/utils/formHandler';
    
    // Create a form handler with standardized error handling
    const { form, errors, enhance, submitting, constraints, errorMessage } = createFormHandler(data.form, {
        successRedirect: '/admin/settings/email',
        validateOnInput: true,
        onSuccess: () => {
            // Toast is handled by the redirect
        }
    });

    // Set default provider type if not set
    $: if (!$form.type) $form.type = 'smtp';
    
    // Provider type icons and labels
    const providerInfo = {
        smtp: { icon: Server, label: 'SMTP Server' },
        resend: { icon: Key, label: 'Resend API' }
    };
</script>

<AdminPageLayout
    {title}
    crumbs={pageCrumbs}
    actionButtons={[
      {
        label: "Cancel",
        icon: ArrowLeft,
        onClick: () => goto('/admin/settings/email'),
        variant: "outline",
        class: "h-9" // Fixed height for consistency
      },
      {
        label: "Save",
        icon: Save,
        onClick: () => {
          const form = document.querySelector('form[action="?/create"]');
          if (form) form.requestSubmit();
        },
        class: "h-9" // Fixed height for consistency
      }
    ]}
    loading={$submitting}
    showCreateButton={false}
    compact={true}
    contentSpacing="space-y-4"
>
    <div class="w-full space-y-6">
        <FormContainer
            method="POST"
            action="?/create"
            {enhance}
            novalidate
            errorMessage={$errorMessage}
        >
            <!-- Basic Provider Information -->
            <AdminCard
                title="Provider Information"
                description="Create a new email provider"
                icon={Mail}
                compact={true}
            >
                <div class="space-y-6">
                    <FormRow columns={1}>
                        <FormField id="name" label="Provider Name" error={$errors.name}>
                            <Input
                                id="name"
                                name="name"
                                type="text"
                                bind:value={$form.name}
                                placeholder="Enter provider name"
                                aria-invalid={$errors.name ? 'true' : undefined}
                                {...$constraints.name}
                            />
                        </FormField>
                    </FormRow>
                </div>
            </AdminCard>
            
            <!-- Email Sender Information -->
            <AdminCard
                title="Email Sender Information"
                description="Configure default sender details"
                icon={Mail}
                compact={true}
            >
                <div class="space-y-6">
                    <FormRow columns={2}>
                        <FormField id="fromEmail" label="From Email" error={$errors.fromEmail}>
                            <Input
                                id="fromEmail"
                                name="fromEmail"
                                type="email"
                                bind:value={$form.fromEmail}
                                placeholder="noreply@example.com"
                                aria-invalid={$errors.fromEmail ? 'true' : undefined}
                                {...$constraints.fromEmail}
                            />
                        </FormField>
                        
                        <FormField id="fromName" label="From Name" error={$errors.fromName}>
                            <Input
                                id="fromName"
                                name="fromName"
                                type="text"
                                bind:value={$form.fromName}
                                placeholder="Company Name"
                                aria-invalid={$errors.fromName ? 'true' : undefined}
                                {...$constraints.fromName}
                            />
                        </FormField>
                    </FormRow>
                </div>
            </AdminCard>

            <!-- Provider Type Tabs -->
            <AdminCard
                title="Provider Configuration"
                description="Select and configure your email provider"
                compact={true}
            >
                <div class="space-y-6">
                    <!-- Provider Type Selection -->
                    <Tabs value={$form.type} onValueChange={(value) => $form.type = value} class="w-full">
                        <TabsList class="grid w-full grid-cols-2 mb-4">
                            {#each Object.entries(providerInfo) as [type, info]}
                                <TabsTrigger value={type} class="flex items-center gap-2">
                                    <svelte:component this={info.icon} class="h-4 w-4" />
                                    <span>{info.label}</span>
                                </TabsTrigger>
                            {/each}
                        </TabsList>
                        
                        <input type="hidden" name="type" value={$form.type} />
                        
                        <!-- SMTP Configuration -->
                        <TabsContent value="smtp" class="border rounded-md p-4">
                            <div class="space-y-6">
                                <FormRow columns={2}>
                                    <FormField id="smtpHost" label="SMTP Host" error={$errors.smtpHost}>
                                        <Input
                                            id="smtpHost"
                                            name="smtpHost"
                                            type="text"
                                            bind:value={$form.smtpHost}
                                            placeholder="smtp.example.com"
                                            aria-invalid={$errors.smtpHost ? 'true' : undefined}
                                            {...$constraints.smtpHost}
                                        />
                                    </FormField>
                                    
                                    <FormField id="smtpPort" label="SMTP Port" error={$errors.smtpPort}>
                                        <Input
                                            id="smtpPort"
                                            name="smtpPort"
                                            type="number"
                                            bind:value={$form.smtpPort}
                                            placeholder="587"
                                            aria-invalid={$errors.smtpPort ? 'true' : undefined}
                                            {...$constraints.smtpPort}
                                        />
                                    </FormField>
                                </FormRow>

                                <FormRow columns={2}>
                                    <FormField id="smtpUser" label="SMTP Username" error={$errors.smtpUser}>
                                        <Input
                                            id="smtpUser"
                                            name="smtpUser"
                                            type="text"
                                            bind:value={$form.smtpUser}
                                            placeholder="username@example.com"
                                            aria-invalid={$errors.smtpUser ? 'true' : undefined}
                                            {...$constraints.smtpUser}
                                        />
                                    </FormField>
                                    
                                    <FormField id="smtpPass" label="SMTP Password" error={$errors.smtpPass}>
                                        <Input
                                            id="smtpPass"
                                            name="smtpPass"
                                            type="password"
                                            bind:value={$form.smtpPass}
                                            placeholder="••••••••"
                                            aria-invalid={$errors.smtpPass ? 'true' : undefined}
                                            {...$constraints.smtpPass}
                                        />
                                    </FormField>
                                </FormRow>

                                <FormRow columns={2}>
                                    <FormField id="smtpSecure" label="Use Secure Connection (TLS/SSL)" error={$errors.smtpSecure}>
                                        <div class="flex items-center space-x-2">
                                            <Switch 
                                                id="smtpSecure" 
                                                name="smtpSecure"
                                                checked={$form.smtpSecure} 
                                                onCheckedChange={(checked) => $form.smtpSecure = checked}
                                            />
                                            <Label for="smtpSecure">Enable secure connection</Label>
                                        </div>
                                    </FormField>

                                    <FormField id="smtpAuth" label="Use Authentication" error={$errors.smtpAuth}>
                                        <div class="flex items-center space-x-2">
                                            <Switch 
                                                id="smtpAuth" 
                                                name="smtpAuth"
                                                checked={$form.smtpAuth} 
                                                onCheckedChange={(checked) => $form.smtpAuth = checked}
                                            />
                                            <Label for="smtpAuth">Enable SMTP authentication</Label>
                                        </div>
                                    </FormField>
                                </FormRow>
                            </div>
                        </TabsContent>
                        
                        <!-- Resend Configuration -->
                        <TabsContent value="resend" class="border rounded-md p-4">
                            <div class="space-y-6">
                                <FormRow columns={1}>
                                    <FormField id="apiKey" label="Resend API Key" error={$errors.apiKey}>
                                        <Input
                                            id="apiKey"
                                            name="apiKey"
                                            type="password"
                                            bind:value={$form.apiKey}
                                            placeholder="re_••••••••••••••••••••••••••••••"
                                            aria-invalid={$errors.apiKey ? 'true' : undefined}
                                            {...$constraints.apiKey}
                                        />
                                        <p class="text-xs text-muted-foreground mt-1">
                                            Get your API key from the Resend dashboard
                                        </p>
                                    </FormField>
                                </FormRow>
                            </div>
                        </TabsContent>
                    </Tabs>
                </div>
            </AdminCard>

            <!-- Webhook Configuration -->
            <AdminCard
                title="Webhook Configuration"
                description="Optional webhook settings for delivery events"
                compact={true}
            >
                <div class="space-y-6">
                    <FormRow columns={2}>
                        <FormField id="webhookUrl" label="Webhook URL" error={$errors.webhookUrl}>
                            <Input
                                id="webhookUrl"
                                name="webhookUrl"
                                type="url"
                                bind:value={$form.webhookUrl}
                                placeholder="https://example.com/webhooks/email"
                                aria-invalid={$errors.webhookUrl ? 'true' : undefined}
                                {...$constraints.webhookUrl}
                            />
                            <p class="text-xs text-muted-foreground mt-1">
                                URL to receive email delivery events
                            </p>
                        </FormField>
                        
                        <FormField id="webhookKey" label="Webhook Authentication Key" error={$errors.webhookKey}>
                            <Input
                                id="webhookKey"
                                name="webhookKey"
                                type="password"
                                bind:value={$form.webhookKey}
                                placeholder="••••••••••••••••••••••••••••••••"
                                aria-invalid={$errors.webhookKey ? 'true' : undefined}
                                {...$constraints.webhookKey}
                            />
                        </FormField>
                    </FormRow>
                </div>
            </AdminCard>

            <!-- Provider Settings -->
            <AdminCard
                title="Provider Settings"
                description="Additional configuration options"
                compact={true}
            >
                <div class="space-y-6">
                    <FormRow columns={2}>
                        <FormField id="isDefault" label="Default Provider" error={$errors.isDefault}>
                            <div class="flex items-center space-x-2">
                                <Switch 
                                    id="isDefault" 
                                    name="isDefault"
                                    checked={$form.isDefault} 
                                    onCheckedChange={(checked) => $form.isDefault = checked}
                                />
                                <Label for="isDefault">Set as default email provider</Label>
                            </div>
                            <p class="text-xs text-muted-foreground mt-1">
                                This will be used as the default provider for sending emails
                            </p>
                        </FormField>

                        <FormField id="isActive" label="Provider Status" error={$errors.isActive}>
                            <div class="flex items-center space-x-2">
                                <Switch 
                                    id="isActive" 
                                    name="isActive"
                                    checked={$form.isActive} 
                                    onCheckedChange={(checked) => $form.isActive = checked}
                                />
                                <Label for="isActive">Enable this provider</Label>
                            </div>
                        </FormField>
                    </FormRow>
                </div>
            </AdminCard>
        </FormContainer>
    </div>
</AdminPageLayout>
