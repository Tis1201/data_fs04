<script lang="ts">
  import { goto } from "$app/navigation";
  import { Save, ArrowLeft, Download } from "lucide-svelte";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Textarea } from "$lib/components/ui/textarea";
  import { Card, CardContent } from "$lib/components/ui/card";
  import UserPageLayout from "$lib/components/user/layout/UserPageLayout.svelte";
  import FormContainer from "$lib/components/ui_components_sveltekit/form/FormContainer.svelte";
  import FormRow from "$lib/components/ui_components_sveltekit/form/FormRow.svelte";
  import FormField from "$lib/components/ui_components_sveltekit/form/FormField.svelte";
  import EnhancedDatePicker from "$lib/components/ui_components_sveltekit/form/EnhancedDatePicker.svelte";
  import EnhancedFileUpload from "$lib/components/ui_components_sveltekit/form/EnhancedFileUpload.svelte";
  import { createFormHandler } from "$lib/components/ui_components_sveltekit/form/utils/formHandler";
  import type { PageData } from "./$types";

  export let data: PageData;

  const pageTitle = "Upload Preclaim Set";
  const pageDescription = "Create a preclaim set and upload device MAC addresses from CSV/XLSX";
  const pageCrumbs = [
    ["Dashboard", "/user/dashboard"],
    ["IoT", "/user/iot"],
    ["Preclaims", "/user/iot/preclaims"],
    ["New", ""]
  ] as [string, string][];

  const { form, errors, submitting, errorMessage, enhance, constraints } = createFormHandler(data.form, {
    validateOnInput: true,
    onSuccess: (result) => {
      const id = result?.data?.form?.message?.data?.id
        ?? result?.data?.data?.id
        ?? result?.form?.message?.data?.id;
      if (id) {
        goto(`/user/iot/preclaims/${id}`);
      } else {
        goto('/user/iot/preclaims');
      }
    }
  });

  const fileAccept = 
    "text/csv, .csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel";

  // Follow resources pattern: container ref, hidden native input, upload state
  let containerRef: HTMLDivElement;
  let nativeFileInput: HTMLInputElement | null = null;
  let uploadedFiles: File[] = [];
  let uploadError = '';
  let uploadSuccess = '';

  function syncToNativeInput(file: File) {
    if (nativeFileInput) {
      const dt = new DataTransfer();
      dt.items.add(file);
      nativeFileInput.files = dt.files;
    }
  }

  function handleFileUpload(event: CustomEvent<{ files: File[] }>) {
    const files = event.detail.files;
    if (!files?.length) return;
    const file = files[0];
    uploadedFiles = [file];
    syncToNativeInput(file);
    uploadError = '';
    uploadSuccess = `File "${file.name}" selected`;
  }

  function handleFileRemove() {
    uploadedFiles = [];
    uploadSuccess = '';
    if (nativeFileInput) nativeFileInput.value = '';
  }

  function submitForm() {
    const realForm = document.querySelector('form[action="?/upload"]') as HTMLFormElement | null;
    if (!realForm) return;
    if (!uploadedFiles.length) {
      uploadError = 'File is required (CSV).';
      return;
    }
    if (nativeFileInput && (!nativeFileInput.files || nativeFileInput.files.length === 0)) {
      syncToNativeInput(uploadedFiles[0]);
    }
    if (typeof realForm.requestSubmit === 'function') realForm.requestSubmit();
    else if (typeof realForm.submit === 'function') realForm.submit();
  }

  function downloadTemplate() {
    const headers = ['macId', 'name', 'description', 'expiresAt'];
    const sample = ['AA:BB:CC:DD:EE:FF', 'My Device', 'Optional description', '2030-12-31'];
    const csv = [headers.join(','), sample.join(',')].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'preclaim_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function submitUpload() {
    const f = document.querySelector('form[action="?/upload"]') as HTMLFormElement | null;
    if (f) f.requestSubmit();
  }
</script>

<UserPageLayout
  title={pageTitle}
  crumbs={pageCrumbs}
  actionButtons={[{
    label: "Back",
    icon: ArrowLeft,
    onClick: () => goto('/user/iot/preclaims')
  },{
    label: "Download CSV Template",
    icon: Download,
    onClick: downloadTemplate
  },{
    label: "Upload",
    icon: Save,
    disabled: $submitting,
    onClick: submitForm
  }]}
>
  <Card class="w-full">
    <CardContent class="pt-6">
      <FormContainer
        method="POST"
        action="?/upload"
        {enhance}
        enctype="multipart/form-data"
        novalidate
        errorMessage={$errorMessage}
        disabled={$submitting}
      >
        <div class="space-y-6" bind:this={containerRef}>
          <input type="file" name="file" class="sr-only" aria-hidden="true" bind:this={nativeFileInput} />

          <FormRow columns={1}>
            <FormField id="name" label="Set Name" error={$errors.name} required={true}>
              <Input id="name" name="name" type="text" bind:value={$form.name} {...$constraints.name} />
            </FormField>
          </FormRow>

          <FormRow columns={1}>
            <FormField id="description" label="Description" error={$errors.description}>
              <Textarea id="description" name="description" rows={3} bind:value={$form.description} />
            </FormField>
          </FormRow>

          <FormRow columns={1}>
            <FormField id="expiresAt" label="Expiry Date" error={$errors.expiresAt}>
              <EnhancedDatePicker id="expiresAt" name="expiresAt" form={$form} field="expiresAt" format_string="yyyy-MM-dd" clearable={true} />
            </FormField>
          </FormRow>

          <FormRow columns={1}>
            <FormField id="file" label="Upload File (CSV or Excel)" error={uploadError} required={true}>
              <EnhancedFileUpload
                id="file"
                name="file"
                accept={fileAccept}
                bind:value={uploadedFiles}
                multiple={false}
                preview={false}
                on:change={handleFileUpload}
                on:drop={handleFileUpload}
                on:paste={handleFileUpload}
                on:remove={handleFileRemove}
                on:error={(e) => (uploadError = e.detail?.message || 'Upload error')}
              />
              <p class="text-xs text-muted-foreground mt-1">CSV header must include macId or mac. Optional: name, description, expiresAt (yyyy-MM-dd).</p>
              {#if uploadSuccess}
                <p class="text-xs text-green-600 font-medium mt-1">✓ {uploadSuccess}</p>
              {/if}
            </FormField>
          </FormRow>
        </div>
      </FormContainer>
    </CardContent>
  </Card>
</UserPageLayout>
