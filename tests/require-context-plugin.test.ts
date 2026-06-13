import { describe, expect, it } from "vite-plus/test";
import { mayContainRequireContext } from "../packages/vinext/src/plugins/require-context.js";

describe("vinext:require-context plugin", () => {
  it("quick-checks only likely require.context member calls", () => {
    expect(mayContainRequireContext(`const ctx = require.context("./dir", true, /\\.js$/);`)).toBe(
      true,
    );
    expect(
      mayContainRequireContext(
        `const ctx = (require as unknown as NodeRequire).context("./dir", true, /\\.js$/);`,
      ),
    ).toBe(true);
    expect(
      mayContainRequireContext(
        `const ctx = (require satisfies NodeRequire).context("./dir", true, /\\.js$/);`,
      ),
    ).toBe(true);
    expect(
      mayContainRequireContext(
        `const ctx = (require as (name: string) => NodeRequire).context("./dir", true, /\\.js$/);`,
      ),
    ).toBe(true);
    expect(mayContainRequireContext(`const ctx = (require!).context("./dir");`)).toBe(true);

    expect(mayContainRequireContext(`const requireMessage = "require"; route.context = ctx;`)).toBe(
      false,
    );
    expect(mayContainRequireContext(`function requireContext() { return route.context; }`)).toBe(
      false,
    );
  });
});
