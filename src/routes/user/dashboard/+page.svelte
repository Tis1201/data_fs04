<script lang="ts">
    import UserPageLayout from "$lib/components/user/UserPageLayout.svelte";
    import UserCard from "$lib/components/user/UserCard.svelte";
    import { LayoutDashboard, Video, MessageSquare, Bell, Calendar } from "lucide-svelte";
    
    const pageCrumbs = [
        ["User", "/user"],
        "Dashboard"
    ];
    
    const title = "Dashboard";
</script>

<UserPageLayout title={title} crumbs={pageCrumbs}>
    <div class="space-y-6">
        <!-- Welcome Card -->
        <UserCard
            title="Welcome to Your Dashboard"
            description="Here's an overview of your recent activity and important information"
            icon={LayoutDashboard}
        >
            <p>Welcome to the FS04 user portal. This is your personalized dashboard where you can access all your content and settings.</p>
        </UserCard>
        
        <!-- Quick Access Card -->
        <UserCard
            title="Quick Access"
            description="Frequently used features and recent items"
        >
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <a href="/user/media/videos" class="flex flex-col items-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100">
                    <Video class="h-8 w-8 mb-2 text-blue-600" />
                    <span class="text-sm font-medium">Videos</span>
                </a>
                <a href="/user/communications/messages" class="flex flex-col items-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100">
                    <MessageSquare class="h-8 w-8 mb-2 text-blue-600" />
                    <span class="text-sm font-medium">Messages</span>
                </a>
                <a href="/user/communications/notifications" class="flex flex-col items-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100">
                    <Bell class="h-8 w-8 mb-2 text-blue-600" />
                    <span class="text-sm font-medium">Notifications</span>
                </a>
                <a href="/user/calendar" class="flex flex-col items-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100">
                    <Calendar class="h-8 w-8 mb-2 text-blue-600" />
                    <span class="text-sm font-medium">Calendar</span>
                </a>
            </div>
        </UserCard>
        
        <!-- Recent Activity Card -->
        <UserCard
            title="Recent Activity"
            description="Your latest actions and updates"
        >
            <p class="text-muted-foreground text-sm">No recent activity to display.</p>
        </UserCard>
    </div>
</UserPageLayout>
