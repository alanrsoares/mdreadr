import type { CreateNoteRequest, DocumentRef, Note, NoteStatus, Suggestion } from "@mdreadr/domain";
import { type UseQueryResult, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect } from "react";
import { pathFileName } from "../components/path-display.ts";
import { useMutationToast } from "../hooks/useMutationToast.ts";
import type { ReaderApi, SessionSnapshot, TabSummary, TabsResult } from "./reader-api.ts";
import {
  loadNotesFlow,
  pickDocumentFlow,
  type SaveDroppedDocumentInput,
  saveDroppedDocumentFlow,
  saveNotesFlow,
} from "./reader-flows.ts";

type AddReplyMutationInput = { noteId: string; body: string };
type SetNoteStatusMutationInput = { noteId: string; status: NoteStatus };
type SetSuggestionStatusMutationInput = { suggestionId: string; status: "accepted" | "rejected" };
type SaveDocumentMutationInput = { path: string; content: string };

export type ReaderSessionCallbacks = {
  onNoteCreated?: () => void;
  onReplyAdded?: () => void;
  onStatusChanged?: (status: NoteStatus | undefined) => void;
  onNotesSaved?: () => void;
  onDocumentSaved?: () => void;
  onSuggestionStatusChanged?: (suggestion: Suggestion) => void;
};

export type ReaderSession = {
  session: UseQueryResult<SessionSnapshot>;
  notes: UseQueryResult<Note[]>;
  suggestions: UseQueryResult<Suggestion[]>;
  createNote: (input: CreateNoteRequest) => Promise<void>;
  addReply: (noteId: string, body: string) => Promise<void>;
  setStatus: (noteId: string, status: NoteStatus) => Promise<void>;
  setSuggestionStatus: (suggestionId: string, status: "accepted" | "rejected") => Promise<void>;
  save: () => Promise<void>;
  saveDocument: (path: string, content: string) => Promise<void>;
  isSaving: boolean;
  isCreatingNote: boolean;
  isSavingDocument: boolean;
};

/**
 * Per-tab data: scoped by `tabId` and gated by `isActive` so an inactive,
 * keep-alive-rendered tab never fetches-and-caches the *active* tab's data
 * under its own (inactive) query key — the server always answers `getSession`
 * etc. for whichever tab is active server-side, regardless of which
 * `tabId`-scoped hook instance is asking.
 */
export function useReaderSession(
  readerApi: ReaderApi,
  tabId: string | null,
  isActive: boolean,
  callbacks: ReaderSessionCallbacks = {},
): ReaderSession {
  const queryClient = useQueryClient();
  const { showError, showSuccess } = useMutationToast();

  const session = useQuery({
    queryKey: ["session", tabId],
    queryFn: () => readerApi.getSession(),
    enabled: isActive,
  });

  const notes = useQuery({
    queryKey: ["notes", tabId],
    queryFn: () => readerApi.getNotes(),
    enabled: isActive,
  });

  const suggestions = useQuery({
    queryKey: ["suggestions", tabId],
    queryFn: () => readerApi.getSuggestions(),
    enabled: isActive,
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

  const invalidateNotes = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["notes"] });
  }, [queryClient]);

  const invalidateSuggestions = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["suggestions"] });
  }, [queryClient]);

  const createNoteMutation = useMutation({
    mutationFn: (input: CreateNoteRequest) => readerApi.createNote(input),
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
    mutationFn: (input: AddReplyMutationInput) => readerApi.addReply(input.noteId, input.body),
    onSuccess: () => {
      invalidateNotes();
      callbacks.onReplyAdded?.();
    },
    onError: (error) => {
      showError("Add reply", error);
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: (input: SetNoteStatusMutationInput) =>
      readerApi.setNoteStatus(input.noteId, input.status),
    onSuccess: (note) => {
      invalidateNotes();
      callbacks.onStatusChanged?.(note?.status);
    },
    onError: (error) => {
      showError("Update note status", error);
    },
  });

  const setSuggestionStatusMutation = useMutation({
    mutationFn: (input: SetSuggestionStatusMutationInput) =>
      readerApi.setSuggestionStatus(input.suggestionId, input.status),
    onSuccess: (suggestion) => {
      invalidateSuggestions();
      callbacks.onSuggestionStatusChanged?.(suggestion);
    },
    onError: (error) => {
      showError("Update suggestion", error);
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
    mutationFn: (input: SaveDocumentMutationInput) =>
      readerApi.saveDocument(input.path, input.content),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["session", tabId] });
      callbacks.onDocumentSaved?.();
    },
    onError: (error) => {
      showError("Save document", error);
    },
  });

  return {
    session,
    notes,
    suggestions,
    createNote: async (input) => {
      await createNoteMutation.mutateAsync(input);
    },
    addReply: async (noteId, body) => {
      await addReplyMutation.mutateAsync({ noteId, body });
    },
    setStatus: async (noteId, status) => {
      await updateStatusMutation.mutateAsync({ noteId, status });
    },
    setSuggestionStatus: async (suggestionId, status) => {
      await setSuggestionStatusMutation.mutateAsync({ suggestionId, status });
    },
    save: async () => {
      await saveNotesMutation.mutateAsync();
    },
    saveDocument: async (path, content) => {
      await saveDocumentMutation.mutateAsync({ path, content });
    },
    isSaving: saveNotesMutation.isPending,
    isCreatingNote: createNoteMutation.isPending,
    isSavingDocument: saveDocumentMutation.isPending,
  };
}

