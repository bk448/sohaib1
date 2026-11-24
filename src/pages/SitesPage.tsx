import React, { useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  ExternalLink,
  FlaskConical,
  GripVertical,
  Info,
  Pencil,
  Plus,
  Trash2,
  X,
  XCircle,
} from 'lucide-react';
import {
  createSite,
  deleteSite,
  updateSite,
  type ContactOption,
  type ContactOptionType,
  type Lead,
  type LeadChannel,
  type Site,
  type SitePayload,
} from '../lib/data';
import {
  ALL_LEAD_FIELDS,
  DEFAULT_DASHBOARD_FIELDS,
  LEAD_CHANNELS,
  buildContactAction,
  evaluateSiteRules,
  formatChannelLabel,
  formatCsvTags,
  isContactOptionVisible,
} from '../lib/utils';
import { useApp } from '../components/AppContext';
import { useToast } from '../components/ToastContext';

const CONTACT_OPTION_TYPES: ContactOptionType[] = [
  'email',
  'phone',
  'whatsapp',
  'sms',
  'calendly',
  'link',
  'custom',
];

const SAMPLE_PREVIEW_LEAD: Partial<Lead> = {
  name: 'Sarah Lee',
  email: 'sarah.lee@example.com',
  phone: '+44 7700 900123',
  primary_service: 'Streamlined Filing',
  country: 'United Kingdom',
  subject: 'Streamlined Filing & FBAR Question',
};

function createEmptySiteForm(): SitePayload {
  return {
    name: '',
    color: '#2563EB',
    active: true,
    show_on_dashboard: true,
    domains: '',
    inboxes: '',
    match_keywords: '',
    exclude_keywords: '',
    channels: '',
    dashboard_fields: [...DEFAULT_DASHBOARD_FIELDS],
    contact_options: [
      {
        id: `opt-${Date.now()}-1`,
        type: 'email',
        label: 'Send Email',
        value: '',
        message_template: 'Hi {name},\n\nThanks for reaching out to {site} regarding {service}.',
        enabled: true,
      },
      {
        id: `opt-${Date.now()}-2`,
        type: 'whatsapp',
        label: 'WhatsApp',
        value: '',
        message_template: 'Hi {name}, following up on your {service} inquiry at {site}.',
        enabled: true,
      },
    ],
  };
}

