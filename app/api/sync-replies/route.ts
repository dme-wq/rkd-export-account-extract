import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { google } from 'googleapis';
import { extractBodyFromMessage, extractSignatureFromReply } from '@/lib/gmailReplyExtractor';
import { extractDetailsFromSignature } from '@/lib/aiSignatureExtractor';
import { extractCompanyFromEmailDomain } from '@/lib/companyExtractor';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.accessToken) {
      return NextResponse.json({ error: 'Unauthorized: Please log in with Google.' }, { status: 401 });
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
    oauth2Client.setCredentials({ access_token: session.accessToken });

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

      let rowNeedsUpdate = false;
      let newFirstName = existingFirstName;
      let newLastName = existingLastName;
      let newSig = existingSig;
      let newCompany = existingCompany;
      let newCountryCode = existingCountryCode || '+91';
      let newMobile = existingMobile;
      let newSecondaryMobile = existingSecondaryMobile;
      let newDesignation = existingDesignation;

      // A. Check for incoming replies from this lead in Gmail
      try {
        const incomingRes = await gmail.users.messages.list({
          userId: 'me',
          q: `from:${primaryEmail}`,
          maxResults: 3,
        });

        const messages = incomingRes.data.messages || [];
        if (messages.length > 0 && messages[0].id) {
          const msg = await gmail.users.messages.get({
            userId: 'me',
            id: messages[0].id,
            format: 'full',
          });

          const bodyText = extractBodyFromMessage(msg.data);
          const detectedSig = extractSignatureFromReply(bodyText);

          if (detectedSig && detectedSig.trim() && detectedSig !== existingSig) {
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
        }
      } catch (err) {
        console.warn(`Error scanning replies for ${primaryEmail}:`, err);
      }

      // B. If Company Name is still empty, auto-extract from company email domain
      if (!newCompany || !newCompany.trim()) {
        try {
          const domainRes = await extractCompanyFromEmailDomain(primaryEmail);
          if (domainRes.companyName) {
            newCompany = domainRes.companyName;
            rowNeedsUpdate = true;
          }
        } catch {
          // Ignore
        }
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

