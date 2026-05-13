<script context="module" lang="ts">
    export type ProgressBarSize = 'sm' | 'md' | 'lg';
    export type ProgressBarColor = 'gray' | 'primary' | 'success' | 'warning' | 'error';
</script>

<script lang="ts">
    // Props
    export let value: number = 0; // 0-100
    export let showLabel: boolean = false;
    export let showThumb: boolean = true;
    export let size: ProgressBarSize = 'md';
    export let color: ProgressBarColor = 'gray';
    export let animated: boolean = false;
    export let striped: boolean = false;

    // Clamp value between 0 and 100
    $: clampedValue = Math.min(100, Math.max(0, value));

    // Size configurations
    const sizeConfig = {
        sm: {
            trackHeight: 4,
            thumbSize: 8,
            fontSize: 12,
            lineHeight: 16
        },
        md: {
            trackHeight: 8,
            thumbSize: 12,
            fontSize: 14,
            lineHeight: 20
        },
        lg: {
            trackHeight: 12,
            thumbSize: 16,
            fontSize: 16,
            lineHeight: 24
        }
    };

    // Color configurations
    const colorConfig = {
        gray: '#525252',      // Neutral-True/600
        primary: '#7F56D9',   // Primary/600
        success: '#12B76A',   // Success/500
        warning: '#F79009',   // Warning/500
        error: '#F04438'      // Error/500
    };

    $: config = sizeConfig[size];
    $: progressColor = colorConfig[color];
</script>

<div 
    class="progress-container"
    style="gap: 12px;"
    role="progressbar"
    aria-valuenow={clampedValue}
    aria-valuemin={0}
    aria-valuemax={100}
>
    <!-- Progress Track -->
    <div 
        class="progress-track"
        style="height: {config.trackHeight}px;"
    >
        <!-- Background -->
        <div 
            class="progress-background"
            style="
                height: {config.trackHeight}px;
                border-radius: {config.trackHeight / 2}px;
            "
        ></div>

        <!-- Progress Fill -->
        <div 
            class="progress-fill"
            class:animated
            class:striped
            style="
                width: {clampedValue}%;
                height: {config.trackHeight}px;
                background-color: {progressColor};
                border-radius: {config.trackHeight / 2}px;
            "
        ></div>

        <!-- Thumb -->
        {#if showThumb}
            <div 
                class="progress-thumb"
                style="
                    width: {config.thumbSize}px;
                    height: {config.thumbSize}px;
                    left: calc({clampedValue}% - {config.thumbSize / 2}px);
                    top: {(config.trackHeight - config.thumbSize) / 2}px;
                "
            ></div>
        {/if}
    </div>

    <!-- Label -->
    {#if showLabel}
        <span 
            class="progress-label"
            style="
                font-size: {config.fontSize}px;
                line-height: {config.lineHeight}px;
            "
        >
            {Math.round(clampedValue)}%
        </span>
    {/if}
</div>

<style>
    .progress-container {
        display: flex;
        flex-direction: row;
        align-items: center;
        padding: 0;
        width: 100%;
        font-family: var(--ds-font-family-primary);
    }

    .progress-track {
        position: relative;
        flex: 1;
        border-radius: 8px;
    }

    .progress-background {
        position: absolute;
        left: 0;
        right: 0;
        top: 0;
        background: #E5E5E5;
    }

    .progress-fill {
        position: absolute;
        left: 0;
        top: 0;
        transition: width 0.3s ease;
    }

    .progress-fill.animated {
        animation: progress-shine 1.5s ease-in-out infinite;
    }

    .progress-fill.striped {
        background-image: linear-gradient(
            45deg,
            rgba(255, 255, 255, 0.15) 25%,
            transparent 25%,
            transparent 50%,
            rgba(255, 255, 255, 0.15) 50%,
            rgba(255, 255, 255, 0.15) 75%,
            transparent 75%,
            transparent
        );
        background-size: 1rem 1rem;
    }

    .progress-fill.striped.animated {
        animation: progress-stripes 1s linear infinite;
    }

    @keyframes progress-shine {
        0% {
            opacity: 1;
        }
        50% {
            opacity: 0.8;
        }
        100% {
            opacity: 1;
        }
    }

    @keyframes progress-stripes {
        from {
            background-position: 1rem 0;
        }
        to {
            background-position: 0 0;
        }
    }

    .progress-thumb {
        position: absolute;
        background: #FFFFFF;
        box-shadow: 0px 1px 2px rgba(16, 24, 40, 0.05), 0px 0px 0px 4px #F2F4F7;
        border-radius: 99px;
        z-index: 2;
        transition: left 0.3s ease;
    }

    .progress-label {
        font-weight: 500;
        color: #424242;
        white-space: nowrap;
        flex-shrink: 0;
    }
</style>
