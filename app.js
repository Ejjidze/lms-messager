const state = {
  activeRole: "student",
  activeLesson: null,
  activeChatId: 1,
  courses: [
    {
      id: 1,
      title: "Fullstack Web Development",
      description: "HTML, CSS, JavaScript, FastAPI и проектирование полноценных веб-приложений.",
      category: "Programming",
      level: "Intermediate",
      teacher: "Алина Каримова",
      students: 120,
      progress: 72
    },
    {
      id: 2,
      title: "UX/UI Design Essentials",
      description: "Исследования пользователей, wireframes, интерфейсы и прототипирование.",
      category: "Design",
      level: "Beginner",
      teacher: "Ирина Соколова",
      students: 80,
      progress: 54
    },
    {
      id: 3,
      title: "Digital Marketing Sprint",
      description: "Контент-стратегия, аналитика, SEO и запуск рекламных кампаний.",
      category: "Marketing",
      level: "Advanced",
      teacher: "Евгений Литвинов",
      students: 64,
      progress: 31
    }
  ],
  modules: [
    {
      id: 1,
      title: "Модуль 1. Введение в LMS",
      lessons: [
        {
          id: 1,
          title: "Введение в платформу",
          description: "Обзор ролей пользователей, ключевых разделов и логики работы LMS.",
          meta: ["Текст", "Видео", "PDF", "15 минут"]
        },
        {
          id: 2,
          title: "Структура курса",
          description: "Модули, уроки, файлы, внешние ссылки и последовательное обучение.",
          meta: ["Текст", "Ссылки", "DOC", "22 минуты"]
        }
      ]
    },
    {
      id: 2,
      title: "Модуль 2. Задания и тесты",
      lessons: [
        {
          id: 3,
          title: "Создание задания",
          description: "Типы заданий: текст, файл, тест. Настройка дедлайнов и критериев оценки.",
          meta: ["Видео", "Текст", "18 минут"]
        },
        {
          id: 4,
          title: "Автоматическое тестирование",
          description: "Один или несколько правильных ответов, автопроверка и баллы.",
          meta: ["Текст", "Quiz", "13 минут"]
        }
      ]
    }
  ],
  assignments: [
    {
      title: "Спроектировать карточку курса",
      deadline: "02 апреля",
      type: "Файл",
      status: "Ожидает сдачи"
    },
    {
      title: "Написать use case для LMS",
      deadline: "04 апреля",
      type: "Текст",
      status: "На проверке"
    },
    {
      title: "Настроить роли пользователей",
      deadline: "07 апреля",
      type: "Тест",
      status: "Проверено: 92/100"
    }
  ],
  notifications: [
    { title: "Новое задание", text: "Преподаватель добавил задание по проектированию интерфейса.", time: "10:15" },
    { title: "Новый ответ", text: "Вы получили комментарий к отправленному домашнему заданию.", time: "09:48" },
    { title: "Новое сообщение", text: "В групповом чате курса 4 непрочитанных сообщения.", time: "09:31" },
    { title: "Системное уведомление", text: "Плановое обновление платформы назначено на воскресенье.", time: "Вчера" }
  ],
  chats: [
    {
      id: 1,
      title: "Frontend Bootcamp",
      subtitle: "Групповой чат курса",
      online: true,
      messages: [
        { author: "Алина", text: "Сегодня до 18:00 загружаем макеты на проверку.", time: "09:20", state: "прочитано", outgoing: false },
        { author: "Вы", text: "Принято, добавлю экран мессенджера и панель курсов.", time: "09:27", state: "прочитано", outgoing: true },
        { author: "Алина", text: "Отлично, обратите внимание на адаптивность и UX мобильной версии.", time: "09:29", state: "доставлено", outgoing: false }
      ]
    },
    {
      id: 2,
      title: "Алина Каримова",
      subtitle: "Личный чат преподаватель ↔ студент",
      online: true,
      messages: [
        { author: "Алина", text: "Если понадобится, могу отдельно проверить структуру курсовой работы.", time: "Вчера", state: "прочитано", outgoing: false },
        { author: "Вы", text: "Спасибо, я ещё добавлю UML-диаграммы в описание проекта.", time: "Вчера", state: "прочитано", outgoing: true }
      ]
    },
    {
      id: 3,
      title: "Admin Desk",
      subtitle: "Административный канал",
      online: false,
      messages: [
        { author: "Система", text: "Поступила жалоба на контент курса SMM Sprint.", time: "08:02", state: "доставлено", outgoing: false },
        { author: "Модератор", text: "Проверка назначена на сегодня после 14:00.", time: "08:10", state: "прочитано", outgoing: false }
      ]
    }
  ],
  roleConfig: {
    student: {
      action: "Записаться",
      profileName: "Назир Г.",
      profileRole: "Student",
      profileBio: "Осваивает веб-разработку, UI/UX и современные инструменты онлайн-обучения."
    },
    teacher: {
      action: "Создать курс",
      profileName: "Алина Каримова",
      profileRole: "Teacher",
      profileBio: "Создаёт учебные программы, проверяет задания и сопровождает студентов по курсу."
    },
    admin: {
      action: "Управлять системой",
      profileName: "Системный администратор",
      profileRole: "Admin",
      profileBio: "Следит за пользователями, модерацией контента и общей стабильностью платформы."
    }
  }
};

