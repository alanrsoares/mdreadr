import { ContextMenu, type ContextMenuOption } from "@astryxdesign/core/ContextMenu";
import type { BlockAnchor } from "@mdreadr/domain";
import { resolveBlockRawMarkdown, resolveBlockText } from "@mdreadr/domain";
import type { MouseEvent, ReactNode } from "react";
import { useCopy } from "../hooks/useCopy.ts";
import { anchorDisplayLabel } from "../markdown/anchors.ts";
import { EditBlockButton, PinButton } from "./block-actions.tsx";
import { PinnableBlock } from "./pinnable-block.tsx";

/** A double-click or right-click on a link, a code block's copy control or any
 *  other embedded control is that control's gesture, not a request to act on
 *  the block. */
const isOwnGesture = (event: MouseEvent): boolean =>
  event.target instanceof HTMLElement &&
  event.target.closest("a, button, input, textarea, select, summary") !== null;

type EditableBlockProps = {
  anchor: BlockAnchor;
  onEdit?: (anchor: BlockAnchor) => void;
  onPin?: (anchor: BlockAnchor) => void;
  /** Document source, for the copy actions. Absent for a block whose source
   *  we do not have, which drops those two items rather than copying nothing. */
  content?: string;
  children: ReactNode;
};

/**
 * One rendered block plus its two gutter affordances, the double-click that
 * opens the inline editor, and the right-click menu that names both gestures
 * out loud. Every anchored block kind (heading, paragraph, code, list, table)
 * goes through here, so the gestures and the controls cannot drift apart
 * between them.
 */
export function EditableBlock({ anchor, onEdit, onPin, content, children }: EditableBlockProps) {
  const label = anchorDisplayLabel(anchor);
  const copy = useCopy();

  // The gutter controls stay: a menu nobody thinks to open cannot be the only
  // route to anchoring a note (and right-click is not a keyboard gesture).
  // Annotated: a conditional spread widens the literal, so an excess property
  // (`onSelect` for `onClick`) would otherwise typecheck and silently do nothing.
  const source = content ? resolveBlockRawMarkdown(content, anchor) : undefined;
  const text = content ? resolveBlockText(content, anchor) : undefined;
  const actions: ContextMenuOption[] = [
    ...(onPin ? [{ label: "Anchor a note", onClick: () => onPin(anchor) }] : []),
    ...(onEdit ? [{ label: "Edit block", onClick: () => onEdit(anchor) }] : []),
  ];
  const copies: ContextMenuOption[] = [
    ...(text ? [{ label: "Copy text", onClick: () => void copy(text, "Text") }] : []),
    ...(source ? [{ label: "Copy markdown", onClick: () => void copy(source, "Markdown") }] : []),
  ];
  const items: ContextMenuOption[] =
    actions.length > 0 && copies.length > 0
      ? [...actions, { type: "divider" as const }, ...copies]
      : [...actions, ...copies];

  return (
    <PinnableBlock
      onDoubleClick={(event: MouseEvent) => {
        if (!onEdit || isOwnGesture(event)) return;
        onEdit(anchor);
      }}
      onContextMenuCapture={(event: MouseEvent) => {
        // Stopping the synthetic event here keeps it from reaching
        // ContextMenu's own `onContextMenu`, so nothing calls preventDefault
        // and the browser's menu (Open link, Copy link address) runs instead.
        if (isOwnGesture(event)) event.stopPropagation();
      }}
    >
      {onEdit ? <EditBlockButton anchor={anchor} onEdit={onEdit} /> : null}
      {onPin ? <PinButton anchor={anchor} onPin={onPin} /> : null}
      {items.length === 0 ? (
        children
      ) : (
        <ContextMenu items={items} size="sm" label={`Actions for ${label}`}>
          {children}
        </ContextMenu>
      )}
    </PinnableBlock>
  );
}
