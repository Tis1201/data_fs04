<script lang="ts">
    import { page } from "$app/stores";
    import { goto } from "$app/navigation";
    import { superForm } from "sveltekit-superforms/client";
    import { toast } from "svelte-sonner";
    import { Button } from "$lib/components/ui/button";
    import { Input } from "$lib/components/ui/input";
    import { Label } from "$lib/components/ui/label";
    import { Textarea } from "$lib/components/ui/textarea";
    import * as Select from "$lib/components/ui/select/index.js";
    import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "$lib/components/ui/card";
    import { Skeleton } from "$lib/components/ui/skeleton";
    import { formatDate } from "$lib/utils";
    import PageBreadcrumb from "$lib/components/ui_components_sveltekit/layout/PageBreadcrumb.svelte";
    import type { PageData } from "./$types";

    export let data: PageData;
    const { account } = data;
    const isNew = $page.params.id === 'new';
    const title = isNew ? 'Create WhatsApp Account' : 'Edit WhatsApp Account';
    
    const { form, errors, enhance, submitting } = superForm(data.form, {
        onResult: async ({ result }) => {
            if (result.type === 'success') {
                toast.success(isNew ? 'WhatsApp account created' : 'WhatsApp account updated');
                try {
                    await goto('/admin/whatsapp/accounts');
                } catch (error) {
                    console.error('Navigation error:', error);
                    toast.error('Failed to redirect. Please try again.');
                }
            }
        },
        onError: (err) => {
            toast.error(err.message);
        }
    });
</script>

<div class="space-y-4 p-2">
    <PageBreadcrumb
        crumbs={[
            "Admin", "/admin",
            "WhatsApp", "/admin/whatsapp",
            "Accounts", "/admin/whatsapp/accounts",
            isNew ? 'New Account' : account?.name || 'Edit Account'
        ]}
    />

    <div class="grid gap-6">
        <!-- WhatsApp Account Info Card -->
        <Card class="mx-auto w-full max-w-3xl">
            <CardHeader>
                <CardTitle>{title}</CardTitle>
                <CardDescription>{isNew ? 'Create a new WhatsApp account' : 'Edit details for this WhatsApp account'}</CardDescription>
            </CardHeader>
            <CardContent>
                {#if $submitting}
                    <div class="space-y-4">
                        <div class="grid grid-cols-2 gap-4">
                            <Skeleton class="h-8 w-full" />
                            <Skeleton class="h-8 w-full" />
                        </div>
                        <Skeleton class="h-20 w-full" />
                        <div class="grid grid-cols-2 gap-4">
                            <Skeleton class="h-8 w-full" />
                            <div class="flex justify-end gap-4">
                                <Skeleton class="h-10 w-24" />
                                <Skeleton class="h-10 w-32" />
                            </div>
                        </div>
                    </div>
                {:else}
                    <form method="POST" action="?/save" use:enhance>
                        <div class="space-y-4">
                            <!-- Two-column layout for shorter fields -->
                            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <!-- Phone Number -->
                                <div class="space-y-2">
                                    <Label for="phoneNumber">Phone Number</Label>
                                    <Input
                                        id="phoneNumber"
                                        name="phoneNumber"
                                        bind:value={$form.phoneNumber}
                                        placeholder="e.g. +65 9123 4567"
                                    />
                                    {#if $errors.phoneNumber}
                                        <span class="text-sm text-destructive">{$errors.phoneNumber}</span>
                                    {/if}
                                </div>

                                <!-- Name -->
                                <div class="space-y-2">
                                    <Label for="name">Name</Label>
                                    <Input
                                        id="name"
                                        name="name"
                                        bind:value={$form.name}
                                        placeholder="e.g. John's WhatsApp"
                                    />
                                    {#if $errors.name}
                                        <span class="text-sm text-destructive">{$errors.name}</span>
                                    {/if}
                                </div>
                            </div>

                            <!-- Description - Full width -->
                            <div class="space-y-2">
                                <Label for="description">Description</Label>
                                <Textarea
                                    id="description"
                                    name="description"
                                    bind:value={$form.description}
                                    placeholder="A brief description of this WhatsApp account"
                                    class="min-h-[100px]"
                                />
                                {#if $errors.description}
                                    <span class="text-sm text-destructive">{$errors.description}</span>
                                {/if}
                            </div>

                            <!-- Two-column layout for status and buttons -->
                            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 items-end">
                                <!-- Status -->
                                <div class="space-y-2">
                                    <Label for="status">Status</Label>
                                    <Select.Root portal={null}>
                                        <Select.Trigger class="w-full">
                                            <Select.Value placeholder="Select status" />
                                        </Select.Trigger>
                                        <Select.Content>
                                            <Select.Group>
                                                <Select.Label>Status</Select.Label>
                                                <Select.Item value="active">Active</Select.Item>
                                                <Select.Item value="inactive">Inactive</Select.Item>
                                                <Select.Item value="pending">Pending</Select.Item>
                                            </Select.Group>
                                        </Select.Content>
                                        <Select.Input name="status" bind:value={$form.status} />
                                    </Select.Root>
                                    {#if $errors.status}
                                        <span class="text-sm text-destructive">{$errors.status}</span>
                                    {/if}
                                </div>

                                <!-- Submit Button -->
                                <div class="flex justify-end gap-3">
                                    <Button
                                        variant="outline"
                                        type="button"
                                        on:click={() => goto('/admin/whatsapp/accounts')}
                                    >
                                        Cancel
                                    </Button>
                                    <Button type="submit">
                                        Save Changes
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </form>

                    {#if !isNew && account}
                        <div class="mt-6 pt-4 border-t">
                            <div class="grid grid-cols-2 gap-4 text-sm">
                                <div class="flex justify-between">
                                    <span class="text-muted-foreground">Created</span>
                                    <span>{formatDate(account.createdAt)}</span>
                                </div>
                                <div class="flex justify-between">
                                    <span class="text-muted-foreground">Last Updated</span>
                                    <span>{formatDate(account.updatedAt)}</span>
                                </div>
                            </div>
                        </div>
                    {/if}
                {/if}
            </CardContent>
        </Card>
    </div>
</div>
