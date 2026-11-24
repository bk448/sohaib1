import type { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';
import type {
  ContactOption,
  ContactOptionType,
  Lead,
  LeadChannel,
  LeadPriority,
  LeadStatus,
  Site,
} from './utils';

export type {
  ContactOption,
  ContactOptionType,
  Lead,
  LeadChannel,
  LeadPriority,
  LeadStatus,
  Site,
};

export interface LeadFilterParams {
  siteId?: string;
  status?: string;
  priority?: string;
  channel?: string;
  division?: string;
  country?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

export interface LeadsPageResult {
  rows: Lead[];
  totalCount: number;
}

export interface SitePayload {
  name: string;
  domains: string;
  inboxes: string;
  match_keywords: string;
  exclude_keywords: string;
  channels: string;
  active: boolean;
  show_on_dashboard: boolean;
  dashboard_fields: string[];
  contact_options: ContactOption[];
  color: string;
}

export interface CreateManualLeadInput {
  site_id: string;
  site_name: string;
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  priority: LeadPriority;
}

function assertClient() {
  if (!supabase) {
    throw new Error(
      'Supabase client is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
    );
  }
  return supabase;
}

function sanitizePostgrestSearch(raw: string): string {
  // Strip PostgREST reserved filter delimiters so user search cannot break .or() syntax
  return raw.replace(/[,()]/g, ' ').trim();
}

function applyLeadFilters<T extends { eq: Function; gte: Function; lte: Function; or: Function }>(
  query: T,
  filters: LeadFilterParams
): T {
  let q = query;
  if (filters.siteId) {
    q = q.eq('site_id', filters.siteId);
  }
  if (filters.status) {
    q = q.eq('status', filters.status);
  }
  if (filters.priority) {
    q = q.eq('priority', filters.priority);
  }
  if (filters.channel) {
    q = q.eq('channel', filters.channel);
  }
  if (filters.division) {
    q = q.eq('division', filters.division);
  }
  if (filters.country) {
    q = q.eq('country', filters.country);
  }
  if (filters.dateFrom) {
    q = q.gte('received_at', `${filters.dateFrom}T00:00:00.000Z`);
  }
  if (filters.dateTo) {
    q = q.lte('received_at', `${filters.dateTo}T23:59:59.999Z`);
  }
  if (filters.search && filters.search.trim()) {
    const term = sanitizePostgrestSearch(filters.search);
    if (term) {
      const pattern = `%${term}%`;
      q = q.or(
        `name.ilike.${pattern},email.ilike.${pattern},subject.ilike.${pattern},message.ilike.${pattern}`
      );
    }
  }
  return q;
}

// ============================================================================
// Auth Calls
// ============================================================================

export async function getCurrentSession(): Promise<Session | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export function onAuthStateChange(
  callback: (session: Session | null, user: User | null) => void
): () => void {
  if (!supabase) return () => {};
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session, session?.user ?? null);
  });
  return () => subscription.unsubscribe();
}

export async function signInWithEmail(email: string, password: string): Promise<Session> {
  const client = assertClient();
  const { data, error } = await client.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error) throw error;
  if (!data.session) throw new Error('No session returned from Supabase Auth.');
  return data.session;
}

export async function signOutSession(): Promise<void> {
  const client = assertClient();
  const { error } = await client.auth.signOut();
  if (error) throw error;
}

// ============================================================================
// Sites CRUD
// ============================================================================

export async function fetchSites(): Promise<Site[]> {
  const client = assertClient();
  const { data, error } = await client
    .from('sites')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data || []) as Site[];
}

export async function createSite(payload: SitePayload): Promise<Site> {
  const client = assertClient();
  const { data, error } = await client
    .from('sites')
    .insert(payload)
    .select('*')
    .single();
  if (error) throw error;
  return data as Site;
}

export async function updateSite(id: string, payload: Partial<SitePayload>): Promise<Site> {
  const client = assertClient();
  const { data, error } = await client
    .from('sites')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data as Site;
}

export async function deleteSite(id: string): Promise<void> {
  const client = assertClient();
  const { error } = await client.from('sites').delete().eq('id', id);
  if (error) throw error;
}

// ============================================================================
// Leads Queries & Mutations
// ============================================================================

export async function fetchLeadsPage(
  filters: LeadFilterParams,
  page: number,
  pageSize = 50
): Promise<LeadsPageResult> {
  const client = assertClient();
  const from = Math.max(0, (page - 1) * pageSize);
  const to = from + pageSize - 1;

  let query = client.from('leads').select('*', { count: 'exact' });
  query = applyLeadFilters(query, filters);
  const { data, count, error } = await query
    .order('received_at', { ascending: false })
    .range(from, to);

  if (error) throw error;
  return {
    rows: (data || []) as Lead[],
    totalCount: count ?? 0,
  };
}

