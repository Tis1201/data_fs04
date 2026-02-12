<script lang="ts">
    import { goto, invalidateAll } from "$app/navigation";
    import { page } from "$app/stores";
    import { onMount } from "svelte";
    import Chart from "chart.js/auto";
    import { 
        CircleAlert, 
        TriangleAlert, 
        BadgeCheck, 
        WifiOff, 
        HardDriveUpload,
        TrendingUp,
        TrendingDown,
        ArrowRight,
        CalendarDays,
        ChevronDown
    } from "lucide-svelte";
    import { Button, ProgressBar, ActionMenu } from "$lib/design-system/components";
    
    // Get the data from the page
    export let data;
    $: ({ dashboardStats, recentEvents, devicesByOS, selectedYear: serverSelectedYear } = data);
    
    // Format numbers with commas
    const formatNumber = (num: number): string => {
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    };

    // Chart references
    let issuesCategoriesCanvas: HTMLCanvasElement;
    let fleetHealthCanvas: HTMLCanvasElement;
    let issuesCategoriesChart: Chart;
    let fleetHealthChart: Chart;
    
    // Selected year for charts - get from server data
    const currentYear = new Date().getFullYear();
    $: selectedYear = serverSelectedYear || currentYear;
    
    // Year options for dropdown (last 5 years)
    const yearOptions = Array.from({ length: 5 }, (_, i) => ({
        id: String(currentYear - i),
        label: String(currentYear - i)
    }));
    
    // Year dropdown state
    let showYearDropdown1 = false;
    let showYearDropdown2 = false;
    
    // Handle year selection
    async function handleYearChange(year: string) {
        showYearDropdown1 = false;
        showYearDropdown2 = false;
        
        // Update URL with selected year and reload data
        const url = new URL(window.location.href);
        url.searchParams.set('year', year);
        await goto(url.toString(), { replaceState: true, invalidateAll: true });
    }
    
    // Close dropdowns when clicking outside
    function handleClickOutside(event: MouseEvent) {
        const target = event.target as HTMLElement;
        if (!target.closest('.year-selector')) {
            showYearDropdown1 = false;
            showYearDropdown2 = false;
        }
    }
    
    // Format relative time
    const formatRelativeTime = (dateString: string): string => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffSeconds = Math.floor(diffMs / 1000);
        const diffMinutes = Math.floor(diffSeconds / 60);
        const diffHours = Math.floor(diffMinutes / 60);
        const diffDays = Math.floor(diffHours / 24);
        
        if (diffSeconds < 60) return `${diffSeconds} seconds ago`;
        if (diffMinutes < 60) return `${diffMinutes} minutes ago`;
        if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
        return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    };
    
    // Chart colors from design
    const chartColors = {
        cpuOverload: '#B9E6FE',      // Blue light/200
        memoryCritical: '#7CD4FD',   // Blue light/300
        storageLow: '#0BA5EC',       // Blue light/500
        networkUnstable: '#0086C9',  // Blue light/600
        updateFailed: '#026AA2',     // Blue light/700
        offline: '#0B4A6F'           // Blue light/900
    };
    
    // Initialize charts on component mount
    onMount(() => {
        // Add click outside listener
        document.addEventListener('click', handleClickOutside);
        // Initialize Issues by Categories chart (Stacked Bar)
        if (issuesCategoriesCanvas && dashboardStats?.issuesByCategory) {
            const ctx = issuesCategoriesCanvas.getContext('2d');
            if (ctx) {
                issuesCategoriesChart = new Chart(ctx, {
                    type: 'bar',
                    data: {
                        labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
                        // Order: bottom to top in stacked chart
                        // Offline (darkest) at bottom, CPU Overload (lightest) at top
                        datasets: [
                            {
                                label: 'Offline',
                                data: dashboardStats.issuesByCategory.offline || Array(12).fill(0),
                                backgroundColor: chartColors.offline,
                                borderRadius: { topLeft: 0, topRight: 0, bottomLeft: 8, bottomRight: 8 },
                                borderSkipped: false,
                                barThickness: 32
                            },
                            {
                                label: 'Update Failed',
                                data: dashboardStats.issuesByCategory.updateFailed || Array(12).fill(0),
                                backgroundColor: chartColors.updateFailed,
                                borderSkipped: false,
                                barThickness: 32
                            },
                            {
                                label: 'Network Unstable',
                                data: dashboardStats.issuesByCategory.networkUnstable || Array(12).fill(0),
                                backgroundColor: chartColors.networkUnstable,
                                borderSkipped: false,
                                barThickness: 32
                            },
                            {
                                label: 'Storage Low',
                                data: dashboardStats.issuesByCategory.storageLow || Array(12).fill(0),
                                backgroundColor: chartColors.storageLow,
                                borderSkipped: false,
                                barThickness: 32
                            },
                            {
                                label: 'Memory Critical',
                                data: dashboardStats.issuesByCategory.memoryCritical || Array(12).fill(0),
                                backgroundColor: chartColors.memoryCritical,
                                borderSkipped: false,
                                barThickness: 32
                            },
                            {
                                label: 'CPU Overload',
                                data: dashboardStats.issuesByCategory.cpuOverload || Array(12).fill(0),
                                backgroundColor: chartColors.cpuOverload,
                                borderRadius: { topLeft: 8, topRight: 8, bottomLeft: 0, bottomRight: 0 },
                                borderSkipped: false,
                                barThickness: 32
                            }
                        ]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        layout: {
                            padding: {
                                left: 16,
                                right: 0,
                                top: 16,
                                bottom: 0
                            }
                        },
                        plugins: {
                            legend: {
                                display: false
                            },
                            tooltip: {
                                enabled: false,
                                mode: 'index',
                                intersect: false,
                                external: (context) => {
                                    // Get or create tooltip element
                                    let tooltipEl = document.getElementById('chartjs-tooltip-issues');
                                    if (!tooltipEl) {
                                        tooltipEl = document.createElement('div');
                                        tooltipEl.id = 'chartjs-tooltip-issues';
                                        tooltipEl.className = 'chartjs-custom-tooltip';
                                        document.body.appendChild(tooltipEl);
                                    }
                                    
                                    const tooltipModel = context.tooltip;
                                    
                                    // Hide if no tooltip
                                    if (tooltipModel.opacity === 0) {
                                        tooltipEl.style.opacity = '0';
                                        tooltipEl.style.pointerEvents = 'none';
                                        return;
                                    }
                                    
                                    // Build tooltip content
                                    if (tooltipModel.body) {
                                        const titleLines = tooltipModel.title || [];
                                        const bodyLines = tooltipModel.body.map(b => b.lines);
                                        
                                        let innerHtml = '<div class="tooltip-content">';
                                        
                                        // Title
                                        titleLines.forEach(title => {
                                            innerHtml += `<div class="tooltip-title">${title}</div>`;
                                        });
                                        
                                        // Data rows
                                        tooltipModel.dataPoints.forEach((dataPoint, i) => {
                                            const label = dataPoint.dataset.label || '';
                                            const value = dataPoint.parsed.y || 0;
                                            innerHtml += `
                                                <div class="tooltip-row">
                                                    <span class="tooltip-label">${label}:</span>
                                                    <span class="tooltip-value">${value}</span>
                                                </div>
                                            `;
                                        });
                                        
                                        innerHtml += '</div>';
                                        innerHtml += '<div class="tooltip-arrow"></div>';
                                        tooltipEl.innerHTML = innerHtml;
                                    }
                                    
                                    // Position tooltip
                                    const position = context.chart.canvas.getBoundingClientRect();
                                    tooltipEl.style.opacity = '1';
                                    tooltipEl.style.pointerEvents = 'none';
                                    tooltipEl.style.position = 'fixed';
                                    tooltipEl.style.left = position.left + window.scrollX + tooltipModel.caretX + 'px';
                                    tooltipEl.style.top = position.top + window.scrollY + tooltipModel.caretY - tooltipEl.offsetHeight - 10 + 'px';
                                    tooltipEl.style.transform = 'translateX(-50%)';
                                },
                                callbacks: {
                                    title: (items) => {
                                        if (items.length > 0) {
                                            const month = items[0].label;
                                            return `${month}, ${selectedYear} Issues by Categories:`;
                                        }
                                        return '';
                                    }
                                }
                            }
                        },
                        scales: {
                            x: {
                                stacked: true,
                                grid: {
                                    display: false
                                },
                                ticks: {
                                    font: {
                                        family: 'Poppins',
                                        size: 12,
                                        weight: 'normal'
                                    },
                                    color: '#475467'
                                }
                            },
                            y: {
                                stacked: true,
                                beginAtZero: true,
                                max: 100,
                                ticks: {
                                    stepSize: 20,
                                    font: {
                                        family: 'Poppins',
                                        size: 12,
                                        weight: 'normal'
                                    },
                                    color: '#344054'
                                },
                                grid: {
                                    color: '#F2F4F7'
                                },
                                border: {
                                    display: false
                                }
                            }
                        }
                    }
                });
            }
        }
        
        // Initialize Fleet Health Trends chart (Line)
        if (fleetHealthCanvas && dashboardStats?.fleetHealthTrends) {
            const ctx = fleetHealthCanvas.getContext('2d');
            if (ctx) {
                fleetHealthChart = new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
                        datasets: [
                            {
                                label: 'CPU Overload',
                                data: dashboardStats.fleetHealthTrends.cpuOverload || Array(12).fill(0),
                                borderColor: chartColors.cpuOverload,
                                backgroundColor: 'transparent',
                                borderWidth: 2,
                                tension: 0.4,
                                pointRadius: 0,
                                pointHoverRadius: 4
                            },
                            {
                                label: 'Network Unstable',
                                data: dashboardStats.fleetHealthTrends.networkUnstable || Array(12).fill(0),
                                borderColor: chartColors.networkUnstable,
                                backgroundColor: 'transparent',
                                borderWidth: 2,
                                tension: 0.4,
                                pointRadius: 0,
                                pointHoverRadius: 4
                            },
                            {
                                label: 'Update Failed',
                                data: dashboardStats.fleetHealthTrends.updateFailed || Array(12).fill(0),
                                borderColor: chartColors.updateFailed,
                                backgroundColor: 'transparent',
                                borderWidth: 2,
                                tension: 0.4,
                                pointRadius: 0,
                                pointHoverRadius: 4
                            },
                            {
                                label: 'Offline',
                                data: dashboardStats.fleetHealthTrends.offline || Array(12).fill(0),
                                borderColor: chartColors.offline,
                                backgroundColor: 'transparent',
                                borderWidth: 2,
                                tension: 0.4,
                                pointRadius: 0,
                                pointHoverRadius: 4
                            }
                        ]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        layout: {
                            padding: {
                                left: 16,
                                right: 0,
                                top: 16,
                                bottom: 0
                            }
                        },
                        plugins: {
                            legend: {
                                display: false
                            },
                            tooltip: {
                                enabled: false,
                                mode: 'index',
                                intersect: false,
                                external: (context) => {
                                    // Get or create tooltip element
                                    let tooltipEl = document.getElementById('chartjs-tooltip-fleet');
                                    if (!tooltipEl) {
                                        tooltipEl = document.createElement('div');
                                        tooltipEl.id = 'chartjs-tooltip-fleet';
                                        tooltipEl.className = 'chartjs-custom-tooltip';
                                        document.body.appendChild(tooltipEl);
                                    }
                                    
                                    const tooltipModel = context.tooltip;
                                    
                                    // Hide if no tooltip
                                    if (tooltipModel.opacity === 0) {
                                        tooltipEl.style.opacity = '0';
                                        tooltipEl.style.pointerEvents = 'none';
                                        return;
                                    }
                                    
                                    // Build tooltip content
                                    if (tooltipModel.body) {
                                        const titleLines = tooltipModel.title || [];
                                        const bodyLines = tooltipModel.body.map(b => b.lines);
                                        
                                        let innerHtml = '<div class="tooltip-content">';
                                        
                                        // Title
                                        titleLines.forEach(title => {
                                            innerHtml += `<div class="tooltip-title">${title}</div>`;
                                        });
                                        
                                        // Data rows
                                        tooltipModel.dataPoints.forEach((dataPoint, i) => {
                                            const label = dataPoint.dataset.label || '';
                                            const value = dataPoint.parsed.y || 0;
                                            innerHtml += `
                                                <div class="tooltip-row">
                                                    <span class="tooltip-label">${label}:</span>
                                                    <span class="tooltip-value">${value}</span>
                                                </div>
                                            `;
                                        });
                                        
                                        innerHtml += '</div>';
                                        innerHtml += '<div class="tooltip-arrow"></div>';
                                        tooltipEl.innerHTML = innerHtml;
                                    }
                                    
                                    // Position tooltip
                                    const position = context.chart.canvas.getBoundingClientRect();
                                    tooltipEl.style.opacity = '1';
                                    tooltipEl.style.pointerEvents = 'none';
                                    tooltipEl.style.position = 'fixed';
                                    tooltipEl.style.left = position.left + window.scrollX + tooltipModel.caretX + 'px';
                                    tooltipEl.style.top = position.top + window.scrollY + tooltipModel.caretY - tooltipEl.offsetHeight - 10 + 'px';
                                    tooltipEl.style.transform = 'translateX(-50%)';
                                },
                                callbacks: {
                                    title: (items) => {
                                        if (items.length > 0) {
                                            const month = items[0].label;
                                            return `${month}, ${selectedYear} Fleet Health Trends:`;
                                        }
                                        return '';
                                    }
                                }
                            }
                        },
                        scales: {
                            x: {
                                grid: {
                                    display: false
                                },
                                ticks: {
                                    font: {
                                        family: 'Poppins',
                                        size: 12,
                                        weight: 'normal'
                                    },
                                    color: '#475467'
                                }
                            },
                            y: {
                                beginAtZero: true,
                                max: 100,
                                ticks: {
                                    stepSize: 20,
                                    font: {
                                        family: 'Poppins',
                                        size: 12,
                                        weight: 'normal'
                                    },
                                    color: '#344054'
                                },
                                grid: {
                                    color: '#F2F4F7'
                                },
                                border: {
                                    display: false
                                }
                            }
                        }
                    }
                });
            }
        }
        
        return () => {
            if (issuesCategoriesChart) issuesCategoriesChart.destroy();
            if (fleetHealthChart) fleetHealthChart.destroy();
            document.removeEventListener('click', handleClickOutside);
            
            // Cleanup custom tooltips
            const tooltipIssues = document.getElementById('chartjs-tooltip-issues');
            const tooltipFleet = document.getElementById('chartjs-tooltip-fleet');
            if (tooltipIssues) tooltipIssues.remove();
            if (tooltipFleet) tooltipFleet.remove();
        };
    });
    
    // Metric card configurations
    $: metricCards = [
        {
            title: 'Critical Issues',
            value: dashboardStats?.criticalIssues?.total || 0,
            icon: CircleAlert,
            iconBg: '#FEF3F2',
            iconColor: '#B42318',
            details: [
                { label: 'CPU Load', value: dashboardStats?.criticalIssues?.cpuLoad || 0 },
                { label: 'Memory', value: dashboardStats?.criticalIssues?.memory || 0 },
                { label: 'Storage', value: dashboardStats?.criticalIssues?.storage || 0 },
                { label: 'Network', value: dashboardStats?.criticalIssues?.network || 0 },
                { label: 'Update', value: dashboardStats?.criticalIssues?.update || 0 }
            ]
        },
        {
            title: 'Warnings',
            value: dashboardStats?.warnings?.total || 0,
            icon: TriangleAlert,
            iconBg: '#FFFAEB',
            iconColor: '#B54708',
            details: [
                { label: 'CPU', value: dashboardStats?.warnings?.cpu || 0 },
                { label: 'Memory', value: dashboardStats?.warnings?.memory || 0 },
                { label: 'Storage', value: dashboardStats?.warnings?.storage || 0 },
                { label: 'Network', value: dashboardStats?.warnings?.network || 0 }
            ]
        },
        {
            title: 'Healthy',
            value: dashboardStats?.healthy?.total || 0,
            icon: BadgeCheck,
            iconBg: '#ECFDF3',
            iconColor: '#027A48',
            description: 'Devices operating normally within all thresholds',
            trend: {
                direction: 'up',
                value: dashboardStats?.healthy?.trend || 0,
                label: 'last month'
            }
        },
        {
            title: 'Offline',
            value: dashboardStats?.offline?.total || 0,
            icon: WifiOff,
            iconBg: '#FAFAFA',
            iconColor: '#424242',
            progress: {
                label: 'Last 24 hrs',
                incidents: dashboardStats?.offline?.incidents || 0,
                percentage: dashboardStats?.offline?.percentage || 0
            },
            trend: {
                direction: 'down',
                value: dashboardStats?.offline?.trend || 0,
                label: 'last month'
            }
        }
    ];
