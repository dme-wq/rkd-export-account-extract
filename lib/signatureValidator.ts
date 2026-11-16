/**
 * Signature & Contact Data Validator
 * Ensures sender's organization, signature, phone numbers, or company details
 * NEVER leak into recipient lead columns in Google Sheets.
 */

export interface ContactDetails {
  companyName?: string;
  countryCode?: string;
  mobileNumber?: string;
  secondaryMobileNumber?: string;
  designation?: string;
  signature?: string;
  firstName?: string;
  lastName?: string;
}

/**
 * Checks if a given text or signature belongs to the sender / current user.
 */
export function isSenderSignature({
  signatureText,
  senderEmail,
  senderName,
}: {
  signatureText: string;
  senderEmail?: string;
  senderName?: string;
}): boolean {
  if (!signatureText || !signatureText.trim()) return false;
  const lower = signatureText.toLowerCase();

  // 1. Check sender's email
  if (senderEmail && senderEmail.trim()) {
    const cleanEmail = senderEmail.toLowerCase().trim();
    if (lower.includes(cleanEmail)) return true;
    const prefix = cleanEmail.split('@')[0];
    if (prefix.length >= 5 && lower.includes(prefix)) return true;
  }

  // 2. Check sender organization / company identifiers
  const senderOrgKeywords = [
    'rkd furnishings',
    'rkd-furnishings',
    'rkd.in',
    'www.rkd.in',
    '@qkd.',
    '@rkd.',
    'it | rkd',
    'rk dyeing',
    'rkdyeing',
  ];
  for (const kw of senderOrgKeywords) {
    if (lower.includes(kw)) return true;
  }

  // 3. Check sender's known phone numbers
  const senderPhones = [
    '9882830548',
    '98828 30548',
    '7018218843',
    '70182 18843',
  ];
  for (const ph of senderPhones) {
    const digitsOnly = ph.replace(/\s+/g, '');
    if (lower.includes(digitsOnly) || lower.includes(ph)) return true;
  }

  // 4. Check sender's name
  if (senderName && senderName.trim().length > 2) {
    const cleanName = senderName.toLowerCase().trim();
    if (lower.includes(cleanName)) return true;
  }
  if (lower.includes('lucky saini')) return true;

  return false;
}

/**
 * Sanitizes lead / recipient data to guarantee NO sender details ever leak into the sheet.
 */
export function sanitizeRecipientData<T extends ContactDetails>(
  data: T,
  senderEmail?: string,
  senderName?: string
): T {
  const cleaned = { ...data };

  // 1. If signature matches sender, discard it completely
  if (
    cleaned.signature &&
    isSenderSignature({
      signatureText: cleaned.signature,
      senderEmail,
      senderName,
    })
  ) {
    cleaned.signature = '';
  }

  // 2. If company name matches sender's company, discard it
  if (cleaned.companyName) {
    const compLower = cleaned.companyName.toLowerCase();
    if (
      compLower.includes('rkd furnishings') ||
      compLower.includes('rkd.in') ||
      compLower === 'rkd' ||
      compLower === 'rk furnishings' ||
      compLower.includes('rk dyeing') ||
      compLower.includes('rkdyeing')
    ) {
      cleaned.companyName = '';
    }
  }

  // 3. If mobile matches sender's numbers, discard it
  const senderDigits = ['9882830548', '7018218843'];
  if (cleaned.mobileNumber) {
    const digits = cleaned.mobileNumber.replace(/\D/g, '');
    if (senderDigits.some((d) => digits.includes(d))) {
      cleaned.mobileNumber = '';
    }
  }
  if (cleaned.secondaryMobileNumber) {
    const digits = cleaned.secondaryMobileNumber.replace(/\D/g, '');
    if (senderDigits.some((d) => digits.includes(d))) {
      cleaned.secondaryMobileNumber = '';
    }
  }

  // 4. If no mobile number exists, clear country code as well
  if (!cleaned.mobileNumber && !cleaned.secondaryMobileNumber) {
    cleaned.countryCode = '';
  }

  // 5. If designation matches sender's role, discard it
  if (cleaned.designation) {
    const desLower = cleaned.designation.toLowerCase();
    if (desLower.includes('data management expert')) {
      cleaned.designation = '';
    }
  }

  return cleaned;
}
