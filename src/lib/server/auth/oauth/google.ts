import { Google } from 'arctic';

// Initialize Google OAuth provider conditionally
function createGoogleProvider() {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
        // Return a dummy provider that will be checked before use
        return null as unknown as Google;
    }

    return new Google(clientId, clientSecret, redirectUri);
}

export const google = createGoogleProvider();
