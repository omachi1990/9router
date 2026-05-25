"use client";

import { useState } from "react";
import { Button } from "@/shared/components";

export default function TestModelButton({ model, disabled }) {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const handleTest = async () => {
    if (!model || disabled) return;
    setTesting(true);
    setTestResult(null);

    try {
      const res = await fetch("/api/models/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, kind: "chat" }),
      });
      const data = await res.json();
      
      if (res.ok && data.ok) {
        setTestResult({ type: "success", text: "Test successful! Model is responding." });
      } else {
        setTestResult({ type: "error", text: data.error || "Test failed" });
      }
    } catch (error) {
      setTestResult({ type: "error", text: error.message || "Network error" });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 w-full sm:w-auto">
      <Button 
        variant="secondary" 
        size="sm" 
        onClick={handleTest} 
        disabled={disabled || testing || !model} 
        loading={testing}
      >
        <span className="material-symbols-outlined text-[14px] mr-1">science</span>
        Test Connection
      </Button>
      {testResult && (
        <div className={`mt-1 flex items-center gap-1.5 text-[11px] ${testResult.type === "success" ? "text-green-500" : "text-red-500"}`}>
          <span className="material-symbols-outlined text-[12px]">
            {testResult.type === "success" ? "check_circle" : "error"}
          </span>
          <span className="truncate max-w-[200px]" title={testResult.text}>{testResult.text}</span>
        </div>
      )}
    </div>
  );
}