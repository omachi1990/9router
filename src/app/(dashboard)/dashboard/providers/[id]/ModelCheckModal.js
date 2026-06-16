"use client";

import { useState, useEffect, useCallback } from "react";
import PropTypes from "prop-types";
import { Modal, Button, Badge, Input } from "@/shared/components";

function parseJsonToken(jsonStr) {
  try {
    const clean = jsonStr.trim();
    if (!clean.startsWith("{") && !clean.startsWith("[")) {
      return { apiKey: clean };
    }
    const data = JSON.parse(clean);
    if (typeof data !== "object" || data === null) {
      return { error: "Invalid JSON object" };
    }
    
    // Check if it's a Vertex service account JSON
    if (data.type === "service_account" && data.project_id && data.private_key) {
      return {
        type: "vertex",
        apiKey: JSON.stringify(data),
        name: `Vertex SA (${data.client_email || data.project_id})`
      };
    }

    const apiKey = data.apiKey || data.api_key || data.key || data.secret || data.password || data.cookie || null;
    const accessToken = data.accessToken || data.access_token || data.token || data.session_token || data.sessionToken || data.gh_token || null;
    const refreshToken = data.refreshToken || data.refresh_token || null;
    const idToken = data.idToken || data.id_token || null;
    
    const providerSpecificData = {};
    if (data.machineId || data.machine_id) {
      providerSpecificData.machineId = data.machineId || data.machine_id;
    }
    if (data.accountId || data.account_id) {
      providerSpecificData.accountId = data.accountId || data.account_id;
    }
    if (data.org || data.organization) {
      providerSpecificData.organization = data.org || data.organization;
    }

    const name = data.name || data.email || data.label || null;

    if (!apiKey && !accessToken) {
      return { error: "No API key or Access Token found in JSON. If you pasted a raw API key, make sure it is valid." };
    }

    let authType = "apikey";
    if (accessToken) {
      authType = "oauth";
    }

    return {
      apiKey,
      accessToken,
      refreshToken,
      idToken,
      authType,
      name,
      providerSpecificData: Object.keys(providerSpecificData).length > 0 ? providerSpecificData : null
    };
  } catch (e) {
    return { apiKey: jsonStr.trim() };
  }
}

