
// @vitest-environment node
import { describe, it, expect } from "vitest";
import { compileSFC } from "../src/index.js";

describe("Props Optimization", () => {
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

  it("handles mixed props correctly", async () => {
    const code = `
<script>
  import Row from './Row.thyn';
  const item = { id: 1 };
</script>

<Row {...item} id={1} />
`;
    const result = await compileSFC(code, "test.thyn");
    expect(result.js).toContain("__THYN__CORE__.fixedComponent(Row, {...item, 'id': 1})");
  });

  it("handles multiple spread props correctly", async () => {
    const code = `
<script>
  import Row from './Row.thyn';
  const item = { id: 1 };
  const other = { foo: 'bar' };
</script>

<Row {...item} {...other} />
`;
    const result = await compileSFC(code, "test.thyn");
    expect(result.js).toContain("__THYN__CORE__.fixedComponent(Row, {...item, ...other})");
  });
});
