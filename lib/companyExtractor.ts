// Intelligent Email Domain & Corporate Company Name Extractor
// Detects corporate domains, researches website titles/meta tags, and runs AI/NLP normalization

export const FREE_EMAIL_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'yahoo.co.in',
  'yahoo.co.uk',
  'yahoo.ca',
  'ymail.com',
  'rocketmail.com',
  'hotmail.com',
  'outlook.com',
  'live.com',
  'msn.com',
  'icloud.com',
  'me.com',
  'mac.com',
  'aol.com',
  'zoho.com',
  'zohomail.com',
  'proton.me',
  'protonmail.com',
  'mail.com',
  'gmx.com',
  'gmx.net',
  'rediffmail.com',
  'yandex.com',
  'yandex.ru',
  'fastmail.com',
]);

export interface CompanyExtractionResult {
  isCompanyEmail: boolean;
  companyName: string;
  domain: string;
  websiteTitle?: string;
  source: 'website' | 'ai' | 'heuristic' | 'none';
}

/**
 * Extracts domain name from an email address
 */
export function extractDomainFromEmail(email: string): string {
  if (!email || !email.includes('@')) return '';
  const parts = email.trim().toLowerCase().split('@');
  return parts.length > 1 ? parts[1].trim() : '';
}

/**
 * Checks whether an email address belongs to a free public provider
 */
export function isFreeEmailProvider(emailOrDomain: string): boolean {
  const domain = emailOrDomain.includes('@')
    ? extractDomainFromEmail(emailOrDomain)
    : emailOrDomain.trim().toLowerCase();
  return FREE_EMAIL_DOMAINS.has(domain);
}

/**
 * Normalizes domain slug into an intelligent business/company name using NLP rules
 * Example: 'rkdyeing.com' -> 'RK Dyeing', 'tatamotors.com' -> 'Tata Motors'
 */
export function cleanDomainHeuristic(domain: string): string {
  // Strip TLD (.com, .co.in, .in, .org, .net, .io, .biz, etc.)
  const base = domain
    .replace(/\.(co\.[a-z]{2}|[a-z]{2,8}(\.[a-z]{2})?)$/i, '')
    .trim();

  // Replace delimiters (- _ .)
  let name = base.replace(/[-_.]+/g, ' ');

  // Common business patterns and industry suffixes
  const patterns: [RegExp, string][] = [
    [/\brk\s*dyeing\b/i, 'RK Dyeing'],
    [/\brkd\s*furnishings\b/i, 'RKD Furnishings'],
    [/\brkd\b/i, 'RKD'],
    [/\btata\s*motors\b/i, 'Tata Motors'],
    [/\btata\s*steel\b/i, 'Tata Steel'],
    [/\btata\s*consultancy\b/i, 'Tata Consultancy Services'],
    [/\b(\w+)(dyeing|textiles|furnishings|solutions|technologies|tech|group|industries|motors|steel|software|exports|international|logistics|fabrics|mills|retail|global)\b/i, '$1 $2'],
  ];

  for (const [rgx, rep] of patterns) {
    if (rgx.test(name)) {
      name = name.replace(rgx, rep);
      break;
    }
  }

  // Capitalize words with special handling for common acronyms
  name = name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => {
      if (/^(rk|rkd|it|ai|tata|ibm|hcl|tcs|hp|lg|bmw|pvt|ltd)$/i.test(w)) {
        return w.toUpperCase();
      }
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join(' ');

  return name;
}

/**
 * Attempts a live lightweight web research fetch to domain's homepage
 * to extract og:site_name or <title>
 */
export async function fetchWebsiteCompanyName(domain: string): Promise<string> {
  const urls = [`https://${domain}`, `http://${domain}`];

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(3500),
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      });

      if (!res.ok) continue;

      const html = await res.text();

      // 1. Try og:site_name
      const ogMatch = html.match(
        /<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i
      ) || html.match(
        /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:site_name["']/i
      );

      if (ogMatch && ogMatch[1]?.trim()) {
        const candidate = ogMatch[1].trim();
        if (candidate.length >= 2 && candidate.length <= 60) {
          return candidate;
        }
      }

      // 2. Try <title> tag
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      if (titleMatch && titleMatch[1]?.trim()) {
        const rawTitle = titleMatch[1].trim();
        // Titles often look like "RK Dyeing & Finishing Mills | Quality Fabrics" or "Stripe | Financial Infrastructure"
        const parts = rawTitle.split(/[|\-—–•:]+/);
        if (parts.length > 0) {
          const brandPart = parts[0].trim();
          // Filter out generic phrases like "Home", "Welcome", "Official Website"
          if (
            brandPart.length >= 2 &&
            brandPart.length <= 60 &&
            !/^(home|welcome|index|untitled|official site|loading)$/i.test(brandPart)
          ) {
            return brandPart;
          }
        }
      }
    } catch {
      // Ignore network timeout or unreachable domain and try next
    }
  }

  return '';
}

/**
 * Main AI function: Extracts company name from email or domain
 */
export async function extractCompanyFromEmailDomain(
  emailOrDomain: string
): Promise<CompanyExtractionResult> {
  const domain = emailOrDomain.includes('@')
    ? extractDomainFromEmail(emailOrDomain)
    : emailOrDomain.trim().toLowerCase();

  if (!domain || isFreeEmailProvider(domain)) {
    return {
      isCompanyEmail: false,
      companyName: '',
      domain,
      source: 'none',
    };
  }

  // 1. Try live website metadata extraction
  const siteName = await fetchWebsiteCompanyName(domain);
  if (siteName) {
    return {
      isCompanyEmail: true,
      companyName: siteName,
      domain,
      websiteTitle: siteName,
      source: 'website',
    };
  }

  // 2. Try Gemini API if key is present
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    try {
      const prompt = `Given the business email domain "${domain}", what is the official brand / company name?
Return ONLY the clean company name (e.g. "RK Dyeing", "Tata Motors", "Apple").
Do not include any explanations, markdown, quotes, or punctuation.`;

      const models = ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash'];
      for (const model of models) {
        try {
          const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                  temperature: 0.1,
                  maxOutputTokens: 30,
                },
              }),
            }
          );

          if (res.ok) {
            const data = await res.json();
            const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (textResponse && textResponse.trim()) {
              const clean = textResponse.replace(/["`\n\r]/g, '').trim();
              if (clean.length >= 2 && clean.length <= 60) {
                return {
                  isCompanyEmail: true,
                  companyName: clean,
                  domain,
                  source: 'ai',
                };
              }
            }
          }
        } catch {
          // Try next model
        }
      }
    } catch (e) {
      console.warn('Gemini company extraction notice:', e);
    }
  }

  // 3. Fallback to NLP heuristic normalization
  const heuristicName = cleanDomainHeuristic(domain);
  return {
    isCompanyEmail: true,
    companyName: heuristicName,
    domain,
    source: 'heuristic',
  };
}
