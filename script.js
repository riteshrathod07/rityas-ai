const API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent";

const SYSTEM_PROMPT = `
You are RITYA'S AI, a friendly, intelligent and helpful personal AI assistant.

Your personality:
- Be friendly, warm, smart and respectful.
- Understand Hindi, English and Hinglish.
- Reply in the language the user prefers.
- Explain complicated topics in simple language.
- Help with coding, writing, education, brainstorming,
  translation, general knowledge and everyday tasks.
- Use clear formatting and examples when useful.
- Be honest when you do not know something.
- Never pretend to have performed actions you cannot perform.
- Be conversational, natural and helpful.
`;

const $ = id => document.getElementById(id);

const messages = $("messages");
const welcome = $("welcome");
const userInput = $("userInput");
const sendBtn = $("sendBtn");

let apiKey = sessionStorage.getItem("ritya_api_key") || "";
let chats = JSON.parse(localStorage.getItem("ritya_chats") || "{}");
let currentChatId = null;
let isLoading = false;

function saveChats() {
  localStorage.setItem("ritya_chats", JSON.stringify(chats));
}

function createChat() {
  currentChatId = Date.now().toString();

  chats[currentChatId] = {
    title: "New Chat",
    messages: []
  };

  saveChats();
  renderMessages();
  renderHistory();
  userInput.focus();
}

function renderHistory() {
  const list = $("historyList");
  list.innerHTML = "";

  Object.entries(chats)
    .sort((a, b) => Number(b[0]) - Number(a[0]))
    .forEach(([id, chat]) => {
      const item = document.createElement("button");

      item.className =
        "history-item" + (id === currentChatId ? " active" : "");

      item.textContent = "💬 " + chat.title;

      item.addEventListener("click", () => {
        currentChatId = id;
        renderMessages();
        renderHistory();

        if (window.innerWidth <= 700) {
          $("sidebar").classList.remove("open");
        }
      });

      list.appendChild(item);
    });
}

function renderMessages() {
  messages.innerHTML = "";

  const chat = chats[currentChatId];

  if (!chat || chat.messages.length === 0) {
    welcome.style.display = "block";
    return;
  }

  welcome.style.display = "none";

  chat.messages.forEach(message => {
    addMessage(message.role, message.text, false);
  });

  scrollToBottom();
}

function addMessage(role, text, animate = true) {
  const wrapper = document.createElement("div");

  wrapper.className = `message ${role === "model" ? "ai" : "user"}`;

  const avatar = document.createElement("div");
  avatar.className = "message-avatar";
  avatar.textContent = role === "model" ? "R" : "Y";

  const content = document.createElement("div");
  content.className = "message-content";

  const name = document.createElement("div");
  name.className = "message-name";
  name.textContent = role === "model" ? "RITYA'S AI" : "You";

  const body = document.createElement("div");
  body.className = "message-text";
  body.textContent = text;

  content.append(name, body);

  if (role === "model") {
    const actions = document.createElement("div");
    actions.className = "message-actions";

    const copy = document.createElement("button");
    copy.className = "copy-btn";
    copy.textContent = "▢ Copy";

    copy.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(text);
        copy.textContent = "✓ Copied!";
        setTimeout(() => copy.textContent = "▢ Copy", 1500);
      } catch {
        copy.textContent = "Copy unavailable";
      }
    });

    actions.appendChild(copy);
    content.appendChild(actions);
  }

  wrapper.append(avatar, content);

  messages.appendChild(wrapper);

  scrollToBottom();
}

function showTyping() {
  const typing = document.createElement("div");

  typing.id = "typingIndicator";
  typing.className = "message ai";

  typing.innerHTML = `
    <div class="message-avatar">R</div>
    <div class="message-content">
      <div class="message-name">RITYA'S AI</div>
      <div class="typing">Thinking<span>...</span></div>
    </div>
  `;

  messages.appendChild(typing);
  scrollToBottom();
}

function removeTyping() {
  $("typingIndicator")?.remove();
}

