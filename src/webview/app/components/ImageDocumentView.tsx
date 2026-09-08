import { getApiBase } from "../treaty.ts";
import { ReaderImage, ReaderImageFrame } from "../ui/reader.tsx";

type ImageDocumentViewProps = { documentPath: string };

/** `/a/b/hero.png` -> `hero.png`. Kept local: the webview has no `node:path`. */
const basename = (path: string): string => path.slice(path.lastIndexOf("/") + 1);

/**
 * An image opened as its own Document. The bytes come from the same asset
 * endpoint rendered images use, which is scoped to the open Document — so the
 * file resolves as its own directory's asset rather than a raw path read.
 */
export const ImageDocumentView = ({ documentPath }: ImageDocumentViewProps) => {
  const src = `${getApiBase()}/documents/asset?doc=${encodeURIComponent(documentPath)}&src=${encodeURIComponent(basename(documentPath))}`;

  return (
    <ReaderImageFrame>
      <ReaderImage src={src} alt={basename(documentPath)} />
    </ReaderImageFrame>
  );
};
