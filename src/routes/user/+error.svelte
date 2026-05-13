<script lang="ts">
    import { page } from '$app/stores';
    import { Button } from '$lib/components/ui/button';
    import { AlertTriangle, Home, RefreshCw, ArrowLeft } from 'lucide-svelte';
    import { goto } from '$app/navigation';
    import UserPageLayout from '$lib/components/user/layout/UserPageLayout.svelte';

    // Get error details
    $: status = $page.status;
    $: message = $page.error?.message || 'Something went wrong';
    $: stack = $page.error?.stack;

    // Determine error type and styling
    $: isServerError = status >= 500;
    $: isClientError = status >= 400 && status < 500;
    $: isNotFound = status === 404;

    // Error messages based on status
    $: errorTitle = isNotFound 
        ? 'Page Not Found' 
        : isServerError 
            ? 'Server Error' 
            : isClientError 
                ? 'Client Error' 
                : 'Error';

    $: errorDescription = isNotFound
        ? 'The page you are looking for does not exist.'
        : isServerError
            ? 'Something went wrong on our end. Please try again later.'
            : isClientError
                ? 'There was an issue with your request.'
                : 'An unexpected error occurred.';

    // Get appropriate icon and colors
    $: iconColor = isServerError ? 'text-red-500' : isClientError ? 'text-orange-500' : 'text-gray-500';
    $: bgColor = isServerError ? 'bg-red-50' : isClientError ? 'bg-orange-50' : 'bg-gray-50';
    $: borderColor = isServerError ? 'border-red-200' : isClientError ? 'border-orange-200' : 'border-gray-200';

    function goHome() {
        goto('/user/dashboard');
    }

    function goBack() {
        window.history.back();
    }

    function refresh() {
        window.location.reload();
    }

    // Define breadcrumbs
    const pageCrumbs = [
        ["Dashboard", "/user/dashboard"],
        ["Error", ""]
    ] as [string, string][];

    // Action buttons
    const actionButtons = [
        {
            label: "Go Back",
            icon: ArrowLeft,
            onClick: goBack
        },
        {
            label: "Dashboard",
            icon: Home,
            onClick: goHome
        }
    ];
</script>

<svelte:head>
    <title>{status} - {errorTitle}</title>
</svelte:head>

<UserPageLayout 
    title={errorTitle}
    crumbs={pageCrumbs}
    {actionButtons}
>
    <div class="flex flex-col items-center justify-center py-12 px-4">
        <!-- Error Icon -->
        <div class="mx-auto flex items-center justify-center h-24 w-24 rounded-full {bgColor} {borderColor} border-2 mb-6">
            <AlertTriangle class="h-12 w-12 {iconColor}" />
        </div>
        
        <!-- Error Status -->
        <div class="text-center mb-8">
            <h1 class="text-4xl font-bold text-gray-900 mb-2">
                {status}
            </h1>
            <h2 class="text-2xl font-semibold text-gray-700 mb-4">
                {errorTitle}
            </h2>
            <p class="text-gray-600 text-lg max-w-md">
                {errorDescription}
            </p>
        </div>

        <!-- Error Message (if available) -->
        {#if message && message !== 'An error occurred'}
            <div class="w-full max-w-md mb-6 p-4 bg-gray-100 rounded-lg">
                <p class="text-sm text-gray-700 font-medium mb-2">Error Details:</p>
                <p class="text-sm text-gray-600 break-words">{message}</p>
            </div>
        {/if}

        <!-- Stack Trace (only in development) -->
        {#if stack && import.meta.env.DEV}
            <details class="w-full max-w-2xl mb-6 text-left">
                <summary class="cursor-pointer text-sm text-gray-500 hover:text-gray-700 mb-2">
                    Show Stack Trace
                </summary>
                <pre class="p-4 bg-gray-900 text-green-400 text-xs rounded-lg overflow-auto max-h-64">{stack}</pre>
            </details>
        {/if}

        <!-- Action Buttons -->
        <div class="flex flex-col sm:flex-row gap-4">
            <Button 
                on:click={goHome}
                class="flex items-center gap-2"
            >
                <Home class="h-4 w-4" />
                Go to Dashboard
            </Button>
            
            <Button 
                variant="outline"
                on:click={refresh}
                class="flex items-center gap-2"
            >
                <RefreshCw class="h-4 w-4" />
                Try Again
            </Button>
        </div>

        <!-- Help Text -->
        <div class="mt-8 text-sm text-gray-500 text-center">
            <p>
                If this problem persists, please 
                <a href="/user/support" class="text-blue-600 hover:text-blue-800 underline">
                    contact support
                </a>
                or try again later.
            </p>
        </div>
    </div>
</UserPageLayout>
