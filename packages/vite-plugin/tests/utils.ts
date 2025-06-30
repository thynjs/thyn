export function wait() {
  return new Promise(r => setTimeout(r, 10));
}
