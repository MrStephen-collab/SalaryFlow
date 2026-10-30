const CDP = "http://127.0.0.1:9222";
const list = await fetch(`${CDP}/json/list`).then((r) => r.json());
const target = list.find((t) => t.type === "page" && t.webSocketDebuggerUrl);
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
let id = 0;
const pending = new Map();
ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(JSON.stringify(message.error)));
    else resolve(message.result);
  }
};
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const mid = ++id;
  pending.set(mid, { resolve, reject });
  ws.send(JSON.stringify({ id: mid, method, params }));
});
const evaluate = async (expression) => {
  const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
};
const waitFor = async (expression, timeout = 45000) => {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (await evaluate(`Boolean(${expression})`)) return true;
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
};
await send("Page.enable");
await send("Runtime.enable");
await send("Page.navigate", { url: "https://salaryflow-two.vercel.app/auth/login" });
await waitFor("!!document.querySelector('input[type=email]')", 60000);
await new Promise((r) => setTimeout(r, 800));
await evaluate(`(() => {
  const set = (el, v) => { const d = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value'); d.set.call(el, v); el.dispatchEvent(new Event('input', {bubbles:true})); el.dispatchEvent(new Event('change', {bubbles:true})); };
  set(document.querySelector('input[type=email]'), 'chairman@royalbirds.com');
  set(document.querySelector('input[type=password]'), 'SfOwner2026');
  const f = document.querySelector('form');
  const b = f.querySelector('button[type=submit]') || [...f.querySelectorAll('button')].find(x => /sign in/i.test(x.textContent));
  b && b.click(); return 'ok';
})()`);
await waitFor("location.pathname !== '/auth/login'", 90000);
await new Promise((r) => setTimeout(r, 3000));
await send("Page.navigate", { url: "https://salaryflow-two.vercel.app/dashboard/settings" });
await waitFor("(document.body && document.body.innerText.includes('Owner NIN Verification'))", 90000);
await new Promise((r) => setTimeout(r, 2500));
console.log("SETTINGS_OK", await evaluate(`!!document.body.innerText.includes('Owner NIN Verification') && !!document.querySelector('input[placeholder=\"11-digit NIN\"]')`));
console.log("NIN_VALUE", await evaluate(`document.querySelector('input[placeholder=\"11-digit NIN\"]')?.value ?? null`));
console.log("HAS_UPLOAD", await evaluate(`!!document.body.innerText.includes('Upload the organization owner') || !!document.querySelector('input[type=file]')`));

await send("Page.navigate", { url: "https://salaryflow-two.vercel.app/dashboard/members" });
await waitFor("(document.body && document.body.innerText.includes('External Members'))", 90000);
await new Promise((r) => setTimeout(r, 3000));
console.log("MEMBERS_PAGE_OK", await evaluate(`!!document.body.innerText.includes('External Members')`));
console.log("HAS_APPROVE", await evaluate(`[...document.querySelectorAll('button')].some(b => /Approve/i.test(b.textContent || ''))`));

ws.close();
process.exit(0);
