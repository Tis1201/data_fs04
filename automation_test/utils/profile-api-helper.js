/**
 * Profile API Helper — Setup/Teardown test data via SvelteKit Form Actions.
 *
 * The REST API (/api/v2/device-profiles) requires elevated permissions (RBAC).
 * Instead, this helper uses the same SvelteKit form actions that the UI uses:
 *   POST /user/iot/device-profiles?/create   (multipart/form-data)
 *   POST /user/iot/device-profiles?/delete   (multipart/form-data)
 *
 * Rule 6.2: Use API for setup/teardown instead of UI.
 * Rule 16.5: Centralize API request helpers.
 */
const { request } = require('@playwright/test');
const path = require('path');

class ProfileApiHelper {
    /**
     * @param {string} baseURL — e.g. 'https://app-dev-v2.datarealities.com'
     */
    constructor(baseURL) {
        this.baseURL = baseURL;
        this.apiContext = null;
        this.pageActionURL = `${baseURL}/user/iot/device-profiles`;
    }

    /** Initialise an authenticated API context from storageState. */
    async init() {
        const authFile = path.join(__dirname, '..', 'user.json');
        this.apiContext = await request.newContext({
            baseURL: this.baseURL,
            storageState: authFile,
        });
    }

    /**
     * Create a device profile via SvelteKit form action.
     * @param {{ name: string, description?: string, isActive?: boolean, settings?: any[] }} opts
     * @returns {Promise<{ id: string, name: string }>}
     */
    async createProfile({ name, description = '', isActive = true, settings = [] }) {
        const res = await this.apiContext.post(`${this.pageActionURL}?/create`, {
            form: {
                name,
                description,
                isActive: String(isActive),
                settings: JSON.stringify(settings),
            },
        });

        if (!res.ok()) {
            const text = await res.text().catch(() => '');
            throw new Error(`Create profile "${name}" failed (${res.status()}): ${text.slice(0, 300)}`);
        }

        // SvelteKit form actions return a specific format; parse the profile ID from the redirect/response.
        // Since form actions redirect back to the page, we need to find the profile by listing.
        // Instead, we search for it by name via the page URL to retrieve the ID.
        const listRes = await this.apiContext.get(`${this.pageActionURL}?search=${encodeURIComponent(name)}`);
        const html = await listRes.text();

        // Extract profile ID from the HTML link: /user/iot/device-profiles/{id}
        const idMatch = html.match(new RegExp(`/user/iot/device-profiles/([a-z0-9]+).*?${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 's'));
        if (!idMatch) {
            // Fallback: find any cuid-like ID near the profile name
            const allIds = [...html.matchAll(/\/user\/iot\/device-profiles\/(c[a-z0-9]{20,})/g)];
            // Try to find the one whose row contains our name
            for (const m of allIds) {
                const idx = html.indexOf(m[0]);
                const nearby = html.slice(idx, idx + 500);
                if (nearby.includes(name)) {
                    return { id: m[1], name };
                }
            }
            throw new Error(`Profile "${name}" created but could not find its ID in the list page.`);
        }

        return { id: idMatch[1], name };
    }

    /**
     * Delete a device profile via SvelteKit form action (teardown — Rule 15.2).
     * @param {string} id
     */
    async deleteProfile(id) {
        try {
            const res = await this.apiContext.post(`${this.pageActionURL}?/delete`, {
                form: { id },
            });
            if (!res.ok()) {
                const text = await res.text().catch(() => '');
                console.error(`Cleanup: delete profile ${id} returned ${res.status()}: ${text.slice(0, 200)}`);
            }
        } catch (e) {
            console.error(`Cleanup: failed to delete profile ${id}: ${e.message}`);
        }
    }

    /**
     * Update a profile via SvelteKit form action (e.g. toggle isActive).
     * @param {string} id
     * @param {{ name: string, description?: string, isActive?: boolean, settings?: any[] }} data
     */
    async updateProfile(id, { name, description = '', isActive = true, settings = [] }) {
        const res = await this.apiContext.post(`${this.pageActionURL}?/update`, {
            form: {
                profileId: id,
                name,
                description,
                isActive: String(isActive),
                settings: JSON.stringify(settings),
            },
        });
        if (!res.ok()) {
            const text = await res.text().catch(() => '');
            throw new Error(`Update profile ${id} failed (${res.status()}): ${text.slice(0, 300)}`);
        }
    }

    /** Dispose the API context (call in afterAll). */
    async dispose() {
        if (this.apiContext) {
            await this.apiContext.dispose();
            this.apiContext = null;
        }
    }
}

module.exports = ProfileApiHelper;
