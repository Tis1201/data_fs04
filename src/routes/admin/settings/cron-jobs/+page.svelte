<script lang="ts">
    import { enhance } from "$app/forms";
    import { invalidateAll } from "$app/navigation";
    import { toast } from "svelte-sonner";
    import type { PageData, ActionData } from "./$types";
    import PageContainer from "$lib/components/ui_components_sveltekit/layout/PageContainer.svelte";
    import PageHeader from "$lib/components/ui_components_sveltekit/layout/PageHeader.svelte";
    import ActionButton from "$lib/components/ui_components_sveltekit/buttons/ActionButton.svelte";
    import { Button } from "$lib/components/ui/button";
    import { Badge } from "$lib/components/ui/badge";
    import * as Table from "$lib/components/ui/table";
    import * as Dialog from "$lib/components/ui/dialog";
    import * as DropdownMenu from "$lib/components/ui/dropdown-menu";
    import { Input } from "$lib/components/ui/input";
    import { Label } from "$lib/components/ui/label";
    import {
        Plus,
        Play,
        Pause,
        Trash2,
        MoreHorizontal,
        RefreshCw,
        Clock,
        CheckCircle,
        XCircle,
        AlertCircle,
        Calendar,
        Loader2,
    } from "lucide-svelte";

    export let data: PageData;
    export let form: ActionData;

    $: cronJobs = data.cronJobs ?? [];

    const pageCrumbs = [["Admin", "/admin"], "Settings", "Cron Jobs"];

    // Modal states
    let showCreateModal = false;
    let showEditModal = false;
    let showDeleteConfirm = false;
    let selectedJob: (typeof cronJobs)[0] | null = null;
    let isSubmitting = false;

    // Form data
    let formData = {
        name: "",
        functionName: "",
        cronExpression: "",
        timezone: "UTC",
        status: "ACTIVE",
        maxRetries: 3,
        timeout: null as number | null,
        args: "",
    };

    function resetForm() {
        formData = {
            name: "",
            functionName: "",
            cronExpression: "",
            timezone: "UTC",
            status: "ACTIVE",
            maxRetries: 3,
            timeout: null,
            args: "",
        };
    }

    function openEdit(job: (typeof cronJobs)[0]) {
        selectedJob = job;
        formData = {
            name: job.name,
            functionName: job.functionName,
            cronExpression: job.cronExpression ?? "",
            timezone: job.timezone ?? "UTC",
            status: job.status,
            maxRetries: job.maxRetries,
            timeout: job.timeout,
            args: job.args ? JSON.stringify(job.args, null, 2) : "",
        };
        showEditModal = true;
    }

    function openDelete(job: (typeof cronJobs)[0]) {
        selectedJob = job;
        showDeleteConfirm = true;
    }

    function formatDate(date: Date | string | null): string {
        if (!date) return "—";
        return new Date(date).toLocaleString();
    }

    function getStatusBadge(status: string, isRunning: boolean) {
        if (isRunning)
            return {
                variant: "default" as const,
                label: "Running",
                icon: Loader2,
            };
        switch (status) {
            case "ACTIVE":
                return {
                    variant: "default" as const,
                    label: "Active",
                    icon: CheckCircle,
                };
            case "PAUSED":
                return {
                    variant: "secondary" as const,
                    label: "Paused",
                    icon: Pause,
                };
            case "INACTIVE":
                return {
                    variant: "outline" as const,
                    label: "Inactive",
                    icon: XCircle,
                };
            default:
                return {
                    variant: "outline" as const,
                    label: status,
                    icon: AlertCircle,
                };
        }
    }

    function getResultBadge(result: string | null) {
        if (!result) return null;
        if (result === "success")
            return { variant: "default" as const, label: "Success" };
        return { variant: "destructive" as const, label: "Failed" };
    }

    // Toast on form results
    $: if (form?.success) {
        toast.success("Operation completed successfully");
        showCreateModal = false;
        showEditModal = false;
        showDeleteConfirm = false;
        isSubmitting = false;
        invalidateAll();
    } else if (form?.error) {
        toast.error(form.error);
        isSubmitting = false;
    }
</script>

