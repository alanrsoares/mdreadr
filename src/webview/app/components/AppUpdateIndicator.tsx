import { Button } from "@astryxdesign/core/Button";
import { Icon } from "@astryxdesign/core/Icon";
import { Tooltip } from "@astryxdesign/core/Tooltip";
import { useRef } from "react";
import { ArrowDownTrayIcon, ArrowPathIcon, ExclamationTriangleIcon } from "../icons.ts";
import { createTreatyReaderApi } from "../session/reader-api.ts";
import { useAppUpdate } from "../session/useAppUpdate.ts";

const readerApi = createTreatyReaderApi();

export function AppUpdateIndicator() {
  const { state, isDownloading, isApplying, downloadUpdate, applyUpdate } = useAppUpdate(readerApi);
  const containerRef = useRef<HTMLDivElement>(null);

  if (state.status === "available" && state.latestVersion) {
    return (
      <div ref={containerRef}>
        <Button
          size="sm"
          variant="secondary"
          isLoading={isDownloading}
          icon={<Icon icon={ArrowDownTrayIcon} size="xsm" />}
          label={`Update to v${state.latestVersion}`}
          onClick={() => downloadUpdate()}
        />
        <Tooltip
          content={`Version ${state.latestVersion} is available. Click to download.`}
          anchorRef={containerRef}
          placement="below"
        />
      </div>
    );
  }

  if (state.status === "downloading") {
    const percent = state.progressPercent ?? 0;
    return (
      <div ref={containerRef}>
        <Button size="sm" variant="ghost" isDisabled isLoading label={`Downloading ${percent}%`} />
        <Tooltip
          content={`Downloading update: ${percent}% complete`}
          anchorRef={containerRef}
          placement="below"
        />
      </div>
    );
  }

  if (state.status === "ready") {
    return (
      <div ref={containerRef}>
        <Button
          size="sm"
          variant="primary"
          isLoading={isApplying}
          icon={<Icon icon={ArrowPathIcon} size="xsm" />}
          label="Restart to Update"
          onClick={() => applyUpdate()}
        />
        <Tooltip
          content="Update is downloaded and ready. Restart to apply."
          anchorRef={containerRef}
          placement="below"
        />
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div ref={containerRef}>
        <Button
          size="sm"
          variant="destructive"
          isLoading={isDownloading}
          icon={<Icon icon={ExclamationTriangleIcon} size="xsm" />}
          label="Update Failed — Retry"
          onClick={() => downloadUpdate()}
        />
        <Tooltip
          content={state.error || "Update failed. Click to retry download."}
          anchorRef={containerRef}
          placement="below"
        />
      </div>
    );
  }

  return null;
}
