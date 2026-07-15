import { Kbd } from "@astryxdesign/core/Kbd";

export function ReaderDropHint() {
  return (
    <p className="reader-drop-hint">
      Drop a markdown file here, or press <Kbd keys="mod+o" /> to open.
    </p>
  );
}
