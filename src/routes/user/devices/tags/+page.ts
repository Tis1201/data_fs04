import { redirect } from '@sveltejs/kit';

/** Redirect sidebar "Tags" link to the actual Tags page (same style as Devices). */
export function load() {
    return redirect(302, '/user/iot/device_tags');
}
