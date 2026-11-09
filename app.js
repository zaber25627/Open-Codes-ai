const $ = (id) => document.getElementById(id);
const promptBox = $("prompt"), chatArea = $("chatArea"), welcome = $("welcome");
let mode = "assistant", history = [], deferredInstall = null;

function toast(msg) {
  const el = $("toast"); el.textContent = msg; el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 2600);
}
function addMessage(role, text) {
  welcome.style.display = "none";
  const row = document.createElement("div"); row.className = `message ${role}`;
  const avatar = document.createElement("div"); avatar.className = "msg-avatar"; avatar.textContent = role === "user" ? "YOU" : "LC";
  const bubble = document.createElement("div"); bubble.className = "bubble"; bubble.textContent = text;
  row.append(avatar, bubble); chatArea.appendChild(row); row.scrollIntoView({ behavior: "smooth", block: "end" });
  return bubble;
}
function setBusy(busy) {
  $("sendBtn").disabled = busy;
  $("sendBtn").textContent = busy ? "…" : "↑";
}
async function sendMessage(prefill) {
  const message = (prefill || promptBox.value).trim();
  if (!message) return;
  promptBox.value = ""; promptBox.style.height = "auto";
  addMessage("user", message);
  const waiting = addMessage("assistant", "LongCat is thinking…");
  setBusy(true);
  try {
    const response = await fetch("/api/chat", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message, provider: $("provider").value, mode,
        projectType: $("projectType").value, history
      })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Request failed");
    waiting.textContent = data.reply;
    history.push({ role: "user", content: message }, { role: "assistant", content: data.reply });
    history = history.slice(-12);
  } catch (err) {
    waiting.textContent = "⚠ " + err.message;
  } finally { setBusy(false); }
}
$("sendBtn").addEventListener("click", () => sendMessage());
promptBox.addEventListener("keydown", e => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
});
promptBox.addEventListener("input", () => {
  promptBox.style.height = "auto";
  promptBox.style.height = Math.min(promptBox.scrollHeight, 180) + "px";
});
document.querySelectorAll(".mode").forEach(btn => btn.addEventListener("click", () => {
  mode = btn.dataset.mode;
  document.querySelectorAll(".mode").forEach(b => b.classList.toggle("active", b === btn));
  toast(mode === "agent" ? "Agent planning mode selected" : "Coding assistant selected");
}));
document.querySelectorAll(".feature-card").forEach(btn => btn.addEventListener("click", () => {
  promptBox.value = btn.dataset.prompt; promptBox.focus();
}));
$("newChat").addEventListener("click", () => {
  chatArea.replaceChildren(); history = []; welcome.style.display = ""; 
  if (innerWidth <= 760) $("sidebar").classList.remove("open");
});
$("menuBtn").addEventListener("click", () => $("sidebar").classList.toggle("open"));
$("filesNav").addEventListener("click", () => toast("Project file workspace is planned for the next release."));
$("historyNav").addEventListener("click", () => toast("Chat history is currently kept only in this page session."));
async function checkHealth() {
  try {
    const r = await fetch("/api/health"); const d = await r.json();
    $("connectionText").textContent = d.ok ? "Backend online" : "Backend unavailable";
    document.querySelector(".status-dot").classList.toggle("ok", !!d.ok);
    if (!d.providers.openai && !d.providers.longcat) toast("Add an API provider key in Render Environment to start.");
  } catch {
    $("connectionText").textContent = "Backend unavailable";
  }
}
checkHealth();
window.addEventListener("beforeinstallprompt", e => {
  e.preventDefault(); deferredInstall = e; $("installBtn").style.display = "block";
});
$("installBtn").addEventListener("click", async () => {
  if (!deferredInstall) return toast("Use Chrome menu → Add to Home screen / Install app.");
  deferredInstall.prompt(); await deferredInstall.userChoice; deferredInstall = null;
});
if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(()=>{}));
