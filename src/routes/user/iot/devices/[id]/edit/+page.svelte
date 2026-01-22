<script lang="ts">
    import { goto } from "$app/navigation";
    import { Button, Card, InputField, TextareaField } from "$lib/design-system/components";
    import { Save, X } from "lucide-svelte";
    import { createFormHandler } from "$lib/components/ui_components_sveltekit/form/utils/formHandler";
    import { createSuccessResponse } from "$lib/types/api";
    import type { PageData } from "./$types";

    export let data: PageData;
    const { device } = data;

    // Setup the form with automatic redirect
    const { form, errors, enhance, submitting, errorMessage } = createFormHandler(data.form, {
        successRedirect: `/user/iot/devices/${device.id}`,
        validateOnInput: true,
        onSuccess: (result) => {
            return createSuccessResponse({
                message: result.data?.message || "Device updated successfully"
            }) as any;
        }
    });

    // Coerce optional form fields for design-system inputs
    $: descriptionValue = (($form as any)?.description ?? '') as string;
    $: nameErr = Array.isArray($errors.name) ? $errors.name.join(', ') : ($errors.name || '');
    $: descErr = Array.isArray($errors.description) ? $errors.description.join(', ') : ($errors.description || '');

    function submitSave() {
        const formEl = document.querySelector('form[action="?/save"]') as HTMLFormElement | null;
        formEl?.requestSubmit();
    }

    function handleDescriptionInput(e: CustomEvent<string>) {
        ($form as any).description = e.detail;
    }
</script>

<div class="p-6 space-y-4" style="padding: 24px; gap: 16px;">
    <div class="flex items-center justify-end gap-3">
        <Button
            variant="outline"
            color="gray"
            size="lg"
            on:click={() => goto(`/user/iot/devices/${device.id}`)}
            style="height: 44px;"
        >
            <X size={20} slot="icon" />
            Cancel
        </Button>
        <Button
            variant="filled"
            color="primary"
            size="lg"
            disabled={$submitting}
            on:click={submitSave}
            style="height: 44px; background: #0086C9; border: 1px solid #0086C9; box-shadow: 0px 1px 2px rgba(16, 24, 40, 0.05);"
        >
            <Save size={20} slot="icon" />
            Save Changes
        </Button>
    </div>

    <Card
        title="Device Information"
        subtitle="Edit basic details for this IoT device. Only name and description can be modified."
        showHeader={true}
        padding="lg"
        variant="default"
        fullWidth={true}
    >
        <form method="POST" action="?/save" use:enhance class="space-y-4">
            {#if $errorMessage}
                <div class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm" style="font-family: var(--ds-font-family-primary);">
                    <div class="font-medium text-red-700">Failed to save</div>
                    <div class="text-red-700/90">{$errorMessage.error?.message || 'Please try again.'}</div>
                </div>
            {/if}

            <InputField
                id="name"
                name="name"
                label="Device Name"
                placeholder="Enter device name"
                bind:value={$form.name}
                state={nameErr ? 'error' : 'default'}
                helperText={nameErr}
                required
            />

            <TextareaField
                id="description"
                name="description"
                label="Description"
                placeholder="Enter device description"
                value={descriptionValue}
                on:input={handleDescriptionInput}
                state={descErr ? 'error' : 'default'}
                helperText={descErr}
                rows={3}
            />

            <!-- Hidden fields -->
            <input type="hidden" name="id" value={$form.id} />
            <input type="hidden" name="status" value={$form.status} />
        </form>
    </Card>
</div>
