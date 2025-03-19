import { toast } from "svelte-sonner";

export async function api_post<T = any>(
    endpoint: string,
    body: object = {},
    successMessage?: string,
    errorMessage?: string // Optional custom error message
): Promise<T> {
    try {
        // Perform the POST request
        const response = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });

        // Parse the response JSON
        const data = await response.json();

        // Throw an error if the request was unsuccessful
        if (!response.ok) {
            throw new Error(data.message || errorMessage || "Request failed.");
        }

        // Show a success toast if a message is provided
        if (successMessage) {
            toast.success(successMessage);
        }

        return data;
    } catch (error: any) {
        // Use the custom error message if provided, or fallback to the default
        console.error(`API POST Request Failed: ${endpoint}`, error);
        toast.error(error.message || errorMessage || "An unexpected error occurred.");
        throw error;
    }
}
