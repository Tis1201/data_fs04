<script lang="ts">
    import AdminPageLayout from "$lib/components/admin/layout/AdminPageLayout.svelte";

    const pageCrumbs = [
        ["Admin", "/admin"],
        ["Accounts", "/admin/accounts/accounts"],
        "Hierarchy"
    ];
</script>

<AdminPageLayout
    title="Account Hierarchy"
    crumbs={pageCrumbs}
    actionButtons={[]}
>
    <div class="space-y-3 text-sm text-gray-700">
        <p>
            This is a placeholder page for managing account-to-account hierarchy and assignments.
        </p>
        <ul class="list-disc list-inside">
            <li>View parent and child relationships between accounts.</li>
            <li>Configure ownership, delegation, and visibility-only links.</li>
            <li>Later: manage effective permissions and access rules per relationship.</li>
        </ul>
    </div>
</AdminPageLayout>
