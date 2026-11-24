import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { GripVertical, RefreshCw } from 'lucide-react';
import { fetchKanbanLeads, updateLead, type Lead, type LeadStatus } from '../lib/data';
import {
  LEAD_STATUSES,
  formatChannelLabel,
  formatShortDate,
  getStatusBadgeClass,
} from '../lib/utils';
import { useApp } from '../components/AppContext';
import { useToast } from '../components/ToastContext';

export function KanbanPage() {
  const { sites, setSelectedLead, realtimeTick, refreshNewCounts } = useApp();
  const { addToast } = useToast();

  const [siteFilter, setSiteFilter] = useState<string>('');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [draggedLeadId, setDraggedLeadId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<LeadStatus | null>(null);

  const loadLeads = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchKanbanLeads(siteFilter || undefined);
      setLeads(data);
    } catch (err) {
      addToast({
        variant: 'error',
        title: 'Failed to load Kanban leads',
        description: err instanceof Error ? err.message : 'Supabase query error.',
      });
    } finally {
      setLoading(false);
    }
  }, [siteFilter, addToast]);

  useEffect(() => {
    loadLeads();
  }, [loadLeads, realtimeTick]);

  const grouped = useMemo(() => {
    const map: Record<LeadStatus, Lead[]> = {
      New: [],
      Contacted: [],
      Qualified: [],
      'Proposal Sent': [],
      Won: [],
      'Closed Lost': [],
    };
    leads.forEach((lead) => {
      const st = (LEAD_STATUSES.includes(lead.status as LeadStatus)
        ? lead.status
        : 'New') as LeadStatus;
      map[st].push(lead);
    });
    return map;
  }, [leads]);

  const handleMoveStatus = async (leadId: string, targetStatus: LeadStatus) => {
    const existing = leads.find((l) => l.id === leadId);
    if (!existing || existing.status === targetStatus) return;

    const prevLeads = leads;
    setLeads((cur) =>
      cur.map((l) => (l.id === leadId ? { ...l, status: targetStatus } : l))
    );

    try {
      const updated = await updateLead(leadId, { status: targetStatus });
      setLeads((cur) => cur.map((l) => (l.id === leadId ? updated : l)));
      refreshNewCounts();
      addToast({
        variant: 'success',
        title: `Moved to "${targetStatus}"`,
        description: existing.name || existing.email || undefined,
      });
    } catch (err) {
      setLeads(prevLeads);
      addToast({
        variant: 'error',
        title: 'Failed to move lead',
        description: err instanceof Error ? err.message : 'Supabase update failed.',
      });
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Kanban Pipeline
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Drag and drop lead cards across columns to update status in Supabase.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <select
            value={siteFilter}
            onChange={(e) => setSiteFilter(e.target.value)}
            aria-label="Filter Kanban by site"
            className="px-3 py-2 text-xs font-medium bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600"
          >
            <option value="">All Sites</option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={loadLeads}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 whitespace-nowrap"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Kanban Columns */}
      <div className="overflow-x-auto pb-4">
        <div className="grid grid-cols-6 gap-3.5 min-w-[1260px]">
          {LEAD_STATUSES.map((status) => {
            const colLeads = grouped[status];
            const isOver = dragOverStatus === status;

            return (
              <div
                key={status}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOverStatus(status);
                }}
                onDragLeave={() => {
                  if (dragOverStatus === status) setDragOverStatus(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const leadId = e.dataTransfer.getData('text/plain') || draggedLeadId;
                  setDragOverStatus(null);
                  setDraggedLeadId(null);
                  if (leadId) {
                    handleMoveStatus(leadId, status);
                  }
                }}
                className={`flex flex-col rounded-lg border transition-colors min-h-[540px] ${
                  isOver
                    ? 'bg-blue-50/70 dark:bg-blue-950/30 border-blue-400 dark:border-blue-600'
                    : 'bg-slate-100/70 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800'
                }`}
              >
                {/* Column Header */}
                <div className="px-3 py-2.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 bg-white dark:bg-slate-900 rounded-t-lg">
                  <span
                    className={`px-2 py-0.5 text-xs font-semibold border rounded ${getStatusBadgeClass(
                      status
                    )}`}
                  >
                    {status}
                  </span>
                  <span className="font-mono text-xs tabular-nums text-slate-500 dark:text-slate-400">
                    {colLeads.length}
                  </span>
                </div>

                {/* Cards */}
                <div className="p-2.5 space-y-2.5 flex-1">
                  {loading ? (
                    <div className="space-y-2">
                      <div className="h-24 bg-white dark:bg-slate-800 rounded-md animate-pulse" />
                      <div className="h-24 bg-white dark:bg-slate-800 rounded-md animate-pulse" />
                    </div>
                  ) : colLeads.length === 0 ? (
                    <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-8">
                      No leads
                    </p>
                  ) : (
                    colLeads.map((lead) => {
                      const site = sites.find((s) => s.id === lead.site_id);
                      const isHigh = lead.priority === 'high';
                      return (
                        <div
                          key={lead.id}
                          draggable
                          onDragStart={(e) => {
                            setDraggedLeadId(lead.id);
                            e.dataTransfer.setData('text/plain', lead.id);
                            e.dataTransfer.effectAllowed = 'move';
                          }}
                          onDragEnd={() => {
                            setDraggedLeadId(null);
                            setDragOverStatus(null);
                          }}
                          onClick={() => setSelectedLead(lead)}
                          className={`group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 rounded-md p-3 cursor-pointer shadow-xs transition-all space-y-2 ${
                            draggedLeadId === lead.id ? 'opacity-50' : ''
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <GripVertical className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 shrink-0" />
                              <span className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                                {lead.name || lead.email || 'Unnamed'}
                              </span>
                            </div>
                            {isHigh && (
                              <span className="px-1.5 py-0.5 text-[10px] font-bold bg-red-600 text-white rounded shrink-0">
                                HIGH
                              </span>
                            )}
                          </div>

                          {lead.subject && (
                            <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2">
                              {lead.subject}
                            </p>
                          )}

                          <div className="flex items-center justify-between gap-2 pt-1 text-[11px] text-slate-500 dark:text-slate-400">
                            <span className="inline-flex items-center gap-1.5 min-w-0 truncate">
                              {site && (
                                <span
                                  className="w-2 h-2 rounded-full shrink-0"
                                  style={{ backgroundColor: site.color || '#2563EB' }}
                                />
                              )}
                              <span className="truncate">
                                {lead.site_name || site?.name || formatChannelLabel(lead.channel)}
                              </span>
                            </span>
                            <span className="font-mono tabular-nums shrink-0">
                              {formatShortDate(lead.received_at)}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
