import { Button } from "@astryxdesign/core/Button";
import { HStack } from "@astryxdesign/core/HStack";
import { Icon } from "@astryxdesign/core/Icon";
import { Text } from "@astryxdesign/core/Text";
import type { BlockAnchor } from "@mdreadr/domain";
import {
  type KeyboardEvent,
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
import { useFontSettings } from "../theme/FontSettingsContext.tsx";

type InlineBlockEditorProps = {
  anchor: BlockAnchor;
  initialValue: string;
  onSave: (newMarkdown: string) => void;
  onCancel: () => void;
};

type SelectionRange = {
  start: number;
  end: number;
};

export function InlineBlockEditor({
  anchor,
  initialValue,
  onSave,
  onCancel,
}: InlineBlockEditorProps) {
  const [text, setText] = useState(initialValue);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const editorId = useId();
  const { readerFontSize, readerLineHeight } = useFontSettings();

  // Auto-resize textarea to fit content
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    void text;
    el.style.height = "auto";
    el.style.height = `${Math.max(64, el.scrollHeight)}px`;
  }, [text]);

  // Focus textarea on mount and scroll into view smoothly if needed
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.focus();
    const len = el.value.length;
    el.setSelectionRange(len, len);
    el.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, []);

  const stats = useMemo(() => {
    const trimmed = text.trim();
    const words = trimmed ? trimmed.split(/\s+/).length : 0;
    const chars = text.length;
    return { words, chars };
  }, [text]);

  const setContentWithSelection = useCallback((nextText: string, range: SelectionRange) => {
    setText(nextText);
    window.requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(range.start, range.end);
      }
    });
  }, []);

  const wrapSelection = useCallback(
    (before: string, after = before, defaultPlaceholder = "text") => {
      const el = textareaRef.current;
      if (!el) return;

      const start = el.selectionStart;
      const end = el.selectionEnd;
      const val = el.value;
      const selected = val.slice(start, end);

      if (selected.length > 0) {
        // Toggle off if already wrapped
        const beforeLen = before.length;
        const afterLen = after.length;
        if (
          start >= beforeLen &&
          val.slice(start - beforeLen, start) === before &&
          val.slice(end, end + afterLen) === after
        ) {
          const unwrapped = val.slice(0, start - beforeLen) + selected + val.slice(end + afterLen);
          setContentWithSelection(unwrapped, {
            start: start - beforeLen,
            end: end - beforeLen,
          });
          return;
        }

        const wrapped = val.slice(0, start) + before + selected + after + val.slice(end);
        setContentWithSelection(wrapped, {
          start: start + beforeLen,
          end: end + beforeLen,
        });
        return;
      }

      const inserted = val.slice(0, start) + before + defaultPlaceholder + after + val.slice(end);
      setContentWithSelection(inserted, {
        start: start + before.length,
        end: start + before.length + defaultPlaceholder.length,
      });
    },
    [setContentWithSelection],
  );

  const toggleLinePrefix = useCallback(
    (prefix: string) => {
      const el = textareaRef.current;
      if (!el) return;

      const start = el.selectionStart;
      const val = el.value;
      const lineStart = val.lastIndexOf("\n", start - 1) + 1;
      const lineEnd = val.indexOf("\n", start);
      const effectiveEnd = lineEnd === -1 ? val.length : lineEnd;
      const line = val.slice(lineStart, effectiveEnd);

      if (line.startsWith(prefix)) {
        const nextVal =
          val.slice(0, lineStart) + line.slice(prefix.length) + val.slice(effectiveEnd);
        const newCursor = Math.max(lineStart, start - prefix.length);
        setContentWithSelection(nextVal, { start: newCursor, end: newCursor });
      } else {
        const nextVal = val.slice(0, lineStart) + prefix + line + val.slice(effectiveEnd);
        const newCursor = start + prefix.length;
        setContentWithSelection(nextVal, { start: newCursor, end: newCursor });
      }
    },
    [setContentWithSelection],
  );

  const setHeadingLevel = useCallback(
    (level: number) => {
      const el = textareaRef.current;
      if (!el) return;

      const start = el.selectionStart;
      const val = el.value;
      const lineStart = val.lastIndexOf("\n", start - 1) + 1;
      const lineEnd = val.indexOf("\n", start);
      const effectiveEnd = lineEnd === -1 ? val.length : lineEnd;
      const line = val.slice(lineStart, effectiveEnd);

      const prefix = `${"#".repeat(level)} `;
      const stripped = line.replace(/^#{1,6}\s+/, "");
      const nextLine = `${prefix}${stripped}`;
      const nextVal = val.slice(0, lineStart) + nextLine + val.slice(effectiveEnd);
      const newCursor = lineStart + nextLine.length;

      setContentWithSelection(nextVal, { start: newCursor, end: newCursor });
    },
    [setContentWithSelection],
  );

  const insertLink = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;

    const start = el.selectionStart;
    const end = el.selectionEnd;
    const val = el.value;
    const selected = val.slice(start, end);

    if (selected.length > 0) {
      const wrapped = `${val.slice(0, start)}[${selected}](url)${val.slice(end)}`;
      setContentWithSelection(wrapped, {
        start: start + selected.length + 3,
        end: start + selected.length + 6,
      });
      return;
    }

    const inserted = `${val.slice(0, start)}[link](url)${val.slice(end)}`;
    setContentWithSelection(inserted, {
      start: start + 7,
      end: start + 10,
    });
  }, [setContentWithSelection]);

  const handleApply = useCallback(() => {
    onSave(text);
  }, [onSave, text]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        handleApply();
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
        return;
      }

      if (event.metaKey || event.ctrlKey) {
        const key = event.key.toLowerCase();
        if (key === "b") {
          event.preventDefault();
          wrapSelection("**", "**", "bold text");
          return;
        }
        if (key === "i") {
          event.preventDefault();
          wrapSelection("*", "*", "italic text");
          return;
        }
        if (key === "e" || event.key === "`") {
          event.preventDefault();
          wrapSelection("`", "`", "code");
          return;
        }
        if (key === "k") {
          event.preventDefault();
          insertLink();
          return;
        }
      }

      if (event.key === "Tab") {
        event.preventDefault();
        const el = textareaRef.current;
        if (!el) return;
        const start = el.selectionStart;
        const end = el.selectionEnd;
        const val = el.value;
        const nextVal = `${val.slice(0, start)}  ${val.slice(end)}`;
        setContentWithSelection(nextVal, { start: start + 2, end: start + 2 });
      }
    },
    [handleApply, onCancel, wrapSelection, insertLink, setContentWithSelection],
  );

  const textareaStyle = useMemo(() => {
    if (anchor.kind === "heading") {
      return {
        fontFamily: "var(--reader-heading-family, var(--font-family-heading, inherit))",
        fontSize: "1.35em",
        fontWeight: 600,
        lineHeight: 1.35,
      };
    }

    if (anchor.kind === "code") {
      return {
        fontFamily: "var(--font-family-code, monospace)",
        fontSize: "var(--text-code-size, 0.9em)",
        lineHeight: 1.5,
      };
    }

    return {
      fontFamily: "var(--reader-prose-family, inherit)",
      fontSize: `${readerFontSize}px`,
      lineHeight: readerLineHeight,
    };
  }, [anchor.kind, readerFontSize, readerLineHeight]);

  return (
    <section
      className="reader-block-edit-enter my-2 overflow-hidden rounded-lg border border-[var(--color-border-emphasized)] bg-[var(--color-background-surface)] p-3 shadow-md transition-all duration-150"
      aria-label={`Editing ${anchor.kind} block inline`}
    >
      {/* Rich Formatting Toolbar */}
      <div className="mb-2.5 flex flex-wrap items-center gap-1 border-[var(--color-border)] border-b pb-2">
        <HStack gap={1} vAlign="center" wrap="wrap">
          <Button
            label="Bold (⌘B)"
            icon={<span className="font-bold text-xs">B</span>}
            variant="ghost"
            size="sm"
            isIconOnly
            tooltip="Bold (⌘B)"
            onClick={() => wrapSelection("**", "**", "bold text")}
          />
          <Button
            label="Italic (⌘I)"
            icon={<span className="font-serif text-xs italic">I</span>}
            variant="ghost"
            size="sm"
            isIconOnly
            tooltip="Italic (⌘I)"
            onClick={() => wrapSelection("*", "*", "italic text")}
          />
          <Button
            label="Inline Code (⌘E)"
            icon={<Icon icon={CodeBracketIcon} size="sm" />}
            variant="ghost"
            size="sm"
            isIconOnly
            tooltip="Inline Code (⌘E)"
            onClick={() => wrapSelection("`", "`", "code")}
          />
          <Button
            label="Strikethrough"
            icon={<span className="text-xs line-through">S</span>}
            variant="ghost"
            size="sm"
            isIconOnly
            tooltip="Strikethrough"
            onClick={() => wrapSelection("~~", "~~", "strikethrough")}
          />

          <div className="mx-1 h-3.5 w-px bg-[var(--color-border)]" aria-hidden />

          <Button
            label="Link (⌘K)"
            icon={<Icon icon={LinkIcon} size="sm" />}
            variant="ghost"
            size="sm"
            isIconOnly
            tooltip="Link (⌘K)"
            onClick={insertLink}
          />
          <Button
            label="Quote"
            icon={<Icon icon={ChatBubbleBottomCenterTextIcon} size="sm" />}
            variant="ghost"
            size="sm"
            isIconOnly
            tooltip="Quote (> )"
            onClick={() => toggleLinePrefix("> ")}
          />
          <Button
            label="Bullet list"
            icon={<Icon icon={ListBulletIcon} size="sm" />}
            variant="ghost"
            size="sm"
            isIconOnly
            tooltip="Bullet list (- )"
            onClick={() => toggleLinePrefix("- ")}
          />
          <Button
            label="Numbered list"
            icon={<Icon icon={QueueListIcon} size="sm" />}
            variant="ghost"
            size="sm"
            isIconOnly
            tooltip="Numbered list (1. )"
            onClick={() => toggleLinePrefix("1. ")}
          />

          {anchor.kind === "heading" || anchor.kind === "paragraph" ? (
            <>
              <div className="mx-1 h-3.5 w-px bg-[var(--color-border)]" aria-hidden />
              <Button
                label="Heading 1"
                icon={<span className="font-bold text-[11px]">H1</span>}
                variant="ghost"
                size="sm"
                isIconOnly
                tooltip="Heading 1 (# )"
                onClick={() => setHeadingLevel(1)}
              />
              <Button
                label="Heading 2"
                icon={<span className="font-bold text-[11px]">H2</span>}
                variant="ghost"
                size="sm"
                isIconOnly
                tooltip="Heading 2 (## )"
                onClick={() => setHeadingLevel(2)}
              />
              <Button
                label="Heading 3"
                icon={<span className="font-bold text-[11px]">H3</span>}
                variant="ghost"
                size="sm"
                isIconOnly
                tooltip="Heading 3 (### )"
                onClick={() => setHeadingLevel(3)}
              />
            </>
          ) : null}
        </HStack>

        <div className="ml-auto select-none font-mono text-[var(--color-text-disabled)] text-xs">
          {stats.words}w · {stats.chars}c
        </div>
      </div>

      {/* Editor Body */}
      <textarea
        ref={textareaRef}
        id={editorId}
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={handleKeyDown}
        rows={2}
        className="w-full resize-none border-none bg-transparent p-1 text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-disabled)]"
        placeholder="Enter markdown content…"
        style={textareaStyle}
        aria-label={`Edit ${anchor.kind} content`}
      />

      {/* Footer / Actions */}
      <div className="mt-2.5 flex items-center justify-between border-[var(--color-border)] border-t pt-2.5">
        <Text size="xsm" color="disabled">
          ⌘Enter to apply · Esc to cancel
        </Text>
        <HStack gap={2} vAlign="center">
          <Button label="Cancel" variant="secondary" size="sm" onClick={onCancel} />
          <Button label="Apply" variant="primary" size="sm" onClick={handleApply} />
        </HStack>
      </div>
    </section>
  );
}
