<script lang="ts">
    import { page } from "$app/stores";
    import { RefreshCw, Users, Building2, UserPlus, Laptop, Activity, Clock, BarChart, AlertTriangle } from "lucide-svelte";
    import { onMount } from "svelte";
    import Chart from "chart.js/auto";
    
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

    // Chart references
    let loginChartCanvas: HTMLCanvasElement;
    let loginChart: Chart;
    let failedLoginChartCanvas: HTMLCanvasElement;
    let failedLoginChart: Chart;
    
    // Format date for display
    const formatDate = (dateString: string): string => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    };
    
    // Initialize charts on component mount
    onMount(() => {
        // Initialize login activity chart
        if (loginChartCanvas) {
            const ctx = loginChartCanvas.getContext('2d');
            if (ctx) {
                loginChart = new Chart(ctx, {
                    type: 'bar',
                    data: {
                        labels: stats.loginsByDay.map(day => formatDate(day.date)),
                        datasets: [{
                            label: 'User Logins',
                            data: stats.loginsByDay.map(day => day.count),
                            backgroundColor: 'rgba(147, 51, 234, 0.2)',
                            borderColor: 'rgb(147, 51, 234)',
                            borderWidth: 1,
                            borderRadius: 4,
                            hoverBackgroundColor: 'rgba(147, 51, 234, 0.4)'
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
                                            return formatDate(stats.loginsByDay[index].date);
                                        }
                                        return '';
                                    },
                                    label: (item) => {
                                        return `Logins: ${item.raw}`;
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
        
        // Initialize failed login chart
        if (failedLoginChartCanvas) {
            const ctx = failedLoginChartCanvas.getContext('2d');
            if (ctx) {
                failedLoginChart = new Chart(ctx, {
                    type: 'bar',
                    data: {
                        labels: stats.failedLoginsByDay.map(day => formatDate(day.date)),
                        datasets: [{
                            label: 'Failed Logins',
                            data: stats.failedLoginsByDay.map(day => day.count),
                            backgroundColor: 'rgba(239, 68, 68, 0.2)',
                            borderColor: 'rgb(239, 68, 68)',
                            borderWidth: 1,
                            borderRadius: 4,
                            hoverBackgroundColor: 'rgba(239, 68, 68, 0.4)'
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
                                            return formatDate(stats.failedLoginsByDay[index].date);
                                        }
                                        return '';
                                    },
                                    label: (item) => {
                                        return `Failed Logins: ${item.raw}`;
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
            if (loginChart) {
                loginChart.destroy();
            }
            if (failedLoginChart) {
                failedLoginChart.destroy();
            }
        };
    });
    
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
        },
        {
            title: "Failed Logins",
            value: formatNumber(stats.recentFailedLogins),
            description: "Failed login attempts in the last 7 days",
            icon: AlertTriangle
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
    <!-- Login Activity Chart -->    
    <Card class="w-full mb-6">
        <CardHeader>
            <CardTitle>Login Activity (Last 7 Days)</CardTitle>
            <CardDescription>Daily user login activity</CardDescription>
        </CardHeader>
        <CardContent>
            <div class="h-80 w-full">
                <canvas bind:this={loginChartCanvas}></canvas>
            </div>
        </CardContent>
    </Card>
    
    <!-- Failed Login Activity Chart -->    
    <Card class="w-full">
        <CardHeader>
            <CardTitle>Failed Login Attempts (Last 7 Days)</CardTitle>
            <CardDescription>Daily failed login attempts</CardDescription>
        </CardHeader>
        <CardContent>
            <div class="h-80 w-full">
                <canvas bind:this={failedLoginChartCanvas}></canvas>
            </div>
        </CardContent>
    </Card>
</AdminPageLayout>
