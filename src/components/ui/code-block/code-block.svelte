<!-- Code Block Component -->
<script lang="ts">
    import { onMount } from 'svelte';
    
    // Import Prism core and theme first
    import 'prismjs/themes/prism-tomorrow.css';
    import Prism from 'prismjs';
    
    // Import core language features
    import 'prismjs/components/prism-core';
    import 'prismjs/components/prism-clike';
    
    // Import specific languages
    import 'prismjs/components/prism-javascript';
    import 'prismjs/components/prism-typescript';
    import 'prismjs/components/prism-markup';
    import 'prismjs/components/prism-bash';
    import 'prismjs/components/prism-json';
    
    export let code: string = '';
    export let language: string = 'typescript';
    export let showLineNumbers: boolean = false;

    let highlighted: string = code;
    
    // Map of supported languages to their Prism language objects
    const supportedLanguages = {
        'typescript': 'typescript',
        'javascript': 'javascript',
        'bash': 'bash',
        'json': 'json',
        'html': 'markup',
    } as const;

    onMount(() => {
        try {
            if (code && language in supportedLanguages) {
                const lang = supportedLanguages[language as keyof typeof supportedLanguages];
                highlighted = Prism.highlight(
                    code,
                    Prism.languages[lang] || Prism.languages.plain,
                    lang
                );
            }
        } catch (error) {
            console.warn(`Failed to highlight code for language: ${language}`, error);
        }
    });
</script>

<div class="relative">
    <pre
        class="rounded-lg bg-gray-900 p-4 overflow-x-auto text-sm font-mono text-gray-100"
        class:line-numbers={showLineNumbers}
    ><code class="language-{language}">{@html highlighted}</code></pre>
</div>

<style>
    :global(pre[class*="language-"]),
    :global(code[class*="language-"]) {
        color: #c5c8c6;
        text-shadow: 0 1px rgba(0, 0, 0, 0.3);
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
        direction: ltr;
        text-align: left;
        white-space: pre;
        word-spacing: normal;
        word-break: normal;
        line-height: 1.5;
        tab-size: 4;
        hyphens: none;
    }

    :global(pre[class*="language-"]) {
        background-color: #1d1f21;
        border-radius: 0.5rem;
    }

    :global(code[class*="language-"]) {
        background: none;
        text-align: left;
        white-space: pre;
        word-spacing: normal;
        word-break: normal;
        word-wrap: normal;
        tab-size: 4;
        hyphens: none;
    }

    /* Token colors */
    :global(.token.comment),
    :global(.token.prolog),
    :global(.token.doctype),
    :global(.token.cdata) {
        color: #7C7C7C;
    }

    :global(.token.punctuation) {
        color: #c5c8c6;
    }

    :global(.token.namespace) {
        opacity: .7;
    }

    :global(.token.property),
    :global(.token.keyword),
    :global(.token.tag) {
        color: #96CBFE;
    }

    :global(.token.class-name) {
        color: #FFFFB6;
    }

    :global(.token.boolean),
    :global(.token.constant) {
        color: #99CC99;
    }

    :global(.token.symbol),
    :global(.token.deleted) {
        color: #f92672;
    }

    :global(.token.number) {
        color: #FF73FD;
    }

    :global(.token.selector),
    :global(.token.attr-name),
    :global(.token.string),
    :global(.token.char),
    :global(.token.builtin),
    :global(.token.inserted) {
        color: #A8FF60;
    }

    :global(.token.variable) {
        color: #C6C5FE;
    }

    :global(.token.operator) {
        color: #EDEDED;
    }

    :global(.token.entity) {
        color: #FFFFB6;
        cursor: help;
    }

    :global(.token.url) {
        color: #96CBFE;
    }

    :global(.token.atrule),
    :global(.token.attr-value) {
        color: #F9EE98;
    }

    :global(.token.function) {
        color: #DAD085;
    }

    :global(.token.regex) {
        color: #E9C062;
    }

    :global(.token.important) {
        color: #fd971f;
    }

    :global(.token.important),
    :global(.token.bold) {
        font-weight: bold;
    }

    :global(.token.italic) {
        font-style: italic;
    }
</style>