export async function fetchLeadsForExport(filters: LeadFilterParams): Promise<Lead[]> {
  const client = assertClient();
  let query = client.from('leads').select('*');
  query = applyLeadFilters(query, filters);
  const { data, error } = await query
    .order('received_at', { ascending: false })
    .limit(5000);
  if (error) throw error;
  return (data || []) as Lead[];
}

export async function fetchDashboardLeads(siteId?: string): Promise<Lead[]> {
  const client = assertClient();
  let query = client
    .from('leads')
    .select(
      'id, status, priority, channel, primary_service, country, site_id, site_name, received_at'
    )
    .order('received_at', { ascending: false })
    .limit(5000);

  if (siteId) {
    query = query.eq('site_id', siteId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as Lead[];
}

export async function fetchKanbanLeads(siteId?: string): Promise<Lead[]> {
  const client = assertClient();
  let query = client
    .from('leads')
    .select('*')
    .order('received_at', { ascending: false })
    .limit(500);

  if (siteId) {
    query = query.eq('site_id', siteId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as Lead[];
}

export async function fetchNewLeadCountsBySite(): Promise<{
  totalNew: number;
  bySiteId: Record<string, number>;
}> {
  const client = assertClient();
  const { data, error } = await client
    .from('leads')
    .select('id, site_id')
    .eq('status', 'New');
  if (error) throw error;

  const bySiteId: Record<string, number> = {};
  let totalNew = 0;

  (data || []).forEach((row: { id: string; site_id: string | null }) => {
    totalNew += 1;
    if (row.site_id) {
      bySiteId[row.site_id] = (bySiteId[row.site_id] || 0) + 1;
    }
  });

  return { totalNew, bySiteId };
}

export async function fetchDistinctLeadDimensions(): Promise<{
  divisions: string[];
  countries: string[];
}> {
  const client = assertClient();
  const { data, error } = await client
    .from('leads')
    .select('division, country')
    .limit(2000);
  if (error) throw error;

  const divSet = new Set<string>();
  const countrySet = new Set<string>();
  (data || []).forEach((r: { division: string | null; country: string | null }) => {
    if (r.division && r.division.trim()) divSet.add(r.division.trim());
    if (r.country && r.country.trim()) countrySet.add(r.country.trim());
  });

  return {
    divisions: Array.from(divSet).sort(),
    countries: Array.from(countrySet).sort(),
  };
}

export async function updateLead(
  id: string,
  updates: Partial<Pick<Lead, 'status' | 'notes' | 'priority' | 'site_id' | 'site_name'>>
): Promise<Lead> {
  const client = assertClient();
  const { data, error } = await client
    .from('leads')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data as Lead;
}

export async function bulkUpdateLeadStatus(ids: string[], status: LeadStatus): Promise<Lead[]> {
  const client = assertClient();
  const { data, error } = await client
    .from('leads')
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .in('id', ids)
    .select('*');
  if (error) throw error;
  return (data || []) as Lead[];
}

export async function createManualLead(input: CreateManualLeadInput): Promise<Lead> {
  const client = assertClient();
  const now = new Date().toISOString();
  const messageId =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? `manual-${crypto.randomUUID()}`
      : `manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const { data, error } = await client
    .from('leads')
    .insert({
      site_id: input.site_id,
      site_name: input.site_name,
      name: input.name.trim(),
      email: input.email.trim(),
      phone: input.phone.trim() || null,
      subject: input.subject.trim() || null,
      message: input.message.trim() || null,
      priority: input.priority,
      channel: 'manual',
      status: 'New',
      source_message_id: messageId,
      received_at: now,
      updated_at: now,
    })
    .select('*')
    .single();

  if (error) throw error;
  return data as Lead;
}

// ============================================================================
// Realtime Subscription
// ============================================================================

export function subscribeToLeadChanges(handlers: {
  onInsert: (lead: Lead) => void;
  onUpdate: (lead: Lead) => void;
}): () => void {
  if (!supabase) return () => {};
  const channel = supabase
    .channel('leads-live-changes')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'leads' },
      (payload) => {
        if (payload.new) {
          handlers.onInsert(payload.new as Lead);
        }
      }
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'leads' },
      (payload) => {
        if (payload.new) {
          handlers.onUpdate(payload.new as Lead);
        }
      }
    )
    .subscribe();

  return () => {
    supabase?.removeChannel(channel);
  };
}
