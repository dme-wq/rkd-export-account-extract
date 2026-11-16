import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { google } from 'googleapis';
import { extractNameFromEmail } from '@/lib/nameExtractor';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.accessToken) {
      return NextResponse.json(
        { error: 'Unauthorized. Please sign in with your Google account.' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const {
      to,
      cc,
      bcc,
      subject,
      body: emailBody,
      signature,
      firstName,
      lastName,
    } = body;

    // Normalize recipients
    const toList = normalizeEmailList(to);
    const ccList = normalizeEmailList(cc);
    const bccList = normalizeEmailList(bcc);

    if (toList.length === 0) {
      return NextResponse.json({ error: 'At least one recipient (To) is required.' }, { status: 400 });
    }

    if (!subject || !subject.trim()) {
      return NextResponse.json({ error: 'Email subject is required.' }, { status: 400 });
    }

    if (!emailBody || !emailBody.trim()) {
      return NextResponse.json({ error: 'Email body is required.' }, { status: 400 });
    }

    // Determine First & Last Name
    let finalFirstName = (firstName || '').trim();
    let finalLastName = (lastName || '').trim();

    if (!finalFirstName && !finalLastName && toList[0]) {
      const extracted = extractNameFromEmail(toList[0]);
      finalFirstName = extracted.firstName;
      finalLastName = extracted.lastName;
    }

    // Setup Google OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
    oauth2Client.setCredentials({ access_token: session.accessToken });

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    const userEmail = session.user?.email || 'me';

    // Build raw MIME RFC 2822 email
    const rawEncodedEmail = buildRawEmail({
      from: userEmail,
      to: toList,
      cc: ccList,
      bcc: bccList,
      subject: subject.trim(),
      htmlBody: emailBody,
    });

    // 1. Send the email via Gmail API
    let messageId: string | undefined;
    try {
      const sendRes = await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: rawEncodedEmail,
        },
      });
      messageId = sendRes.data.id || undefined;
    } catch (gmailErr: unknown) {
      console.error('Gmail send error:', gmailErr);
      const msg = gmailErr instanceof Error ? gmailErr.message : 'Unknown Gmail error';
      return NextResponse.json(
        {
          error: `Gmail sending failed: ${msg}. Make sure your Google Account has permission to send email via Gmail API.`,
        },
        { status: 500 }
      );
    }

    // 2. Log to Google Sheets
    let sheetsSuccess = false;
    let sheetNote = '';

    try {
      await logToSheets({
        oauth2Client,
        firstName: finalFirstName,
        lastName: finalLastName,
        emailTo: toList.join(', '),
        ccEmails: ccList.join(', '),
        bccEmails: bccList.join(', '),
        signature: signature || '',
      });
      sheetsSuccess = true;
    } catch (sheetErr: unknown) {
      console.error('Google Sheets log error:', sheetErr);
      const msg = sheetErr instanceof Error ? sheetErr.message : 'Unknown Sheet error';
      sheetNote = `Email sent successfully! (Note: Could not record in Google Sheet: ${msg}. Make sure the sheet is shared with ${userEmail} as Editor).`;
    }

    return NextResponse.json({
      success: true,
      messageId,
      emailSent: true,
      sheetsLogged: sheetsSuccess,
      message: sheetNote || 'Email sent and logged to Google Sheets successfully!',
      lead: {
        firstName: finalFirstName,
        lastName: finalLastName,
        emailTo: toList.join(', '),
        ccEmails: ccList.join(', '),
        bccEmails: bccList.join(', '),
      },
    });
  } catch (error: unknown) {
    console.error('Send email route error:', error);
    const errMessage = error instanceof Error ? error.message : 'Failed to process email';
    return NextResponse.json({ error: errMessage }, { status: 500 });
  }
}

// Convert string / array into clean email array
function normalizeEmailList(input: unknown): string[] {
  if (!input) return [];
  if (Array.isArray(input)) {
    return input.map((e) => String(e).trim()).filter((e) => isValidEmail(e));
  }
  if (typeof input === 'string') {
    return input
      .split(/[,;\s]+/)
      .map((e) => e.trim())
      .filter((e) => isValidEmail(e));
  }
  return [];
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// RFC 2822 MIME builder with strict CRLF CRLF separation
function buildRawEmail({
  from,
  to,
  cc,
  bcc,
  subject,
  htmlBody,
}: {
  from: string;
  to: string[];
  cc: string[];
  bcc: string[];
  subject: string;
  htmlBody: string;
}): string {
  const headers: string[] = [];

  headers.push(`From: ${from}`);
  headers.push(`To: ${to.join(', ')}`);

  if (cc.length > 0) {
    headers.push(`Cc: ${cc.join(', ')}`);
  }

  if (bcc.length > 0) {
    headers.push(`Bcc: ${bcc.join(', ')}`);
  }

  // RFC 2047 encoded subject
  const utf8Subject = `=?utf-8?B?${Buffer.from(subject, 'utf-8').toString('base64')}?=`;
  headers.push(`Subject: ${utf8Subject}`);
  headers.push('MIME-Version: 1.0');
  headers.push('Content-Type: text/html; charset=utf-8');
  headers.push('Content-Transfer-Encoding: base64');

  const base64Body = Buffer.from(htmlBody, 'utf-8').toString('base64');

  // Separated strictly by \r\n\r\n
  const mimeMessage = headers.join('\r\n') + '\r\n\r\n' + base64Body;

  // Web-safe base64url encoding
  return Buffer.from(mimeMessage, 'utf-8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function logToSheets({
  oauth2Client,
  firstName,
  lastName,
  emailTo,
  ccEmails,
  bccEmails,
  signature,
}: {
  oauth2Client: InstanceType<typeof google.auth.OAuth2>;
  firstName: string;
  lastName: string;
  emailTo: string;
  ccEmails: string;
  bccEmails: string;
  signature: string;
}) {
  const sheets = google.sheets({ version: 'v4', auth: oauth2Client });
  const spreadsheetId = process.env.SPREADSHEET_ID || '1sfIboMW5CYT9v8EjbFNyx5gJhgRoXBABMwOMpLQX9XM';

  // Find sheet title (default to 'Gmail' or first sheet)
  let targetSheet = 'Gmail';
  try {
    const meta = await sheets.spreadsheets.get({ spreadsheetId });
    const sheetsList = meta.data.sheets || [];
    const gmailSheet = sheetsList.find(
      (s) => s.properties?.title?.toLowerCase() === 'gmail'
    );
    if (gmailSheet && gmailSheet.properties?.title) {
      targetSheet = gmailSheet.properties.title;
    } else if (sheetsList[0]?.properties?.title) {
      targetSheet = sheetsList[0].properties.title;
    }
  } catch (err) {
    console.warn('Could not inspect sheet metadata, falling back to Gmail:', err);
  }

  // Ensure header row exists
  try {
    const headerCheck = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${targetSheet}!A1:F1`,
    });

    const headerValues = headerCheck.data.values?.[0];
    if (!headerValues || headerValues.length === 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${targetSheet}!A1:F1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [
            ['First Name', 'Last Name', 'Email ID', 'CC Email ID', 'BCC Email ID', 'Signature'],
          ],
        },
      });
    }
  } catch (hErr) {
    console.warn('Header ensure notice:', hErr);
  }

  // Append data row
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${targetSheet}!A:F`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: {
      values: [[
        firstName || '',
        lastName || '',
        emailTo || '',
        ccEmails || '',
        bccEmails || '',
        signature || '',
      ]],
    },
  });
}
