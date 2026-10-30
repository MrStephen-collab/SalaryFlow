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
const waitFor = async (expression, timeout = 60000) => {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (await evaluate(`Boolean(${expression})`)) return true;
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
};
const setInput = (expression) => evaluate(`(() => {
  const set = (el, v) => { const d = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value'); d.set.call(el, v); el.dispatchEvent(new Event('input', {bubbles:true})); el.dispatchEvent(new Event('change', {bubbles:true})); };
  const email = document.querySelector('input[type=email]');
  const password = document.querySelector('input[type=password]');
  set(email, 'chairman@royalbirds.com');
  set(password, 'SfOwner2026');
  const f = document.querySelector('form');
  const b = f.querySelector('button[type=submit]') || [...f.querySelectorAll('button')].find(x => /sign in/i.test(x.textContent));
  b && b.click(); return 'ok';
})()`);

await send("Page.enable");
await send("Runtime.enable");
await send("Page.navigate", { url: "https://salaryflow-two.vercel.app/dashboard/settings" });
const landedOnLogin = (await waitFor("location.pathname === '/auth/login'", 30000));
console.log("LANDED_ON_LOGIN", landedOnLogin);
if (landedOnLogin) {
  await waitFor("!!document.querySelector('input[type=email]')", 90000);
  await new Promise((r) => setTimeout(r, 800));
  await setInput();
  await waitFor("location.pathname !== '/auth/login'", 120000);
  await new Promise((r) => setTimeout(r, 4000));
}
await waitFor("(document.body && document.body.innerText.includes('Owner NIN Verification'))", 120000);
await new Promise((r) => setTimeout(r, 3000));
console.log("NIN_INPUT_COUNT", await evaluate(`document.querySelectorAll('input[placeholder=\"11-digit NIN\"]').length`));
console.log("NIN_VALUE", await evaluate(`document.querySelector('input[placeholder=\"11-digit NIN\"]')?.value ?? null`));
console.log("HAS_UPLOAD", await evaluate(`!!document.body.innerText.includes('Upload the organization owner')`));
console.log("SAVE_BTN", await evaluate(`[...document.querySelectorAll('button')].map(b => b.textContent).filter(t => /Save/i.test(t || '')).join(',')`));

await send("Page.navigate", { url: "https://salaryflow-two.vercel.app/dashboard" });
await waitFor("(document.body && document.body.innerText.includes('Member Loans Disbursed'))", 120000);
await new Promise((r) => setTimeout(r, 3000));
console.log("MEMBER_CARDS", await evaluate(`!!document.body.innerText.includes('Member Loans Disbursed') && !!document.body.innerText.includes('Member Savings Deposited') && !!document.body.innerText.includes('Total Members') && !!document.body.innerText.includes('Pending Member Approvals')`));

ws.close();
process.exit(0);
