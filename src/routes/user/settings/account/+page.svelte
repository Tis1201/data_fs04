<script lang="ts">
    import {invalidateAll} from "$app/navigation";
    import {Bell, Building2, CreditCard, Edit, Key, Lock, Mail, MapPin, Save, Shield, X} from "lucide-svelte";
    import UserPageLayout from "$lib/components/user/layout/UserPageLayout.svelte";
    import UserCard from "$lib/components/user/layout/UserCard.svelte";
    import RelationshipSection from '$lib/components/ui_components_sveltekit/relationships/RelationshipSection.svelte';
    import FormContainer from '$lib/components/ui_components_sveltekit/form/FormContainer.svelte';
    import AccountFormFields from '$lib/components/ui_components_sveltekit/form/AccountFormFields.svelte';
    import {Button} from "$lib/components/ui/button";
    import {Tabs, TabsContent, TabsList, TabsTrigger} from "$lib/components/ui/tabs";
    import {Switch} from "$lib/components/ui/switch";
    import {toast} from "svelte-sonner";
    import {superForm} from 'sveltekit-superforms/client';
    import {zod} from 'sveltekit-superforms/adapters';
    import RelativeDate from "$lib/components/ui_components_sveltekit/date/RelativeDate.svelte";
    import {processFormMessages} from '$lib/utils/formHelpers';
    import {canEditAccount} from '$lib/utils/permissions';
    import {notificationSchema, passwordSchema, userAccountSchema} from './schema';

    import type {PageData} from "./$types";

    export let data: PageData;
    
    // Client-side debugging
    console.log('🎯 Client-side page component loaded');
    console.log('📊 Data received from server:', {
        hasData: !!data,
        dataKeys: data ? Object.keys(data) : [],
        hasUser: !!data?.user,
        hasAccount: !!data?.account,
        hasForms: !!data?.forms,
        formsKeys: data?.forms ? Object.keys(data.forms) : [],
        hasRelationships: !!data?.relationships
    });

    // Define page metadata
    const pageTitle = "Account Settings";
    
    // Define breadcrumbs
    const pageCrumbs = [
        ["Dashboard", "/user/dashboard"],
        ["Settings", "/user/settings"],
        ["Account", ""]
    ] as [string, string][];
    
    let activeTab = 'account';
    let editMode = {
        account: false,
        notifications: false
    };
    
    // Password dialog state
    let passwordDialogOpen = false;
    
    console.log('📋 Attempting to initialize SuperForms...');
    
    // SuperForms setup - using account form for account data
    const accountForm = superForm(data.forms!.account, {
        validators: zod(userAccountSchema),
        onUpdated: ({ form }) => {
            console.log('🔄 Account form updated:', {
                messageType: form.message?.type,
                messageText: form.message?.text
            });
            if (form.message?.type === 'success') {
                toast.success(form.message.text);
                editMode.account = false;
                invalidateAll();
            } else if (form.message?.type === 'error') {
                toast.error(form.message.text);
            }
        }
    });
    
    const notificationForm = superForm(data.forms!.notifications, {
        validators: zod(notificationSchema),
        onUpdated: ({ form }) => {
            console.log('🔔 Notification form updated:', {
                messageType: form.message?.type,
                messageText: form.message?.text
            });
            if (form.message?.type === 'success') {
                toast.success(form.message.text);
                editMode.notifications = false;
                invalidateAll();
            } else if (form.message?.type === 'error') {
                toast.error(form.message.text);
            }
        }
    });
    
    const passwordForm = superForm(data.forms!.password, {
        validators: zod(passwordSchema),
        onUpdated: ({ form }) => {
            console.log('🔒 Password form updated:', {
                messageType: form.message?.type,
                messageText: form.message?.text
            });
            if (form.message?.type === 'success') {
                toast.success(form.message.text);
                passwordDialogOpen = false;
            } else if (form.message?.type === 'error') {
                toast.error(form.message.text);
            }
        }
    });
    
    const { form: accountData, errors: accountErrors, enhance: accountEnhance, submitting: accountSubmitting, message: accountMessage, tainted: accountTainted } = accountForm;
    const { form: notificationData, enhance: notificationEnhance, submitting: notificationSubmitting } = notificationForm;
    const { form: passwordData, enhance: passwordEnhance, submitting: passwordSubmitting } = passwordForm;
    
    // Process form messages for FormContainer  
    $: ({ errorMessage } = processFormMessages($accountMessage));
    $: isLoading = $accountSubmitting;
    $: hasChanges = Boolean($accountTainted && Object.keys($accountTainted).length > 0);
    
    console.log('✅ SuperForms initialized successfully');
    
    function toggleEdit(section: keyof typeof editMode) {
        console.log('✏️ Toggling edit mode for section:', section);
        editMode[section] = !editMode[section];
        
        if (section === 'account' && editMode.account) {
            console.log('📝 Resetting form data for account editing');
            // Reset form to current data when starting edit
            $accountData = {
                name: data.account?.name || '',
                slug: data.account?.slug || '',
                description: data.account?.description || ''
            };
            console.log('📝 Form data reset to:', $accountData);
        }
    }
    
    // Generate slug from name
    function generateSlug(name: string): string {
        return name
            .toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9-]/g, '')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');
    }

    // Auto-generate slug when name changes
    $: if ($accountData.name && (!$accountData.slug || $accountData.slug === generateSlug(previousName || ''))) {
        $accountData.slug = generateSlug($accountData.name);
        previousName = $accountData.name;
    }

    let previousName = data.account?.name || '';

    function handleSessionSignOut(sessionId: string) {
        console.log('🚪 Attempting to sign out session:', sessionId);
        if (confirm('Are you sure you want to sign out this session?')) {
            const formData = new FormData();
            formData.append('sessionId', sessionId);
            
            fetch('?/signOutSession', {
                method: 'POST',
                body: formData
            }).then(response => response.json()).then(result => {
                console.log('🚪 Session sign out result:', result);
                if (result.type === 'success') {
                    toast.success('Session signed out successfully');
                    invalidateAll();
                } else {
                    toast.error('Failed to sign out session');
                }
            }).catch((error) => {
                console.error('🚪 Session sign out error:', error);
                toast.error('Failed to sign out session');
            });
        }
    }
