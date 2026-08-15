"use client";

import { useState, useEffect, useCallback } from "react";
import PropTypes from "prop-types";

export default function ProviderQuotaSummary({ connections }) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);

  const eligibleConnections = connections.filter(
    (c) => c.isActive !== false && (c.authType === "oauth" || c.id)
  );

  const fetchAllQuotas = useCallback(async () => {
    if (eligibleConnections.length === 0) {
      setSummary(null);
      return;
    }

    setLoading(true);
    try {
      const results = await Promise.allSettled(
        eligibleConnections.map(async (conn) => {
          const res = await fetch(`/api/usage/${conn.id}`);
          if (!res.ok) return null;
          const data = await res.json();
          return { connectionId: conn.id, ...data };
        })
      );

      const successful = results
        .filter((r) => r.status === "fulfilled" && r.value?.quotas)
        .map((r) => r.value);

      if (successful.length === 0) {
        setSummary({ ready: true, quotaGroups: {} });
        setLoading(false);
        return;
      }

      const quotaGroups = {};

      successful.forEach((result) => {
        const quotas = result.quotas || {};
        Object.entries(quotas).forEach(([name, q]) => {
          if (!quotaGroups[name]) {
            quotaGroups[name] = {
              displayName: q.displayName || name,
              totalUsed: 0,
              total: 0,
              unit: q.unit || "",
              resetAt: q.resetAt || null,
              accountCount: 0,
            };
          }
          quotaGroups[name].totalUsed += q.used || 0;
          quotaGroups[name].total += q.total || 0;
          quotaGroups[name].accountCount += 1;
        });
      });

      Object.values(quotaGroups).forEach((g) => {
        g.remaining = g.total - g.totalUsed;
        g.remainingPct = g.total > 0 ? Math.max(0, Math.min(100, ((g.total - g.totalUsed) / g.total) * 100)) : 100;
      });

      setSummary({ ready: true, quotaGroups });
    } catch {
      setSummary({ ready: true, quotaGroups: {} });
    } finally {
      setLoading(false);
    }
  }, [eligibleConnections]);

  useEffect(() => {
    fetchAllQuotas();
  }, [fetchAllQuotas]);

  if (eligibleConnections.length === 0) return null;

  const groups = summary?.quotaGroups ? Object.values(summary.quotaGroups) : [];
  if (groups.length === 0 && !loading) return null;

  return (
    <div className="mt-3 rounded-lg border border-black/[0.04] bg-black/[0.01] dark:border-white/[0.04] dark:bg-white/[0.01] p-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="material-symbols-outlined text-[14px] text-text-muted">donut_large</span>
        <span className="text-xs font-medium text-text-main">
          Tổng quota ({eligibleConnections.length} tài khoản)
        </span>
        {loading && (
          <span className="material-symbols-outlined text-[12px] animate-spin text-text-muted">sync</span>
        )}
      </div>

      <div className="flex flex-col gap-2">
        {groups.map((g) => {
          const pct = g.total > 0 ? Math.min(100, Math.max(0, (g.totalUsed / g.total) * 100)) : 0;
          const remainPct = 100 - pct;
          const isLow = remainPct < 20;
          const isMedium = remainPct >= 20 && remainPct < 50;
          const barColor = isLow ? "bg-red-500" : isMedium ? "bg-yellow-500" : "bg-primary";

          let remainTimeText = "";
          if (g.resetAt) {
            const resetDate = new Date(g.resetAt);
            const now = new Date();
            const diffMs = resetDate - now;
            const diffHours = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60)));
            const diffDays = Math.floor(diffHours / 24);
            const remainHours = diffHours % 24;
            if (diffMs <= 0) {
              remainTimeText = "Sẵn sàng";
            } else if (diffDays > 0) {
              remainTimeText = `còn ${diffDays}ngày ${remainHours}h`;
            } else {
              remainTimeText = `còn ${diffHours}h`;
            }
          }

          return (
            <div key={g.displayName} className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-text-muted truncate" title={g.displayName}>
                  {g.displayName}
                </span>
                <span className="text-[10px] text-text-muted shrink-0 ml-2">
                  {g.accountCount} TK | {remainPct.toFixed(1)}%
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2 w-full rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${barColor} transition-all`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-[10px] text-text-muted shrink-0 min-w-[90px] text-right">
                  {g.totalUsed}/{g.total}{g.unit}
                </span>
              </div>
              {remainTimeText && (
                <div className="flex justify-end">
                  <span className={`text-[10px] ${remainTimeText === "Sẵn sàng" ? "text-green-500" : "text-text-muted"}`}>
                    {remainTimeText}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

ProviderQuotaSummary.propTypes = {
  connections: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string,
    isActive: PropTypes.bool,
    authType: PropTypes.string,
  })).isRequired,
};
