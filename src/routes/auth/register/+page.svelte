<script lang="ts">
    import { superForm } from 'sveltekit-superforms/client';
    import { Button } from '$lib/components/ui/button';
    import { Input } from '$lib/components/ui/input';
    import { Label } from '$lib/components/ui/label';
    import { PasswordInput } from '$lib/components/ui/password-input';
    import { Alert, AlertDescription, AlertTitle } from '$lib/components/ui/alert';
    import type { PageData } from './$types';
    import { cn } from '$lib/utils/ui-utils';
    import { AlertTriangle, UserPlus } from 'lucide-svelte';
    import { goto } from '$app/navigation';
    import { toast } from 'svelte-sonner';
    import { registerSchema } from '$lib/schemas/auth';
    import { zodClient } from 'sveltekit-superforms/adapters';

    export let data: PageData;

    let serverError: string | null = null;

    const { form, errors, enhance, submitting } = superForm(data.form, {
        validators: zodClient(registerSchema),
        taintedMessage: null,
        onResult: async ({ result }) => {
            if (result.type === 'success') {
                // Use the server's redirectTo path or default to /user
                const redirectPath = result.data?.redirectTo || '/user';
                toast.success('Account created successfully! Welcome aboard!');
                console.log("Redirecting to:", redirectPath);
                try {
                    await goto(redirectPath);
                } catch (error) {
                    console.error('Navigation error:', error);
                    toast.error('Failed to redirect. Please try again.');
                }
            } else if (result.type === 'failure') {
                toast.error($errors._errors?.[0] || 'Registration failed');
            }
        },
        onError: ({ result }) => {
            serverError = result.error || 'An unexpected error occurred';
            console.error('Registration error:', serverError);
        },
        dataType: 'json'
    });
</script>

<style>
    :global(::selection) {
        background-color: rgba(68, 33, 141, 0.2);
        color: #44218d;
    }
    
    :global(input::selection) {
        background-color: rgba(68, 33, 141, 0.2);
        color: #44218d;
    }
</style>

<div class="min-h-screen bg-[#44218d] py-16 flex flex-col items-center justify-center">
    <div class="container relative flex flex-col items-center justify-center lg:px-0">
        <div class="mx-auto w-full sm:w-[400px]">
            <div class="grid gap-6 backdrop-blur-[2px] bg-white/95 p-8 shadow-2xl rounded-xl border border-white/20">
                <div class="flex flex-col space-y-2 text-center mb-2">
                    <div class="flex items-center justify-center gap-2 mb-2">
                        <UserPlus class="h-6 w-6 text-[#44218d]" />
                        <h1 class="text-2xl font-bold tracking-tight text-[#44218d]">Create Account</h1>
                    </div>
                    <p class="text-base text-[#44218d]/70 font-medium">Join FS 01 today</p>
                </div>

                {#if serverError}
                    <div class="p-3 rounded-md bg-red-50 text-red-500 text-sm">
                        {serverError}
                    </div>
                {/if}

                {#if $errors._errors?.[0]}
                    <Alert variant="destructive">
                        <AlertTriangle class="h-4 w-4" />
                        <AlertTitle>Error</AlertTitle>
                        <AlertDescription>{$errors._errors[0]}</AlertDescription>
                    </Alert>
                {/if}

                <form method="POST" use:enhance class="grid gap-4">
                    <div class="grid gap-2">
                        <Label for="name" class="text-sm font-medium text-[#44218d]">Full Name</Label>
                        <Input
                            id="name"
                            type="text"
                            name="name"
                            bind:value={$form.name}
                            class={cn(
                                'bg-white border-[#44218d]/20 focus:border-[#44218d]/40 focus:ring-[#44218d]/5',
                                $errors.name && 'border-red-500'
                            )}
                            disabled={$submitting}
                            placeholder="Enter your full name"
                            autocomplete="name"
                        />
                        {#if $errors.name}
                            <p class="text-sm text-red-500">{$errors.name}</p>
                        {/if}
                    </div>

                    <div class="grid gap-2">
                        <Label for="email" class="text-sm font-medium text-[#44218d]">Email</Label>
                        <Input
                            id="email"
                            type="email"
                            name="email"
                            bind:value={$form.email}
                            class={cn(
                                'bg-white border-[#44218d]/20 focus:border-[#44218d]/40 focus:ring-[#44218d]/5',
                                $errors.email && 'border-red-500'
                            )}
                            disabled={$submitting}
                            placeholder="name@company.com"
                            autocomplete="email"
                        />
                        {#if $errors.email}
                            <p class="text-sm text-red-500">{$errors.email}</p>
                        {/if}
                    </div>

                    <div class="grid gap-2">
                        <Label for="password" class="text-sm font-medium text-[#44218d]">Password</Label>
                        <PasswordInput
                            id="password"
                            name="password"
                            bind:value={$form.password}
                            placeholder="Create a strong password"
                            aria-invalid={$errors.password ? 'true' : undefined}
                            disabled={$submitting}
                            autocomplete="new-password"
                            class="bg-white border-[#44218d]/20 focus:border-[#44218d]/40 focus:ring-[#44218d]/5"
                        />
                        {#if $errors.password}
                            <p class="text-sm text-red-500">{$errors.password}</p>
                        {/if}
                    </div>

                    <div class="grid gap-2">
                        <Label for="confirmPassword" class="text-sm font-medium text-[#44218d]">Confirm Password</Label>
                        <PasswordInput
                            id="confirmPassword"
                            name="confirmPassword"
                            bind:value={$form.confirmPassword}
                            placeholder="Confirm your password"
                            aria-invalid={$errors.confirmPassword ? 'true' : undefined}
                            disabled={$submitting}
                            autocomplete="new-password"
                            class="bg-white border-[#44218d]/20 focus:border-[#44218d]/40 focus:ring-[#44218d]/5"
                        />
                        {#if $errors.confirmPassword}
                            <p class="text-sm text-red-500">{$errors.confirmPassword}</p>
                        {/if}
                    </div>

                    <Button
                        type="submit"
                        class="w-full bg-[#44218d] hover:bg-[#44218d]/90 text-white"
                        disabled={$submitting}
                    >
                        {$submitting ? 'Creating account...' : 'Create account'}
                    </Button>
                </form>

                <!-- Login Link -->
                <div class="text-center">
                    <p class="text-sm text-[#44218d]/70">
                        Already have an account?
                        <Button 
                            variant="link" 
                            href="/auth/login"
                            class="text-[#44218d] hover:text-[#44218d]/80 font-medium p-0 h-auto"
                        >
                            Sign in
                        </Button>
                    </p>
                </div>
            </div>
        </div>
    </div>
</div> 
