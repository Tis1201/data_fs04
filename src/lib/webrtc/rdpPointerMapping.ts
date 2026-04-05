export type RdpDisplayMode = 'bestFit' | 'original';

export const RDP_DISPLAY_MODE_STORAGE_KEY = 'rdp.displayMode';

export function readStoredDisplayMode(): RdpDisplayMode | null {
	if (typeof localStorage === 'undefined') return null;
	try {
		const v = localStorage.getItem(RDP_DISPLAY_MODE_STORAGE_KEY);
		if (v === 'bestFit' || v === 'original') return v;
	} catch {
		/* ignore */
	}
	return null;
}

export function writeStoredDisplayMode(mode: RdpDisplayMode): void {
	if (typeof localStorage === 'undefined') return;
	try {
		localStorage.setItem(RDP_DISPLAY_MODE_STORAGE_KEY, mode);
	} catch {
		/* ignore */
	}
}

/**
 * Map pointer event coords to remote frame pixels.
 * bestFit: account for letterboxing (object-contain in a letterboxed rect).
 * original: layout box matches scaled frame; map uniformly across element rect.
 */
export function getRdpVideoCoordinates(
	event: MouseEvent,
	displayMode: RdpDisplayMode,
	clamp = false,
): { x: number; y: number } | null {
	const target = event.currentTarget as HTMLVideoElement | HTMLImageElement;
	if (!target) return null;
	const rect = target.getBoundingClientRect();
	if (!rect.width || !rect.height) return null;

	let w = 'videoWidth' in target ? target.videoWidth : (target as HTMLImageElement).naturalWidth;
	let h = 'videoHeight' in target ? target.videoHeight : (target as HTMLImageElement).naturalHeight;
	if (!w || !h) {
		w = 1280;
		h = 720;
	}

	if (displayMode === 'original') {
		const relX = event.clientX - rect.left;
		const relY = event.clientY - rect.top;
		if (relX < 0 || relX >= rect.width || relY < 0 || relY >= rect.height) {
			if (!clamp) return null;
		}
		const x = Math.round(Math.max(0, Math.min(w - 1, (relX / rect.width) * w)));
		const y = Math.round(Math.max(0, Math.min(h - 1, (relY / rect.height) * h)));
		return { x, y };
	}

	const rectAspect = rect.width / rect.height;
	const videoAspect = w / h;
	let displayW: number;
	let displayH: number;
	let offsetX: number;
	let offsetY: number;
	if (rectAspect > videoAspect) {
		displayH = rect.height;
		displayW = rect.height * videoAspect;
		offsetX = (rect.width - displayW) / 2;
		offsetY = 0;
	} else {
		displayW = rect.width;
		displayH = rect.width / videoAspect;
		offsetX = 0;
		offsetY = (rect.height - displayH) / 2;
	}
	const relX = event.clientX - rect.left - offsetX;
	const relY = event.clientY - rect.top - offsetY;
	if (relX < 0 || relX >= displayW || relY < 0 || relY >= displayH) {
		if (!clamp) return null;
	}
	const x = Math.round(Math.max(0, Math.min(w - 1, (relX / displayW) * w)));
	const y = Math.round(Math.max(0, Math.min(h - 1, (relY / displayH) * h)));
	return { x, y };
}
