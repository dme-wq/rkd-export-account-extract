// Intelligent First & Last Name Extractor from Email or Display Name

export function extractNameFromEmail(input: string): { firstName: string; lastName: string } {
  if (!input) return { firstName: '', lastName: '' };

  const trimmed = input.trim();

  // Pattern 1: "Lucky Saini <lucky@rkd.in>" or "Lucky Saini" <lucky@rkd.in>
  const displayMatch = trimmed.match(/^"?([^"<]+)"?\s*<.+@.+>$/);
  if (displayMatch) {
    const fullName = displayMatch[1].trim();
    const parts = fullName.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return {
        firstName: capitalize(parts[0]),
        lastName: capitalize(parts.slice(1).join(' ')),
      };
    } else if (parts.length === 1) {
      return { firstName: capitalize(parts[0]), lastName: '' };
    }
  }

  // Pattern 2: Extract username part of email "name@domain.com"
  const emailMatch = trimmed.match(/<?([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+)>?/);
  if (!emailMatch) {
    // If not a full email yet, try to parse what is typed
    const clean = trimmed.replace(/[^a-zA-Z0-9._\-]/g, '');
    const parts = clean.split(/[._\-]/).filter(Boolean);
    if (parts.length >= 2) {
      return { firstName: capitalize(parts[0]), lastName: capitalize(parts[1]) };
    } else if (parts.length === 1) {
      return { firstName: capitalize(parts[0]), lastName: '' };
    }
    return { firstName: '', lastName: '' };
  }

  const username = emailMatch[1];

  // Check delimiters like ., _, -, +
  const delimiterParts = username.split(/[._\-+]/).filter(Boolean);
  if (delimiterParts.length >= 2) {
    return {
      firstName: capitalize(cleanNumberSuffix(delimiterParts[0])),
      lastName: capitalize(cleanNumberSuffix(delimiterParts[1])),
    };
  }

  // Check camelCase (e.g. luckySaini -> Lucky Saini)
  const camelParts = username.replace(/([A-Z])/g, ' $1').trim().split(/\s+/);
  if (camelParts.length >= 2) {
    return {
      firstName: capitalize(camelParts[0]),
      lastName: capitalize(camelParts[1]),
    };
  }

  // Check common Indian and global surnames inside concatenated username
  // (e.g. luckysaini -> Lucky Saini, amitsingh -> Amit Singh, rohitsharma -> Rohit Sharma)
  const commonSurnames = [
    'saini', 'sharma', 'singh', 'kumar', 'verma', 'gupta', 'patel', 'shah', 'yadav',
    'mishra', 'joshi', 'jain', 'reddy', 'nair', 'shukla', 'mehta', 'bose', 'sen',
    'das', 'roy', 'malhotra', 'bhatia', 'kapoor', 'khanna', 'saxena', 'agarwal',
    'aggarwal', 'bansal', 'mittal', 'goel', 'garg', 'chawla', 'ahuja', 'arora',
    'rana', 'thakur', 'rao', 'chaudhary', 'tiwari', 'pandey', 'dubey', 'rawat',
    'bisht', 'negi', 'dhiman', 'kashyap', 'kamboj', 'chauhan', 'rajput',
    'smith', 'johnson', 'williams', 'brown', 'jones', 'miller', 'davis', 'wilson'
  ];

  const lower = cleanNumberSuffix(username.toLowerCase());
  for (const surname of commonSurnames) {
    if (lower.endsWith(surname) && lower.length > surname.length + 2) {
      const first = lower.slice(0, lower.length - surname.length);
      return {
        firstName: capitalize(first),
        lastName: capitalize(surname),
      };
    }
  }

  // Fallback: Clean username as First Name
  return {
    firstName: capitalize(cleanNumberSuffix(username)),
    lastName: '',
  };
}

function cleanNumberSuffix(str: string): string {
  return str.replace(/\d+$/, '');
}

function capitalize(str: string): string {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}
