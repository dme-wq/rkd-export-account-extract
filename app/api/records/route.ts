import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { google } from 'googleapis';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
    oauth2Client.setCredentials({ access_token: session.accessToken });

    const sheets = google.sheets({ version: 'v4', auth: oauth2Client });
    const spreadsheetId = process.env.SPREADSHEET_ID || '1sfIboMW5CYT9v8EjbFNyx5gJhgRoXBABMwOMpLQX9XM';

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Gmail!A:G',
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
