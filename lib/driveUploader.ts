import { google } from 'googleapis';
import { Readable } from 'stream';

export const DRIVE_ATTACHMENT_FOLDER_ID = '1ZjnQwWFKQN1yzGTR4HLvFCtm8UPBG6P_';

export interface AttachmentToUpload {
  filename: string;
  mimeType: string;
  size: number;
  base64Data: string;
}

/**
 * Uploads email attachments directly to the designated Google Drive folder
 * and returns the shareable webViewLinks.
 */
export async function uploadAttachmentsToDrive({
  oauth2Client,
  attachments,
  folderId = DRIVE_ATTACHMENT_FOLDER_ID,
}: {
  oauth2Client: InstanceType<typeof google.auth.OAuth2>;
  attachments: AttachmentToUpload[];
  folderId?: string;
}): Promise<string[]> {
  if (!attachments || attachments.length === 0) return [];

  const drive = google.drive({ version: 'v3', auth: oauth2Client });
  const uploadedLinks: string[] = [];

  for (const att of attachments) {
    try {
      // Strip any data URI header if present
      const cleanBase64 = att.base64Data.replace(/^data:.*?;base64,/, '').trim();
      const buffer = Buffer.from(cleanBase64, 'base64');

      let fileRes;
      try {
        // Try uploading to target parent folder
        fileRes = await drive.files.create({
          requestBody: {
            name: att.filename,
            parents: folderId ? [folderId] : undefined,
          },
          media: {
            mimeType: att.mimeType || 'application/octet-stream',
            body: Readable.from(buffer),
          },
          fields: 'id, name, webViewLink, webContentLink',
        });
      } catch (parentErr) {
        console.warn(`Could not upload to parent folder ${folderId}, attempting root Drive:`, parentErr);
        fileRes = await drive.files.create({
          requestBody: {
            name: att.filename,
          },
          media: {
            mimeType: att.mimeType || 'application/octet-stream',
            body: Readable.from(buffer),
          },
          fields: 'id, name, webViewLink, webContentLink',
        });
      }

      const fileId = fileRes?.data?.id;

      // Make file viewable by anyone with the link
      if (fileId) {
        try {
          await drive.permissions.create({
            fileId,
            requestBody: {
              role: 'reader',
              type: 'anyone',
            },
          });
        } catch (permErr) {
          console.warn('Could not set public permission on Drive file:', permErr);
        }
      }

      const link =
        fileRes?.data?.webViewLink ||
        (fileId ? `https://drive.google.com/file/d/${fileId}/view?usp=sharing` : '');

      if (link) {
        uploadedLinks.push(link);
      }
    } catch (err) {
      console.error(`Failed to upload attachment ${att.filename} to Drive:`, err);
    }
  }

  return uploadedLinks;
}
