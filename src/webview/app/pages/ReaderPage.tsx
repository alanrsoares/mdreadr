import { AppShell } from "@astryxdesign/core/AppShell";
import { Button } from "@astryxdesign/core/Button";
import { Icon } from "@astryxdesign/core/Icon";
import { Stack } from "@astryxdesign/core/Stack";
import { Tooltip } from "@astryxdesign/core/Tooltip";
import { TopNav, TopNavHeading } from "@astryxdesign/core/TopNav";
import type { BlockAnchor, NoteStatus } from "@mdreadr/domain";
import { extractHeadings } from "@mdreadr/domain";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { readOptionalPath, readPaths } from "../api-guards.ts";
import { AppLogo } from "../components/AppLogo.tsx";
import { DocumentView, type DocumentViewMode } from "../components/DocumentView.tsx";
import { formatDisplayPath } from "../components/display-path.ts";
import { NotesPanel } from "../components/NotesPanel.tsx";
import { ReaderDropHint } from "../components/ReaderDropHint.tsx";
import { pathFileName, RecentsSidebar } from "../components/RecentsSidebar.tsx";
import { TocSidebar } from "../components/TocSidebar.tsx";
import { useMutationToast } from "../hooks/useMutationToast.ts";
import { ArrowDownTrayIcon } from "../icons.ts";
import { flashBlock, scrollToBlock } from "../markdown/block-ids.ts";
import { api } from "../treaty.ts";
import {
  EmptyState,
  ReaderContent,
  ReaderLayout,
  ReaderMain,
  ReaderNotesAside,
  ReaderPanel,
} from "../ui/layout.tsx";

function ReaderDocumentTopNavHeading({
  documentPath,
  homeDirectory,
}: {
  documentPath?: string;
  homeDirectory?: string;
}) {
  const anchorRef = useRef<HTMLDivElement>(null);

  if (!documentPath) {
    return <TopNavHeading logo={<AppLogo />} heading="mdreadr" />;
  }

  const displayPath = formatDisplayPath(documentPath, homeDirectory);

  return (
    <>
      <div ref={anchorRef}>
        <TopNavHeading
          logo={<AppLogo />}
          superheading="mdreadr"
          heading={pathFileName(documentPath)}
          subheading={displayPath}
        />
      </div>
      {displayPath !== documentPath ? (
        <Tooltip content={documentPath} placement="below" alignment="start" anchorRef={anchorRef} />
      ) : null}
    </>
  );
}

