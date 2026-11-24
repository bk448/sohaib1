import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Filter,
  Layers,
  RefreshCw,
} from 'lucide-react';
import {
  bulkUpdateLeadStatus,
  fetchDistinctLeadDimensions,
  fetchLeadsForExport,
  fetchLeadsPage,
  updateLead,
  type Lead,
  type LeadFilterParams,
  type LeadStatus,
} from '../lib/data';
import {
  ALL_LEAD_FIELDS,
  DEFAULT_DASHBOARD_FIELDS,
  LEAD_CHANNELS,
  LEAD_PRIORITIES,
  LEAD_STATUSES,
  formatChannelLabel,
  formatDateTime,
  getPriorityBadgeClass,
  getStatusBadgeClass,
} from '../lib/utils';
import { useApp } from '../components/AppContext';
import { useToast } from '../components/ToastContext';

const PAGE_SIZE = 50;

export function LeadsPage() {
  const { siteId: routeSiteId } = useParams<{ siteId?: string }>();
  const [searchParams] = useSearchParams();
  const {
    sites,
    globalSearch,
    setGlobalSearch,
    selectedLead,
    setSelectedLead,
    realtimeTick,
    refreshNewCounts,
    setIsAddLeadOpen,
  } = useApp();
  const { addToast } = useToast();

  // Filter states
  const [filterSiteId, setFilterSiteId] = useState<string>(
    routeSiteId || searchParams.get('site') || ''
  );
  const [filterStatus, setFilterStatus] = useState<string>(searchParams.get('status') || '');
  const [filterPriority, setFilterPriority] = useState<string>(
    searchParams.get('priority') || ''
  );
  const [filterChannel, setFilterChannel] = useState<string>(searchParams.get('channel') || '');
  const [filterDivision, setFilterDivision] = useState<string>('');
  const [filterCountry, setFilterCountry] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [localSearch, setLocalSearch] = useState<string>(globalSearch);

  // Sync route siteId when navigating between sites
  useEffect(() => {
    setFilterSiteId(routeSiteId || searchParams.get('site') || '');
    setPage(1);
  }, [routeSiteId, searchParams]);

  // Sync globalSearch -> localSearch
  useEffect(() => {
    setLocalSearch(globalSearch);
    setPage(1);
  }, [globalSearch]);

  // Data state
  const [rows, setRows] = useState<Lead[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);
  const [dimensions, setDimensions] = useState<{ divisions: string[]; countries: string[] }>({
    divisions: [],
    countries: [],
  });

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkStatus, setBulkStatus] = useState<LeadStatus>('Contacted');
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [exporting, setExporting] = useState(false);

  const activeSite = useMemo(
    () => (filterSiteId ? sites.find((s) => s.id === filterSiteId) || null : null),
    [sites, filterSiteId]
  );

  // Dynamic columns from selected site's dashboard_fields (fallback to default)
  const visibleFields = useMemo(() => {
    const custom = activeSite?.dashboard_fields;
    if (Array.isArray(custom) && custom.length > 0) {
      return custom;
    }
    return DEFAULT_DASHBOARD_FIELDS;
  }, [activeSite]);

  const fieldLabels = useMemo(() => {
    const map: Record<string, string> = {};
    ALL_LEAD_FIELDS.forEach((f) => {
      map[f.key] = f.label;
    });
    return map;
  }, []);

  const currentFilters: LeadFilterParams = useMemo(
    () => ({
      siteId: filterSiteId || undefined,
      status: filterStatus || undefined,
      priority: filterPriority || undefined,
      channel: filterChannel || undefined,
      division: filterDivision || undefined,
      country: filterCountry || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      search: localSearch.trim() || undefined,
    }),
    [
      filterSiteId,
      filterStatus,
      filterPriority,
      filterChannel,
      filterDivision,
      filterCountry,
      dateFrom,
      dateTo,
      localSearch,
    ]
  );

  const loadDimensions = useCallback(async () => {
    try {
      const dims = await fetchDistinctLeadDimensions();
      setDimensions(dims);
    } catch {
      // ignore non-critical
    }
  }, []);

  const loadLeads = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchLeadsPage(currentFilters, page, PAGE_SIZE);
      setRows(result.rows);
      setTotalCount(result.totalCount);
      setSelectedIds([]);
    } catch (err) {
      addToast({
        variant: 'error',
        title: 'Failed to load leads',
        description: err instanceof Error ? err.message : 'Supabase query error.',
      });
    } finally {
      setLoading(false);
    }
  }, [currentFilters, page, addToast]);

  useEffect(() => {
    loadDimensions();
  }, [loadDimensions]);

  useEffect(() => {
    loadLeads();
  }, [loadLeads, realtimeTick]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const allOnPageSelected =
    rows.length > 0 && rows.every((r) => selectedIds.includes(r.id));

  const toggleSelectAll = () => {
    if (allOnPageSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(rows.map((r) => r.id));
    }
  };

  const toggleRowSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleInlineStatusChange = async (leadId: string, nextStatus: LeadStatus) => {
    const prevRows = rows;
    setRows((cur) => cur.map((r) => (r.id === leadId ? { ...r, status: nextStatus } : r)));
    try {
      const updated = await updateLead(leadId, { status: nextStatus });
      setRows((cur) => cur.map((r) => (r.id === leadId ? updated : r)));
      if (selectedLead?.id === leadId) setSelectedLead(updated);
      refreshNewCounts();
    } catch (err) {
      setRows(prevRows);
      addToast({
        variant: 'error',
        title: 'Status update failed',
        description: err instanceof Error ? err.message : 'Supabase error.',
      });
    }
  };

  const handleBulkStatusApply = async () => {
    if (selectedIds.length === 0) return;
    setBulkUpdating(true);
    try {
      await bulkUpdateLeadStatus(selectedIds, bulkStatus);
      addToast({
        variant: 'success',
        title: `Updated ${selectedIds.length} leads to "${bulkStatus}"`,
      });
      refreshNewCounts();
      await loadLeads();
    } catch (err) {
      addToast({
        variant: 'error',
        title: 'Bulk update failed',
        description: err instanceof Error ? err.message : 'Supabase error.',
      });
    } finally {
      setBulkUpdating(false);
    }
  };

  const handleExportCsv = async () => {
    setExporting(true);
    try {
      const exportRows = await fetchLeadsForExport(currentFilters);
      if (exportRows.length === 0) {
        addToast({ variant: 'info', title: 'No leads to export for current filter.' });
        return;
      }

      const headers = visibleFields;
      const escapeCell = (val: unknown) => {
        const s =
          typeof val === 'object' && val !== null ? JSON.stringify(val) : String(val ?? '');
        return `"${s.replace(/"/g, '""')}"`;
      };

      const csvLines = [
        headers.join(','),
        ...exportRows.map((row) =>
          headers.map((col) => escapeCell(row[col as keyof Lead])).join(',')
        ),
      ];

      const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `leads-${activeSite ? activeSite.name.toLowerCase().replace(/\s+/g, '-') : 'all'}-${new Date()
        .toISOString()
        .slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      addToast({
        variant: 'success',
        title: `Exported ${exportRows.length} leads to CSV`,
      });
    } catch (err) {
      addToast({
        variant: 'error',
        title: 'CSV Export failed',
        description: err instanceof Error ? err.message : 'Unable to export leads.',
      });
    } finally {
      setExporting(false);
    }
  };

  const clearFilters = () => {
    if (!routeSiteId) setFilterSiteId('');
    setFilterStatus('');
    setFilterPriority('');
    setFilterChannel('');
    setFilterDivision('');
    setFilterCountry('');
    setDateFrom('');
    setDateTo('');
    setLocalSearch('');
    setGlobalSearch('');
    setPage(1);
  };

  const renderCell = (lead: Lead, fieldKey: string) => {
    switch (fieldKey) {
      case 'name':
        return (
          <span className="font-semibold text-slate-900 dark:text-white">
            {lead.name || '—'}
          </span>
        );
      case 'email':
        return (
          <span className="text-slate-700 dark:text-slate-300">{lead.email || '—'}</span>
        );
      case 'phone':
        return (
          <span className="font-mono text-xs tabular-nums text-slate-600 dark:text-slate-400">
            {lead.phone || '—'}
          </span>
        );
      case 'priority':
        return (
          <span
            className={`inline-flex px-2 py-0.5 text-[11px] font-semibold border rounded ${getPriorityBadgeClass(
              lead.priority
            )}`}
          >
            {lead.priority === 'high' ? 'High' : 'Normal'}
          </span>
        );
      case 'status':
        return (
          <div onClick={(e) => e.stopPropagation()} className="relative inline-block">
            <select
              value={lead.status}
              onChange={(e) => handleInlineStatusChange(lead.id, e.target.value as LeadStatus)}
              aria-label={`Status for ${lead.name || lead.email || lead.id}`}
              className={`appearance-none text-xs font-medium border rounded pl-2.5 pr-6 py-1 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-600 ${getStatusBadgeClass(
                lead.status
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
            <ChevronDown className="w-3 h-3 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none opacity-70" />
          </div>
        );
      case 'channel':
        return <span>{formatChannelLabel(lead.channel)}</span>;
      case 'received_at':
      case 'updated_at':
        return (
          <span className="font-mono text-xs tabular-nums text-slate-600 dark:text-slate-400 whitespace-nowrap">
            {formatDateTime(lead[fieldKey])}
          </span>
        );
      case 'site_name': {
        const site = sites.find((s) => s.id === lead.site_id);
        return (
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
            {site && (
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: site.color || '#2563EB' }}
              />
            )}
            <span>{lead.site_name || site?.name || '—'}</span>
          </span>
        );
      }
      case 'message':
      case 'notes':
        return (
          <span className="block max-w-[240px] truncate text-slate-600 dark:text-slate-400">
            {(lead[fieldKey] as string) || '—'}
          </span>
        );
      default: {
        const val = lead[fieldKey as keyof Lead];
        return (
          <span className="block max-w-[200px] truncate">
            {val ? String(val) : '—'}
          </span>
        );
      }
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {activeSite && (
            <span
              className="w-3.5 h-3.5 rounded-full shrink-0 border border-black/10 dark:border-white/20"
              style={{ backgroundColor: activeSite.color || '#2563EB' }}
            />
          )}
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              {activeSite ? `${activeSite.name} Leads` : 'Leads'}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums mt-0.5">
              {totalCount} matching {totalCount === 1 ? 'record' : 'records'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {routeSiteId && (
            <div className="inline-flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
              <Link
                to={`/site/${routeSiteId}`}
                className="px-3 py-1.5 text-xs font-medium rounded-md text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white whitespace-nowrap"
              >
                Dashboard
              </Link>
              <span className="px-3 py-1.5 text-xs font-medium rounded-md bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm whitespace-nowrap">
                Leads Table
              </span>
            </div>
          )}

          <button
            type="button"
            onClick={loadLeads}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 whitespace-nowrap"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            disabled={exporting || totalCount === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{exporting ? 'Exporting...' : 'Export CSV'}</span>
          </button>
        </div>
      </div>

      {/* Filters Panel */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          <div>
            <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
              Search (name, email, subject, message)
            </label>
            <input
              type="text"
              value={localSearch}
              onChange={(e) => {
                setLocalSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Keyword..."
              className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
              Site
            </label>
            <select
              value={filterSiteId}
              onChange={(e) => {
                setFilterSiteId(e.target.value);
                setPage(1);
              }}
              className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100"
            >
              <option value="">All Sites</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
              Status
            </label>
            <select
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value);
                setPage(1);
              }}
              className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100"
            >
              <option value="">All Statuses</option>
              {LEAD_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
              Priority
            </label>
            <select
              value={filterPriority}
              onChange={(e) => {
                setFilterPriority(e.target.value);
                setPage(1);
              }}
              className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100"
            >
              <option value="">All Priorities</option>
              {LEAD_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
              Channel
            </label>
            <select
              value={filterChannel}
              onChange={(e) => {
                setFilterChannel(e.target.value);
                setPage(1);
              }}
              className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100"
            >
              <option value="">All Channels</option>
              {LEAD_CHANNELS.map((c) => (
                <option key={c} value={c}>
                  {formatChannelLabel(c)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
              Division
            </label>
            <select
              value={filterDivision}
              onChange={(e) => {
                setFilterDivision(e.target.value);
                setPage(1);
              }}
              className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100"
            >
              <option value="">All Divisions</option>
              {dimensions.divisions.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
              Country
            </label>
            <select
              value={filterCountry}
              onChange={(e) => {
                setFilterCountry(e.target.value);
                setPage(1);
              }}
              className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100"
            >
              <option value="">All Countries</option>
              {dimensions.countries.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
              From Date
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPage(1);
              }}
              className="w-full px-2.5 py-1.5 text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
              To Date
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPage(1);
              }}
              className="w-full px-2.5 py-1.5 text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100"
            />
          </div>

          <div className="flex items-end">
            <button
              type="button"
              onClick={clearFilters}
              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md transition-colors whitespace-nowrap"
            >
              <Filter className="w-3.5 h-3.5" />
              <span>Clear Filters</span>
            </button>
          </div>
        </div>
      </section>

      {/* Bulk Status Action Bar */}
      {selectedIds.length > 0 && (
        <div className="bg-slate-900 dark:bg-blue-950 text-white border border-slate-800 dark:border-blue-800 rounded-lg px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs font-medium font-mono tabular-nums">
            {selectedIds.length} {selectedIds.length === 1 ? 'lead' : 'leads'} selected
          </span>
          <div className="flex items-center gap-2">
            <select
              value={bulkStatus}
              onChange={(e) => setBulkStatus(e.target.value as LeadStatus)}
              aria-label="Bulk status"
              className="px-2.5 py-1.5 text-xs bg-slate-800 dark:bg-slate-900 text-white border border-slate-700 rounded"
            >
              {LEAD_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={bulkUpdating}
              onClick={handleBulkStatusApply}
              className="px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded disabled:opacity-50 whitespace-nowrap"
            >
              {bulkUpdating ? 'Updating...' : 'Apply Status'}
            </button>
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="px-2 py-1.5 text-xs text-slate-300 hover:text-white"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
        {loading ? (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="px-4 py-3.5 flex items-center gap-4 animate-pulse">
                <div className="w-4 h-4 bg-slate-200 dark:bg-slate-800 rounded" />
                <div className="h-4 w-32 bg-slate-200 dark:bg-slate-800 rounded" />
                <div className="h-4 w-44 bg-slate-100 dark:bg-slate-800 rounded" />
                <div className="h-4 w-28 bg-slate-100 dark:bg-slate-800 rounded flex-1" />
                <div className="h-6 w-20 bg-slate-200 dark:bg-slate-800 rounded" />
              </div>
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center max-w-md mx-auto">
            <Layers className="w-8 h-8 text-slate-400 mx-auto mb-3" />
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              No Leads Found
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              No leads match your current filter selection, or the leads table is empty.
            </p>
            <div className="mt-4 flex items-center justify-center gap-2.5">
              <button
                type="button"
                onClick={clearFilters}
                className="px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md hover:bg-slate-50 dark:hover:bg-slate-700"
              >
                Clear Filters
              </button>
              <button
                type="button"
                onClick={() => setIsAddLeadOpen(true)}
                className="px-3.5 py-2 text-xs font-medium text-white bg-slate-900 dark:bg-blue-600 rounded-md hover:bg-slate-800 dark:hover:bg-blue-500"
              >
                Add Lead
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-500 dark:text-slate-400">
                  <th className="py-2.5 px-3.5 w-10">
                    <input
                      type="checkbox"
                      checked={allOnPageSelected}
                      onChange={toggleSelectAll}
                      aria-label="Select all rows on page"
                      className="rounded border-slate-300 dark:border-slate-600"
                    />
                  </th>
                  {visibleFields.map((col) => (
                    <th key={col} className="py-2.5 px-3.5 whitespace-nowrap">
                      {fieldLabels[col] || col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                {rows.map((lead) => {
                  const isChecked = selectedIds.includes(lead.id);
                  const isActive = selectedLead?.id === lead.id;
                  return (
                    <tr
                      key={lead.id}
                      onClick={() => setSelectedLead(lead)}
                      className={`cursor-pointer transition-colors ${
                        isActive
                          ? 'bg-blue-50/70 dark:bg-blue-950/40'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                      }`}
                    >
                      <td
                        className="py-3 px-3.5 align-middle"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleRowSelect(lead.id)}
                          aria-label={`Select ${lead.name || lead.email || lead.id}`}
                          className="rounded border-slate-300 dark:border-slate-600"
                        />
                      </td>
                      {visibleFields.map((col) => (
                        <td key={col} className="py-3 px-3.5 align-middle">
                          {renderCell(lead, col)}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4 text-xs">
          <span className="text-slate-500 dark:text-slate-400 font-mono tabular-nums">
            Page {page} of {totalPages} · Showing {rows.length} of {totalCount}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Prev</span>
            </button>
            <button
              type="button"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
