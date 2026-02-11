import { describe, expect, it } from "vitest";

// isolatedTerminalList tests (no siblings)
import IsolatedAppend from "./operations/IsolatedAppend.thyn";
import IsolatedFilter from "./operations/IsolatedFilter.thyn";
import IsolatedInsert from "./operations/IsolatedInsert.thyn";
import IsolatedMove from "./operations/IsolatedMove.thyn";
import IsolatedNoneToSome from "./operations/IsolatedNoneToSome.thyn";
import IsolatedPrepend from "./operations/IsolatedPrepend.thyn";
import IsolatedRemove from "./operations/IsolatedRemove.thyn";
import IsolatedReplaceAll from "./operations/IsolatedReplaceAll.thyn";
import IsolatedSomeToNone from "./operations/IsolatedSomeToNone.thyn";
import IsolatedSort from "./operations/IsolatedSort.thyn";

// terminalList tests (with siblings)
import TerminalAppend from "./operations/TerminalAppend.thyn";
import TerminalFilter from "./operations/TerminalFilter.thyn";
import TerminalInsert from "./operations/TerminalInsert.thyn";
import TerminalNoneToSome from "./operations/TerminalNoneToSome.thyn";
import TerminalPrepend from "./operations/TerminalPrepend.thyn";
import TerminalRemove from "./operations/TerminalRemove.thyn";
import TerminalReplaceAll from "./operations/TerminalReplaceAll.thyn";
import TerminalSomeToNone from "./operations/TerminalSomeToNone.thyn";
import TerminalSort from "./operations/TerminalSort.thyn";

// list with component children tests (full teardown)
import ChildrenAppend from "./operations/ChildrenAppend.thyn";
import ChildrenFilter from "./operations/ChildrenFilter.thyn";
import ChildrenInsert from "./operations/ChildrenInsert.thyn";
import ChildrenNoneToSome from "./operations/ChildrenNoneToSome.thyn";
import ChildrenPrepend from "./operations/ChildrenPrepend.thyn";
import ChildrenRemove from "./operations/ChildrenRemove.thyn";
import ChildrenReplaceAll from "./operations/ChildrenReplaceAll.thyn";
import ChildrenSomeToNone from "./operations/ChildrenSomeToNone.thyn";
import ChildrenSort from "./operations/ChildrenSort.thyn";

const wait = () => Promise.resolve();

