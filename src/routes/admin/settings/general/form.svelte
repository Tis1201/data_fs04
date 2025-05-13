<script lang="ts">
  import { superForm } from "sveltekit-superforms/client";
  import { zodClient } from "sveltekit-superforms/adapters";
  import { z } from "zod";
  import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "$lib/components/ui/card";
  import { Button } from "$lib/components/ui/button";
  import { Textarea } from "$lib/components/ui/textarea";
  import { Label } from "$lib/components/ui/label";
  import { Alert, AlertDescription } from "$lib/components/ui/alert";
  import { AlertCircle, Save } from "lucide-svelte";
  import type { SuperValidated } from "sveltekit-superforms";
  
  // Schema for settings form
  const settingsSchema = z.object({
    id: z.string().optional(),
    data: z.string().min(2, 'Settings data is required'),
  });

  export let form: SuperValidated<typeof settingsSchema>;
  export let jsonError: string | null = null;

  const { form: formData, enhance, errors, submitting } = superForm(form, {
    validators: zodClient(settingsSchema),
    onUpdated: ({ form }) => {
      if (form.valid) {
        try {
          // Format the JSON for better readability
          const parsed = JSON.parse(form.data.data);
          formData.update($formData => ({
            ...$formData,
            data: JSON.stringify(parsed, null, 2)
          }));
          jsonError = null;
        } catch (e) {
          // Keep the original input if it's not valid JSON
        }
      }
    }
  });

  function validateJson() {
    try {
      JSON.parse($formData.data);
      jsonError = null;
      return true;
    } catch (e) {
      jsonError = e instanceof Error ? e.message : 'Invalid JSON format';
      return false;
    }
  }

  function formatJson() {
    try {
      const parsed = JSON.parse($formData.data);
      $formData.data = JSON.stringify(parsed, null, 2);
      jsonError = null;
    } catch (e) {
      jsonError = e instanceof Error ? e.message : 'Invalid JSON format';
    }
  }
</script>

<Card class="w-full">
  <CardHeader>
    <CardTitle>Application Settings</CardTitle>
    <CardDescription>
      Manage global application settings. Settings are stored as JSON and each update creates a new version.
    </CardDescription>
  </CardHeader>
  <CardContent>
    <form method="POST" action="?/update" use:enhance>
      <input type="hidden" name="id" bind:value={$formData.id} />
      
      <div class="space-y-4">
        {#if jsonError}
          <Alert variant="destructive">
            <AlertCircle class="h-4 w-4" />
            <AlertDescription>{jsonError}</AlertDescription>
          </Alert>
        {/if}
        
        <div class="space-y-2">
          <Label for="data">Settings (JSON format)</Label>
          <Textarea
            id="data"
            name="data"
            rows="15"
            class="font-mono"
            bind:value={$formData.data}
            on:blur={formatJson}
          />
          {#if $errors.data}
            <p class="text-sm text-destructive">{$errors.data}</p>
          {/if}
        </div>
      </div>
      
      <div class="flex justify-end mt-4">
        <Button 
          type="button" 
          variant="outline" 
          class="mr-2"
          on:click={formatJson}
        >
          Format JSON
        </Button>
        <Button 
          type="submit" 
          disabled={$submitting || !!jsonError}
          on:click={() => {
            if (!validateJson()) {
              return false;
            }
          }}
        >
          <Save class="h-4 w-4 mr-2" />
          Save Settings
        </Button>
      </div>
    </form>
  </CardContent>
</Card>