function scrollToBottom() {
  const area = $("chatArea");

  requestAnimationFrame(() => {
    area.scrollTop = area.scrollHeight;
  });
}

async function askAI() {
  const prompt = userInput.value.trim();

  if (!prompt || isLoading) return;

  if (!apiKey) {
    $("settingsModal").classList.add("show");
    alert("Please add your Gemini API key in Settings first.");
    return;
  }

  if (!currentChatId) {
    createChat();
  }

  isLoading = true;
  sendBtn.disabled = true;

  welcome.style.display = "none";

  const chat = chats[currentChatId];

  chat.messages.push({
    role: "user",
    text: prompt
  });

  if (chat.messages.length === 1) {
    chat.title = prompt.slice(0, 32) +
      (prompt.length > 32 ? "..." : "");
  }

  userInput.value = "";
  userInput.style.height = "auto";

  addMessage("user", prompt);
  renderHistory();
  saveChats();

  showTyping();

  try {
    const history = chat.messages.map(message => ({
      role: message.role,
      parts: [{ text: message.text }]
    }));

    const response = await fetch(
      `${API_URL}?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: SYSTEM_PROMPT }]
          },
          contents: history,
          generationConfig: {
            temperature: 0.8,
            maxOutputTokens: 2048
          }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.error?.message || "API request failed."
      );
    }

    const reply =
      data.candidates?.[0]?.content?.parts
        ?.map(part => part.text || "")
        .join("")
        .trim();

    if (!reply) {
      throw new Error("AI returned an empty response. Please try again.");
    }

    removeTyping();

    chat.messages.push({
      role: "model",
      text: reply
    });

    addMessage("model", reply);

    saveChats();
    renderHistory();

  } catch (error) {
    removeTyping();

    const errorText =
      "Sorry! Something went wrong.\n\n" +
      error.message +
      "\n\nPlease check your API key, internet connection and free API quota.";

    addMessage("model", errorText);

  } finally {
    removeTyping();
    isLoading = false;
    sendBtn.disabled = false;
    userInput.focus();
  }
}

// SEND BUTTON

sendBtn.addEventListener("click", askAI);

// ENTER TO SEND

userInput.addEventListener("keydown", event => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    askAI();
  }
});

// AUTO RESIZE TEXTAREA

userInput.addEventListener("input", () => {
  userInput.style.height = "auto";
  userInput.style.height =
    Math.min(userInput.scrollHeight, 150) + "px";
});

// NEW CHAT

$("newChat").addEventListener("click", () => {
  createChat();

  if (window.innerWidth <= 700) {
    $("sidebar").classList.remove("open");
  }
});

// SETTINGS

$("settingsBtn").addEventListener("click", () => {
  $("apiKey").value = apiKey;
  $("settingsModal").classList.add("show");
});

$("closeModal").addEventListener("click", () => {
  $("settingsModal").classList.remove("show");
});

$("saveKey").addEventListener("click", () => {
  const key = $("apiKey").value.trim();

  if (!key) {
    alert("Please enter a valid API key.");
    return;
  }

  apiKey = key;
  sessionStorage.setItem("ritya_api_key", key);

  $("settingsModal").classList.remove("show");

  alert("API key saved for this browser session! ❤️");
});

// SIDEBAR MOBILE

$("menuBtn").addEventListener("click", () => {
  $("sidebar").classList.add("open");
});

$("closeSidebar").addEventListener("click", () => {
  $("sidebar").classList.remove("open");
});

// SUGGESTION BUTTONS

document.querySelectorAll(".suggestion").forEach(button => {
  button.addEventListener("click", () => {
    userInput.value = button.dataset.prompt;
    askAI();
  });
});

// INITIALIZE

renderHistory();

if (Object.keys(chats).length > 0) {
  currentChatId = Object.keys(chats)
    .sort((a, b) => Number(b) - Number(a))[0];

  renderMessages();
} else {
  welcome.style.display = "block";
}