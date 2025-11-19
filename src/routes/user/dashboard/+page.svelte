<script lang="ts">
    import { page } from "$app/stores";
    import { goto } from "$app/navigation";
    import { RefreshCw, Laptop, Key, Users, Activity, BarChart, Clock, CheckCircle, XCircle, Tag } from "lucide-svelte";
    import { onMount } from "svelte";
    import Chart from "chart.js/auto";
    import { formatDistanceToNow } from "date-fns";
    
    import { Button } from "$lib/components/ui/button";
    import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "$lib/components/ui/card";
    import { Badge } from "$lib/components/ui/badge";
    import UserPageLayout from "$lib/components/user/layout/UserPageLayout.svelte";
    
    // Get the data from the page
    const { stats, recentDevices, recentApiKeys } = $page.data;
    
    // Format numbers with commas
    const formatNumber = (num: number): string => {
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    };

    // Chart references
    let deviceChartCanvas: HTMLCanvasElement;
    let deviceChart: Chart;
    
    // Format date for display
    const formatDate = (dateString: string): string => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    };
    
    // Initialize charts on component mount
    onMount(() => {
        // Initialize device activity chart
        if (deviceChartCanvas) {
            const ctx = deviceChartCanvas.getContext('2d');
            if (ctx) {
                deviceChart = new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: stats.devicesByDay.map(day => formatDate(day.date)),
                        datasets: [{
                            label: 'Device Connections',
                            data: stats.devicesByDay.map(day => day.count),
                            backgroundColor: 'rgba(59, 130, 246, 0.2)',
                            borderColor: 'rgb(59, 130, 246)',
                            borderWidth: 2,
                            fill: true,
                            tension: 0.4,
                            pointBackgroundColor: 'rgb(59, 130, 246)',
                            pointBorderColor: '#fff',
                            pointBorderWidth: 2,
                            pointRadius: 4,
                            pointHoverRadius: 6
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: {
                                display: false
                            },
                            tooltip: {
                                callbacks: {
                                    title: (items) => {
                                        if (items.length > 0) {
                                            const index = items[0].dataIndex;
                                            return formatDate(stats.devicesByDay[index].date);
                                        }
                                        return '';
                                    },
                                    label: (item) => {
                                        return `Connections: ${item.raw}`;
                                    }
                                }
                            }
                        },
                        scales: {
                            y: {
                                beginAtZero: true,
                                ticks: {
                                    precision: 0
                                }
                            }
                        }
                    }
                });
            }
        }
        
        return () => {
            if (deviceChart) {
                deviceChart.destroy();
            }
        };
    });
    
    // Define the dashboard cards
    const dashboardCards = [
        {
            title: "Total Devices",
            value: formatNumber(stats.totalDevices),
            description: "Your registered devices",
            icon: Laptop,
            link: "/user/iot/devices"
        },
        {
            title: "Active Devices",
            value: formatNumber(stats.activeDevices),
            description: "Connected in the last 24 hours",
            icon: Activity,
            link: "/user/iot/devices"
        },
        {
            title: "API Keys",
            value: formatNumber(stats.totalApiKeys),
            description: "Your active API keys",
            icon: Key,
            link: "/user/profile"
        },
        {
            title: "Account Memberships",
            value: formatNumber(stats.accountMemberships),
            description: "Organizations you belong to",
            icon: Users,
            link: "/user/profile"
        },
        {
            title: "Recent Sessions",
            value: formatNumber(stats.recentSessions),
            description: "Login sessions in the last 7 days",
            icon: Clock,
            link: "/user/profile"
        },
        {
            title: "Preclaims",
            value: formatNumber(stats.totalPreclaims),
            description: "Pre-registered device claims",
            icon: Tag,
            link: "/user/iot/preclaims"
        }
    ];
</script>

<UserPageLayout
    title="Dashboard"
    crumbs={[
        ["Dashboard", "/user"]
    ]}
