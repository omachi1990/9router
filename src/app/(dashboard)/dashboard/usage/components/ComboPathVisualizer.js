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
          <div className="flex flex-col items-center text-xs ">
            <div className="flex items-center gap-0.5">
              {renderStatusIcon(step.status)}
              <span className="font-mono truncate max-w-[120px]">{step.model}</span>
            </div>
            <span className="text-text-muted">{step.latency}ms</span>
          </div>
          {index < path.length - 1 && (
            <span className="material-symbols-outlined text-sm text-text-muted -mx-1">
              arrow_forward_ios
            </span>
          )}
        </React.Fragmen>
      ))}
    </div>
  );
}
