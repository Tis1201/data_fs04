<script lang="ts">
    import { page } from "$app/stores";
    import { onMount } from "svelte";
    import Chart from "chart.js/auto";
    import { goto } from "$app/navigation";
    import { enhance } from "$app/forms";
    import { RefreshCw, Cpu, HardDrive, Server, Clock, Activity, AlertTriangle, Database } from "lucide-svelte";
    import type { PageData } from "./$types";
    
    import AdminPageLayout from "$lib/components/admin/layout/AdminPageLayout.svelte";
    import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "$lib/components/ui/card";
    import { Progress } from "$lib/components/ui/progress";
    import { Separator } from "$lib/components/ui/separator";
    
    export let data: PageData;
    
    // Extract system data
    $: ({ system, sessions } = data);
    
    // Chart references
    let cpuChartCanvas: HTMLCanvasElement;
    let memoryChartCanvas: HTMLCanvasElement;
    let loginActivityChartCanvas: HTMLCanvasElement;
    let cpuChart: Chart;
    let memoryChart: Chart;
    let loginActivityChart: Chart;
    
    // Format date for display
    const formatDate = (dateString: string): string => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    };
    
    // Initialize charts on component mount
    onMount(() => {
        // CPU Usage Chart
        if (cpuChartCanvas) {
            const ctx = cpuChartCanvas.getContext('2d');
            if (ctx) {
                // Create a dummy dataset for initial display
                const labels = Array.from({ length: 20 }, (_, i) => i.toString());
                const data = Array(20).fill(0);
                data[19] = system.cpu.usage; // Set the last point to current CPU usage
                
                cpuChart = new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: labels,
                        datasets: [{
                            label: 'CPU Usage %',
                            data: data,
                            borderColor: 'rgb(249, 115, 22)',
                            backgroundColor: 'rgba(249, 115, 22, 0.1)',
                            borderWidth: 2,
                            tension: 0.4,
                            fill: true
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: {
                                display: false
                            }
                        },
                        scales: {
                            y: {
                                beginAtZero: true,
                                max: 100,
                                title: {
                                    display: true,
                                    text: 'Usage %'
                                }
                            },
                            x: {
                                display: false
                            }
                        },
                        animation: {
                            duration: 0
                        }
                    }
                });
                
                // Update CPU chart every 2 seconds
                const updateCpuChart = async () => {
                    try {
                        const formData = new FormData();
                        const response = await fetch('?/getSystemStats', {
                            method: 'POST',
                            body: formData
                        });
                        
                        if (response.ok) {
                            const result = await response.json();
                            if (result.data && result.data.success) {
                                const stats = result.data;
                                
                                // Add new data point and remove oldest
                                cpuChart.data.datasets[0].data.push(stats.cpu.usage);
                                cpuChart.data.datasets[0].data.shift();
                                
                                // Update memory values if available
                                if (stats.memory && memoryChart) {
                                    memoryChart.data.datasets[0].data = [
                                        stats.memory.used,
                                        stats.memory.free
                                    ];
                                    memoryChart.update('none');
                                }
                                
                                cpuChart.update('none');
                            }
                        }
                    } catch (error) {
                        console.error('Error updating CPU chart:', error);
                    }
                };
                
                const cpuInterval = setInterval(updateCpuChart, 2000);
                
                // Cleanup on component unmount
                return () => {
                    clearInterval(cpuInterval);
                    if (cpuChart) cpuChart.destroy();
                    if (memoryChart) memoryChart.destroy();
                    if (loginActivityChart) loginActivityChart.destroy();
                };
            }
        }
        
        // Memory Usage Chart
        if (memoryChartCanvas) {
            const ctx = memoryChartCanvas.getContext('2d');
            if (ctx) {
                memoryChart = new Chart(ctx, {
                    type: 'doughnut',
                    data: {
                        labels: ['Used', 'Free'],
                        datasets: [{
                            data: [system.memory.used, system.memory.free],
                            backgroundColor: [
                                'rgba(147, 51, 234, 0.8)',
                                'rgba(226, 232, 240, 0.8)'
                            ],
                            borderColor: [
                                'rgb(147, 51, 234)',
                                'rgb(226, 232, 240)'
                            ],
                            borderWidth: 1
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: {
                                position: 'bottom'
                            },
                            tooltip: {
                                callbacks: {
                                    label: (context) => {
                                        const label = context.label || '';
                                        const value = context.raw as number;
                                        return `${label}: ${value} GB`;
                                    }
                                }
                            }
                        },
                        cutout: '70%'
                    }
                });
            }
        }
        
        // Login Activity Chart
        if (loginActivityChartCanvas) {
            const ctx = loginActivityChartCanvas.getContext('2d');
            if (ctx) {
                loginActivityChart = new Chart(ctx, {
                    type: 'bar',
                    data: {
                        labels: sessions.loginActivity.map(day => formatDate(day.date)),
                        datasets: [
                            {
                                label: 'Successful Logins',
                                data: sessions.loginActivity.map(day => day.successful),
                                backgroundColor: 'rgba(34, 197, 94, 0.6)',
                                borderColor: 'rgb(34, 197, 94)',
                                borderWidth: 1,
                                borderRadius: 4
                            },
                            {
                                label: 'Failed Logins',
                                data: sessions.loginActivity.map(day => day.failed),
                                backgroundColor: 'rgba(239, 68, 68, 0.6)',
                                borderColor: 'rgb(239, 68, 68)',
                                borderWidth: 1,
                                borderRadius: 4
                            }
                        ]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: {
                                position: 'bottom'
                            }
                        },
                        scales: {
                            y: {
                                beginAtZero: true,
                                ticks: {
                                    precision: 0
                                },
                                title: {
                                    display: true,
                                    text: 'Count'
                                }
                            },
                            x: {
                                title: {
                                    display: true,
                                    text: 'Date'
                                }
                            }
                        }
                    }
                });
            }
        }
    });
