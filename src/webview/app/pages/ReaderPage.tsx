import { AppShell } from "@astryxdesign/core/AppShell";
import { Button } from "@astryxdesign/core/Button";
import { SideNav, SideNavItem, SideNavSection } from "@astryxdesign/core/SideNav";
import { TopNav, TopNavHeading } from "@astryxdesign/core/TopNav";
import type { BlockAnchor, NoteStatus } from "@mdreadr/domain";
import { extractHeadings } from "@mdreadr/domain";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { readOptionalPath, readPaths } from "../api-guards.ts";
import { DocumentView, type DocumentViewMode } from "../components/DocumentView.tsx";
import { NotesPanel } from "../components/NotesPanel.tsx";
import { TocSidebar } from "../components/TocSidebar.tsx";
import { api } from "../treaty.ts";
import {
  EmptyState,
  ReaderContent,
  ReaderLayout,
  ReaderMain,
  ReaderNotesAside,
  ReaderPanel,
  TopNavActions,
} from "../ui/layout.tsx";

function fileName(path: string): string {
  const parts = path.split(/[/\\]/);
  return parts.at(-1) ?? path;
}

export function ReaderPage() {
  const queryClient = useQueryClient();
  const [pendingAnchor, setPendingAnchor] = useState<BlockAnchor | null>(null);
  const [documentViewMode, setDocumentViewMode] = useState<DocumentViewMode>("preview");

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

  const openDocument = useMutation({
    mutationFn: async (path: string) => {
      const { data, error } = await api.documents.open.post({ path });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["session"] });
      void queryClient.invalidateQueries({ queryKey: ["recents"] });
      setPendingAnchor(null);
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
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notes"] });
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
    },
  });

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const file = event.dataTransfer.files.item(0);
      if (!file) return;
      const path = (file as File & { path?: string }).path;
      if (path?.endsWith(".md")) {
        openDocument.mutate(path);
      }
    },
    [openDocument],
  );

  const content = sessionQuery.data?.documentContent ?? "";
  const documentPath = sessionQuery.data?.document?.path;
  const toc = useMemo(() => extractHeadings(content), [content]);

  return (
    <AppShell
      variant="section"
      contentPadding={0}
      topNav={
        <TopNav>
          <TopNavHeading heading={documentPath ? fileName(documentPath) : "mdreadr"} />
          <TopNavActions>
            <Button label="Open…" variant="secondary" onClick={() => pickDocument.mutate()} />
          </TopNavActions>
        </TopNav>
      }
      sideNav={
        <SideNav>
          <SideNavSection title="Recents">
            {(recentsQuery.data ?? []).map((path: string) => (
              <SideNavItem
                key={path}
                label={fileName(path)}
                isSelected={path === documentPath}
                onClick={() => openDocument.mutate(path)}
              />
            ))}
          </SideNavSection>
        </SideNav>
      }
    >
      <ReaderLayout
        aria-label="Document reader"
        onDragOver={(event) => event.preventDefault()}
        onDrop={onDrop}
      >
        <ReaderPanel>
          {documentViewMode === "preview" ? (
            <TocSidebar entries={toc} />
          ) : (
            <EmptyState>
              <p>Table of contents is available in preview.</p>
            </EmptyState>
          )}
        </ReaderPanel>

        <ReaderMain>
          {content ? (
            <ReaderContent>
              <DocumentView
                key={documentPath}
                content={content}
                onViewModeChange={setDocumentViewMode}
                onPinBlock={(anchor) => setPendingAnchor(anchor)}
              />
            </ReaderContent>
          ) : (
            <EmptyState>
              <p>Open a markdown Document to begin reading.</p>
              <Button
                label="Open markdown…"
                variant="primary"
                onClick={() => pickDocument.mutate()}
              />
            </EmptyState>
          )}
        </ReaderMain>

        <ReaderNotesAside>
          <NotesPanel
            notes={notesQuery.data ?? []}
            pendingAnchor={pendingAnchor}
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
          />
        </ReaderNotesAside>
      </ReaderLayout>
    </AppShell>
  );
}
