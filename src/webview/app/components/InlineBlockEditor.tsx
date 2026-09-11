import { Button } from "@astryxdesign/core/Button";
import { Icon } from "@astryxdesign/core/Icon";
import type { BlockAnchor, SubBlockTarget } from "@mdreadr/domain";
import { match } from "@onrails/pattern";
import { isErr, type Result } from "@onrails/result";
import {
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ChatBubbleBottomCenterTextIcon,
  CodeBracketIcon,
  LinkIcon,
  ListBulletIcon,
  QueueListIcon,
} from "../icons.ts";
import {
  closesTheEditor,
  type EditorIntent,
  type EditorTool,
  type EditorToolId,
  editorIntent,
  type Keystroke,
  nextToolIndex,
  swallowsKeystroke,
  toolsFor,
} from "../markdown/inline-edit-keys.ts";
import { indent, outdent, type Selection, type TextEdit } from "../markdown/inline-edit-ops.ts";
import { subBlockNoun } from "../markdown/sub-blocks.ts";
import { shortcutLabel } from "../platform.ts";
import { type BlockEditError, blockEditErrorMessage } from "../session/inline-edit.ts";
import { useFontSettings } from "../theme/FontSettingsContext.tsx";
import { SourceEditor, type SourceEditorHandle } from "./SourceEditor.tsx";

type InlineBlockEditorProps = {
  anchor: BlockAnchor;
  /** Set when the editor holds one part of the block (a list item, a table
   *  row) rather than all of it, so it says which. */
  subKind?: SubBlockTarget["kind"];
  initialValue: string;
  /** Applies the edit. An `Err` keeps the editor open with the text in it and
   *  states the reason, since at that point it is the only copy. */
  onSave: (newMarkdown: string) => Result<void, BlockEditError>;
  onCancel: () => void;
  onDirtyChange?: (isDirty: boolean) => void;
};

/** Source typography per block kind. Prose and headings keep the reader's own
 *  family, size and leading so the first glyph does not move when the rendered
 *  block is swapped for its source; code and tables are already monospace. */
const SOURCE_TYPOGRAPHY: Record<"heading" | "mono", CSSProperties> = {
  heading: {
    fontFamily: "var(--reader-heading-family, var(--font-family-heading, inherit))",
    fontSize: "1.35em",
    fontWeight: 600,
    lineHeight: 1.35,
  },
  mono: {
    fontFamily: "var(--font-family-code, monospace)",
    fontSize: "var(--text-code-size, 0.9em)",
    lineHeight: 1.5,
  },
};

const isMonospaceKind = (kind: BlockAnchor["kind"]): boolean => kind === "code" || kind === "table";

/** The heading level, read off the source's own `#` run. `.reader-flow` gives a
 *  rendered heading its top gap by tag name, and the editor is a `section`, so
 *  the CSS needs the level to reproduce that gap and hold the block still. */
