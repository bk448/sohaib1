import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { createManualLead, type LeadPriority } from '../lib/data';
import { useApp } from './AppContext';
import { useToast } from './ToastContext';

export function AddLeadModal() {
  const { isAddLeadOpen, setIsAddLeadOpen, sites, refreshNewCounts } = useApp();
  const { addToast } = useToast();

  const [siteId, setSiteId] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [priority, setPriority] = useState<LeadPriority>('normal');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isAddLeadOpen && sites.length > 0 && !siteId) {
      const activeFirst = sites.find((s) => s.active) || sites[0];
      setSiteId(activeFirst.id);
    }
  }, [isAddLeadOpen, sites, siteId]);

  useEffect(() => {
    if (!isAddLeadOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsAddLeadOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isAddLeadOpen, setIsAddLeadOpen]);

  if (!isAddLeadOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const chosenSite = sites.find((s) => s.id === siteId);
    if (!chosenSite) {
      addToast({
        variant: 'error',
        title: 'Select a site',
        description: 'Create or select a site before adding a manual lead.',
      });
      return;
    }

    setSubmitting(true);
    try {
      await createManualLead({
        site_id: chosenSite.id,
        site_name: chosenSite.name,
        name,
        email,
        phone,
        subject,
        message,
        priority,
      });

      addToast({
        variant: 'success',
        title: 'Lead added',
        description: `Manual lead created for ${chosenSite.name}.`,
      });
      refreshNewCounts();
      setName('');
      setEmail('');
      setPhone('');
      setSubject('');
      setMessage('');
      setPriority('normal');
      setIsAddLeadOpen(false);
    } catch (err) {
      addToast({
        variant: 'error',
        title: 'Failed to create lead',
        description: err instanceof Error ? err.message : 'Supabase insert error.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-slate-900/50"
        onClick={() => setIsAddLeadOpen(false)}
      />
      <form
        onSubmit={handleSubmit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-manual-lead-title"
        className="relative z-10 w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-xl flex flex-col max-h-[90vh]"
      >
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h2
              id="add-manual-lead-title"
              className="text-base font-bold text-slate-900 dark:text-white"
            >
              Add Manual Lead
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Inserts into Supabase with channel &ldquo;manual&rdquo; and status &ldquo;New&rdquo;.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsAddLeadOpen(false)}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto text-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Site *
              </label>
              <select
                required
                value={siteId}
                onChange={(e) => setSiteId(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                <option value="" disabled>
                  Select site...
                </option>
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as LeadPriority)}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                <option value="normal">normal</option>
                <option value="high">high</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Name *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Sarah Lee"
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Email *
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="sarah@example.com"
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Phone
            </label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+44 7700 900123"
              className="w-full px-3 py-2 text-sm font-mono bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Subject
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Summary of inquiry..."
              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Message
            </label>
            <textarea
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Detailed notes or message..."
              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
        </div>

        <div className="px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={() => setIsAddLeadOpen(false)}
            className="px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md hover:bg-slate-50 dark:hover:bg-slate-700"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || sites.length === 0}
            className="px-4 py-2 text-xs font-medium text-white bg-slate-900 dark:bg-blue-600 rounded-md hover:bg-slate-800 dark:hover:bg-blue-500 disabled:opacity-50"
          >
            {submitting ? 'Saving...' : 'Create Lead'}
          </button>
        </div>
      </form>
    </div>
  );
}
