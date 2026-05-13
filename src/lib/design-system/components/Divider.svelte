<script context="module" lang="ts">
    export type DividerOrientation = 'horizontal' | 'vertical';
</script>

<script lang="ts">
    // Props
    export let orientation: DividerOrientation = 'horizontal';
    export let color: string = '#E5E5E5';
    export let thickness: number = 1;
    export let spacing: number = 0; // Optional margin/padding around divider
    
    $: containerStyles = orientation === 'horizontal'
        ? `
            display: flex;
            flex-direction: row;
            justify-content: center;
            align-items: center;
            width: 100%;
            padding: ${spacing}px 0;
        `
        : `
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            height: 100%;
            padding: 0 ${spacing}px;
        `;
    
    $: lineStyles = orientation === 'horizontal'
        ? `
            width: 100%;
            height: 0;
            border-top: ${thickness}px solid ${color};
        `
        : `
            width: 0;
            height: 100%;
            border-left: ${thickness}px solid ${color};
        `;
</script>

<div class="divider" class:horizontal={orientation === 'horizontal'} class:vertical={orientation === 'vertical'} style={containerStyles}>
    <div class="line" style={lineStyles}></div>
</div>

<style>
    .divider {
        flex: none;
    }
    
    .divider.horizontal {
        width: 100%;
    }
    
    .divider.vertical {
        height: 100%;
        min-height: 20px;
    }
    
    .line {
        flex: none;
    }
</style>
