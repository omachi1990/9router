"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { UPDATER_CONFIG } from "@/shared/constants/config";
import { readPresets, upsertPreset, deletePreset, subscribePresets, stripSlash } from "./cliEndpointPresets";

const CUSTOM_VALUE = "__custom__";
const SAVE_VALUE = "__save__";

const ensureV1 = (url) => {
  const trimmed = (url || "").replace(/\/+$/, "");
  if (!trimmed) return "";
  return /\/v1$/.test(trimmed) ? trimmed : `${trimmed}/v1`;
};

const buildOptions = ({ requiresExternalUrl, tunnelEnabled, tunnelPublicUrl, tailscaleEnabled, tailscaleUrl, cloudEnabled, cloudUrl, savedPresets, withV1 }) => {
  const opts = [];
  const wrap = (url) => (withV1 ? ensureV1(url) : (url || "").replace(/\/+$/, ""));
  if (!requiresExternalUrl) {
    const localUrl = wrap(`http://127.0.0.1:${UPDATER_CONFIG.appPort}`);
    opts.push({ value: "local", label: localUrl, url: localUrl });
  }
  if (tunnelEnabled && tunnelPublicUrl) {
    const u = wrap(tunnelPublicUrl);
    opts.push({ value: "tunnel", label: u, url: u });
  }
  if (tailscaleEnabled && tailscaleUrl) {
    const u = wrap(tailscaleUrl);
    opts.push({ value: "tailscale", label: u, url: u });
  }
  if (cloudEnabled && cloudUrl) {
    const u = wrap(cloudUrl);
    opts.push({ value: "cloud", label: u, url: u });
  }
  savedPresets.forEach((p) => {
    opts.push({ value: `saved:${p.name}`, label: p.baseUrl, url: p.baseUrl, saved: true });
  });
  opts.push({ value: CUSTOM_VALUE, label: "Custom URL...", url: "" });
  return opts;
};

export default function BaseUrlSelect({
  value,
  onChange,
  requiresExternalUrl = false,
  tunnelEnabled = false,
  tunnelPublicUrl = "",
  tailscaleEnabled = false,
  tailscaleUrl = "",
  cloudEnabled = false,
  cloudUrl = "",
  withV1 = true,
  currentUrl = "",
}) {
  const [savedPresets, setSavedPresets] = useState([]);
  const [presetsLoaded, setPresetsLoaded] = useState(false);
  const [mode, setMode] = useState("");
  const [customInput, setCustomInput] = useState("");
  const initializedRef = useRef(false);
  const customInputRef = useRef("");

  useEffect(() => {
    const sync = () => {
      const presets = readPresets();
      setSavedPresets(presets);
      // A preset saved elsewhere (e.g. on Apply) takes over the custom slot
      setMode((prev) => {
        if (prev !== CUSTOM_VALUE) return prev;
        const typed = stripSlash(customInputRef.current);
        if (!typed) return prev;
        const match = presets.find((p) => {
          const saved = stripSlash(p.baseUrl);
          return saved === typed || saved === ensureV1(typed);
        });
        return match ? `saved:${match.name}` : prev;
      });
    };
    sync();
    setPresetsLoaded(true);
    return subscribePresets(sync);
  }, []);

  const options = useMemo(
    () => buildOptions({ requiresExternalUrl, tunnelEnabled, tunnelPublicUrl, tailscaleEnabled, tailscaleUrl, cloudEnabled, cloudUrl, savedPresets, withV1 }),
    [requiresExternalUrl, tunnelEnabled, tunnelPublicUrl, tailscaleEnabled, tailscaleUrl, cloudEnabled, cloudUrl, savedPresets, withV1]
  );

  // Sync mode & customInput from value/currentUrl (used both on init and on value change)
  const syncFromValue = (val, opts) => {
    if (!val) return;
    const normalizedVal = stripSlash(val);
    const savedMatch = opts.find((o) => o.saved && stripSlash(o.url) === normalizedVal);
    const match = opts.find((o) => stripSlash(o.url) === normalizedVal);
    const target = savedMatch || match;
    
    if (target) {
      setMode(target.value);
      setCustomInput("");
    } else {
      setMode(CUSTOM_VALUE);
      setCustomInput(val);
    }
  };

  // Initialize from value or currentUrl so saved custom endpoints are preserved
  useEffect(() => {
    if (initializedRef.current) return;
    if (!presetsLoaded || options.length === 0) return;
    initializedRef.current = true;
    
    const initVal = value || currentUrl;
    if (initVal) {
      syncFromValue(initVal, options);
    } else {
      const first = options.find((o) => o.value !== CUSTOM_VALUE);
      if (first) {
        setMode(first.value);
        onChange(first.url);
      } else {
        setMode(CUSTOM_VALUE);
      }
    }
  }, [presetsLoaded, options, onChange, value, currentUrl]);

  // Sync when value/currentUrl changes after init (e.g. status loaded from server)
  useEffect(() => {
    if (!initializedRef.current) return;
    const current = value || currentUrl;
    if (!current) return;
    syncFromValue(current, options);
  }, [value, currentUrl, options]);

  const handleSelect = (e) => {
    const next = e.target.value;
    if (next === SAVE_VALUE) {
      const trimmed = (value || "").trim();
      if (!trimmed) return;
      let defaultName = trimmed;
      try { defaultName = new URL(trimmed).host; } catch {}
      const name = window.prompt("Save endpoint as:", defaultName);
      const saved = name?.trim() ? upsertPreset(trimmed, name.trim()) : null;
      if (saved) setMode(`saved:${saved}`);
      return;
    }
    setMode(next);
    if (next === CUSTOM_VALUE) {
      setCustomInput("");
      onChange("");
      return;
    }
    const opt = options.find((o) => o.value === next);
    if (opt) onChange(opt.url);
  };

  const handleCustomInput = (e) => {
    const v = e.target.value;
    customInputRef.current = v;
    setCustomInput(v);
    onChange(v);
  };

  const handleDeleteSaved = () => {
    if (!mode.startsWith("saved:")) return;
    deletePreset(mode.slice(6));
    setCustomInput("");
    const fallback = options.find((o) => o.value !== CUSTOM_VALUE && o.value !== mode);
    if (fallback) {
      setMode(fallback.value);
      onChange(fallback.url);
    } else {
      setMode(CUSTOM_VALUE);
      onChange("");
    }
  };

  const isSaved = mode.startsWith("saved:");
  const isCustom = mode === CUSTOM_VALUE;
  const canSave = isCustom && (customInput || "").trim().length > 0;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <select
          value={mode}
          onChange={handleSelect}
          className="flex-1 min-w-0 px-2 py-2 bg-surface rounded text-xs border border-border focus:outline-none focus:ring-1 focus:ring-primary/50 sm:py-1.5"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
          {canSave && <option value={SAVE_VALUE}>+ Save current as...</option>}
        </select>
        {isSaved && (
          <button type="button" onClick={handleDeleteSaved} className="p-1 text-text-muted hover:text-red-500 rounded transition-colors shrink-0" title="Delete saved endpoint">
            <span className="material-symbols-outlined text-[14px]">delete</span>
          </button>
        )}
      </div>
      {isCustom && (
        <input
          type="text"
          value={customInput}
          onChange={handleCustomInput}
          placeholder={withV1 ? "https://example.com/v1" : "https://example.com"}
          className="w-full min-w-0 px-2 py-2 bg-surface rounded border border-border text-xs focus:outline-none focus:ring-1 focus:ring-primary/50 sm:py-1.5"
        />
      )}
    </div>
  );
}
