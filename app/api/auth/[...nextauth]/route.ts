import NextAuth, { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { JWT } from 'next-auth/jwt';

/**
 * Takes an expired JWT token, calls Google OAuth2 token endpoint with the refresh token,
 * and returns the updated JWT with fresh access token and new expiration.
 */
async function refreshGoogleAccessToken(token: JWT): Promise<JWT> {
  try {
    const url = 'https://oauth2.googleapis.com/token';
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      method: 'POST',
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        grant_type: 'refresh_token',
        refresh_token: token.refreshToken as string,
      }),
    });

    const refreshedTokens = await response.json();

    if (!response.ok) {
      console.error('Failed to refresh Google access token:', refreshedTokens);
      throw refreshedTokens;
    }

    return {
      ...token,
      accessToken: refreshedTokens.access_token,
      // expires_in is in seconds (usually 3600), expiresAt is timestamp in seconds
      expiresAt: Math.floor(Date.now() / 1000) + (refreshedTokens.expires_in ?? 3599),
      // Fall back to existing refresh token if Google didn't return a new one
      refreshToken: refreshedTokens.refresh_token ?? token.refreshToken,
      error: undefined,
    };
  } catch (error) {
    console.error('Error refreshing Google access token:', error);
    return {
      ...token,
      error: 'RefreshAccessTokenError',
    };
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: [
            'openid',
            'email',
            'profile',
            'https://www.googleapis.com/auth/gmail.send',
            'https://www.googleapis.com/auth/gmail.readonly',
            'https://www.googleapis.com/auth/spreadsheets',
            'https://www.googleapis.com/auth/drive.file',
          ].join(' '),
          access_type: 'offline',
          prompt: 'consent',
          response_type: 'code',
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      // 1. Initial sign-in: Save access token, refresh token and expiry time
      if (account) {
        return {
          ...token,
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          expiresAt: account.expires_at, // timestamp in seconds
          idToken: account.id_token,
          error: undefined,
        };
      }

      // 2. Return previous token if the access token has not expired yet (with 5-minute safety buffer)
      const nowInSeconds = Math.floor(Date.now() / 1000);
      if (token.expiresAt && nowInSeconds < (token.expiresAt - 300)) {
        return token;
      }

      // 3. If token has expired and has no refresh token, flag error
      if (!token.refreshToken) {
        console.warn('Google Session: Token expired and no refresh token available');
        return {
          ...token,
          error: 'RefreshAccessTokenError',
        };
      }

      // 4. Token expired: proactively refresh with Google
      return await refreshGoogleAccessToken(token);
    },
    async session({ session, token }) {
      // Make fresh tokens available in session
      session.accessToken = token.accessToken as string;
      session.refreshToken = token.refreshToken as string;
      session.error = token.error as string | undefined;
      return session;
    },
  },
  pages: {
    signIn: '/',
    error: '/',
  },
  session: {
    strategy: 'jwt',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  },
  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
