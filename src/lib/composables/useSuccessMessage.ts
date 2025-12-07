import { writable } from 'svelte/store';
import { onMount } from 'svelte';
import { browser } from '$app/environment';
import { toast } from 'svelte-sonner';

/**
 * Composable for handling success messages from URL parameters
 * Supports URL parameters: success, name, id
 * Auto-hides after 5 seconds
 * Cleans up URL parameters after showing message
 */
export function useSuccessMessage() {
    const showSuccessMessage = writable(false);
    const successMessage = writable('');

    onMount(() => {
        if (!browser) return;

        const urlParams = new URLSearchParams(window.location.search);
        const success = urlParams.get('success');
        const name = urlParams.get('name');
        const id = urlParams.get('id');

        if (success === 'created') {
            let message = '';
            if (name && id) {
                message = `Preclaim set "${decodeURIComponent(name)}" created successfully!`;
            } else {
                message = 'Preclaim set created successfully!';
            }

            successMessage.set(message);
            showSuccessMessage.set(true);
            toast.success(message);

            // Clean up URL parameters
            const newUrl = new URL(window.location.href);
            newUrl.searchParams.delete('success');
            newUrl.searchParams.delete('name');
            newUrl.searchParams.delete('id');
            window.history.replaceState({}, '', newUrl.toString());

            // Auto-hide after 5 seconds
            setTimeout(() => {
                showSuccessMessage.set(false);
            }, 5000);
        }
    });

    return {
        showSuccessMessage,
        successMessage
    };
}

