<script lang="ts">
  import { goto } from "$app/navigation";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Textarea } from "$lib/components/ui/textarea";
  import { Save, X } from "lucide-svelte";
  import PageContainer from "$lib/components/ui_components_sveltekit/layout/PageContainer.svelte";
  import PageHeader from "$lib/components/ui_components_sveltekit/layout/PageHeader.svelte";
  import PageContent from "$lib/components/ui_components_sveltekit/layout/PageContent.svelte";
  import { AdminCard } from "$lib/components/admin";
  import FormContainer from "$lib/components/ui_components_sveltekit/form/FormContainer.svelte";
  import FormRow from "$lib/components/ui_components_sveltekit/form/FormRow.svelte";
  import FormField from "$lib/components/ui_components_sveltekit/form/FormField.svelte";
  import EnhancedSelect from "$lib/components/ui_components_sveltekit/form/EnhancedSelect.svelte";
  import EnhancedDatePicker from "$lib/components/ui_components_sveltekit/form/EnhancedDatePicker.svelte";
  import CharacterCount from "$lib/components/ui_components_sveltekit/form/CharacterCount.svelte";
  import { createFormHandler } from "$lib/components/ui_components_sveltekit/form/utils/formHandler";
  import type { PageData } from "./$types";
  import { PRECLAIM_SET_STATUSES } from "../schema";
  import { DESCRIPTION_MAX } from "$lib/constants/description";

  export let data: PageData;
  const { preclaimSet } = data;
  const title = `Edit ${preclaimSet.name || "Pre-claim Set"}`;

  const pageCrumbs: [string, string][] = [
    ["Home", "/user"],
      ["IOT", ""],
    ["Pre-claims", "/user/iot/preclaims"],
    [preclaimSet.name || "Pre-claim Set", `/user/iot/preclaims/${preclaimSet.id}`],
    ["Edit", ""]
  ];

  const { form, errors, enhance, submitting, errorMessage } = createFormHandler(data.form, {
    successRedirect: `/user/iot/preclaims/${preclaimSet.id}`,
    validateOnInput: true,
    onSuccess: (result) => ({ type: 'success', text: result.data?.message || 'Updated successfully' })
  });
</script>

<PageContainer crumbs={pageCrumbs}>
  <PageHeader title={title}>
    <div slot="action" class="flex items-center space-x-2">
      <Button type="submit" form="preclaim-edit-form" disabled={$submitting} variant="default" class="flex items-center">
        <Save class="mr-2 h-4 w-4" />
        {$submitting ? 'Saving...' : 'Save Changes'}
      </Button>
      <Button variant="outline" on:click={() => goto(`/user/iot/preclaims/${preclaimSet.id}`)} class="flex items-center">
        <X class="mr-2 h-4 w-4" />
        Cancel
      </Button>
    </div>
  </PageHeader>

  <PageContent>
    <div class="space-y-6">
      <AdminCard title="Pre-claim Set" description="Edit name, status, description and expiry." compact={true}>
        <FormContainer id="preclaim-edit-form" action="?/save" {enhance} errorMessage={$errorMessage}>
          <FormRow columns={2}>
            <FormField id="name" label="Name" error={$errors.name}>
              <Input id="name" name="name" placeholder="Enter name" bind:value={$form.name} />
            </FormField>
            <FormField id="status" label="Status" error={$errors.status}>
              <EnhancedSelect id="status" name="status" options={PRECLAIM_SET_STATUSES} bind:value={$form.status} />
            </FormField>
          </FormRow>

          <FormField id="description" label="Description" error={$errors.description}>
            <Textarea id="description" name="description" placeholder="Enter description" bind:value={$form.description} rows={3} maxlength={DESCRIPTION_MAX} />
            <CharacterCount current={$form.description?.length ?? 0} max={DESCRIPTION_MAX} />
          </FormField>

          <FormField id="profileId" label="Device Profile (Optional)" error={$errors.profileId}>
            <EnhancedSelect
              id="profileId"
              name="profileId"
              bind:value={$form.profileId}
              placeholder="Select a device profile (optional)"
              aria-invalid={$errors.profileId ? 'true' : undefined}
              options={data.profileOptions}
              clearable={true}
            />
            <p class="text-xs text-muted-foreground mt-1">
              When devices are claimed via this preclaim, the selected profile will be automatically applied to them.
            </p>
          </FormField>

          <FormField id="expiresAt" label="Expires At" error={$errors.expiresAt}>
            <EnhancedDatePicker
              id="expiresAt"
              name="expiresAt"
              field="expiresAt"
              form={$form}
              error={$errors.expiresAt}
              placeholder="Select expiry date"
              format_string="yyyy-MM-dd"
              minDate={new Date()}
              timelineOptions="future"
              showFutureDates={true}
            />
          </FormField>

          <input type="hidden" name="id" bind:value={$form.id} />
        </FormContainer>
      </AdminCard>
    </div>
  </PageContent>
</PageContainer>
