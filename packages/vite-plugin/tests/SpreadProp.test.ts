// @vitest-environment node
import { describe, it, expect } from "vitest";
import { compileSFC } from "../src/index.js";

describe("Spread Props Optimization", () => {
  it("optimizes single spread prop", async () => {
    const code = `
<script>
  import Row from './Row.thyn';
  const item = { id: 1, name: 'test' };
</script>

<Row {...item} />
`;
    const result = await compileSFC(code, "test.thyn");
    expect(result.js).toContain("__THYN__CORE__.fixedComponent(Row, item)");
  });

  it("does not optimize mixed props", async () => {
    const code = `
<script>
  import Row from './Row.thyn';
  const item = { id: 1, name: 'test' };
</script>

<Row {...item} id={1} />
`;
    const result = await compileSFC(code, "test.thyn");
    expect(result.js).not.toContain("__THYN__CORE__.fixedComponent(Row, item)");
    expect(result.js).toMatch(/__THYN__CORE__\.fixedComponent\(Row, \{.*\}\)/);
  });
});
