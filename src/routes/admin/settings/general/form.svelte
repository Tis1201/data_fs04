<script lang="ts">
  import { superForm } from "sveltekit-superforms/client";
  import { zodClient } from "sveltekit-superforms/adapters";
  import { z } from "zod";
  import { toast } from "svelte-sonner";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Switch } from "$lib/components/ui/switch";
  import { Separator } from "$lib/components/ui/separator";
  import { Save, Settings2, Lock, Shield, Zap, Loader2 } from "lucide-svelte";
  import type { SuperValidated } from "sveltekit-superforms";
  import { invalidate } from "$app/navigation";
  import { createEventDispatcher } from 'svelte';
  
  // Import custom form components
  import FormContainer from "$lib/components/ui_components_sveltekit/form/FormContainer.svelte";
  import FormCard from "$lib/components/ui_components_sveltekit/form/FormCard.svelte";
  import FormField from "$lib/components/ui_components_sveltekit/form/FormField.svelte";
  import FormRow from "$lib/components/ui_components_sveltekit/form/FormRow.svelte";
  import EnhancedSelect from "$lib/components/ui_components_sveltekit/form/EnhancedSelect.svelte";
  import ErrorAlert from "$lib/components/ui_components_sveltekit/alerts/ErrorAlert.svelte";
  
  // Schema for settings form
  const settingsSchema = z.object({
    id: z.string().optional(),
    data: z.string().min(2, 'Settings data is required'),
  });

  export let form: SuperValidated<typeof settingsSchema>;
  export let jsonError: string | null = null;

  // Use standard SuperForms approach with comprehensive error handling
  const { form: formData, enhance, errors, submitting, message, delayed, timeout } = superForm(form, {
    validators: zodClient(settingsSchema),
    taintedMessage: 'You have unsaved changes. Are you sure you want to leave?',
    invalidateAll: false, // Prevent automatic invalidation
    resetForm: false, // Don't reset the form after submission
    delayMs: 500, // Show loading state after 500ms
    timeoutMs: 8000, // Timeout after 8 seconds
    
    onResult: async ({ result }) => {
      if (result.type === "success") {
        // Show success message
        toast.success("Settings updated successfully!", {
          description: "Your general settings have been saved and applied.",
          duration: 4000
        });
        
        // Manually invalidate using the dependency key from the load function
        await invalidate('settings:data');
        
        // Dispatch success event to parent
        dispatch('result', { success: true, result });
      } else if (result.type === "failure") {
        // Handle form validation errors
        if (result.data?.form?.message) {
          toast.error("Validation Error", {
            description: result.data.form.message.text || "Please check your settings and try again.",
            duration: 6000
          });
        } else {
          toast.error("Failed to update settings", {
            description: "Please check your settings and try again.",
            duration: 6000
          });
        }
        
        // Dispatch failure event to parent
        dispatch('result', { success: false, result });
      } else if (result.type === "error") {
        // Handle server errors
        toast.error("Server Error", {
          description: "An unexpected error occurred. Please try again later.",
          duration: 6000
        });
        
        // Dispatch error event to parent
        dispatch('result', { success: false, result });
      }
    },
    
    onError: ({ result }) => {
      console.error("Form submission error:", result);
      toast.error("Connection Error", {
        description: "Unable to connect to the server. Please check your connection and try again.",
        duration: 6000
      });
      
      // Dispatch error event to parent
      dispatch('result', { success: false, result });
    },
    
    onSubmit: ({ formData, cancel }) => {
      // Validate before submission
      if (!validateBeforeSubmit()) {
        cancel();
        // Dispatch cancel event to parent
        dispatch('result', { success: false, cancelled: true });
        return;
      }
      
      // Dispatch submit event to parent
      dispatch('submit');
    },
    
    onUpdate: ({ form }) => {
      // Clear previous error messages when user starts typing
      if (form.valid) {
        jsonError = null;
      }
    }
  });

  // Enhanced message handling for FormContainer (only errors, success uses toast)
  $: errorMessage = $message?.type === 'error' ? { 
    text: $message.text || 'An error occurred',
    details: $message.details,
    code: $message.code 
  } : null;
  
  // Loading state management
  $: isLoading = $submitting || $delayed;
  $: hasTimeout = $timeout;

  // Parse settings from JSON
  let settings = {
    auth: {
      sessionAuth: true,
      oauthAuth: false,
      sessionTimeout: 30,
      maxLoginAttempts: 5,
      captchaEnabled: false,
      captchaType: 'recaptcha',
      emailProvider: 'smtp',
      emailEnabled: false,
      allowRegistration: true
    },
    security: {
      enforceStrongPasswords: false,
      twoFactorAuth: false,
      ipRestriction: false,
      allowedIPs: []
    },
    system: {
      debugMode: false,
      logLevel: "info",
      maintenanceMode: false,
    },
    notifications: {
      emailNotifications: true,
      smsNotifications: false,
      webhookNotifications: false,
      webhookUrl: ""
    },
    performance: {
      cacheEnabled: true,
      cacheTTL: 3600,
      rateLimitEnabled: true,
      maxRequestsPerMinute: 100
    }
  };

  // Initialize settings from form data
  try {
    if (form.data.data) {
      const parsed = JSON.parse(form.data.data);
      settings = {
        auth: {
          sessionAuth: parsed.auth?.sessionAuth ?? settings.auth.sessionAuth,
          oauthAuth: parsed.auth?.oauthAuth ?? settings.auth.oauthAuth,
          sessionTimeout: parsed.auth?.sessionTimeout ?? settings.auth.sessionTimeout,
          maxLoginAttempts: parsed.auth?.maxLoginAttempts ?? settings.auth.maxLoginAttempts,
          captchaEnabled: parsed.auth?.captchaEnabled ?? settings.auth.captchaEnabled,
          captchaType: parsed.auth?.captchaType ?? settings.auth.captchaType,
          emailProvider: parsed.auth?.emailProvider ?? settings.auth.emailProvider,
          emailEnabled: parsed.auth?.emailEnabled ?? settings.auth.emailEnabled,
          allowRegistration: parsed.auth?.allowRegistration ?? parsed.system?.allowRegistration ?? settings.auth.allowRegistration
        },
        security: {
          enforceStrongPasswords: parsed.security?.enforceStrongPasswords ?? settings.security.enforceStrongPasswords,
          twoFactorAuth: parsed.security?.twoFactorAuth ?? settings.security.twoFactorAuth,
          ipRestriction: parsed.security?.ipRestriction ?? settings.security.ipRestriction,
          allowedIPs: parsed.security?.allowedIPs ?? settings.security.allowedIPs
        },
        system: {
          debugMode: parsed.system?.debugMode ?? settings.system.debugMode,
          logLevel: parsed.system?.logLevel ?? settings.system.logLevel,
          maintenanceMode: parsed.system?.maintenanceMode ?? settings.system.maintenanceMode
        },
        notifications: {
          emailNotifications: parsed.notifications?.emailNotifications ?? settings.notifications.emailNotifications,
          smsNotifications: parsed.notifications?.smsNotifications ?? settings.notifications.smsNotifications,
          webhookNotifications: parsed.notifications?.webhookNotifications ?? settings.notifications.webhookNotifications,
          webhookUrl: parsed.notifications?.webhookUrl ?? settings.notifications.webhookUrl
        },
        performance: {
          cacheEnabled: parsed.performance?.cacheEnabled ?? settings.performance.cacheEnabled,
          cacheTTL: parsed.performance?.cacheTTL ?? settings.performance.cacheTTL,
          rateLimitEnabled: parsed.performance?.rateLimitEnabled ?? settings.performance.rateLimitEnabled,
          maxRequestsPerMinute: parsed.performance?.maxRequestsPerMinute ?? settings.performance.maxRequestsPerMinute
        }
      };
    }
  } catch (e) {
    console.error('Error parsing settings:', e);
  }

  // Update the JSON data when settings change
  function updateJsonData() {
    $formData.data = JSON.stringify(settings, null, 2);
  }

  // Validate before submission
  function validateBeforeSubmit() {
    try {
      // Update the form data with the current settings
      $formData.data = JSON.stringify(settings, null, 2);
      jsonError = null;
      return true;
    } catch (e) {
      jsonError = e instanceof Error ? e.message : 'Invalid settings format';
      return false;
    }
  }

  // Log level options
  const logLevels = [
    { value: "error", label: "Error" },
    { value: "warn", label: "Warning" },
    { value: "info", label: "Info" },
    { value: "debug", label: "Debug" },
    { value: "trace", label: "Trace" }
  ];

  // Create event dispatcher
  const dispatch = createEventDispatcher();