const headingLevelOf = (source: string): string | undefined => {
  const hashes = /^(#{1,6})\s/.exec(source);
  return hashes ? String(hashes[1]?.length) : undefined;
};

/** How long the "press Escape again" arming lasts before it forgets. */
const DISCARD_ARM_MS = 4_000;

/** The Cancel button is the Escape key with a mouse behind it. */
const ESCAPE: Keystroke = {
  key: "Escape",
  hasMod: false,
  hasAlt: false,
  hasShift: false,
  isInSource: false,
};

/** What each tool is drawn as. Kept here rather than beside the transform it
 *  runs: the keyboard contract in `inline-edit-keys.ts` has no use for a node. */
const TOOL_GLYPHS: Record<EditorToolId, ReactNode> = {
  bold: <span className="font-bold text-xs leading-none">B</span>,
  italic: <span className="font-serif text-xs italic leading-none">I</span>,
  code: <Icon icon={CodeBracketIcon} size="sm" />,
  strike: <span className="text-xs leading-none line-through">S</span>,
  link: <Icon icon={LinkIcon} size="sm" />,
  quote: <Icon icon={ChatBubbleBottomCenterTextIcon} size="sm" />,
  bullet: <Icon icon={ListBulletIcon} size="sm" />,
  ordered: <Icon icon={QueueListIcon} size="sm" />,
  "heading-1": <span className="font-bold text-[11px] leading-none">H1</span>,
  "heading-2": <span className="font-bold text-[11px] leading-none">H2</span>,
  "heading-3": <span className="font-bold text-[11px] leading-none">H3</span>,
};

export function InlineBlockEditor({
  anchor,
  subKind,
  initialValue,
  onSave,
  onCancel,
  onDirtyChange,
}: InlineBlockEditorProps) {
  const [text, setText] = useState(initialValue);
  const [prevInitialValue, setPrevInitialValue] = useState(initialValue);
  if (initialValue !== prevInitialValue) {
    setPrevInitialValue(initialValue);
    if (text === prevInitialValue) {
      setText(initialValue);
    }
  }
  const [isDiscardArmed, setIsDiscardArmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const editorRef = useRef<SourceEditorHandle>(null);
  const editorDomRef = useRef<HTMLElement | null>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const hintId = useId();
  const errorId = useId();
  const { readerFontSize, readerLineHeight } = useFontSettings();

  const isDirty = text !== initialValue;
  const isMono = isMonospaceKind(anchor.kind);
  /** What the editor is holding: the block, or one part of it. */
  const subject = subKind ? subBlockNoun(subKind) : (anchor.label ?? anchor.kind);
  const tools = useMemo(() => toolsFor(anchor.kind), [anchor.kind]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    const end = editor.getValue().length;
    editor.setSelection({ start: end, end });
  }, []);

  useEffect(() => {
    onDirtyChange?.(isDirty);
    return () => onDirtyChange?.(false);
  }, [isDirty, onDirtyChange]);

  // The arming forgets itself, so an Escape minutes later is not read as the
  // second half of a discard the user has long stopped thinking about.
  useEffect(() => {
    if (!isDiscardArmed) return;
    const timer = window.setTimeout(() => setIsDiscardArmed(false), DISCARD_ARM_MS);
    return () => window.clearTimeout(timer);
  }, [isDiscardArmed]);

  const applyEdit = useCallback((edit: TextEdit) => {
    setText(edit.text);
    setIsDiscardArmed(false);
    setError(null);
    window.requestAnimationFrame(() => {
      const editor = editorRef.current;
      if (!editor) return;
      editor.focus();
      editor.setSelection(edit.selection);
    });
  }, []);

  const runTool = useCallback(
    (tool: EditorTool) => {
      const editor = editorRef.current;
      if (!editor) return;
      applyEdit(tool.apply(editor.getValue(), editor.getSelection()));
    },
    [applyEdit],
  );

  const handleApply = useCallback(() => {
    const applied = onSave(text);
    if (!isErr(applied)) return;
    setError(blockEditErrorMessage(applied.error));
    editorRef.current?.focus();
  }, [onSave, text]);

  const reindent = useCallback(
    (op: (value: string, selection: Selection) => TextEdit) => {
      const editor = editorRef.current;
      if (!editor) return;
      applyEdit(op(editor.getValue(), editor.getSelection()));
    },
    [applyEdit],
  );

  /** The one place an intent becomes an effect. A new keystroke is a branch in
   *  `editorIntent` and a branch here, and nothing anywhere else. */
  const dispatch = useCallback(
    (intent: EditorIntent): void =>
      match(intent)
        .returnType<void>()
        .with({ kind: "apply" }, handleApply)
        .with({ kind: "cancel" }, onCancel)
        .with({ kind: "armDiscard" }, () => setIsDiscardArmed(true))
        .with({ kind: "tool" }, ({ tool }) => runTool(tool))
        .with({ kind: "indent" }, () => reindent(indent))
        .with({ kind: "outdent" }, () => reindent(outdent))
        .with({ kind: "none" }, () => undefined)
        .exhaustive(),
    [handleApply, onCancel, reindent, runTool],
  );

  /** The Cancel button asks the same question a keystroke does, so it goes
   *  through the same contract rather than repeating its two-press rule. */
  const handleCancel = useCallback(() => {
    dispatch(editorIntent(ESCAPE, { kind: anchor.kind, isDirty, isDiscardArmed }));
  }, [anchor.kind, dispatch, isDirty, isDiscardArmed]);

  // Bound to the section rather than the source: Escape and the apply shortcut
  // have to work while focus sits on a toolbar button too.
  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      // `event.target` is CodeMirror's contenteditable, not the section, so
      // where the keystroke came from is a containment test, not identity.
      const isInSource =
        event.target instanceof Node && editorDomRef.current?.contains(event.target) === true;

      const intent = editorIntent(
        {
          key: event.key,
          hasMod: event.metaKey || event.ctrlKey,
          hasAlt: event.altKey,
          hasShift: event.shiftKey,
          isInSource,
        },
        { kind: anchor.kind, isDirty, isDiscardArmed },
      );

      if (swallowsKeystroke(intent)) event.preventDefault();
      if (closesTheEditor(intent)) event.stopPropagation();
      dispatch(intent);
    },
    [anchor.kind, dispatch, isDirty, isDiscardArmed],
  );

  /** Roving focus, so the whole toolbar is one Tab stop rather than eleven. */
  const handleToolbarKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    const buttons = Array.from(
      toolbarRef.current?.querySelectorAll<HTMLButtonElement>("button") ?? [],
    );
    const next = nextToolIndex(
      event.key,
      buttons.indexOf(document.activeElement as HTMLButtonElement),
      buttons.length,
    );
    if (next === undefined) return;

    event.preventDefault();
    buttons[next]?.focus();
  }, []);

  const sourceStyle = useMemo(
    (): CSSProperties =>
      match(anchor.kind)
        .with("heading", () => SOURCE_TYPOGRAPHY.heading)
        .with("code", () => SOURCE_TYPOGRAPHY.mono)
        .with("table", () => SOURCE_TYPOGRAPHY.mono)
        .otherwise(() => ({
          fontFamily: "var(--reader-prose-family, inherit)",
          fontSize: `${readerFontSize}px`,
          lineHeight: readerLineHeight,
        })),
    [anchor.kind, readerFontSize, readerLineHeight],
  );

  const hint = isDiscardArmed
    ? "Escape again to discard your changes"
    : `${shortcutLabel("Enter")} to apply, Escape to ${isDirty ? "discard" : "close"}`;

  return (
    <section
      className="reader-block-edit"
      data-kind={anchor.kind}
      data-level={anchor.kind === "heading" ? headingLevelOf(initialValue) : undefined}
      data-measure={isMono ? "full" : "capped"}
      aria-label={`Editing ${subject} source`}
      onKeyDown={handleKeyDown}
    >
      <div
        className="reader-block-edit-input"
        aria-describedby={error ? `${hintId} ${errorId}` : hintId}
      >
        <SourceEditor
          ref={editorRef}
          value={text}
          onChange={(next) => {
            setText(next);
            setIsDiscardArmed(false);
          }}
          sizing="content"
          typography={sourceStyle}
          hasSpellCheck={!isMono}
          ariaLabel={`${subKind ? subBlockNoun(subKind) : anchor.kind} source`}
          onCreateEditor={(view) => {
            editorDomRef.current = view.dom;
            view.contentDOM.setAttribute("aria-keyshortcuts", "Meta+Enter Control+Enter Escape");
          }}
        />
      </div>

      <div className="reader-block-edit-chrome">
        <div
          ref={toolbarRef}
          className="reader-block-edit-tools"
          role="toolbar"
          aria-label="Markdown formatting"
          onKeyDown={handleToolbarKeyDown}
        >
          {tools.map((tool, index) => (
            <button
              key={tool.id}
              type="button"
              className="reader-block-edit-tool"
              // The toolbar is one Tab stop; arrow keys move within it.
              tabIndex={index === 0 ? 0 : -1}
              aria-label={tool.label}
              title={tool.shortcut ? `${tool.label} (${shortcutLabel(tool.shortcut)})` : tool.label}
              // Keeps the textarea's selection alive through the click, so the
              // tool acts on what the user had selected.
              onMouseDown={(event: MouseEvent) => event.preventDefault()}
              onClick={() => runTool(tool)}
            >
              {TOOL_GLYPHS[tool.id]}
            </button>
          ))}
        </div>

        <p
          id={hintId}
          className="reader-block-edit-hint"
          data-armed={isDiscardArmed ? "true" : undefined}
          role={isDiscardArmed ? "status" : undefined}
        >
          {hint}
        </p>

        <div className="reader-block-edit-actions">
          <Button label="Cancel" variant="secondary" size="sm" onClick={handleCancel} />
          {/* Dimmed until there is a diff, like Edit mode's Save. */}
          <Button
            label="Apply"
            variant="primary"
            size="sm"
            isDisabled={!isDirty}
            onClick={handleApply}
          />
        </div>
      </div>

      {error ? (
        <p id={errorId} className="reader-block-edit-error" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
