import { TextArea } from "@astryxdesign/core/TextArea";
import { ReaderEditor } from "../ui/reader.tsx";

type DocumentEditorProps = {
  value: string;
  onChange: (text: string) => void;
};

export const DocumentEditor = ({ value, onChange }: DocumentEditorProps) => (
  <ReaderEditor>
    <TextArea
      label="Document source"
      isLabelHidden
      value={value}
      onChange={onChange}
      rows={32}
      hasSpellCheck={false}
    />
  </ReaderEditor>
);
