<script lang="ts">
    import { page } from "$app/stores";
    import { RefreshCw, Users, Building2, UserPlus, Laptop, Activity, Clock } from "lucide-svelte";
    
    import { Button } from "$lib/components/ui/button";
    import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "$lib/components/ui/card";
    import { Skeleton } from "$lib/components/ui/skeleton";
    import AdminPageLayout from "$lib/components/admin/layout/AdminPageLayout.svelte";
    
    // Get the stats from the page data
    const { stats } = $page.data;
    
    // Format numbers with commas
    const formatNumber = (num: number): string => {
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    };

    // Define the dashboard cards
    const dashboardCards = [
        {
            title: "Total Users",
            value: formatNumber(stats.totalUsers),
            description: "Registered users in the system",
            icon: Users
        },
        {
            title: "Total Accounts",
            value: formatNumber(stats.totalAccounts),
            description: "Accounts registered in the platform",
            icon: Building2
        },
        {
            title: "Total Groups",
            value: formatNumber(stats.totalGroups),
            description: "User groups in the system",
            icon: UserPlus
        },
        {
            title: "Total Devices",
            value: formatNumber(stats.totalDevices),
            description: "Registered devices in the system",
            icon: Laptop
        },
        {
            title: "Active Sessions",
            value: formatNumber(stats.activeSessions),
            description: "Sessions created in the last 24 hours",
            icon: Activity
        },
        {
            title: "Active Devices",
            value: formatNumber(stats.activeDevices),
            description: "Devices connected in the last 24 hours",
            icon: Laptop
        },
        {
            title: "Recent Logins",
            value: formatNumber(stats.recentLogins),
            description: "Login sessions in the last 7 days",
            icon: Clock
        }
    ];
</script>

<AdminPageLayout
    title="Dashboard"
    crumbs={[
        ["Admin", "/admin"],
        "Dashboard"
    ]}
    actionButtons={[
        {
            label: "Refresh",
            icon: RefreshCw
        }
    ]}
>
    <Card class="w-full mb-6">
        <CardHeader>
            <CardTitle>System Overview</CardTitle>
            <CardDescription>Key metrics and statistics for your system</CardDescription>
        </CardHeader>
        <CardContent>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {#each dashboardCards as card}
                    <div class="flex items-start space-x-4 p-4 rounded-lg border bg-card text-card-foreground">
                        <div class="p-2 rounded-full bg-primary/10">
                            <svelte:component this={card.icon} class="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <h3 class="text-sm font-medium text-muted-foreground">{card.title}</h3>
                            <div class="text-2xl font-bold">{card.value}</div>
                            <p class="text-xs text-muted-foreground mt-1">{card.description}</p>
                        </div>
                    </div>
                {/each}
            </div>
        </CardContent>
    </Card>
</AdminPageLayout>
