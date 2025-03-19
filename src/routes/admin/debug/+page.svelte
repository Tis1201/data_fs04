<!-- Debug landing page -->
<script lang="ts">
    import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '$lib/components/ui/breadcrumb';
    import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '$lib/components/ui/card';
    import { Button } from '$lib/components/ui/button';
    import { Cpu, Video, Radio, Zap } from 'lucide-svelte';
</script>

<div class="space-y-6">
    <Breadcrumb>
        <BreadcrumbList>
            <BreadcrumbItem>
                <a href="/admin" class="text-sm font-medium underline-offset-4 hover:underline">Admin</a>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
                <BreadcrumbPage>Debug</BreadcrumbPage>
            </BreadcrumbItem>
        </BreadcrumbList>
    </Breadcrumb>

    <div class="flex justify-between items-center">
        <div>
            <h2 class="text-3xl font-bold tracking-tight">Debug Tools</h2>
            <p class="text-muted-foreground">System monitoring and debugging utilities</p>
        </div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card>
            <CardHeader>
                <CardTitle class="flex items-center gap-2">
                    <Video class="h-5 w-5" />
                    <span>VPU Debug</span>
                </CardTitle>
                <CardDescription>Video Processing Unit diagnostics</CardDescription>
            </CardHeader>
            <CardContent>
                <p class="text-sm text-muted-foreground">
                    Monitor and troubleshoot video processing operations, stream status, and encoding performance.
                </p>
            </CardContent>
            <CardFooter>
                <Button variant="outline" asChild>
                    <a href="/admin/debug/vpu">Open VPU Debug</a>
                </Button>
            </CardFooter>
        </Card>

        <Card>
            <CardHeader>
                <CardTitle class="flex items-center gap-2">
                    <Cpu class="h-5 w-5" />
                    <span>NPU Debug</span>
                </CardTitle>
                <CardDescription>Neural Processing Unit diagnostics</CardDescription>
            </CardHeader>
            <CardContent>
                <p class="text-sm text-muted-foreground">
                    Analyze AI model performance, inference times, and resource utilization.
                </p>
            </CardContent>
            <CardFooter>
                <Button variant="outline" asChild>
                    <a href="/admin/debug/npu">Open NPU Debug</a>
                </Button>
            </CardFooter>
        </Card>

        <Card>
            <CardHeader>
                <CardTitle class="flex items-center gap-2">
                    <Zap class="h-5 w-5" />
                    <span>WebSocket Debug</span>
                </CardTitle>
                <CardDescription>WebSocket connection testing</CardDescription>
            </CardHeader>
            <CardContent>
                <p class="text-sm text-muted-foreground">
                    Test and monitor WebSocket connections, message passing, and real-time communication.
                </p>
            </CardContent>
            <CardFooter>
                <Button variant="outline" asChild>
                    <a href="/admin/debug/websocket">Open WebSocket Debug</a>
                </Button>
            </CardFooter>
        </Card>
    </div>
</div>
