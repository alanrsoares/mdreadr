import { CodeHighlightNode, CodeNode } from "@lexical/code";
import { LinkNode } from "@lexical/link";
import { ListItemNode, ListNode } from "@lexical/list";
import { HorizontalRuleNode } from "@lexical/react/LexicalHorizontalRuleNode";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import { TableCellNode, TableNode, TableRowNode } from "@lexical/table";
import {
  $applyNodeReplacement,
  DecoratorNode,
  type EditorConfig,
  type LexicalNode,
  type NodeKey,
  type SerializedLexicalNode,
  type Spread,
} from "lexical";
import { createContext, type ReactNode, useContext } from "react";
import type { ImageSrcResolver } from "../markdown/assets.ts";

/**
 * Rewrites Document-relative image sources for display only. The node keeps the
 * source exactly as written, so exporting never changes the markdown.
 */
export const ImageSrcContext = createContext<ImageSrcResolver>((src) => src);

type SerializedImageNode = Spread<
  { src: string; alt: string; title: string | null },
  SerializedLexicalNode
>;

type WriteImageProps = { src: string; alt: string; title: string | null };

function WriteImage({ src, alt, title }: WriteImageProps) {
  const resolve = useContext(ImageSrcContext);
  return <img src={resolve(src)} alt={alt} title={title ?? undefined} draggable={false} />;
}

/** An inline image, `![alt](src "title")`, shown rather than edited. */
export class ImageNode extends DecoratorNode<ReactNode> {
  __src: string;
  __alt: string;
  __title: string | null;

  static override getType(): string {
    return "image";
  }

  static override clone(node: ImageNode): ImageNode {
    return new ImageNode(node.__src, node.__alt, node.__title, node.__key);
  }

  static override importJSON(serialized: SerializedImageNode): ImageNode {
    return $createImageNode(serialized.src, serialized.alt, serialized.title);
  }

  constructor(src: string, alt: string, title: string | null, key?: NodeKey) {
    super(key);
    this.__src = src;
    this.__alt = alt;
    this.__title = title;
  }

  override exportJSON(): SerializedImageNode {
    return {
      ...super.exportJSON(),
      src: this.__src,
      alt: this.__alt,
      title: this.__title,
    };
  }

  getSrc(): string {
    return this.getLatest().__src;
  }

  getAlt(): string {
    return this.getLatest().__alt;
  }

  getTitle(): string | null {
    return this.getLatest().__title;
  }

  override createDOM(_config: EditorConfig): HTMLElement {
    const span = document.createElement("span");
    span.className = "write-image";
    return span;
  }

  override updateDOM(): false {
    return false;
  }

  override isInline(): boolean {
    return true;
  }

  override getTextContent(): string {
    return this.getAlt();
  }

  override decorate(): ReactNode {
    return <WriteImage src={this.__src} alt={this.__alt} title={this.__title} />;
  }
}

export const $createImageNode = (src: string, alt: string, title: string | null): ImageNode =>
  $applyNodeReplacement(new ImageNode(src, alt, title));

export const $isImageNode = (node: LexicalNode | null | undefined): node is ImageNode =>
  node instanceof ImageNode;

/** One node set for the editor and for headless round-trips in tests. */
export const WRITE_NODES = [
  HeadingNode,
  QuoteNode,
  ListNode,
  ListItemNode,
  CodeNode,
  CodeHighlightNode,
  LinkNode,
  TableNode,
  TableRowNode,
  TableCellNode,
  HorizontalRuleNode,
  ImageNode,
];
