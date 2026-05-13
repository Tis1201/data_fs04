<script lang="ts">
    import { goto } from "$app/navigation";
    import { superForm } from "sveltekit-superforms/client";
    import { zod } from "sveltekit-superforms/adapters";
    import { toast } from "svelte-sonner";
    import { ArrowLeft, Save } from "lucide-svelte";
    import { Button, InputField, TextareaField, Dropdown, Alert } from "$lib/design-system/components";

    import type { PageData } from "./$types";
import { DESCRIPTION_MAX } from "$lib/constants/description";
    import CharacterCount from "$lib/components/ui_components_sveltekit/form/CharacterCount.svelte";
    import { radarSensorSchema } from "../../../../admin/controllers/radar/new/radar-sensor";
    import { getDetailPageFormConfig, processFormMessages } from "$lib/utils/formHelpers";

    export let data: PageData;
    const title = "Register Radar Controller";

    // Enhanced SuperForms setup
    const {
        form,
        errors,
        enhance,
        submitting,
        message,
        delayed,
        timeout,
        tainted,
    } = superForm(data.form, {
        validators: zod(radarSensorSchema),
        ...getDetailPageFormConfig("Radar Controller"),
        onResult: async ({ result }) => {
            if (result.type === "success") {
                toast.success("Radar Controller created successfully!");
                // Redirect will be handled by server action
            } else if (result.type === "failure") {
                const errorData = result.data?.error;
                if (errorData) {
                    serverError = errorData;
                    toast.error(errorData);
                } else {
                    const formErrors = result.data?.form?.errors;
                    if (formErrors) {
                        const errorMessages: string[] = [];
                        Object.entries(formErrors).forEach(([field, errors]) => {
                            if (Array.isArray(errors) && errors.length > 0) {
                                errorMessages.push(`${field}: ${errors[0]}`);
                            }
                        });
                        if (errorMessages.length > 0) {
                            serverError = errorMessages.join(", ");
                            toast.error(serverError);
                        }
                    }
                }
            }
        },
        onError: ({ result }) => {
            toast.error(result.error.message || "Failed to submit form");
        },
    });

    // Reactive states
    $: isLoading = $submitting || $delayed;
    $: hasTimeout = $timeout;
    $: ({ errorMessage } = processFormMessages($message));
    $: hasChanges = $tainted;

    interface DeviceWithAccount {
        id: string;
        name: string;
        hardwareId: string | null;
        accountId: string;
        account?: { id: string; name: string } | null;
    }
    
    let selectedDevice: DeviceWithAccount | null = null;

    // Server error state
    let serverError = "";

    // Form submission handler
    function triggerSubmit() {
        const formElement = document.querySelector(
            'form[action="?/create"]',
        ) as HTMLFormElement;
        if (formElement) formElement.requestSubmit();
    }

    // Clear server error when interacting with form
    $: if ($form.deviceId || $form.name || $form.serialNumber) {
        if (serverError) serverError = "";
    }

    // Always bind form to current account (required by schema; avoids "Account is required" when device not yet selected)
    $: if (data.currentAccountId) {
        $form.accountId = data.currentAccountId;
    }

    // Auto-fill logic when device is selected
    $: if ($form.deviceId) {
        // Find device by ID and coerce to DeviceWithAccount, normalizing accountId to string
        const rawDevice = data.devices.find((d: any) => d.id === $form.deviceId) || null;
        if (rawDevice) {
            // Defensive: device.accountId may be null, so default to empty string if missing
            selectedDevice = {
                id: rawDevice.id,
                name: rawDevice.name,
                hardwareId: rawDevice.hardwareId,
                accountId: typeof rawDevice.accountId === "string" ? rawDevice.accountId : "",
                account: rawDevice.account ?? null
            };
            // Auto-fill serial number
            if (!$form.serialNumber) {
                if (selectedDevice.hardwareId) {
                    $form.serialNumber = selectedDevice.hardwareId;
                } else if (selectedDevice.name) {
                    const nameMatch = selectedDevice.name.match(/\(([^)]+)\)|-\s*([A-F0-9:]+)$/i);
                    if (nameMatch) {
                        $form.serialNumber = nameMatch[1] || nameMatch[2] || selectedDevice.name;
                    } else {
                        $form.serialNumber = selectedDevice.name;
                    }
                } else {
                    $form.serialNumber = selectedDevice.id.substring(0, 20);
                }
            }
            
            // Auto-fill name
            if (selectedDevice.name && !$form.name) {
                $form.name = `${selectedDevice.name} - Radar`;
            }
        }
    } else {
        selectedDevice = null;
    }

    const statusOptions = [
        { id: "ACTIVE", label: "Active" },
        { id: "INACTIVE", label: "Inactive" },
        { id: "MAINTENANCE", label: "Maintenance" },
    ];

    // Device options for Dropdown (id + label)
    $: deviceOptions = data.devices.map((device: { id: string; name: string; hardwareId: string | null }) => {
        const label = device.hardwareId
            ? `${device.name} (${device.hardwareId})`
            : device.name;
        return { id: device.id, label };
    });

    // Type-safe error access (SuperFormErrors type is strict; runtime has field keys)
    type ErrorsRecord = Record<string, string | string[] | null | undefined>;
    $: errorsRecord = $errors as ErrorsRecord;
    const err = (o: ErrorsRecord, key: string) => o?.[key];

    function handleDeviceChange(e: CustomEvent<string | string[]>) {
        $form.deviceId = (e.detail as string) || null;
    }
    function handleStatusChange(e: CustomEvent<string | string[]>) {
        const v = e.detail;
        const next = (typeof v === "string" ? v : v?.[0]) || "ACTIVE";
        $form.status = next as "ACTIVE" | "INACTIVE" | "MAINTENANCE";
    }

    $: serialNumberHelper = (err(errorsRecord, "serialNumber") as string) || "Must be unique across all controllers";
