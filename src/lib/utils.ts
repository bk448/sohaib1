export type LeadChannel = 'website_form' | 'email' | 'manual';
export type LeadPriority = 'normal' | 'high';
export type LeadStatus =
  | 'New'
  | 'Contacted'
  | 'Qualified'
  | 'Proposal Sent'
  | 'Won'
  | 'Closed Lost';

export type ContactOptionType =
  | 'email'
  | 'phone'
  | 'whatsapp'
  | 'sms'
  | 'calendly'
  | 'link'
  | 'custom';

export interface ContactOption {
  id: string;
  type: ContactOptionType;
  label: string;
  value: string;
  message_template: string;
  enabled: boolean;
}

export interface Site {
  id: string;
  name: string;
  domains: string;
  inboxes: string;
  match_keywords: string;
  exclude_keywords: string;
  channels: string;
  active: boolean;
  show_on_dashboard: boolean;
  dashboard_fields: string[] | null;
  contact_options: ContactOption[] | null;
  color: string;
  created_at: string;
}

export interface Lead {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  subject: string | null;
  message: string | null;
  channel: LeadChannel | string;
  source_website: string | null;
  inbox: string | null;
  page_url: string | null;
  division: string | null;
  division_name: string | null;
  primary_service: string | null;
  services: string | null;
  country: string | null;
  priority: LeadPriority | string;
  status: LeadStatus | string;
  source_message_id: string | null;
  received_at: string;
  site_id: string | null;
  site_name: string | null;
  extra: Record<string, unknown> | null;
  notes: string | null;
  updated_at: string | null;
}

export interface LeadFieldDefinition {
  key: keyof Lead;
  label: string;
}

export const LEAD_STATUSES: LeadStatus[] = [
  'New',
  'Contacted',
  'Qualified',
  'Proposal Sent',
  'Won',
  'Closed Lost',
];

export const LEAD_PRIORITIES: LeadPriority[] = ['normal', 'high'];

export const LEAD_CHANNELS: LeadChannel[] = ['website_form', 'email', 'manual'];

export const DEFAULT_DASHBOARD_FIELDS: string[] = [
  'name',
  'email',
  'phone',
  'primary_service',
  'country',
  'priority',
  'status',
  'site_name',
  'received_at',
];

export const ALL_LEAD_FIELDS: LeadFieldDefinition[] = [
  { key: 'name', label: 'Name' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'subject', label: 'Subject' },
  { key: 'message', label: 'Message' },
  { key: 'channel', label: 'Channel' },
  { key: 'source_website', label: 'Source Website' },
  { key: 'inbox', label: 'Inbox' },
  { key: 'page_url', label: 'Page URL' },
  { key: 'division', label: 'Division' },
  { key: 'division_name', label: 'Division Name' },
  { key: 'primary_service', label: 'Primary Service' },
  { key: 'services', label: 'Services' },
  { key: 'country', label: 'Country' },
  { key: 'priority', label: 'Priority' },
  { key: 'status', label: 'Status' },
  { key: 'site_name', label: 'Site' },
  { key: 'received_at', label: 'Received At' },
  { key: 'updated_at', label: 'Updated At' },
  { key: 'notes', label: 'Notes' },
];

