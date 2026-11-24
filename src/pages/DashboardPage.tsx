import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { fetchDashboardLeads, type Lead } from '../lib/data';
import { LEAD_STATUSES, formatChannelLabel } from '../lib/utils';
import { useApp } from '../components/AppContext';
import { useToast } from '../components/ToastContext';

export function DashboardPage() {
  const { siteId } = useParams<{ siteId?: string }>();
  const { sites, realtimeTick } = useApp();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [hoveredDayIdx, setHoveredDayIdx] = useState<number | null>(null);

  const selectedSite = useMemo(
    () => (siteId ? sites.find((s) => s.id === siteId) || null : null),
    [sites, siteId]
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchDashboardLeads(siteId);
      setLeads(data);
    } catch (err) {
      addToast({
        variant: 'error',
        title: 'Failed to load dashboard metrics',
        description: err instanceof Error ? err.message : 'Supabase query error.',
      });
    } finally {
      setLoading(false);
    }
  }, [siteId, addToast]);

  useEffect(() => {
    loadData();
  }, [loadData, realtimeTick]);

  const metrics = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const weekAgo = now.getTime() - 7 * 86400000;
    const monthAgo = now.getTime() - 30 * 86400000;

    const statusCounts: Record<string, number> = {};
    LEAD_STATUSES.forEach((s) => {
      statusCounts[s] = 0;
    });

    let highPriorityOpen = 0;
    let todayCount = 0;
    let weekCount = 0;
    let monthCount = 0;

    const channelMap = new Map<string, number>();
    const serviceMap = new Map<string, number>();
    const countryMap = new Map<string, number>();

    // Prepare 30-day buckets
    const dayBuckets: Array<{ key: string; label: string; count: number }> = [];
    const dayIndexMap = new Map<string, number>();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
        d.getDate()
      ).padStart(2, '0')}`;
      const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      dayIndexMap.set(key, dayBuckets.length);
      dayBuckets.push({ key, label, count: 0 });
    }

    leads.forEach((lead) => {
      const st = lead.status || 'New';
      statusCounts[st] = (statusCounts[st] || 0) + 1;

      if (lead.priority === 'high' && st !== 'Won' && st !== 'Closed Lost') {
        highPriorityOpen += 1;
      }

      const ts = new Date(lead.received_at).getTime();
      if (!Number.isNaN(ts)) {
        if (ts >= startOfToday) todayCount += 1;
        if (ts >= weekAgo) weekCount += 1;
        if (ts >= monthAgo) monthCount += 1;

        const d = new Date(ts);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
          d.getDate()
        ).padStart(2, '0')}`;
        const idx = dayIndexMap.get(key);
        if (idx !== undefined) {
          dayBuckets[idx].count += 1;
        }
      }

      const ch = lead.channel || 'unknown';
      channelMap.set(ch, (channelMap.get(ch) || 0) + 1);

      const srv = lead.primary_service?.trim() || 'Unspecified';
      serviceMap.set(srv, (serviceMap.get(srv) || 0) + 1);

      if (lead.country && lead.country.trim()) {
        const c = lead.country.trim();
        countryMap.set(c, (countryMap.get(c) || 0) + 1);
      }
    });

    const channels = Array.from(channelMap.entries())
      .map(([name, count]) => ({ name, label: formatChannelLabel(name), count }))
      .sort((a, b) => b.count - a.count);

    const services = Array.from(serviceMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    const countries = Array.from(countryMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    return {
      total: leads.length,
      statusCounts,
      highPriorityOpen,
      todayCount,
      weekCount,
      monthCount,
      dayBuckets,
      channels,
      services,
      countries,
    };
  }, [leads]);

  // SVG Line Chart geometry
  const chartW = 760;
  const chartH = 210;
  const padL = 34;
  const padR = 14;
  const padT = 16;
  const padB = 28;
  const plotW = chartW - padL - padR;
  const plotH = chartH - padT - padB;
  const maxDayCount = Math.max(1, ...metrics.dayBuckets.map((d) => d.count));

  const points = metrics.dayBuckets.map((bucket, idx) => {
    const x = padL + (idx / Math.max(1, metrics.dayBuckets.length - 1)) * plotW;
    const y = padT + plotH - (bucket.count / maxDayCount) * plotH;
    return { x, y, ...bucket };
  });

  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ');
  const areaPath =
    points.length > 0
      ? `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${(padT + plotH).toFixed(
          1
        )} L ${points[0].x.toFixed(1)} ${(padT + plotH).toFixed(1)} Z`
      : '';

  return (
    <div className="space-y-6">
      {/* Header & View Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          {selectedSite && (
            <span
              className="w-3.5 h-3.5 rounded-full shrink-0 border border-black/10 dark:border-white/20"
              style={{ backgroundColor: selectedSite.color || '#2563EB' }}
            />
          )}
          <div className="min-w-0">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white truncate">
              {selectedSite ? `${selectedSite.name} Dashboard` : 'All Sites Overview'}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {selectedSite
                ? `Metrics scoped to ${selectedSite.name}`
                : 'Aggregated lead pipeline and channel metrics across all sites'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="inline-flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
            <span className="px-3 py-1.5 text-xs font-medium rounded-md bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm whitespace-nowrap">
              Dashboard
            </span>
            <Link
              to={siteId ? `/site/${siteId}/leads` : '/leads'}
              className="px-3 py-1.5 text-xs font-medium rounded-md text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white whitespace-nowrap"
            >
              Leads Table
            </Link>
          </div>

          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 whitespace-nowrap"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Period & High-Priority Summary Cards */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <SummaryCard
          label="High-Priority Open"
          value={metrics.highPriorityOpen}
          accent="text-red-700 dark:text-red-400"
          onClick={() =>
            navigate(
              siteId ? `/site/${siteId}/leads?priority=high` : '/leads?priority=high'
            )
          }
        />
        <SummaryCard label="Leads Today" value={metrics.todayCount} />
        <SummaryCard label="Leads This Week (7d)" value={metrics.weekCount} />
        <SummaryCard label="Leads This Month (30d)" value={metrics.monthCount} />
      </section>

      {/* Stat Cards per Status */}
      <section aria-label="Status Breakdown">
        <h2 className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2.5">
          Pipeline by Status ({metrics.total} total)
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {LEAD_STATUSES.map((status) => (
            <button
              key={status}
              type="button"
              onClick={() =>
                navigate(
                  siteId
                    ? `/site/${siteId}/leads?status=${encodeURIComponent(status)}`
                    : `/leads?status=${encodeURIComponent(status)}`
                )
              }
              className="text-left bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 rounded-lg p-3.5 transition-colors"
            >
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate">
                {status}
              </p>
              <p className="mt-1.5 text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                {loading ? '—' : metrics.statusCounts[status] ?? 0}
              </p>
            </button>
          ))}
        </div>
      </section>

      {/* 30-Day Line Chart */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Leads per Day (Last 30 Days)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Daily inbound volume across {selectedSite ? selectedSite.name : 'all sites'}
            </p>
          </div>
          {hoveredDayIdx !== null && points[hoveredDayIdx] && (
            <div className="text-xs font-mono tabular-nums px-2.5 py-1 bg-slate-100 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700">
              {points[hoveredDayIdx].label}:{' '}
              <span className="font-semibold">{points[hoveredDayIdx].count}</span> leads
            </div>
          )}
        </div>

        <div className="w-full overflow-x-auto">
          <svg
            viewBox={`0 0 ${chartW} ${chartH}`}
            className="w-full min-w-[540px] h-52 select-none"
            role="img"
            aria-label="Line chart of leads per day over the last 30 days"
          >
            <defs>
              <linearGradient id="leadAreaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2563EB" stopOpacity="0.22" />
                <stop offset="100%" stopColor="#2563EB" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Horizontal grid lines */}
            {[0, 0.5, 1].map((ratio) => {
              const y = padT + plotH - ratio * plotH;
              const val = Math.round(ratio * maxDayCount);
              return (
                <g key={ratio}>
                  <line
                    x1={padL}
                    x2={chartW - padR}
                    y1={y}
                    y2={y}
                    stroke="currentColor"
                    className="text-slate-200 dark:text-slate-800"
                    strokeDasharray="3 3"
                  />
                  <text
                    x={padL - 8}
                    y={y + 4}
                    textAnchor="end"
                    className="fill-slate-400 text-[10px] font-mono"
                  >
                    {val}
                  </text>
                </g>
              );
            })}

            {areaPath && <path d={areaPath} fill="url(#leadAreaGrad)" />}
            {linePath && (
              <path
                d={linePath}
                fill="none"
                stroke="#2563EB"
                strokeWidth="2.25"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* Data points & x-axis ticks */}
            {points.map((pt, idx) => {
              const showTick = idx === 0 || idx === 7 || idx === 14 || idx === 21 || idx === 29;
              const isHovered = hoveredDayIdx === idx;
              return (
                <g
                  key={pt.key}
                  onMouseEnter={() => setHoveredDayIdx(idx)}
                  onMouseLeave={() => setHoveredDayIdx(null)}
                  className="cursor-pointer"
                >
                  <rect
                    x={pt.x - plotW / 60}
                    y={padT}
                    width={plotW / 30}
                    height={plotH + padB}
                    fill="transparent"
                  />
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={isHovered ? 4.5 : pt.count > 0 ? 2.5 : 0}
                    className="fill-blue-600 dark:fill-blue-400"
                  />
                  {showTick && (
                    <text
                      x={pt.x}
                      y={chartH - 6}
                      textAnchor="middle"
                      className="fill-slate-400 text-[10px] font-mono"
                    >
                      {pt.label}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>
      </section>

      {/* Bottom 3-Column Breakdown: Channel, Primary Service, Top Countries */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <BarBreakdownCard
          title="By Channel"
          items={metrics.channels.map((c) => ({ label: c.label, count: c.count }))}
          emptyText="No channel data yet."
          barColor="bg-blue-600 dark:bg-blue-500"
        />

        <BarBreakdownCard
          title="By Primary Service"
          items={metrics.services.map((s) => ({ label: s.name, count: s.count }))}
          emptyText="No primary service tags yet."
          barColor="bg-slate-800 dark:bg-indigo-500"
        />

        <BarBreakdownCard
          title="Top Countries"
          items={metrics.countries.map((c) => ({ label: c.name, count: c.count }))}
          emptyText="No country data yet."
          barColor="bg-emerald-600 dark:bg-emerald-500"
        />
      </section>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  accent,
  onClick,
}: {
  label: string;
  value: number;
  accent?: string;
  onClick?: () => void;
}) {
  const Wrapper = onClick ? 'button' : 'div';
  return (
    <Wrapper
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`text-left bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 ${
        onClick
          ? 'hover:border-slate-300 dark:hover:border-slate-700 cursor-pointer transition-colors'
          : ''
      }`}
    >
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
      <p
        className={`mt-2 text-2xl font-bold font-mono tabular-nums ${
          accent || 'text-slate-900 dark:text-white'
        }`}
      >
        {value}
      </p>
    </Wrapper>
  );
}

function BarBreakdownCard({
  title,
  items,
  emptyText,
  barColor,
}: {
  title: string;
  items: Array<{ label: string; count: number }>;
  emptyText: string;
  barColor: string;
}) {
  const max = Math.max(1, ...items.map((i) => i.count));
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5">
      <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">{title}</h2>
      {items.length === 0 ? (
        <p className="text-xs text-slate-400">{emptyText}</p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.label} className="space-y-1">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-medium text-slate-700 dark:text-slate-300 truncate">
                  {item.label}
                </span>
                <span className="font-mono tabular-nums text-slate-500 dark:text-slate-400 shrink-0">
                  {item.count}
                </span>
              </div>
              <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${barColor}`}
                  style={{ width: `${Math.max(4, (item.count / max) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
