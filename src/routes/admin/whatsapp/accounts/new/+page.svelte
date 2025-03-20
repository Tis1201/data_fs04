<script lang="ts">
    import { page } from "$app/stores";
    import { goto } from "$app/navigation";
    import { Button } from "$lib/components/ui/button";
    import { Input } from "$lib/components/ui/input";
    import { Label } from "$lib/components/ui/label";
    import { Textarea } from "$lib/components/ui/textarea";
    import { ArrowLeft, RefreshCw, CheckCircle, Plus, AlertCircle, QrCode } from "lucide-svelte";
    import { toast } from "svelte-sonner";
    import type { PageData } from './$types';
    import { superForm } from 'sveltekit-superforms/client';
    import { createWhatsAppAccountSchema } from '$lib/schemas/whatsapp-account';
    import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '$lib/components/ui/breadcrumb';
    import { Alert, AlertDescription } from "$lib/components/ui/alert";
    import { zodClient } from 'sveltekit-superforms/adapters';
    import QRCodeScanner from "$lib/components/whatsapp/QRCodeScanner.svelte";
    import { whatsAppStore } from "$lib/stores/whatsapp-store";
    import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "$lib/components/ui/card";

    export let data: PageData;

    let showSuccessPage = false;
    let createdAccount: { id?: string; phoneNumber: string; description: string } | null = null;
    let serverError: string | null = null;
    
    // Track the current step in the account creation process
    let currentStep = 1; // 1: Connect WhatsApp, 2: Account Details, 3: Success
    
    // WhatsApp account info received from authentication
    let whatsAppInfo: { phoneNumber: string; name: string } | null = null;
    
    // Generate a temporary ID for the QR code scanner
    const tempAccountId = `temp-${Date.now()}`;

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
                        id: result.data.account.id,
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
                currentStep = 3; // Advance to success page (step 3)
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
        currentStep = 1;
        createdAccount = null;
        serverError = null;
        whatsAppInfo = null;
        whatsAppStore.reset();
    }
    
    function handleAuthenticated(event: CustomEvent) {
        // Use the real phone information from Baileys
        const phoneNumber = event.detail?.phoneNumber || $whatsAppStore.phoneNumber || '';
        const pushName = event.detail?.pushName || $whatsAppStore.pushName || 'Unknown';
        
        whatsAppInfo = {
            phoneNumber: phoneNumber,
            name: pushName
        };
        
        // Pre-fill the form with the data from WhatsApp
        $form.phoneNumber = whatsAppInfo.phoneNumber;
        $form.description = `WhatsApp account for ${whatsAppInfo.name}`;
        
        console.log(`WhatsApp authenticated: ${phoneNumber} (${pushName})`);
        toast.success('WhatsApp account authenticated successfully');
        
        // Automatically advance to step 2 after successful authentication
        currentStep = 2;
    }
    
    function handleError(event: CustomEvent) {
        toast.error(`WhatsApp authentication error: ${event.detail.message}`);
    }
    
    function goBack() {
        if (currentStep > 1) {
            currentStep--;
        } else {
            goto('/admin/whatsapp/accounts');
        }
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
        <Button variant="outline" on:click={goBack}>
            <ArrowLeft class="mr-2 h-4 w-4" />
            {currentStep > 1 ? 'Back' : 'Back to Accounts'}
        </Button>
    </div>
    
    <div class="flex w-full gap-2 pb-4 mb-4 border-b">
        {#each [{value: 1, label: 'Connect WhatsApp'}, {value: 2, label: 'Account Details'}, {value: 3, label: 'Success'}] as step}
            <div class={`flex items-center gap-2 flex-1 pb-2 ${currentStep === step.value ? 'text-primary font-medium' : currentStep > step.value ? 'text-primary/70' : 'text-muted-foreground'}`}>
                <div class={`flex items-center justify-center rounded-full border h-5 w-5 text-xs ${currentStep === step.value ? 'border-primary bg-primary text-primary-foreground' : currentStep > step.value ? 'border-primary/50 bg-primary/50 text-primary-foreground' : 'border-muted bg-background'}`}>
                    {#if currentStep > step.value}
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                    {:else}
                        {step.value}
                    {/if}
                </div>
                <span class="text-xs">{step.label}</span>
            </div>
        {/each}
    </div>

    {#if currentStep === 3}
        <!-- Step 3: Success Page -->
        <Card>
            <CardContent class="pt-6 space-y-6">
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
            </CardContent>
        </Card>
    {:else if currentStep === 1}
        <!-- Step 1: Connect WhatsApp -->
        <Card>
            <CardHeader>
                <CardTitle>Connect WhatsApp</CardTitle>
                <CardDescription>
                    Scan the QR code with your WhatsApp app to connect your account
                </CardDescription>
            </CardHeader>
            <CardContent>
                <QRCodeScanner 
                    phoneNumber="" 
                    accountId={tempAccountId}
                    on:authenticated={handleAuthenticated}
                    on:error={handleError}
                />
                
                <div class="flex justify-end mt-6">
                    <Button 
                        type="button" 
                        on:click={() => {
                            if ($whatsAppStore.connectionStatus === 'authenticated') {
                                currentStep = 2;
                            }
                        }}
                        disabled={$whatsAppStore.connectionStatus !== 'authenticated'}
                    >
                        {$whatsAppStore.connectionStatus === 'authenticated' ? 'Next' : 'Waiting for Authentication...'}
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="ml-2 h-4 w-4"><path d="m9 18 6-6-6-6"/></svg>
                    </Button>
                </div>
            </CardContent>
            <CardFooter class="border-t pt-6">
                <p class="text-sm text-muted-foreground">
                    After scanning the QR code, your WhatsApp account information will be automatically retrieved.
                </p>
            </CardFooter>
        </Card>
    {:else if currentStep === 2}
        <!-- Step 2: Account Details -->
        <Card>
            <form 
                method="POST" 
                use:enhance
                class="space-y-6"
            >
                <CardHeader>
                    <CardTitle>Account Details</CardTitle>
                    <CardDescription>
                        Confirm or modify the account details from WhatsApp
                    </CardDescription>
                </CardHeader>
                
                <CardContent class="space-y-6">
                    {#if serverError}
                        <Alert variant="destructive">
                            <AlertCircle class="h-4 w-4" />
                            <AlertDescription>
                                {serverError}
                            </AlertDescription>
                        </Alert>
                    {/if}
                    
                    {#if whatsAppInfo}
                        <Alert>
                            <CheckCircle class="h-4 w-4" />
                            <AlertDescription>
                                WhatsApp account connected successfully. Please confirm the details below.
                            </AlertDescription>
                        </Alert>
                    {/if}

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

                </CardContent>
                
                <CardFooter class="border-t pt-6 flex justify-end space-x-2">
                    <Button variant="outline" type="button" on:click={goBack}>
                        Back
                    </Button>
                    <Button type="submit" disabled={$submitting}>
                        {#if $submitting}
                            <RefreshCw class="mr-2 h-4 w-4 animate-spin" />
                            Creating...
                        {:else}
                            Create Account
                        {/if}
                    </Button>
                </CardFooter>
            </form>
        </Card>
    {:else if currentStep === 3}
        <!-- Step 3: Success Page -->
        <Card>
            <CardHeader>
                <CardTitle>Account Created Successfully</CardTitle>
                <CardDescription>
                    Your WhatsApp account has been successfully connected and created
                </CardDescription>
            </CardHeader>
            <CardContent class="space-y-6">
                <Alert>
                    <CheckCircle class="h-4 w-4" />
                    <AlertDescription>
                        WhatsApp account has been successfully created and is ready to use.
                    </AlertDescription>
                </Alert>
                
                {#if createdAccount}
                    <div class="grid gap-4">
                        <div>
                            <p class="font-semibold">Phone Number:</p>
                            <p>{createdAccount.phoneNumber}</p>
                        </div>
                        <div>
                            <p class="font-semibold">Description:</p>
                            <p>{createdAccount.description}</p>
                        </div>
                    </div>
                {/if}
            </CardContent>
            <CardFooter class="flex justify-between border-t pt-6">
                <Button variant="outline" on:click={() => goto('/admin/whatsapp/accounts')}>
                    <ArrowLeft class="mr-2 h-4 w-4" />
                    Back to Accounts
                </Button>
                <Button on:click={createAnother}>
                    <Plus class="mr-2 h-4 w-4" />
                    Create Another Account
                </Button>
            </CardFooter>
        </Card>
    {/if}
</div>

<style>
    :global(.required::after) {
        content: " *";
        color: rgb(239 68 68);
    }
</style>
