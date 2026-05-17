"use client";

import { useState, useEffect, useCallback } from "react";
import Card from "@/shared/components/Card";
import Button from "@/shared/components/Button";
import Drawer from "@/shared/components/Drawer";
import Pagination from "@/shared/components/Pagination";
import { cn } from "@/shared/utils/cn";
import { AI_PROVIDERS, getProviderByAlias } from "@/shared/constants/providers";
import CollapsibleSection from "./CollapsibleSection";
import ComboPathVisualizer from "./ComboPathVisualizer";

let providerNameCacheInternal = null;

async function fetchProviderNames() {
  if (providerNameCacheInternal) return providerNameCacheInternal;

  try {
    const nodesRes = await fetch("/api/provider-nodes");
    const nodesData = await nodesRes.json();
    const nodes = nodesData.nodes || [];
    const providerNodesCache = {};

    for (const node of nodes) {
      providerNodesCache[node.id] = node.name;
    }

    providerNameCacheInternal = {
      ...AI_PROVIDERS,
      ...providerNodesCache
    };

    return providerNameCacheInternal;
  } catch (error) {
    console.error("Failed to fetch provider names:", error);
    return AI_PROVIDERS;
  }
}

function getProviderName(providerId, cache) {
  if (!providerId) return providerId;
  const currentCache = cache || providerNameCacheInternal || AI_PROVIDERS;
  const cached = currentCache[providerId];

  if (typeof cached === 'string') return cached;
  if (cached?.name) return cached.name;

  const providerConfig = getProviderByAlias(providerId) || AI_PROVIDERS[providerId];
  return providerConfig?.name || providerId;
}

function getInputTokens(tokens) {
  const prompt = tokens?.prompt_tokens || tokens?.input_tokens || 0;
  const cache = tokens?.cached_tokens || tokens?.cache_read_input_tokens || 0;
  return prompt < cache ? cache : prompt;
}

