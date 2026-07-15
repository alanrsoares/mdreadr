/// <reference types="vite/client" />

declare module "*.css" {
  const content: string;
  export default content;
}

declare module "@astryxdesign/core/reset.css";
declare module "@astryxdesign/core/astryx.css";
declare module "katex/dist/katex.min.css";
