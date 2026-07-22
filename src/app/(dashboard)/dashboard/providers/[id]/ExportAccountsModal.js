"use client";

import PropTypes from "prop-types";
import { Button, Modal } from "@/shared/components";
import { useCopyToClipboard } from "@/shared/hooks/useCopyToClipboard";
import { translate } from "@/i18n/runtime";

export default function ExportAccountsModal({ isOpen, jsonText, filename, onClose }) {
  const { copied, copy } = useCopyToClipboard();

  const handleDownload = () => {
    const blob = new Blob([jsonText], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Modal isOpen={isOpen} title={translate("Export Accounts")} onClose={onClose} size="lg">
      <div className="flex flex-col gap-4">
        <p className="text-xs text-text-muted">
          {translate("Below is the JSON configuration data for the exported account(s). You can copy it directly to clipboard or download it as a JSON file.")}
        </p>

        <textarea
          readOnly
          className="w-full rounded border border-accent/30 bg-sidebar p-2 text-sm font-mono resize-y min-h-[250px] focus:outline-none focus:ring-1 focus:ring-primary"
          value={jsonText}
          onClick={(e) => e.target.select()}
        />

        <div className="flex gap-2">
          <Button
            onClick={() => copy(jsonText, "json")}
            fullWidth
            variant={copied === "json" ? "success" : "primary"}
            icon={copied === "json" ? "check" : "copy"}
          >
            {copied === "json" ? translate("Copied!") : translate("Copy to Clipboard")}
          </Button>
          <Button
            onClick={handleDownload}
            fullWidth
            variant="secondary"
            icon="download"
          >
            {translate("Download File")}
          </Button>
          <Button onClick={onClose} variant="ghost" fullWidth>
            {translate("Close")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

ExportAccountsModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  jsonText: PropTypes.string.isRequired,
  filename: PropTypes.string.isRequired,
  onClose: PropTypes.func.isRequired,
};