export default function RequestDetailsTab() {
  const [details, setDetails] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 20,
    totalItems: 0,
    totalPages: 0
  });
  const [loading, setLoading] = useState(false);
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [providers, setProviders] = useState([]);
  const [providerNameCache, setProviderNameCache] = useState(null);
  const [filters, setFilters] = useState({
    provider: "",
    startDate: "",
    endDate: ""
  });

  const fetchProviders = useCallback(async () => {
    try {
      const res = await fetch("/api/usage/providers");
      const data = await res.json();
      setProviders(data.providers || []);

      const cache = await fetchProviderNames();
      setProviderNameCache(cache.providerNameCache);
    } catch (error) {
      console.error("Failed to fetch providers:", error);
    }
  }, []);

  const fetchDetails = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        pageSize: pagination.pageSize.toString()
      });
      if (filters.provider) params.append("provider", filters.provider);
      if (filters.startDate) params.append("startDate", filters.startDate);
      if (filters.endDate) params.append("endDate", filters.endDate);

      const res = await fetch(`/api/usage/request-details?${params}`);
      const data = await res.json();

      setDetails(data.details || []);
      setPagination(prev => ({ ...prev, ...data.pagination }));
    } catch (error) {
      console.error("Failed to fetch request details:", error);
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.pageSize, filters]);

  useEffect(() => {
    fetchProviders();
  }, []); // Run only once on mount

  useEffect(() => {
    fetchDetails();
  }, [fetchDetails]); // Relies on useCallback to prevent re-renders

  const handleViewDetail = (detail) => {
    setSelectedDetail(detail);
    setIsDrawerOpen(true);
  };

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <Card padding="md">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex min-w-0 flex-col gap-2">
            <label htmlFor="provider-filter" className="text-sm font-medium text-text-main">Provider</label>
            <select
              id="provider-filter"
              value={filters.provider}
              onChange={(e) => setFilters({ ...filters, provider: e.target.value })}
              className={cn(
                "h-9 px-3 rounded-lg border border-black/10 dark:border-white/10 bg-surface",
                "text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-primary/20",
                "w-full min-w-0 cursor-pointer"
              )}
              style={{ colorScheme: 'auto' }}
            >
              <option value="">All Providers</option>
              {providers.map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {provider.name}
                </option>
              ))}
            </select>
          </div>
          
          <div className="flex min-w-0 flex-col gap-2">
            <label htmlFor="start-date-filter" className="text-sm font-medium text-text-main">Start Date</label>
            <input
              id="start-date-filter"
              type="datetime-local"
              value={filters.startDate}
              onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
              className={cn(
                "h-9 px-3 rounded-lg border border-black/10 dark:border-white/10 bg-surface",
                "w-full min-w-0 text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-primary/20"
              )}
            />
          </div>

          <div className="flex min-w-0 flex-col gap-2">
            <label htmlFor="end-date-filter" className="text-sm font-medium text-text-main">End Date</label>
            <input
              id="end-date-filter"
              type="datetime-local"
              value={filters.endDate}
              onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
              className={cn(
                "h-9 px-3 rounded-lg border border-black/10 dark:border-white/10 bg-surface",
                "w-full min-w-0 text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-primary/20"
              )}
            />
          </div>
          
          <div className="flex min-w-0 flex-col gap-2 sm:col-span-2 lg:col-span-1">
            <span className="hidden text-sm font-medium text-text-main opacity-0 lg:block" aria-hidden="true">Clear</span>
            <Button 
              variant="ghost" 
              onClick={handleClearFilters}
              disabled={!filters.provider && !filters.startDate && !filters.endDate}
              className="w-full"
            >
              Clear Filters
            </Button>
          </div>
        </div>
      </Card>

      <Card padding="none">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px]">
            <thead>
              <tr className="border-b border-black/5 dark:border-white/5">
                <th className="text-left p-4 text-sm font-semibold text-text-main">Timestamp</th>
                <th className="text-left p-4 text-sm font-semibold text-text-main">Model</th>
                <th className="text-left p-4 text-sm font-semibold text-text-main">Provider</th>
                <th className="text-right p-4 text-sm font-semibold text-text-main">Input Tokens</th>
                <th className="text-right p-4 text-sm font-semibold text-text-main">Output Tokens</th>
                <th className="text-left p-4 text-sm font-semibold text-text-main">Latency</th>
                <th className="text-left p-4 text-sm font-semibold text-text-main">Strategy / Path</th>
                <th className="text-center p-4 text-sm font-semibold text-text-main">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8" className="p-8 text-center text-text-muted">
                    <div className="flex items-center justify-center gap-2">
                      <span className="material-symbols-outlined animate-spin text-[20px]">progress_activity</span>
                      Loading...
                    </div>
                  </td>
                </tr>
              ) : details.length === 0 ? (
                <tr>
                  <td colSpan="8" className="p-8 text-center text-text-muted">
                    No request details found
                  </td>
                </tr>
              ) : (
                details.map((detail, index) => (
                  <tr
                    key={`${detail.id}-${index}`}
                    className="border-b border-black/5 dark:border-white/5 last:border-b-0 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="whitespace-nowrap p-4 text-sm text-text-main">
                      {new Date(detail.timestamp).toLocaleString()}
                    </td>
                    <td className="max-w-[260px] truncate p-4 font-mono text-sm text-text-main">
                      {detail.model}
                    </td>
                    <td className="max-w-[180px] truncate p-4 text-sm text-text-main">
                       <span className="font-medium">
                         {getProviderName(detail.provider, providerNameCache)}
                       </span>
                     </td>
                    <td className="p-4 text-sm text-text-main text-right font-mono">
                      {getInputTokens(detail.tokens).toLocaleString()}
                    </td>
                    <td className="p-4 text-sm text-text-main text-right font-mono">
                      {detail.tokens?.completion_tokens?.toLocaleString() || 0}
                    </td>
                    <td className="p-4 text-sm text-text-muted">
                      <div className="flex flex-col gap-0.5">
                        <div>TTFT: <span className="font-mono">{detail.latency?.ttft || 0}ms</span></div>
                        <div>Total: <span className="font-mono">{detail.latency?.total || 0}ms</span></div>
                      </div>
                    </td>
                    <td className="p-4 text-sm text-text-main">
                      {detail.comboPath && <ComboPathVisualizer path={detail.comboPath} />}
                    </td>
                    <td className="p-4 text-center">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewDetail(detail)}
                      >
                        Detail
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!loading && details.length > 0 && (
          <div className="border-t border-black/5 dark:border-white/5">
            <Pagination
              currentPage={pagination.page}
              pageSize={pagination.pageSize}
              totalItems={pagination.totalItems}
              onPageChange={handlePageChange}
              onPageSizeChange={handlePageSizeChange}
            />
          </div>
        )}
      </Card>

      <Drawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        title="Request Details"
        width="lg"
      >
        {selectedDetail && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-text-muted">Status</span>
                <span className={`font-semibold ${selectedDetail.status === 'success' ? 'text-green-500' : 'text-red-500'}`}>
                  {selectedDetail.status}
                </span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-text-muted">Provider</span>
                <span>{getProviderName(selectedDetail.provider, providerNameCache)}</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-text-muted">Total Latency</span>
                <span>{selectedDetail.latency?.total || 0} ms</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-text-muted">Tokens</span>
                <span>{`In: ${getInputTokens(selectedDetail.tokens)} / Out: ${selectedDetail.tokens?.completion_tokens?.toLocaleString() || 0}`}</span>
              </div>
            </div>

            {selectedDetail.comboPath && selectedDetail.comboPath.length > 0 && (
              <div className="flex flex-col gap-2">
                <span className="text-xs text-text-muted font-semibold">Execution Path</span>
                <div className="p-3 rounded-lg bg-black/5 dark:bg-white/5">
                  <ComboPathVisualizer path={selectedDetail.comboPath} />
                </div>
              </div>
            )}

            <div className="flex flex-col gap-3">
              <CollapsibleSection title="Request Body" icon="input">
                <pre className="text-xs bg-black/5 dark:bg-white/5 sm:p-4 p-2 rounded-lg overflow-x-auto">
                  {JSON.stringify(selectedDetail.request, null, 2)}
                </pre>
              </CollapsibleSection>
              <CollapsibleSection title="Provider Request Body" icon="send">
                <pre className="text-xs bg-black/5 dark:bg-white/5 sm:p-4 p-2 rounded-lg overflow-x-auto">
                  {JSON.stringify(selectedDetail.providerRequest, null, 2)}
                </pre>
              </CollapsibleSection>
              <CollapsibleSection title="Provider Response Body" icon="output">
                <pre className="text-xs bg-black/5 dark:bg-white/5 sm:p-4 p-2 rounded-lg overflow-x-auto">
                  {JSON.stringify(selectedDetail.providerResponse || selectedDetail.response, null, 2)}
                </pre>
              </CollapsibleSection>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}
