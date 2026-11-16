import { google } from 'googleapis';
import { Session } from 'next-auth';

/**
 * Creates an authenticated Google OAuth2 client with automatic token refresh capabilities.
 * Supplying both access_token and refresh_token enables googleapis to automatically refresh
 * expired access tokens seamlessly in the background.
 */
export function getGoogleOAuth2Client(session: Session) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );

  oauth2Client.setCredentials({
    access_token: session.accessToken,
    refresh_token: session.refreshToken,
  });

  return oauth2Client;
}
