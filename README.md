# Thyn

**Thyn** is an experimental JavaScript UI framework for building fast, memory-efficient web apps. It compiles `.thyn` single-file components into highly optimized DOM operations — no virtual DOM, no runtime bloat.

- ⚡ Fast runtime performance
- 📦 Tiny bundles
- 🧠 Minimal memory footprint
- 🧪 Uses `.thyn` single-file components
- 🚧 **Experimental** — limited tooling and ecosystem

---

## Getting Started
```sh
npx degit thynjs/template my-app
cd my-app
npm install
npm run dev
```


## Example: Counter

```vue
<script>
  const count = $signal(0);

  $effect(() => {
    console.log(`Count is ${count()}`);
  });
</script>

<button onclick={() => count(c => c + 1)}>
  Count: {{ count() }}
</button>

<style>
  /* Styles are scoped by default to prevent style bleeding 🎉 */
  button {
    background: #333;
    border: 0;
    color: #fff;
  }
</style>
```

---

## Status
Thyn is in early development. Expect sharp edges and limited integrations. Feedback welcome!
