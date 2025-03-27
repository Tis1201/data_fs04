<script lang="ts">
    import { superForm } from 'sveltekit-superforms/client';
    import { Button } from '$lib/components/ui/button';
    import { Input } from '$lib/components/ui/input';
    import { Label } from '$lib/components/ui/label';
    import { PasswordInput } from '$lib/components/ui/password-input';
    import {Checkbox} from '$lib/components/ui/checkbox';
    import { Alert, AlertDescription, AlertTitle } from '$lib/components/ui/alert';
    import type { PageData } from './$types';
    import { cn } from '$lib/utils';
    import { AlertTriangle } from 'lucide-svelte';
    import { goto } from '$app/navigation';
    import { toast } from 'svelte-sonner';
    import { loginSchema } from '$lib/schemas/auth';
    import { zodClient } from 'sveltekit-superforms/adapters';

    export let data: PageData;

    let serverError: string | null = null;

    const { form, errors, enhance, submitting } = superForm(data.form, {
        validators: zodClient(loginSchema),
        taintedMessage: null,
        onResult: async ({ result }) => {
            if (result.type === 'success') {
                const redirectPath = '/admin';
                toast.success('Welcome back! Redirecting to dashboard...');
                console.log("Redirecting to:", redirectPath)
                try {
                    await goto(redirectPath);
                } catch (error) {
                    console.error('Navigation error:', error);
                    toast.error('Failed to redirect. Please try again.');
                }
            } else if (result.type === 'failure') {
                toast.error($errors._errors?.[0] || 'Login failed');
            }
        },
        onError: ({ result }) => {
            serverError = result.error || 'An unexpected error occurred';
            console.error('Login error:', serverError);
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
            <div class="flex flex-col space-y-2 text-center mb-8">
            </div>

            <div class="grid gap-6 backdrop-blur-[2px] bg-white/95 p-8 shadow-2xl rounded-xl border border-white/20">
                <div class="flex flex-col space-y-2 text-center mb-2">
                    <h1 class="text-2xl font-bold tracking-tight text-[#44218d]">FS 01</h1>
                    <p class="text-base text-[#44218d]/70 font-medium">Enter your credentials to sign in</p>
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
                        <div class="flex items-center justify-between">
                            <Label for="password" class="text-sm font-medium text-[#44218d]">Password</Label>
                           
                        </div>
                        <PasswordInput
                            id="password"
                            name="password"
                            bind:value={$form.password}
                            placeholder="Enter password"
                            aria-invalid={$errors.password ? 'true' : undefined}
                            disabled={$submitting}
                            autocomplete="current-password"
                            class="bg-white border-[#44218d]/20 focus:border-[#44218d]/40 focus:ring-[#44218d]/5"
                        />
                        {#if $errors.password}
                            <p class="text-sm text-red-500">{$errors.password}</p>
                        {/if}
                    </div>

                    <div class="flex items-center justify-between">
                        <!-- <div class="flex items-center space-x-2">
                            <Checkbox
                                id="remember"
                                name="remember"
                                bind:checked={$form.remember}
                                class="border-[#44218d]/20 data-[state=checked]:bg-[#44218d] data-[state=checked]:border-[#44218d]"
                            />
                            <Label for="remember" class="text-sm font-medium text-[#44218d]/90 select-none">Remember me</Label>
                        </div> -->
                        <!-- <Button 
                            type="button" 
                            variant="link" 
                            href="/reset-password" 
                            class="text-sm font-medium text-[#44218d]/90 hover:text-[#44218d]"
                        >
                            Forgot password?
                        </Button> -->
                    </div>

                    <Button
                        type="submit"
                        class="w-full bg-[#44218d] hover:bg-[#44218d]/90 text-white"
                        disabled={$submitting}
                    >
                        {$submitting ? 'Signing in...' : 'Sign in'}
                    </Button>
                </form>
            </div>
        </div>
    </div>
</div>
