import { ContextMenu, type ContextMenuOption } from "@astryxdesign/core/ContextMenu";
import type { BlockAnchor, SubBlockTarget } from "@mdreadr/domain";
import { resolveBlockRawMarkdown, resolveBlockText } from "@mdreadr/domain";
import { type MouseEvent, type ReactNode, useRef } from "react";
import { useCopy } from "../hooks/useCopy.ts";
import { anchorDisplayLabel } from "../markdown/anchors.ts";
import { subBlockNoun, subBlockTargetFromNode } from "../markdown/sub-blocks.ts";
import type { InlineEditHandle } from "../session/inline-edit.ts";
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
  /** The Inline Edit session both gestures open. */
  edit: InlineEditHandle;
  /** The Document's source, for the copy actions. */
  content: string;
  onPin?: (anchor: BlockAnchor) => void;
  /** Set for a block that has parts a reader can edit on their own: a list's
   *  items, a table's rows. Absent for a block that is edited whole. */
  subKind?: SubBlockTarget["kind"];
  /** Maps a target from a rendered source slice to its parent block. */
  mapSubTarget?: (target: SubBlockTarget) => SubBlockTarget | undefined;
  children: ReactNode;
};

/**
 * One rendered block plus its two gutter affordances, the double-click that
 * opens the inline editor, and the right-click menu that names both gestures
 * out loud. Every anchored block kind (heading, paragraph, code, list, table)
 * goes through here, so the gestures and the controls cannot drift apart
 * between them.
 *
 * A block with parts (`subKind`) resolves the pointer to the part it landed on,
 * so a double-click inside a list item edits that item and not the forty-item
 * list around it. The gutter control stays whole-block: it is the block's
 * affordance, and it is the only route that never needs a pointer.
 */
export function EditableBlock({
  anchor,
  edit,
  content,
  onPin,
  subKind,
  mapSubTarget,
  children,
}: EditableBlockProps) {
  const label = anchorDisplayLabel(anchor);
  const copy = useCopy();
  // The menu's labels are fixed at render, but which part was right-clicked is
  // only known when the pointer arrives, so the target rides in a ref.
  const menuTargetRef = useRef<SubBlockTarget | null>(null);

  /** The part the pointer landed on, or `null` for the block itself. */
  const targetFrom = (event: MouseEvent): SubBlockTarget | null => {
    if (!subKind || !(event.currentTarget instanceof HTMLElement)) return null;
    const target = subBlockTargetFromNode(event.currentTarget, event.target as Node, subKind);
    return target ? (mapSubTarget ? (mapSubTarget(target) ?? null) : target) : null;
  };

  const editFrom = (event: MouseEvent): void => {
    const target = targetFrom(event);
    if (target) {
      edit.startSub(anchor, target);
      return;
    }
    edit.start(anchor);
  };

  // The gutter controls stay: a menu nobody thinks to open cannot be the only
  // route to anchoring a note (and right-click is not a keyboard gesture).
  // Annotated: a conditional spread widens the literal, so an excess property
  // (`onSelect` for `onClick`) would otherwise typecheck and silently do nothing.
  const source = resolveBlockRawMarkdown(content, anchor);
  const text = resolveBlockText(content, anchor);
  const actions: ContextMenuOption[] = [
    ...(onPin ? [{ label: "Anchor a note", onClick: () => onPin(anchor) }] : []),
    ...(subKind
      ? [
          {
            label: `Edit ${subBlockNoun(subKind)}`,
            onClick: () => {
              const target = menuTargetRef.current;
              // Right-clicked between the rows: the block is what they hit.
              target ? edit.startSub(anchor, target) : edit.start(anchor);
            },
          },
        ]
      : []),
    { label: "Edit block", onClick: () => edit.start(anchor) },
  ];
  const copies: ContextMenuOption[] = [
    ...(text ? [{ label: "Copy text", onClick: () => void copy(text, "Text") }] : []),
    ...(source ? [{ label: "Copy markdown", onClick: () => void copy(source, "Markdown") }] : []),
  ];
  // Editing is always on the menu, so the actions half is never empty and the
  // divider only has to ask about the copies.
  const items: ContextMenuOption[] =
    copies.length > 0 ? [...actions, { type: "divider" as const }, ...copies] : actions;

  return (
    <PinnableBlock
      onDoubleClick={(event: MouseEvent) => {
        if (isOwnGesture(event)) return;
        editFrom(event);
      }}
      onContextMenuCapture={(event: MouseEvent) => {
        // Stopping the synthetic event here keeps it from reaching
        // ContextMenu's own `onContextMenu`, so nothing calls preventDefault
        // and the browser's menu (Open link, Copy link address) runs instead.
        if (isOwnGesture(event)) {
          event.stopPropagation();
          return;
        }
        menuTargetRef.current = targetFrom(event);
      }}
    >
      {/* One column in the left gutter: edit above, pin below. Positioned as a
          pair so neither control can drift over the block's own content. */}
      <span className="reader-block-actions">
        <EditBlockButton anchor={anchor} onEdit={edit.start} />
        {onPin ? <PinButton anchor={anchor} onPin={onPin} /> : null}
      </span>
      <ContextMenu items={items} size="sm" label={`Actions for ${label}`}>
        {children}
      </ContextMenu>
    </PinnableBlock>
  );
}
