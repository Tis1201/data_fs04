<script lang="ts">
    import { page } from "$app/stores";
    import { goto } from "$app/navigation";
    import { Button } from "$lib/components/ui/button";
    import { Input } from "$lib/components/ui/input";
    import { Label } from "$lib/components/ui/label";
    import { Textarea } from "$lib/components/ui/textarea";
    import { ArrowLeft, RefreshCw, CheckCircle, Plus, AlertCircle } from "lucide-svelte";
    import { toast } from "svelte-sonner";
    import type { PageData } from './$types';
    import { superForm } from 'sveltekit-superforms/client';
    import { createWhatsAppAccountSchema } from '$lib/schemas/whatsapp-account';
    import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '$lib/components/ui/breadcrumb';
    import { Alert, AlertDescription } from "$lib/components/ui/alert";
    import { zodClient } from 'sveltekit-superforms/adapters';

    export let data: PageData;

    let showSuccessPage = false;
    let createdAccount: { phoneNumber: string; description: string } | null = null;
    let serverError: string | null = null;

    const { form, errors, enhance, submitting, reset } = superForm(data.form, {
        validators: zodClient(createWhatsAppAccountSchema),
        taintedMessage: null,
        resetForm: true,
        onResult: ({ result }) => {
            if (result.type === 'success') {
                serverError = null;
                // Check if account data is available in the result
                if (result.data?.account) {
                    createdAccount = {
                        phoneNumber: result.data.account.phoneNumber,
                        description: result.data.account.description
                    };
                } else {
                    // Fallback to form data if account data is not available
                    createdAccount = {
                        phoneNumber: $form.phoneNumber,
                        description: $form.description
                    };
                }
                showSuccessPage = true;
                reset();
                toast.success('WhatsApp account created successfully');
            } else if (result.type === 'error') {
                const errorMessage = result.error?.message || 'Failed to create WhatsApp account';
                serverError = errorMessage;
                toast.error(errorMessage);
            } else if (result.type === 'failure') {
                if (result.status === 500) {
                    serverError = 'An unexpected error occurred';
                    toast.error('An unexpected error occurred');
                }
            }
        },
        onError: (err) => {
            console.error('Form submission error:', err);
            serverError = 'An unexpected error occurred';
            toast.error('An unexpected error occurred');
        }
    });
    
    function createAnother() {
        showSuccessPage = false;
        createdAccount = null;
        serverError = null;
    }
</script>

<div class="space-y-6">
    <Breadcrumb>
        <BreadcrumbList>
            <BreadcrumbItem>
                <a href="/admin" class="text-sm font-medium underline-offset-4 hover:underline">Admin</a>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
                <a href="/admin/whatsapp/accounts" class="text-sm font-medium underline-offset-4 hover:underline">WhatsApp Accounts</a>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
                <BreadcrumbPage>New Account</BreadcrumbPage>
            </BreadcrumbItem>
        </BreadcrumbList>
    </Breadcrumb>

    <div class="flex justify-between items-center">
        <h2 class="text-3xl font-bold tracking-tight">New WhatsApp Account</h2>
        <Button variant="outline" on:click={() => goto('/admin/whatsapp/accounts')}>
            <ArrowLeft class="mr-2 h-4 w-4" />
            Back to Accounts
        </Button>
    </div>

    {#if showSuccessPage}
        <div class="rounded-lg border bg-card text-card-foreground shadow-sm">
            <div class="p-6 space-y-6">
                <div class="flex flex-col items-center justify-center text-center space-y-4">
                    <div class="rounded-full bg-green-50 p-3">
                        <CheckCircle class="h-8 w-8 text-green-600" />
                    </div>
                    <h3 class="text-2xl font-semibold">Account Created Successfully</h3>
                    <p class="text-muted-foreground">
                        The WhatsApp account <span class="font-medium">{createdAccount?.phoneNumber}</span> has been created successfully.
                    </p>
                </div>

                <div class="flex justify-center space-x-4">
                    <Button variant="outline" on:click={() => goto('/admin/whatsapp/accounts')}>
                        <ArrowLeft class="mr-2 h-4 w-4" />
                        Back to Accounts
                    </Button>
                    <Button on:click={createAnother}>
                        <Plus class="mr-2 h-4 w-4" />
                        Create Another Account
                    </Button>
                </div>
            </div>
        </div>
    {:else}
        <div class="rounded-lg border bg-card text-card-foreground shadow-sm">
            <form 
                method="POST" 
                use:enhance
                class="p-6 space-y-6"
            >
                {#if serverError}
                    <Alert variant="destructive">
                        <AlertCircle class="h-4 w-4" />
                        <AlertDescription>
                            {serverError}
                        </AlertDescription>
                    </Alert>
                {/if}

                <div class="space-y-1">
                    <h3 class="font-semibold text-lg">Account Details</h3>
                    <p class="text-sm text-muted-foreground">
                        Add a new WhatsApp account to the system.
                    </p>
                </div>

                <div class="grid gap-6">
                    <!-- Phone Number -->
                    <div class="grid gap-2">
                        <Label for="phoneNumber" class="required">Phone Number</Label>
                        <Input type="text" id="phoneNumber" name="phoneNumber" bind:value={$form.phoneNumber} />
                        <p class="text-sm text-muted-foreground">
                            Enter the phone number in international format (e.g., +1234567890)
                        </p>
                        {#if $errors.phoneNumber}
                            <p class="text-sm text-destructive">{$errors.phoneNumber}</p>
                        {/if}
                    </div>

                    <!-- Description -->
                    <div class="grid gap-2">
                        <Label for="description" class="required">Description</Label>
                        <Textarea id="description" name="description" bind:value={$form.description} />
                        <p class="text-sm text-muted-foreground">
                            Provide a description or purpose for this WhatsApp account
                        </p>
                        {#if $errors.description}
                            <p class="text-sm text-destructive">{$errors.description}</p>
                        {/if}
                    </div>
                </div>

                <div class="flex justify-end space-x-2">
                    <Button variant="outline" type="button" on:click={() => goto('/admin/whatsapp/accounts')}>
                        Cancel
                    </Button>
                    <Button type="submit" disabled={$submitting}>
                        {#if $submitting}
                            <RefreshCw class="mr-2 h-4 w-4 animate-spin" />
                            Creating...
                        {:else}
                            Create Account
                        {/if}
                    </Button>
                </div>
            </form>
        </div>
    {/if}
</div>

<style>
    :global(.required::after) {
        content: " *";
        color: rgb(239 68 68);
    }
</style>
