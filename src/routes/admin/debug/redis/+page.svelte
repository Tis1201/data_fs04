<script lang="ts">
    import AdminPageLayout from "$lib/components/admin/layout/AdminPageLayout.svelte";
    import { goto } from "$app/navigation";

    import AdminCard from "$lib/components/admin/layout/AdminCard.svelte";
    import FormContainer from "$lib/components/ui_components_sveltekit/form/FormContainer.svelte";
    import AccountFormFields from "$lib/components/ui_components_sveltekit/form/AccountFormFields.svelte";
    import EnhancedSelect from "$lib/components/ui_components_sveltekit/form/EnhancedSelect.svelte";
    import RelationshipSection from "$lib/components/ui_components_sveltekit/relationships/RelationshipSection.svelte";
    import { Button } from "$lib/components/ui/button";
    import { Users } from "lucide-svelte";

    const title = `View Redis Records`;
    const pageCrumbs = [
        ["Admin", "/admin/dashboard"],
        ["Debug"],
        ["Redis"],
    ] as [string, string][];

    const actionButtons = [
        {
            label: "Back",
            onClick: () => {
                goto("/admin/iot/factory_tokens");
            },
        },
    ];
</script>

<AdminPageLayout
    {title}
    crumbs={pageCrumbs}
    {actionButtons}
    showCreateButton={false}
    compact={true}
    contentSpacing="space-y-4"
>
    <AdminCard
      title="Group Information"
      description="Edit group details"
      icon={Users}
      compact={true}
    >
    </AdminCard>

</AdminPageLayout>