export function SitesPage() {
  const { sites, sitesLoading, refreshSites } = useApp();
  const { addToast } = useToast();

  // Editor state
  const [editingId, setEditingId] = useState<string | 'new' | null>(null);
  const [form, setForm] = useState<SitePayload>(createEmptySiteForm);
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [dragFieldKey, setDragFieldKey] = useState<string | null>(null);

  // Test Rules simulator state
  const [testInput, setTestInput] = useState({
    channel: 'email' as LeadChannel,
    to: '',
    from: '',
    subject: '',
    body: '',
    website: '',
  });

  const testResults = useMemo(
    () => evaluateSiteRules(sites, testInput),
    [sites, testInput]
  );

  const openCreate = () => {
    setEditingId('new');
    setForm(createEmptySiteForm());
  };

  const openEdit = (site: Site) => {
    setEditingId(site.id);
    setForm({
      name: site.name || '',
      color: site.color || '#2563EB',
      active: Boolean(site.active),
      show_on_dashboard: Boolean(site.show_on_dashboard),
      domains: site.domains || '',
      inboxes: site.inboxes || '',
      match_keywords: site.match_keywords || '',
      exclude_keywords: site.exclude_keywords || '',
      channels: site.channels || '',
      dashboard_fields:
        Array.isArray(site.dashboard_fields) && site.dashboard_fields.length > 0
          ? [...site.dashboard_fields]
          : [...DEFAULT_DASHBOARD_FIELDS],
      contact_options: Array.isArray(site.contact_options)
        ? site.contact_options.map((o) => ({ ...o }))
        : [],
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      addToast({ variant: 'error', title: 'Site name is required.' });
      return;
    }

    setSaving(true);
    try {
      const payload: SitePayload = {
        ...form,
        name: form.name.trim(),
      };
      if (editingId === 'new') {
        await createSite(payload);
        addToast({ variant: 'success', title: `Site "${payload.name}" created` });
      } else if (editingId) {
        await updateSite(editingId, payload);
        addToast({ variant: 'success', title: `Site "${payload.name}" updated` });
      }
      await refreshSites();
      setEditingId(null);
    } catch (err) {
      addToast({
        variant: 'error',
        title: 'Failed to save site',
        description: err instanceof Error ? err.message : 'Supabase error.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(true);
    try {
      await deleteSite(id);
      addToast({ variant: 'success', title: 'Site deleted' });
      setConfirmDeleteId(null);
      if (editingId === id) setEditingId(null);
      await refreshSites();
    } catch (err) {
      addToast({
        variant: 'error',
        title: 'Failed to delete site',
        description: err instanceof Error ? err.message : 'Check if leads still reference this site.',
      });
    } finally {
      setDeleting(false);
    }
  };

  // Channel checkboxes helpers (comma-separated string, empty = all)
  const selectedChannels = formatCsvTags(form.channels);
  const toggleChannel = (ch: LeadChannel) => {
    const next = selectedChannels.includes(ch)
      ? selectedChannels.filter((c) => c !== ch)
      : [...selectedChannels, ch];
    setForm((prev) => ({ ...prev, channels: next.join(', ') }));
  };

  // Dashboard fields checklist + drag-to-reorder helpers
  const toggleDashboardField = (fieldKey: string) => {
    setForm((prev) => {
      const exists = prev.dashboard_fields.includes(fieldKey);
      return {
        ...prev,
        dashboard_fields: exists
          ? prev.dashboard_fields.filter((f) => f !== fieldKey)
          : [...prev.dashboard_fields, fieldKey],
      };
    });
  };

  const moveDashboardField = (index: number, delta: -1 | 1) => {
    setForm((prev) => {
      const target = index + delta;
      if (target < 0 || target >= prev.dashboard_fields.length) return prev;
      const copy = [...prev.dashboard_fields];
      const [item] = copy.splice(index, 1);
      copy.splice(target, 0, item);
      return { ...prev, dashboard_fields: copy };
    });
  };

  const handleFieldDrop = (targetKey: string) => {
    if (!dragFieldKey || dragFieldKey === targetKey) return;
    setForm((prev) => {
      const copy = [...prev.dashboard_fields];
      const fromIdx = copy.indexOf(dragFieldKey);
      const toIdx = copy.indexOf(targetKey);
      if (fromIdx === -1 || toIdx === -1) return prev;
      const [moved] = copy.splice(fromIdx, 1);
      copy.splice(toIdx, 0, moved);
      return { ...prev, dashboard_fields: copy };
    });
    setDragFieldKey(null);
  };

  // Contact options builder helpers
  const addContactOption = () => {
    setForm((prev) => ({
      ...prev,
      contact_options: [
        ...prev.contact_options,
        {
          id: `opt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          type: 'link',
          label: 'New Action',
          value: 'https://',
          message_template: '',
          enabled: true,
        },
      ],
    }));
  };

  const updateContactOption = (id: string, patch: Partial<ContactOption>) => {
    setForm((prev) => ({
      ...prev,
      contact_options: prev.contact_options.map((opt) =>
        opt.id === id ? { ...opt, ...patch } : opt
      ),
    }));
  };

  const removeContactOption = (id: string) => {
    setForm((prev) => ({
      ...prev,
      contact_options: prev.contact_options.filter((opt) => opt.id !== id),
    }));
  };

  const moveContactOption = (index: number, delta: -1 | 1) => {
    setForm((prev) => {
      const target = index + delta;
      if (target < 0 || target >= prev.contact_options.length) return prev;
      const copy = [...prev.contact_options];
      const [item] = copy.splice(index, 1);
      copy.splice(target, 0, item);
      return { ...prev, contact_options: copy };
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Sites &amp; Routing Rules
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Single source of truth for n8n lead matching, table columns, and site contact buttons.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-slate-900 dark:bg-blue-600 rounded-md hover:bg-slate-800 dark:hover:bg-blue-500 whitespace-nowrap"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Site</span>
        </button>
      </div>

      {/* Matching Logic Helper Banner */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 flex items-start gap-3 text-xs">
        <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
        <div className="space-y-1 text-slate-600 dark:text-slate-300 leading-relaxed">
          <p className="font-semibold text-slate-900 dark:text-white">
            n8n Site Matching Logic
          </p>
          <p>
            Inactive sites (<code className="font-mono">active = false</code>) are skipped. If{' '}
            <code className="font-mono">channels</code> is set, the lead&apos;s channel must match.
            If <code className="font-mono">inboxes</code> is set and the lead is an email, To/Cc
            must contain one of the inboxes. Any{' '}
            <code className="font-mono">exclude_keyword</code> found in{' '}
            <code className="font-mono">subject + message + from + to + website</code> disqualifies
            the site. Otherwise,{' '}
            <code className="font-mono">
              score = 3 × (matched domains) + (matched keywords)
            </code>{' '}
            (with a fallback score of <code className="font-mono">1</code> if a site only specifies
            inboxes). Any site with <code className="font-mono">score &gt; 0</code> matches.
          </p>
        </div>
      </div>

      {/* Sites List */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
        {sitesLoading ? (
          <div className="p-6 space-y-3">
            <div className="h-10 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
            <div className="h-10 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
          </div>
        ) : sites.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm font-semibold text-slate-900 dark:text-white">
              No Sites Configured
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Create your first site so incoming leads can be routed and displayed.
            </p>
            <button
              type="button"
              onClick={openCreate}
              className="mt-4 px-4 py-2 text-xs font-medium text-white bg-slate-900 dark:bg-blue-600 rounded-md"
            >
              Create First Site
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[780px]">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-500 dark:text-slate-400">
                  <th className="py-2.5 px-4">Site</th>
                  <th className="py-2.5 px-4">Domains &amp; Inboxes</th>
                  <th className="py-2.5 px-4">Channels</th>
                  <th className="py-2.5 px-4">Flags</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                {sites.map((site) => (
                  <tr key={site.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <span
                          className="w-3 h-3 rounded-full shrink-0 border border-black/10 dark:border-white/20"
                          style={{ backgroundColor: site.color || '#2563EB' }}
                        />
                        <span className="font-semibold text-slate-900 dark:text-white text-sm">
                          {site.name}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 max-w-[300px]">
                      <div className="font-mono text-[11px] text-slate-700 dark:text-slate-300 truncate">
                        {site.domains || '—'}
                      </div>
                      {site.inboxes && (
                        <div className="font-mono text-[11px] text-slate-400 truncate mt-0.5">
                          {site.inboxes}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                      {site.channels ? site.channels : 'All channels'}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded border text-[11px] font-medium ${
                            site.active
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                              : 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                          }`}
                        >
                          {site.active ? 'Active' : 'Inactive'}
                        </span>
                        {site.show_on_dashboard && (
                          <span className="px-2 py-0.5 rounded border text-[11px] font-medium bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800">
                            Sidebar
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openEdit(site)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded hover:bg-slate-50 dark:hover:bg-slate-700"
                        >
                          <Pencil className="w-3 h-3" />
                          <span>Edit</span>
                        </button>
                        {confirmDeleteId === site.id ? (
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              disabled={deleting}
                              onClick={() => handleDelete(site.id)}
                              className="px-2.5 py-1.5 text-xs font-semibold text-white bg-red-600 rounded hover:bg-red-500"
                            >
                              Confirm
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-2 py-1.5 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-white"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(site.id)}
                            className="p-1.5 text-slate-400 hover:text-red-600 rounded"
                            aria-label={`Delete ${site.name}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Site Create/Edit Form */}
      {editingId !== null && (
        <form
          onSubmit={handleSave}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 sm:p-6 space-y-6"
        >
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              {editingId === 'new' ? 'Create New Site' : `Edit Site: ${form.name}`}
            </h2>
            <button
              type="button"
              onClick={() => setEditingId(null)}
              className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded"
              aria-label="Close editor"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Core Identity & Flags */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Site Name *
              </label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="e.g. US Expat Tax UK"
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Color (Hex)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={form.color}
                  onChange={(e) => setForm((p) => ({ ...p, color: e.target.value }))}
                  className="h-9 w-11 p-0.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded cursor-pointer"
                />
                <input
                  type="text"
                  value={form.color}
                  onChange={(e) => setForm((p) => ({ ...p, color: e.target.value }))}
                  className="flex-1 px-2.5 py-2 text-xs font-mono bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2 pb-1">
              <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setForm((p) => ({ ...p, active: e.target.checked }))}
                  className="rounded border-slate-300 dark:border-slate-600"
                />
                <span>Active (enabled in n8n rules)</span>
              </label>
              <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.show_on_dashboard}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, show_on_dashboard: e.target.checked }))
                  }
                  className="rounded border-slate-300 dark:border-slate-600"
                />
                <span>Show on Sidebar</span>
              </label>
            </div>
          </div>

          {/* Tag Inputs */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <TagInput
              label="Domains"
              placeholder="Add domain (e.g. americantaxabroad.co.uk)..."
              value={form.domains}
              onChange={(val) => setForm((p) => ({ ...p, domains: val }))}
            />
            <TagInput
              label="Inboxes"
              placeholder="Add inbox email (e.g. leads@domain.com)..."
              value={form.inboxes}
              onChange={(val) => setForm((p) => ({ ...p, inboxes: val }))}
            />
            <TagInput
              label="Match Keywords"
              placeholder="Add keyword and press Enter..."
              value={form.match_keywords}
              onChange={(val) => setForm((p) => ({ ...p, match_keywords: val }))}
            />
            <TagInput
              label="Exclude Keywords"
              placeholder="Add exclusion keyword and press Enter..."
              value={form.exclude_keywords}
              onChange={(val) => setForm((p) => ({ ...p, exclude_keywords: val }))}
            />
          </div>

          {/* Channels Checkboxes */}
          <div>
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
              Allowed Channels (leave all unchecked to allow all channels)
            </p>
            <div className="flex flex-wrap gap-4">
              {LEAD_CHANNELS.map((ch) => (
                <label
                  key={ch}
                  className="inline-flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedChannels.includes(ch)}
                    onChange={() => toggleChannel(ch)}
                    className="rounded border-slate-300 dark:border-slate-600"
                  />
                  <span>{formatChannelLabel(ch)}</span>
                </label>
              ))}
            </div>
          </div>

          <hr className="border-slate-200 dark:border-slate-800" />

          {/* Dashboard Fields Checklist + Drag-to-Reorder */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Dashboard Fields (Select Columns)
              </h3>
              <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-lg max-h-64 overflow-y-auto">
                {ALL_LEAD_FIELDS.map((field) => (
                  <label
                    key={field.key}
                    className="inline-flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={form.dashboard_fields.includes(field.key)}
                      onChange={() => toggleDashboardField(field.key)}
                      className="rounded border-slate-300 dark:border-slate-600"
                    />
                    <span className="truncate">{field.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Display Order (Drag to reorder)
              </h3>
              <div className="space-y-1.5 p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-lg max-h-64 overflow-y-auto">
                {form.dashboard_fields.length === 0 ? (
                  <p className="text-xs text-slate-400">
                    No columns selected (fallback defaults will be used).
                  </p>
                ) : (
                  form.dashboard_fields.map((key, idx) => {
                    const def = ALL_LEAD_FIELDS.find((f) => f.key === key);
                    return (
                      <div
                        key={key}
                        draggable
                        onDragStart={() => setDragFieldKey(key)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => handleFieldDrop(key)}
                        className="flex items-center justify-between gap-2 px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-xs cursor-grab active:cursor-grabbing"
                      >
                        <div className="flex items-center gap-2">
                          <GripVertical className="w-3.5 h-3.5 text-slate-400" />
                          <span className="font-medium text-slate-800 dark:text-slate-200">
                            {def?.label || key}
                          </span>
                          <span className="font-mono text-[10px] text-slate-400">{key}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => moveDashboardField(idx, -1)}
                            className="p-1 text-slate-400 hover:text-slate-800 dark:hover:text-white disabled:opacity-30"
                            aria-label="Move up"
                          >
                            <ArrowUp className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === form.dashboard_fields.length - 1}
                            onClick={() => moveDashboardField(idx, 1)}
                            className="p-1 text-slate-400 hover:text-slate-800 dark:hover:text-white disabled:opacity-30"
                            aria-label="Move down"
                          >
                            <ArrowDown className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          <hr className="border-slate-200 dark:border-slate-800" />

          {/* Contact Options Builder + Live Preview */}
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Contact Options Builder
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Placeholders supported in value &amp; template:{' '}
                  <code className="font-mono">{'{name}'}</code>,{' '}
                  <code className="font-mono">{'{email}'}</code>,{' '}
                  <code className="font-mono">{'{phone}'}</code>,{' '}
                  <code className="font-mono">{'{service}'}</code>,{' '}
                  <code className="font-mono">{'{country}'}</code>,{' '}
                  <code className="font-mono">{'{site}'}</code>
                </p>
              </div>
              <button
                type="button"
                onClick={addContactOption}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Option</span>
              </button>
            </div>

            {form.contact_options.length === 0 ? (
              <p className="text-xs text-slate-400">No contact options configured yet.</p>
            ) : (
              <div className="space-y-3">
                {form.contact_options.map((opt, idx) => (
                  <div
                    key={opt.id}
                    className="p-3.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-lg space-y-3"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                      <div className="sm:col-span-3">
                        <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                          Type
                        </label>
                        <select
                          value={opt.type}
                          onChange={(e) =>
                            updateContactOption(opt.id, {
                              type: e.target.value as ContactOptionType,
                            })
                          }
                          className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded"
                        >
                          {CONTACT_OPTION_TYPES.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="sm:col-span-3">
                        <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                          Button Label
                        </label>
                        <input
                          type="text"
                          value={opt.label}
                          onChange={(e) =>
                            updateContactOption(opt.id, { label: e.target.value })
                          }
                          placeholder="e.g. Book Calendly"
                          className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded"
                        />
                      </div>

                      <div className="sm:col-span-4">
                        <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                          Value (URL for calendly/link/custom)
                        </label>
                        <input
                          type="text"
                          value={opt.value}
                          onChange={(e) =>
                            updateContactOption(opt.id, { value: e.target.value })
                          }
                          placeholder={
                            opt.type === 'calendly' || opt.type === 'link'
                              ? 'https://calendly.com/...'
                              : opt.type === 'custom'
                                ? 'https://crm.example.com/?email={email}'
                                : '(uses lead email/phone)'
                          }
                          className="w-full px-2.5 py-1.5 text-xs font-mono bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded"
                        />
                      </div>

                      <div className="sm:col-span-2 flex items-center justify-between gap-2 pb-1">
                        <label className="inline-flex items-center gap-1.5 text-xs cursor-pointer">
                          <input
                            type="checkbox"
                            checked={opt.enabled}
                            onChange={(e) =>
                              updateContactOption(opt.id, { enabled: e.target.checked })
                            }
                          />
                          <span>Enabled</span>
                        </label>
                        <div className="flex items-center gap-0.5">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => moveContactOption(idx, -1)}
                            className="p-1 text-slate-400 hover:text-slate-800 dark:hover:text-white disabled:opacity-30"
                            aria-label="Move option up"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === form.contact_options.length - 1}
                            onClick={() => moveContactOption(idx, 1)}
                            className="p-1 text-slate-400 hover:text-slate-800 dark:hover:text-white disabled:opacity-30"
                            aria-label="Move option down"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeContactOption(opt.id)}
                            className="p-1 text-slate-400 hover:text-red-600"
                            aria-label="Remove option"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                        Message Template (for email, whatsapp, sms)
                      </label>
                      <textarea
                        rows={2}
                        value={opt.message_template}
                        onChange={(e) =>
                          updateContactOption(opt.id, { message_template: e.target.value })
                        }
                        placeholder="Hi {name}, thanks for contacting {site}..."
                        className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Live Preview */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-lg space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Live Preview (Sample Lead: {SAMPLE_PREVIEW_LEAD.name} · {SAMPLE_PREVIEW_LEAD.email}{' '}
                  · {SAMPLE_PREVIEW_LEAD.phone})
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {form.contact_options
                  .filter((o) => isContactOptionVisible(o, SAMPLE_PREVIEW_LEAD))
                  .map((opt) => {
                    const built = buildContactAction(
                      opt,
                      SAMPLE_PREVIEW_LEAD,
                      form.name || 'Site'
                    );
                    if (!built) return null;
                    return (
                      <a
                        key={opt.id}
                        href={built.href}
                        target={built.external ? '_blank' : undefined}
                        rel={built.external ? 'noopener noreferrer' : undefined}
                        title={built.href}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-900 dark:bg-blue-600 text-white rounded-md hover:opacity-90"
                      >
                        <span>{opt.label || opt.type}</span>
                        <ExternalLink className="w-3 h-3 opacity-80" />
                      </a>
                    );
                  })}
              </div>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setEditingId(null)}
              className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 dark:bg-blue-600 rounded-md hover:bg-slate-800 dark:hover:bg-blue-500 disabled:opacity-50"
            >
              {saving ? 'Saving...' : editingId === 'new' ? 'Create Site' : 'Save Changes'}
            </button>
          </div>
        </form>
      )}

      {/* Test Rules Panel */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 sm:p-6 space-y-4">
        <div className="flex items-center gap-2">
          <FlaskConical className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            Test Matching Rules
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 text-xs">
          <div>
            <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
              Channel
            </label>
            <select
              value={testInput.channel}
              onChange={(e) =>
                setTestInput((p) => ({ ...p, channel: e.target.value as LeadChannel }))
              }
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md"
            >
              {LEAD_CHANNELS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
              To / Cc Address
            </label>
            <input
              type="text"
              value={testInput.to}
              onChange={(e) => setTestInput((p) => ({ ...p, to: e.target.value }))}
              placeholder="leads@usexpatcpa.com"
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md font-mono"
            />
          </div>
          <div>
            <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
              From Address
            </label>
            <input
              type="text"
              value={testInput.from}
              onChange={(e) => setTestInput((p) => ({ ...p, from: e.target.value }))}
              placeholder="client@gmail.com"
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md font-mono"
            />
          </div>
          <div>
            <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
              Website
            </label>
            <input
              type="text"
              value={testInput.website}
              onChange={(e) => setTestInput((p) => ({ ...p, website: e.target.value }))}
              placeholder="americantaxabroad.co.uk"
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md font-mono"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
              Subject
            </label>
            <input
              type="text"
              value={testInput.subject}
              onChange={(e) => setTestInput((p) => ({ ...p, subject: e.target.value }))}
              placeholder="Inquiry about Form 5471 and UK Ltd company"
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md"
            />
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
              Body / Message
            </label>
            <textarea
              rows={2}
              value={testInput.body}
              onChange={(e) => setTestInput((p) => ({ ...p, body: e.target.value }))}
              placeholder="Paste sample email or form message body..."
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md"
            />
          </div>
        </div>

        <div className="space-y-2 pt-2">
          <h3 className="text-xs font-semibold text-slate-600 dark:text-slate-400">
            Evaluation Results ({testResults.filter((r) => r.matched).length} matched)
          </h3>
          {testResults.length === 0 ? (
            <p className="text-xs text-slate-400">Create at least one site to test rules.</p>
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
              {testResults
                .slice()
                .sort((a, b) => Number(b.matched) - Number(a.matched) || b.score - a.score)
                .map((res) => (
                  <div
                    key={res.site.id}
                    className="px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs bg-white dark:bg-slate-900"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {res.matched ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      ) : (
                        <XCircle className="w-4 h-4 text-slate-400 shrink-0" />
                      )}
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: res.site.color || '#2563EB' }}
                      />
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {res.site.name}
                      </span>
                      <span className="text-slate-500 dark:text-slate-400 truncate">
                        {res.reason}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 font-mono shrink-0">
                      {res.matchedDomains.length > 0 && (
                        <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded text-[11px]">
                          domains: {res.matchedDomains.join(', ')}
                        </span>
                      )}
                      {res.matchedKeywords.length > 0 && (
                        <span className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded text-[11px]">
                          keywords: {res.matchedKeywords.join(', ')}
                        </span>
                      )}
                      <span
                        className={`px-2 py-0.5 rounded border font-semibold tabular-nums ${
                          res.matched
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                            : 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                        }`}
                      >
                        Score: {res.score}
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function TagInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (nextCsv: string) => void;
  placeholder: string;
}) {
  const [draft, setDraft] = useState('');
  const tags = formatCsvTags(value);

  const commitDraft = (raw: string) => {
    const incoming = raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (incoming.length === 0) return;
    const merged = Array.from(new Set([...tags, ...incoming]));
    onChange(merged.join(', '));
    setDraft('');
  };

  const removeTag = (tag: string) => {
    onChange(tags.filter((t) => t !== tag).join(', '));
  };

  return (
    <div>
      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
        {label}
      </label>
      <div className="p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md space-y-2">
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-mono bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-600 rounded"
              >
                <span>{tag}</span>
                <button
                  type="button"
                  onClick={() => removeTag(tag)}
                  className="text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  aria-label={`Remove ${tag}`}
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault();
                commitDraft(draft);
              }
            }}
            onBlur={() => {
              if (draft.trim()) commitDraft(draft);
            }}
            placeholder={placeholder}
            className="flex-1 text-xs font-mono bg-transparent text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none"
          />
          {draft.trim() && (
            <button
              type="button"
              onClick={() => commitDraft(draft)}
              className="px-2 py-0.5 text-[11px] font-medium bg-slate-900 dark:bg-blue-600 text-white rounded"
            >
              Add
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
