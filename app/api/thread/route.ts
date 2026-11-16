import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { google } from 'googleapis';
import { getGoogleOAuth2Client } from '@/lib/googleAuth';
import { extractBodyFromMessage, extractSignatureFromReply } from '@/lib/gmailReplyExtractor';
import { isSenderSignature } from '@/lib/signatureValidator';

export interface ThreadMessage {
  id: string;
  threadId: string;
  from: string;
  to: string;
  subject: string;
  date: string;
  timestamp: number;
  body: string;
  isFromMe: boolean;
  signature?: string;
  snippet?: string;
  messageIdHeader?: string;
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.accessToken) {
      return NextResponse.json({ error: 'Unauthorized: Please log in with Google.' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const emailParam = searchParams.get('email');
    const threadIdParam = searchParams.get('threadId');

    if (!emailParam && !threadIdParam) {
      return NextResponse.json({ error: 'Either email or threadId parameter is required' }, { status: 400 });
    }

    const oauth2Client = getGoogleOAuth2Client(session);

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    const userEmail = (session.user?.email || '').toLowerCase().trim();
    const targetEmail = (emailParam || '').toLowerCase().trim();

    const threadMessages: ThreadMessage[] = [];
    let activeThreadId = threadIdParam || '';

    // Strategy A: If threadId is provided, get the full thread
    if (activeThreadId) {
      try {
        const threadRes = await gmail.users.threads.get({
          userId: 'me',
          id: activeThreadId,
          format: 'full',
        });

        const msgs = threadRes.data.messages || [];
        for (const m of msgs) {
          if (!m.id) continue;
          const parsed = parseGmailMessage(m, userEmail);
          threadMessages.push(parsed);
        }
      } catch (tErr) {
        console.warn('Could not fetch thread by ID, falling back to email search:', tErr);
      }
    }

    // Strategy B: If no threadId or thread was empty, search by email
    if (threadMessages.length === 0 && targetEmail) {
      try {
        const listRes = await gmail.users.messages.list({
          userId: 'me',
          q: targetEmail,
          maxResults: 10,
        });

        const msgRefs = listRes.data.messages || [];
        for (const ref of msgRefs) {
          if (!ref.id) continue;
          try {
            const m = await gmail.users.messages.get({
              userId: 'me',
              id: ref.id,
              format: 'full',
            });
            if (m.data.threadId && !activeThreadId) {
              activeThreadId = m.data.threadId;
            }
            const parsed = parseGmailMessage(m.data, userEmail);
            threadMessages.push(parsed);
          } catch {
            // Ignore single message error
          }
        }
      } catch (searchErr) {
        console.warn('Could not search messages by email:', searchErr);
      }
    }

    // Sort chronologically (oldest first)
    threadMessages.sort((a, b) => a.timestamp - b.timestamp);

    // Identify incoming replies from the recipient
    const repliesFromLead = threadMessages.filter((m) => !m.isFromMe);
    const hasReply = repliesFromLead.length > 0;
    const latestReply = hasReply ? repliesFromLead[repliesFromLead.length - 1] : null;

    return NextResponse.json({
      success: true,
      email: targetEmail,
      threadId: activeThreadId || (threadMessages[0]?.threadId ?? ''),
      messages: threadMessages,
      hasReply,
      replyCount: repliesFromLead.length,
      latestReply,
    });
  } catch (error: unknown) {
    console.error('Thread API error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

function parseGmailMessage(m: any, userEmail: string): ThreadMessage {
  const headers = m.payload?.headers || [];
  let from = '';
  let to = '';
  let subject = '';
  let date = '';
  let messageIdHeader = '';

  for (const h of headers) {
    const name = (h.name || '').toLowerCase();
    if (name === 'from') from = h.value || '';
    if (name === 'to') to = h.value || '';
    if (name === 'subject') subject = h.value || '';
    if (name === 'date') date = h.value || '';
    if (name === 'message-id') messageIdHeader = h.value || '';
  }

  const fromLower = from.toLowerCase();
  const isFromMe = Boolean(userEmail && fromLower.includes(userEmail));
  const rawBody = extractBodyFromMessage(m);
  let signature: string | undefined = undefined;
  if (!isFromMe) {
    const rawSig = extractSignatureFromReply(rawBody);
    if (rawSig && !isSenderSignature({ signatureText: rawSig, senderEmail: userEmail })) {
      signature = rawSig;
    }
  }
  const timestamp = parseInt(m.internalDate || String(Date.now()));

  return {
    id: m.id || '',
    threadId: m.threadId || '',
    from,
    to,
    subject,
    date: date || new Date(timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
    timestamp,
    body: rawBody,
    isFromMe,
    signature,
    snippet: m.snippet || '',
    messageIdHeader,
  };
}

