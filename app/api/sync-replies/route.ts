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

    // 1. Fetch current records from Google Sheet (Gmail!A:K)
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

    const sheetData = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${targetSheet}!A:K`,
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

      if (!emailCol || !emailCol.includes('@')) continue;

      // Extract primary email (if comma-separated)
      const primaryEmail = emailCol.split(/[,;\s]+/)[0].trim().toLowerCase();
      if (!primaryEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(primaryEmail)) continue;

      const userEmail = (session.user?.email || '').toLowerCase().trim();
      const userName = (session.user?.name || '').trim();
      const isSelfEmail = primaryEmail === userEmail;

      let rowNeedsUpdate = false;
      let newFirstName = existingFirstName;
      let newLastName = existingLastName;
      let newSig = existingSig;
      let newCompany = existingCompany;
      let newCountryCode = existingCountryCode;
      let newMobile = existingMobile;
      let newSecondaryMobile = existingSecondaryMobile;
      let newDesignation = existingDesignation;

      // 1. Cleanse existing row if it erroneously contains the sender's signature or company
      if (
        isSenderSignature({ signatureText: existingSig, senderEmail: userEmail, senderName: userName }) ||
        isSenderSignature({ signatureText: existingCompany, senderEmail: userEmail, senderName: userName }) ||
        existingCompany.toLowerCase().includes('rkd furnishings') ||
        existingCompany.toLowerCase().includes('rkd.in') ||
        existingMobile.includes('9882830548') ||
        existingMobile.includes('7018218843')
      ) {
        newSig = '';
        newCompany = '';
        newCountryCode = '';
        newMobile = '';
        newSecondaryMobile = '';
        newDesignation = '';
        rowNeedsUpdate = true;
      }

      // A. Check for incoming replies from this lead in Gmail (Excluding our own sent emails)
      if (!isSelfEmail) {
        try {
          const incomingRes = await gmail.users.messages.list({
            userId: 'me',
            q: `from:${primaryEmail} -from:me`,
            maxResults: 3,
          });

          const messages = incomingRes.data.messages || [];
          for (const msgRef of messages) {
            if (!msgRef.id) continue;
            const msg = await gmail.users.messages.get({
              userId: 'me',
              id: msgRef.id,
              format: 'full',
            });

            // Verify from header matches the recipient
            const headers = msg.data.payload?.headers || [];
            const fromHeader = headers.find((h) => h.name?.toLowerCase() === 'from')?.value || '';
            if (!fromHeader.toLowerCase().includes(primaryEmail)) {
              continue;
            }

            const bodyText = extractBodyFromMessage(msg.data);
            const detectedSig = extractSignatureFromReply(bodyText);

            // Verify detected signature does NOT belong to the sender
            if (
              detectedSig &&
              detectedSig.trim() &&
              !isSenderSignature({ signatureText: detectedSig, senderEmail: userEmail, senderName: userName })
            ) {
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
              break;
            }
          }
        } catch (err) {
          console.warn(`Error scanning replies for ${primaryEmail}:`, err);
        }
      }

      // B. If Company Name is still empty and it's a corporate email, auto-extract from company email domain
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

      // Strictly sanitize all data against sender details before updating
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

      // C. If changes were detected, update the row in Google Sheets
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
        ];

        try {
          await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `${targetSheet}!A${sheetRowIndex}:K${sheetRowIndex}`,
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

