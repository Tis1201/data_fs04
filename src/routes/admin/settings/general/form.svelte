<script lang="ts">
  import { superForm } from "sveltekit-superforms/client";
  import { zodClient } from "sveltekit-superforms/adapters";
  import { z } from "zod";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Switch } from "$lib/components/ui/switch";
  import { Separator } from "$lib/components/ui/separator";
  import { Save, Settings2, Lock, Shield, Zap } from "lucide-svelte";
  import type { SuperValidated } from "sveltekit-superforms";
  
  // Import custom form components
  import FormContainer from "$lib/components/ui_components_sveltekit/form/FormContainer.svelte";
  import FormCard from "$lib/components/ui_components_sveltekit/form/FormCard.svelte";
  import FormField from "$lib/components/ui_components_sveltekit/form/FormField.svelte";
  import FormRow from "$lib/components/ui_components_sveltekit/form/FormRow.svelte";
  import EnhancedSelect from "$lib/components/ui_components_sveltekit/form/EnhancedSelect.svelte";
  
  // Schema for settings form
  const settingsSchema = z.object({
    id: z.string().optional(),
    data: z.string().min(2, 'Settings data is required'),
  });

  export let form: SuperValidated<typeof settingsSchema>;
  export let jsonError: string | null = null;

  const { form: formData, enhance, errors, submitting } = superForm(form, {
    validators: zodClient(settingsSchema)
  });

  // Parse settings from JSON
  let settings = {
    auth: {
      sessionAuth: true,
      oauthAuth: false,
      sessionTimeout: 30,
      maxLoginAttempts: 5
    },
    security: {
      enforceStrongPasswords: true,
      twoFactorAuth: false,
      ipRestriction: false,
      allowedIPs: []
    },
    system: {
      debugMode: false,
      logLevel: "info",
      maintenanceMode: false,
      allowRegistration: true
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
          maxLoginAttempts: parsed.auth?.maxLoginAttempts ?? settings.auth.maxLoginAttempts
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
          maintenanceMode: parsed.system?.maintenanceMode ?? settings.system.maintenanceMode,
          allowRegistration: parsed.system?.allowRegistration ?? settings.system.allowRegistration
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
</script>

<form 
  method="POST" 
  action="?/update" 
  use:enhance 
  on:submit={validateBeforeSubmit}
  class="space-y-6"
>
  <input type="hidden" name="id" bind:value={$formData.id} />
  <input type="hidden" name="data" bind:value={$formData.data} />
  
  {#if jsonError}
    <div class="text-sm text-destructive">{jsonError}</div>
  {/if}
  <!-- Authentication Settings -->
  <div class="p-4 border rounded-md bg-card/50 space-y-4">
    <div class="flex items-center gap-2">
      <Lock class="h-5 w-5 text-primary" />
      <h3 class="text-lg font-medium">Authentication</h3>
    </div>
    <Separator />
    
    <div class="grid gap-4 pl-1">
        <FormField id="auth_sessionAuth" label="Session Authentication" error={null}>
          <div class="flex items-center justify-between">
            <p class="text-sm text-muted-foreground">Enable username/password authentication</p>
            <Switch 
              id="auth_sessionAuth"
              checked={settings.auth.sessionAuth} 
              onCheckedChange={(checked) => {
                settings.auth.sessionAuth = checked;
                updateJsonData();
              }}
            />
          </div>
        </FormField>
            
        <FormField id="auth_oauthAuth" label="OAuth Authentication" error={null}>
          <div class="flex items-center justify-between">
            <p class="text-sm text-muted-foreground">Enable third-party authentication providers</p>
            <Switch 
              id="auth_oauthAuth"
              checked={settings.auth.oauthAuth} 
              onCheckedChange={(checked) => {
                settings.auth.oauthAuth = checked;
                updateJsonData();
              }}
            />
          </div>
        </FormField>
            
        <FormRow columns={2}>
          <FormField id="sessionTimeout" label="Session Timeout (minutes)" error={null}>
            <Input 
              id="sessionTimeout" 
              type="number" 
              min="1" 
              max="1440"
              value={settings.auth.sessionTimeout} 
              on:input={(e) => {
                settings.auth.sessionTimeout = parseInt(e.currentTarget.value) || 30;
                updateJsonData();
              }}
            />
          </FormField>
          
          <FormField id="maxLoginAttempts" label="Max Login Attempts" error={null}>
            <Input 
              id="maxLoginAttempts" 
              type="number" 
              min="1" 
              max="10"
              value={settings.auth.maxLoginAttempts} 
              on:input={(e) => {
                settings.auth.maxLoginAttempts = parseInt(e.currentTarget.value) || 5;
                updateJsonData();
              }}
            />
          </FormField>
        </FormRow>
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
              onCheckedChange={(checked) => {
                settings.security.enforceStrongPasswords = checked;
                updateJsonData();
              }}
            />
          </div>
        </FormField>
            
        <FormField id="security_twoFactorAuth" label="Two-Factor Authentication" error={null}>
          <div class="flex items-center justify-between">
            <p class="text-sm text-muted-foreground">Require 2FA for all users</p>
            <Switch 
              id="security_twoFactorAuth"
              checked={settings.security.twoFactorAuth} 
              onCheckedChange={(checked) => {
                settings.security.twoFactorAuth = checked;
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
            on:change={(e) => {
              settings.system.logLevel = e.detail;
              updateJsonData();
            }}
          />
        </FormField>
            
        <FormField id="system_allowRegistration" label="Allow Registration" error={null}>
          <div class="flex items-center justify-between">
            <p class="text-sm text-muted-foreground">Allow new users to register</p>
            <Switch 
              id="system_allowRegistration"
              checked={settings.system.allowRegistration} 
              onCheckedChange={(checked) => {
                settings.system.allowRegistration = checked;
                updateJsonData();
              }}
            />
          </div>
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
              on:input={(e) => {
                settings.performance.maxRequestsPerMinute = parseInt(e.currentTarget.value) || 100;
                updateJsonData();
              }}
            />
          </FormField>
        </FormRow>
    </div>
  </div>
  
  <!-- Save button moved to page header -->
</form>
