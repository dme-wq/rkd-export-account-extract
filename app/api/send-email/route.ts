import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { google } from 'googleapis';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.accessToken) {
      return NextResponse.json({ error: 'Unauthorized. Please sign in.' }, { status: 401 });
    }

    const body = await req.json();
    const { to, cc, bcc, subject, body: emailBody, signature, firstName, lastName } = body;

    if (!to || !subject || !emailBody) {
      return NextResponse.json({ error: 'Missing required fields: to, subject, body' }, { status: 400 });
    }

    // Setup Google OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
    oauth2Client.setCredentials({ access_token: session.accessToken });

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // Build the email with signature
    const fullBody = signature
      ? `${emailBody}\n\n--\n${signature}`
      : emailBody;

    // Encode email to base64url (RFC 2822 format)
    const toHeader = Array.isArray(to) ? to.join(', ') : to;
    const ccHeader = cc && (Array.isArray(cc) ? cc.join(', ') : cc);
    const bccHeader = bcc && (Array.isArray(bcc) ? bcc.join(', ') : bcc);

    const emailLines = [
      `To: ${toHeader}`,
      ccHeader ? `Cc: ${ccHeader}` : '',
      bccHeader ? `Bcc: ${bccHeader}` : '',
      `Subject: ${subject}`,
      'Content-Type: text/html; charset=utf-8',
      'MIME-Version: 1.0',
      '',
      fullBody,
    ].filter(Boolean);

    const emailContent = emailLines.join('\r\n');
    const encodedEmail = Buffer.from(emailContent)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    // Send the email
    await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw: encodedEmail },
    });

    // Extract first/last name from "to" email or use provided values
    const toEmail = Array.isArray(to) ? to[0] : to;
    const derivedFirstName = firstName || toEmail.split('@')[0].split('.')[0] || '';
    const derivedLastName = lastName || toEmail.split('@')[0].split('.')[1] || '';

    // Log to Google Sheets
    await logToSheets({
      accessToken: session.accessToken,
      firstName: derivedFirstName,
      lastName: derivedLastName,
      emailTo: toEmail,
      ccEmails: ccHeader || '',
      bccEmails: bccHeader || '',
      signature: signature || '',
    });

    return NextResponse.json({ success: true, message: 'Email sent and logged successfully!' });
  } catch (error: unknown) {
    console.error('Send email error:', error);
    const errMessage = error instanceof Error ? error.message : 'Failed to send email';
    return NextResponse.json({ error: errMessage }, { status: 500 });
  }
}

async function logToSheets({
  accessToken,
  firstName,
  lastName,
  emailTo,
  ccEmails,
  bccEmails,
  signature,
}: {
  accessToken: string;
  firstName: string;
  lastName: string;
  emailTo: string;
  ccEmails: string;
  bccEmails: string;
  signature: string;
}) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  oauth2Client.setCredentials({ access_token: accessToken });

  const sheets = google.sheets({ version: 'v4', auth: oauth2Client });
  const spreadsheetId = process.env.SPREADSHEET_ID || '1sfIboMW5CYT9v8EjbFNyx5gJhgRoXBABMwOMpLQX9XM';

  // Check if header row exists; if not, add it
  try {
    const headerCheck = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Gmail!A1:F1',
    });

    const headerValues = headerCheck.data.values?.[0];
    if (!headerValues || headerValues.length === 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: 'Gmail!A1:F1',
        valueInputOption: 'RAW',
        requestBody: {
          values: [['First Name', 'Last Name', 'Email ID', 'CC Email ID', 'BCC Email ID', 'Signature']],
        },
      });
    }
  } catch {
    // Sheet might not have the tab yet, create header anyway
  }

  // Append the new row
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: 'Gmail!A:F',
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: {
      values: [[firstName, lastName, emailTo, ccEmails, bccEmails, signature]],
    },
  });
}
