<script lang="ts">
    import { page } from "$app/stores";
    import { goto } from "$app/navigation";
    import { Building2, Mail, Phone, Globe, MapPin, CreditCard, Bell, Shield, Key } from "lucide-svelte";
    import UserPageLayout from "$lib/components/user/layout/UserPageLayout.svelte";
    import UserCard from "$lib/components/user/layout/UserCard.svelte";
    import { Input } from "$lib/components/ui/input";
    import { Label } from "$lib/components/ui/label";
    import { Tabs, TabsContent, TabsList, TabsTrigger } from "$lib/components/ui/tabs";
    import { Switch } from "$lib/components/ui/switch";
    
    // Define page metadata
    const pageTitle = "Account Settings";
    
    // Define breadcrumbs
    const pageCrumbs = [
        ["Dashboard", "/user/dashboard"],
        ["Settings", "/user/settings"],
        ["Account", ""]
    ] as [string, string][];
    
    // Mock data for the placeholder
    let accountData = {
        company: {
            name: "Acme Inc.",
            email: "contact@acme.com",
            phone: "+1 (555) 123-4567",
            website: "acme.com",
            address: "123 Business St, Tech City, 10001"
        },
        billing: {
            plan: "Pro",
            status: "Active",
            nextBilling: "June 19, 2025",
            paymentMethod: "•••• •••• •••• 4242"
        },
        notifications: {
            email: true,
            sms: false,
            newsletter: true,
            security: true
        },
        security: {
            twoFactor: true,
            lastLogin: "2 hours ago",
            devices: [
                { id: 1, name: "MacBook Pro", location: "San Francisco, CA", lastUsed: "Now" },
                { id: 2, name: "iPhone 13", location: "San Francisco, CA", lastUsed: "30 minutes ago" }
            ]
        }
    };
    
    let activeTab = 'company';
    let editMode = {
        company: false,
        billing: false,
        notifications: false,
        security: false
    };
    
    function toggleEdit(section: string) {
        editMode[section] = !editMode[section];
    }
    
    function saveChanges(section: string) {
        // In a real app, you would save changes to your backend here
        editMode[section] = false;
        // Show success message
        alert('Changes saved successfully');
    }
</script>

<UserPageLayout 
    title={pageTitle}
    crumbs={pageCrumbs}