export function ReaderPage() {
  const queryClient = useQueryClient();
  const { showError, showSuccess } = useMutationToast();
  const [pendingAnchor, setPendingAnchor] = useState<BlockAnchor | null>(null);
  const [documentViewMode, setDocumentViewMode] = useState<DocumentViewMode>("preview");
  const [liveMessage, setLiveMessage] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);
  const readerMainRef = useRef<HTMLElement>(null);
  const dragDepthRef = useRef(0);

  const sessionQuery = useQuery({
    queryKey: ["session"],
    queryFn: async () => {
      const { data, error } = await api.session.get();
      if (error) throw error;
      return data;
    },
  });

  const recentsQuery = useQuery({
    queryKey: ["recents"],
    queryFn: async () => {
      const { data, error } = await api.documents.recent.get();
      if (error) throw error;
      return readPaths(data);
    },
  });

  const notesQuery = useQuery({
    queryKey: ["notes"],
    queryFn: async () => {
      const { data, error } = await api.notes.get();
      if (error) throw error;
      return data?.notes ?? [];
    },
  });

  useEffect(() => {
    if (sessionQuery.isError) {
      showError("Load session", sessionQuery.error);
    }
  }, [sessionQuery.error, sessionQuery.isError, showError]);

  useEffect(() => {
    if (notesQuery.isError) {
      showError("Load notes", notesQuery.error);
    }
  }, [notesQuery.error, notesQuery.isError, showError]);

  const openDocument = useMutation({
    mutationFn: async (path: string) => {
      const { data, error } = await api.documents.open.post({ path });
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, path) => {
      void queryClient.invalidateQueries({ queryKey: ["session"] });
      void queryClient.invalidateQueries({ queryKey: ["recents"] });
      setPendingAnchor(null);
      const homeDirectory = queryClient.getQueryData<{ homeDirectory?: string }>([
        "session",
      ])?.homeDirectory;
      showSuccess(`Opened ${formatDisplayPath(path, homeDirectory)}`);
      setLiveMessage(`Opened ${pathFileName(path)}`);
    },
    onError: (error) => {
      showError("Open document", error);
    },
  });

  const pickDocument = useMutation({
    mutationFn: async () => {
      const { data, error } = await api.dialogs.pick.post({
        mode: "open",
        filters: ["*.md"],
      });
      if (error) throw error;
      return readOptionalPath(data);
    },
    onSuccess: (path) => {
      if (path) {
        openDocument.mutate(path);
      }
    },
    onError: (error) => {
      showError("Pick file", error);
    },
  });

  const createNote = useMutation({
    mutationFn: async (input: { anchor: BlockAnchor; body: string }) => {
      const { data, error } = await api.notes.post({
        anchor: input.anchor,
        body: input.body,
        author: { kind: "human" },
      });
      if (error) throw error;
      return data?.note;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notes"] });
      setPendingAnchor(null);
      setLiveMessage("Note added");
      showSuccess("Note added");
    },
    onError: (error) => {
      showError("Add note", error);
    },
  });

  const addReply = useMutation({
    mutationFn: async (input: { noteId: string; body: string }) => {
      const { data, error } = await api.notes({ id: input.noteId }).replies.post({
        body: input.body,
        author: { kind: "human" },
      });
      if (error) throw error;
      if (!data || "error" in data) throw new Error("Failed to add reply");
      return data.note;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notes"] });
      setLiveMessage("Reply added");
    },
    onError: (error) => {
      showError("Add reply", error);
    },
  });

  const updateStatus = useMutation({
    mutationFn: async (input: { noteId: string; status: NoteStatus }) => {
      const { data, error } = await api
        .notes({ id: input.noteId })
        .status.patch({ status: input.status });
      if (error) throw error;
      if (!data || "error" in data) throw new Error("Failed to update status");
      return data.note;
    },
    onSuccess: (note) => {
      void queryClient.invalidateQueries({ queryKey: ["notes"] });
      setLiveMessage(`Note marked ${note?.status ?? "updated"}`);
    },
    onError: (error) => {
      showError("Update note status", error);
    },
  });

  const saveNotes = useMutation({
    mutationFn: async () => {
      const pick = await api.dialogs.pick.post({
        mode: "save",
        defaultPath: "notes.json",
      });
      if (pick.error) throw pick.error;
      const path = readOptionalPath(pick.data);
      if (!path) return null;

      const notes = notesQuery.data ?? [];
      const document = sessionQuery.data?.document ?? undefined;
      const { data, error } = await api.notes.save.post({
        path,
        notes,
        document,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      if (data) {
        showSuccess("Notes saved");
        setLiveMessage("Notes saved");
      }
    },
    onError: (error) => {
      showError("Save notes", error);
    },
  });

  const loadNotes = useMutation({
    mutationFn: async () => {
      const pick = await api.dialogs.pick.post({
        mode: "open",
        filters: ["*.json"],
      });
      if (pick.error) throw pick.error;
      const path = readOptionalPath(pick.data);
      if (!path) return null;

      const { data, error } = await api.notes.load.post({ path });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      if (data && typeof data === "object" && "document" in data) {
        const document = (data as { document?: { path: string } }).document;
        if (document?.path) {
          openDocument.mutate(document.path);
        }
      }
      void queryClient.invalidateQueries({ queryKey: ["notes"] });
      void queryClient.invalidateQueries({ queryKey: ["session"] });
      showSuccess("Notes loaded");
      setLiveMessage("Notes loaded");
    },
    onError: (error) => {
      showError("Load notes", error);
    },
  });

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      dragDepthRef.current = 0;
      setIsDragOver(false);

      const file = event.dataTransfer.files.item(0);
      if (!file) return;

      const path = (file as File & { path?: string }).path;
      if (path?.endsWith(".md")) {
        openDocument.mutate(path);
        return;
      }

      if (!path) {
        showError(
          "Open dropped file",
          "This environment cannot read the file path from drag-and-drop. Use Open… instead.",
        );
      }
    },
    [openDocument, showError],
  );

  const onDragEnter = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    if (!event.dataTransfer.types.includes("Files")) return;
    dragDepthRef.current += 1;
    setIsDragOver(true);
  }, []);

  const onDragLeave = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    if (!event.dataTransfer.types.includes("Files")) return;
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) {
      setIsDragOver(false);
    }
  }, []);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    if (event.dataTransfer.types.includes("Files")) {
      event.dataTransfer.dropEffect = "copy";
    }
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey) return;
      if (event.key.toLowerCase() !== "o" || event.shiftKey) return;

      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          target.closest("input, textarea, select, [contenteditable='true']"))
      ) {
        return;
      }

      event.preventDefault();
      pickDocument.mutate();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [pickDocument]);

  const content = sessionQuery.data?.documentContent ?? "";
  const documentPath = sessionQuery.data?.document?.path;
  const notes = notesQuery.data ?? [];
  const toc = useMemo(() => extractHeadings(content), [content]);
  const isOpening = pickDocument.isPending || openDocument.isPending;

  const onScrollToAnchor = useCallback(
    (blockId: string) => {
      const jump = () => {
        if (!scrollToBlock(blockId)) {
          showError("Jump to note", "Could not find that block in the document.");
        }
      };

      if (documentViewMode !== "preview") {
        setDocumentViewMode("preview");
        window.requestAnimationFrame(() => {
          window.requestAnimationFrame(jump);
        });
        return;
      }

      jump();
    },
    [documentViewMode, showError],
  );

  return (
    <AppShell
      contentPadding={0}
      topNav={
        <TopNav
          label="Reader"
          heading={
            <ReaderDocumentTopNavHeading
              documentPath={documentPath}
              homeDirectory={sessionQuery.data?.homeDirectory}
            />
          }
          endContent={
            <Button
              label="Open…"
              variant="secondary"
              isLoading={isOpening}
              onClick={() => pickDocument.mutate()}
            />
          }
        />
      }
      sideNav={
        <RecentsSidebar
          paths={recentsQuery.data ?? []}
          selectedPath={documentPath}
          homeDirectory={sessionQuery.data?.homeDirectory}
          onOpen={(path) => openDocument.mutate(path)}
          onPickDocument={() => pickDocument.mutate()}
          isOpening={isOpening}
        />
      }
    >
      <div aria-live="polite" className="sr-only">
        {liveMessage}
      </div>
      <ReaderLayout aria-label="Document reader">
        <ReaderPanel>
          {documentViewMode === "preview" ? (
            <TocSidebar entries={toc} scrollRootRef={readerMainRef} documentKey={documentPath} />
          ) : (
            <EmptyState className="reader-empty-enter">
              <p>Table of contents is available in preview.</p>
            </EmptyState>
          )}
        </ReaderPanel>

        <ReaderMain
          ref={readerMainRef}
          onDragEnter={onDragEnter}
          onDragLeave={onDragLeave}
          onDragOver={onDragOver}
          onDrop={onDrop}
        >
          <div
            aria-hidden
            className="reader-main-drop-overlay"
            data-active={isDragOver ? "true" : "false"}
          >
            <Stack gap={2} vAlign="center" hAlign="center" className="reader-drop-overlay-content">
              <Icon icon={ArrowDownTrayIcon} size="lg" />
              Drop to open
            </Stack>
          </div>
          {content ? (
            <ReaderContent>
              <DocumentView
                key={documentPath}
                content={content}
                documentPath={documentPath}
                notes={notes}
                viewMode={documentViewMode}
                onViewModeChange={setDocumentViewMode}
                onPinBlock={(anchor) => {
                  setPendingAnchor(anchor);
                  flashBlock(anchor.blockId, "reader-block-pin-flash");
                  setLiveMessage(`Pinning note to ${anchor.label ?? anchor.kind}`);
                }}
              />
            </ReaderContent>
          ) : (
            <EmptyState className="reader-empty-enter">
              <AppLogo size={48} />
              <ReaderDropHint />
              <Button
                label="Open markdown…"
                variant="primary"
                isLoading={isOpening}
                onClick={() => pickDocument.mutate()}
              />
            </EmptyState>
          )}
        </ReaderMain>

        <ReaderNotesAside data-pending={pendingAnchor ? "true" : "false"}>
          <NotesPanel
            notes={notes}
            pendingAnchor={pendingAnchor}
            isSaving={saveNotes.isPending}
            isLoadingNotes={loadNotes.isPending}
            isCreatingNote={createNote.isPending}
            onCreateNote={async (input) => {
              await createNote.mutateAsync(input);
            }}
            onAddReply={async (noteId, body) => {
              await addReply.mutateAsync({ noteId, body });
            }}
            onUpdateStatus={async (noteId, status) => {
              await updateStatus.mutateAsync({ noteId, status });
            }}
            onSaveNotes={async () => {
              await saveNotes.mutateAsync();
            }}
            onLoadNotes={async () => {
              await loadNotes.mutateAsync();
            }}
            onScrollToAnchor={onScrollToAnchor}
          />
        </ReaderNotesAside>
      </ReaderLayout>
    </AppShell>
  );
}
