export type ImageSrcResolver = (src: string) => string;

// Same policy as the Astryx markdown image renderer: relative and http(s)
// sources pass, script-bearing protocols do not.
export const DANGEROUS_URL_PATTERN = /^(javascript|data|vbscript):/i;

const ABSOLUTE_URL_RE = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i;

/**
 * Rewrites Document-relative image sources (e.g. `docs/hero.png`) to the API
 * asset endpoint so they resolve against the Document's directory instead of
 * the webview origin. Absolute URLs pass through untouched.
 */
export const createAssetResolver =
  (apiBase: string, documentPath: string | undefined): ImageSrcResolver =>
  (src) => {
    const trimmed = src.trim();
    return !documentPath || trimmed.length === 0 || ABSOLUTE_URL_RE.test(trimmed)
      ? src
      : `${apiBase}/documents/asset?doc=${encodeURIComponent(documentPath)}&src=${encodeURIComponent(trimmed)}`;
  };
