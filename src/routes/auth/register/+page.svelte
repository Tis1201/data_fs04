<script lang="ts">
    import { superForm } from 'sveltekit-superforms/client';
    import { InputField } from '$lib/design-system/components';
    import '$lib/design-system/tokens/index.css';
    import type { PageData } from './$types';
    import { toast } from 'svelte-sonner';
    import { registerSchema } from '$lib/schemas/auth';
    import { zodClient } from 'sveltekit-superforms/adapters';
    import { goto } from '$app/navigation';

    export let data: PageData;

    let serverError: string | null = null;
    let showPassword = false;
    let showConfirmPassword = false;

    const { form, errors, enhance, submitting } = superForm(data.form, {
        validators: zodClient(registerSchema),
        taintedMessage: null,
        onResult: async ({ result }) => {
            if (result.type === 'success') {
                const redirectPath = result.data?.redirectTo || '/user';
                toast.success('Account created successfully! Welcome aboard!');
                try {
                    await goto(redirectPath);
                } catch (error) {
                    toast.error('Failed to redirect. Please try again.');
                }
            } else if (result.type === 'failure') {
                toast.error($errors._errors?.[0] || 'Registration failed');
            }
        },
        onError: ({ result }) => {
            const err = result.error;
            serverError = err && typeof err === 'string' ? err : (err && 'message' in err ? (err as { message: string }).message : 'An unexpected error occurred');
        },
        dataType: 'json'
    });
</script>

