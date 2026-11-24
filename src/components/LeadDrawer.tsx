import React, { useEffect, useState } from 'react';
import {
  Calendar,
  Check,
  ExternalLink,
  Link2,
  Mail,
  MessageSquare,
  Phone,
  Save,
  Send,
  X,
} from 'lucide-react';
import {
  LEAD_STATUSES,
  buildContactAction,
  formatChannelLabel,
  formatDateTime,
  getPriorityBadgeClass,
  getSafeExternalUrl,
  getStatusBadgeClass,
  isContactOptionVisible,
  type ContactOption,
  type LeadStatus,
} from '../lib/utils';
import { updateLead } from '../lib/data';
import { useApp } from './AppContext';
import { useToast } from './ToastContext';

function getContactIcon(type: ContactOption['type']) {
  switch (type) {
    case 'email':
      return <Mail className="w-3.5 h-3.5" />;
    case 'phone':
      return <Phone className="w-3.5 h-3.5" />;
    case 'whatsapp':
    case 'sms':
      return <MessageSquare className="w-3.5 h-3.5" />;
    case 'calendly':
      return <Calendar className="w-3.5 h-3.5" />;
    case 'link':
    case 'custom':
      return <Link2 className="w-3.5 h-3.5" />;
  }
}

export function LeadDrawer() {
  const { selectedLead, setSelectedLead, sites, refreshNewCounts } = useApp();
  const { addToast } = useToast();

  const [notesDraft, setNotesDraft] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [updatingSite, setUpdatingSite] = useState(false);
  const [promptMarkContacted, setPromptMarkContacted] = useState(false);

  useEffect(() => {
    if (selectedLead) {
      setNotesDraft(selectedLead.notes || '');
      setPromptMarkContacted(false);
    }
  }, [selectedLead?.id]);

  useEffect(() => {
    if (!selectedLead) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedLead(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedLead, setSelectedLead]);

  if (!selectedLead) return null;

  const leadSite = sites.find((s) => s.id === selectedLead.site_id) || null;
  const contactOptions = (leadSite?.contact_options || []).filter((opt) =>
    isContactOptionVisible(opt, selectedLead)
  );
  const safePageUrl = getSafeExternalUrl(selectedLead.page_url);
  const extraEntries =
    selectedLead.extra && typeof selectedLead.extra === 'object'
      ? Object.entries(selectedLead.extra)
      : [];

  const handleStatusChange = async (nextStatus: LeadStatus) => {
    setUpdatingStatus(true);
    try {
      const updated = await updateLead(selectedLead.id, { status: nextStatus });
      setSelectedLead(updated);
      setPromptMarkContacted(false);
      refreshNewCounts();
      addToast({
        variant: 'success',
        title: `Status updated to "${nextStatus}"`,
      });
    } catch (err) {
      addToast({
        variant: 'error',
        title: 'Failed to update status',
        description: err instanceof Error ? err.message : 'Supabase update failed.',
      });
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleSaveNotes = async () => {
    setSavingNotes(true);
    try {
      const updated = await updateLead(selectedLead.id, { notes: notesDraft });
      setSelectedLead(updated);
      addToast({
        variant: 'success',
        title: 'Notes saved',
      });
    } catch (err) {
      addToast({
        variant: 'error',
        title: 'Failed to save notes',
        description: err instanceof Error ? err.message : 'Supabase update failed.',
      });
    } finally {
      setSavingNotes(false);
    }
  };

  const handleChangeSite = async (nextSiteId: string) => {
    const targetSite = sites.find((s) => s.id === nextSiteId);
    if (!targetSite) return;

    setUpdatingSite(true);
    try {
      const updated = await updateLead(selectedLead.id, {
        site_id: targetSite.id,
        site_name: targetSite.name,
      });
      setSelectedLead(updated);
      refreshNewCounts();
      addToast({
        variant: 'success',
        title: `Lead moved to "${targetSite.name}"`,
      });
    } catch (err) {
      addToast({
        variant: 'error',
        title: 'Failed to change site',
        description: err instanceof Error ? err.message : 'Supabase update failed.',
      });
    } finally {
      setUpdatingSite(false);
    }
  };

  const handleContactClick = () => {
    if (selectedLead.status === 'New') {
      setPromptMarkContacted(true);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="fixed inset-0 bg-slate-900/45 transition-opacity"
        onClick={() => setSelectedLead(null)}
      />
      <aside
        aria-label="Lead Details"
        className="relative z-10 w-full max-w-2xl bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col h-full overflow-hidden"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-start justify-between gap-4 shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white truncate">
                {selectedLead.name || selectedLead.email || 'Unnamed Lead'}
              </h2>
              <span
                className={`px-2 py-0.5 text-[11px] font-semibold border rounded ${getPriorityBadgeClass(
                  selectedLead.priority
                )}`}
              >
                {selectedLead.priority === 'high' ? 'High Priority' : 'Normal'}
              </span>
            </div>
            <div className="mt-1 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
              <span>{selectedLead.site_name || 'Unassigned site'}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">
                {formatDateTime(selectedLead.received_at)}
              </span>
              {selectedLead.country && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{selectedLead.country}</span>
                </>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setSelectedLead(null)}
            className="p-1.5 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
            aria-label="Close drawer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* Status & Site Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                Status
              </label>
              <select
                value={selectedLead.status}
                disabled={updatingStatus}
                onChange={(e) => handleStatusChange(e.target.value as LeadStatus)}
                className={`w-full px-3 py-2 text-xs font-semibold border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600 ${getStatusBadgeClass(
                  selectedLead.status
                )}`}
              >
                {LEAD_STATUSES.map((s) => (
                  <option
                    key={s}
                    value={s}
                    className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                  >
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                Change Site
              </label>
              <select
                value={selectedLead.site_id || ''}
                disabled={updatingSite}
                onChange={(e) => handleChangeSite(e.target.value)}
                className="w-full px-3 py-2 text-xs font-medium bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                <option value="" disabled>
                  Select site...
                </option>
                {sites.map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Contact Actions Section */}
          <div className="space-y-2.5">
            <h3 className="text-xs font-semibold text-slate-600 dark:text-slate-400">
              Contact ({leadSite ? leadSite.name : 'Site options'})
            </h3>

            {contactOptions.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-md px-3 py-2.5">
                No enabled contact options match the available contact details for this lead.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {contactOptions.map((opt) => {
                  const action = buildContactAction(
                    opt,
                    selectedLead,
                    leadSite?.name || selectedLead.site_name || ''
                  );
                  if (!action) return null;
                  return (
                    <a
                      key={opt.id}
                      href={action.href}
                      target={action.external ? '_blank' : undefined}
                      rel={action.external ? 'noopener noreferrer' : undefined}
                      onClick={handleContactClick}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-slate-900 dark:bg-blue-600 text-white rounded-md hover:bg-slate-800 dark:hover:bg-blue-500 transition-colors whitespace-nowrap"
                    >
                      {getContactIcon(opt.type)}
                      <span>{opt.label || opt.type}</span>
                      {action.external && <ExternalLink className="w-3 h-3 opacity-80" />}
                    </a>
                  );
                })}
              </div>
            )}

            {promptMarkContacted && selectedLead.status === 'New' && (
              <div className="flex items-center justify-between gap-3 p-3 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 rounded-md">
                <p className="text-xs font-medium text-blue-900 dark:text-blue-200">
                  You initiated contact. Mark this lead as &ldquo;Contacted&rdquo;?
                </p>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setPromptMarkContacted(false)}
                    className="px-2.5 py-1 text-xs text-slate-600 dark:text-slate-300 hover:underline"
                  >
                    Dismiss
                  </button>
                  <button
                    type="button"
                    disabled={updatingStatus}
                    onClick={() => handleStatusChange('Contacted')}
                    className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold text-white bg-blue-700 rounded hover:bg-blue-600"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Mark Contacted</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          <hr className="border-slate-200 dark:border-slate-800" />

          {/* Subject & Full Message */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-slate-600 dark:text-slate-400">
              Subject &amp; Message
            </h3>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">
              {selectedLead.subject || 'No subject'}
            </p>
            <div className="p-4 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
              {selectedLead.message || 'No message body recorded.'}
            </div>
          </div>

          {/* All Lead Fields */}
          <div className="space-y-2.5">
            <h3 className="text-xs font-semibold text-slate-600 dark:text-slate-400">
              Lead Fields
            </h3>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5 text-xs border border-slate-200 dark:border-slate-800 rounded-lg p-4 bg-slate-50/50 dark:bg-slate-800/30">
              <FieldRow label="Name" value={selectedLead.name} />
              <FieldRow label="Email" value={selectedLead.email} />
              <FieldRow label="Phone" value={selectedLead.phone} mono />
              <FieldRow label="Country" value={selectedLead.country} />
              <FieldRow label="Channel" value={formatChannelLabel(selectedLead.channel)} />
              <FieldRow label="Source Website" value={selectedLead.source_website} />
              <FieldRow label="Inbox" value={selectedLead.inbox} />
              <FieldRow label="Division" value={selectedLead.division_name || selectedLead.division} />
              <FieldRow label="Primary Service" value={selectedLead.primary_service} />
              <FieldRow label="Services" value={selectedLead.services} />
              <FieldRow label="Received At" value={formatDateTime(selectedLead.received_at)} mono />
              <FieldRow label="Updated At" value={formatDateTime(selectedLead.updated_at)} mono />
              <FieldRow label="Source Message ID" value={selectedLead.source_message_id} mono />
              <div className="sm:col-span-2">
                <dt className="text-slate-500 dark:text-slate-400 mb-0.5">Page URL</dt>
                <dd>
                  {safePageUrl ? (
                    <a
                      href={safePageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-blue-700 dark:text-blue-400 hover:underline font-mono text-[11px] break-all"
                    >
                      <span>{selectedLead.page_url}</span>
                      <ExternalLink className="w-3 h-3 shrink-0" />
                    </a>
                  ) : (
                    <span className="text-slate-400">{selectedLead.page_url || '—'}</span>
                  )}
                </dd>
              </div>
            </dl>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label
                htmlFor="lead-notes-textarea"
                className="text-xs font-semibold text-slate-600 dark:text-slate-400"
              >
                Internal Notes
              </label>
              <button
                type="button"
                disabled={savingNotes}
                onClick={handleSaveNotes}
                className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-white bg-slate-900 dark:bg-blue-600 rounded hover:bg-slate-800 dark:hover:bg-blue-500 disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{savingNotes ? 'Saving...' : 'Save Notes'}</span>
              </button>
            </div>
            <textarea
              id="lead-notes-textarea"
              rows={4}
              value={notesDraft}
              onChange={(e) => setNotesDraft(e.target.value)}
              placeholder="Add qualification notes, follow-up reminders, or fee estimates..."
              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          {/* Extra Key/Value List */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-slate-600 dark:text-slate-400">
              Extra Form Fields
            </h3>
            {extraEntries.length === 0 ? (
              <p className="text-xs text-slate-400">No extra fields recorded.</p>
            ) : (
              <div className="border border-slate-200 dark:border-slate-800 rounded-lg divide-y divide-slate-200 dark:divide-slate-800 overflow-hidden">
                {extraEntries.map(([key, val]) => (
                  <div
                    key={key}
                    className="px-3.5 py-2 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1 sm:gap-4 text-xs bg-white dark:bg-slate-900"
                  >
                    <span className="font-mono font-medium text-slate-500 dark:text-slate-400 shrink-0">
                      {key}
                    </span>
                    <span className="font-mono text-slate-800 dark:text-slate-200 break-all sm:text-right">
                      {typeof val === 'object' && val !== null
                        ? JSON.stringify(val)
                        : String(val ?? '—')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}

function FieldRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string | null | undefined;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="text-slate-500 dark:text-slate-400 mb-0.5">{label}</dt>
      <dd
        className={`text-slate-900 dark:text-slate-100 break-words ${
          mono ? 'font-mono text-[11px] tabular-nums' : 'font-medium'
        }`}
      >
        {value && value.trim() ? value : '—'}
      </dd>
    </div>
  );
}
