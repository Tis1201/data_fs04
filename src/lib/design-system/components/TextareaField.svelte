<script context="module" lang="ts">
  export type TextareaState = 'default' | 'disabled' | 'focused' | 'success' | 'error';
</script>

<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  // Props
  export let id: string = '';
  export let name: string = '';
  export let value: string = '';
  export let placeholder: string = 'Placeholder';
  export let label: string = '';
  export let helperText: string = '';
  export let required: boolean = false;
  export let disabled: boolean = false;
  export let readonly: boolean = false;
  export let state: TextareaState = 'default';
  export let maxlength: number | undefined = undefined;
  export let rows: number = 3;

  // For controlled focus state in showcase
  export let visualState: TextareaState | undefined = undefined;

  const dispatch = createEventDispatcher<{
    input: string;
    change: string;
    focus: FocusEvent;
    blur: FocusEvent;
  }>();

  let textareaElement: HTMLTextAreaElement;
  let isFocused = false;

  // Computed state (visual state takes precedence for showcase)
  $: computedState = visualState || (disabled ? 'disabled' : (isFocused ? 'focused' : state));

  // State configurations aligned with InputField
  const stateConfig: Record<TextareaState, {
    bg: string;
    border: string;
    shadow: string;
    textColor: string;
    placeholderColor: string;
    helperColor: string;
  }> = {
    default: {
      bg: '#FEFEFE',
      border: '#D6D6D6',
      shadow: 'none',
      textColor: '#141414',
      placeholderColor: '#A3A3A3',
      helperColor: '#737373'
    },
    disabled: {
      bg: '#F5F5F5',
      border: '#D6D6D6',
      shadow: 'none',
      textColor: '#A3A3A3',
      placeholderColor: '#A3A3A3',
      helperColor: '#737373'
    },
    focused: {
      bg: '#FEFEFE',
      border: '#525252',
      shadow: '0px 1px 2px rgba(16, 24, 40, 0.05), 0px 0px 0px 4px #F2F4F7',
      textColor: '#141414',
      placeholderColor: '#A3A3A3',
      helperColor: '#737373'
    },
    success: {
      bg: '#FEFEFE',
      border: '#039855',
      shadow: 'none',
      textColor: '#141414',
      placeholderColor: '#A3A3A3',
      helperColor: '#039855'
    },
    error: {
      bg: '#FEFEFE',
      border: '#D92D20',
      shadow: '0px 1px 2px rgba(16, 24, 40, 0.05), 0px 0px 0px 4px #FEE4E2',
      textColor: '#141414',
      placeholderColor: '#A3A3A3',
      helperColor: '#D92D20'
    }
  };

  $: config = stateConfig[computedState];

  function handleInput(e: Event) {
    const target = e.target as HTMLTextAreaElement;
    value = target.value;
    dispatch('input', value);
  }

  function handleChange(e: Event) {
    const target = e.target as HTMLTextAreaElement;
    dispatch('change', target.value);
  }

  function handleFocus(e: FocusEvent) {
    isFocused = true;
    dispatch('focus', e);
  }

  function handleBlur(e: FocusEvent) {
    isFocused = false;
    dispatch('blur', e);
  }

  // Generate unique ID if not provided
  $: textareaId = id || `textarea-${Math.random().toString(36).substr(2, 9)}`;
</script>

<div class="textarea-field-wrapper">
  {#if label}
    <label for={textareaId} class="textarea-label">
      <span class="textarea-label-text">{label}</span>
      {#if required}
        <span class="textarea-required">*</span>
      {/if}
    </label>
  {/if}

  <div
    class="textarea-container"
    class:textarea-disabled={disabled}
    style="
      background-color: {config.bg};
      border-color: {config.border};
      box-shadow: {config.shadow};
    "
  >
    <textarea
      bind:this={textareaElement}
      id={textareaId}
      {name}
      {value}
      {placeholder}
      {disabled}
      {readonly}
      {maxlength}
      {rows}
      class="textarea-element"
      style="color: {config.textColor}; --placeholder-color: {config.placeholderColor};"
      on:input={handleInput}
      on:change={handleChange}
      on:focus={handleFocus}
      on:blur={handleBlur}
      {...$$restProps}
    />
  </div>

  {#if helperText}
    <p class="textarea-helper" style="color: {config.helperColor};">
      {helperText}
    </p>
  {/if}
</div>

<style>
  .textarea-field-wrapper {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
    width: 100%;
  }

  .textarea-label {
    display: flex;
    flex-direction: row;
    align-items: center;
    padding: 2px;
    gap: 2px;
  }

  .textarea-label-text {
    font-family: var(--ds-font-family-primary);
    font-weight: var(--ds-font-regular);
    font-size: var(--ds-text-sm);
    line-height: var(--ds-leading-sm);
    color: var(--ds-color-gray-600);
  }

  .textarea-required {
    font-family: var(--ds-font-family-primary);
    font-weight: var(--ds-font-regular);
    font-size: var(--ds-text-sm);
    line-height: var(--ds-leading-sm);
    color: var(--ds-color-error-600);
  }

  .textarea-container {
    box-sizing: border-box;
    display: flex;
    flex-direction: row;
    align-items: flex-start;
    padding: 12px 14px;
    gap: 8px;
    width: 100%;
    border: 1px solid;
    border-radius: 8px;
    transition: all 0.15s ease;
  }

  .textarea-disabled {
    cursor: not-allowed;
  }

  .textarea-element {
    width: 100%;
    border: none;
    outline: none;
    background: transparent;
    font-family: var(--ds-font-family-primary);
    font-weight: var(--ds-font-regular);
    font-size: var(--ds-text-md);
    line-height: var(--ds-leading-md);
    resize: vertical;
    min-height: 72px;
  }

  .textarea-element::placeholder {
    color: var(--placeholder-color);
  }

  .textarea-element:disabled {
    cursor: not-allowed;
  }

  .textarea-helper {
    font-family: var(--ds-font-family-primary);
    font-weight: var(--ds-font-regular);
    font-size: var(--ds-text-sm);
    line-height: var(--ds-leading-sm);
    margin: 0;
  }
</style>