export function formatCsvTags(val: string | null | undefined): string[] {
  if (!val) return [];
  return val
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export interface RuleTestInput {
  channel: LeadChannel;
  to: string;
  from: string;
  subject: string;
  body: string;
  website: string;
}

export interface SiteMatchResult {
  site: Site;
  matched: boolean;
  score: number;
  matchedDomains: string[];
  matchedKeywords: string[];
  matchedInboxes: string[];
  excludedBy: string | null;
  reason: string;
}

/**
 * Replicates the n8n site-matching algorithm exactly:
 * - Skip sites where active = false.
 * - If channels is set and doesn't include the lead's channel -> no match.
 * - If inboxes is set and the lead is an email whose To/Cc doesn't contain one of the inboxes -> no match.
 * - If any exclude_keyword appears in subject+message+from+to+website (case-insensitive) -> no match.
 * - score = 3 * (number of domains found in that text) + (number of match_keywords found).
 * - If score = 0 but the site has inboxes and no domains/keywords -> score = 1.
 * - score > 0 = match.
 */
export function evaluateSiteRules(sites: Site[], input: RuleTestInput): SiteMatchResult[] {
  const combinedText = [
    input.subject,
    input.body,
    input.from,
    input.to,
    input.website,
  ]
    .join(' ')
    .toLowerCase();

  const toText = input.to.toLowerCase();

  return sites.map((site) => {
    if (!site.active) {
      return {
        site,
        matched: false,
        score: 0,
        matchedDomains: [],
        matchedKeywords: [],
        matchedInboxes: [],
        excludedBy: null,
        reason: 'Site is inactive (active = false)',
      };
    }

    const allowedChannels = formatCsvTags(site.channels).map((c) => c.toLowerCase());
    if (allowedChannels.length > 0 && !allowedChannels.includes(input.channel.toLowerCase())) {
      return {
        site,
        matched: false,
        score: 0,
        matchedDomains: [],
        matchedKeywords: [],
        matchedInboxes: [],
        excludedBy: null,
        reason: `Channel "${input.channel}" not in allowed channels (${allowedChannels.join(', ')})`,
      };
    }

    const inboxes = formatCsvTags(site.inboxes);
    const matchedInboxes = inboxes.filter((inbox) => toText.includes(inbox.toLowerCase()));
    if (inboxes.length > 0 && input.channel === 'email' && matchedInboxes.length === 0) {
      return {
        site,
        matched: false,
        score: 0,
        matchedDomains: [],
        matchedKeywords: [],
        matchedInboxes: [],
        excludedBy: null,
        reason: `Email To/Cc does not contain any configured inbox (${inboxes.join(', ')})`,
      };
    }

    const excludeKeywords = formatCsvTags(site.exclude_keywords);
    const excludedHit = excludeKeywords.find((kw) => combinedText.includes(kw.toLowerCase()));
    if (excludedHit) {
      return {
        site,
        matched: false,
        score: 0,
        matchedDomains: [],
        matchedKeywords: [],
        matchedInboxes,
        excludedBy: excludedHit,
        reason: `Excluded by keyword "${excludedHit}"`,
      };
    }

    const domains = formatCsvTags(site.domains);
    const matchKeywords = formatCsvTags(site.match_keywords);

    const matchedDomains = domains.filter((d) => combinedText.includes(d.toLowerCase()));
    const matchedKeywords = matchKeywords.filter((kw) => combinedText.includes(kw.toLowerCase()));

    let score = 3 * matchedDomains.length + matchedKeywords.length;
    if (score === 0 && inboxes.length > 0 && domains.length === 0 && matchKeywords.length === 0) {
      score = 1;
    }

    const matched = score > 0;
    const reason = matched
      ? `Matched (score ${score}: 3×${matchedDomains.length} domains + ${matchedKeywords.length} keywords${
          score === 1 && matchedDomains.length === 0 && matchedKeywords.length === 0
            ? ' + inbox-only fallback'
            : ''
        })`
      : 'Score is 0 (no domains or match_keywords matched)';

    return {
      site,
      matched,
      score,
      matchedDomains,
      matchedKeywords,
      matchedInboxes,
      excludedBy: null,
      reason,
    };
  });
}

export function getSafeExternalUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('https://') || trimmed.startsWith('http://') || trimmed.startsWith('/')) {
    return trimmed;
  }
  return null;
}

export function getSafeActionHref(href: string): string | null {
  const trimmed = href.trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith('https://') ||
    lower.startsWith('http://') ||
    lower.startsWith('mailto:') ||
    lower.startsWith('tel:') ||
    lower.startsWith('sms:')
  ) {
    return trimmed;
  }
  return null;
}

