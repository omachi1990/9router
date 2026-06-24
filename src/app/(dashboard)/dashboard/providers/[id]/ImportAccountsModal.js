"use client";

import { useState, useRef } from "react";
import PropTypes from "prop-types";
import { Button, Modal, Toggle } from "@/shared/components";
import { translate } from "@/i18n/runtime";

const PLACEHOLDER = `[
  {
    "name": "My API Key",
    "apiKey": "sk-...",
    "priority": 1,
    "authType": "apikey"
  },
  {
    "name": "OAuth Account",
    "accessToken": "eyJ...",
    "refreshToken": "rt_...",
    "authType": "oauth"
  }
]`;

function normalizeToArray(parsed) {
  if (Array.isArray(parsed)) return parsed;
  if (parsed && typeof parsed === "object") {
    if (Array.isArray(parsed.accounts)) return parsed.accounts;
    return [parsed];
  }
  return null;
}

export default function ImportAccountsModal({ isOpen, providerId, existingConnections, onClose, onSuccess }) {
  const [jsonText, setJsonText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [parseError, setParseError] = useState("");
  const [overwrite, setOverwrite] = useState(false);
  const [result, setResult] = useState(null);
  const fileInputRef = useRef(null);

  const handleClose = () => {
    if (submitting) return;
    setJsonText("");
    setParseError("");
    setResult(null);
    setOverwrite(false);
    onClose();
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setJsonText(event.target.result);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const matchExisting = (account) => {
    const lookup = [account.name, account.displayName, account.email].filter(Boolean);
    if (lookup.length === 0) return null;
    return existingConnections.find((conn) =>
      lookup.some((val) => {
        const targets = [conn.name, conn.displayName, conn.email].filter(Boolean);
        return targets.some((t) => t.toLowerCase() === val.toLowerCase());
      })
    ) || null;
  };

  const handleSubmit = async () => {
    setParseError("");
    setResult(null);

    const trimmed = jsonText.trim();
    if (!trimmed) return;

    let parsed;
    try {
      parsed = JSON.parse(trimmed);
    } catch (err) {
      setParseError(`${translate("Invalid JSON")}: ${err.message}`);
      return;
    }

    const accounts = normalizeToArray(parsed);
    if (!accounts || accounts.length === 0) {
      setParseError(translate("No accounts found in input"));
      return;
    }

    setSubmitting(true);
    const results = [];
    let success = 0;
    let failed = 0;
    let overwritten = 0;

    for (let index = 0; index < accounts.length; index++) {
      const account = accounts[index];
      const existing = overwrite ? matchExisting(account) : null;

      try {
        if (existing) {
          const res = await fetch(`/api/providers/${existing.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: account.name,
              apiKey: account.apiKey,
              authType: account.authType,
              priority: account.priority,
              defaultModel: account.defaultModel,
              displayName: account.displayName,
              accessToken: account.accessToken,
              refreshToken: account.refreshToken,
              idToken: account.idToken,
              providerSpecificData: account.providerSpecificData,
              proxyPoolId: account.proxyPoolId,
              connectionProxyEnabled: account.connectionProxyEnabled,
              connectionProxyUrl: account.connectionProxyUrl,
              connectionNoProxy: account.connectionNoProxy,
            }),
          });
          const data = await res.json();
          if (res.ok) {
            overwritten++;
            success++;
            results.push({ index, ok: true, action: "overwrite" });
          } else {
            failed++;
            results.push({ index, ok: false, error: data?.error || `HTTP ${res.status}` });
          }
        } else {
          const res = await fetch("/api/providers", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              provider: providerId,
              name: account.name,
              apiKey: account.apiKey,
              authType: account.authType,
              priority: account.priority,
              defaultModel: account.defaultModel,
              displayName: account.displayName,
              accessToken: account.accessToken,
              refreshToken: account.refreshToken,
              idToken: account.idToken,
              providerSpecificData: account.providerSpecificData,
              proxyPoolId: account.proxyPoolId,
              connectionProxyEnabled: account.connectionProxyEnabled,
              connectionProxyUrl: account.connectionProxyUrl,
              connectionNoProxy: account.connectionNoProxy,
            }),
          });
          const data = await res.json();
          if (res.ok) {
            success++;
            results.push({ index, ok: true, action: "created" });
          } else {
            failed++;
            results.push({ index, ok: false, error: data?.error || `HTTP ${res.status}` });
          }
        }
      } catch (err) {
        failed++;
        results.push({ index, ok: false, error: err.message });
      }
    }

    setResult({ success, failed, overwritten, results });
    if (success > 0 && typeof onSuccess === "function") {
      onSuccess();
    }
    setSubmitting(false);
  };

  const failedItems = result?.results?.filter((r) => !r.ok) || [];

  return (
    <Modal isOpen={isOpen} title={translate("Import Accounts")} onClose={handleClose} size="lg">
      <div className="flex flex-col gap-4">
        <p className="text-xs text-text-muted">
          {translate("Paste JSON array of accounts or upload a .json file.")}
        </p>

        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleFileUpload}
            className="hidden"
          />
          <Button
            size="sm"
            variant="secondary"
            icon="upload"
            onClick={() => fileInputRef.current?.click()}
          >
            {translate("Upload File")}
          </Button>
        </div>

        <textarea
          className="w-full rounded border border-accent/30 bg-sidebar p-2 text-sm font-mono resize-y min-h-[200px] focus:outline-none focus:ring-1 focus:ring-primary"
          placeholder={PLACEHOLDER}
          value={jsonText}
          onChange={(e) => setJsonText(e.target.value)}
          disabled={submitting}
        />

        <div className="flex items-center gap-2">
          <Toggle
            size="sm"
            checked={overwrite}
            onChange={setOverwrite}
          />
          <span className="text-sm text-text-main">{translate("Overwrite existing accounts (match by name/email)")}</span>
        </div>

        {existingConnections.length > 0 && overwrite && (
          <div className="text-xs text-text-muted">
            {existingConnections.length} {translate("existing connection(s) — accounts with matching name or email will be updated.")}
          </div>
        )}

        {parseError && (
          <p className="text-xs text-red-500 break-words">{parseError}</p>
        )}

        {result && (
          <div className="flex flex-col gap-2">
            <div className={`text-sm font-medium ${result.failed > 0 ? "text-yellow-400" : "text-green-400"}`}>
              ✓ {result.success} {translate("processed")}
              {result.overwritten > 0 && ` (${result.overwritten} ${translate("overwritten")})`}
              {result.failed > 0 ? `, ✗ ${result.failed} ${translate("failed")}` : ""}
            </div>
            {failedItems.length > 0 && (
              <ul className="rounded border border-accent/20 bg-sidebar/50 p-2 text-xs font-mono max-h-40 overflow-y-auto">
                {failedItems.map((item) => (
                  <li key={item.index} className="text-red-400">
                    [{item.index}] {item.error}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="flex gap-2">
          <Button
            onClick={handleSubmit}
            fullWidth
            disabled={submitting || !jsonText.trim()}
          >
            {submitting ? translate("Importing...") : translate("Import All")}
          </Button>
          <Button onClick={handleClose} variant="ghost" fullWidth disabled={submitting}>
            {translate("Close")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

ImportAccountsModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  providerId: PropTypes.string.isRequired,
  existingConnections: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string,
    name: PropTypes.string,
    displayName: PropTypes.string,
    email: PropTypes.string,
  })),
  onClose: PropTypes.func.isRequired,
  onSuccess: PropTypes.func,
};
