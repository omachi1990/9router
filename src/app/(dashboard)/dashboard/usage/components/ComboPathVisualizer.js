"use client";

import React from 'react';
import { cn } from '@/shared/utils/cn';

export default function ComboPathVisualizer({ path }) {
  if (!path || path.length === 0) {
    return <span className="text-xs text-text-muted">N/A</span>;
  }

  const renderStatusIcon = (status) => {
    if (status === "success") {
      return <span className="material-symbols-outlined text-green-500 text-sm">check_circle</span>;
    } else if (status === "failed") {
      return <span className="material-symbols-outlined text-red-500 text-sm">cancel</span>;
    } else {
      return <span className="material-symbols-outlined text-blue-500 text-sm animate-spin">hourglass_empty</span>;
    }
  };

  return (
    <div className="flex items-center gap-1.5 overflow-hidden">
      {path.map((step, index) => (
        <React.Fragment key={index}>
          <div className="flex flex-col items-center text-xs min-w-0">
            <div className="flex items-center gap-1 min-w-0">
              {renderStatusIcon(step.status)}
              <span className="font-mono truncate max-w-[150px] font-medium" title={step.model}>{step.model}</span>
            </div>
            {step.accountName && (
              <span className="text-[10px] text-text-muted truncate max-w-[120px] opacity-80" title={step.accountName}>
                {step.accountName}
              </span>
            )}
            <span className="text-[10px] text-text-muted font-mono">{step.latency}ms</span>
          </div>
          {index < path.length - 1 && (
            <span className="material-symbols-outlined text-sm text-text-muted -mx-1">
              arrow_forward_ios
            </span>
          )}
        </React.Fragment>
      ))}
    </div>
  );
}
