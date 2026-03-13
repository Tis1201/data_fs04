<script lang="ts">
    import { onMount } from 'svelte';
    import { superForm } from 'sveltekit-superforms/client';
    import { InputField } from '$lib/design-system/components';
    import '$lib/design-system/tokens/index.css';
    import { loginSchema, forgotPasswordSchema, registerSchema } from '$lib/schemas/auth';
    import { zodClient } from 'sveltekit-superforms/adapters';
    import type { PageData } from './$types';
    import { toast } from 'svelte-sonner';
    import { goto } from '$app/navigation';

    export let data: PageData;

    type AuthView = 'login' | 'forgot-password' | 'register';
    let currentView: AuthView = 'login';
    let isHydrated = false;
    let showPassword = false;
    let showRegPassword = false;
    let showRegConfirmPassword = false;

    onMount(() => {
        isHydrated = true;
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { form, errors, enhance, submitting } = superForm(data.form as any, {
        validators: zodClient(loginSchema),
        taintedMessage: null,
        onResult: ({ result }) => {
            if (result.type === 'failure') {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const errs = (result.data as any)?.form?.errors?._errors;
                const msg = Array.isArray(errs) ? errs[0] : null;
                toast.error(msg || 'Invalid email or password');
            }
        },
        onError: ({ result }) => {
            const msg = typeof result.error === 'string' ? result.error : 'An unexpected error occurred';
            toast.error(msg);
        }
    });

    const forgotPasswordForm = superForm(data.forgotPasswordForm!, {
        validators: zodClient(forgotPasswordSchema),
        taintedMessage: null,
        onResult: async ({ result }) => {
            if (result.type === 'success') {
                toast.success(result.data?.message || 'Password reset email sent');
                currentView = 'login';
            } else if (result.type === 'failure') {
                toast.error('Please check your email and try again');
            }
        },
        onError: () => {
            toast.error('An error occurred. Please try again.');
        },
        dataType: 'json'
    });

    const {
        form: forgotForm,
        errors: forgotErrors,
        enhance: forgotEnhance,
        submitting: forgotSubmitting
    } = forgotPasswordForm;

    const registerFormStore = superForm(data.registerForm!, {
        validators: zodClient(registerSchema),
        taintedMessage: null,
        onResult: async ({ result }) => {
            if (result.type === 'success') {
                const redirectPath = result.data?.redirectTo || '/user';
                toast.success('Account created successfully! Welcome aboard!');
                try {
                    await goto(redirectPath);
                } catch {
                    toast.error('Failed to redirect. Please try again.');
                }
            } else if (result.type === 'failure') {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const errs = (result.data as any)?.registerForm?.errors?._errors;
                const msg = Array.isArray(errs) ? errs[0] : null;
                toast.error(msg || 'Registration failed. Please try again.');
            }
        },
        onError: () => {
            toast.error('An error occurred during registration. Please try again.');
        },
        dataType: 'json'
    });

    const {
        form: regForm,
        errors: regErrors,
        enhance: regEnhance,
        submitting: regSubmitting
    } = registerFormStore;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function firstError(errs: any): string {
        if (!errs) return '';
        if (Array.isArray(errs)) return errs[0] ?? '';
        return '';
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    $: regFormError = firstError(($regErrors as any)?._errors);

    // Reusable eye icon SVGs
    const eyeOpenSvg = `<svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M2.42012 11.7519C2.28394 11.5186 2.21584 11.4019 2.17772 11.2232C2.14909 11.0879 2.14909 10.8973 2.17772 10.762C2.21584 10.5833 2.28394 10.4666 2.42012 10.2333C3.54553 8.36714 6.89118 3.66675 11.0003 3.66675C15.1094 3.66675 18.4551 8.36714 19.5805 10.2333C19.7167 10.4666 19.7848 10.5833 19.8229 10.762C19.8515 10.8973 19.8515 11.0879 19.8229 11.2232C19.7848 11.4019 19.7167 11.5186 19.5805 11.7519C18.4551 13.6181 15.1094 18.3334 11.0003 18.3334C6.89118 18.3334 3.54553 13.6181 2.42012 11.7519Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M11.0003 13.7501C12.5191 13.7501 13.7503 12.519 13.7503 11.0001C13.7503 9.48129 12.5191 8.25012 11.0003 8.25012C9.48149 8.25012 8.25033 9.48129 8.25033 11.0001C8.25033 12.519 9.48149 13.7501 11.0003 13.7501Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

    const eyeOffSvg = `<svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M9.74263 4.00308C10.1513 3.93054 10.5714 3.8934 11.0003 3.8934C15.1094 3.8934 18.4551 8.59379 19.5805 10.46C19.7167 10.6933 19.7848 10.81 19.8229 10.9887C19.8515 11.124 19.8515 11.3146 19.8229 11.4499C19.7848 11.6286 19.7162 11.7449 19.5792 11.977C19.2404 12.5592 18.7254 13.3681 18.0512 14.2119M12.3337 5.43357C12.5698 5.4937 12.8007 5.56814 13.0253 5.65624C14.4477 6.21268 15.5697 7.33468 16.1261 8.7571C16.2142 8.98165 16.2886 9.21257 16.3488 9.44868M3.03386 3.66675L19.6672 18.3334M9.1153 9.66675C8.73487 10.0908 8.50033 10.6541 8.50033 11.2701C8.50033 12.7889 9.73149 14.0201 11.2503 14.0201C11.8663 14.0201 12.4296 13.7855 12.8537 13.4051M4.59366 7.55675C3.54261 8.46049 2.7328 9.58441 2.42012 10.1166C2.28394 10.3499 2.21584 10.4666 2.17772 10.6453C2.14909 10.7806 2.14909 10.9712 2.17772 11.1065C2.21584 11.2852 2.28394 11.4019 2.42012 11.6352C3.54553 13.5014 6.89118 18.2017 11.0003 18.2017C12.7456 18.2017 14.3453 17.494 15.7111 16.4536" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

    const backArrowSvg = `<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M15.8337 10.0001H4.16699M4.16699 10.0001L10.0003 15.8334M4.16699 10.0001L10.0003 4.16675" stroke="#292929" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
</script>

<div class="auth-page">
    <div class="auth-card">

        <!-- Logo -->
        <div class="auth-logo">
            <img src="/data-realities-logo.svg" alt="Data Realities" class="auth-logo-img" />
        </div>

        {#if currentView === 'login'}
            <!-- ── LOGIN VIEW ── -->
            <form method="POST" action="?/login" use:enhance class="auth-form">
                {#if data.redirectTo}
                    <input type="hidden" name="redirectTo" value={data.redirectTo} />
                {/if}

                <div class="auth-fields">
                    <InputField
                        label="Email"
                        type="email"
                        name="email"
                        bind:value={$form.email}
                        placeholder="name@email.com"
                        state={$errors.email ? 'error' : 'default'}
                        helperText={firstError($errors.email)}
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
                        helperText={firstError($errors.password)}
                        disabled={$submitting}
                        autocomplete="current-password"
                        suffixIcon={true}
                    >
                        <button slot="suffix-icon" type="button" class="eye-btn"
                            on:click={() => (showPassword = !showPassword)}
                            aria-label={showPassword ? 'Hide password' : 'Show password'}>
                            {@html showPassword ? eyeOpenSvg : eyeOffSvg}
                        </button>
                    </InputField>

                    <div class="forgot-password-wrap">
                        <button type="button" class="text-action-btn"
                            on:click={() => (currentView = 'forgot-password')}>
                            Forgot Password?
                        </button>
                    </div>
                </div>

                <div class="auth-actions">
                    <button type="submit" class="auth-submit-btn" disabled={$submitting || !isHydrated}>
                        {$submitting ? 'Signing in...' : 'Sign in'}
                    </button>
                    <div class="auth-switch-link">
                        <span>Don't have an account? </span>
                        <button type="button" class="auth-link-btn"
                            on:click={() => (currentView = 'register')}>Sign up</button>
                    </div>
                </div>
            </form>

        {:else if currentView === 'forgot-password'}
            <!-- ── FORGOT PASSWORD VIEW ── -->
            <form method="POST" action="?/forgotPassword" use:forgotEnhance class="auth-form">
                <div class="auth-fields">
                    <div class="view-header">
                        <button type="button" class="back-btn"
                            on:click={() => (currentView = 'login')} aria-label="Go back to login">
                            {@html backArrowSvg}
                        </button>
                        <div class="view-title-wrap">
                            <h2 class="view-title">Forgot Password?</h2>
                            <p class="view-subtitle">Enter your email address to receive a password reset link</p>
                        </div>
                    </div>

                    <InputField
                        label="Email"
                        type="email"
                        name="email"
                        bind:value={$forgotForm.email}
                        placeholder="name@email.com"
                        state={$forgotErrors.email ? 'error' : 'default'}
                        helperText={$forgotErrors.email?.[0] ?? ''}
                        disabled={$forgotSubmitting}
                        autocomplete="email"
                    />
                </div>

                <div class="auth-actions">
                    <button type="submit" class="auth-submit-btn" disabled={$forgotSubmitting}>
                        {$forgotSubmitting ? 'Sending...' : 'Submit'}
                    </button>
                </div>
            </form>

        {:else}
            <!-- ── REGISTER VIEW ── -->
            <form method="POST" action="?/register" use:regEnhance class="auth-form">
                <div class="auth-fields">
                    <div class="view-header">
                        <button type="button" class="back-btn"
                            on:click={() => (currentView = 'login')} aria-label="Go back to login">
                            {@html backArrowSvg}
                        </button>
                        <h2 class="view-title">Create account</h2>
                    </div>

                    <InputField
                        label="Full Name"
                        type="text"
                        name="name"
                        bind:value={$regForm.name}
                        placeholder="Enter"
                        state={$regErrors.name ? 'error' : 'default'}
                        helperText={firstError($regErrors.name)}
                        disabled={$regSubmitting}
                        autocomplete="name"
                    />

                    <InputField
                        label="Email"
                        type="email"
                        name="email"
                        bind:value={$regForm.email}
                        placeholder="name@email.com"
                        state={$regErrors.email ? 'error' : 'default'}
                        helperText={firstError($regErrors.email)}
                        disabled={$regSubmitting}
                        autocomplete="email"
                    />

                    <InputField
                        label="Password"
                        type={showRegPassword ? 'text' : 'password'}
                        name="password"
                        bind:value={$regForm.password}
                        placeholder="Enter"
                        state={$regErrors.password ? 'error' : 'default'}
                        helperText={firstError($regErrors.password)}
                        disabled={$regSubmitting}
                        autocomplete="new-password"
                        suffixIcon={true}
                    >
                        <button slot="suffix-icon" type="button" class="eye-btn"
                            on:click={() => (showRegPassword = !showRegPassword)}
                            aria-label={showRegPassword ? 'Hide password' : 'Show password'}>
                            {@html showRegPassword ? eyeOpenSvg : eyeOffSvg}
                        </button>
                    </InputField>

                    <InputField
                        label="Confirm Password"
                        type={showRegConfirmPassword ? 'text' : 'password'}
                        name="confirmPassword"
                        bind:value={$regForm.confirmPassword}
                        placeholder="Enter"
                        state={$regErrors.confirmPassword ? 'error' : 'default'}
                        helperText={firstError($regErrors.confirmPassword)}
                        disabled={$regSubmitting}
                        autocomplete="new-password"
                        suffixIcon={true}
                    >
                        <button slot="suffix-icon" type="button" class="eye-btn"
                            on:click={() => (showRegConfirmPassword = !showRegConfirmPassword)}
                            aria-label={showRegConfirmPassword ? 'Hide password' : 'Show password'}>
                            {@html showRegConfirmPassword ? eyeOpenSvg : eyeOffSvg}
                        </button>
                    </InputField>
                </div>

                <div class="auth-actions">
                    {#if regFormError}
                        <div class="server-error">{regFormError}</div>
                    {/if}
                    <button type="submit" class="auth-submit-btn" disabled={$regSubmitting}>
                        {$regSubmitting ? 'Creating account...' : 'Sign Up'}
                    </button>
                    <div class="auth-switch-link">
                        <span>Already have an account? </span>
                        <button type="button" class="auth-link-btn"
                            on:click={() => (currentView = 'login')}>Log in</button>
                    </div>
                </div>
            </form>
        {/if}

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
        box-shadow: 0px 8px 8px -4px rgba(16, 24, 40, 0.03), 0px 20px 24px -4px rgba(16, 24, 40, 0.08);
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

    /* Eye toggle button */
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

    .eye-btn:hover { color: var(--ds-color-neutral-true-600); }

    /* Forgot password link row */
    .forgot-password-wrap {
        display: flex;
        align-items: center;
    }

    /* Generic inline text action button (Forgot Password, Sign up, Log in) */
    .text-action-btn {
        background: none;
        border: none;
        padding: 10px 0;
        cursor: pointer;
        font-family: var(--ds-font-family-primary);
        font-weight: 500;
        font-size: 14px;
        line-height: 20px;
        color: var(--ds-color-blue-light-700);
    }

    .text-action-btn:hover { text-decoration: underline; }

    /* Actions section */
    .auth-actions {
        display: flex;
        flex-direction: column;
        gap: 8px;
        width: 100%;
    }

    /* Primary blue submit button */
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

    .auth-submit-btn:disabled { opacity: 0.6; cursor: not-allowed; }

    /* Switch-view row (Don't have an account? / Already have an account?) */
    .auth-switch-link {
        text-align: center;
        padding: 10px 16px;
        font-family: var(--ds-font-family-primary);
        font-weight: 500;
        font-size: 14px;
        line-height: 20px;
        color: var(--ds-color-neutral-true-800);
    }

    .auth-link-btn {
        background: none;
        border: none;
        padding: 0;
        cursor: pointer;
        font-family: var(--ds-font-family-primary);
        font-weight: 500;
        font-size: 14px;
        line-height: 20px;
        color: var(--ds-color-blue-light-700);
        text-decoration: none;
    }

    .auth-link-btn:hover { text-decoration: underline; }

    /* Error banner */
    .server-error {
        padding: 10px 14px;
        background-color: var(--ds-color-error-50);
        border: 1px solid var(--ds-color-error-200);
        border-radius: 8px;
        font-family: var(--ds-font-family-primary);
        font-size: 14px;
        color: var(--ds-color-error-600);
    }

    /* Shared view header (back button + title) */
    .view-header {
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
    }

    .back-btn:hover { background-color: var(--ds-color-neutral-true-50); }

    .view-title-wrap {
        display: flex;
        flex-direction: column;
        gap: 4px;
    }

    .view-title {
        font-family: var(--ds-font-family-primary);
        font-weight: 600;
        font-size: 26px;
        line-height: 32px;
        letter-spacing: -0.13px;
        color: var(--ds-color-neutral-true-800);
        margin: 0;
    }

    .view-subtitle {
        font-family: var(--ds-font-family-primary);
        font-weight: 500;
        font-size: 16px;
        line-height: 24px;
        color: var(--ds-color-neutral-true-600);
        margin: 0;
    }
</style>
