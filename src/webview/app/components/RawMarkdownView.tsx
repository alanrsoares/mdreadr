import { CodeBlock } from "@astryxdesign/core/CodeBlock";
import { ReaderRaw } from "../ui/reader.tsx";

type RawMarkdownViewProps = {
  content: string;
};

export const RawMarkdownView = ({ content }: RawMarkdownViewProps) => (
  <ReaderRaw>
    <CodeBlock code={content} language="markdown" />
  </ReaderRaw>
);