</script>

<FormContainer 
  method="POST" 
  action="?/update" 
  {enhance} 
  novalidate 
  {errorMessage}
  showAlerts={true}
  disabled={isLoading}
  {hasTimeout}
  {isLoading}
  delayed={$delayed}
>
  <input type="hidden" name="id" bind:value={$formData.id} />
  <input type="hidden" name="data" bind:value={$formData.data} />
  
  {#if jsonError}
    <ErrorAlert 
      title="Configuration Error" 
      message={jsonError}
      variant="destructive"
    />
  {/if}

  <div class="space-y-6 relative">
    <!-- Authentication Settings -->
    <div class="p-4 border rounded-md bg-card/50 space-y-4">
      <div class="flex items-center gap-2">
        <Lock class="h-5 w-5 text-primary" />
        <h3 class="text-lg font-medium">Authentication</h3>
      </div>
      <Separator />
      
      <div class="grid gap-4 pl-1">
          <FormField id="auth_captcha" label="CAPTCHA Protection" error={null}>
            <div class="flex items-center justify-between">
              <p class="text-sm text-muted-foreground">Enable CAPTCHA verification for login attempts</p>
              <Switch 
                id="auth_captcha"
                checked={settings.auth.captchaEnabled} 
                disabled={isLoading}
                onCheckedChange={(checked) => {
                  settings.auth.captchaEnabled = checked;
                  updateJsonData();
                }}
              />
            </div>
          </FormField>

        <FormField id="system_allowRegistration" label="Allow Registration" error={null}>
          <div class="flex items-center justify-between">
            <p class="text-sm text-muted-foreground">Allow new users to register</p>
            <Switch
                    id="system_allowRegistration"
                    checked={settings.auth.allowRegistration}
                    disabled={isLoading}
                    onCheckedChange={(checked) => {
                  settings.auth.allowRegistration = checked;
                  updateJsonData();
                }}
            />
          </div>
        </FormField>

          <FormField id="auth_email" label="Email Notifications" error={null}>
            <div class="flex items-center justify-between">
              <p class="text-sm text-muted-foreground">Enable email notifications for authentication</p>
              <Switch 
                id="auth_email"
                checked={settings.auth.emailEnabled} 
                disabled={isLoading}
                onCheckedChange={(checked) => {
                  settings.auth.emailEnabled = checked;
                  updateJsonData();
                }}
              />
            </div>
          </FormField>
      </div>
    </div>
    
    <!-- Security Settings -->
    <div class="p-4 border rounded-md bg-card/50 space-y-4">
      <div class="flex items-center gap-2">
        <Shield class="h-5 w-5 text-primary" />
        <h3 class="text-lg font-medium">Security</h3>
      </div>
      <Separator />
      
      <div class="grid gap-4 pl-1">
          <FormField id="security_enforceStrongPasswords" label="Enforce Strong Passwords" error={null}>
            <div class="flex items-center justify-between">
              <p class="text-sm text-muted-foreground">Require complex passwords with minimum requirements</p>
              <Switch 
                id="security_enforceStrongPasswords"
                checked={settings.security.enforceStrongPasswords} 
                disabled={isLoading}
                onCheckedChange={(checked) => {
                  settings.security.enforceStrongPasswords = checked;
                  updateJsonData();
                }}
              />
            </div>
          </FormField>
      </div>
    </div>
    
    <!-- System Settings -->
    <div class="p-4 border rounded-md bg-card/50 space-y-4">
      <div class="flex items-center gap-2">
        <Settings2 class="h-5 w-5 text-primary" />
        <h3 class="text-lg font-medium">System</h3>
      </div>
      <Separator />
      
      <div class="grid gap-4 pl-1">
          <FormField id="system_debugMode" label="Debug Mode" error={null}>
            <div class="flex items-center justify-between">
              <p class="text-sm text-muted-foreground">Enable detailed error messages and logging</p>
              <Switch 
                id="system_debugMode"
                checked={settings.system.debugMode} 
                disabled={isLoading}
                onCheckedChange={(checked) => {
                  settings.system.debugMode = checked;
                  updateJsonData();
                }}
              />
            </div>
          </FormField>
              
          <FormField id="system_maintenanceMode" label="Maintenance Mode" error={null}>
            <div class="flex items-center justify-between">
              <p class="text-sm text-muted-foreground">Put application in maintenance mode</p>
              <Switch 
                id="system_maintenanceMode"
                checked={settings.system.maintenanceMode} 
                disabled={isLoading}
                onCheckedChange={(checked) => {
                  settings.system.maintenanceMode = checked;
                  updateJsonData();
                }}
              />
            </div>
          </FormField>
              
          <FormField id="logLevel" label="Log Level" error={null}>
            <EnhancedSelect
              id="logLevel"
              name="logLevel"
              options={logLevels}
              value={settings.system.logLevel}
              placeholder="Select log level"
              labelText="Log Level"
              disabled={isLoading}
              on:change={(e) => {
                settings.system.logLevel = e.detail;
                updateJsonData();
              }}
            />
          </FormField>
      </div>
    </div>
    
    <!-- Performance Settings -->
    <div class="p-4 border rounded-md bg-card/50 space-y-4">
      <div class="flex items-center gap-2">
        <Zap class="h-5 w-5 text-primary" />
        <h3 class="text-lg font-medium">Performance</h3>
      </div>
      <Separator />
      
      <div class="grid gap-4 pl-1">
          <FormField id="performance_cacheEnabled" label="Enable Caching" error={null}>
            <div class="flex items-center justify-between">
              <p class="text-sm text-muted-foreground">Cache responses to improve performance</p>
              <Switch 
                id="performance_cacheEnabled"
                checked={settings.performance.cacheEnabled} 
                disabled={isLoading}
                onCheckedChange={(checked) => {
                  settings.performance.cacheEnabled = checked;
                  updateJsonData();
                }}
              />
            </div>
          </FormField>
              
          <FormRow columns={2}>
            <FormField id="cacheTTL" label="Cache TTL (seconds)" error={null}>
              <Input 
                id="cacheTTL" 
                type="number" 
                min="60" 
                max="86400"
                value={settings.performance.cacheTTL} 
                disabled={isLoading}
                on:input={(e) => {
                  settings.performance.cacheTTL = parseInt(e.currentTarget.value) || 3600;
                  updateJsonData();
                }}
              />
            </FormField>
            
            <FormField id="maxRequestsPerMinute" label="Rate Limit (req/min)" error={null}>
              <Input 
                id="maxRequestsPerMinute" 
                type="number" 
                min="10" 
                max="1000"
                value={settings.performance.maxRequestsPerMinute} 
                disabled={isLoading}
                on:input={(e) => {
                  settings.performance.maxRequestsPerMinute = parseInt(e.currentTarget.value) || 100;
                  updateJsonData();
                }}
              />
            </FormField>
          </FormRow>
      </div>
    </div>
  </div>
</FormContainer>