<div class="auth-page">
    <div class="auth-card">

        <!-- Logo -->
        <div class="auth-logo">
            <img src="/data-realities-logo.svg" alt="Data Realities" class="auth-logo-img" />
        </div>

        <form method="POST" use:enhance class="auth-form">
            <div class="auth-fields">
                <!-- Back button + heading -->
                <div class="register-header">
                    <a href="/auth/login" class="back-btn" aria-label="Go back to login">
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                            <path d="M15.8337 10.0001H4.16699M4.16699 10.0001L10.0003 15.8334M4.16699 10.0001L10.0003 4.16675" stroke="#292929" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </a>
                    <h2 class="register-title">Create account</h2>
                </div>

                {#if serverError}
                    <div class="server-error">{serverError}</div>
                {/if}

                {#if $errors._errors?.[0]}
                    <div class="server-error">{$errors._errors[0]}</div>
                {/if}

                <InputField
                    label="Full Name"
                    type="text"
                    name="name"
                    bind:value={$form.name}
                    placeholder="Enter"
                    state={$errors.name ? 'error' : 'default'}
                    helperText={$errors.name?.[0] ?? ''}
                    disabled={$submitting}
                    autocomplete="name"
                />

                <InputField
                    label="Email"
                    type="email"
                    name="email"
                    bind:value={$form.email}
                    placeholder="name@email.com"
                    state={$errors.email ? 'error' : 'default'}
                    helperText={$errors.email?.[0] ?? ''}
                    disabled={$submitting}
                    autocomplete="email"
                />

                <InputField
                    label="Password"
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    bind:value={$form.password}
                    placeholder="Enter"
                    state={$errors.password ? 'error' : 'default'}
                    helperText={$errors.password?.[0] ?? ''}
                    disabled={$submitting}
                    autocomplete="new-password"
                    suffixIcon={true}
                >
                    <button
                        slot="suffix-icon"
                        type="button"
                        class="eye-btn"
                        on:click={() => (showPassword = !showPassword)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                        {#if showPassword}
                            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                                <path d="M2.42012 11.7519C2.28394 11.5186 2.21584 11.4019 2.17772 11.2232C2.14909 11.0879 2.14909 10.8973 2.17772 10.762C2.21584 10.5833 2.28394 10.4666 2.42012 10.2333C3.54553 8.36714 6.89118 3.66675 11.0003 3.66675C15.1094 3.66675 18.4551 8.36714 19.5805 10.2333C19.7167 10.4666 19.7848 10.5833 19.8229 10.762C19.8515 10.8973 19.8515 11.0879 19.8229 11.2232C19.7848 11.4019 19.7167 11.5186 19.5805 11.7519C18.4551 13.6181 15.1094 18.3334 11.0003 18.3334C6.89118 18.3334 3.54553 13.6181 2.42012 11.7519Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                                <path d="M11.0003 13.7501C12.5191 13.7501 13.7503 12.519 13.7503 11.0001C13.7503 9.48129 12.5191 8.25012 11.0003 8.25012C9.48149 8.25012 8.25033 9.48129 8.25033 11.0001C8.25033 12.519 9.48149 13.7501 11.0003 13.7501Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        {:else}
                            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                                <path d="M9.74263 4.00308C10.1513 3.93054 10.5714 3.8934 11.0003 3.8934C15.1094 3.8934 18.4551 8.59379 19.5805 10.46C19.7167 10.6933 19.7848 10.81 19.8229 10.9887C19.8515 11.124 19.8515 11.3146 19.8229 11.4499C19.7848 11.6286 19.7162 11.7449 19.5792 11.977C19.2404 12.5592 18.7254 13.3681 18.0512 14.2119M12.3337 5.43357C12.5698 5.4937 12.8007 5.56814 13.0253 5.65624C14.4477 6.21268 15.5697 7.33468 16.1261 8.7571C16.2142 8.98165 16.2886 9.21257 16.3488 9.44868M3.03386 3.66675L19.6672 18.3334M9.1153 9.66675C8.73487 10.0908 8.50033 10.6541 8.50033 11.2701C8.50033 12.7889 9.73149 14.0201 11.2503 14.0201C11.8663 14.0201 12.4296 13.7855 12.8537 13.4051M4.59366 7.55675C3.54261 8.46049 2.7328 9.58441 2.42012 10.1166C2.28394 10.3499 2.21584 10.4666 2.17772 10.6453C2.14909 10.7806 2.14909 10.9712 2.17772 11.1065C2.21584 11.2852 2.28394 11.4019 2.42012 11.6352C3.54553 13.5014 6.89118 18.2017 11.0003 18.2017C12.7456 18.2017 14.3453 17.494 15.7111 16.4536" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        {/if}
                    </button>
                </InputField>

                <InputField
                    label="Confirm Password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    name="confirmPassword"
                    bind:value={$form.confirmPassword}
                    placeholder="Enter"
                    state={$errors.confirmPassword ? 'error' : 'default'}
                    helperText={$errors.confirmPassword?.[0] ?? ''}
                    disabled={$submitting}
                    autocomplete="new-password"
                    suffixIcon={true}
                >
                    <button
                        slot="suffix-icon"
                        type="button"
                        class="eye-btn"
                        on:click={() => (showConfirmPassword = !showConfirmPassword)}
                        aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                    >
                        {#if showConfirmPassword}
                            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                                <path d="M2.42012 11.7519C2.28394 11.5186 2.21584 11.4019 2.17772 11.2232C2.14909 11.0879 2.14909 10.8973 2.17772 10.762C2.21584 10.5833 2.28394 10.4666 2.42012 10.2333C3.54553 8.36714 6.89118 3.66675 11.0003 3.66675C15.1094 3.66675 18.4551 8.36714 19.5805 10.2333C19.7167 10.4666 19.7848 10.5833 19.8229 10.762C19.8515 10.8973 19.8515 11.0879 19.8229 11.2232C19.7848 11.4019 19.7167 11.5186 19.5805 11.7519C18.4551 13.6181 15.1094 18.3334 11.0003 18.3334C6.89118 18.3334 3.54553 13.6181 2.42012 11.7519Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                                <path d="M11.0003 13.7501C12.5191 13.7501 13.7503 12.519 13.7503 11.0001C13.7503 9.48129 12.5191 8.25012 11.0003 8.25012C9.48149 8.25012 8.25033 9.48129 8.25033 11.0001C8.25033 12.519 9.48149 13.7501 11.0003 13.7501Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        {:else}
                            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                                <path d="M9.74263 4.00308C10.1513 3.93054 10.5714 3.8934 11.0003 3.8934C15.1094 3.8934 18.4551 8.59379 19.5805 10.46C19.7167 10.6933 19.7848 10.81 19.8229 10.9887C19.8515 11.124 19.8515 11.3146 19.8229 11.4499C19.7848 11.6286 19.7162 11.7449 19.5792 11.977C19.2404 12.5592 18.7254 13.3681 18.0512 14.2119M12.3337 5.43357C12.5698 5.4937 12.8007 5.56814 13.0253 5.65624C14.4477 6.21268 15.5697 7.33468 16.1261 8.7571C16.2142 8.98165 16.2886 9.21257 16.3488 9.44868M3.03386 3.66675L19.6672 18.3334M9.1153 9.66675C8.73487 10.0908 8.50033 10.6541 8.50033 11.2701C8.50033 12.7889 9.73149 14.0201 11.2503 14.0201C11.8663 14.0201 12.4296 13.7855 12.8537 13.4051M4.59366 7.55675C3.54261 8.46049 2.7328 9.58441 2.42012 10.1166C2.28394 10.3499 2.21584 10.4666 2.17772 10.6453C2.14909 10.7806 2.14909 10.9712 2.17772 11.1065C2.21584 11.2852 2.28394 11.4019 2.42012 11.6352C3.54553 13.5014 6.89118 18.2017 11.0003 18.2017C12.7456 18.2017 14.3453 17.494 15.7111 16.4536" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        {/if}
                    </button>
                </InputField>
            </div>

            <div class="auth-actions">
                <button
                    type="submit"
                    class="auth-submit-btn"
                    disabled={$submitting}
                >
                    {$submitting ? 'Creating account...' : 'Sign Up'}
                </button>

                <div class="auth-switch-link">
                    <span>Already have an account? </span>
                    <a href="/auth/login" class="auth-link">Log in</a>
                </div>
            </div>
        </form>

    </div>
</div>

<style>
    .auth-page {
        min-height: 100vh;
        background-color: var(--ds-color-gray-100);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 2rem 1rem;
    }

    .auth-card {
        width: 100%;
        max-width: 550px;
        background: var(--ds-color-white);
        border: 1px solid var(--ds-color-neutral-true-200);
        border-radius: 16px;
        box-shadow: 0px 20px 24px -4px rgba(16, 24, 40, 0.08), 0px 8px 8px -4px rgba(16, 24, 40, 0.03);
        padding: 32px;
        display: flex;
        flex-direction: column;
        gap: 24px;
    }

    .auth-logo {
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .auth-logo-img {
        height: 32px;
        width: auto;
    }

    .auth-form {
        display: flex;
        flex-direction: column;
        gap: 24px;
        width: 100%;
    }

    .auth-fields {
        display: flex;
        flex-direction: column;
        gap: 16px;
        width: 100%;
    }

    /* Register header */
    .register-header {
        display: flex;
        flex-direction: column;
        gap: 16px;
    }

    .back-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 40px;
        height: 40px;
        background-color: var(--ds-color-white);
        border: 1px solid var(--ds-color-neutral-true-300);
        border-radius: 8px;
        box-shadow: 0px 1px 2px rgba(16, 24, 40, 0.05);
        cursor: pointer;
        transition: background-color 0.15s ease;
        flex-shrink: 0;
        text-decoration: none;
    }

    .back-btn:hover {
        background-color: var(--ds-color-neutral-true-50);
    }

    .register-title {
        font-family: var(--ds-font-family-primary);
        font-weight: 600;
        font-size: 26px;
        line-height: 32px;
        letter-spacing: -0.13px;
        color: var(--ds-color-neutral-true-800);
        margin: 0;
    }

    .eye-btn {
        background: none;
        border: none;
        padding: 0;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--ds-color-neutral-true-400);
        line-height: 0;
    }

    .eye-btn:hover {
        color: var(--ds-color-neutral-true-600);
    }

    .auth-actions {
        display: flex;
        flex-direction: column;
        gap: 8px;
        width: 100%;
    }

    .auth-submit-btn {
        width: 100%;
        padding: 10px 18px;
        background-color: var(--ds-color-blue-light-600);
        border: 1px solid var(--ds-color-blue-light-600);
        border-radius: 8px;
        box-shadow: 0px 1px 2px rgba(16, 24, 40, 0.05);
        font-family: var(--ds-font-family-primary);
        font-weight: 500;
        font-size: 16px;
        line-height: 24px;
        color: var(--ds-color-white);
        cursor: pointer;
        transition: background-color 0.15s ease, border-color 0.15s ease;
    }

    .auth-submit-btn:hover:not(:disabled) {
        background-color: var(--ds-color-blue-light-700);
        border-color: var(--ds-color-blue-light-700);
    }

    .auth-submit-btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }

    .auth-switch-link {
        text-align: center;
        padding: 10px 16px;
        font-family: var(--ds-font-family-primary);
        font-weight: 500;
        font-size: 14px;
        line-height: 20px;
        color: var(--ds-color-neutral-true-800);
    }

    .auth-link {
        color: var(--ds-color-blue-light-700);
        text-decoration: none;
        font-weight: 500;
    }

    .auth-link:hover {
        text-decoration: underline;
    }

    .server-error {
        padding: 10px 14px;
        background-color: var(--ds-color-error-50);
        border: 1px solid var(--ds-color-error-200);
        border-radius: 8px;
        font-family: var(--ds-font-family-primary);
        font-size: 14px;
        color: var(--ds-color-error-600);
    }
</style>
