/** HMAC auth for browser-direct CDN fetch */
export interface DownloadAuthHmac {
	type: 'hmac';
	timestamp: string;
	mac: string;
}

export interface DownloadUrlResult {
	downloadUrl: string;
	fileName?: string;
	/** When present, browser fetches CDN directly with HMAC headers (avoids server proxy load) */
	downloadAuth?: DownloadAuthHmac;
}

/**
 * Download a file using the URL result from pull-file-download-url API.
 * - With downloadAuth: fetches CDN directly from browser (no server proxy), then triggers download.
 * - Without downloadAuth: anchor click (proxy URL or LOCAL static URL).
 */
export async function triggerFileDownload(result: DownloadUrlResult): Promise<void> {
	const { downloadUrl, fileName = 'download', downloadAuth } = result;

	if (downloadAuth && downloadAuth.type === 'hmac') {
		// Browser-direct: fetch from CDN with HMAC headers (avoids GKE→CDN proxy, fixes Cloudflare bot 403)
		const res = await fetch(downloadUrl, {
			method: 'GET',
			headers: {
				'x-timestamp': downloadAuth.timestamp,
				'x-mac': downloadAuth.mac
			}
		});
		if (!res.ok) {
			throw new Error(`Download failed: ${res.status} ${res.statusText}`);
		}
		const blob = await res.blob();
		const blobUrl = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = blobUrl;
		a.download = fileName;
		a.style.display = 'none';
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(blobUrl);
		return;
	}

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

/**
 * Download a resource by ID. Fetches download-url (format=json) then triggers browser-direct CDN fetch.
 * No server proxy — uses Browser → CDN (HMAC) for R2.
 */
export async function downloadResource(resourceId: string, fileName?: string): Promise<void> {
	const res = await fetch(`/api/resources/${resourceId}?format=json`, { credentials: 'include' });
	if (!res.ok) {
		const text = await res.text();
		throw new Error(`Failed to get resource download URL: ${res.status} ${text.slice(0, 100)}`);
	}
	const data = await res.json();
	await triggerFileDownload({
		downloadUrl: data.downloadUrl,
		fileName: data.fileName || fileName || 'resource',
		...(data.downloadAuth && { downloadAuth: data.downloadAuth })
	});
}