describe("List Operations - Comprehensive", () => {

  // ============================================================
  // ISOLATED TERMINAL LIST (isolatedTerminalList)
  // Triggered when #for loop has NO siblings
  // ============================================================
  describe("isolatedTerminalList (no siblings)", () => {

    describe("none → some", () => {
      it("adds single item to empty list", async () => {
        const root = IsolatedNoneToSome();
        await wait();

        expect(root.textContent).toBe("");

        root.click();
        await wait();
        await wait();

        expect(root.textContent).toBe("1");
      });

      it("adds multiple items to empty list", async () => {
        const root = IsolatedNoneToSome();
        await wait();

        root.click();
        await wait();
        root.click();
        await wait();

        expect(root.textContent).toBe("123");
      });
    });

    describe("some → none", () => {
      it("clears all items from list", async () => {
        const root = IsolatedSomeToNone();
        await wait();

        expect(root.textContent).toBe("123");

        root.click();
        await wait();
        await wait();

        expect(root.textContent).toBe("");
      });
    });

    describe("append", () => {
      it("adds items to end of existing list", async () => {
        const root = IsolatedAppend();
        await wait();

        expect(root.textContent).toBe("12");

        root.click();
        await wait();
        await wait();

        expect(root.textContent).toBe("1234");
      });
    });

    describe("prepend", () => {
      it("adds items to beginning of existing list", async () => {
        const root = IsolatedPrepend();
        await wait();

        expect(root.textContent).toBe("34");

        root.click();
        await wait();
        await wait();

        expect(root.textContent).toBe("1234");
      });
    });

    describe("insert", () => {
      it("inserts items in middle of list", async () => {
        const root = IsolatedInsert();
        await wait();

        expect(root.textContent).toBe("14");

        root.click();
        await wait();
        await wait();

        expect(root.textContent).toBe("1234");
      });
    });

    describe("remove", () => {
      it("removes items from end", async () => {
        const root = IsolatedRemove();
        await wait();

        expect(root.textContent).toBe("1234");

        root.click();
        await wait();
        await wait();

        expect(root.textContent).toBe("12");
      });

      it("removes items from beginning on second click", async () => {
        const root = IsolatedRemove();
        await wait();

        expect(root.textContent).toBe("1234");

        root.click();
        await wait();
        root.click();
        await wait();
        await wait();

        expect(root.textContent).toBe("34");
      });

      it("removes items from middle on third click", async () => {
        const root = IsolatedRemove();
        await wait();

        root.click();
        await wait();
        root.click();
        await wait();
        root.click();
        await wait();
        await wait();

        expect(root.textContent).toBe("14");
      });
    });

    describe("replace all", () => {
      it("replaces entire list with new items", async () => {
        const root = IsolatedReplaceAll();
        await wait();

        expect(root.textContent).toBe("123");

        root.click();
        await wait();
        await wait();

        expect(root.textContent).toBe("456");
      });
    });

    describe("sort", () => {
      it("sorts items ascending", async () => {
        const root = IsolatedSort();
        await wait();

        expect(root.textContent).toBe("3145");

        root.click();
        await wait();
        await wait();

        expect(root.textContent).toBe("1345");
      });

      it("sorts items descending on second click", async () => {
        const root = IsolatedSort();
        await wait();

        root.click();
        await wait();
        root.click();
        await wait();
        await wait();

        expect(root.textContent).toBe("5431");
      });

      it("reverses list on third click", async () => {
        const root = IsolatedSort();
        await wait();

        root.click();
        await wait();
        root.click();
        await wait();
        root.click();
        await wait();
        await wait();

        expect(root.textContent).toBe("54321");
      });
    });

    describe("filter", () => {
      it("filters to even numbers only", async () => {
        const root = IsolatedFilter();
        await wait();

        expect(root.textContent).toBe("123456");

        root.click();
        await wait();
        await wait();

        expect(root.textContent).toBe("246");
      });

      it("filters to odd numbers only on second click", async () => {
        const root = IsolatedFilter();
        await wait();

        root.click();
        await wait();
        root.click();
        await wait();
        await wait();

        expect(root.textContent).toBe("135");
      });

      it("filters to items greater than threshold on third click", async () => {
        const root = IsolatedFilter();
        await wait();

        root.click();
        await wait();
        root.click();
        await wait();
        root.click();
        await wait();
        await wait();

        expect(root.textContent).toBe("101520");
      });
    });

    describe("move/reorder", () => {
      it("moves item to front", async () => {
        const root = IsolatedMove();
        await wait();

        expect(root.textContent).toBe("1234");

        root.click();
        await wait();
        await wait();

        expect(root.textContent).toBe("4123");
      });

      it("swaps adjacent items on second click", async () => {
        const root = IsolatedMove();
        await wait();

        root.click();
        await wait();
        root.click();
        await wait();
        await wait();

        expect(root.textContent).toBe("1324");
      });

      it("reverses list on third click", async () => {
        const root = IsolatedMove();
        await wait();

        root.click();
        await wait();
        root.click();
        await wait();
        root.click();
        await wait();
        await wait();

        expect(root.textContent).toBe("4321");
      });
    });
  });

  // ============================================================
  // TERMINAL LIST WITH SIBLINGS
  // Triggered when #for loop HAS siblings
  // ============================================================
  describe("terminalList (with siblings)", () => {

    describe("none → some", () => {
      it("adds items between siblings", async () => {
        const root = TerminalNoneToSome();
        await wait();

        expect(root.textContent).toBe("startend");

        // Click on the list area to add items
        const listItem = root.querySelector('[data-id]');
        if (listItem) {
          (listItem as HTMLElement).click();
          await wait();
          await wait();
          expect(root.textContent).toBe("start123end");
        }
      });
    });

    describe("some → none", () => {
      it("removes items leaving only siblings", async () => {
        const root = TerminalSomeToNone();
        await wait();

        expect(root.textContent).toBe("start123end");

        root.click();
        await wait();
        await wait();

        expect(root.textContent).toBe("startend");
      });
    });

    describe("append", () => {
      it("appends items between siblings", async () => {
        const root = TerminalAppend();
        await wait();

        expect(root.textContent).toBe("start12end");

        root.click();
        await wait();
        await wait();

        expect(root.textContent).toBe("start1234end");
      });
    });

    describe("prepend", () => {
      it("prepends items between siblings", async () => {
        const root = TerminalPrepend();
        await wait();

        expect(root.textContent).toBe("start34end");

        root.click();
        await wait();
        await wait();

        expect(root.textContent).toBe("start1234end");
      });
    });

    describe("insert", () => {
      it("inserts items in middle between siblings", async () => {
        const root = TerminalInsert();
        await wait();

        expect(root.textContent).toBe("start14end");

        root.click();
        await wait();
        await wait();

        expect(root.textContent).toBe("start1234end");
      });
    });

    describe("remove", () => {
      it("removes items maintaining sibling positions", async () => {
        const root = TerminalRemove();
        await wait();

        expect(root.textContent).toBe("start1234end");

        root.click();
        await wait();
        await wait();

        expect(root.textContent).toBe("start12end");
      });
    });

    describe("replace all", () => {
      it("replaces all items while keeping siblings", async () => {
        const root = TerminalReplaceAll();
        await wait();

        expect(root.textContent).toBe("start12end");

        root.click();
        await wait();
        await wait();

        expect(root.textContent).toBe("start789end");
      });
    });

    describe("sort", () => {
      it("sorts items between siblings", async () => {
        const root = TerminalSort();
        await wait();

        expect(root.textContent).toBe("start312end");

        root.click();
        await wait();
        await wait();

        expect(root.textContent).toBe("start123end");
      });
    });

    describe("filter", () => {
      it("filters items between siblings", async () => {
        const root = TerminalFilter();
        await wait();

        expect(root.textContent).toBe("start123456end");

        root.click();
        await wait();
        await wait();

        expect(root.textContent).toBe("start246end");
      });
    });
  });

  // ============================================================
  // LIST WITH COMPONENT CHILDREN (full teardown)
  // Triggered when #for items contain components (#if, etc)
  // ============================================================
  describe("list with component children (full teardown)", () => {

    describe("none → some", () => {
      it("renders children components for new items", async () => {
        const root = ChildrenNoneToSome();
        await wait();

        const items = root.querySelectorAll('[data-id]');
        expect(items.length).toBe(0);

        root.click();
        await wait();
        await wait();

        const text = root.textContent || '';
        expect(text).toContain("odd: 1");
        expect(text).toContain("even: 2");
        expect(text).toContain("odd: 3");
      });
    });

    describe("some → none", () => {
      it("removes all child components", async () => {
        const root = ChildrenSomeToNone();
        await wait();

        let items = root.querySelectorAll('[data-id]');
        expect(items.length).toBe(3);

        root.click();
        await wait();
        await wait();

        items = root.querySelectorAll('[data-id]');
        expect(items.length).toBe(0);
      });
    });

    describe("append", () => {
      it("appends items with child components", async () => {
        const root = ChildrenAppend();
        await wait();

        const text = root.textContent || '';
        expect(text).toContain("odd: 1");

        root.click();
        await wait();
        await wait();

        const newText = root.textContent || '';
        expect(newText).toContain("odd: 1");
        expect(newText).toContain("even: 2");
        expect(newText).toContain("odd: 3");
      });
    });

    describe("prepend", () => {
      it("prepends items with child components", async () => {
        const root = ChildrenPrepend();
        await wait();

        const text = root.textContent || '';
        expect(text).toContain("odd: 3");

        root.click();
        await wait();
        await wait();

        const newText = root.textContent || '';
        expect(newText).toContain("odd: 1");
        expect(newText).toContain("even: 2");
        expect(newText).toContain("odd: 3");
      });
    });

    describe("insert", () => {
      it("inserts items with child components in middle", async () => {
        const root = ChildrenInsert();
        await wait();

        let items = root.querySelectorAll('[data-id]');
        expect(items.length).toBe(2);

        root.click();
        await wait();
        await wait();

        items = root.querySelectorAll('[data-id]');
        expect(items.length).toBe(4);

        const text = root.textContent || '';
        expect(text).toContain("odd: 1");
        expect(text).toContain("even: 2");
        expect(text).toContain("odd: 3");
        expect(text).toContain("even: 4");
      });
    });

    describe("remove", () => {
      it("removes items with their child components", async () => {
        const root = ChildrenRemove();
        await wait();

        let items = root.querySelectorAll('[data-id]');
        expect(items.length).toBe(4);

        root.click();
        await wait();
        await wait();

        items = root.querySelectorAll('[data-id]');
        expect(items.length).toBe(2);

        const text = root.textContent || '';
        expect(text).toContain("odd: 1");
        expect(text).toContain("odd: 3");
        expect(text).not.toContain("even: 2");
        expect(text).not.toContain("even: 4");
      });
    });

    describe("replace all", () => {
      it("replaces all items with new child components", async () => {
        const root = ChildrenReplaceAll();
        await wait();

        let text = root.textContent || '';
        expect(text).toContain("odd: 1");
        expect(text).toContain("even: 2");

        root.click();
        await wait();
        await wait();

        text = root.textContent || '';
        expect(text).toContain("odd: 5");
        expect(text).toContain("even: 6");
        expect(text).toContain("odd: 7");
        expect(text).not.toContain("1");
        expect(text).not.toContain("2");
      });
    });

    describe("sort", () => {
      it("sorts items with child components", async () => {
        const root = ChildrenSort();
        await wait();

        let items = root.querySelectorAll('[data-id]');
        let ids = Array.from(items).map(p => p.getAttribute('data-id'));
        expect(ids).toEqual(["4", "2", "3", "1"]);

        root.click();
        await wait();
        await wait();

        items = root.querySelectorAll('[data-id]');
        ids = Array.from(items).map(p => p.getAttribute('data-id'));
        expect(ids).toEqual(["1", "2", "3", "4"]);
      });
    });

    describe("filter", () => {
      it("filters items preserving child components", async () => {
        const root = ChildrenFilter();
        await wait();

        let items = root.querySelectorAll('[data-id]');
        expect(items.length).toBe(6);

        root.click();
        await wait();
        await wait();

        items = root.querySelectorAll('[data-id]');
        expect(items.length).toBe(3);

        const text = root.textContent || '';
        expect(text).toContain("even: 2");
        expect(text).toContain("even: 4");
        expect(text).toContain("even: 6");
        expect(text).not.toContain("odd");
      });
    });
  });
});
