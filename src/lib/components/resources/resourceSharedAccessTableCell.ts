function escapeAttr(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

const USERS_ROUND_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0" aria-hidden="true"><path d="M18 21a8 8 0 0 0-16 0"/><circle cx="10" cy="8" r="5"/><path d="M22 20c0-3.37-2-6.5-4-8a5 5 0 0 0-.45-8.3"/></svg>`;

const SHARED_TITLE =
    'Owned by another account. Shared with yours — view and download only.';

function sharedResourcePillHtml(): string {
    return `<span class="inline-flex items-center gap-1 max-w-full rounded-full border border-[#C7D7FE] bg-[#EEF4FF] px-2 py-0.5 text-[11px] font-semibold leading-4 text-[#3538CD]" title="${escapeAttr(SHARED_TITLE)}">${USERS_ROUND_SVG}<span class="truncate">Shared with you</span></span>`;
}

/**
 * Row under the resource name in the user resources list ({@html} — static SVG + escaped title).
 */
export function resourceSharedUnderNameHtml(access?: string): string {
    if (access !== 'shared_read') return '';
    return `<div class="mt-1 min-w-0 max-w-full">${sharedResourcePillHtml()}</div>`;
}
