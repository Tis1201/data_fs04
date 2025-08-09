<script lang="ts">
    import AdminPageLayout from "$lib/components/admin/layout/AdminPageLayout.svelte";
    import { goto } from "$app/navigation";
    import { onMount } from "svelte";
    import { browser } from "$app/environment";

    import AdminCard from "$lib/components/admin/layout/AdminCard.svelte";
    import { Button } from "$lib/components/ui/button";
    import { Input } from "$lib/components/ui/input";
    import { Label } from "$lib/components/ui/label";
    import {
        Database,
        RefreshCw,
        Plus,
        Search,
        Trash,
        Wifi,
        WifiOff,
        Send,
        MessageSquare,
    } from "lucide-svelte";
    import { Alert, AlertDescription } from "$lib/components/ui/alert";
    import { Badge } from "$lib/components/ui/badge";
    import { Separator } from "$lib/components/ui/separator";
    import { Skeleton } from "$lib/components/ui/skeleton";
    import { toast } from "svelte-sonner";
    import {
        Dialog,
        DialogContent,
        DialogDescription,
        DialogFooter,
        DialogHeader,
        DialogTitle,
    } from "$lib/components/ui/dialog";
    import { Textarea } from "$lib/components/ui/textarea";

    const title = `Redis Debug`;
    const pageCrumbs = [
        ["Admin", "/admin/dashboard"],
        ["Debug"],
        ["Redis"],
    ] as [string, string][];

    const actionButtons = [
        {
            label: "Back",
            onClick: () => {
                goto("/admin/dashboard");
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
        title="Redis Operations"
        description="Interact with Redis for debugging purposes"
        icon={Database}
        compact={true}
    ></AdminCard>
</AdminPageLayout>
