import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { google } from 'googleapis';
import { getGoogleOAuth2Client } from '@/lib/googleAuth';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.accessToken || session.error === 'RefreshAccessTokenError') {
      return NextResponse.json({ error: 'Unauthorized: Session expired' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    const oauth2Client = getGoogleOAuth2Client(session);

    const sheets = google.sheets({ version: 'v4', auth: oauth2Client });
    const spreadsheetId = process.env.SPREADSHEET_ID || '1sfIboMW5CYT9v8EjbFNyx5gJhgRoXBABMwOMpLQX9XM';

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Gmail!A:O',
    });

    const rows = response.data.values || [];
    
    // Skip header row
    const dataRows = rows.slice(1);
    
    // Reverse for newest first
    const reversed = [...dataRows].reverse();
    
    // Paginate
    const start = (page - 1) * limit;
    const paginated = reversed.slice(start, start + limit);

    const records = paginated.map((row, index) => ({
      id: start + index + 1,
      firstName: row[0] || '',
      lastName: row[1] || '',
      emailTo: row[2] || '',
      ccEmails: row[3] || '',
      bccEmails: row[4] || '',
      signature: row[5] || '',
      companyName: row[6] || '',
      countryCode: row[7] || '',
      mobileNumber: row[8] || '',
      secondaryMobileNumber: row[9] || '',
      designation: row[10] || '',
      subject: row[11] || '',
      messageBody: row[12] || '',
      attachments: row[13] || '',
      sentAt: row[14] || '',
    }));

    return NextResponse.json({
      records,
      total: dataRows.length,
      page,
      limit,
      totalPages: Math.ceil(dataRows.length / limit),
    });
  } catch (error: unknown) {
    console.error('Get records error:', error);
    const errMessage = error instanceof Error ? error.message : 'Failed to fetch records';
    return NextResponse.json({ error: errMessage }, { status: 500 });
  }
}
