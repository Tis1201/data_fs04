<script lang="ts">
    import { Monitor, CheckCircle2, Power } from "lucide-svelte";
    
    export let stats: {
        total: {
            total: number;
            android: number;
            linux: number;
            windows: number;
            apple: number;
        };
        online: {
            total: number;
            android: number;
            linux: number;
            windows: number;
            apple: number;
        };
        offline: {
            total: number;
            android: number;
            linux: number;
            windows: number;
            apple: number;
        };
    };
    
    const formatNumber = (num: number): string => {
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    };
</script>

<div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
    <!-- Total Devices Panel -->
    <div class="bg-gradient-to-br from-orange-50 to-orange-100 border-2 border-orange-200 rounded-lg p-6 shadow-lg">
        <div class="flex items-center justify-between mb-4">
            <div class="flex items-center space-x-3">
                <div class="p-2 bg-orange-200 rounded-lg">
                    <Monitor class="h-6 w-6 text-orange-700" />
                </div>
                <h3 class="text-lg font-bold text-orange-900">TOTAL DEVICES</h3>
            </div>
        </div>
        <div class="space-y-2">
            <div class="flex items-center justify-between">
                <span class="text-sm font-medium text-orange-800">Total</span>
                <span class="text-3xl font-bold text-orange-900">{formatNumber(stats.total.total)}</span>
            </div>
            <div class="flex items-center justify-between">
                <img src="/icons/os/android.svg" alt="Android" class="h-15 w-16" />
                <span class="text-lg font-bold text-orange-900">{formatNumber(stats.total.android)}</span>
            </div>
            <div class="flex items-center justify-between">
                <img src="/icons/os/linux.svg" alt="Linux" class="h-7 w-7" />
                <span class="text-lg font-bold text-orange-900">{formatNumber(stats.total.linux)}</span>
            </div>
            <div class="flex items-center justify-between">
                <img src="/icons/os/windows.svg" alt="Windows" class="h-15 w-20" />
                <span class="text-lg font-bold text-orange-900">{formatNumber(stats.total.windows)}</span>
            </div>
            <div class="flex items-center justify-between">
                <img src="/icons/os/apple.svg" alt="Apple" class="h-7 w-7" />
                <span class="text-lg font-bold text-orange-900">{formatNumber(stats.total.apple)}</span>
            </div>
        </div>
    </div>

    <!-- Online Devices Panel -->
    <div class="bg-gradient-to-br from-green-50 to-green-100 border-2 border-green-200 rounded-lg p-6 shadow-lg">
        <div class="flex items-center justify-between mb-4">
            <div class="flex items-center space-x-3">
                <div class="p-2 bg-green-200 rounded-lg">
                    <CheckCircle2 class="h-6 w-6 text-green-700" />
                </div>
                <h3 class="text-lg font-bold text-green-900">ONLINE</h3>
            </div>
        </div>
        <div class="space-y-2">
            <div class="flex items-center justify-between">
                <span class="text-sm font-medium text-green-800">Total</span>
                <span class="text-3xl font-bold text-green-900">{formatNumber(stats.online.total)}</span>
            </div>
            <div class="flex items-center justify-between">
                <img src="/icons/os/android.svg" alt="Android" class="h-15 w-16" />
                <span class="text-lg font-bold text-green-900">{formatNumber(stats.online.android)}</span>
            </div>
            <div class="flex items-center justify-between">
                <img src="/icons/os/linux.svg" alt="Linux" class="h-7 w-7" />
                <span class="text-lg font-bold text-green-900">{formatNumber(stats.online.linux)}</span>
            </div>
            <div class="flex items-center justify-between">
                <img src="/icons/os/windows.svg" alt="Windows" class="h-15 w-20" />
                <span class="text-lg font-bold text-green-900">{formatNumber(stats.online.windows)}</span>
            </div>
            <div class="flex items-center justify-between">
                <img src="/icons/os/apple.svg" alt="Apple" class="h-7 w-7" />
                <span class="text-lg font-bold text-green-900">{formatNumber(stats.online.apple)}</span>
            </div>
        </div>
    </div>

    <!-- Offline Devices Panel -->
    <div class="bg-gradient-to-br from-red-50 to-red-100 border-2 border-red-200 rounded-lg p-6 shadow-lg">
        <div class="flex items-center justify-between mb-4">
            <div class="flex items-center space-x-3">
                <div class="p-2 bg-red-200 rounded-lg">
                    <Power class="h-6 w-6 text-red-700" />
                </div>
                <h3 class="text-lg font-bold text-red-900">OFFLINE</h3>
            </div>
        </div>
        <div class="space-y-2">
            <div class="flex items-center justify-between">
                <span class="text-sm font-medium text-red-800">Total</span>
                <span class="text-3xl font-bold text-red-900">{formatNumber(stats.offline.total)}</span>
            </div>
            <div class="flex items-center justify-between">
                <img src="/icons/os/android.svg" alt="Android" class="h-15 w-16" />
                <span class="text-lg font-bold text-red-900">{formatNumber(stats.offline.android)}</span>
            </div>
            <div class="flex items-center justify-between">
                <img src="/icons/os/linux.svg" alt="Linux" class="h-7 w-7" />
                <span class="text-lg font-bold text-red-900">{formatNumber(stats.offline.linux)}</span>
            </div>
            <div class="flex items-center justify-between">
                <img src="/icons/os/windows.svg" alt="Windows" class="h-15 w-20" />
                <span class="text-lg font-bold text-red-900">{formatNumber(stats.offline.windows)}</span>
            </div>
            <div class="flex items-center justify-between">
                <img src="/icons/os/apple.svg" alt="Apple" class="h-7 w-7" />
                <span class="text-lg font-bold text-red-900">{formatNumber(stats.offline.apple)}</span>
            </div>
        </div>
    </div>
</div>

