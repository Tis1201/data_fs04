import type { RequestHandler } from './$types';
import { google } from '$lib/server/auth/oauth/google';
import { generateCodeVerifier, generateState } from 'arctic';
import { redirect } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ cookies }) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REDIRECT_URI) {
    return new Response('Google OAuth not configured', { status: 503 });
  }

  const state = generateState();
  const codeVerifier = generateCodeVerifier();

  // Persist state and code verifier in secure cookies (short-lived)
  cookies.set('google_oauth_state', state, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 10 // 10 minutes
  });
  cookies.set('google_oauth_verifier', codeVerifier, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 10 // 10 minutes
  });

  // Request OIDC-compliant scopes
  // Note: Arctic supports PKCE for Google; we pass codeVerifier
  const authUrl = await google.createAuthorizationURL(state, codeVerifier, {
    scopes: ['openid', 'email', 'profile']
  });

  throw redirect(302, authUrl.toString());
};

