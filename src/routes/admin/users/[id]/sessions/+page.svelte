<script lang="ts">
    import { page } from '$app/stores';
    import { onMount } from 'svelte';
    import { browser } from '$app/environment';
    import { getEnhancedPrisma } from '$lib/server/prisma';
    import { restrict } from '$lib/server/security/guards';
    import { error } from '@sveltejs/kit';
    import { goto } from '$app/navigation';

    export let data;
    
    let sessions = [];
    let loading = true;

    onMount(async () => {
        try {
            const prisma = getEnhancedPrisma(data.user);
            const userId = $page.params.id;
            
            sessions = await prisma.session.findMany({
                where: { userId },
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    userId: true,
                    expires: true,
                    createdAt: true,
                    updatedAt: true,
                    userAgent: true,
                    ipAddress: true
                }
            });
        } catch (err) {
            console.error('Error fetching sessions:', err);
            goto(`/admin/users/${$page.params.id}`);
        } finally {
            loading = false;
        }
    });
</script>

<div class="p-4">
    <div class="flex justify-between items-center mb-4">
        <h1 class="text-2xl font-semibold">User Sessions</h1>
        <button
            class="text-sm text-gray-500 hover:text-gray-700"
            on:click={() => goto(`/admin/users/${$page.params.id}`)}
        >
            Back to User
        </button>
    </div>

    {#if loading}
        <div class="flex justify-center items-center h-32">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </div>
    {/if}

    {#if sessions.length === 0 && !loading}
        <div class="text-center py-8">
            <p class="text-gray-500">No active sessions found.</p>
        </div>
    {/if}

    {#if sessions.length > 0 && !loading}
        <div class="space-y-4">
            <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created At</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expires</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User Agent</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">IP Address</th>
                        </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-gray-200">
                        {#each sessions as session}
                            <tr>
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{session.id}</td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                    {new Date(session.createdAt).toLocaleString()}
                                </td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                    {new Date(session.expires).toLocaleString()}
                                </td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {session.userAgent}
                                </td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {session.ipAddress}
                                </td>
                            </tr>
                        {/each}
                    </tbody>
                </table>
            </div>
        </div>
    {/if}
</div>
