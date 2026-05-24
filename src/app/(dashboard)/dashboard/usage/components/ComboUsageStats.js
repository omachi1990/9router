"use client";

import { useEffect, useState } from "react";
import Card from "@/shared/components/Card";

export default function ComboUsageStats() {
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/usage/combo-stats")
      .then((res) => res.json())
      .then((data) => {
        setStats(data.comboStats || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <Card padding="md">Loading Stats...</Card>;

  return (
    <Card padding="md">
      <h3 className="text-sm font-semibold text-text-main mb-4">Recent Usage</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-black/5 dark:border-white/5">
              <th className="text-left p-2">Combo</th>
              <th className="text-left p-2">Model</th>
              <th className="text-left p-2">Provider</th>
              <th className="text-left p-2">Time</th>
              <th className="text-right p-2">Tokens</th>
            </tr>
          </thead>
          <tbody>
            {stats.map((stat, i) => (
              <tr key={i} className="border-b border-black/5 dark:border-white/5 last:border-0 hover:bg-black/[0.02] dark:hover:bg-white/[0.02]">
                <td className="p-2 font-mono truncate">{stat.comboName}</td>
                <td className="p-2 font-mono truncate">{stat.modelId}</td>
                <td className="p-2 truncate">{stat.provider}</td>
                <td className="p-2 truncate">{new Date(stat.timestamp).toLocaleTimeString()}</td>
                <td className="p-2 text-right">{stat.tokens?.toLocaleString() || 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
