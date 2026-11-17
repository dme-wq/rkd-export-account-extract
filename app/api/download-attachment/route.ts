import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { google } from 'googleapis';
import { getGoogleOAuth2Client } from '@/lib/googleAuth';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.accessToken) {
      return NextResponse.json({ error: 'Unauthorized: Please log in with Google.' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const mailId = searchParams.get('mailId');
    const filenameParam = searchParams.get('filename') || '';

    if (!mailId) {
      return NextResponse.json({ error: 'Missing mailId parameter' }, { status: 400 });
    }

    const oauth2Client = getGoogleOAuth2Client(session);
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // Fetch the message from Gmail
    const msgRes = await gmail.users.messages.get({
      userId: 'me',
      id: mailId,
      format: 'full',
    });

    const payload = msgRes.data.payload;
    if (!payload) {
      return NextResponse.json({ error: 'Message payload not found' }, { status: 404 });
    }

    // Traverse parts to find the attachment
    let targetAttachmentId = '';
    let targetFilename = '';
    let targetMimeType = 'application/octet-stream';
    let targetInlineData = '';

    const cleanReqFilename = filenameParam.split('(')[0].trim().toLowerCase();

    function searchParts(parts: any[]) {
      for (const p of parts) {
        if (p.filename && (p.body?.attachmentId || p.body?.data)) {
          const partFilename = p.filename.trim().toLowerCase();
          if (!targetAttachmentId || (cleanReqFilename && partFilename.includes(cleanReqFilename))) {
            targetAttachmentId = p.body.attachmentId || '';
            targetInlineData = p.body.data || '';
            targetFilename = p.filename;
            targetMimeType = p.mimeType || 'application/octet-stream';
            if (cleanReqFilename && partFilename.includes(cleanReqFilename)) {
              return;
            }
          }
        }
        if (p.parts) {
          searchParts(p.parts);
        }
      }
    }

    if (payload.parts) {
      searchParts(payload.parts);
    }

    if (!targetAttachmentId && !targetInlineData) {
      return NextResponse.json({ error: 'Attachment not found in this message' }, { status: 404 });
    }

    // Fetch raw attachment data from Gmail API or inline data
    let rawData = targetInlineData;
    if (!rawData && targetAttachmentId) {
      const attRes = await gmail.users.messages.attachments.get({
        userId: 'me',
        messageId: mailId,
        id: targetAttachmentId,
      });
      rawData = attRes.data.data || '';
    }
    if (!rawData) {
      return NextResponse.json({ error: 'Attachment data is empty' }, { status: 404 });
    }

    // Gmail returns websafe base64 (replace - with +, _ with /)
    const base64Standard = rawData.replace(/-/g, '+').replace(/_/g, '/');
    const fileBuffer = Buffer.from(base64Standard, 'base64');

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': targetMimeType,
        'Content-Disposition': `inline; filename="${encodeURIComponent(targetFilename || 'attachment')}"`,
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (error: unknown) {
    console.error('Download attachment error:', error);
    const msg = error instanceof Error ? error.message : 'Failed to download attachment';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
