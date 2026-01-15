// @vitest-environment node
import { describe, it, expect } from "vitest";
import { compileSFC } from "../src/index.js";

describe("Props Directive", () => {
  it("optimizes #props directive", async () => {
    const code = `
<script>
  import Row from './Row.thyn';
  const item = { id: 1, name: 'test' };
</script>

<Row #props={item} />
`;
    const result = await compileSFC(code, "test.thyn");
    expect(result.js).toContain("__THYN__CORE__.fixedComponent(Row, item)");
  });

  it("does not optimize spread prop", async () => {
    const code = `
<script>
  import Row from './Row.thyn';
  const item = { id: 1, name: 'test' };
</script>

<Row {...item} />
`;
    const result = await compileSFC(code, "test.thyn");
    expect(result.js).not.toContain("__THYN__CORE__.fixedComponent(Row, item)");
    expect(result.js).toMatch(/__THYN__CORE__\.fixedComponent\(Row, \{.*\}\)/);
  });
});