function replacePlaceholders(
  text: string,
  lead: Partial<Lead>,
  siteName: string,
  encodeValues: boolean
): string {
  const map: Record<string, string> = {
    '{name}': lead.name || '',
    '{email}': lead.email || '',
    '{phone}': lead.phone || '',
    '{service}': lead.primary_service || '',
    '{country}': lead.country || '',
    '{site}': siteName || lead.site_name || '',
  };

  let out = text;
  Object.entries(map).forEach(([token, rawVal]) => {
    const replacement = encodeValues ? encodeURIComponent(rawVal) : rawVal;
    out = out.split(token).join(replacement);
  });
  return out;
}

export function isContactOptionVisible(option: ContactOption, lead: Partial<Lead>): boolean {
  if (!option.enabled) return false;
  const phoneDigits = (lead.phone || '').replace(/\D/g, '');
  switch (option.type) {
    case 'email':
      return Boolean(lead.email && lead.email.trim());
    case 'phone':
    case 'sms':
      return Boolean(lead.phone && lead.phone.trim());
    case 'whatsapp':
      return phoneDigits.length > 0;
    case 'calendly':
    case 'link':
    case 'custom':
      return Boolean(option.value && option.value.trim());
    default:
      return false;
  }
}

export function buildContactAction(
  option: ContactOption,
  lead: Partial<Lead>,
  siteName: string
): { href: string; external: boolean } | null {
  const templateEncoded = encodeURIComponent(
    replacePlaceholders(option.message_template || '', lead, siteName, false)
  );
  const subjectEncoded = encodeURIComponent(`Re: ${lead.subject || 'Your inquiry'}`);
  const digitsOnly = (lead.phone || '').replace(/\D/g, '');

  let rawHref = '';
  let external = false;

  switch (option.type) {
    case 'email': {
      if (!lead.email) return null;
      rawHref = `mailto:${lead.email.trim()}?subject=${subjectEncoded}&body=${templateEncoded}`;
      break;
    }
    case 'phone': {
      if (!lead.phone) return null;
      rawHref = `tel:${lead.phone.trim()}`;
      break;
    }
    case 'whatsapp': {
      if (!digitsOnly) return null;
      rawHref = `https://wa.me/${digitsOnly}?text=${templateEncoded}`;
      external = true;
      break;
    }
    case 'sms': {
      if (!lead.phone) return null;
      rawHref = `sms:${lead.phone.trim()}?body=${templateEncoded}`;
      break;
    }
    case 'calendly':
    case 'link': {
      rawHref = option.value.trim();
      external = true;
      break;
    }
    case 'custom': {
      rawHref = replacePlaceholders(option.value.trim(), lead, siteName, true);
      external = rawHref.startsWith('http://') || rawHref.startsWith('https://');
      break;
    }
  }

  const safe = getSafeActionHref(rawHref);
  if (!safe) return null;
  return { href: safe, external };
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function formatShortDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function getStatusBadgeClass(status: string): string {
  switch (status) {
    case 'New':
      return 'bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800';
    case 'Contacted':
      return 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800';
    case 'Qualified':
      return 'bg-indigo-50 text-indigo-800 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800';
    case 'Proposal Sent':
      return 'bg-violet-50 text-violet-800 border-violet-200 dark:bg-violet-950/60 dark:text-violet-300 dark:border-violet-800';
    case 'Won':
      return 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800';
    case 'Closed Lost':
      return 'bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700';
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
  }
}

export function getPriorityBadgeClass(priority: string): string {
  if (priority === 'high') {
    return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800';
  }
  return 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700';
}

export function formatChannelLabel(channel: string): string {
  switch (channel) {
    case 'website_form':
      return 'Website Form';
    case 'email':
      return 'Email';
    case 'manual':
      return 'Manual';
    default:
      return channel || '—';
  }
}