</script>

<div class="register-radar-wrap">
    <div class="register-radar-header">
        <div>
            <h1 class="register-radar-title">{title}</h1>
            <p class="register-radar-subtitle">
                Register a new radar controller for your account
            </p>
        </div>
        <Button
            variant="outline"
            color="gray"
            size="md"
            on:click={() => goto("/user/controllers/radar")}
        >
            <ArrowLeft size={18} slot="icon-left" />
            Cancel
        </Button>
    </div>

    <form
        method="POST"
        action="?/create"
        use:enhance
        novalidate
        class="register-radar-form"
    >
        {#if serverError}
            <div class="register-radar-alert">
                <Alert
                    severity="error"
                    variant="outline"
                    title="Registration failed"
                    message={serverError + " Select a different device or use a unique serial number."}
                    dismissible={false}
                />
            </div>
        {/if}

        <div class="register-radar-fields">
            <div class="register-radar-row">
                <div class="register-radar-field">
                    <label class="register-radar-label" for="deviceId">Device <span class="required">*</span></label>
                    <Dropdown
                        label=""
                        placeholder="Select a device"
                        options={deviceOptions}
                        value={$form.deviceId ?? ""}
                        required={true}
                        disabled={isLoading}
                        error={!!err(errorsRecord, "deviceId")}
                        errorMessage={String(err(errorsRecord, "deviceId") || "")}
                        width="100%"
                        on:change={handleDeviceChange}
                    />
                    <input type="hidden" name="deviceId" value={$form.deviceId ?? ""} />
                    {#if selectedDevice}
                        <p class="register-radar-helper">Device from your account will be used</p>
                    {/if}
                </div>
                <div class="register-radar-field">
                    <label class="register-radar-label" for="status">Status</label>
                    <Dropdown
                        label=""
                        placeholder="Select"
                        options={statusOptions}
                        value={$form.status ?? "ACTIVE"}
                        disabled={isLoading}
                        error={!!err(errorsRecord, "status")}
                        errorMessage={String(err(errorsRecord, "status") || "")}
                        width="100%"
                        on:change={handleStatusChange}
                    />
                    <input type="hidden" name="status" value={$form.status ?? ""} />
                </div>
            </div>

            <div class="register-radar-row">
                <div class="register-radar-field">
                    <InputField
                        id="name"
                        name="name"
                        label="Sensor Name"
                        type="text"
                        bind:value={$form.name}
                        placeholder="e.g., Main Hall Radar"
                        required={true}
                        disabled={isLoading}
                        state={err(errorsRecord, "name") ? "error" : "default"}
                        helperText={String(err(errorsRecord, "name") || "")}
                    />
                </div>
                <div class="register-radar-field">
                    <InputField
                        id="serialNumber"
                        name="serialNumber"
                        label="Serial Number"
                        type="text"
                        bind:value={$form.serialNumber}
                        placeholder="e.g., RADAR-001"
                        required={true}
                        disabled={isLoading}
                        state={err(errorsRecord, "serialNumber") ? "error" : "default"}
                        helperText={serialNumberHelper}
                    />
                </div>
            </div>

            <div class="register-radar-row register-radar-row-full">
                    <TextareaField
                        id="description"
                        name="description"
                        label="Description"
                        value={$form.description ?? ""}
                        on:input={(e) => { $form.description = e.detail ?? ""; }}
                        placeholder="Optional description"
                        rows={3}
                        maxlength={DESCRIPTION_MAX}
                        disabled={isLoading}
                        state={err(errorsRecord, "description") ? "error" : "default"}
                        helperText={String(err(errorsRecord, "description") || "")}
                    />
                    <CharacterCount current={$form.description?.length ?? 0} max={DESCRIPTION_MAX} />
            </div>

            <div class="register-radar-row">
                <div class="register-radar-field">
                    <InputField
                        id="location"
                        name="location"
                        label="Location"
                        type="text"
                        value={$form.location ?? ""}
                        on:input={(e) => { $form.location = e.detail || null; }}
                        placeholder="e.g., Building A, Floor 2"
                        disabled={isLoading}
                        state={err(errorsRecord, "location") ? "error" : "default"}
                        helperText={String(err(errorsRecord, "location") || "")}
                    />
                </div>
                <div class="register-radar-field">
                    <InputField
                        id="firmware"
                        name="firmware"
                        label="Firmware Version"
                        type="text"
                        value={$form.firmware ?? ""}
                        on:input={(e) => { $form.firmware = e.detail || null; }}
                        placeholder="e.g., v1.0.0"
                        disabled={isLoading}
                        state={err(errorsRecord, "firmware") ? "error" : "default"}
                        helperText={String(err(errorsRecord, "firmware") || "")}
                    />
                </div>
            </div>

            <input type="hidden" name="accountId" bind:value={$form.accountId} />

            <div class="register-radar-actions">
                <Button
                    type="button"
                    variant="outline"
                    color="gray"
                    size="md"
                    on:click={() => goto("/user/controllers/radar")}
                    disabled={isLoading}
                >
                    Cancel
                </Button>
                <Button
                    type="submit"
                    variant="filled"
                    color="primary"
                    size="md"
                    disabled={isLoading}
                >
                    {#if isLoading}
                        <span class="register-radar-spinner" aria-hidden="true">...</span>
                    {:else}
                        <Save size={18} slot="icon-left" />
                    {/if}
                    Register Controller
                </Button>
            </div>
        </div>
    </form>
</div>

<style>
    .register-radar-wrap {
        max-width: 960px;
        margin: 0 auto;
        padding: var(--ds-space-6, 24px);
        font-family: var(--ds-font-family-primary);
    }
    .register-radar-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: var(--ds-space-6, 24px);
    }
    .register-radar-title {
        margin: 0 0 var(--ds-space-1, 4px) 0;
        font: var(--ds-text-xl-medium, 1.25rem 600);
        color: var(--ds-text-primary);
    }
    .register-radar-subtitle {
        margin: 0;
        font: var(--ds-text-sm-regular, 0.875rem 400);
        color: var(--ds-text-secondary);
    }
    .register-radar-form {
        width: 100%;
    }
    .register-radar-alert {
        margin-bottom: var(--ds-space-4, 16px);
    }
    .register-radar-fields {
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-6, 24px);
    }
    .register-radar-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: var(--ds-space-4, 16px);
    }
    .register-radar-row-full {
        grid-template-columns: 1fr;
    }
    .register-radar-field {
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-1, 4px);
    }
    .register-radar-label {
        font-size: var(--ds-text-sm, 0.875rem);
        font-weight: 500;
        color: var(--ds-text-primary);
    }
    .register-radar-label .required {
        color: var(--ds-color-error-500);
    }
    .register-radar-helper {
        margin: 0;
        font-size: var(--ds-text-xs, 0.75rem);
        color: var(--ds-text-tertiary);
    }
    .register-radar-actions {
        display: flex;
        justify-content: flex-end;
        gap: var(--ds-space-3, 12px);
        padding-top: var(--ds-space-4, 16px);
    }
    .register-radar-spinner {
        display: inline-block;
    }
    .char-count {
        margin: 4px 0 0;
        font-size: var(--ds-text-xs);
        color: var(--ds-color-neutral-true-500);
    }
    .char-count.char-count-limit {
        color: var(--ds-color-amber-600, #d97706);
    }
</style>

