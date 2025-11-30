// Sabudh premium landing + chat
(() => {
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));

  // Landing / shell
  const landing = document.getElementById("landing");
  const chatShell = document.getElementById("chatShell");
  const startChatBtn = document.getElementById("startChat");
  const viewDashboardBtn = document.getElementById("viewDashboard");
  const backToLandingBtn = document.getElementById("backToLanding");

  // Chat elements
  const chatWindow = $("#chatWindow");
  const chatForm = $("#chatForm");
  const userInput = $("#userInput");
  const clearBtn = $("#clearChat");
  const chatSelect = $("#chatSelect");
  const newChatBtn = $("#newChat");
  const themeBtn = $("#themeBtn");
  const fileInput = $("#fileInput");
  const uploadBtn = $("#uploadBtn");
  const sourcesList = $("#sourcesList");

  // State
  let chats = JSON.parse(
    localStorage.getItem("sabudh_chats") ||
      '[{"id":"default","messages":[],"title":"New Chat"}]'
  );
  let currentChatId = "default";

  function init() {
    bindLandingToggles();
    loadCurrentChat();
    updateChatSelector();
    bindQuickReplyButtons();
    bindHeroPills();
    bindNav();
    bindChat();
    bindUpload();
    bindTheme();
    bindEmoji();
    updateStats();
    loadSources();
    initCanvas();

    document.body.dataset.theme =
      localStorage.getItem("sabudh_theme") || "dark";
  }

  /* Landing <-> chat */
  function showChat(view = "chat") {
    if (landing) landing.style.display = "none";
    chatShell?.classList.remove("hidden");
    const btn = document.querySelector(`[data-view="${view}"]`);
    btn?.click();
  }

  function showLanding() {
    chatShell?.classList.add("hidden");
    if (landing) landing.style.display = "flex";
  }

  function bindLandingToggles() {
    startChatBtn?.addEventListener("click", () => showChat("chat"));
    viewDashboardBtn?.addEventListener("click", () => showChat("sources"));
    backToLandingBtn?.addEventListener("click", showLanding);
  }

  /* Multi-chat */
  function loadCurrentChat() {
    const chat = chats.find((c) => c.id === currentChatId);
    if (!chatWindow) return;
    chatWindow.innerHTML = "";
    if (chat?.quickRepliesShown) renderQuickReplies();
    chat?.messages.forEach((msg) => appendMessage(msg.who, msg.html, false));
  }

  function updateChatSelector() {
    if (!chatSelect) return;
    chatSelect.innerHTML = chats
      .map(
        (chat) =>
          `<option value="${chat.id}" ${
            chat.id === currentChatId ? "selected" : ""
          }>${chat.title}</option>`
      )
      .join("");
    const countEl = $("#chatCount");
    if (countEl) countEl.textContent = chats.length;
  }

  chatSelect?.addEventListener("change", (e) => {
    currentChatId = e.target.value;
    loadCurrentChat();
  });

  newChatBtn?.addEventListener("click", () => {
    const newId = "chat_" + Date.now();
    chats.unshift({ id: newId, messages: [], title: "New Chat" });
    currentChatId = newId;
    localStorage.setItem("sabudh_chats", JSON.stringify(chats));
    updateChatSelector();
    loadCurrentChat();
  });

  /* Messaging */
  function appendMessage(who, html, animate = true) {
    if (!chatWindow) return;
    const el = document.createElement("div");
    el.className = `msg ${who}-msg ${animate ? "bubble-pop" : ""}`;
    el.innerHTML = `
      <div class="msg-avatar ${who}-avatar"></div>
      <div class="bubble">${html}</div>
    `;
    chatWindow.appendChild(el);
    chatWindow.scrollTop = chatWindow.scrollHeight;

    const chat = chats.find((c) => c.id === currentChatId);
    if (!chat) return;
    chat.messages.push({ who, html });
    localStorage.setItem("sabudh_chats", JSON.stringify(chats));
  }

  function setTyping() {
    if (!chatWindow) return null;
    const typing = document.createElement("div");
    typing.className = "msg bot-msg typing";
    typing.innerHTML = `
      <div class="msg-avatar bot-avatar"></div>
      <div class="bubble">
        <div class="typing-dots">
          <span></span><span></span><span></span>
        </div>
      </div>
    `;
    chatWindow.appendChild(typing);
    chatWindow.scrollTop = chatWindow.scrollHeight;
    return typing;
  }

  /* Quick replies inside chat */
  function renderQuickReplies() {
    if (!chatWindow) return;
    const qr = document.createElement("div");
    qr.className = "quick-replies";
    qr.innerHTML = `
      <button class="quick-btn" data-query="What are dengue symptoms?">Dengue symptoms</button>
      <button class="quick-btn" data-query="Asthma treatment options">Asthma treatment</button>
      <button class="quick-btn" data-query="COVID prevention tips">COVID prevention</button>
    `;
    chatWindow.insertBefore(qr, chatWindow.firstChild);
  }

  function bindQuickReplyButtons() {
    $$(".quick-btn, #quickReplies").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        if (!chatForm || !userInput) return;
        const query = e.target.dataset?.query || e.target.textContent;
        if (query) {
          userInput.value = query;
          chatForm.dispatchEvent(new Event("submit"));
        }
      });
    });
  }

  /* Landing pills -> chat prompts */
  function bindHeroPills() {
    const pills = document.querySelectorAll(".landing-pill");
    pills.forEach((pill) => {
      pill.addEventListener("click", () => {
        if (!chatForm || !userInput) return;
        showChat("chat");
        userInput.value = `I want help with: ${pill.textContent
          .trim()
          .toLowerCase()}`;
        chatForm.dispatchEvent(new Event("submit"));
      });
    });
  }

  /* Chat submit -> /api/chat */
  function bindChat() {
    if (!chatForm) return;

    chatForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!userInput) return;
      const q = userInput.value.trim();
      if (!q) return;

      appendMessage("user", q);
      userInput.value = "";

      const typing = setTyping();

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: q }),
        });
        const data = await res.json();
        if (typing) typing.remove();

        const answer = data.answer || "Sorry, I could not generate a response.";
        appendMessage("bot", `<strong>Dr. Sabudh</strong> — ${answer}`);
      } catch (err) {
        if (typing) typing.remove();
        appendMessage(
          "bot",
          `<strong>Dr. Sabudh</strong> — There was an error talking to the server.`
        );
        console.error(err);
      }

      updateStats();
    });

    clearBtn?.addEventListener("click", () => {
      const chat = chats.find((c) => c.id === currentChatId);
      if (!chat) return;
      chat.messages = [];
      loadCurrentChat();
    });
  }

  /* Nav */
  function bindNav() {
    $$(".nav-btn").forEach((b) =>
      b.addEventListener("click", (e) => {
        $$(".nav-btn").forEach((x) => x.classList.remove("active"));
        e.target.classList.add("active");
        const view = e.target.dataset.view;
        ["chat", "ingest", "sources", "activity", "settings"].forEach((v) => {
          $(`#view-${v}`)?.classList.toggle("hidden", v !== view);
        });
      })
    );
  }

  /* Upload + ingestion */
  function bindUpload() {
    if (!uploadBtn || !fileInput) return;

    uploadBtn.addEventListener("click", async () => {
      if (!fileInput.files[0]) return;
      const f = fileInput.files[0];
      const statusEl = $("#uploadStatus");
      if (statusEl) statusEl.textContent = `Uploading ${f.name}...`;

      try {
        const form = new FormData();
        form.append("file", f);

        const upRes = await fetch("/api/ingest/upload", {
          method: "POST",
          body: form,
        });
        const upData = await upRes.json();
        if (!upData.ok) throw new Error(upData.error || "Upload failed");

        if (statusEl) statusEl.textContent = "Running ingestion...";
        await fetch("/api/ingest/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            path: upData.path,
            chunk_size: 1000,
            overlap: 200,
          }),
        });

        if (statusEl)
          statusEl.textContent = `${f.name} uploaded & ingestion started`;
        updateStats();
        loadSources();
      } catch (err) {
        console.error(err);
        const statusEl = $("#uploadStatus");
        if (statusEl) statusEl.textContent = "Upload or ingestion failed.";
      }
    });
  }

  /* Stats & sources */
  async function updateStats() {
    const qEl = $("#queriesToday");
    const sEl = $("#sourcesCount");
    try {
      const res = await fetch("/api/dashboard/stats");
      const data = await res.json();
      if (qEl) qEl.textContent = data.queries_today ?? 0;
      if (sEl) sEl.textContent = data.docs ?? "—";
    } catch {
      if (qEl)
        qEl.textContent = chats.reduce(
          (sum, c) => sum + c.messages.filter((m) => m.who === "user").length,
          0
        );
    }
  }

  async function loadSources() {
    if (!sourcesList) return;
    try {
      const res = await fetch("/api/sources");
      const list = await res.json();
      sourcesList.innerHTML = "";
      if (!list.length) {
        sourcesList.textContent = "No sources indexed.";
        return;
      }
      list.forEach((src) => {
        const div = document.createElement("div");
        div.className = "source-item";
        div.innerHTML = `<b>${src.name}</b>
          <div class="small muted">${src.chunks} chunks</div>
          <div class="small muted">${src.summary}</div>`;
        sourcesList.appendChild(div);
      });
    } catch {
      sourcesList.textContent = "Could not load sources.";
    }
  }

  /* Theme */
  function bindTheme() {
    if (!themeBtn) return;
    themeBtn.addEventListener("click", () => {
      const isDark = document.body.dataset.theme === "light";
      document.body.dataset.theme = isDark ? "dark" : "light";
      themeBtn.textContent = isDark ? "🌙 Dark" : "☀️ Light";
      const currentTheme = $("#currentTheme");
      if (currentTheme) currentTheme.textContent = isDark ? "Dark" : "Light";
      localStorage.setItem("sabudh_theme", document.body.dataset.theme);
    });
  }

  /* Emoji */
  function bindEmoji() {
    $$(".emoji-trigger").forEach((btn) => {
      btn.addEventListener("click", () => {
        const picker = $("#emojiPicker");
        if (!picker) return;
        picker.classList.toggle("hidden");
        picker.style.bottom = "100px";
      });
    });

    const picker = $("#emojiPicker");
    if (!picker) return;
    picker.addEventListener("click", (e) => {
      if (e.target.tagName === "SPAN") {
        if (!userInput) return;
        userInput.value += e.target.textContent;
        userInput.focus();
        picker.classList.add("hidden");
      }
    });
  }

  /* Canvas background stub */
  function initCanvas() {
    // optional: add background animation here
  }

  document.addEventListener("DOMContentLoaded", init);
})();
