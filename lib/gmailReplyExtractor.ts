// Gmail Incoming Reply and Signature Parser
// Extracts raw reply text and isolates signature blocks from incoming emails

import { gmail_v1 } from 'googleapis';

/**
 * Recursively extracts plain text / html text from Gmail message payload parts
 */
export function extractBodyFromMessage(message: gmail_v1.Schema$Message): string {
  if (!message.payload) return message.snippet || '';

  let body = '';

  function traverseParts(part: gmail_v1.Schema$MessagePart) {
    if (part.body?.data) {
      const decoded = Buffer.from(part.body.data, 'base64').toString('utf-8');
      if (part.mimeType === 'text/plain') {
        body = decoded;
        return; // plain text is preferred
      } else if (part.mimeType === 'text/html' && !body) {
        body = decoded;
      }
    }

    if (part.parts) {
      for (const subPart of part.parts) {
        traverseParts(subPart);
      }
    }
  }

  traverseParts(message.payload);

  if (!body && message.snippet) {
    body = message.snippet;
  }

  // If HTML, strip tags while preserving newlines
  if (/<[a-z][\s\S]*>/i.test(body)) {
    body = body
      .replace(/<br\s*[\/]?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>');
  }

  return body;
}

/**
 * Removes quoted replies (e.g. "On Mon, Nov 16... wrote:", lines starting with ">")
 */
export function stripQuotedReplies(rawText: string): string {
  const lines = rawText.split(/\r?\n/);
  const cleanLines: string[] = [];

  for (const line of lines) {
    // If line starts with ">" or is a standard quotation header
    if (line.trim().startsWith('>')) continue;
    if (/^on\s+.*wrote:$/i.test(line.trim())) break;
    if (/^from:\s*.*sent:\s*.*/i.test(line.trim())) break;
    if (/^----+[\s\w]+----+$/i.test(line.trim())) break; // e.g. "---------- Forwarded message ---------"

    cleanLines.push(line);
  }

  return cleanLines.join('\n').trim();
}

/**
 * Isolates the recipient's signature block from their reply
 */
export function extractSignatureFromReply(replyText: string): string {
  const clean = stripQuotedReplies(replyText);
  const lines = clean.split(/\r?\n/).map((l) => l.trim());

  // Look for standard sign-off markers
  const signOffPatterns = [
    /^--\s*$/,
    /^(thanks|thank you)(\s*&|\s+and)?\s*(regards)?[\s!,.]*$/i,
    /^(best|kind|warm|warmest|sincere)?\s*regards[\s!,.]*$/i,
    /^(sincerely|cheers|yours truly|respectfully|with regards)[\s!,.]*$/i,
  ];

  let signOffIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    for (const pat of signOffPatterns) {
      if (pat.test(lines[i])) {
        signOffIndex = i;
        break;
      }
    }
    if (signOffIndex !== -1) break;
  }

  if (signOffIndex !== -1) {
    // Return lines from after the sign-off, or including the name below it
    const signatureLines = lines.slice(signOffIndex);
    return signatureLines.join('\n').trim();
  }

  // If no explicit sign-off found, check trailing 8 lines for contact indicators (phone, designation, url, pvt ltd)
  const trailingCount = Math.min(lines.length, 8);
  const trailingLines = lines.slice(lines.length - trailingCount);
  const contactIndicator = /(\+?\d{8,}|manager|director|executive|consultant|solutions|furnishings|technologies|pvt\s*ltd|ltd|www\.|\.com|\.in)/i;

  let candidateStart = -1;
  for (let i = 0; i < trailingLines.length; i++) {
    if (contactIndicator.test(trailingLines[i])) {
      // Step back 1 or 2 lines for person name if present
      candidateStart = Math.max(0, i - 1);
      break;
    }
  }

  if (candidateStart !== -1) {
    return trailingLines.slice(candidateStart).join('\n').trim();
  }

  return '';
}
