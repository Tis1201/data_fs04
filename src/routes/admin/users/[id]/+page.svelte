<script lang="ts">
    import { page } from "$app/stores";
    import { goto } from "$app/navigation";
    import { superForm } from "sveltekit-superforms/client";
    import { toast } from "svelte-sonner";
    import { Button } from "$lib/components/ui/button";
    import { Input } from "$lib/components/ui/input";
    import { Label } from "$lib/components/ui/label";
    import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "$lib/components/ui/select";
    import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '$lib/components/ui/breadcrumb';
    import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "$lib/components/ui/card";
    import { Tabs, TabsContent, TabsList, TabsTrigger } from "$lib/components/ui/tabs";
    import { Badge } from "$lib/components/ui/badge";
    import { formatDate } from "$lib/utils";
    import type { PageData } from "./$types";

    export let data: PageData;
    const { user } = data;

    const { form, errors, enhance } = superForm(data.form, {
        onResult: async ({ result }) => {
            if (result.type === 'success') {
                toast.success('User updated successfully');
                try {
                    await goto('/admin/users');
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
    <Breadcrumb>
        <BreadcrumbList>
            <BreadcrumbItem>
                <a href="/admin" class="text-sm font-medium underline-offset-4 hover:underline">Admin</a>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
                <a href="/admin/users" class="text-sm font-medium underline-offset-4 hover:underline">Users</a>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
                <BreadcrumbPage>{user.email}</BreadcrumbPage>
            </BreadcrumbItem>
        </BreadcrumbList>
    </Breadcrumb>

            <div class="grid gap-6">
                <!-- User Info Card -->
                <Card>
                    <CardHeader>
                        <CardTitle>User Information</CardTitle>
                        <CardDescription>Basic user details and status</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form method="POST" use:enhance class="space-y-4">
                            <!-- Email -->
                            <div class="space-y-2">
                                <Label for="email">Email</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    name="email"
                                    placeholder="Enter email address"
                                    bind:value={$form.email}
                                />
                                {#if $errors.email}
                                    <span class="text-sm text-destructive">{$errors.email}</span>
                                {/if}
                            </div>

                            <!-- Role -->
                            <div class="space-y-2">
                                <Label for="role">Role</Label>
                                <Select bind:value={$form.role}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select a role" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="ADMIN">Admin</SelectItem>
                                        <SelectItem value="USER">User</SelectItem>
                                    </SelectContent>
                                </Select>
                                {#if $errors.role}
                                    <span class="text-sm text-destructive">{$errors.role}</span>
                                {/if}
                            </div>

                            <!-- Submit Button -->
                            <div class="flex justify-end gap-4">
                                <Button
                                    variant="outline"
                                    type="button"
                                    on:click={() => goto('/admin/users')}
                                >
                                    Cancel
                                </Button>
                                <Button type="submit">
                                    Save Changes
                                </Button>
                            </div>
                        </form>

                        <!-- <div class="mt-6 space-y-4">
                            <div class="flex justify-between text-sm">
                                <span class="text-muted-foreground">Created</span>
                                <span>{formatDate(user.createdAt)}</span>
                            </div>
                            <div class="flex justify-between text-sm">
                                <span class="text-muted-foreground">Last Updated</span>
                                <span>{formatDate(user.updatedAt)}</span>
                            </div>
                            <div class="flex justify-between text-sm">
                                <span class="text-muted-foreground">System Role</span>
                                <Badge variant={user.systemRole === 'ADMIN' ? 'default' : 'secondary'}>
                                    {user.systemRole}
                                </Badge>
                            </div>
                        </div> -->
                    </CardContent>
                </Card>
            </div>

</div>
