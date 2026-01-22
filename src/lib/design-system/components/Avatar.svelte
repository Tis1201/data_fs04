<script lang="ts">
    // Props
    export let src: string | undefined = undefined;
    export let alt: string = '';
    export let name: string = '';
    export let size: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' = 'md';
    export let showName: boolean = false;
    export let gradient: string | undefined = undefined; // Optional gradient background (e.g., "linear-gradient(...)")
    export let className: string = ''; // Optional additional CSS classes

    // Get initials from name
    function getInitials(name: string): string {
        if (!name) return '';
        const parts = name.trim().split(/\s+/);
        if (parts.length === 1) {
            return parts[0].substring(0, 2).toUpperCase();
        }
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }

    $: initials = getInitials(name || alt);

    // Size configurations from Figma
    const sizeConfig: Record<typeof size, { 
        container: number; 
        fontSize: number; 
        lineHeight: number;
        nameSize: string;
    }> = {
        xs: { container: 24, fontSize: 10, lineHeight: 16, nameSize: 'text-xs' },
        sm: { container: 32, fontSize: 12, lineHeight: 18, nameSize: 'text-xs' },
        md: { container: 40, fontSize: 16, lineHeight: 24, nameSize: 'text-sm' },
        lg: { container: 48, fontSize: 18, lineHeight: 28, nameSize: 'text-sm' },
        xl: { container: 56, fontSize: 20, lineHeight: 30, nameSize: 'text-base' },
        '2xl': { container: 64, fontSize: 24, lineHeight: 32, nameSize: 'text-base' }
    };

    $: config = sizeConfig[size];
</script>

<div 
    class="avatar-wrapper {className}"
    class:avatar-with-name={showName}
>
    <div 
        class="avatar"
        style="width: {config.container}px; height: {config.container}px; {gradient ? `background: ${gradient};` : ''}"
    >
        {#if src}
            <img 
                {src} 
                alt={alt || name}
                class="avatar-image"
            />
        {:else}
            <span 
                class="avatar-initials"
                style="font-size: {config.fontSize}px; line-height: {config.lineHeight}px;"
            >
                {initials}
            </span>
        {/if}
    </div>
    
    {#if showName && name}
        <span class="avatar-name {config.nameSize}">{name}</span>
    {/if}
</div>

<style>
    .avatar-wrapper {
        display: inline-flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        gap: 4px;
    }

    .avatar-with-name {
        /* Additional styles when name is shown */
    }

    .avatar {
        display: flex;
        align-items: center;
        justify-content: center;
        
        background: #F2F4F7;
        border-radius: 200px;
        overflow: hidden;
        flex-shrink: 0;
    }

    .avatar-image {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }

    .avatar-initials {
        font-family: var(--ds-font-family-primary);
        font-weight: var(--ds-font-semibold);
        text-align: center;
        color: var(--ds-color-white); /* White text on gradient background */
        user-select: none;
    }

    .avatar-name {
        font-family: var(--ds-font-family-primary);
        font-weight: var(--ds-font-regular);
        line-height: var(--ds-leading-sm);
        color: var(--ds-color-black);
        text-align: center;
        white-space: nowrap;
    }
</style>
