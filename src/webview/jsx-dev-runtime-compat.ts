// @astryxdesign/core ships dev-transform JSX (jsxDEV calls) in its published
// dist. React's production jsx-dev-runtime exports jsxDEV as undefined, which
// crashes the built app before mount. Vite aliases react/jsx-dev-runtime here
// at build time so those calls bind to the production jsx runtime instead.
export { Fragment, jsx as jsxDEV } from "react/jsx-runtime";