export type DocumentTabsCallbacks = {
  onOpened?: (path: string) => void;
  onNotesLoaded?: () => void;
  onSaved?: () => void;
};

export type DocumentTabs = {
  tabs: TabSummary[];
  activeId: string | null;
  activeDocument: DocumentRef | null;
  homeDirectory: string | undefined;
  recents: string[];
  activateTab: (id: string) => void;
  closeTab: (id: string) => void;
  open: (path: string) => void;
  pick: () => void;
  saveDropped: (input: SaveDroppedDocumentInput) => void;
  load: () => Promise<void>;
  refresh: () => void;
  isOpening: boolean;
  /** Path of the document currently being opened, for per-item pending affordances. */
  openingPath: string | null;
  isSavingDropped: boolean;
  isLoadingNotes: boolean;
};

/**
 * Shell-level: tab list, recents, and every action that opens-or-activates a
 * (possibly different) tab. `activeId` is server-authoritative — the client
 * never tracks its own "which tab is active" boolean.
 *
 * `activeDocument`/`homeDirectory` come from a `["session", activeId]` query
 * using the exact same key a `useReaderSession(readerApi, activeId, true)`
 * call makes for that same tab — TanStack Query dedupes by key, so this is
 * one shared cache entry, not a second fetch, letting the shell read the
 * active tab's snapshot for the TopNav heading / RecentsSidebar without
 * prop-drilling up from that tab's own component.
 */
