import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { google } from 'googleapis';
import { getGoogleOAuth2Client } from '@/lib/googleAuth';
import { extractNameFromEmail } from '@/lib/nameExtractor';
import { extractDetailsFromSignature, ExtractedSignatureData } from '@/lib/aiSignatureExtractor';
import { extractCompanyFromEmailDomain } from '@/lib/companyExtractor';
import { extractBodyFromMessage, extractSignatureFromReply } from '@/lib/gmailReplyExtractor';
import { isSenderSignature, sanitizeRecipientData } from '@/lib/signatureValidator';
import { uploadAttachmentsToDrive } from '@/lib/driveUploader';

export interface EmailAttachmentPayload {
  filename: string;
  mimeType: string;
  size: number;
  base64Data: string;
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.accessToken || session.error === 'RefreshAccessTokenError') {
      return NextResponse.json(
        {
          error: 'Google session expired or unauthorized. Please re-authenticate your Google account.',
          authExpired: true,
        },
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
      firstName,
      lastName,
      attachments = [],
      isReply = false,
      threadId,
      inReplyTo,
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

    // Initialize authenticated Google clients with automatic token refresh
    const oauth2Client = getGoogleOAuth2Client(session);
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    const sheets = google.sheets({ version: 'v4', auth: oauth2Client });
    const spreadsheetId = process.env.SPREADSHEET_ID || '1sfIboMW5CYT9v8EjbFNyx5gJhgRoXBABMwOMpLQX9XM';
    const userEmail = session.user?.email || 'me';
    const primaryRecipient = toList[0];

    // =========================================================================
    // 🛑 1. DUPLICATE EMAIL CHECK: PREVENT SENDING TO ALREADY MAILED RECIPIENTS
    // (Bypassed if user is sending a Reply in an existing conversation/lead)
    // =========================================================================
    let targetSheet = 'Gmail';
    if (!isReply) {
      try {
        const meta = await sheets.spreadsheets.get({ spreadsheetId });
        const sheetsList = meta.data.sheets || [];
        const foundSheet = sheetsList.find(
          (s) => s.properties?.title?.toLowerCase() === 'gmail'
        );
        if (foundSheet && foundSheet.properties?.title) {
          targetSheet = foundSheet.properties.title;
        } else if (sheetsList[0]?.properties?.title) {
          targetSheet = sheetsList[0].properties.title;
        }
      } catch (e) {
        console.warn('Could not inspect sheet titles for duplicate check:', e);
      }

      try {
        const existingSheetData = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: `${targetSheet}!C2:P`,
        });
        const existingRows = existingSheetData.data.values || [];
        const existingEmailSet = new Set<string>();
        const currentUser = userEmail.toLowerCase().trim();

        for (const row of existingRows) {
          const recipientCol = row[0]; // Col C
          const senderCol = (row[13] || '').trim().toLowerCase(); // Col P (index 13 in C:P)

          // Only check duplicate if it was previously sent by THIS user
          const isSentByThisUser = senderCol
            ? senderCol === currentUser
            : currentUser === 'dme@rkd.in';

          if (isSentByThisUser && recipientCol) {
            const splitEmails = String(recipientCol).split(/[,;\s]+/);
            for (const em of splitEmails) {
              const clean = em.trim().toLowerCase();
              if (clean) existingEmailSet.add(clean);
            }
          }
        }

        for (const recipient of toList) {
          if (existingEmailSet.has(recipient.toLowerCase().trim())) {
            return NextResponse.json(
              {
                error: `You have already sent an email to this address (${recipient})! Sending duplicate emails is not allowed.`,
                duplicateEmail: recipient,
              },
              { status: 400 }
            );
          }
        }
      } catch (dupCheckErr) {
        console.warn('Warning during duplicate email check:', dupCheckErr);
      }
    }

    // 1. Recipient Signature & Company Extraction (Outbound mail: Recipient signature is empty until recipient replies!)
    let recipientSignature = '';
    let aiExtracted: ExtractedSignatureData = {
      companyName: '',
      countryCode: '',
      mobileNumber: '',
      secondaryMobileNumber: '',
      designation: '',
      firstName: '',
      lastName: '',
    };

    const userName = (session.user?.name || '').trim();

    // Auto-extract Company Name from recipient email domain if it's a corporate email (e.g. name@rkdyeing.com -> RK Dyeing)
    try {
      const domainExtract = await extractCompanyFromEmailDomain(primaryRecipient);
      if (domainExtract.companyName) {
        aiExtracted.companyName = domainExtract.companyName;
      }
    } catch (domErr) {
      console.warn('Domain company extraction notice:', domErr);
    }

    // Strictly sanitize recipient data to prevent ANY sender company leaking to the sheet:
    const sanitized = sanitizeRecipientData(
      {
        signature: recipientSignature,
        companyName: aiExtracted.companyName,
        countryCode: aiExtracted.countryCode,
        mobileNumber: aiExtracted.mobileNumber,
        secondaryMobileNumber: aiExtracted.secondaryMobileNumber,
        designation: aiExtracted.designation,
      },
      userEmail,
      userName
    );

    recipientSignature = sanitized.signature || '';
    aiExtracted.companyName = sanitized.companyName || '';
    aiExtracted.countryCode = sanitized.countryCode || '';
    aiExtracted.mobileNumber = sanitized.mobileNumber || '';
    aiExtracted.secondaryMobileNumber = sanitized.secondaryMobileNumber || '';
    aiExtracted.designation = sanitized.designation || '';

    // Determine First & Last Name
    let finalFirstName = (firstName || '').trim();
    let finalLastName = (lastName || '').trim();

    // Query Gmail/People API if name is missing
    if (!finalFirstName || !finalLastName || finalFirstName.toLowerCase() === primaryRecipient.split('@')[0].toLowerCase()) {
      const actualGoogleName = await resolveActualGoogleName({
        gmail,
        oauth2Client,
        email: primaryRecipient,
      });

      if (actualGoogleName.firstName) finalFirstName = actualGoogleName.firstName;
      if (actualGoogleName.lastName) finalLastName = actualGoogleName.lastName;
    }

    // Fallback if still empty
    if (!finalFirstName && !finalLastName) {
      if (aiExtracted.firstName || aiExtracted.lastName) {
        finalFirstName = aiExtracted.firstName || '';
        finalLastName = aiExtracted.lastName || '';
      } else {
        const extracted = extractNameFromEmail(primaryRecipient);
        finalFirstName = extracted.firstName;
        finalLastName = extracted.lastName;
      }
    }

    // Build raw MIME RFC 2822 email with optional attachments
    const rawEncodedEmail = buildRawEmailWithAttachments({
      from: userEmail,
      to: toList,
      cc: ccList,
      bcc: bccList,
      subject: subject.trim(),
      htmlBody: emailBody,
      attachments,
      inReplyTo,
    });

    // 2. Send the email via Gmail API
    let messageId: string | undefined;
    let sentThreadId: string | undefined;
    try {
      const sendRes = await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: rawEncodedEmail,
          threadId: threadId || undefined,
        },
      });
      messageId = sendRes.data.id || undefined;
      sentThreadId = sendRes.data.threadId || threadId || undefined;
    } catch (gmailErr: unknown) {
      console.error('Gmail send error:', gmailErr);
      const msg = gmailErr instanceof Error ? gmailErr.message : 'Unknown Gmail error';
      const isAuthError =
        msg.includes('invalid authentication credentials') ||
        msg.includes('invalid_grant') ||
        msg.includes('OAuth 2') ||
        msg.includes('401') ||
        msg.includes('Login Required') ||
        msg.includes('unauthorized');

      return NextResponse.json(
        {
          error: isAuthError
            ? 'Google login session expired. Please sign in again with Google to send this email.'
            : `Gmail sending failed: ${msg}. Make sure your Google Account has permission to send email via Gmail API.`,
          authExpired: isAuthError,
        },
        { status: isAuthError ? 401 : 500 }
      );
    }

    // 3. Log to Google Sheets (Col A to O with Subject, Message & Attachments)
    let sheetsSuccess = false;
    let sheetNote = '';

    const cleanMessageText = emailBody
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<br\s*[\/]?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .trim();

    const attachmentSummary = attachments && attachments.length > 0
      ? attachments.map((a: EmailAttachmentPayload) => `${a.filename} (${formatAttachmentSize(a.size)})`).join(', ')
      : '';

    // Upload attachments to Google Drive folder and get shareable links
    let attachmentDriveLink = '';
    if (attachments && attachments.length > 0) {
      try {
        const driveLinks = await uploadAttachmentsToDrive({
          oauth2Client,
          attachments,
        });
        if (driveLinks.length > 0) {
          attachmentDriveLink = driveLinks.join(', ');
        }
      } catch (driveErr) {
        console.warn('Error uploading attachments to Google Drive:', driveErr);
      }
    }

    const now = new Date();
    const sentAt = now.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });

    try {
      await logToSheets({
        oauth2Client,
        firstName: finalFirstName,
        lastName: finalLastName,
        emailTo: toList.join(', '),
        ccEmails: ccList.join(', '),
        bccEmails: bccList.join(', '),
        signature: recipientSignature,
        companyName: aiExtracted.companyName,
        countryCode: aiExtracted.countryCode,
        mobileNumber: aiExtracted.mobileNumber,
        secondaryMobileNumber: aiExtracted.secondaryMobileNumber,
        designation: aiExtracted.designation,
        subject: subject.trim(),
        messageBody: cleanMessageText,
        attachments: attachmentSummary,
        sentAt,
        senderEmail: userEmail,
        messageId: messageId || '',
        attachmentLink: attachmentDriveLink,
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
      threadId: sentThreadId,
      emailSent: true,
      sheetsLogged: sheetsSuccess,
      message: isReply ? 'Reply sent successfully in this conversation!' : (sheetNote || 'Email sent and recipient details logged to Google Sheets with AI Smart Extraction!'),
      lead: {
        firstName: finalFirstName,
        lastName: finalLastName,
        emailTo: toList.join(', '),
        ccEmails: ccList.join(', '),
        bccEmails: bccList.join(', '),
        companyName: aiExtracted.companyName,
        countryCode: aiExtracted.countryCode,
        mobileNumber: aiExtracted.mobileNumber,
        secondaryMobileNumber: aiExtracted.secondaryMobileNumber,
        designation: aiExtracted.designation,
      },
    });
  } catch (error: unknown) {
    console.error('Send email route error:', error);
    const errMessage = error instanceof Error ? error.message : 'Failed to process email';
    return NextResponse.json({ error: errMessage }, { status: 500 });
  }
}

