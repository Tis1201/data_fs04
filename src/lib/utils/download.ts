/**
 * Trigger file download from download URL response.
 * Uses same-origin proxy URL (HMAC) or direct URL (LOCAL) - anchor click for both.
 */
export interface DownloadUrlResult {
	downloadUrl: string;
	fileName?: string;
}

/**
 * Download a file using the URL result from pull-file-download-url API.
 * R2: proxy URL (same-origin). LOCAL: direct static URL. Both work via anchor click.
 */
export function triggerFileDownload(result: DownloadUrlResult): void {
	const { downloadUrl, fileName = 'download' } = result;

	const a = document.createElement('a');
	a.href = downloadUrl;
	a.download = fileName;
	a.target = '_blank';
	a.rel = 'noopener noreferrer';
	a.style.display = 'none';
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
}
