import { CodeBlock } from "@astryxdesign/core/CodeBlock";
import { ReaderRaw } from "../ui/reader.tsx";

type RawMarkdownViewProps = {
  content: string;
};

export function RawMarkdownView({ content }: RawMarkdownViewProps) {
  return (
    <ReaderRaw>
      <CodeBlock code={content} language="markdown" />
    </ReaderRaw>
  );
}