</script>

<AdminPageLayout
    title="System Monitor"
    crumbs={[
        ["Admin", "/admin"],
        "System Monitor"
    ]}
    actionButtons={[
        {
            label: "Refresh",
            icon: RefreshCw,
            onClick: () => window.location.reload()
        }
    ]}
>
    <!-- System Overview Cards -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <!-- CPU Usage -->
        <Card>
            <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle class="text-sm font-medium">CPU Usage</CardTitle>
                <svelte:component this={Cpu} class="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div class="text-2xl font-bold">{system.cpu.usage}%</div>
                <Progress value={system.cpu.usage} class="h-2" />
                <p class="text-xs text-muted-foreground mt-2">{system.cpu.model}</p>
                <p class="text-xs text-muted-foreground">{system.cpu.count} cores</p>
            </CardContent>
        </Card>
        
        <!-- Memory Usage -->
        <Card>
            <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle class="text-sm font-medium">Memory Usage</CardTitle>
                <svelte:component this={Database} class="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div class="text-2xl font-bold">{system.memory.usagePercentage}%</div>
                <Progress value={system.memory.usagePercentage} class="h-2" />
                <p class="text-xs text-muted-foreground mt-2">
                    {system.memory.used} GB used of {system.memory.total} GB
                </p>
            </CardContent>
        </Card>
        
        <!-- System Uptime -->
        <Card>
            <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle class="text-sm font-medium">System Uptime</CardTitle>
                <svelte:component this={Clock} class="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div class="text-2xl font-bold">{system.uptime.formatted}</div>
                <p class="text-xs text-muted-foreground mt-2">
                    {system.os.type} {system.os.release} ({system.os.platform}/{system.os.arch})
                </p>
                <p class="text-xs text-muted-foreground">{system.hostname}</p>
            </CardContent>
        </Card>
        
        <!-- Active Sessions -->
        <Card>
            <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle class="text-sm font-medium">Active Sessions</CardTitle>
                <svelte:component this={Activity} class="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div class="text-2xl font-bold">{sessions.active}</div>
                <div class="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <div>
                        <span class="font-medium">Total:</span> {sessions.total}
                    </div>
                    <div>
                        <span class="font-medium">Failed:</span> {sessions.failedLogins}
                    </div>
                </div>
            </CardContent>
        </Card>
    </div>
    
    <!-- Charts -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <!-- CPU Usage Chart -->
        <Card class="w-full">
            <CardHeader>
                <CardTitle>CPU Usage (Real-time)</CardTitle>
                <CardDescription>CPU usage over time</CardDescription>
            </CardHeader>
            <CardContent>
                <div class="h-80 w-full">
                    <canvas bind:this={cpuChartCanvas}></canvas>
                </div>
            </CardContent>
        </Card>
        
        <!-- Memory Usage Chart -->
        <Card class="w-full">
            <CardHeader>
                <CardTitle>Memory Allocation</CardTitle>
                <CardDescription>Current memory usage</CardDescription>
            </CardHeader>
            <CardContent>
                <div class="h-80 w-full">
                    <canvas bind:this={memoryChartCanvas}></canvas>
                </div>
            </CardContent>
        </Card>
    </div>
    
    <!-- Login Activity Chart -->
    <Card class="w-full mb-6">
        <CardHeader>
            <CardTitle>Login Activity (Last 7 Days)</CardTitle>
            <CardDescription>Successful vs. failed login attempts</CardDescription>
        </CardHeader>
        <CardContent>
            <div class="h-80 w-full">
                <canvas bind:this={loginActivityChartCanvas}></canvas>
            </div>
        </CardContent>
    </Card>
    
    <!-- System Details -->
    <Card class="w-full">
        <CardHeader>
            <CardTitle>System Details</CardTitle>
            <CardDescription>Detailed system information</CardDescription>
        </CardHeader>
        <CardContent>
            <div class="space-y-6">
                <!-- Process Memory -->
                <div>
                    <h3 class="text-sm font-medium mb-2">Process Memory</h3>
                    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div class="bg-muted p-3 rounded-md">
                            <div class="text-xs text-muted-foreground">RSS</div>
                            <div class="text-sm font-medium">{system.process.rss} GB</div>
                        </div>
                        <div class="bg-muted p-3 rounded-md">
                            <div class="text-xs text-muted-foreground">Heap Total</div>
                            <div class="text-sm font-medium">{system.process.heapTotal} GB</div>
                        </div>
                        <div class="bg-muted p-3 rounded-md">
                            <div class="text-xs text-muted-foreground">Heap Used</div>
                            <div class="text-sm font-medium">{system.process.heapUsed} GB</div>
                        </div>
                        <div class="bg-muted p-3 rounded-md">
                            <div class="text-xs text-muted-foreground">External</div>
                            <div class="text-sm font-medium">{system.process.external} GB</div>
                        </div>
                    </div>
                </div>
                
                <Separator />
                
                <!-- CPU Load Averages -->
                <div>
                    <h3 class="text-sm font-medium mb-2">CPU Load Averages</h3>
                    <div class="grid grid-cols-3 gap-4">
                        <div class="bg-muted p-3 rounded-md">
                            <div class="text-xs text-muted-foreground">1 Minute</div>
                            <div class="text-sm font-medium">{system.cpu.loadAvg[0]}</div>
                        </div>
                        <div class="bg-muted p-3 rounded-md">
                            <div class="text-xs text-muted-foreground">5 Minutes</div>
                            <div class="text-sm font-medium">{system.cpu.loadAvg[1]}</div>
                        </div>
                        <div class="bg-muted p-3 rounded-md">
                            <div class="text-xs text-muted-foreground">15 Minutes</div>
                            <div class="text-sm font-medium">{system.cpu.loadAvg[2]}</div>
                        </div>
                    </div>
                </div>
                
                <Separator />
                
                <!-- Network Interfaces -->
                <div>
                    <h3 class="text-sm font-medium mb-2">Network Interfaces</h3>
                    <div class="space-y-3">
                        {#each system.network as networkInterface}
                            <div class="bg-muted p-3 rounded-md">
                                <div class="text-sm font-medium">{networkInterface.name}</div>
                                {#each networkInterface.addresses as address}
                                    <div class="text-xs text-muted-foreground">
                                        {address.family === 'IPv4' ? 'IPv4' : 'IPv6'}: {address.address}
                                    </div>
                                {/each}
                            </div>
                        {/each}
                    </div>
                </div>
            </div>
        </CardContent>
    </Card>
</AdminPageLayout>