<PageContainer crumbs={pageCrumbs}>
    <PageHeader title="Cron Jobs">
        <svelte:fragment slot="description">
            Manage scheduled background tasks. Jobs sync to BullMQ on save.
        </svelte:fragment>
        <svelte:fragment slot="action">
            <ActionButton
                label="Add Cron Job"
                icon={Plus}
                onClick={() => {
                    resetForm();
                    showCreateModal = true;
                }}
            />
        </svelte:fragment>
    </PageHeader>

    <div class="rounded-md border">
        <Table.Root>
            <Table.Header>
                <Table.Row>
                    <Table.Head class="w-[20%]">Name</Table.Head>
                    <Table.Head class="w-[15%]">Function</Table.Head>
                    <Table.Head class="w-[10%]">Schedule</Table.Head>
                    <Table.Head class="w-[10%]">Status</Table.Head>
                    <Table.Head class="w-[15%]">Last Run</Table.Head>
                    <Table.Head class="w-[10%]">Result</Table.Head>
                    <Table.Head class="w-[10%]">Stats</Table.Head>
                    <Table.Head class="w-[10%]">Actions</Table.Head>
                </Table.Row>
            </Table.Header>
            <Table.Body>
                {#if cronJobs.length === 0}
                    <Table.Row>
                        <Table.Cell
                            colspan={8}
                            class="text-center py-8 text-muted-foreground"
                        >
                            <Clock class="w-8 h-8 mx-auto mb-2 opacity-50" />
                            No cron jobs configured. Click "Add Cron Job" to create
                            one.
                        </Table.Cell>
                    </Table.Row>
                {:else}
                    {#each cronJobs as job (job.id)}
                        {@const statusBadge = getStatusBadge(
                            job.status,
                            job.isRunning,
                        )}
                        {@const resultBadge = getResultBadge(job.lastResult)}
                        <Table.Row>
                            <Table.Cell class="font-medium"
                                >{job.name}</Table.Cell
                            >
                            <Table.Cell>
                                <code
                                    class="text-xs bg-muted px-1 py-0.5 rounded"
                                    >{job.functionName}</code
                                >
                            </Table.Cell>
                            <Table.Cell>
                                {#if !job.isRecurring}
                                    <div class="flex flex-col gap-0.5">
                                        <Badge variant="outline" class="text-xs w-fit">
                                            One-time
                                        </Badge>
                                        {#if job.nextRunAt}
                                            <span class="text-xs text-muted-foreground" title="Scheduled run time">
                                                {formatDate(job.nextRunAt)}
                                            </span>
                                        {:else}
                                            <span class="text-xs text-muted-foreground">—</span>
                                        {/if}
                                    </div>
                                {:else if job.cronExpression}
                                    <code class="text-xs">{job.cronExpression}</code>
                                {:else}
                                    <span class="text-muted-foreground text-xs">—</span>
                                {/if}
                            </Table.Cell>
                            <Table.Cell>
                                <Badge
                                    variant={statusBadge.variant}
                                    class="gap-1"
                                >
                                    {#if job.isRunning}
                                        <Loader2 class="w-3 h-3 animate-spin" />
                                    {/if}
                                    {statusBadge.label}
                                </Badge>
                            </Table.Cell>
                            <Table.Cell class="text-sm text-muted-foreground">
                                {formatDate(job.lastRunAt)}
                            </Table.Cell>
                            <Table.Cell>
                                {#if resultBadge}
                                    <Badge variant={resultBadge.variant}
                                        >{resultBadge.label}</Badge
                                    >
                                {:else}
                                    <span class="text-muted-foreground">—</span>
                                {/if}
                            </Table.Cell>
                            <Table.Cell class="text-sm">
                                <span class="text-green-600"
                                    >{job.successCount}</span
                                >
                                <span class="text-muted-foreground">/</span>
                                <span class="text-red-600"
                                    >{job.failureCount}</span
                                >
                            </Table.Cell>
                            <Table.Cell>
                                {#if !job.isRecurring}
                                    <!-- One-time jobs: Run Now only -->
                                    <form
                                        method="POST"
                                        action="?/trigger"
                                        use:enhance={() => {
                                            isSubmitting = true;
                                            return async ({ update }) => {
                                                await update();
                                                isSubmitting = false;
                                            };
                                        }}
                                    >
                                        <input type="hidden" name="id" value={job.id} />
                                        <Button
                                            type="submit"
                                            variant="outline"
                                            size="sm"
                                            class="gap-1.5"
                                            disabled={isSubmitting || job.isRunning}
                                        >
                                            {#if job.isRunning}
                                                <Loader2 class="w-3.5 h-3.5 animate-spin" />
                                            {/if}
                                            <Play class="w-3.5 h-3.5" /> Run Now
                                        </Button>
                                    </form>
                                {:else}
                                    <!-- Recurring jobs: Show all actions -->
                                    <DropdownMenu.Root>
                                        <DropdownMenu.Trigger asChild let:builder>
                                            <Button
                                                builders={[builder]}
                                                variant="ghost"
                                                size="icon"
                                            >
                                                <MoreHorizontal class="w-4 h-4" />
                                            </Button>
                                        </DropdownMenu.Trigger>
                                        <DropdownMenu.Content align="end">
                                            <form
                                                method="POST"
                                                action="?/trigger"
                                                use:enhance
                                            >
                                                <input
                                                    type="hidden"
                                                    name="id"
                                                    value={job.id}
                                                />
                                                <DropdownMenu.Item asChild>
                                                    <button
                                                        type="submit"
                                                        class="w-full flex items-center gap-2 cursor-pointer"
                                                    >
                                                        <Play class="w-4 h-4" /> Run Now
                                                    </button>
                                                </DropdownMenu.Item>
                                            </form>
                                            <DropdownMenu.Item
                                                on:click={() => openEdit(job)}
                                            >
                                                <RefreshCw class="w-4 h-4 mr-2" /> Edit
                                            </DropdownMenu.Item>
                                            <DropdownMenu.Separator />
                                            {#if job.status === "ACTIVE"}
                                                <form
                                                    method="POST"
                                                    action="?/toggleStatus"
                                                    use:enhance
                                                >
                                                    <input
                                                        type="hidden"
                                                        name="id"
                                                        value={job.id}
                                                    />
                                                    <input
                                                        type="hidden"
                                                        name="status"
                                                        value="PAUSED"
                                                    />
                                                    <DropdownMenu.Item asChild>
                                                        <button
                                                            type="submit"
                                                            class="w-full flex items-center gap-2 cursor-pointer"
                                                        >
                                                            <Pause
                                                                class="w-4 h-4"
                                                            /> Pause
                                                        </button>
                                                    </DropdownMenu.Item>
                                                </form>
                                            {:else}
                                                <form
                                                    method="POST"
                                                    action="?/toggleStatus"
                                                    use:enhance
                                                >
                                                    <input
                                                        type="hidden"
                                                        name="id"
                                                        value={job.id}
                                                    />
                                                    <input
                                                        type="hidden"
                                                        name="status"
                                                        value="ACTIVE"
                                                    />
                                                    <DropdownMenu.Item asChild>
                                                        <button
                                                            type="submit"
                                                            class="w-full flex items-center gap-2 cursor-pointer"
                                                        >
                                                            <Play class="w-4 h-4" /> Activate
                                                        </button>
                                                    </DropdownMenu.Item>
                                                </form>
                                            {/if}
                                            <DropdownMenu.Separator />
                                            <DropdownMenu.Item
                                                class="text-destructive focus:text-destructive"
                                                on:click={() => openDelete(job)}
                                            >
                                                <Trash2 class="w-4 h-4 mr-2" /> Delete
                                            </DropdownMenu.Item>
                                        </DropdownMenu.Content>
                                    </DropdownMenu.Root>
                                {/if}
                            </Table.Cell>
                        </Table.Row>
                    {/each}
                {/if}
            </Table.Body>
        </Table.Root>
    </div>
</PageContainer>

<!-- Create Modal -->
<Dialog.Root bind:open={showCreateModal}>
    <Dialog.Content class="max-w-lg">
        <Dialog.Header>
            <Dialog.Title>Create Cron Job</Dialog.Title>
            <Dialog.Description
                >Add a new scheduled background task.</Dialog.Description
            >
        </Dialog.Header>
        <form
            method="POST"
            action="?/create"
            use:enhance={() => {
                isSubmitting = true;
                return async ({ update }) => {
                    await update();
                    isSubmitting = false;
                };
            }}
        >
            <div class="grid gap-4 py-4">
                <div class="grid gap-2">
                    <Label for="name">Name</Label>
                    <Input
                        id="name"
                        name="name"
                        bind:value={formData.name}
                        placeholder="Daily Cleanup"
                        required
                    />
                </div>
                <div class="grid gap-2">
                    <Label for="functionName">Function Name</Label>
                    <Input
                        id="functionName"
                        name="functionName"
                        bind:value={formData.functionName}
                        placeholder="system:cleanup-tokens"
                        required
                    />
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div class="grid gap-2">
                        <Label for="cronExpression">Cron Expression</Label>
                        <Input
                            id="cronExpression"
                            name="cronExpression"
                            bind:value={formData.cronExpression}
                            placeholder="0 0 * * *"
                            required
                        />
                    </div>
                    <div class="grid gap-2">
                        <Label for="timezone">Timezone</Label>
                        <Input
                            id="timezone"
                            name="timezone"
                            bind:value={formData.timezone}
                            placeholder="UTC"
                        />
                    </div>
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div class="grid gap-2">
                        <Label for="maxRetries">Max Retries</Label>
                        <Input
                            id="maxRetries"
                            name="maxRetries"
                            type="number"
                            bind:value={formData.maxRetries}
                            min="0"
                            max="10"
                        />
                    </div>
                    <div class="grid gap-2">
                        <Label for="timeout">Timeout (ms)</Label>
                        <Input
                            id="timeout"
                            name="timeout"
                            type="number"
                            bind:value={formData.timeout}
                            placeholder="Optional"
                        />
                    </div>
                </div>
                <div class="grid gap-2">
                    <Label for="args">Arguments (JSON)</Label>
                    <Input
                        id="args"
                        name="args"
                        bind:value={formData.args}
                        placeholder={`{"key": "value"}`}
                    />
                </div>
            </div>
            <Dialog.Footer>
                <Button
                    type="button"
                    variant="outline"
                    on:click={() => (showCreateModal = false)}>Cancel</Button
                >
                <Button type="submit" disabled={isSubmitting}>
                    {#if isSubmitting}
                        <Loader2 class="w-4 h-4 mr-2 animate-spin" />
                    {/if}
                    Create
                </Button>
            </Dialog.Footer>
        </form>
    </Dialog.Content>
</Dialog.Root>

<!-- Edit Modal -->
<Dialog.Root bind:open={showEditModal}>
    <Dialog.Content class="max-w-lg">
        <Dialog.Header>
            <Dialog.Title>Edit Cron Job</Dialog.Title>
            <Dialog.Description
                >Update the scheduled task configuration.</Dialog.Description
            >
        </Dialog.Header>
        <form
            method="POST"
            action="?/update"
            use:enhance={() => {
                isSubmitting = true;
                return async ({ update }) => {
                    await update();
                    isSubmitting = false;
                };
            }}
        >
            <input type="hidden" name="id" value={selectedJob?.id} />
            <div class="grid gap-4 py-4">
                <div class="grid gap-2">
                    <Label for="edit-name">Name</Label>
                    <Input
                        id="edit-name"
                        name="name"
                        bind:value={formData.name}
                        required
                    />
                </div>
                <div class="grid gap-2">
                    <Label for="edit-functionName">Function Name</Label>
                    <Input
                        id="edit-functionName"
                        name="functionName"
                        bind:value={formData.functionName}
                        required
                    />
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div class="grid gap-2">
                        <Label for="edit-cronExpression">Cron Expression</Label>
                        <Input
                            id="edit-cronExpression"
                            name="cronExpression"
                            bind:value={formData.cronExpression}
                            required
                        />
                    </div>
                    <div class="grid gap-2">
                        <Label for="edit-timezone">Timezone</Label>
                        <Input
                            id="edit-timezone"
                            name="timezone"
                            bind:value={formData.timezone}
                        />
                    </div>
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div class="grid gap-2">
                        <Label for="edit-maxRetries">Max Retries</Label>
                        <Input
                            id="edit-maxRetries"
                            name="maxRetries"
                            type="number"
                            bind:value={formData.maxRetries}
                            min="0"
                            max="10"
                        />
                    </div>
                    <div class="grid gap-2">
                        <Label for="edit-timeout">Timeout (ms)</Label>
                        <Input
                            id="edit-timeout"
                            name="timeout"
                            type="number"
                            bind:value={formData.timeout}
                        />
                    </div>
                </div>
                <div class="grid gap-2">
                    <Label for="edit-args">Arguments (JSON)</Label>
                    <Input
                        id="edit-args"
                        name="args"
                        bind:value={formData.args}
                    />
                </div>
            </div>
            <Dialog.Footer>
                <Button
                    type="button"
                    variant="outline"
                    on:click={() => (showEditModal = false)}>Cancel</Button
                >
                <Button type="submit" disabled={isSubmitting}>
                    {#if isSubmitting}
                        <Loader2 class="w-4 h-4 mr-2 animate-spin" />
                    {/if}
                    Save Changes
                </Button>
            </Dialog.Footer>
        </form>
    </Dialog.Content>
</Dialog.Root>

<!-- Delete Confirmation -->
<Dialog.Root bind:open={showDeleteConfirm}>
    <Dialog.Content class="max-w-md">
        <Dialog.Header>
            <Dialog.Title>Delete Cron Job</Dialog.Title>
            <Dialog.Description>
                Are you sure you want to delete <strong
                    >{selectedJob?.name}</strong
                >? This action cannot be undone.
            </Dialog.Description>
        </Dialog.Header>
        <form
            method="POST"
            action="?/delete"
            use:enhance={() => {
                isSubmitting = true;
                return async ({ update }) => {
                    await update();
                    isSubmitting = false;
                };
            }}
        >
            <input type="hidden" name="id" value={selectedJob?.id} />
            <Dialog.Footer>
                <Button
                    type="button"
                    variant="outline"
                    on:click={() => (showDeleteConfirm = false)}>Cancel</Button
                >
                <Button
                    type="submit"
                    variant="destructive"
                    disabled={isSubmitting}
                >
                    {#if isSubmitting}
                        <Loader2 class="w-4 h-4 mr-2 animate-spin" />
                    {/if}
                    Delete
                </Button>
            </Dialog.Footer>
        </form>
    </Dialog.Content>
</Dialog.Root>