export function useDocumentTabs(
  readerApi: ReaderApi,
  callbacks: DocumentTabsCallbacks = {},
): DocumentTabs {
  const queryClient = useQueryClient();
  const { showError, showSuccess } = useMutationToast();

  const tabsQuery = useQuery({
    queryKey: ["tabs"],
    queryFn: () => readerApi.getTabs(),
  });
  const activeId = tabsQuery.data?.activeId ?? null;

  const recentsQuery = useQuery({
    queryKey: ["recents"],
    queryFn: () => readerApi.getRecents(),
  });

  const activeSessionQuery = useQuery({
    queryKey: ["session", activeId],
    queryFn: () => readerApi.getSession(),
    enabled: activeId != null,
  });

  const invalidateTabs = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["tabs"] });
  }, [queryClient]);

  const invalidateRecents = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["recents"] });
  }, [queryClient]);

  const invalidateSession = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["session"] });
  }, [queryClient]);

  const invalidateAfterTabChange = useCallback(() => {
    invalidateTabs();
    invalidateSession();
    void queryClient.invalidateQueries({ queryKey: ["notes"] });
    void queryClient.invalidateQueries({ queryKey: ["suggestions"] });
  }, [invalidateTabs, invalidateSession, queryClient]);

  // Tab switch/close are pure in-memory work server-side, so the only real cost
  // is the round trip. Both mutations therefore paint optimistically and then
  // seed the cache from the response the server already sent back, instead of
  // invalidating `["tabs"]` and paying a second round trip before the UI moves.
  const activateTabMutation = useMutation({
    mutationFn: (id: string) => readerApi.activateTab(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["tabs"] });
      const previousTabs = queryClient.getQueryData<TabsResult>(["tabs"]);
      if (previousTabs) {
        queryClient.setQueryData<TabsResult>(["tabs"], { ...previousTabs, activeId: id });
      }
      return { previousTabs };
    },
    onSuccess: (snapshot, id) => {
      // The activate response *is* the newly active tab's snapshot — seeding it
      // (plus its notes/suggestions, which ride along) means the tab renders
      // populated on first paint rather than after three more fetches.
      queryClient.setQueryData<SessionSnapshot>(["session", id], snapshot);
      queryClient.setQueryData<Note[]>(["notes", id], snapshot.notes);
      queryClient.setQueryData<Suggestion[]>(["suggestions", id], snapshot.suggestions);
    },
    onError: (error, _id, context) => {
      if (context?.previousTabs) queryClient.setQueryData(["tabs"], context.previousTabs);
      invalidateTabs();
      showError("Switch tab", error);
    },
  });

  const closeTabMutation = useMutation({
    mutationFn: (id: string) => readerApi.closeTab(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["tabs"] });
      const previousTabs = queryClient.getQueryData<TabsResult>(["tabs"]);
      if (previousTabs) {
        const tabs = previousTabs.tabs.filter((tab) => tab.id !== id);
        queryClient.setQueryData<TabsResult>(["tabs"], {
          tabs,
          // Mirrors the server's fallback: closing the active tab hands focus to
          // the first tab still open (SessionStore.closeTab).
          activeId: previousTabs.activeId === id ? (tabs[0]?.id ?? null) : previousTabs.activeId,
        });
      }
      return { previousTabs };
    },
    onSuccess: (result, id) => {
      queryClient.setQueryData<TabsResult>(["tabs"], result);
      queryClient.removeQueries({ queryKey: ["session", id] });
      queryClient.removeQueries({ queryKey: ["notes", id] });
      queryClient.removeQueries({ queryKey: ["suggestions", id] });
      // The tab that inherits focus still needs its own data fetched.
      invalidateSession();
      void queryClient.invalidateQueries({ queryKey: ["notes"] });
      void queryClient.invalidateQueries({ queryKey: ["suggestions"] });
    },
    onError: (error, _id, context) => {
      if (context?.previousTabs) queryClient.setQueryData(["tabs"], context.previousTabs);
      invalidateTabs();
      showError("Close tab", error);
    },
  });

  const openDocumentMutation = useMutation({
    mutationFn: (path: string) => readerApi.openDocument(path),
    onSuccess: (result, path) => {
      // The open response already carries the new tab list and the opened tab's
      // notes/suggestions, so seed them instead of invalidating — otherwise the
      // document the server just sent us gets fetched a second time before the
      // reader paints anything.
      queryClient.setQueryData<TabsResult>(["tabs"], {
        tabs: result.tabs,
        activeId: result.activeId,
      });
      if (result.activeId) {
        const opened = result.tabs.find((tab) => tab.id === result.activeId);
        queryClient.setQueryData<SessionSnapshot>(["session", result.activeId], {
          document: opened?.document ?? null,
          documentContent: result.content,
          notes: result.notes,
          suggestions: result.suggestions,
          homeDirectory: result.homeDirectory,
        });
        queryClient.setQueryData<Note[]>(["notes", result.activeId], result.notes);
        queryClient.setQueryData<Suggestion[]>(
          ["suggestions", result.activeId],
          result.suggestions,
        );
      }
      invalidateRecents();
      // File name only: the full path is already in the top nav, and a long
      // absolute path wraps the toast over the notes column.
      showSuccess(`Opened ${pathFileName(path)}`);
      callbacks.onOpened?.(path);
    },
    onError: (error) => {
      showError("Open document", error);
    },
  });

  const pickDocumentMutation = useMutation({
    mutationFn: () => pickDocumentFlow(readerApi),
    onSuccess: (path) => {
      if (path) openDocumentMutation.mutate(path);
    },
    onError: (error) => {
      showError("Pick document", error);
    },
  });

  const saveDroppedDocumentMutation = useMutation({
    mutationFn: (input: SaveDroppedDocumentInput) => saveDroppedDocumentFlow(readerApi, input),
    onSuccess: (outcome) => {
      if (outcome.kind !== "saved") return;
      invalidateAfterTabChange();
      invalidateRecents();
      showSuccess("Document saved");
      callbacks.onSaved?.();
    },
    onError: (error) => {
      showError("Save dropped file", error);
    },
  });

  const loadNotesMutation = useMutation({
    mutationFn: () => loadNotesFlow(readerApi),
    onSuccess: (outcome) => {
      if (outcome.kind !== "loaded") return;
      invalidateAfterTabChange();
      showSuccess("Notes loaded");
      callbacks.onNotesLoaded?.();
    },
    onError: (error) => {
      showError("Load notes", error);
    },
  });

  return {
    tabs: tabsQuery.data?.tabs ?? [],
    activeId,
    activeDocument: activeSessionQuery.data?.document ?? null,
    homeDirectory: activeSessionQuery.data?.homeDirectory,
    recents: recentsQuery.data ?? [],
    activateTab: (id) => {
      activateTabMutation.mutate(id);
    },
    closeTab: (id) => {
      closeTabMutation.mutate(id);
    },
    open: (path) => {
      openDocumentMutation.mutate(path);
    },
    pick: () => {
      pickDocumentMutation.mutate();
    },
    saveDropped: (input) => {
      saveDroppedDocumentMutation.mutate(input);
    },
    load: async () => {
      await loadNotesMutation.mutateAsync();
    },
    refresh: () => {
      invalidateTabs();
      invalidateSession();
      invalidateRecents();
      void queryClient.invalidateQueries({ queryKey: ["notes"] });
      void queryClient.invalidateQueries({ queryKey: ["suggestions"] });
    },
    isOpening: pickDocumentMutation.isPending || openDocumentMutation.isPending,
    openingPath: openDocumentMutation.isPending ? (openDocumentMutation.variables ?? null) : null,
    isSavingDropped: saveDroppedDocumentMutation.isPending,
    isLoadingNotes: loadNotesMutation.isPending,
  };
}
