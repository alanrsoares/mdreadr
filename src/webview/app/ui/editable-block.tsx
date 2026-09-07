import type { BlockAnchor } from "@mdreadr/domain";
import type { MouseEvent, ReactNode } from "react";
import { EditBlockButton, PinButton } from "./block-actions.tsx";
import { PinnableBlock } from "./pinnable-block.tsx";

/** A double-click on a link, a code block's copy control or any other embedded
 *  control is that control's gesture, not a request to edit the block. */
const isOwnGesture = (event: MouseEvent): boolean =>
  event.target instanceof HTMLElement &&
  event.target.closest("a, button, input, textarea, select, summary") !== null;

type EditableBlockProps = {
  anchor: BlockAnchor;
  onEdit?: (anchor: BlockAnchor) => void;
  onPin?: (anchor: BlockAnchor) => void;
  children: ReactNode;
};

/**
 * One rendered block plus its two gutter affordances and the double-click that
 * opens the inline editor. Every anchored block kind (heading, paragraph, code,
 * list, table) goes through here, so the gesture and the controls cannot drift
 * apart between them.
 */
export function EditableBlock({ anchor, onEdit, onPin, children }: EditableBlockProps) {
  return (
    <PinnableBlock
      onDoubleClick={(event: MouseEvent) => {
        if (!onEdit || isOwnGesture(event)) return;
        onEdit(anchor);
      }}
    >
      {onEdit ? <EditBlockButton anchor={anchor} onEdit={onEdit} /> : null}
      {onPin ? <PinButton anchor={anchor} onPin={onPin} /> : null}
      {children}
    </PinnableBlock>
  );
}