export default function ModelCheckModal({
  isOpen,
  modelId,
  providerId,
  providerStorageAlias,
  connections,
  proxyPools,
  onClose,
  onUpdateConnections,
}) {
  const [testResults, setTestResults] = useState({});
  const [checking, setChecking] = useState(false);
  const [editConnection, setEditConnection] = useState(null);
  const [importJsonConnId, setImportJsonConnId] = useState(null); // 'new' or connection ID
  const [jsonInput, setJsonInput] = useState("");
  const [jsonError, setJsonError] = useState("");
  const [isSubmittingJson, setIsSubmittingJson] = useState(false);
  const [isDeletingId, setIsDeletingId] = useState(null);

  // Edit fields
  const [editName, setEditName] = useState("");
  const [editPriority, setEditPriority] = useState(1);
  const [editApiKey, setEditApiKey] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Add fields
  const [showAddForm, setShowAddForm] = useState(false);
  const [addName, setAddName] = useState("");
  const [addPriority, setAddPriority] = useState(1);
  const [addApiKey, setAddApiKey] = useState("");
  const [isSavingAdd, setIsSavingAdd] = useState(false);
  const [addError, setAddError] = useState("");

  const checkConnection = useCallback(async (connId) => {
    setTestResults((prev) => ({
      ...prev,
      [connId]: { status: "testing", error: null },
    }));

    try {
      const res = await fetch("/api/models/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: `${providerStorageAlias}/${modelId}`,
          connectionId: connId,
        }),
      });
      const data = await res.json();
      setTestResults((prev) => ({
        ...prev,
        [connId]: {
          status: data.ok ? "success" : "failed",
          error: data.ok ? null : (data.error || "Model validation failed"),
        },
      }));
    } catch (err) {
      setTestResults((prev) => ({
        ...prev,
        [connId]: { status: "failed", error: err.message || "Network error" },
      }));
    }
  }, [modelId, providerStorageAlias]);

  const runAllChecks = useCallback(async () => {
    if (checking || connections.length === 0) return;
    setChecking(true);

    const initial = {};
    for (const conn of connections) {
      initial[conn.id] = { status: "queued", error: null };
    }
    setTestResults(initial);

    for (let i = 0; i < connections.length; i++) {
      const conn = connections[i];
      await checkConnection(conn.id);
      if (i < connections.length - 1) {
        await new Promise((r) => setTimeout(r, 600));
      }
    }
    setChecking(false);
  }, [checking, connections, checkConnection]);

  // Run automatically when modal opens with a valid modelId
  useEffect(() => {
    if (isOpen && modelId && connections.length > 0) {
      runAllChecks();
    } else {
      setTestResults({});
    }
  }, [isOpen, modelId]);

  const handleDeleteConnection = async (connId) => {
    if (!window.confirm("Are you sure you want to delete this connection?")) return;
    setIsDeletingId(connId);
    try {
      const res = await fetch(`/api/providers/${connId}`, { method: "DELETE" });
      if (res.ok) {
        onUpdateConnections?.();
      } else {
        alert("Failed to delete connection");
      }
    } catch (err) {
      alert("Error deleting connection: " + err.message);
    } finally {
      setIsDeletingId(null);
    }
  };

  const handleOpenEdit = (conn) => {
    setEditConnection(conn);
    setEditName(conn.name || "");
    setEditPriority(conn.priority || 1);
    setEditApiKey("");
  };

  const handleSaveEdit = async () => {
    if (!editConnection) return;
    setIsSavingEdit(true);
    try {
      const body = {
        name: editName,
        priority: editPriority,
      };
      if (editApiKey.trim()) {
        body.apiKey = editApiKey.trim();
      }
      const res = await fetch(`/api/providers/${editConnection.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setEditConnection(null);
        onUpdateConnections?.();
      } else {
        const errData = await res.json();
        alert("Failed to save: " + (errData.error || "Unknown error"));
      }
    } catch (err) {
      alert("Error updating connection: " + err.message);
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleOpenJsonImport = (connId) => {
    setImportJsonConnId(connId);
    setJsonInput("");
    setJsonError("");
  };

  const handleImportJson = async () => {
    if (!jsonInput.trim()) {
      setJsonError("JSON content cannot be empty");
      return;
    }
    const parsed = parseJsonToken(jsonInput);
    if (parsed.error) {
      setJsonError(parsed.error);
      return;
    }

    setIsSubmittingJson(true);
    setJsonError("");
    try {
      if (importJsonConnId === "new") {
        // Create connection
        const body = {
          provider: providerId,
          name: parsed.name || `${providerId} Account`,
          apiKey: parsed.apiKey || "",
          accessToken: parsed.accessToken,
          refreshToken: parsed.refreshToken,
          idToken: parsed.idToken,
          authType: parsed.authType,
          priority: 1,
          providerSpecificData: parsed.providerSpecificData || {},
        };
        const res = await fetch("/api/providers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (res.ok) {
          setImportJsonConnId(null);
          onUpdateConnections?.();
        } else {
          const errData = await res.json();
          setJsonError(errData.error || "Failed to create connection");
        }
      } else {
        // Update connection
        const body = {
          name: parsed.name || undefined,
          apiKey: parsed.apiKey || undefined,
          accessToken: parsed.accessToken || undefined,
          refreshToken: parsed.refreshToken || undefined,
          idToken: parsed.idToken || undefined,
          authType: parsed.authType || undefined,
          providerSpecificData: parsed.providerSpecificData || undefined,
        };
        const res = await fetch(`/api/providers/${importJsonConnId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (res.ok) {
          setImportJsonConnId(null);
          onUpdateConnections?.();
        } else {
          const errData = await res.json();
          setJsonError(errData.error || "Failed to update connection");
        }
      }
    } catch (err) {
      setJsonError("Request failed: " + err.message);
    } finally {
      setIsSubmittingJson(false);
    }
  };

  const handleSaveAdd = async () => {
    if (!addName.trim() || (!addApiKey.trim() && providerId !== "ollama-local")) {
      setAddError("Name and API Key are required");
      return;
    }
    setIsSavingAdd(true);
    setAddError("");
    try {
      const res = await fetch("/api/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: providerId,
          name: addName.trim(),
          apiKey: addApiKey.trim(),
          priority: addPriority,
        }),
      });
      if (res.ok) {
        setShowAddForm(false);
        setAddName("");
        setAddApiKey("");
        setAddPriority(1);
        onUpdateConnections?.();
      } else {
        const errData = await res.json();
        setAddError(errData.error || "Failed to add connection");
      }
    } catch (err) {
      setAddError("Error adding connection: " + err.message);
    } finally {
      setIsSavingAdd(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <Modal isOpen={isOpen} title={`Check Model: ${modelId}`} onClose={onClose} size="lg">
        <div className="flex flex-col gap-4 max-h-[78vh] overflow-y-auto pr-1">
          {/* Header Action Row */}
          <div className="flex items-center justify-between border-b border-border/40 pb-2">
            <span className="text-xs text-text-muted">
              {connections.length === 0
                ? "No accounts found for this provider."
                : `Found ${connections.length} accounts. Checking sequentially...`}
            </span>
            <div className="flex gap-2">
              <Button size="xs" variant="secondary" icon="add" onClick={() => setShowAddForm(true)}>
                Add Account
              </Button>
              <Button size="xs" variant="secondary" icon="upload_file" onClick={() => handleOpenJsonImport("new")}>
                Import JSON
              </Button>
              {connections.length > 0 && (
                <Button size="xs" variant="primary" icon="refresh" onClick={runAllChecks} disabled={checking}>
                  {checking ? "Checking..." : "Re-run All"}
                </Button>
              )}
            </div>
          </div>

          {/* Add Connection Form (Inline) */}
          {showAddForm && (
            <div className="bg-sidebar/30 p-4 rounded-xl border border-border flex flex-col gap-3">
              <h3 className="text-sm font-semibold">Add New Account</h3>
              {addError && <p className="text-xs text-red-500">{addError}</p>}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input label="Name" value={addName} onChange={(e) => setAddName(e.target.value)} placeholder="Production Key" />
                <Input label="Priority" type="number" value={addPriority} onChange={(e) => setAddPriority(Number(e.target.value) || 1)} />
              </div>
              {providerId !== "ollama-local" && (
                <Input label="API Key" type="password" value={addApiKey} onChange={(e) => setAddApiKey(e.target.value)} placeholder="Pasted API key/token" />
              )}
              <div className="flex gap-2 justify-end">
                <Button size="sm" variant="ghost" onClick={() => setShowAddForm(false)}>
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSaveAdd} disabled={isSavingAdd}>
                  {isSavingAdd ? "Saving..." : "Save"}
                </Button>
              </div>
            </div>
          )}

          {/* Connections List */}
          <div className="flex flex-col gap-3">
            {connections.map((conn) => {
              const res = testResults[conn.id];
              return (
                <div
                  key={conn.id}
                  className="p-3.5 rounded-xl border border-border/60 bg-sidebar/10 hover:bg-sidebar/20 transition-all flex flex-col gap-2.5"
                >
                  {/* Row: Credentials Meta & Actions */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-semibold text-sm truncate">
                        {conn.name || conn.email || "Unnamed API Key"}
                      </span>
                      <Badge variant="default" size="xs">Priority #{conn.priority}</Badge>
                      {conn.isActive === false && <Badge variant="default" size="xs">Disabled</Badge>}
                    </div>

                    {/* Actions & Status */}
                    <div className="flex items-center gap-3 justify-between sm:justify-end shrink-0">
                      {/* Status Badge */}
                      <div className="flex items-center justify-end">
                        {!res && <Badge variant="default">Idle</Badge>}
                        {res?.status === "queued" && <Badge variant="default">Queued</Badge>}
                        {res?.status === "testing" && (
                          <div className="flex items-center gap-1.5 text-xs text-primary animate-pulse font-medium">
                            <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
                            Testing...
                          </div>
                        )}
                        {res?.status === "success" && (
                          <div className="flex items-center gap-1.5 text-xs text-green-500 font-medium">
                            <span className="material-symbols-outlined text-sm text-green-500">check_circle</span>
                            Active
                          </div>
                        )}
                        {res?.status === "failed" && (
                          <div className="flex items-center gap-1.5 text-xs text-red-500 font-medium">
                            <span className="material-symbols-outlined text-sm text-red-500">cancel</span>
                            Error
                          </div>
                        )}
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-1.5">
                        <Button
                          size="xs"
                          variant="secondary"
                          icon="science"
                          loading={res?.status === "testing"}
                          onClick={() => checkConnection(conn.id)}
                          disabled={checking || res?.status === "testing"}
                          title="Recheck this account"
                        />
                        <Button
                          size="xs"
                          variant="secondary"
                          icon="edit"
                          onClick={() => handleOpenEdit(conn)}
                          title="Edit name/priority"
                        />
                        <Button
                          size="xs"
                          variant="secondary"
                          icon="upload_file"
                          onClick={() => handleOpenJsonImport(conn.id)}
                          title="Import JSON token"
                        />
                        <Button
                          size="xs"
                          variant="danger"
                          icon="delete"
                          loading={isDeletingId === conn.id}
                          onClick={() => handleDeleteConnection(conn.id)}
                          disabled={isDeletingId === conn.id}
                          title="Delete account"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Error Details block (on a separate row) */}
                  {res?.status === "failed" && res?.error && (
                    <div className="text-xs text-red-500 bg-red-500/5 p-2 rounded-lg border border-red-500/10 break-words font-mono mt-1">
                      {res.error}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex justify-end border-t border-border/40 pt-4 mt-2">
            <Button onClick={onClose} variant="ghost">Close</Button>
          </div>
        </div>
      </Modal>

      {/* Edit Connection Sub-Modal */}
      {editConnection && (
        <Modal isOpen={!!editConnection} title="Edit Account" onClose={() => setEditConnection(null)} size="sm">
          <div className="flex flex-col gap-4">
            <Input label="Name" value={editName} onChange={(e) => setEditName(e.target.value)} />
            <Input label="Priority" type="number" value={editPriority} onChange={(e) => setEditPriority(Number(e.target.value) || 1)} />
            {editConnection.authType !== "oauth" && (
              <Input
                label="API Key (Optional)"
                type="password"
                value={editApiKey}
                onChange={(e) => setEditApiKey(e.target.value)}
                placeholder="Enter new API key (or leave blank)"
              />
            )}
            <div className="flex gap-2">
              <Button onClick={() => setEditConnection(null)} variant="ghost" fullWidth>Cancel</Button>
              <Button onClick={handleSaveEdit} fullWidth disabled={isSavingEdit}>
                {isSavingEdit ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* JSON Import Sub-Modal */}
      {importJsonConnId && (
        <Modal
          isOpen={!!importJsonConnId}
          title={importJsonConnId === "new" ? "Import JSON (New Account)" : "Import JSON (Update Account)"}
          onClose={() => setImportJsonConnId(null)}
          size="md"
        >
          <div className="flex flex-col gap-4">
            <p className="text-xs text-text-muted leading-relaxed">
              Paste your account credential JSON here. It will automatically detect fields like API key, access token, refresh token, or Service Account keys.
            </p>
            <textarea
              className="w-full h-40 px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:border-primary font-mono"
              placeholder='e.g., {"apiKey": "sk-...", "priority": 1} or raw key'
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
            />
            {jsonError && <p className="text-xs text-red-500 bg-red-500/5 p-2 rounded border border-red-500/10">{jsonError}</p>}
            <div className="flex gap-2">
              <Button onClick={() => setImportJsonConnId(null)} variant="ghost" fullWidth>Cancel</Button>
              <Button onClick={handleImportJson} fullWidth disabled={isSubmittingJson}>
                {isSubmittingJson ? "Importing..." : "Import"}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

ModelCheckModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  modelId: PropTypes.string,
  providerId: PropTypes.string.isRequired,
  providerStorageAlias: PropTypes.string.isRequired,
  connections: PropTypes.array.isRequired,
  proxyPools: PropTypes.array,
  onClose: PropTypes.func.isRequired,
  onUpdateConnections: PropTypes.func,
};