</script>

<UserPageLayout
    title={pageTitle}
    crumbs={pageCrumbs}
>
    <Tabs bind:value={activeTab} class="space-y-6">
        <TabsList class="grid w-full grid-cols-2 md:grid-cols-4">
            <TabsTrigger value="account">
                <Building2 class="h-4 w-4 mr-2" />
                Account
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
        
        <!-- Account Tab -->
        <TabsContent value="account" class="space-y-6">
            <UserCard 
                title="Account Information"
                description="Manage your account details"
                icon={Building2}
            >
                <svelte:fragment slot="actions">
                    {#if canEditAccount(data.currentAccount)}
                            <Button variant="outline" size="sm" on:click={() => toggleEdit('account')}>
                                <Edit class="h-4 w-4 mr-1" />
                                Edit
                            </Button>
                    {:else}
                        <div class="flex items-center space-x-2 text-sm text-muted-foreground">
                            <Lock class="h-4 w-4" />
                            <span>Only account admins can edit these settings</span>
                        </div>
                    {/if}
                </svelte:fragment>
                
                {#if editMode.account}
                    <!-- Edit Mode: Use FormContainer with AccountFormFields -->
                    <FormContainer 
                        method="POST" 
                        action="?/updateAccount"
                        enhance={accountEnhance}
                        {errorMessage}
                        showAlerts={true}
                        disabled={isLoading}
                        {isLoading}
                        showToasts={false}
                    >
                        <AccountFormFields
                            form={accountData}
                            errors={accountErrors}
                            {isLoading}
                            showStatus={false}
                            showSlug={true}
                        />

                        <div class="sticky bottom-0 bg-background border-t border-border p-4 -mx-4 -mb-4">
                            <div class="flex items-center justify-end">
                              <div class="flex items-center space-x-2">

                                  {#if hasChanges && !isLoading}
                                      <div class="flex items-center space-x-2 text-sm text-muted-foreground">
                                          <div class="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
                                          <span>You have unsaved changes</span>
                                      </div>
                                  {/if}

                                {#if hasChanges && !isLoading}
                                    <Button variant="outline" size="sm" on:click={() => toggleEdit('account')} disabled={$accountSubmitting}>
                                        <X class="h-4 w-4 mr-1" />
                                        Cancel
                                    </Button>
                                {/if}
                                
                                <Button 
                                  type="submit" 
                                  disabled={isLoading || !hasChanges}
                                  class="min-w-[120px]"
                                >
                                  {#if isLoading}
                                    <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                                    Saving...
                                  {:else}
                                    <Save class="w-4 h-4 mr-2" />
                                    Save Changes
                                  {/if}
                                </Button>
                              </div>
                            </div>
                          </div>
                    </FormContainer>
                {:else}
                    <!-- View Mode: Display current values -->
                    <div class="space-y-6">
                        <div class="space-y-4">
                            <h3 class="font-medium">Account Name</h3>
                            <p class="text-sm font-medium py-2">{data.account?.name || 'No account set'}</p>
                        </div>
                        
                        <div class="space-y-4">
                            <h3 class="font-medium">Account Slug</h3>
                            <p class="text-sm font-medium py-2">{data.account?.slug || 'No slug set'}</p>
                        </div>
                        
                        <div class="space-y-4">
                            <h3 class="font-medium">Account Description</h3>
                            <p class="text-sm font-medium">{data.account?.description || 'No description set'}</p>
                        </div>
                    </div>
                {/if}
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
                                <p class="font-medium">Free</p>
                            </div>
                            <div class="border rounded-lg p-4">
                                <p class="text-sm text-muted-foreground">Status</p>
                                <p class="font-medium text-green-600">Active</p>
                            </div>
                            <div class="border rounded-lg p-4">
                                <p class="text-sm text-muted-foreground">Account Created</p>
                                <p class="font-medium">
                                    <RelativeDate date={data.user?.createdAt || new Date()} format="full" />
                                </p>
                            </div>
                        </div>
                    </div>
                    
                    <div class="space-y-4">
                        <h3 class="font-medium">Upgrade Plan</h3>
                        <p class="text-sm text-muted-foreground">Contact your administrator to upgrade your plan and access more features.</p>
                        <Button variant="outline" size="sm" disabled>
                            Contact Administrator
                        </Button>
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
            >
                <svelte:fragment slot="actions">
                    {#if editMode.notifications}
                        <div class="flex space-x-2">
                            <Button variant="outline" size="sm" on:click={() => toggleEdit('notifications')} disabled={$notificationSubmitting}>
                                <X class="h-4 w-4 mr-1" />
                                Cancel
                            </Button>
                            <Button size="sm" type="submit" form="notifications-form" disabled={$notificationSubmitting}>
                                <Save class="h-4 w-4 mr-1" />
                                {$notificationSubmitting ? 'Saving...' : 'Save Changes'}
                            </Button>
                        </div>
                    {:else}
                        <Button variant="outline" size="sm" on:click={() => toggleEdit('notifications')}>
                            <Edit class="h-4 w-4 mr-1" />
                            Edit
                        </Button>
                    {/if}
                </svelte:fragment>
                
                <form id="notifications-form" method="POST" action="?/updateNotifications" use:notificationEnhance>
                    <div class="space-y-6">
                        <div class="space-y-4">
                            <h3 class="font-medium">Email Notifications</h3>
                            <div class="space-y-4">
                                <div class="flex items-center justify-between">
                                    <div>
                                        <p class="text-sm font-medium">Email Notifications</p>
                                        <p class="text-xs text-muted-foreground">Receive important account notifications</p>
                                    </div>
                                    <Switch 
                                        name="email"
                                        checked={editMode.notifications ? $notificationData.email : data.settings?.emailNotifications || false}
                                        disabled={!editMode.notifications}
                                        onCheckedChange={(checked) => {
                                            if (editMode.notifications) {
                                                $notificationData.email = checked;
                                            }
                                        }}
                                    />
                                </div>
                                
                                <div class="flex items-center justify-between">
                                    <div>
                                        <p class="text-sm font-medium">Newsletter</p>
                                        <p class="text-xs text-muted-foreground">Get product updates and announcements</p>
                                    </div>
                                    <Switch 
                                        name="newsletter"
                                        checked={editMode.notifications ? $notificationData.newsletter : data.settings?.newsletterSubscription || false}
                                        disabled={!editMode.notifications}
                                        onCheckedChange={(checked) => {
                                            if (editMode.notifications) {
                                                $notificationData.newsletter = checked;
                                            }
                                        }}
                                    />
                                </div>
                                
                                <div class="flex items-center justify-between">
                                    <div>
                                        <p class="text-sm font-medium">Security Alerts</p>
                                        <p class="text-xs text-muted-foreground">Get important security notifications</p>
                                    </div>
                                    <Switch 
                                        name="security"
                                        checked={editMode.notifications ? $notificationData.security : data.settings?.securityAlerts || false}
                                        disabled={!editMode.notifications}
                                        onCheckedChange={(checked) => {
                                            if (editMode.notifications) {
                                                $notificationData.security = checked;
                                            }
                                        }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </form>
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
                                        {data.settings?.twoFactorEnabled ? 'Enabled' : 'Disabled'}
                                    </p>
                                    <p class="text-sm text-muted-foreground">
                                        Add an extra layer of security to your account
                                    </p>
                                </div>
                            </div>
                            <Button 
                                variant={data.settings?.twoFactorEnabled ? 'outline' : 'default'} 
                                size="sm"
                                disabled
                            >
                                {data.settings?.twoFactorEnabled ? 'Manage' : 'Enable'}
                            </Button>
                        </div>
                    </div>
                    
                    <div class="space-y-4">
                        <div class="flex justify-between items-center">
                            <h3 class="font-medium">Active Sessions</h3>
                            <p class="text-sm text-muted-foreground">
                                Last login: <RelativeDate date={data.user?.lastLogin || new Date()} format="relative" />
                            </p>
                        </div>
                        <div class="space-y-2">
                            {#each data.activeSessions || [] as session}
                                <div class="flex items-center justify-between p-3 border rounded-lg">
                                    <div class="flex items-center">
                                        <div class="p-2 rounded-full bg-muted mr-3">
                                            <Key class="h-4 w-4" />
                                        </div>
                                        <div>
                                            <p class="font-medium">{session.name}</p>
                                            <div class="flex items-center text-xs text-muted-foreground mb-1">
                                                <Mail class="h-3 w-3 mr-1" />
                                                {session.userEmail} • ID: {session.userId}
                                            </div>
                                            <div class="flex items-center text-xs text-muted-foreground">
                                                <MapPin class="h-3 w-3 mr-1" />
                                                {session.location} • 
                                                <RelativeDate date={session.lastUsed} format="relative" />
                                            </div>
                                        </div>
                                    </div>
                                    {#if session.isCurrentSession}
                                        <span class="text-xs text-green-600 font-medium">Current session</span>
                                    {:else}
                                        <Button variant="ghost" size="sm" on:click={() => handleSessionSignOut(session.id)}>
                                            Sign out
                                        </Button>
                                    {/if}
                                </div>
                            {/each}
                        </div>
                    </div>
                </div>
            </UserCard>
        </TabsContent>
    </Tabs>

    <!-- Companies Relationship Section -->
    <div class="mt-8">
        <RelationshipSection
            title="Companies"
            description="Companies associated with this account"
            icon={Building2}
            relationships={data.relationships?.companies || []}
            relationshipType="companies"
            canAdd={false}
            canRemove={canEditAccount(data.currentAccount)}
            canCreate={canEditAccount(data.currentAccount)}
            removeAction="?/removeCompany"
            createAction="?/createCompany"
            loading={false}
            multiSelect={false}
            destructiveRemoval={true}
            removalWarningMessage="This will permanently delete the company record and all associated data. This action cannot be undone."
            enableCreateDialog={true}
            createDialogTitle="Create New Company"
            createDialogDescription="Create a new company for this account"
        />
    </div>
</UserPageLayout>
