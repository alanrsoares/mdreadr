import {
  $convertFromMarkdownString,
  $convertToMarkdownString,
  type ElementTransformer,
  isTableRowDivider,
  type MultilineElementTransformer,
  type TextMatchTransformer,
  TRANSFORMERS,
  type Transformer,
} from "@lexical/markdown";
import {
  $createHorizontalRuleNode,
  $isHorizontalRuleNode,
} from "@lexical/react/LexicalHorizontalRuleNode";
import {
  $createTableCellNode,
  $createTableNode,
  $createTableRowNode,
  $isTableCellNode,
  $isTableNode,
  $isTableRowNode,
  TableCellHeaderStates,
  TableCellNode,
  TableNode,
  TableRowNode,
} from "@lexical/table";
import { $createParagraphNode } from "lexical";
import { $createImageNode, $isImageNode, ImageNode } from "./nodes.tsx";

const TABLE_ROW = /^\s*\|.*\|\s*$/;

/** Splits a table row on its unescaped pipes. */
function rowCells(line: string): string[] {
  const inner = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  const cells: string[] = [];
  let current = "";
  for (let index = 0; index < inner.length; index += 1) {
    const char = inner[index];
    if (char === "\\" && inner[index + 1] === "|") {
      current += "|";
      index += 1;
    } else if (char === "|") {
      cells.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current.trim());
  return cells;
}

function $createRow(cells: readonly string[], header: boolean): TableRowNode {
  const row = $createTableRowNode();
  for (const text of cells) {
    const cell = $createTableCellNode(
      header ? TableCellHeaderStates.ROW : TableCellHeaderStates.NO_STATUS,
    );
    // Cell text is inline markdown; the cell is a root of its own for the import.
    $convertFromMarkdownString(text, WRITE_TRANSFORMERS, cell);
    if (cell.isEmpty()) cell.append($createParagraphNode());
    row.append(cell);
  }
  return row;
}

/** Makes cell text safe inside a pipe-table row. */
const escapeCell = (text: string): string => text.replace(/\n/g, " ").replace(/\|/g, "\\|").trim();

/** GFM pipe tables: a header row, a divider row, then body rows. */
export const TABLE: MultilineElementTransformer = {
  type: "multiline-element",
  dependencies: [TableNode, TableRowNode, TableCellNode],
  regExpStart: TABLE_ROW,
  handleImportAfterStartMatch: ({ lines, rootNode, startLineIndex }) => {
    const header = lines[startLineIndex];
    const divider = lines[startLineIndex + 1];
    if (header === undefined || divider === undefined || !isTableRowDivider(divider.trim())) {
      return null;
    }

    let end = startLineIndex + 2;
    while (end < lines.length && TABLE_ROW.test(lines[end] ?? "")) end += 1;

    const table = $createTableNode();
    table.append($createRow(rowCells(header), true));
    for (let index = startLineIndex + 2; index < end; index += 1) {
      table.append($createRow(rowCells(lines[index] ?? ""), false));
    }
    rootNode.append(table);
    return [true, end - 1];
  },
  replace: () => false,
  export: (node) => {
    if (!$isTableNode(node)) return null;

    const lines: string[] = [];
    for (const row of node.getChildren()) {
      if (!$isTableRowNode(row)) continue;
      const cells: string[] = [];
      let isHeader = false;
      for (const cell of row.getChildren()) {
        if (!$isTableCellNode(cell)) continue;
        cells.push(escapeCell($convertToMarkdownString(WRITE_TRANSFORMERS, cell)));
        isHeader = isHeader || cell.hasHeaderState(TableCellHeaderStates.ROW);
      }
      lines.push(`| ${cells.join(" | ")} |`);
      if (isHeader) lines.push(`| ${cells.map(() => "---").join(" | ")} |`);
    }
    return lines.join("\n");
  },
};

/** `---`, `***` and `___` on a line of their own. */
export const THEMATIC_BREAK: ElementTransformer = {
  type: "element",
  dependencies: [],
  regExp: /^(?:---|\*\*\*|___)\s?$/,
  export: (node) => ($isHorizontalRuleNode(node) ? "---" : null),
  replace: (parentNode, _children, _match, isImport) => {
    const rule = $createHorizontalRuleNode();
    if (isImport || parentNode.getNextSibling() !== null) {
      parentNode.replace(rule);
    } else {
      parentNode.insertBefore(rule);
    }
    rule.selectNext();
  },
};

const IMAGE_PATTERN = /!\[([^\]]*)\]\(([^()\s]+)(?:\s+"([^"]*)")?\)/;

export const IMAGE: TextMatchTransformer = {
  type: "text-match",
  dependencies: [ImageNode],
  trigger: ")",
  importRegExp: IMAGE_PATTERN,
  regExp: new RegExp(`${IMAGE_PATTERN.source}$`),
  export: (node) => {
    if (!$isImageNode(node)) return null;
    const title = node.getTitle();
    return `![${node.getAlt()}](${node.getSrc()}${title ? ` "${title}"` : ""})`;
  },
  replace: (textNode, match) => {
    const [, alt = "", src = "", title] = match;
    textNode.replace($createImageNode(src, alt, title ?? null));
  },
};

/**
 * Everything Write mode reads and writes. Image goes ahead of the link rule so
 * `![alt](src)` is not taken for a link behind a stray `!`.
 */
export const WRITE_TRANSFORMERS: Transformer[] = [TABLE, THEMATIC_BREAK, IMAGE, ...TRANSFORMERS];