// Looks up actual Google Account name from Gmail headers and People API
async function resolveActualGoogleName({
  gmail,
  oauth2Client,
  email,
}: {
  gmail: ReturnType<typeof google.gmail>;
  oauth2Client: InstanceType<typeof google.auth.OAuth2>;
  email: string;
}): Promise<{ firstName: string; lastName: string }> {
  const targetEmail = email.trim().toLowerCase();

  try {
    const listRes = await gmail.users.messages.list({
      userId: 'me',
      q: targetEmail,
      maxResults: 6,
    });

    const messages = listRes.data.messages || [];
    for (const msgRef of messages) {
      if (!msgRef.id) continue;
      const msg = await gmail.users.messages.get({
        userId: 'me',
        id: msgRef.id,
        format: 'metadata',
        metadataHeaders: ['From', 'To', 'Cc'],
      });

      const headers = msg.data.payload?.headers || [];
      for (const h of headers) {
        const val = h.value || '';
        if (val.toLowerCase().includes(targetEmail)) {
          const match = val.match(/(.*?)\s*<([^\s>]+)>/);
          if (match) {
            const rawName = match[1].replace(/["']/g, '').trim();
            const emailInHeader = match[2].trim().toLowerCase();
            if (emailInHeader === targetEmail && rawName && !rawName.includes('@')) {
              const parts = rawName.split(/\s+/).filter(Boolean);
              if (parts.length >= 2) {
                return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
              } else if (parts.length === 1) {
                return { firstName: parts[0], lastName: '' };
              }
            }
          }
        }
      }
    }
  } catch (err) {
    console.warn('Gmail name lookup in send-email error:', err);
  }

  return { firstName: '', lastName: '' };
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
      .map((e) => e.trim().replace(/^<|>$/g, ''))
      .filter((e) => isValidEmail(e));
  }
  return [];
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// RFC 2822 / RFC 2046 MIME builder supporting single-part and multipart attachments
function buildRawEmailWithAttachments({
  from,
  to,
  cc,
  bcc,
  subject,
  htmlBody,
  attachments = [],
  inReplyTo,
}: {
  from: string;
  to: string[];
  cc: string[];
  bcc: string[];
  subject: string;
  htmlBody: string;
  attachments?: EmailAttachmentPayload[];
  inReplyTo?: string;
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

  if (inReplyTo) {
    headers.push(`In-Reply-To: ${inReplyTo}`);
    headers.push(`References: ${inReplyTo}`);
  }

  // RFC 2047 encoded subject
  const utf8Subject = `=?utf-8?B?${Buffer.from(subject, 'utf-8').toString('base64')}?=`;
  headers.push(`Subject: ${utf8Subject}`);
  headers.push('MIME-Version: 1.0');

  // Case A: With Attachments (multipart/mixed)
  if (attachments && attachments.length > 0) {
    const boundary = `__RKD_EXTRACTOR_BOUNDARY_${Date.now()}__`;
    headers.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);

    const parts: string[] = [];

    // Part 1: HTML Body
    parts.push(`--${boundary}`);
    parts.push('Content-Type: text/html; charset=utf-8');
    parts.push('Content-Transfer-Encoding: base64');
    parts.push('');
    parts.push(Buffer.from(htmlBody, 'utf-8').toString('base64'));

    // Part 2+: Attachments
    for (const att of attachments) {
      const cleanBase64 = att.base64Data.replace(/^data:.*?;base64,/, '').trim();
      const safeFilename = (att.filename || 'attachment').replace(/[^\w.-]/g, '_');
      const safeMime = att.mimeType || 'application/octet-stream';

      parts.push(`--${boundary}`);
      parts.push(`Content-Type: ${safeMime}; name="${safeFilename}"`);
      parts.push(`Content-Disposition: attachment; filename="${safeFilename}"`);
      parts.push('Content-Transfer-Encoding: base64');
      parts.push('');
      parts.push(cleanBase64);
    }

    parts.push(`--${boundary}--`);

    const fullMessage = headers.join('\r\n') + '\r\n\r\n' + parts.join('\r\n');
    return Buffer.from(fullMessage, 'utf-8')
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  // Case B: Simple HTML Email (No attachments)
  headers.push('Content-Type: text/html; charset=utf-8');
  headers.push('Content-Transfer-Encoding: base64');

  const base64Body = Buffer.from(htmlBody, 'utf-8').toString('base64');
  const mimeMessage = headers.join('\r\n') + '\r\n\r\n' + base64Body;

  return Buffer.from(mimeMessage, 'utf-8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function formatAttachmentSize(bytes: number): string {
  if (!bytes) return '0 B';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

async function logToSheets({
  oauth2Client,
  firstName,
  lastName,
  emailTo,
  ccEmails,
  bccEmails,
  signature,
  companyName,
  countryCode,
  mobileNumber,
  secondaryMobileNumber,
  designation,
  subject,
  messageBody,
  attachments,
  sentAt,
  senderEmail,
  messageId,
  attachmentLink,
}: {
  oauth2Client: InstanceType<typeof google.auth.OAuth2>;
  firstName: string;
  lastName: string;
  emailTo: string;
  ccEmails: string;
  bccEmails: string;
  signature: string;
  companyName: string;
  countryCode: string;
  mobileNumber: string;
  secondaryMobileNumber: string;
  designation: string;
  subject: string;
  messageBody: string;
  attachments: string;
  sentAt: string;
  senderEmail: string;
  messageId: string;
  attachmentLink?: string;
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

  // Ensure header row exists up to Column R (18 columns)
  try {
    const headerCheck = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${targetSheet}!A1:R1`,
    });

    const headerValues = headerCheck.data.values?.[0];
    if (!headerValues || headerValues.length < 18) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${targetSheet}!A1:R1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [
            [
              'First Name',
              'Last Name',
              'Email ID',
              'CC Email ID',
              'BCC Email ID',
              'Signature',
              'Company Name',
              'Country Code',
              'Mobile Number',
              'Secondary Mobile Number',
              'Designation',
              'Subject',
              'Message',
              'Attachments',
              'Sent At',
              'Email ID',
              'Mail ID',
              'Attachement Link',
            ],
          ],
        },
      });
    }
  } catch (hErr) {
    console.warn('Header ensure notice:', hErr);
  }

  // Append data row (Col A to R)
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${targetSheet}!A:R`,
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
        companyName || '',
        countryCode || '',
        mobileNumber || '',
        secondaryMobileNumber || '',
        designation || '',
        subject || '',
        messageBody || '',
        attachments || '',
        `'${sentAt}`,
        senderEmail || '',
        messageId || '',
        attachmentLink || '',
      ]],
    },
  });
}