const courseList = document.getElementById("courseList");
const moduleList = document.getElementById("moduleList");
const assignmentList = document.getElementById("assignmentList");
const notificationList = document.getElementById("notificationList");
const chatList = document.getElementById("chatList");
const messageHistory = document.getElementById("messageHistory");
const lessonTitle = document.getElementById("lessonTitle");
const lessonDescription = document.getElementById("lessonDescription");
const lessonMeta = document.getElementById("lessonMeta");
const activeChatTitle = document.getElementById("activeChatTitle");
const activeChatSubtitle = document.getElementById("activeChatSubtitle");
const typingIndicator = document.getElementById("typingIndicator");
const roleActionButton = document.getElementById("roleActionButton");
const profileName = document.getElementById("profileName");
const profileRole = document.getElementById("profileRole");
const profileBio = document.getElementById("profileBio");
const presenceStatus = document.getElementById("presenceStatus");

function renderCourses() {
  const search = document.getElementById("courseSearch").value.toLowerCase();
  const category = document.getElementById("categoryFilter").value;
  const level = document.getElementById("levelFilter").value;

  const filteredCourses = state.courses.filter((course) => {
    const matchesSearch =
      course.title.toLowerCase().includes(search) ||
      course.description.toLowerCase().includes(search) ||
      course.teacher.toLowerCase().includes(search);
    const matchesCategory = category === "all" || course.category === category;
    const matchesLevel = level === "all" || course.level === level;
    return matchesSearch && matchesCategory && matchesLevel;
  });

  courseList.innerHTML = filteredCourses
    .map(
      (course) => `
        <article class="course-card">
          <div class="course-card-top">
            <strong>${course.title}</strong>
            <span class="course-tag">${course.category}</span>
          </div>
          <p>${course.description}</p>
          <div class="course-card-meta">
            <span>${course.level}</span>
            <span>${course.teacher}</span>
            <span>${course.students} студентов</span>
          </div>
          <div class="course-card-meta">
            <span>Прогресс: ${course.progress}%</span>
            <button class="ghost-button">${state.roleConfig[state.activeRole].action}</button>
          </div>
        </article>
      `
    )
    .join("");
}

function renderModules() {
  moduleList.innerHTML = state.modules
    .map(
      (module) => `
        <article class="module-card">
          <strong>${module.title}</strong>
          <p>${module.lessons.length} урока</p>
          ${module.lessons
            .map(
              (lesson) => `
                <button class="ghost-button lesson-button" data-lesson-id="${lesson.id}">
                  ${lesson.title}
                </button>
              `
            )
            .join("")}
        </article>
      `
    )
    .join("");

  document.querySelectorAll(".lesson-button").forEach((button) => {
    button.addEventListener("click", () => {
      const lessonId = Number(button.dataset.lessonId);
      const lesson = state.modules.flatMap((module) => module.lessons).find((item) => item.id === lessonId);
      if (!lesson) {
        return;
      }

      state.activeLesson = lesson;
      lessonTitle.textContent = lesson.title;
      lessonDescription.textContent = lesson.description;
      lessonMeta.innerHTML = lesson.meta.map((item) => `<span>${item}</span>`).join("");
    });
  });
}

function renderAssignments() {
  assignmentList.innerHTML = state.assignments
    .map(
      (assignment) => `
        <article class="assignment-card">
          <div class="assignment-card-header">
            <strong>${assignment.title}</strong>
            <span class="course-tag">${assignment.type}</span>
          </div>
          <p>Дедлайн: ${assignment.deadline}</p>
          <p>${assignment.status}</p>
        </article>
      `
    )
    .join("");
}

function renderNotifications() {
  notificationList.innerHTML = state.notifications
    .map(
      (item) => `
        <article class="notification-item">
          <div>
            <strong>${item.title}</strong>
            <p>${item.text}</p>
          </div>
          <span>${item.time}</span>
        </article>
      `
    )
    .join("");
}

