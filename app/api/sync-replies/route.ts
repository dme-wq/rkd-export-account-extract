import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { google } from 'googleapis';
import { getGoogleOAuth2Client } from '@/lib/googleAuth';
import { extractBodyFromMessage, extractSignatureFromReply } from '@/lib/gmailReplyExtractor';
import { extractDetailsFromSignature } from '@/lib/aiSignatureExtractor';
import { extractCompanyFromEmailDomain } from '@/lib/companyExtractor';
import { isSenderSignature, sanitizeRecipientData } from '@/lib/signatureValidator';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.accessToken || session.error === 'RefreshAccessTokenError') {
      return NextResponse.json({ error: 'Unauthorized: Session expired. Please log in again.' }, { status: 401 });
    }

    const oauth2Client = getGoogleOAuth2Client(session);

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    const sheets = google.sheets({ version: 'v4', auth: oauth2Client });
    const spreadsheetId = process.env.SPREADSHEET_ID || '1sfIboMW5CYT9v8EjbFNyx5gJhgRoXBABMwOMpLQX9XM';

    // 1. Fetch current records from Google Sheet (Gmail!A:Q)
    let targetSheet = 'Gmail';
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
      console.warn('Could not inspect sheet titles:', e);
    }

    const { searchParams } = new URL(req.url);
    const isQuick = searchParams.get('quick') === 'true';

    const sheetData = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${targetSheet}!A:Q`,
    });

    const rows = sheetData.data.values || [];
    if (rows.length <= 1) {
      return NextResponse.json({
        success: true,
        message: 'No lead rows found in Google Sheet to sync.',
        totalScanned: 0,
        updatedCount: 0,
      });
    }

    let updatedCount = 0;
    const updatedLeads: Array<{
      email: string;
      companyName: string;
      hasSignature: boolean;
      designation: string;
    }> = [];

    const userEmail = (session.user?.email || '').toLowerCase().trim();
    const userName = (session.user?.name || '').trim();

    // 2. Iterate each lead row (Row 1 is headers, Row 2 is index 1)
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i] || [];
      const sheetRowIndex = i + 1; // 1-based index in Google Sheets

      const existingFirstName = row[0] || '';
      const existingLastName = row[1] || '';
      const emailCol = (row[2] || '').trim();
      const ccCol = row[3] || '';
      const bccCol = row[4] || '';
      const existingSig = row[5] || '';
      const existingCompany = row[6] || '';
      const existingCountryCode = row[7] || '';
      const existingMobile = row[8] || '';
      const existingSecondaryMobile = row[9] || '';
      const existingDesignation = row[10] || '';
      const subjectCol = row[11] || '';
      const messageCol = row[12] || '';
      const attachmentsCol = row[13] || '';
      const sentAtCol = row[14] || '';
      const senderEmailCol = row[15] || ''; // Col P
      const mailIdCol = row[16] || '';      // Col Q

      if (!emailCol || !emailCol.includes('@')) continue;

      // Extract primary email (if comma-separated)
      const primaryEmail = emailCol.split(/[,;\s]+/)[0].trim().toLowerCase();
      if (!primaryEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(primaryEmail)) continue;

      let rowNeedsUpdate = false;
      let newFirstName = existingFirstName;
      let newLastName = existingLastName;
      let newSig = existingSig;
      let newCompany = existingCompany;
      let newCountryCode = existingCountryCode;
      let newMobile = existingMobile;
      let newSecondaryMobile = existingSecondaryMobile;
      let newDesignation = existingDesignation;
      let newSenderEmail = senderEmailCol || userEmail;
      let newMailId = mailIdCol;

      if (!senderEmailCol && userEmail) {
        newSenderEmail = userEmail;
        rowNeedsUpdate = true;
      }

      // Check if existing row erroneously contains the sender's default signature footer
      if (
        isSenderSignature({ signatureText: existingSig, senderEmail: userEmail, senderName: userName }) ||
        isSenderSignature({ signatureText: existingCompany, senderEmail: userEmail, senderName: userName })
      ) {
        newSig = '';
        newCompany = '';
        newCountryCode = '';
        newMobile = '';
        newSecondaryMobile = '';
        newDesignation = '';
        rowNeedsUpdate = true;
      }

      // On quick background auto-sync, skip rows that already have verified signature & details
      if (isQuick && existingSig && existingSig.trim().length > 10 && !existingSig.includes('💬') && existingCompany) {
        continue;
      }

      // Step A: Locate the exact Gmail Thread for this sent email
      let activeThreadId = '';

      if (mailIdCol) {
        try {
          const msgRes = await gmail.users.messages.get({
            userId: 'me',
            id: mailIdCol,
            format: 'minimal',
          });
          if (msgRes.data.threadId) {
            activeThreadId = msgRes.data.threadId;
          }
        } catch (mErr) {
          console.warn(`Could not get threadId for mailId ${mailIdCol}:`, mErr);
        }
      }

      // Fallback for legacy rows without mailId: search by exact subject + recipient
      if (!activeThreadId && subjectCol) {
        try {
          const cleanSub = subjectCol.replace(/["\\]/g, '').trim();
          const searchRes = await gmail.users.messages.list({
            userId: 'me',
            q: `subject:"${cleanSub}" to:${primaryEmail}`,
            maxResults: 5,
          });

          const msgRefs = searchRes.data.messages || [];
          if (msgRefs.length > 0) {
            if (msgRefs[0].threadId) activeThreadId = msgRefs[0].threadId;
            if (!newMailId && msgRefs[0].id) {
              newMailId = msgRefs[0].id;
              rowNeedsUpdate = true;
            }
          }
        } catch (sErr) {
          console.warn(`Could not search thread by subject for ${primaryEmail}:`, sErr);
        }
      }

      // Step B: Check for replies inside this exact thread
      if (activeThreadId) {
        try {
          const threadRes = await gmail.users.threads.get({
            userId: 'me',
            id: activeThreadId,
            format: 'full',
          });

          const msgs = threadRes.data.messages || [];
          // Sort messages chronologically
          msgs.sort((a, b) => parseInt(a.internalDate || '0') - parseInt(b.internalDate || '0'));

          // In an email thread, message 0 is Sent from WebApp. Any message at index >= 1 is a reply!
          if (msgs.length > 1) {
            // Find the latest reply message
            const replyMsg = msgs[msgs.length - 1];
            const replyBody = extractBodyFromMessage(replyMsg);
            const detectedSig = extractSignatureFromReply(replyBody);

            if (detectedSig && detectedSig.trim()) {
              if (detectedSig !== existingSig) {
                newSig = detectedSig;
                rowNeedsUpdate = true;

                const extracted = await extractDetailsFromSignature(detectedSig, primaryEmail);
                if (extracted.companyName && !newCompany) newCompany = extracted.companyName;
                if (extracted.countryCode) newCountryCode = extracted.countryCode;
                if (extracted.mobileNumber && !newMobile) newMobile = extracted.mobileNumber;
                if (extracted.secondaryMobileNumber && !newSecondaryMobile) newSecondaryMobile = extracted.secondaryMobileNumber;
                if (extracted.designation && !newDesignation) newDesignation = extracted.designation;
                if (extracted.firstName && !newFirstName) newFirstName = extracted.firstName;
                if (extracted.lastName && !newLastName) newLastName = extracted.lastName;
              }
            } else if (!newSig) {
              // If reply has text, mark that reply exists even without full signature
              newSig = '💬 Reply received in Gmail thread';
              rowNeedsUpdate = true;
            }
          }
        } catch (tErr) {
          console.warn(`Error inspecting thread ${activeThreadId}:`, tErr);
        }
      }

      // Step C: If Company Name is still empty and it's a corporate email, auto-extract from domain
      if (!newCompany || !newCompany.trim()) {
        try {
          const domainRes = await extractCompanyFromEmailDomain(primaryEmail);
          if (domainRes.companyName && !isSenderSignature({ signatureText: domainRes.companyName, senderEmail: userEmail, senderName: userName })) {
            newCompany = domainRes.companyName;
            rowNeedsUpdate = true;
          }
        } catch {
          // Ignore
        }
      }

      // Strictly sanitize data against sender organization details
      const sanitized = sanitizeRecipientData(
        {
          signature: newSig,
          companyName: newCompany,
          countryCode: newCountryCode,
          mobileNumber: newMobile,
          secondaryMobileNumber: newSecondaryMobile,
          designation: newDesignation,
        },
        userEmail,
        userName
      );

      if (newSig !== (sanitized.signature || '')) {
        newSig = sanitized.signature || '';
        rowNeedsUpdate = true;
      }
      if (newCompany !== (sanitized.companyName || '')) {
        newCompany = sanitized.companyName || '';
        rowNeedsUpdate = true;
      }
      if (newCountryCode !== (sanitized.countryCode || '')) {
        newCountryCode = sanitized.countryCode || '';
        rowNeedsUpdate = true;
      }
      if (newMobile !== (sanitized.mobileNumber || '')) {
        newMobile = sanitized.mobileNumber || '';
        rowNeedsUpdate = true;
      }
      if (newSecondaryMobile !== (sanitized.secondaryMobileNumber || '')) {
        newSecondaryMobile = sanitized.secondaryMobileNumber || '';
        rowNeedsUpdate = true;
      }
      if (newDesignation !== (sanitized.designation || '')) {
        newDesignation = sanitized.designation || '';
        rowNeedsUpdate = true;
      }

      // Step D: Write updated row to Google Sheets (Col A to Q, 17 columns)
      if (rowNeedsUpdate) {
        const updatedRowValues = [
          newFirstName,
          newLastName,
          emailCol,
          ccCol,
          bccCol,
          newSig,
          newCompany,
          newCountryCode,
          newMobile,
          newSecondaryMobile,
          newDesignation,
          subjectCol,
          messageCol,
          attachmentsCol,
          sentAtCol,
          newSenderEmail, // Col P: Sender Email
          newMailId,      // Col Q: Mail ID
        ];

        try {
          await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `${targetSheet}!A${sheetRowIndex}:Q${sheetRowIndex}`,
            valueInputOption: 'USER_ENTERED',
            requestBody: {
              values: [updatedRowValues],
            },
          });

          updatedCount++;
          updatedLeads.push({
            email: primaryEmail,
            companyName: newCompany,
            hasSignature: Boolean(newSig),
            designation: newDesignation,
          });
        } catch (updateErr) {
          console.error(`Failed to update sheet row ${sheetRowIndex}:`, updateErr);
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Sync completed! Scanned ${rows.length - 1} leads. Updated ${updatedCount} leads with new signatures and company details.`,
      totalScanned: rows.length - 1,
      updatedCount,
      updatedLeads,
    });
  } catch (error: unknown) {
    console.error('Sync replies API error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown sync error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
