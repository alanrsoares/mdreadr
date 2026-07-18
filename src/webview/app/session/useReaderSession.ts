import type { BlockAnchor, Note, NoteKind, NoteStatus } from "@mdreadr/domain";
import { type UseQueryResult, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect } from "react";
import { formatDisplayPath } from "../components/path-display.ts";
import { useMutationToast } from "../hooks/useMutationToast.ts";
import type { ReaderApi, SessionSnapshot } from "./reader-api.ts";
import { loadNotesFlow, pickDocumentFlow, saveNotesFlow } from "./reader-flows.ts";

export type ReaderSessionCallbacks = {
  onOpened?: (path: string) => void;
  onNoteCreated?: () => void;
  onReplyAdded?: () => void;
  onStatusChanged?: (status: NoteStatus | undefined) => void;
  onNotesSaved?: () => void;
  onNotesLoaded?: () => void;
  onDocumentSaved?: () => void;
};

export type ReaderSession = {
  session: UseQueryResult<SessionSnapshot>;
  recents: UseQueryResult<string[]>;
  notes: UseQueryResult<Note[]>;
  open: (path: string) => void;
  pick: () => void;
  createNote: (input: { anchor: BlockAnchor; body: string; kind?: NoteKind }) => Promise<void>;
  addReply: (noteId: string, body: string) => Promise<void>;
  setStatus: (noteId: string, status: NoteStatus) => Promise<void>;
  save: () => Promise<void>;
  load: () => Promise<void>;
  saveDocument: (path: string, content: string) => Promise<void>;
  refresh: () => void;
  isOpening: boolean;
  isSaving: boolean;
  isLoadingNotes: boolean;
  isCreatingNote: boolean;
  isSavingDocument: boolean;
};

export function useReaderSession(
  readerApi: ReaderApi,
  callbacks: ReaderSessionCallbacks = {},
): ReaderSession {
  const queryClient = useQueryClient();
  const { showError, showSuccess } = useMutationToast();

  const session = useQuery({
    queryKey: ["session"],
    queryFn: () => readerApi.getSession(),
  });

  const recents = useQuery({
    queryKey: ["recents"],
    queryFn: () => readerApi.getRecents(),
  });

  const notes = useQuery({
    queryKey: ["notes"],
    queryFn: () => readerApi.getNotes(),
  });

  useEffect(() => {
    if (session.isError) {
      showError("Load session", session.error);
    }
  }, [session.error, session.isError, showError]);

  useEffect(() => {
    if (notes.isError) {
      showError("Load notes", notes.error);
    }
  }, [notes.error, notes.isError, showError]);

  const invalidateSession = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["session"] });
  }, [queryClient]);

  const invalidateRecents = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["recents"] });
  }, [queryClient]);

  const invalidateNotes = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["notes"] });
  }, [queryClient]);

  const openDocumentMutation = useMutation({
    mutationFn: (path: string) => readerApi.openDocument(path),
    onSuccess: (_data, path) => {
      invalidateSession();
      invalidateRecents();
      const homeDirectory = queryClient.getQueryData<SessionSnapshot>(["session"])?.homeDirectory;
      showSuccess(`Opened ${formatDisplayPath(path, homeDirectory)}`);
      callbacks.onOpened?.(path);
    },
    onError: (error) => {
      showError("Open document", error);
    },
  });

  const pickDocumentMutation = useMutation({
    mutationFn: () => pickDocumentFlow(readerApi),
    onSuccess: (path) => {
      if (path) {
        openDocumentMutation.mutate(path);
      }
    },
    onError: (error) => {
      showError("Pick file", error);
    },
  });

  const createNoteMutation = useMutation({
    mutationFn: (input: { anchor: BlockAnchor; body: string; kind?: NoteKind }) =>
      readerApi.createNote(input),
    onSuccess: () => {
      invalidateNotes();
      showSuccess("Note added");
      callbacks.onNoteCreated?.();
    },
    onError: (error) => {
      showError("Add note", error);
    },
  });

  const addReplyMutation = useMutation({
    mutationFn: (input: { noteId: string; body: string }) =>
      readerApi.addReply(input.noteId, input.body),
    onSuccess: () => {
      invalidateNotes();
      callbacks.onReplyAdded?.();
    },
    onError: (error) => {
      showError("Add reply", error);
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: (input: { noteId: string; status: NoteStatus }) =>
      readerApi.setNoteStatus(input.noteId, input.status),
    onSuccess: (note) => {
      invalidateNotes();
      callbacks.onStatusChanged?.(note?.status);
    },
    onError: (error) => {
      showError("Update note status", error);
    },
  });

  const saveNotesMutation = useMutation({
    mutationFn: () =>
      saveNotesFlow(readerApi, {
        notes: notes.data ?? [],
        document: session.data?.document ?? undefined,
      }),
    onSuccess: (outcome) => {
      if (outcome.kind !== "saved") return;
      showSuccess("Notes saved");
      callbacks.onNotesSaved?.();
    },
    onError: (error) => {
      showError("Save notes", error);
    },
  });

  const saveDocumentMutation = useMutation({
    mutationFn: (input: { path: string; content: string }) =>
      readerApi.saveDocument(input.path, input.content),
    onSuccess: () => {
      invalidateSession();
      showSuccess("Document saved");
      callbacks.onDocumentSaved?.();
    },
    onError: (error) => {
      showError("Save document", error);
    },
  });

  const loadNotesMutation = useMutation({
    mutationFn: () => loadNotesFlow(readerApi),
    onSuccess: (outcome) => {
      if (outcome.kind !== "loaded") return;
      if (outcome.documentPath) {
        openDocumentMutation.mutate(outcome.documentPath);
      }
      invalidateNotes();
      invalidateSession();
      showSuccess("Notes loaded");
      callbacks.onNotesLoaded?.();
    },
    onError: (error) => {
      showError("Load notes", error);
    },
  });

  return {
    session,
    recents,
    notes,
    open: (path) => openDocumentMutation.mutate(path),
    pick: () => pickDocumentMutation.mutate(),
    createNote: async (input) => {
      await createNoteMutation.mutateAsync(input);
    },
    addReply: async (noteId, body) => {
      await addReplyMutation.mutateAsync({ noteId, body });
    },
    setStatus: async (noteId, status) => {
      await updateStatusMutation.mutateAsync({ noteId, status });
    },
    save: async () => {
      await saveNotesMutation.mutateAsync();
    },
    load: async () => {
      await loadNotesMutation.mutateAsync();
    },
    saveDocument: async (path, content) => {
      await saveDocumentMutation.mutateAsync({ path, content });
    },
    refresh: () => {
      invalidateSession();
      invalidateNotes();
    },
    isOpening: pickDocumentMutation.isPending || openDocumentMutation.isPending,
    isSaving: saveNotesMutation.isPending,
    isLoadingNotes: loadNotesMutation.isPending,
    isCreatingNote: createNoteMutation.isPending,
    isSavingDocument: saveDocumentMutation.isPending,
  };
}