>
    <!-- Statistics Overview -->
    <Card class="w-full mb-6">
        <CardHeader>
            <CardTitle>Account Overview</CardTitle>
            <CardDescription>Your key metrics and statistics</CardDescription>
        </CardHeader>
        <CardContent>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {#each dashboardCards as card}
                    <a 
                        href={card.link} 
                        class="flex items-start space-x-4 p-4 rounded-lg border bg-card text-card-foreground hover:bg-accent/50 transition-colors cursor-pointer"
                    >
                        <div class="p-2 rounded-full bg-primary/10">
                            <svelte:component this={card.icon} class="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <h3 class="text-sm font-medium text-muted-foreground">{card.title}</h3>
                            <div class="text-2xl font-bold">{card.value}</div>
                            <p class="text-xs text-muted-foreground mt-1">{card.description}</p>
                        </div>
                    </a>
                {/each}
            </div>
        </CardContent>
    </Card>

    <!-- Device Activity Chart -->    
    <Card class="w-full mb-6">
        <CardHeader>
            <CardTitle>Device Activity (Last 7 Days)</CardTitle>
            <CardDescription>Your device connection activity</CardDescription>
        </CardHeader>
        <CardContent>
            <div class="h-80 w-full">
                <canvas bind:this={deviceChartCanvas}></canvas>
            </div>
        </CardContent>
    </Card>

    <!-- Recent Devices and API Keys -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <!-- Recent Devices -->
        <Card>
            <CardHeader class="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Recent Devices</CardTitle>
                    <CardDescription>Your most recently active devices</CardDescription>
                </div>
                <Button variant="outline" size="sm" on:click={() => goto('/user/iot/devices')}>
                    View All
                </Button>
            </CardHeader>
            <CardContent>
                {#if recentDevices.length > 0}
                    <div class="space-y-4">
                        {#each recentDevices as device}
                            <a 
                                href="/user/iot/devices/{device.id}" 
                                class="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50 transition-colors"
                            >
                                <div class="flex items-center space-x-3">
                                    <Laptop class="h-5 w-5 text-muted-foreground" />
                                    <div>
                                        <p class="text-sm font-medium">{device.name}</p>
                                        <p class="text-xs text-muted-foreground">
                                            {#if device.lastUsedAt}
                                                Last used {formatDistanceToNow(new Date(device.lastUsedAt), { addSuffix: true })}
                                            {:else if device.connectedAt}
                                                Connected {formatDistanceToNow(new Date(device.connectedAt), { addSuffix: true })}
                                            {:else}
                                                Never used
                                            {/if}
                                        </p>
                                    </div>
                                </div>
                                <Badge variant={device.connected ? 'default' : 'secondary'}>
                                    {device.connected ? 'Connected' : 'Offline'}
                                </Badge>
                            </a>
                        {/each}
                    </div>
                {:else}
                    <div class="text-center py-8 text-muted-foreground">
                        <Laptop class="h-12 w-12 mx-auto mb-2 opacity-50" />
                        <p class="text-sm">No devices registered yet</p>
                        <Button variant="outline" size="sm" class="mt-3" on:click={() => goto('/user/iot/devices/new')}>
                            Register Device
                        </Button>
                    </div>
                {/if}
            </CardContent>
        </Card>

        <!-- Recent API Keys -->
        <Card>
            <CardHeader class="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>API Keys</CardTitle>
                    <CardDescription>Your most recent API keys</CardDescription>
                </div>
                <Button variant="outline" size="sm" on:click={() => goto('/user/profile')}>
                    Manage Keys
                </Button>
            </CardHeader>
            <CardContent>
                {#if recentApiKeys.length > 0}
                    <div class="space-y-4">
                        {#each recentApiKeys as apiKey}
                            <div class="flex items-center justify-between p-3 rounded-lg border">
                                <div class="flex items-center space-x-3">
                                    <Key class="h-5 w-5 text-muted-foreground" />
                                    <div>
                                        <p class="text-sm font-medium">{apiKey.name}</p>
                                        <p class="text-xs text-muted-foreground">
                                            Created {formatDistanceToNow(new Date(apiKey.createdAt), { addSuffix: true })}
                                        </p>
                                    </div>
                                </div>
                                <Badge variant={apiKey.active ? 'default' : 'secondary'}>
                                    {apiKey.active ? 'Active' : 'Inactive'}
                                </Badge>
                            </div>
                        {/each}
                    </div>
                {:else}
                    <div class="text-center py-8 text-muted-foreground">
                        <Key class="h-12 w-12 mx-auto mb-2 opacity-50" />
                        <p class="text-sm">No API keys created yet</p>
                        <Button variant="outline" size="sm" class="mt-3" on:click={() => goto('/user/profile')}>
                            Create API Key
                        </Button>
                    </div>
                {/if}
            </CardContent>
        </Card>
    </div>
</UserPageLayout>
