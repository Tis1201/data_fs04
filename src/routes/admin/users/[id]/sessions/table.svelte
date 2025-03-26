<script lang="ts">
    import DataTable from "$lib/components/ui_components_sveltekit/table/DataTable.svelte";
    import RelativeDate from "$lib/components/ui_components_sveltekit/date/RelativeDate.svelte";
    import NameWithIdLink from "$lib/components/ui_components_sveltekit/table/column/NameWithIdLink.svelte";
    import RecordActions, {
        type ActionItem,
    } from "$lib/components/ui_components_sveltekit/table/column/RecordActions.svelte";
    import RecordDeleteDialog from "$lib/components/ui_components_sveltekit/dialog/RecordDeleteDialog.svelte";
    import { Skeleton } from "$lib/components/ui/skeleton";
    import SessionRecord from "./record.svelte";
    import { Info, Key, Lock, Shield, Trash } from "lucide-svelte";
    import { goto } from "$app/navigation";
    import { toast } from "svelte-sonner";
    import { api_post } from "$lib/utils/ApiUtils";
    import type { Session, User } from "@prisma/client";

    // Define a type for Session with included User data
    type SessionWithUser = Session & {
        user: {
            id: string;
            email: string;
            name: string | null;
            status: string;
            systemRole: string;
        };
    };
    import { page } from "$app/stores";
    import {
        handleTableSort,
        handleTablePagination,
    } from "$lib/components/ui_components_sveltekit/table/pagination/pagination-utils";
    import { writable } from "svelte/store";

    export let props = {
        records: [] as SessionWithUser[],
        pagination: {
            page: 1,
            per_page: 10,
            total_records: 0,
            total_pages: 0,
        },
        sort: {
            field: "createdAt",
            order: "desc" as "asc" | "desc",
        },
        loading: false,
    };

    // State for session revocation dialog
    let state = {
        selectedRecord: null as SessionWithUser | null,
        confirmationOpen: false,
        title: "Revoke Session",
        message:
            "Are you sure you want to revoke this session? This will log the user out immediately.",
        confirmButtonText: "Revoke",
        cancelButtonText: "Cancel",
        successMessage: "Session revoked successfully",
        errorMessage: "Failed to revoke session",
        isDeleting: false,
    };

    // State for tracking revocation process
    const isRevoking = writable(false);

    // State for session details sheet
    const selectedSession = writable<SessionWithUser | null>(null);
    const isDetailsSheetOpen = writable(false);

    // Function to open session details sheet
    function openSessionDetails(session: SessionWithUser) {
        $selectedSession = session;
        $isDetailsSheetOpen = true;
    }

    // Function to close session details sheet
    function closeSessionDetails() {
        $isDetailsSheetOpen = false;
        setTimeout(() => {
            $selectedSession = null;
        }, 300); // Wait for animation to complete
    }

    // We don't need a separate revokeSession function anymore since we're using form actions
    // The RecordDeleteDialog will handle the form submission

    // Function to open revocation confirmation dialog
    function confirmRevoke(session: SessionWithUser) {
        state.selectedRecord = session;
        state.confirmationOpen = true;
    }

    $: ({ records, pagination, sort, loading } = props);

    const columns = [
        {
            id: "id",
            label: "ID",
            sortable: true,
            width: "15%",
            render: (record: SessionWithUser) => ({
                component: NameWithIdLink,
                props: {
                    record: {
                        id: record.user?.id || record.userId,
                        email: record.user?.email || "N/A", // Use user's email as the display name
                    },
                    baseUrl: `/admin/users`,
                    idField: "id",
                    nameField: "email",
                },
            }),
        },
        {
            id: "user",
            label: "User Info",
            sortable: false,
            width: "15%",
            render: (record: SessionWithUser) => {
                const userName = record.user?.name || "N/A";
                const userRole = record.user?.systemRole || "N/A";
                const userStatus = record.user?.status || "N/A";
                return `${userName !== "N/A" ? `${userName}, ` : ""}${userRole} (${userStatus})`;
            },
        },
        {
            id: "createdAt",
            label: "Created At",
            sortable: true,
            width: "15%",
            render: (record: SessionWithUser) => {
                if (!record.createdAt) return "N/A";
                return {
                    component: RelativeDate,
                    props: {
                        date: record.createdAt,
                        format: "relative",
                        showTooltip: true,
                        useHoverCard: true,
                        iconSize: 12,
                    },
                };
            },
        },
        {
            id: "expiresAt",
            label: "Expires",
            sortable: true,
            width: "15%",
            render: (record: SessionWithUser) => {
                if (!record.expiresAt) return "N/A";
                return {
                    component: RelativeDate,
                    props: {
                        date: record.expiresAt,
                        format: "relative",
                        showTooltip: true,
                        useHoverCard: true,
                        iconSize: 12,
                    },
                };
            },
        },
        // {
        //     id: "userAgent",
        //     label: "User Agent",
        //     width: "15%",
        //     render: (record: SessionWithUser) => record.userAgent || "N/A"
        // },
        // {
        //     id: "ipAddress",
        //     label: "IP Address",
        //     width: "15%",
        //     render: (record: SessionWithUser) => record.ipAddress || "N/A"
        // },
        {
            id: "actions",
            label: "Actions",
            width: "10%",
            render: (record: SessionWithUser) => {
                // Define action items for sessions
                const actionItems: ActionItem[] = [
                    {
                        label: "View Details",
                        icon: Info,
                        onClick: () => openSessionDetails(record),
                    },
                    {
                        label:
                            $isRevoking &&
                            state.selectedRecord?.id === record.id
                                ? "Revoking..."
                                : "Revoke Session",
                        icon:
                            $isRevoking &&
                            state.selectedRecord?.id === record.id
                                ? null
                                : Lock,
                        onClick: () => confirmRevoke(record),
                        disabled: $isRevoking,
                    },
                ];

                return {
                    component: RecordActions,
                    props: {
                        items: actionItems,
                    },
                };
            },
        },
    ];
</script>

<div class="space-y-4">
    <!-- Revocation Confirmation Dialog -->
    <RecordDeleteDialog
        {state}
        title="Revoke Session"
        getDescription={(record) =>
            `Are you sure you want to revoke this session for ${record.user?.email || "this user"}? This will log the user out immediately.`}
        confirmText="Revoke"
        cancelText="Cancel"
        successMessage="Session revoked successfully"
        errorMessage="Failed to revoke session"
        actionName="revokeSession"
        useFormSubmission={true}
        onConfirm={() => {
            // Refresh will be handled by the form submission
            // No need to call a separate function
        }}
    />

    <!-- Use the extracted SessionRecord component -->
    <SessionRecord isOpen={isDetailsSheetOpen} session={selectedSession} />

    {#if loading}
        <div class="space-y-4">
            <Skeleton class="h-8 w-full" />
            <Skeleton class="h-8 w-full" />
            <Skeleton class="h-8 w-3/4" />
            <Skeleton class="h-8 w-full" />
            <Skeleton class="h-8 w-full" />
        </div>
    {:else}
        <DataTable
            {columns}
            props={{
                records,
                pagination,
                sort,
                loading: false,
            }}
            on:sort={handleTableSort}
            on:pagination={(e) => handleTablePagination(e, "preferredPageSize")}
        />
    {/if}
</div>