function renderChats() {
  const search = document.getElementById("chatSearch").value.toLowerCase();
  const filteredChats = state.chats.filter((chat) => {
    const matchesMeta =
      chat.title.toLowerCase().includes(search) ||
      chat.subtitle.toLowerCase().includes(search);
    const matchesMessages = chat.messages.some((message) => message.text.toLowerCase().includes(search));
    return matchesMeta || matchesMessages;
  });

  chatList.innerHTML = filteredChats
    .map(
      (chat) => `
        <article class="chat-item ${chat.id === state.activeChatId ? "active" : ""}" data-chat-id="${chat.id}">
          <div class="chat-item-top">
            <strong>${chat.title}</strong>
            <span class="badge ${chat.online ? "success" : ""}">${chat.online ? "online" : "offline"}</span>
          </div>
          <p class="chat-subtitle">${chat.subtitle}</p>
          <p class="chat-subtitle">${chat.messages.at(-1)?.text ?? ""}</p>
        </article>
      `
    )
    .join("");

  document.querySelectorAll(".chat-item").forEach((item) => {
    item.addEventListener("click", () => {
      state.activeChatId = Number(item.dataset.chatId);
      renderChats();
      renderMessages();
    });
  });
}

function renderMessages() {
  const chat = state.chats.find((item) => item.id === state.activeChatId);
  if (!chat) {
    return;
  }

  activeChatTitle.textContent = chat.title;
  activeChatSubtitle.textContent = chat.subtitle;
  presenceStatus.textContent = chat.online ? "Online" : "Offline";
  presenceStatus.className = `badge ${chat.online ? "success" : ""}`;

  messageHistory.innerHTML = chat.messages
    .map(
      (message) => `
        <article class="message ${message.outgoing ? "outgoing" : ""}">
          <p><strong>${message.author}:</strong> ${message.text}</p>
          <div class="message-meta">
            <span class="message-time">${message.time}</span>
            <span class="message-state">${message.state}</span>
          </div>
        </article>
      `
    )
    .join("");

  messageHistory.scrollTop = messageHistory.scrollHeight;
}

function updateRole(role) {
  state.activeRole = role;
  document.querySelectorAll(".role-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.role === role);
  });

  const config = state.roleConfig[role];
  roleActionButton.textContent = config.action;
  profileName.textContent = config.profileName;
  profileRole.textContent = config.profileRole;
  profileBio.textContent = config.profileBio;
  renderCourses();
}

document.querySelectorAll(".role-button").forEach((button) => {
  button.addEventListener("click", () => updateRole(button.dataset.role));
});

document.querySelectorAll(".nav-link").forEach((link) => {
  link.addEventListener("click", () => {
    document.querySelectorAll(".nav-link").forEach((item) => item.classList.remove("active"));
    link.classList.add("active");
  });
});

document.getElementById("courseSearch").addEventListener("input", renderCourses);
document.getElementById("categoryFilter").addEventListener("change", renderCourses);
document.getElementById("levelFilter").addEventListener("change", renderCourses);
document.getElementById("chatSearch").addEventListener("input", renderChats);

document.getElementById("quizForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const selected = [...document.querySelectorAll('input[name="quiz"]:checked')].map((item) => item.value);
  const expected = ["history", "typing", "pagination"];
  const correct = expected.every((value) => selected.includes(value)) && selected.length === expected.length;

  const result = document.getElementById("quizResult");
  result.textContent = correct
    ? "Верно: история сообщений, индикатор набора и пагинация обязательны для чата."
    : "Не совсем. Попробуйте отметить функции, напрямую связанные с работой мессенджера.";
  result.style.color = correct ? "var(--success)" : "var(--danger)";
});

document.getElementById("messageInput").addEventListener("input", () => {
  typingIndicator.classList.add("visible");
  clearTimeout(window.typingTimeout);
  window.typingTimeout = setTimeout(() => {
    typingIndicator.classList.remove("visible");
  }, 1200);
});

document.getElementById("messageForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const input = document.getElementById("messageInput");
  const text = input.value.trim();
  if (!text) {
    return;
  }

  const chat = state.chats.find((item) => item.id === state.activeChatId);
  chat.messages.push({
    author: "Вы",
    text,
    time: "Сейчас",
    state: "отправлено",
    outgoing: true
  });
  input.value = "";
  typingIndicator.classList.remove("visible");
  renderChats();
  renderMessages();

  setTimeout(() => {
    chat.messages.push({
      author: chat.title === "Admin Desk" ? "Система" : chat.title.split(" ")[0],
      text: "Сообщение получено. Продолжаем работу в чате платформы.",
      time: "Сейчас",
      state: "доставлено",
      outgoing: false
    });
    renderChats();
    renderMessages();
  }, 900);
});

document.getElementById("fileButton").addEventListener("click", () => {
  const chat = state.chats.find((item) => item.id === state.activeChatId);
  chat.messages.push({
    author: "Вы",
    text: "Файл прикреплён: project-specification.pdf",
    time: "Сейчас",
    state: "отправлено",
    outgoing: true
  });
  renderChats();
  renderMessages();
});

renderCourses();
renderModules();
renderAssignments();
renderNotifications();
renderChats();
renderMessages();
