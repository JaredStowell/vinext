import path from "node:path";
import { normalizePathSeparators } from "../utils/path.js";

function isInsideDirectory(dir: string, filePath: string): boolean {
  const relativePath = path.relative(dir, filePath);
  return relativePath !== "" && !relativePath.startsWith("..") && !path.isAbsolute(relativePath);
}

/**
 * Returns true when `code` starts with a React `"use client"` or `"use server"`
 * directive (after stripping leading comments, hashbang, and whitespace).
 *
 * Used by `vinext:jsx-in-js` to opt `.js` dependency/workspace files into the
 * JSX transform. We mirror `@vitejs/plugin-rsc`'s detection by looking at the
 * directive prologue rather than scanning the whole file.
 */
function hasReactDirective(code: string): boolean {
  let i = 0;
  const len = code.length;
  // Strip BOM.
  if (code.charCodeAt(0) === 0xfeff) i = 1;
  // Strip hashbang.
  if (code[i] === "#" && code[i + 1] === "!") {
    const nl = code.indexOf("\n", i);
    if (nl === -1) return false;
    i = nl + 1;
  }
  while (i < len) {
    // Skip whitespace.
    while (i < len && /\s/.test(code[i] ?? "")) i++;
    if (i >= len) return false;
    // Skip line comments.
    if (code[i] === "/" && code[i + 1] === "/") {
      const nl = code.indexOf("\n", i + 2);
      if (nl === -1) return false;
      i = nl + 1;
      continue;
    }
    // Skip block comments.
    if (code[i] === "/" && code[i + 1] === "*") {
      const end = code.indexOf("*/", i + 2);
      if (end === -1) return false;
      i = end + 2;
      continue;
    }
    // At first non-comment, non-whitespace token. Must be a string literal
    // directive to qualify (per ECMA-262 Directive Prologue grammar).
    const quote = code[i];
    if (quote !== '"' && quote !== "'") return false;
    const closing = code.indexOf(quote, i + 1);
    if (closing === -1) return false;
    const directive = code.slice(i + 1, closing);
    if (directive === "use client" || directive === "use server") return true;
    // Other directives (e.g., "use strict") may precede the React directive.
    // Continue scanning past the statement-terminating `;` or newline.
    i = closing + 1;
    while (i < len && (code[i] === ";" || code[i] === " " || code[i] === "\t")) i++;
    if (code[i] === "\n") i++;
  }
  return false;
}

export function shouldTransformJsxInJs(
  id: string,
  code: string,
  root: string,
  sourceRoots: readonly string[] = [],
): boolean {
  const cleanId = normalizePathSeparators(id.split("?")[0]);
  if (!/\.(m?js)$/.test(cleanId)) return false;

  const normalizedRoot = normalizePathSeparators(root);
  const sourceRootPaths = [normalizedRoot, ...sourceRoots.map(normalizePathSeparators)].filter(
    (sourceRoot) => sourceRoot.length > 0,
  );
  const isProjectSource = sourceRootPaths.some((sourceRoot) =>
    isInsideDirectory(sourceRoot, cleanId),
  );
  const shouldRequireReactDirective =
    cleanId.includes("/node_modules/") || (sourceRootPaths.length > 0 && !isProjectSource);

  if (shouldRequireReactDirective) {
    if (!code.includes("use client") && !code.includes("use server")) return false;
    if (!hasReactDirective(code)) return false;
  }

  return true;
}