>
    <Tabs bind:value={activeTab} class="space-y-6">
        <TabsList class="grid w-full grid-cols-2 md:grid-cols-4">
            <TabsTrigger value="company">
                <Building2 class="h-4 w-4 mr-2" />
                Company
            </TabsTrigger>
            <TabsTrigger value="billing">
                <CreditCard class="h-4 w-4 mr-2" />
                Billing
            </TabsTrigger>
            <TabsTrigger value="notifications">
                <Bell class="h-4 w-4 mr-2" />
                Notifications
            </TabsTrigger>
            <TabsTrigger value="security">
                <Shield class="h-4 w-4 mr-2" />
                Security
            </TabsTrigger>
        </TabsList>
        
        <!-- Company Tab -->
        <TabsContent value="company" class="space-y-6">
            <UserCard 
                title="Company Information"
                description="Manage your company details"
                icon={Building2}
                action={
                    editMode.company 
                        ? `<div class='flex space-x-2'>
                            <button type='button' class='inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3' on:click={() => toggleEdit('company')}>
                                Cancel
                            </button>
                            <button type='button' class='inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground shadow hover:bg-primary/90 h-9 px-3' on:click={() => saveChanges('company')}>
                                Save Changes
                            </button>
                          </div>`
                        : `<button type='button' class='inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3' on:click={() => toggleEdit('company')}>
                            Edit
                          </button>`
                }
            >
                <div class="space-y-6">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div class="space-y-2">
                            <Label for="company-name">Company Name</Label>
                            {#if editMode.company}
                                <Input id="company-name" value={accountData.company.name} />
                            {:else}
                                <p class="text-sm font-medium">{accountData.company.name}</p>
                            {/if}
                        </div>
                        
                        <div class="space-y-2">
                            <Label for="company-email">Email</Label>
                            <div class="flex items-center">
                                <Mail class="h-4 w-4 mr-2 text-muted-foreground" />
                                {#if editMode.company}
                                    <Input id="company-email" value={accountData.company.email} type="email" />
                                {:else}
                                    <p class="text-sm font-medium">{accountData.company.email}</p>
                                {/if}
                            </div>
                        </div>
                        
                        <div class="space-y-2">
                            <Label for="company-phone">Phone</Label>
                            <div class="flex items-center">
                                <Phone class="h-4 w-4 mr-2 text-muted-foreground" />
                                {#if editMode.company}
                                    <Input id="company-phone" value={accountData.company.phone} />
                                {:else}
                                    <p class="text-sm font-medium">{accountData.company.phone}</p>
                                {/if}
                            </div>
                        </div>
                        
                        <div class="space-y-2">
                            <Label for="company-website">Website</Label>
                            <div class="flex items-center">
                                <Globe class="h-4 w-4 mr-2 text-muted-foreground" />
                                {#if editMode.company}
                                    <Input id="company-website" value={accountData.company.website} />
                                {:else}
                                    <p class="text-sm font-medium">{accountData.company.website}</p>
                                {/if}
                            </div>
                        </div>
                    </div>
                    
                    <div class="space-y-2">
                        <Label for="company-address">Address</Label>
                        <div class="flex">
                            <MapPin class="h-4 w-4 mr-2 mt-1.5 text-muted-foreground flex-shrink-0" />
                            {#if editMode.company}
                                <Input id="company-address" value={accountData.company.address} />
                            {:else}
                                <p class="text-sm font-medium">{accountData.company.address}</p>
                            {/if}
                        </div>
                    </div>
                </div>
            </UserCard>
        </TabsContent>
        
        <!-- Billing Tab -->
        <TabsContent value="billing" class="space-y-6">
            <UserCard 
                title="Billing Information"
                description="Manage your subscription and payment methods"
                icon={CreditCard}
            >
                <div class="space-y-6">
                    <div class="space-y-4">
                        <h3 class="font-medium">Current Plan</h3>
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div class="border rounded-lg p-4">
                                <p class="text-sm text-muted-foreground">Plan</p>
                                <p class="font-medium">{accountData.billing.plan}</p>
                            </div>
                            <div class="border rounded-lg p-4">
                                <p class="text-sm text-muted-foreground">Status</p>
                                <p class="font-medium">{accountData.billing.status}</p>
                            </div>
                            <div class="border rounded-lg p-4">
                                <p class="text-sm text-muted-foreground">Next Billing Date</p>
                                <p class="font-medium">{accountData.billing.nextBilling}</p>
                            </div>
                        </div>
                    </div>
                    
                    <div class="space-y-4">
                        <div class="flex justify-between items-center">
                            <h3 class="font-medium">Payment Method</h3>
                            <button type="button" class="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3">
                                Update
                            </button>
                        </div>
                        <div class="border rounded-lg p-4 flex items-center justify-between">
                            <div class="flex items-center">
                                <CreditCard class="h-5 w-5 mr-3 text-muted-foreground" />
                                <div>
                                    <p class="font-medium">Visa ending in 4242</p>
                                    <p class="text-sm text-muted-foreground">Expires 12/25</p>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="flex justify-end">
                        <button type="button" class="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3 mr-2">
                            Download Invoices
                        </button>
                        <button type="button" class="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-destructive text-destructive hover:bg-destructive/10 h-9 px-3">
                            Cancel Subscription
                        </button>
                    </div>
                </div>
            </UserCard>
        </TabsContent>
        
        <!-- Notifications Tab -->
        <TabsContent value="notifications" class="space-y-6">
            <UserCard 
                title="Notification Preferences"
                description="Manage how you receive notifications"
                icon={Bell}
                action={
                    editMode.notifications 
                        ? `
                            <div class="flex space-x-2">
                                <button type="button" class="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3" on:click={() => toggleEdit('notifications')}>
                                    Cancel
                                </button>
                                <button type="button" class="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground shadow hover:bg-primary/90 h-9 px-3" on:click={() => saveChanges('notifications')}>
                                    Save Changes
                                </button>
                            </div>
                        `
                        : `
                            <button type="button" class="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3" on:click={() => toggleEdit('notifications')}>
                                Edit
                            </button>
                        `
                }
            >
                <div class="space-y-6">
                    <div class="space-y-4">
                        <h3 class="font-medium">Email Notifications</h3>
                        <div class="space-y-4">
                            {#each Object.entries({
                                'email': 'Email',
                                'newsletter': 'Newsletter',
                                'security': 'Security Alerts'
                            }) as [key, label]}
                                <div class="flex items-center justify-between">
                                    <div>
                                        <p class="text-sm font-medium">{label}</p>
                                        <p class="text-xs text-muted-foreground">
                                            {key === 'email' ? 'Receive important account notifications' : 
                                             key === 'newsletter' ? 'Get product updates and announcements' :
                                             'Get important security notifications'}
                                        </p>
                                    </div>
                                    <Switch 
                                        checked={accountData.notifications[key]}
                                        disabled={!editMode.notifications}
                                        on:change={() => accountData.notifications[key] = !accountData.notifications[key]}
                                    />
                                </div>
                            {/each}
                        </div>
                    </div>
                </div>
            </UserCard>
        </TabsContent>
        
        <!-- Security Tab -->
        <TabsContent value="security" class="space-y-6">
            <UserCard 
                title="Security Settings"
                description="Manage your account security"
                icon={Shield}
            >
                <div class="space-y-6">
                    <div class="space-y-4">
                        <h3 class="font-medium">Two-Factor Authentication</h3>
                        <div class="flex items-center justify-between p-4 border rounded-lg">
                            <div class="flex items-center">
                                <Key class="h-5 w-5 mr-3 text-muted-foreground" />
                                <div>
                                    <p class="font-medium">
                                        {accountData.security.twoFactor ? 'Enabled' : 'Disabled'}
                                    </p>
                                    <p class="text-sm text-muted-foreground">
                                        {accountData.security.twoFactor 
                                            ? 'Add an extra layer of security to your account' 
                                            : 'Add an extra layer of security to your account'}
                                    </p>
                                </div>
                            </div>
                            <button type="button" class="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${accountData.security.twoFactor ? 'border border-input bg-background hover:bg-accent hover:text-accent-foreground' : 'bg-primary text-primary-foreground shadow hover:bg-primary/90'} h-9 px-3">
                                {accountData.security.twoFactor ? 'Manage' : 'Enable'}
                            </button>
                        </div>
                    </div>
                    
                    <div class="space-y-4">
                        <h3 class="font-medium">Active Sessions</h3>
                        <div class="space-y-2">
                            {#each accountData.security.devices as device}
                                <div class="flex items-center justify-between p-3 border rounded-lg">
                                    <div class="flex items-center">
                                        <div class="p-2 rounded-full bg-muted mr-3">
                                            <Key class="h-4 w-4" />
                                        </div>
                                        <div>
                                            <p class="font-medium">{device.name}</p>
                                            <div class="flex items-center text-xs text-muted-foreground">
                                                <MapPin class="h-3 w-3 mr-1" />
                                                {device.location} • Last used {device.lastUsed}
                                            </div>
                                        </div>
                                    </div>
                                    {#if device.lastUsed !== 'Now'}
                                        <button type="button" class="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-9 px-3">
                                            Sign out
                                        </button>
                                    {/if}
                                </div>
                            {/each}
                        </div>
                    </div>
                </div>
            </UserCard>
        </TabsContent>
    </Tabs>
</UserPageLayout>
