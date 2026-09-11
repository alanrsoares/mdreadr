import { HStack } from "@astryxdesign/core/HStack";
import { IconButton } from "@astryxdesign/core/IconButton";
import { Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { type KeyboardEvent, useEffect, useRef } from "react";
import type { DocumentFind } from "../hooks/useDocumentFind.ts";
import { ChevronDownIcon, ChevronUpIcon, XMarkIcon } from "../icons.ts";
import { FindBarShell, FindCount } from "../ui/layout.tsx";

export type FindBarProps = { find: DocumentFind };

/**
 * Find within the Document. Floats over the top of the sheet rather than
 * joining the chrome: opening it must not move the prose the reader is
 * searching (DESIGN.md §5), and a row that appears in the sticky header does
 * exactly that.
 *
 * Astryx primitives, but not `Toolbar`: that one owns arrow keys for roving
 * focus and advertises them ("← → to navigate"), which is the wrong model here.
 * Arrows move the caret in the term, and Enter steps the matches.
 */
export function FindBar({ find }: FindBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  // Every route in (the shortcut, the menu) opens with the caret in the field,
  // and re-opening on a term already there selects it, so the next keystroke
  // replaces the search rather than extending it.
  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      find.close();
      return;
    }
    if (event.key !== "Enter") return;
    event.preventDefault();
    find.step(event.shiftKey ? -1 : 1);
  };

  return (
    <FindBarShell onKeyDown={onKeyDown} role="search" aria-label="Find in document">
      <HStack gap={2} vAlign="center">
        <TextInput
          ref={inputRef}
          label="Find in document"
          isLabelHidden
          size="sm"
          placeholder="Find"
          value={find.query}
          onChange={find.setQuery}
        />
        {/* Reserved whether or not it reads, so a first match does not shift
            the buttons beside it. */}
        <FindCount>
          <Text type="supporting" size="xsm" aria-live="polite">
            {find.query === "" ? "\u00a0" : `${find.position}/${find.total}`}
          </Text>
        </FindCount>
        <IconButton
          label="Previous match"
          tooltip="Previous match"
          variant="ghost"
          size="sm"
          isDisabled={find.total === 0}
          icon={<ChevronUpIcon />}
          onClick={() => find.step(-1)}
        />
        <IconButton
          label="Next match"
          tooltip="Next match"
          variant="ghost"
          size="sm"
          isDisabled={find.total === 0}
          icon={<ChevronDownIcon />}
          onClick={() => find.step(1)}
        />
        <IconButton
          label="Close find"
          tooltip="Close find"
          variant="ghost"
          size="sm"
          icon={<XMarkIcon />}
          onClick={find.close}
        />
      </HStack>
    </FindBarShell>
  );
}
