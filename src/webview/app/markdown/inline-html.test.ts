import { expect, test } from "bun:test";
import {
  BR_PATTERN,
  IMG_PATTERN,
  KBD_PATTERN,
  parseImgTag,
  SUB_PATTERN,
  SUP_PATTERN,
} from "./inline-html.tsx";

function firstMatch(pattern: RegExp, input: string): RegExpExecArray | null {
  pattern.lastIndex = 0;
  return pattern.exec(input);
}

test("KBD_PATTERN captures key content", () => {
  expect(firstMatch(KBD_PATTERN, "Press <kbd>Ctrl</kbd> now")?.[1]).toBe("Ctrl");
});

test("SUP and SUB patterns capture content", () => {
  expect(firstMatch(SUP_PATTERN, "x<sup>2</sup>")?.[1]).toBe("2");
  expect(firstMatch(SUB_PATTERN, "H<sub>2</sub>O")?.[1]).toBe("2");
});

test("BR_PATTERN matches all br forms", () => {
  for (const form of ["<br>", "<br/>", "<br />", "<BR>"]) {
    expect(firstMatch(BR_PATTERN, form)?.[0]).toBe(form);
  }
});

test("IMG_PATTERN captures attribute text", () => {
  const match = firstMatch(IMG_PATTERN, '<img src="logo.svg" width="120">');
  expect(match?.[1]).toContain('src="logo.svg"');
});

test("parseImgTag reads src, alt and dimensions", () => {
  expect(parseImgTag('src="logo.svg" alt="Logo" width="120" height=60')).toEqual({
    src: "logo.svg",
    alt: "Logo",
    width: 120,
    height: 60,
  });
});

test("parseImgTag rejects script-bearing sources", () => {
  expect(parseImgTag(`src="javascript:alert(1)"`)).toBeNull();
  expect(parseImgTag(`src="data:text/html,x"`)).toBeNull();
  expect(parseImgTag("")).toBeNull();
});

test("parseImgTag ignores malformed dimensions", () => {
  expect(parseImgTag('src="a.png" width="wide"')?.width).toBeUndefined();
});
