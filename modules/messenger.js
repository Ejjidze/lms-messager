import { apiRequest } from "/modules/common.js";

function formatMessageTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function getDirectPeerName(chatTitle, currentUserName) {
  const normalizedTitle = String(chatTitle || "");
  const parts = normalizedTitle.split("↔").map((item) => item.trim()).filter(Boolean);
  if (parts.length < 2) {
    return normalizedTitle;
  }

  const current = String(currentUserName || "").trim().toLowerCase();
  const peer = parts.find((name) => name.toLowerCase() !== current) || parts[0];
  return peer;
}

export function renderMessengerPage(session) {
  const chatList = document.getElementById("chatList");
  const messageHistory = document.getElementById("messageHistory");
  const messageForm = document.getElementById("messageForm");
  const messageInput = document.getElementById("messageInput");
  const titleElement = document.getElementById("chatWindowTitle");
  const metaElement = document.getElementById("chatWindowMeta");

  if (!chatList || !messageHistory || !messageForm || !messageInput || !titleElement || !metaElement) {
    return;
  }

  const state = {
    activeChatId: null,
    pollId: null,
    preferredChatId: null,
  };
  const params = new URLSearchParams(window.location.search);
  const preferredPeerId = Number(params.get("peer") || "0");
  const hasPreferredPeer = Number.isInteger(preferredPeerId) && preferredPeerId > 0;
  const autoResizeMessageInput = () => {
    messageInput.style.height = "auto";
    const nextHeight = Math.min(messageInput.scrollHeight, 160);
    messageInput.style.height = `${Math.max(nextHeight, 44)}px`;
  };
  autoResizeMessageInput();
  if (!messageInput.dataset.boundAutosize) {
    messageInput.dataset.boundAutosize = "true";
    messageInput.addEventListener("input", autoResizeMessageInput);
  }
  if (!messageInput.dataset.boundEnterSend) {
    messageInput.dataset.boundEnterSend = "true";
    messageInput.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") {
        return;
      }
      if (event.shiftKey) {
        return;
      }
      event.preventDefault();
      messageForm.requestSubmit();
    });
  }

  const renderChatMessages = (chatData) => {
    const isDirect = chatData.chat_type === "direct";
    titleElement.textContent = isDirect
      ? getDirectPeerName(chatData.title, session.name)
      : chatData.title;
    metaElement.textContent = isDirect ? "Личный чат преподаватель ↔ студент" : "Чат курса";

    const messages = Array.isArray(chatData.messages) ? chatData.messages : [];
    if (!messages.length) {
      messageHistory.innerHTML = "<p class='submission-meta'>Пока нет сообщений.</p>";
      return;
    }

    messageHistory.innerHTML = messages
      .map((message) => {
        const outgoing = message.sender_id === session.userId;
        const timeText = formatMessageTime(message.created_at);
        const attachment = message.attachment_url
          ? `<a class="btn btn-outline-secondary btn-sm mt-2" href="${message.attachment_url}" target="_blank" rel="noopener noreferrer">Открыть вложение</a>`
          : "";
        return `
          <article class="message ${outgoing ? "outgoing" : ""}">
            <p>${message.content}</p>
            ${attachment}
            <div class="message-meta">
              <span class="message-time">${timeText}</span>
              <span class="message-state">${message.status}</span>
            </div>
          </article>
        `;
      })
      .join("");
    messageHistory.scrollTop = messageHistory.scrollHeight;
  };

  const openChat = async (chatId) => {
    try {
      const chatData = await apiRequest(`/api/chats/${chatId}`);
      state.activeChatId = chatData.id;
      renderChatMessages(chatData);
      chatList.querySelectorAll(".chat-item").forEach((item) => {
        item.classList.toggle("active", Number(item.dataset.chatId) === chatData.id);
      });
    } catch (error) {
      messageHistory.innerHTML = `<p class='submission-meta'>${error.message || "Не удалось открыть чат."}</p>`;
    }
  };

  const loadChats = async () => {
    try {
      if (hasPreferredPeer) {
        const directChat = await apiRequest(`/api/chats/direct/${preferredPeerId}`, {
          method: "POST",
        });
        state.preferredChatId = directChat.id;
      }

      const chats = await apiRequest("/api/chats");
      if (!Array.isArray(chats) || !chats.length) {
        chatList.innerHTML = "<p class='submission-meta'>Нет доступных чатов.</p>";
        titleElement.textContent = "Нет чатов";
        metaElement.textContent = "Создайте чат в системе";
        messageHistory.innerHTML = "<p class='submission-meta'>Пока сообщений нет.</p>";
        return;
      }

      chatList.innerHTML = chats
        .map((chat) => `
          <article class="chat-item ${state.activeChatId === chat.id ? "active" : ""}" data-chat-id="${chat.id}">
            <div class="chat-item-top">
              <strong>${chat.chat_type === "direct" ? getDirectPeerName(chat.title, session.name) : chat.title}</strong>
              <span class="badge success">${chat.chat_type}</span>
            </div>
            <p class="chat-subtitle">${chat.chat_type === "direct" ? "Личный диалог" : "Курсовой чат"}</p>
          </article>
        `)
        .join("");

      if (!chatList.dataset.bound) {
        chatList.dataset.bound = "true";
        chatList.addEventListener("click", async (event) => {
          const chatItem = event.target.closest("[data-chat-id]");
          if (!chatItem) {
            return;
          }
          await openChat(Number(chatItem.dataset.chatId));
        });
      }

      if (!state.activeChatId) {
        const preferred = chats.find((chat) => chat.id === state.preferredChatId)
          || chats.find((chat) => chat.chat_type === "direct")
          || chats[0];
        await openChat(preferred.id);
      }
    } catch (error) {
      chatList.innerHTML = `<p class='submission-meta'>${error.message || "Не удалось загрузить чаты."}</p>`;
      messageHistory.innerHTML = "<p class='submission-meta'>Чаты недоступны.</p>";
    }
  };

  if (!messageForm.dataset.bound) {
    messageForm.dataset.bound = "true";
    messageForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const content = messageInput.value.trim();
      if (!content || !state.activeChatId) {
        return;
      }

      try {
        await apiRequest(`/api/chats/${state.activeChatId}/messages`, {
          method: "POST",
          body: JSON.stringify({
            content,
            message_type: "text",
          }),
        });
        messageInput.value = "";
        autoResizeMessageInput();
        await openChat(state.activeChatId);
      } catch (error) {
        metaElement.textContent = error.message || "Не удалось отправить сообщение.";
      }
    });
  }

  loadChats();
  state.pollId = window.setInterval(async () => {
    if (state.activeChatId) {
      await openChat(state.activeChatId);
    } else {
      await loadChats();
    }
  }, 3000);
}
