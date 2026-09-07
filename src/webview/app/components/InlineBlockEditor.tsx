import { Button } from "@astryxdesign/core/Button";
import { Icon } from "@astryxdesign/core/Icon";
import type { BlockAnchor } from "@mdreadr/domain";
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
  indent,
  insertLink,
  outdent,
  type Selection,
  setHeadingLevel,
  type TextEdit,
  toggleLinePrefix,
  wrapSelection,
} from "../markdown/inline-edit-ops.ts";
import { shortcutLabel } from "../platform.ts";
import { type BlockEditError, blockEditErrorMessage } from "../session/block-edit.ts";
import { useFontSettings } from "../theme/FontSettingsContext.tsx";

type InlineBlockEditorProps = {
  anchor: BlockAnchor;
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

type Tool = {
  id: string;
  /** Accessible name, without the shortcut: the shortcut rides on the title. */
  label: string;
  shortcut?: string;
  glyph: ReactNode;
  apply: (value: string, selection: Selection) => TextEdit;
};

const FORMAT_TOOLS: Tool[] = [
  {
    id: "bold",
    label: "Bold",
    shortcut: "B",
    glyph: <span className="font-bold text-xs leading-none">B</span>,
    apply: (value, selection) => wrapSelection(value, selection, "**", "**", "bold text"),
  },
  {
    id: "italic",
    label: "Italic",
    shortcut: "I",
    glyph: <span className="font-serif text-xs italic leading-none">I</span>,
    apply: (value, selection) => wrapSelection(value, selection, "*", "*", "italic text"),
  },
  {
    id: "code",
    label: "Inline code",
    shortcut: "E",
    glyph: <Icon icon={CodeBracketIcon} size="sm" />,
    apply: (value, selection) => wrapSelection(value, selection, "`", "`", "code"),
  },
  {
    id: "strike",
    label: "Strikethrough",
    glyph: <span className="text-xs leading-none line-through">S</span>,
    apply: (value, selection) => wrapSelection(value, selection, "~~", "~~", "strikethrough"),
  },
  {
    id: "link",
    label: "Link",
    shortcut: "K",
    glyph: <Icon icon={LinkIcon} size="sm" />,
    apply: insertLink,
  },
  {
    id: "quote",
    label: "Quote",
    glyph: <Icon icon={ChatBubbleBottomCenterTextIcon} size="sm" />,
    apply: (value, selection) => toggleLinePrefix(value, selection, "> "),
  },
  {
    id: "bullet",
    label: "Bullet list",
    glyph: <Icon icon={ListBulletIcon} size="sm" />,
    apply: (value, selection) => toggleLinePrefix(value, selection, "- "),
  },
  {
    id: "ordered",
    label: "Numbered list",
    glyph: <Icon icon={QueueListIcon} size="sm" />,
    apply: (value, selection) => toggleLinePrefix(value, selection, "1. "),
  },
];

const HEADING_TOOLS: Tool[] = [1, 2, 3].map((level) => ({
  id: `heading-${level}`,
  label: `Heading ${level}`,
  glyph: <span className="font-bold text-[11px] leading-none">{`H${level}`}</span>,
  apply: (value, selection) => setHeadingLevel(value, selection, level),
}));

export function InlineBlockEditor({
  anchor,
  initialValue,
  onSave,
  onCancel,
  onDirtyChange,
}: InlineBlockEditorProps) {
  const [text, setText] = useState(initialValue);
  const [isDiscardArmed, setIsDiscardArmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const hintId = useId();
  const errorId = useId();
  const { readerFontSize, readerLineHeight } = useFontSettings();

  const isDirty = text !== initialValue;
  const isMono = isMonospaceKind(anchor.kind);
  const tools = useMemo(
    () =>
      anchor.kind === "heading" || anchor.kind === "paragraph"
        ? [...FORMAT_TOOLS, ...HEADING_TOOLS]
        : FORMAT_TOOLS,
    [anchor.kind],
  );

  // Auto-size to the content. No minimum beyond one line: a one-line paragraph
  // has to stay one line tall or entering edit shifts everything below it.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    void text;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [text]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.focus({ preventScroll: true });
    const end = el.value.length;
    el.setSelectionRange(end, end);
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
      const el = textareaRef.current;
      if (!el) return;
      el.focus({ preventScroll: true });
      el.setSelectionRange(edit.selection.start, edit.selection.end);
    });
  }, []);

  const runTool = useCallback(
    (tool: Tool) => {
      const el = textareaRef.current;
      if (!el) return;
      applyEdit(tool.apply(el.value, { start: el.selectionStart, end: el.selectionEnd }));
    },
    [applyEdit],
  );

  const handleApply = useCallback(() => {
    const applied = onSave(text);
    if (!isErr(applied)) return;
    setError(blockEditErrorMessage(applied.error));
    textareaRef.current?.focus({ preventScroll: true });
  }, [onSave, text]);

  const handleCancel = useCallback(() => {
    if (!isDirty || isDiscardArmed) {
      onCancel();
      return;
    }
    setIsDiscardArmed(true);
  }, [isDirty, isDiscardArmed, onCancel]);

  // On the section, not the textarea: Escape and the apply shortcut have to
  // work while focus sits on a toolbar button too.
  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        handleCancel();
        return;
      }

      const isMod = event.metaKey || event.ctrlKey;

      if (isMod && event.key === "Enter") {
        event.preventDefault();
        handleApply();
        return;
      }

      if (isMod && !event.altKey) {
        const key = event.key === "`" ? "E" : event.key.toUpperCase();
        const tool = tools.find((candidate) => candidate.shortcut === key);
        if (tool) {
          event.preventDefault();
          runTool(tool);
        }
        return;
      }

      // Indentation is the textarea's business; in the toolbar, Tab still moves
      // focus out of the editor, which is the only reason it is not a trap.
      if (event.key === "Tab" && event.target === textareaRef.current) {
        const el = textareaRef.current;
        if (!el) return;
        event.preventDefault();
        const selection = { start: el.selectionStart, end: el.selectionEnd };
        applyEdit(event.shiftKey ? outdent(el.value, selection) : indent(el.value, selection));
      }
    },
    [applyEdit, handleApply, handleCancel, runTool, tools],
  );

  /** Roving focus, so the whole toolbar is one Tab stop rather than eleven. */
  const handleToolbarKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (step === 0 && event.key !== "Home" && event.key !== "End") return;

    const buttons = Array.from(
      toolbarRef.current?.querySelectorAll<HTMLButtonElement>("button") ?? [],
    );
    if (buttons.length === 0) return;

    event.preventDefault();
    const from = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const target =
      event.key === "Home"
        ? buttons[0]
        : event.key === "End"
          ? buttons[buttons.length - 1]
          : buttons[(from + step + buttons.length) % buttons.length];
    target?.focus();
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
      aria-label={`Editing ${anchor.label ?? anchor.kind} source`}
      onKeyDown={handleKeyDown}
    >
      <textarea
        ref={textareaRef}
        value={text}
        onChange={(event) => {
          setText(event.target.value);
          setIsDiscardArmed(false);
        }}
        rows={1}
        className="reader-block-edit-input"
        placeholder="Markdown source"
        style={sourceStyle}
        spellCheck={!isMono}
        aria-label={`${anchor.kind} source`}
        aria-describedby={error ? `${hintId} ${errorId}` : hintId}
        aria-invalid={error !== null}
        aria-keyshortcuts="Meta+Enter Control+Enter Escape"
      />

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
              {tool.glyph}
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
