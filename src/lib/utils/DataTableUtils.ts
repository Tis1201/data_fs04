import { goto } from "$app/navigation";

/**
 * Updates the URL parameters with new values and navigates to the updated URL.
 * 
 * @param updates - An object containing key-value pairs for URL parameters.
 * @param resetPage - If true, resets the page parameter to "1".
 */
export function updateUrlParams(
    updates: Record<string, string | number>,
    resetPage: boolean = false
): void {
    const url = new URL(window.location.href);

    // Apply the updates
    Object.entries(updates).forEach(([key, value]) => {
        url.searchParams.set(key, value.toString());
    });

    // Reset the page parameter if specified
    if (resetPage) {
        url.searchParams.set("page", "1");
    }

    // Navigate to the updated URL
    goto(url.toString(), { replaceState: true, noScroll: true, keepFocus: true, invalidateAll: true });
}

/**
 * Handles table sorting by updating the `sort` and `order` parameters in the URL.
 * 
 * @param event - The sort event containing field and order.
 */
export function handleSort(event: CustomEvent<{ field: string; order: "asc" | "desc" }>) {
    const { field, order } = event.detail;
    updateUrlParams({ sort: field, order }, true);
}