</script>

<div class="dashboard-page">
    <div class="dashboard-grid">
        <!-- Main Column (Left) -->
        <div class="main-column">
            <!-- Row 1: First 3 Metric Cards -->
            <div class="metrics-row">
                {#each metricCards.slice(0, 3) as card}
                    <div class="metric-card">
                        <!-- Header -->
                        <div class="metric-header">
                            <span class="metric-title">{card.title}</span>
                            <div class="metric-icon" style="background-color: {card.iconBg};">
                                <svelte:component this={card.icon} size={20} color={card.iconColor} />
                            </div>
                        </div>
                        
                        <!-- Value -->
                        <div class="metric-value">{formatNumber(card.value)}</div>
                        
                        <!-- Description (for Healthy card) -->
                        {#if card.description}
                            <p class="metric-description">{card.description}</p>
                        {/if}
                        
                        <!-- Progress (for Offline card) -->
                        {#if card.progress}
                            <div class="metric-progress-section">
                                <div class="progress-labels">
                                    <span class="progress-label">{card.progress.label}</span>
                                    <span class="progress-incidents">{card.progress.incidents} incidents</span>
                                </div>
                                <ProgressBar 
                                    value={card.progress.percentage} 
                                    size="sm" 
                                    color="gray"
                                    showThumb={false}
                                />
                            </div>
                        {/if}
                        
                        <!-- Divider -->
                        <div class="metric-divider"></div>
                        
                        <!-- Details list -->
                        {#if card.details}
                            <div class="metric-details">
                                {#each card.details as detail}
                                    <div class="detail-row">
                                        <span class="detail-label">{detail.label}</span>
                                        <span class="detail-value">{detail.value}</span>
                                    </div>
                                {/each}
                            </div>
                        {/if}
                        
                        <!-- Trend badge -->
                        {#if card.trend}
                            <div class="metric-trend">
                                <div class="trend-badge" class:trend-up={card.trend.direction === 'up'} class:trend-down={card.trend.direction === 'down'}>
                                    {#if card.trend.direction === 'up'}
                                        <TrendingUp size={18} />
                                    {:else}
                                        <TrendingDown size={18} />
                                    {/if}
                                    <span>{card.trend.value} %</span>
                                </div>
                                <span class="trend-label">{card.trend.label}</span>
                            </div>
                        {/if}
                    </div>
                {/each}
            </div>
            
            <!-- Row 2: Issues by Categories Chart -->
            <div class="chart-card-wrapper">
                <div class="chart-card">
                    <div class="chart-header">
                        <div class="chart-header-content">
                            <h3 class="chart-title">Issues by Categories</h3>
                            <p class="chart-subtitle">Track your issues by category in current year and compare to others</p>
                        </div>
                        <div class="year-selector">
                            <Button 
                                variant="outline" 
                                color="gray" 
                                size="md"
                                icon={CalendarDays}
                                iconPosition="right"
                                on:click={() => showYearDropdown1 = !showYearDropdown1}
                            >
                                {selectedYear}
                            </Button>
                            {#if showYearDropdown1}
                                <div class="year-dropdown">
                                    {#each yearOptions as year}
                                        <button 
                                            class="year-option" 
                                            class:selected={selectedYear === parseInt(year.id)}
                                            on:click={() => handleYearChange(year.id)}
                                        >
                                            {year.label}
                                        </button>
                                    {/each}
                                </div>
                            {/if}
                        </div>
                    </div>
                    <div class="chart-container">
                        <canvas bind:this={issuesCategoriesCanvas}></canvas>
                    </div>
                    <div class="chart-legend">
                        <div class="legend-item">
                            <span class="legend-dot" style="background-color: {chartColors.cpuOverload};"></span>
                            <span class="legend-label">CPU Overload</span>
                        </div>
                        <div class="legend-item">
                            <span class="legend-dot" style="background-color: {chartColors.memoryCritical};"></span>
                            <span class="legend-label">Memory Critical</span>
                        </div>
                        <div class="legend-item">
                            <span class="legend-dot" style="background-color: {chartColors.storageLow};"></span>
                            <span class="legend-label">Storage Low</span>
                        </div>
                        <div class="legend-item">
                            <span class="legend-dot" style="background-color: {chartColors.networkUnstable};"></span>
                            <span class="legend-label">Network Unstable</span>
                        </div>
                        <div class="legend-item">
                            <span class="legend-dot" style="background-color: {chartColors.updateFailed};"></span>
                            <span class="legend-label">Update Failed</span>
                        </div>
                        <div class="legend-item">
                            <span class="legend-dot" style="background-color: {chartColors.offline};"></span>
                            <span class="legend-label">Offline</span>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Row 3: Fleet Health Trends Chart -->
            <div class="chart-card-wrapper">
                <div class="chart-card">
                    <div class="chart-header">
                        <div class="chart-header-content">
                            <h3 class="chart-title">Fleet Health Trends</h3>
                            <p class="chart-subtitle">Track your fleet health trends in current year and compare to others</p>
                        </div>
                        <div class="year-selector">
                            <Button 
                                variant="outline" 
                                color="gray" 
                                size="md"
                                icon={CalendarDays}
                                iconPosition="right"
                                on:click={() => showYearDropdown2 = !showYearDropdown2}
                            >
                                {selectedYear}
                            </Button>
                            {#if showYearDropdown2}
                                <div class="year-dropdown">
                                    {#each yearOptions as year}
                                        <button 
                                            class="year-option" 
                                            class:selected={selectedYear === parseInt(year.id)}
                                            on:click={() => handleYearChange(year.id)}
                                        >
                                            {year.label}
                                        </button>
                                    {/each}
                                </div>
                            {/if}
                        </div>
                    </div>
                    <div class="chart-container">
                        <canvas bind:this={fleetHealthCanvas}></canvas>
                    </div>
                    <div class="chart-legend chart-legend-4">
                        <div class="legend-item">
                            <span class="legend-dot" style="background-color: {chartColors.cpuOverload};"></span>
                            <span class="legend-label">CPU Overload</span>
                        </div>
                        <div class="legend-item">
                            <span class="legend-dot" style="background-color: {chartColors.networkUnstable};"></span>
                            <span class="legend-label">Network Unstable</span>
                        </div>
                        <div class="legend-item">
                            <span class="legend-dot" style="background-color: {chartColors.updateFailed};"></span>
                            <span class="legend-label">Update Failed</span>
                        </div>
                        <div class="legend-item">
                            <span class="legend-dot" style="background-color: {chartColors.offline};"></span>
                            <span class="legend-label">Offline</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- Side Column (Right) -->
        <div class="side-column">
            <!-- Row 1: Offline Card -->
            {#if metricCards[3]}
                {@const card = metricCards[3]}
                <div class="metric-card">
                    <!-- Header -->
                    <div class="metric-header">
                        <span class="metric-title">{card.title}</span>
                        <div class="metric-icon" style="background-color: {card.iconBg};">
                            <svelte:component this={card.icon} size={20} color={card.iconColor} />
                        </div>
                    </div>
                    
                    <!-- Value -->
                    <div class="metric-value">{formatNumber(card.value)}</div>
                    
                    <!-- Progress (for Offline card) -->
                    {#if card.progress}
                        <div class="metric-progress-section">
                            <div class="progress-labels">
                                <span class="progress-label">{card.progress.label}</span>
                                <span class="progress-incidents">{card.progress.incidents} incidents</span>
                            </div>
                            <ProgressBar 
                                value={card.progress.percentage} 
                                size="sm" 
                                color="gray"
                                showThumb={false}
                            />
                        </div>
                    {/if}
                    
                    <!-- Divider -->
                    <div class="metric-divider"></div>
                    
                    <!-- Trend badge -->
                    {#if card.trend}
                        <div class="metric-trend">
                            <div class="trend-badge" class:trend-up={card.trend.direction === 'up'} class:trend-down={card.trend.direction === 'down'}>
                                {#if card.trend.direction === 'up'}
                                    <TrendingUp size={18} />
                                {:else}
                                    <TrendingDown size={18} />
                                {/if}
                                <span>{card.trend.value} %</span>
                            </div>
                            <span class="trend-label">{card.trend.label}</span>
                        </div>
                    {/if}
                </div>
            {/if}
            
            <!-- Row 2: Total Devices Card -->
            <div class="stats-card">
                <div class="stats-header">
                    <span class="stats-title">Total Devices</span>
                    <div class="stats-icon" style="background-color: #F0F9FF;">
                        <HardDriveUpload size={20} color="#026AA2" />
                    </div>
                </div>
                <div class="stats-value">{formatNumber(dashboardStats?.totalDevices || 0)}</div>
                <div class="stats-divider"></div>
                <div class="stats-details">
                    {#each devicesByOS || [] as osItem}
                        <div class="stats-detail-row">
                            <span class="stats-detail-label">{osItem.name}</span>
                            <span class="stats-detail-value">{formatNumber(osItem.count)}</span>
                        </div>
                    {/each}
                </div>
            </div>
            
            <!-- Row 3: Recent Events Card -->
            <div class="events-card">
            <h3 class="events-title">Recent Events</h3>
            <div class="events-divider"></div>
            <div class="events-list">
                {#each recentEvents || [] as event}
                    <div class="event-item">
                        <span class="event-device">{event.deviceName}</span>
                        <span class="event-description">{event.description}</span>
                        <span class="event-time">{formatRelativeTime(event.createdAt)}</span>
                    </div>
                {/each}
                {#if !recentEvents || recentEvents.length === 0}
                    <div class="event-item">
                        <span class="event-device">&lt;Device Name&gt;</span>
                        <span class="event-description">&lt;Event Description&gt;</span>
                        <span class="event-time">0 seconds ago</span>
                    </div>
                {/if}
            </div>
                <button class="view-more-btn" on:click={() => goto('/user/logs')}>
                    <span>View More</span>
                    <ArrowRight size={20} />
                </button>
            </div>
        </div>
    </div>
</div>

<style>
    /* ========== Custom Chart Tooltip (Global) ========== */
    :global(.chartjs-custom-tooltip) {
        opacity: 0;
        pointer-events: none;
        position: fixed;
        z-index: 9999;
        transition: opacity 0.15s ease;
    }
    
    :global(.chartjs-custom-tooltip .tooltip-content) {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        padding: 12px;
        gap: 6px;
        background: #292929;
        border-radius: 8px;
        box-shadow: 0px 12px 16px -4px rgba(16, 24, 40, 0.08), 0px 4px 6px -2px rgba(16, 24, 40, 0.03);
        min-width: 200px;
    }
    
    :global(.chartjs-custom-tooltip .tooltip-title) {
        font-family: 'Poppins', sans-serif;
        font-weight: 600;
        font-size: 12px;
        line-height: 16px;
        letter-spacing: 0.01em;
        color: #FFFFFF;
        margin-bottom: 2px;
    }
    
    :global(.chartjs-custom-tooltip .tooltip-row) {
        display: flex;
        flex-direction: row;
        justify-content: space-between;
        align-items: center;
        width: 100%;
        gap: 16px;
    }
    
    :global(.chartjs-custom-tooltip .tooltip-label) {
        font-family: 'Poppins', sans-serif;
        font-weight: 400;
        font-size: 12px;
        line-height: 16px;
        letter-spacing: 0.01em;
        color: #D6D6D6;
    }
    
    :global(.chartjs-custom-tooltip .tooltip-value) {
        font-family: 'Poppins', sans-serif;
        font-weight: 600;
        font-size: 12px;
        line-height: 16px;
        letter-spacing: 0.01em;
        color: #F5F5F5;
    }
    
    :global(.chartjs-custom-tooltip .tooltip-arrow) {
        position: absolute;
        width: 12px;
        height: 12px;
        left: 50%;
        bottom: -5px;
        margin-left: -6px;
        background: #292929;
        border-radius: 1px;
        transform: rotate(45deg);
    }
    
    .dashboard-page {
        padding: 24px;
        font-family: var(--ds-font-family-primary, 'Poppins', sans-serif);
    }
    
    /* ========== Dashboard Grid (2 Columns) ========== */
    .dashboard-grid {
        display: grid;
        grid-template-columns: 1fr 252px;
        gap: 16px;
        width: 100%;
    }
    
    .main-column {
        display: flex;
        flex-direction: column;
        gap: 16px;
        min-width: 0;
    }
    
    .side-column {
        display: flex;
        flex-direction: column;
        gap: 16px;
    }
    
    /* Side column card heights - must match main column rows */
    .side-column > .metric-card {
        height: 286px; /* Match metrics row height */
        flex-shrink: 0;
    }
    
    .side-column > .stats-card {
        height: 423px; /* Match chart 1 height */
        flex-shrink: 0;
    }
    
    .side-column > .events-card {
        height: 423px; /* Match chart 2 height */
        flex-shrink: 0;
    }
    
    /* ========== Metrics Row ========== */
    .metrics-row {
        display: flex;
        flex-direction: row;
        align-items: stretch;
        height: 286px; /* Fixed height to match Offline card */
        padding: 0;
        gap: 16px;
        width: 100%;
    }
    
    .metric-card {
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        padding: 16px 24px;
        gap: 8px;
        flex: 1;
        min-width: 0;
        height: 100%; /* Fill row height */
        background: #FFFFFF;
        border: 1px solid #E5E5E5;
        border-radius: 12px;
    }
    
    .metric-header {
        display: flex;
        flex-direction: row;
        justify-content: space-between;
        align-items: flex-start;
        padding: 0;
        gap: 24px;
        width: 100%;
        height: 36px;
    }
    
    .metric-title {
        font-family: var(--ds-font-family-primary, 'Poppins', sans-serif);
        font-weight: 600;
        font-size: 16px;
        line-height: 24px;
        color: #737373;
    }
    
    .metric-icon {
        display: flex;
        flex-direction: row;
        justify-content: center;
        align-items: center;
        padding: 8px;
        gap: 8px;
        width: 36px;
        height: 36px;
        border-radius: 8px;
    }
    
    .metric-value {
        font-family: var(--ds-font-family-primary, 'Poppins', sans-serif);
        font-weight: 600;
        font-size: 30px;
        line-height: 38px;
        color: #101828;
    }
    
    .metric-description {
        font-family: var(--ds-font-family-primary, 'Poppins', sans-serif);
        font-weight: 400;
        font-size: 12px;
        line-height: 16px;
        letter-spacing: 0.01em;
        color: #737373;
        width: 100%;
    }
    
    .metric-progress-section {
        display: flex;
        flex-direction: column;
        gap: 8px;
        width: 100%;
    }
    
    .progress-labels {
        display: flex;
        flex-direction: row;
        justify-content: space-between;
        align-items: flex-start;
        width: 100%;
    }
    
    .progress-label {
        font-family: var(--ds-font-family-primary, 'Poppins', sans-serif);
        font-weight: 400;
        font-size: 12px;
        line-height: 16px;
        letter-spacing: 0.01em;
        color: #737373;
    }
    
    .progress-incidents {
        font-family: var(--ds-font-family-primary, 'Poppins', sans-serif);
        font-weight: 500;
        font-size: 12px;
        line-height: 16px;
        letter-spacing: 0.01em;
        color: #292929;
    }
    
    .metric-divider {
        display: flex;
        flex-direction: row;
        justify-content: center;
        align-items: flex-start;
        padding: 2px 0;
        width: 100%;
        height: 4px;
    }
    
    .metric-divider::after {
        content: '';
        width: 100%;
        height: 0;
        border: 1px solid #E5E5E5;
        flex: 1;
    }
    
    .metric-details {
        display: flex;
        flex-direction: column;
        gap: 0;
        width: 100%;
        flex: 1;
    }
    
    .detail-row {
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: space-between;
        padding: 0;
        gap: 16px;
        width: 100%;
        height: 24px;
    }
    
    .detail-label {
        display: flex;
        flex-direction: row;
        align-items: center;
        padding: 2px;
        font-family: var(--ds-font-family-primary, 'Poppins', sans-serif);
        font-weight: 400;
        font-size: 14px;
        line-height: 20px;
        color: #525252;
    }
    
    .detail-value {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        font-family: var(--ds-font-family-primary, 'Poppins', sans-serif);
        font-weight: 500;
        font-size: 16px;
        line-height: 24px;
        text-align: right;
        color: #141414;
        flex: 1;
    }
    
    .metric-trend {
        display: flex;
        flex-direction: row;
        align-items: center;
        padding: 0;
        gap: 8px;
        margin-top: auto;
    }
    
    .trend-badge {
        display: inline-flex;
        flex-direction: row;
        align-items: center;
        padding: 6px 12px;
        gap: 8px;
        border-radius: 16px;
        font-family: var(--ds-font-family-primary, 'Poppins', sans-serif);
        font-weight: 500;
        font-size: 14px;
        line-height: 20px;
        mix-blend-mode: multiply;
    }
    
    .trend-badge.trend-up {
        background: #ECFDF3;
        color: #027A48;
    }
    
    .trend-badge.trend-down {
        background: #FEF3F2;
        color: #B42318;
    }
    
    .trend-label {
        font-family: var(--ds-font-family-primary, 'Poppins', sans-serif);
        font-weight: 400;
        font-size: 14px;
        line-height: 20px;
        text-align: center;
        color: #737373;
    }
    
    /* ========== Chart Card ========== */
    .chart-card-wrapper {
        box-sizing: border-box;
        min-width: 0;
        height: 423px;
        background: #FFFFFF;
        border: 1px solid #E5E5E5;
        border-radius: 8px;
        overflow: hidden;
    }
    
    .chart-card {
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        padding: 0;
        width: 100%;
        height: 100%;
        background: #FFFFFF;
    }
    
    .chart-header {
        display: flex;
        flex-direction: row;
        justify-content: space-between;
        align-items: center;
        padding: 12px 24px;
        gap: 8px;
        width: 100%;
        height: 70px;
        box-sizing: border-box;
    }
    
    .chart-header-content {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        padding: 0;
        gap: 2px;
        flex: 1;
        height: 46px;
    }
    
    .chart-title {
        font-family: var(--ds-font-family-primary, 'Poppins', sans-serif);
        font-weight: 500;
        font-size: 16px;
        line-height: 24px;
        color: #141414;
        margin: 0;
    }
    
    .chart-subtitle {
        font-family: var(--ds-font-family-primary, 'Poppins', sans-serif);
        font-weight: 400;
        font-size: 14px;
        line-height: 20px;
        color: #475467;
        margin: 0;
    }
    
    .chart-container {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        padding: 0 16px 0 0;
        width: 100%;
        height: 265px;
        box-sizing: border-box;
        flex: 1;
    }
    
    .chart-container canvas {
        width: 100% !important;
        height: 100% !important;
    }
    
    .chart-legend {
        display: flex;
        flex-direction: row;
        flex-wrap: wrap;
        justify-content: center;
        align-items: flex-start;
        align-content: center;
        padding: 0 64px 16px 64px;
        gap: 8px 32px;
        width: 100%;
        height: 56px;
        box-sizing: border-box;
    }
    
    .chart-legend-4 {
        height: 40px;
    }
    
    .legend-item {
        display: flex;
        flex-direction: row;
        align-items: center;
        padding: 0;
        gap: 8px;
        height: 16px;
    }
    
    .legend-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
    }
    
    .legend-label {
        font-family: var(--ds-font-family-primary, 'Poppins', sans-serif);
        font-weight: 400;
        font-size: 12px;
        line-height: 16px;
        letter-spacing: 0.01em;
        color: #525252;
    }
    
    /* ========== Stats Card ========== */
    .stats-card {
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        padding: 16px 24px;
        gap: 8px;
        width: 100%;
        background: #FFFFFF;
        border: 1px solid #E5E5E5;
        border-radius: 12px;
        overflow: hidden;
    }
    
    .stats-header {
        display: flex;
        flex-direction: row;
        justify-content: space-between;
        align-items: flex-start;
        padding: 0;
        gap: 24px;
        width: 100%;
        height: 36px;
    }
    
    .stats-title {
        font-family: var(--ds-font-family-primary, 'Poppins', sans-serif);
        font-weight: 600;
        font-size: 16px;
        line-height: 24px;
        color: #737373;
    }
    
    .stats-icon {
        display: flex;
        flex-direction: row;
        justify-content: center;
        align-items: center;
        padding: 8px;
        gap: 8px;
        width: 36px;
        height: 36px;
        border-radius: 8px;
    }
    
    .stats-value {
        font-family: var(--ds-font-family-primary, 'Poppins', sans-serif);
        font-weight: 600;
        font-size: 30px;
        line-height: 38px;
        color: #101828;
    }
    
    .stats-divider {
        display: flex;
        flex-direction: row;
        justify-content: center;
        align-items: flex-start;
        padding: 2px 0;
        width: 100%;
        height: 4px;
    }
    
    .stats-divider::after {
        content: '';
        width: 100%;
        height: 0;
        border: 1px solid #E5E5E5;
        flex: 1;
    }
    
    .stats-details {
        display: flex;
        flex-direction: column;
        gap: 0;
        width: 100%;
        flex: 1;
        overflow-y: auto;
        min-height: 0;
    }
    
    /* Custom scrollbar for stats details */
    .stats-details::-webkit-scrollbar {
        width: 4px;
    }
    
    .stats-details::-webkit-scrollbar-track {
        background: #F5F5F5;
        border-radius: 2px;
    }
    
    .stats-details::-webkit-scrollbar-thumb {
        background: #D6D6D6;
        border-radius: 2px;
    }
    
    .stats-details::-webkit-scrollbar-thumb:hover {
        background: #A3A3A3;
    }
    
    .stats-detail-row {
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: space-between;
        padding: 0;
        gap: 16px;
        width: 100%;
        height: 24px;
    }
    
    .stats-detail-label {
        display: flex;
        flex-direction: row;
        align-items: center;
        padding: 2px;
        font-family: var(--ds-font-family-primary, 'Poppins', sans-serif);
        font-weight: 400;
        font-size: 14px;
        line-height: 20px;
        color: #525252;
    }
    
    .stats-detail-value {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        flex: 1;
        font-family: var(--ds-font-family-primary, 'Poppins', sans-serif);
        font-weight: 500;
        font-size: 16px;
        line-height: 24px;
        text-align: right;
        color: #141414;
    }
    
    /* ========== Events Card ========== */
    .events-card {
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        padding: 16px 24px;
        gap: 8px;
        width: 100%;
        background: #FFFFFF;
        border: 1px solid #E5E5E5;
        border-radius: 12px;
        position: relative;
        overflow: hidden;
    }
    
    .events-title {
        font-family: var(--ds-font-family-primary, 'Poppins', sans-serif);
        font-weight: 600;
        font-size: 16px;
        line-height: 24px;
        color: #737373;
        margin: 0;
    }
    
    .events-divider {
        width: 100%;
        height: 0;
        border: 1px solid #E5E5E5;
        margin: 2px 0;
    }
    
    .events-list {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        padding: 0;
        gap: 8px;
        width: 100%;
        flex: 1;
        overflow-y: auto;
        min-height: 0; /* Allow flex child to shrink and enable scroll */
    }
    
    /* Custom scrollbar for events list */
    .events-list::-webkit-scrollbar {
        width: 4px;
    }
    
    .events-list::-webkit-scrollbar-track {
        background: #F5F5F5;
        border-radius: 2px;
    }
    
    .events-list::-webkit-scrollbar-thumb {
        background: #D6D6D6;
        border-radius: 2px;
    }
    
    .events-list::-webkit-scrollbar-thumb:hover {
        background: #A3A3A3;
    }
    
    .event-item {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        padding: 8px 0;
        gap: 4px;
        width: 100%;
        border-radius: 8px;
    }
    
    .event-device {
        font-family: var(--ds-font-family-primary, 'Poppins', sans-serif);
        font-weight: 400;
        font-size: 14px;
        line-height: 20px;
        color: #525252;
    }
    
    .event-description {
        font-family: var(--ds-font-family-primary, 'Poppins', sans-serif);
        font-weight: 500;
        font-size: 16px;
        line-height: 24px;
        color: #141414;
    }
    
    .event-time {
        font-family: var(--ds-font-family-primary, 'Poppins', sans-serif);
        font-weight: 400;
        font-size: 12px;
        line-height: 16px;
        letter-spacing: 0.01em;
        color: #737373;
    }
    
    .view-more-btn {
        display: flex;
        flex-direction: row;
        justify-content: center;
        align-items: center;
        padding: 10px 16px;
        gap: 8px;
        width: 100%;
        min-width: 100px;
        height: 40px;
        background: transparent;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        font-family: var(--ds-font-family-primary, 'Poppins', sans-serif);
        font-weight: 500;
        font-size: 14px;
        line-height: 20px;
        color: #026AA2;
        transition: background-color 0.2s ease;
    }
    
    .view-more-btn:hover {
        background-color: #F0F9FF;
    }
    
    /* ========== Year Selector Dropdown ========== */
    .year-selector {
        position: relative;
    }
    
    .year-dropdown {
        position: absolute;
        top: 100%;
        right: 0;
        margin-top: 4px;
        background: #FFFFFF;
        border: 1px solid #E5E5E5;
        border-radius: 8px;
        box-shadow: 0px 4px 6px -2px rgba(16, 24, 40, 0.03), 0px 12px 16px -4px rgba(16, 24, 40, 0.08);
        z-index: 100;
        min-width: 100px;
        overflow: hidden;
    }
    
    .year-option {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        padding: 10px 16px;
        background: transparent;
        border: none;
        cursor: pointer;
        font-family: var(--ds-font-family-primary, 'Poppins', sans-serif);
        font-weight: 500;
        font-size: 14px;
        line-height: 20px;
        color: #424242;
        transition: background-color 0.15s ease;
    }
    
    .year-option:hover {
        background-color: #F5F5F5;
    }
    
    .year-option.selected {
        background-color: #F0F9FF;
        color: #026AA2;
    }
    
    /* ========== Responsive ========== */
    @media (max-width: 1200px) {
        .dashboard-grid {
            grid-template-columns: 1fr 220px;
        }
    }
    
    @media (max-width: 1000px) {
        .dashboard-grid {
            display: flex;
            flex-direction: column;
            gap: 16px;
        }
        
        .side-column > .metric-card,
        .side-column > .stats-card,
        .side-column > .events-card {
            height: auto;
            min-height: 280px;
        }
        
        .chart-card-wrapper {
            height: 423px;
        }
    }
    
    @media (max-width: 768px) {
        .dashboard-page {
            padding: 16px;
        }
        
        .metrics-row {
            flex-wrap: wrap;
        }
        
        .metric-card {
            flex: 1 1 100%;
            height: auto;
            min-height: 200px;
        }
        
        .chart-card-wrapper {
            height: auto;
        }
        
        .chart-card {
            height: auto;
            min-height: 350px;
        }
        
        .chart-container {
            height: 200px;
        }
    }
</style>
