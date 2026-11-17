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
    const mailIdParam = searchParams.get('mailId');
    const subjectParam = searchParams.get('subject');

    if (!emailParam && !threadIdParam && !mailIdParam) {
      return NextResponse.json({ error: 'Email, mailId or threadId parameter is required' }, { status: 400 });
    }

    const oauth2Client = getGoogleOAuth2Client(session);
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    const userEmail = (session.user?.email || '').toLowerCase().trim();
    const targetEmail = (emailParam || '').toLowerCase().trim();

    const threadMessages: ThreadMessage[] = [];
    let activeThreadId = threadIdParam || '';

    // Strategy 1: If mailId (from Column Q) is provided, get threadId of this exact email
    if (mailIdParam && !activeThreadId) {
      try {
        const msgRes = await gmail.users.messages.get({
          userId: 'me',
          id: mailIdParam,
          format: 'minimal',
        });
        if (msgRes.data.threadId) {
          activeThreadId = msgRes.data.threadId;
        }
      } catch (mErr) {
        console.warn('Could not find threadId by mailId:', mErr);
      }
    }

    // Strategy 2: If we have activeThreadId, fetch ONLY messages in this exact thread
    if (activeThreadId) {
      try {
        const threadRes = await gmail.users.threads.get({
          userId: 'me',
          id: activeThreadId,
          format: 'full',
        });

        const msgs = threadRes.data.messages || [];
        msgs.sort((a, b) => parseInt(a.internalDate || '0') - parseInt(b.internalDate || '0'));

        for (let i = 0; i < msgs.length; i++) {
          const m = msgs[i];
          if (!m.id) continue;
          const parsed = parseGmailMessage(m, userEmail, targetEmail, i);
          threadMessages.push(parsed);
        }
      } catch (tErr) {
        console.warn('Could not fetch thread by ID:', tErr);
      }
    }

    // Strategy 3: Fallback ONLY for legacy rows without mailId - search strictly by subject + recipient
    // (STRICT: Never search general mailbox without subject to avoid random older emails!)
    if (threadMessages.length === 0 && subjectParam && targetEmail) {
      try {
        const cleanSubject = subjectParam.replace(/["\\]/g, '').trim();
        const listRes = await gmail.users.messages.list({
          userId: 'me',
          q: `subject:"${cleanSubject}" to:${targetEmail}`,
          maxResults: 5,
        });

        const msgRefs = listRes.data.messages || [];
        if (msgRefs.length > 0 && msgRefs[0].threadId) {
          activeThreadId = msgRefs[0].threadId;
          const threadRes = await gmail.users.threads.get({
            userId: 'me',
            id: activeThreadId,
            format: 'full',
          });

          const msgs = threadRes.data.messages || [];
          msgs.sort((a, b) => parseInt(a.internalDate || '0') - parseInt(b.internalDate || '0'));

          for (let i = 0; i < msgs.length; i++) {
            const m = msgs[i];
            if (!m.id) continue;
            const parsed = parseGmailMessage(m, userEmail, targetEmail, i);
            threadMessages.push(parsed);
          }
        }
      } catch (searchErr) {
        console.warn('Could not search thread by subject:', searchErr);
      }
    }

    // Sort chronologically (oldest first)
    threadMessages.sort((a, b) => a.timestamp - b.timestamp);

    // Identify incoming replies from the recipient (messages that are not the original sent email)
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

function parseGmailMessage(m: any, userEmail: string, targetEmail: string, indexInThread: number): ThreadMessage {
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
  
  // First message in thread is always the sent email from this WebApp
  // Subsequent messages (index > 0) in the thread are replies
  let isFromMe = false;
  if (indexInThread === 0) {
    isFromMe = true;
  } else {
    // If sent to a third-party lead, check if from contains userEmail
    if (targetEmail !== userEmail) {
      isFromMe = Boolean(userEmail && fromLower.includes(userEmail));
    } else {
      // In self-testing (where user sent email to their own address),
      // message 0 is Sent, message 1+ is Reply!
      isFromMe = false;
    }
  }

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
