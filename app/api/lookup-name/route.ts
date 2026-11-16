import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { google } from 'googleapis';
import { extractNameFromEmail } from '@/lib/nameExtractor';
import { extractCompanyFromEmailDomain } from '@/lib/companyExtractor';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const emailParam = searchParams.get('email');

    if (!emailParam || !emailParam.trim()) {
      return NextResponse.json({ error: 'Email parameter is required' }, { status: 400 });
    }

    const email = emailParam.trim().toLowerCase();
    const session = await getServerSession(authOptions);

    let resolvedName: { firstName: string; lastName: string; source: string } = {
      firstName: '',
      lastName: '',
      source: 'fallback',
    };

    // 1. If user is logged in, query Gmail API message headers (Contains real Google sender/recipient display names!)
    if (session && session.accessToken) {
      try {
        const oauth2Client = new google.auth.OAuth2(
          process.env.GOOGLE_CLIENT_ID,
          process.env.GOOGLE_CLIENT_SECRET
        );
        oauth2Client.setCredentials({ access_token: session.accessToken });

        const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

        // Search recent emails matching this address
        const messagesRes = await gmail.users.messages.list({
          userId: 'me',
          q: email,
          maxResults: 6,
        });

        const messages = messagesRes.data.messages || [];

        for (const msgRef of messages) {
          if (!msgRef.id) continue;
          const msg = await gmail.users.messages.get({
            userId: 'me',
            id: msgRef.id,
            format: 'metadata',
            metadataHeaders: ['From', 'To', 'Cc'],
          });

          const headers = msg.data.payload?.headers || [];
          for (const header of headers) {
            const val = header.value || '';
            // Check if this header contains the target email with a display name
            // Example: "Lucky Saini <luckyknhn@gmail.com>" or "Lucky Saini" <luckyknhn@gmail.com>
            if (val.toLowerCase().includes(email)) {
              const parsed = parseHeaderDisplayName(val, email);
              if (parsed.firstName || parsed.lastName) {
                resolvedName = {
                  firstName: parsed.firstName,
                  lastName: parsed.lastName,
                  source: 'gmail-history',
                };
                break;
              }
            }
          }

          if (resolvedName.source === 'gmail-history') break;
        }

        // 2. Also try Google People API (Contacts & Other Contacts) if not found in headers
        if (!resolvedName.firstName && !resolvedName.lastName) {
          try {
            const people = google.people({ version: 'v1', auth: oauth2Client });

            // Search otherContacts
            const otherRes = await people.otherContacts.search({
              query: email,
              readMask: 'names,emailAddresses',
            });

            const otherResults = otherRes.data.results || [];
            if (otherResults.length > 0 && otherResults[0].person?.names) {
              const nameObj = otherResults[0].person.names[0];
              const given = nameObj.givenName || '';
              const family = nameObj.familyName || '';
              const display = nameObj.displayName || '';

              if (given || family) {
                resolvedName = {
                  firstName: given,
                  lastName: family,
                  source: 'google-people',
                };
              } else if (display) {
                const parts = display.split(/\s+/);
                resolvedName = {
                  firstName: parts[0] || '',
                  lastName: parts.slice(1).join(' ') || '',
                  source: 'google-people',
                };
              }
            }
          } catch (peopleErr) {
            // People API search might not have permission or otherContacts might be empty
            console.warn('People API lookup note:', peopleErr);
          }
        }
      } catch (gmailErr) {
        console.warn('Gmail name lookup note:', gmailErr);
      }
    }

    // 3. Fallback to smart name extractor if Gmail history had no prior emails
    if (!resolvedName.firstName && !resolvedName.lastName) {
      const fallback = extractNameFromEmail(email);
      resolvedName = {
        firstName: fallback.firstName,
        lastName: fallback.lastName,
        source: 'pattern',
      };
    }

    // 4. Extract Corporate Company Name from Email Domain
    let companyInfo = {
      isCompanyEmail: false,
      companyName: '',
      domain: '',
    };
    try {
      companyInfo = await extractCompanyFromEmailDomain(email);
    } catch (compErr) {
      console.warn('Company lookup error:', compErr);
    }

    return NextResponse.json({
      success: true,
      email,
      firstName: resolvedName.firstName,
      lastName: resolvedName.lastName,
      displayName: `${resolvedName.firstName} ${resolvedName.lastName}`.trim(),
      source: resolvedName.source,
      isCompanyEmail: companyInfo.isCompanyEmail,
      companyName: companyInfo.companyName,
      domain: companyInfo.domain,
    });
  } catch (error: unknown) {
    console.error('Lookup name error:', error);
    return NextResponse.json({ error: 'Failed to lookup name' }, { status: 500 });
  }
}

// Parses "Lucky Saini <luckyknhn@gmail.com>" into { firstName: 'Lucky', lastName: 'Saini' }
function parseHeaderDisplayName(headerVal: string, targetEmail: string): { firstName: string; lastName: string } {
  // Regex matches: Name <email> or "Name" <email>
  const match = headerVal.match(/(.*?)\s*<([^\s>]+)>/);
  if (match) {
    const rawName = match[1].replace(/["']/g, '').trim();
    const emailInHeader = match[2].trim().toLowerCase();

    if (emailInHeader === targetEmail && rawName && !rawName.includes('@')) {
      const parts = rawName.split(/\s+/).filter(Boolean);
      if (parts.length >= 2) {
        return {
          firstName: parts[0],
          lastName: parts.slice(1).join(' '),
        };
      } else if (parts.length === 1) {
        return {
          firstName: parts[0],
          lastName: '',
        };
      }
    }
  }

  return { firstName: '', lastName: '' };
}

