import { DESCRIPTION_MAX, NAME_MAX } from './description';

/** TC-RDM-APR-0016: Max characters for pin rule name (consistent with tag name limit). */
export const PIN_RULE_NAME_MAX = NAME_MAX;

/** Max characters for pin rule description (consistent with device profile description limit). */
export const PIN_RULE_DESCRIPTION_MAX = DESCRIPTION_MAX;

/** TC-RDM-APR-0079: Allowed MIME types for fallback screen (image/video only). */
export const FALLBACK_ALLOWED_MIMES = [
	'image/jpeg',
	'image/png',
	'image/webp',
	'image/gif',
	'video/mp4',
	'video/webm'
] as const;

/** Extensions for fallback screen (used when file.type is empty or wrong). */
export const FALLBACK_ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.mp4', '.webm'];

/** Accept attribute for fallback file input. */
export const FALLBACK_ACCEPT = FALLBACK_ALLOWED_MIMES.join(',');
