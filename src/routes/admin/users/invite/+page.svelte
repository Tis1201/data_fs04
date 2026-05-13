<!--
  @component InviteUserPage
  
  Admin page for creating and sending user invitations.
  
  Features:
  - Create user invitations with role assignment
  - Optional email sending with automatic fallback to shareable links
  - Real-time form validation and error handling
  - Smart dialog behavior (auto-dismiss for successful emails, manual close for links)
  - Recent invitations sidebar with status tracking
  
  @example
  ```
  // Accessible at /admin/users/invite
  // Requires ADMIN role
  ```
-->

<script lang="ts">
  // SvelteKit imports
  import { goto } from "$app/navigation";
  import { invalidateAll } from "$app/navigation";
  import { onDestroy } from "svelte";
  import type { PageData } from "./$types";

  // Third-party imports
  import { toast } from "svelte-sonner";
  import { ArrowLeft, Mail, UserPlus, Copy, Check, ExternalLink, X } from "lucide-svelte";

  // UI component imports
  import { Input } from "$lib/components/ui/input";
  import { Button } from "$lib/components/ui/button";
  
  // Admin layout components
  import AdminPageLayout from "$lib/components/admin/layout/AdminPageLayout.svelte";
  import AdminCard from "$lib/components/admin/layout/AdminCard.svelte";
  
  // Form components
  import FormContainer from "$lib/components/ui_components_sveltekit/form/FormContainer.svelte";
  import FormRow from "$lib/components/ui_components_sveltekit/form/FormRow.svelte";
  import FormField from "$lib/components/ui_components_sveltekit/form/FormField.svelte";
  import EnhancedSelect from "$lib/components/ui_components_sveltekit/form/EnhancedSelect.svelte";
  import { createFormHandler } from "$lib/components/ui_components_sveltekit/form/utils/formHandler";

  // Types
  interface InvitationData {
    user: {
      email: string;
      systemRole: string;
    };
    invitation: {
      id: string;
      token: string;
      expiresAt: string | Date;
      url: string;
    };
    emailStatus: 'sent' | 'not_requested' | 'failed';
    emailError?: string | null;
    emailSent: boolean;
  }

  // Constants
  const DIALOG_DISPLAY_DURATION = 5000; // 5 seconds
  const COUNTDOWN_INITIAL_VALUE = 5;
  const COUNTDOWN_INTERVAL = 1000; // 1 second
  const COPY_FEEDBACK_DURATION = 2000; // 2 seconds
  
  const DEFAULT_FORM_VALUES = {
    email: '',
    name: '',
    role: 'USER' as const,
    sendEmail: true as boolean
  };

  const ROLE_OPTIONS = [
    { value: "USER", label: "User" },
    { value: "ADMIN", label: "Admin" },
  ] as const;

  const PAGE_BREADCRUMBS = [
    ["Admin", "/admin"],
    ["Users", "/admin/users"],
    "Invite User",
  ] as const;

  // Props
  export let data: PageData;
  const title = "Invite User";

  // Component state
  let showInvitationResult = false;
  let invitationData: InvitationData | null = null;
  let copiedUrl = false;
  let countdown = COUNTDOWN_INITIAL_VALUE;
  let countdownInterval: NodeJS.Timeout | null = null;
  
  // Form handler with success/error callbacks
  const {
    form,
    errors,
    enhance,
    submitting,
    constraints,
    errorMessage,
    successMessage,
  } = createFormHandler(data.form, {
    validateOnInput: true,
    onSuccess: handleInvitationSuccess,
    onError: (error) => ({
      text: error?.message || "Failed to create invitation",
    }),
  });

  // Ensure sendEmail is properly initialized as boolean
  $: if ($form.sendEmail === undefined || $form.sendEmail === null) {
    $form.sendEmail = true;
  }

  /**
   * Handles successful invitation creation
   * Processes server response, shows success UI, and resets form
   */
  async function handleInvitationSuccess(result: any) {
    const resultData = extractInvitationData(result);
    
    if (!resultData) {
      console.warn('Invitation success handler called but no valid data found');
      return { text: "Invitation created successfully" };
    }

    // Update UI state
    invitationData = resultData;
    showInvitationResult = true;
    
    // Show appropriate success message based on server response
    let emailStatus: string;
    
    switch (resultData.emailStatus) {
      case 'sent':
        emailStatus = "Invitation email sent successfully!";
        break;
      case 'failed':
        emailStatus = `Invitation created but email failed: ${resultData.emailError || 'Unknown error'}`;
        break;
      case 'not_requested':
        emailStatus = "Invitation created successfully! Share the link manually.";
        break;
      default:
        emailStatus = "Invitation created successfully!";
    }
    
    toast.success(emailStatus);
    
    // Reset form and clear errors
    resetFormState();
    
    // Only auto-dismiss if email was sent successfully
    if (resultData.emailStatus === 'sent') {
      startSuccessDialogCountdown();
    }
    
    return { text: "Invitation created successfully" };
  }

  /**
   * Extracts invitation data from form submission result
   * Handles different response structures from the server
   */
  function extractInvitationData(result: any): InvitationData | null {
    const resultData = result.data?.data || result.data;
    
    if (!resultData || (!result.data?.success && !resultData.user)) {
      return null;
    }
    
    return resultData;
  }

  /**
   * Resets form to initial state after successful submission
   */
  function resetFormState(): void {
    Object.assign($form, DEFAULT_FORM_VALUES);
    $errors = {};
    $errorMessage = null;
  }

  /**
   * Starts the countdown timer for the success dialog
   * Manages both the visual countdown and automatic cleanup
   */
  function startSuccessDialogCountdown(): void {
    countdown = COUNTDOWN_INITIAL_VALUE;
    
    // Clear any existing interval
    if (countdownInterval) {
      clearInterval(countdownInterval);
    }
    
    // Start countdown timer
    countdownInterval = setInterval(() => {
      countdown--;
      if (countdown <= 0) {
        clearCountdownInterval();
      }
    }, COUNTDOWN_INTERVAL);
    
    // Schedule dialog cleanup
    setTimeout(async () => {
      await cleanupSuccessDialog();
    }, DIALOG_DISPLAY_DURATION);
  }

  /**
   * Cleans up the success dialog and refreshes data
   */
  async function cleanupSuccessDialog(): Promise<void> {
    clearCountdownInterval();
    await invalidateAll(); // Refresh recent invitations
    hideSuccessDialog();
  }

  /**
   * Hides the success dialog and resets related state
   */
  function hideSuccessDialog(): void {
    showInvitationResult = false;
    invitationData = null;
  }

  /**
   * Manually closes the success dialog and refreshes data
   */
  async function manuallyCloseSuccessDialog(): Promise<void> {
    clearCountdownInterval();
    await invalidateAll(); // Refresh recent invitations  
    hideSuccessDialog();
  }

  /**
   * Clears the countdown interval safely
   */
  function clearCountdownInterval(): void {
    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = null;
    }
  }

  /**
   * Copies invitation URL to clipboard with user feedback
   */
  function copyInvitationUrl(): void {
    const url = invitationData?.invitation?.url;
    if (!url) return;

    navigator.clipboard.writeText(url);
    copiedUrl = true;
    toast.success("Invitation URL copied to clipboard");
    
    setTimeout(() => {
      copiedUrl = false;
    }, COPY_FEEDBACK_DURATION);
  }

  /**
   * Formats date for consistent display across the component
   */
  function formatDate(date: string | Date): string {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /**
   * Submits the invitation form programmatically
   */
  function submitInvitationForm(): void {
    const form = document.querySelector('form[action="?/invite"]') as HTMLFormElement;
    form?.requestSubmit();
  }

  /**
   * Navigates back to the users list
   */
  function navigateToUsersList(): void {
    goto('/admin/users');
  }

  /**
   * Gets invitation status display information
   */
  function getInvitationStatus(invitation: any): { text: string; className: string } {
    if (invitation.usedAt) {
      return {
        text: 'Accepted',
        className: 'bg-green-50 text-green-700'
      };
    }
    
    if (invitation.expiresAt < new Date()) {
      return {
        text: 'Expired',
        className: 'bg-red-50 text-red-700'
      };
    }
    
    return {
      text: 'Pending',
      className: 'bg-amber-50 text-amber-700'
    };
  }

  /**
   * Gets email status display for the success dialog
   */
  function getEmailStatusDisplay(): { title: string; message: string; className: string; showUrl: boolean } {
    if (!invitationData) {
      return {
        title: 'Unknown Status',
        message: 'Unable to determine email status',
        className: 'bg-gray-50 border-gray-200 text-gray-700',
        showUrl: true
      };
    }

    switch (invitationData.emailStatus) {
      case 'sent':
        return {
          title: 'Invitation Email Sent',
          message: `The invitation email has been sent to ${invitationData.user.email}. They will receive instructions on how to complete their account setup.`,
          className: 'bg-green-50 border-green-200 text-green-700',
          showUrl: false
        };

      case 'failed':
        return {
          title: 'Email Sending Failed',
          message: `The invitation email could not be sent automatically. ${invitationData.emailError ? `Error: ${invitationData.emailError}` : ''} Please share this link manually:`,
          className: 'bg-red-50 border-red-200 text-red-700',
          showUrl: true
        };

      case 'not_requested':
        return {
          title: 'Share Invitation Link',
          message: 'Email was not sent as requested. Please share this invitation link manually:',
          className: 'bg-blue-50 border-blue-200 text-blue-700',
          showUrl: true
        };

      default:
        return {
          title: 'Invitation Created',
          message: 'Please share this invitation link:',
          className: 'bg-blue-50 border-blue-200 text-blue-700',
          showUrl: true
        };
    }
  }

  // Cleanup on component destroy
  onDestroy(() => {
    clearCountdownInterval();
  });
</script>

<AdminPageLayout
  {title}
  crumbs={PAGE_BREADCRUMBS}
  actionButtons={[
    {
      label: "Back to Users",
      icon: ArrowLeft,
      onClick: navigateToUsersList,
      variant: "outline",
      class: "h-9"
    },
    {
      label: 'Send Invitation',
      icon: Mail,
      onClick: submitInvitationForm,
      class: "h-9",
      disabled: $submitting
    }
  ]}
  compact={true}
  contentSpacing="space-y-6"
>
  <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
    <!-- Invitation Form -->
    <div class="lg:col-span-2">
      <FormContainer
        method="POST"
        action="?/invite"
        {enhance}
        novalidate
        errorMessage={$errorMessage?.text ? { text: $errorMessage.text } : null}
        successMessage={$successMessage?.text
      ? { text: $successMessage.text }
      : null}
      >
        <AdminCard
          title="Invite New User"
          description="Send an invitation to a new user to join the platform"
          icon={UserPlus}
          compact={true}
        >
          <div class="space-y-6">
            <FormRow columns={1}>
              <FormField id="email" label="Email Address" error={$errors.email} required={true}>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  bind:value={$form.email}
                  placeholder="user@example.com"
                  aria-invalid={$errors.email ? 'true' : undefined}
                  disabled={$submitting}
                />
              </FormField>
            </FormRow>
            
            <FormRow columns={2}>
              <FormField id="name" label="Full Name" error={$errors.name} required={true}>
                <Input
                  id="name"
                  name="name"
                  type="text"
                  bind:value={$form.name}
                  placeholder="John Doe"
                  aria-invalid={$errors.name ? 'true' : undefined}
                  disabled={$submitting}
                />
              </FormField>
              
              <FormField id="role" label="Role" error={$errors.role} required={true}>
                <EnhancedSelect
                  name="role"
                  options={ROLE_OPTIONS}
                  bind:value={$form.role}
                  aria-invalid={$errors.role ? "true" : undefined}
                  disabled={$submitting}
                  {...$constraints.role}
                />
              </FormField>
            </FormRow>
            
            <FormRow columns={1}>
              <FormField id="sendEmail" label="Email Options" error={$errors.sendEmail}>
                <div class="flex items-center space-x-2">
                  <!-- Hidden input to ensure false is sent when unchecked -->
                  <input type="hidden" name="sendEmail" value="false" />
                  <input
                    type="checkbox"
                    id="sendEmail"
                    name="sendEmail"
                    bind:checked={$form.sendEmail}
                    disabled={$submitting}
                    value="true"
                    class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label for="sendEmail" class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    Send invitation email automatically
                  </label>
                </div>
                <p class="text-xs text-muted-foreground mt-1">
                  {#if $form.sendEmail}
                    The invitation will be sent via email to the user immediately
                  {:else}
                    <span class="text-blue-600 font-medium">You'll get a shareable link instead</span> - no email will be sent
                  {/if}
                </p>
              </FormField>
            </FormRow>
          </div>
        </AdminCard>
      </FormContainer>
      
      <!-- Success Result -->
      {#if showInvitationResult && invitationData}
        {@const emailStatus = getEmailStatusDisplay()}
        <AdminCard
          title="Invitation Created Successfully"
          description="The invitation has been created. Here are the details:"
          icon={Check}
          compact={true}
          titleClass="text-green-600"
        >
          <div class="space-y-4">
            <div class="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span class="font-medium text-muted-foreground">Email:</span>
                <p class="font-medium">{invitationData.user.email}</p>
              </div>
              <div>
                <span class="font-medium text-muted-foreground">Role:</span>
                <p class="font-medium">{invitationData.user.systemRole}</p>
              </div>
              <div>
                <span class="font-medium text-muted-foreground">Status:</span>
                <p class="font-medium text-amber-600">Pending Invitation</p>
              </div>
              <div>
                <span class="font-medium text-muted-foreground">Expires:</span>
                <p class="font-medium">{formatDate(invitationData.invitation.expiresAt)}</p>
              </div>
            </div>
            
            <!-- Email Status Display -->
            <div class="border rounded-lg p-4 {emailStatus.className}">
              <h4 class="font-medium mb-2">{emailStatus.title}</h4>
              <p class="text-sm mb-3">{emailStatus.message}</p>
              
              {#if emailStatus.showUrl}
                <div class="flex items-center space-x-2">
                  <Input
                    type="text"
                    value={invitationData.invitation.url}
                    readonly
                    class="text-xs font-mono bg-white"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    on:click={copyInvitationUrl}
                  >
                    {#if copiedUrl}
                      <Check class="h-4 w-4" />
                    {:else}
                      <Copy class="h-4 w-4" />
                    {/if}
                  </Button>
                </div>
              {/if}
            </div>
            
            <!-- Footer: Countdown or Close Button -->
            <div class="border-t pt-3">
              {#if countdownInterval}
                <!-- Auto-dismiss countdown -->
                <p class="text-xs text-muted-foreground text-center">
                  This dialog will disappear in <span class="font-medium text-gray-700">{countdown}</span> second{countdown !== 1 ? 's' : ''}
                </p>
              {:else}
                <!-- Manual close option -->
                <div class="flex items-center justify-between">
                  <p class="text-xs text-muted-foreground">
                    Done? Close this dialog to continue with more invitations.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    on:click={manuallyCloseSuccessDialog}
                    class="h-8"
                  >
                    <X class="h-4 w-4 mr-1" />
                    Close
                  </Button>
                </div>
              {/if}
            </div>
          </div>
        </AdminCard>
      {/if}
    </div>
    
    <!-- Recent Invitations Sidebar -->
    <div class="lg:col-span-1">
      <AdminCard
        title="Recent Invitations"
        description="Recently sent invitations"
        compact={true}
      >
        <div class="space-y-3">
          {#each data.recentInvitations as invitation}
            {@const status = getInvitationStatus(invitation)}
            <div class="border rounded-lg p-3">
              <div class="flex items-center justify-between mb-1">
                <p class="font-medium text-sm">{invitation.user.email}</p>
                <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium {status.className}">
                  {status.text}
                </span>
              </div>
              <p class="text-xs text-muted-foreground">
                {invitation.user.systemRole} • {formatDate(invitation.createdAt)}
              </p>
            </div>
          {:else}
            <p class="text-sm text-muted-foreground">No recent invitations</p>
          {/each}
        </div>
      </AdminCard>
    </div>
  </div>
</AdminPageLayout> 
