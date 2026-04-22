export const STORAGE_KEY = "eduflow-session";
export const AUTH_PAGE_PATHS = new Set(["/", "/login"]);
export const DEFAULT_COURSE_ID = 1;
export const DEMO_USERS = {
  student: {
    username: "student",
    password: "student",
    email: "student@eduflow.local",
    backendPassword: "student123",
  },
  teacher: {
    username: "teacher",
    password: "teacher",
    email: "teacher@eduflow.local",
    backendPassword: "teacher123",
  },
  admin: {
    username: "admin",
    password: "admin",
    email: "admin@eduflow.local",
    backendPassword: "admin123",
  },
};

export const STUDENT_PROFILE_META = {
  direction: "Программный инжиниринг",
  curator: "Baxtiyorov Ubaydullo",
};

export const TEACHER_PROFILE_META = {
  "teacher@eduflow.local": {
    department: "Кафедра программной инженерии",
    dean: "Ибрагимов Дониёр Рашидович",
    office: "A320",
  },
  teacher1: {
    department: "Кафедра веб-технологий",
    dean: "Юлдашев Акмал Бахтиёрович",
    office: "D210",
  },
  teacher2: {
    department: "Кафедра мобильной разработки",
    dean: "Каримова Гулноза Равшановна",
    office: "E112",
  },
  teacher3: {
    department: "Кафедра искусственного интеллекта",
    dean: "Саидов Бекзод Шавкатович",
    office: "B305",
  },
  teacher4: {
    department: "Кафедра информационной безопасности",
    dean: "Петров Алексей Сергеевич",
    office: "C118",
  },
  teacher5: {
    department: "Кафедра системного анализа",
    dean: "Сидорова Марина Викторовна",
    office: "A204",
  },
  teacher6: {
    department: "Кафедра баз данных",
    dean: "Абдуллаев Олим Нурмухамедович",
    office: "D417",
  },
  teacher7: {
    department: "Кафедра компьютерных сетей",
    dean: "Ахмедова Лола Шерзодовна",
    office: "E501",
  },
  teacher8: {
    department: "Кафедра UX/UI проектирования",
    dean: "Кузнецов Павел Ильич",
    office: "B219",
  },
  teacher9: {
    department: "Кафедра алгоритмов и структур данных",
    dean: "Рахимов Жахонгир Акбарович",
    office: "C410",
  },
  teacher10: {
    department: "Кафедра облачных технологий",
    dean: "Мирзаева Феруза Адхамовна",
    office: "A115",
  },
};

export const ADMIN_TEACHER_SUBJECTS = {
  "teacher@eduflow.local": "Разработка мобильных приложений (MAD201)",
  teacher1: "Обеспечение качества ПО (SFQ201)",
  teacher2: "Архитектура программного обеспечения (SWA201)",
  teacher3: "Индивидуальный проект (INP202)",
  teacher4: "Безопасность жизнедеятельности (OEL202)",
  teacher5: "Базы данных (DB301)",
  teacher6: "Компьютерные сети (NET303)",
  teacher7: "Информационная безопасность (SEC304)",
  teacher8: "UX/UI проектирование (UXD305)",
  teacher9: "Алгоритмы и структуры данных (ALG306)",
  teacher10: "Облачные технологии (CLD307)",
};

export const ALLOWED_ASSIGNMENT_MATERIAL_EXTENSIONS = new Set([
  "txt", "doc", "docx", "xls", "xlsx", "ppt", "pptx",
  "png", "jpg", "jpeg", "gif", "webp", "bmp", "tif", "tiff",
  "zip", "rar", "7z", "tar", "gz",
]);

export function getSession() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setSession(session) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearSession() {
  window.localStorage.removeItem(STORAGE_KEY);
}

export function isAuthPage() {
  return AUTH_PAGE_PATHS.has(window.location.pathname);
}

export function requireSession() {
  const session = getSession();
  if (session && !session.accessToken && !isAuthPage()) {
    clearSession();
    window.location.replace("/");
    return null;
  }
  if (!session && !isAuthPage()) {
    window.location.replace("/");
    return null;
  }
  if (session && isAuthPage()) {
    window.location.replace(session.role === "admin" ? "/admin" : "/profile");
    return null;
  }
  return session;
}

export function guardRoleAccess(session) {
  if (!session) {
    return;
  }

  const pathname = window.location.pathname;
  if (window.location.pathname.startsWith("/admin") && session.role !== "admin") {
    window.location.replace("/profile");
    return;
  }

  if (
    session.role === "admin"
    && ["/profile", "/assignments", "/messenger", "/directory", "/tests"].includes(pathname)
  ) {
    window.location.replace("/admin");
  }
}

export function updateTopbarTime() {
  const timeElements = document.querySelectorAll(".topbar-time strong");
  if (timeElements.length === 0) {
    return;
  }

  const now = new Date();
  const formattedDate = new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(now);
  const formattedTime = new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(now);
  const output = `${formattedDate} | ${formattedTime}`;

  timeElements.forEach((element) => {
    element.textContent = output;
  });
}

export function formatAssignmentDeadline(value) {
  if (!value) {
    return "Без дедлайна";
  }

  const date = value.includes("T") ? new Date(value) : new Date(`${value}T00:00:00`);
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function buildDraftQuizQuestions(questionsCount) {
  return Array.from({ length: questionsCount }, (_, index) => ({
    text: `Черновик вопроса ${index + 1}`,
    question_type: "single",
    options: [
      { text: "Вариант 1", is_correct: true },
      { text: "Вариант 2", is_correct: false },
    ],
  }));
}

export function extractSubjectCode(value) {
  const text = String(value || "").toUpperCase();
  const match = text.match(/([A-Z]{2,}\d{3}(?:-\d+)?)/);
  if (!match) {
    return "";
  }
  return match[1].replace(/-\d+$/, "");
}

export function normalizeSubjectTitle(rawTitle) {
  const title = String(rawTitle || "").trim();
  if (!title) {
    return "";
  }
  return title
    .replace(/\s*[-–—]\s*[A-Z]{2,}\d{3}(?:-\d+)?\s*$/i, "")
    .trim();
}

export async function apiRequest(path, options = {}) {
  const headers = new Headers(options.headers || {});
  const isFormData = options.body instanceof FormData;
  if (!isFormData) {
    headers.set("Content-Type", "application/json");
  }

  const currentSession = getSession();
  if (currentSession?.accessToken) {
    headers.set("Authorization", `Bearer ${currentSession.accessToken}`);
  }

  const response = await fetch(path, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    clearSession();
    window.location.replace("/");
    throw new Error("Требуется повторный вход.");
  }

  if (!response.ok) {
    let detail = "Ошибка запроса.";
    try {
      const payload = await response.json();
      detail = payload.detail || detail;
    } catch {
      // noop
    }
    throw new Error(detail);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

export async function apiDownload(path, fileName = "assignment.txt") {
  const headers = new Headers();
  const currentSession = getSession();
  if (currentSession?.accessToken) {
    headers.set("Authorization", `Bearer ${currentSession.accessToken}`);
  }

  const response = await fetch(path, {
    method: "GET",
    headers,
  });

  if (response.status === 401) {
    clearSession();
    window.location.replace("/");
    throw new Error("Требуется повторный вход.");
  }

  if (!response.ok) {
    let detail = "Не удалось скачать файл.";
    try {
      const payload = await response.json();
      detail = payload.detail || detail;
    } catch {
      // noop
    }
    throw new Error(detail);
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}

export function applySessionToUi(session) {
  if (!session) {
    return;
  }

  document.querySelectorAll("[data-user-avatar]").forEach((element) => {
    element.textContent = session.avatar;
  });

  document.querySelectorAll("[data-user-name]").forEach((element) => {
    element.textContent = session.name;
  });

  document.querySelectorAll("[data-user-role-label]").forEach((element) => {
    element.textContent = session.roleLabel;
  });

  document.querySelectorAll("[data-admin-only]").forEach((element) => {
    element.hidden = session.role !== "admin";
  });

  document.querySelectorAll("[data-teacher-only]").forEach((element) => {
    element.hidden = session.role !== "teacher";
  });

  if (session.role === "admin") {
    document.querySelectorAll('a[href="/profile"], a[href="/assignments"], a[href="/messenger"], a[href="/directory"], a[href="/tests"]').forEach((element) => {
      element.hidden = true;
    });
  }

  const directoryLabel = session.role === "student"
    ? "Мои преподаватели"
    : session.role === "teacher"
      ? "Студенты"
      : "Пользователи";
  document.querySelectorAll('a[href="/directory"]').forEach((element) => {
    element.textContent = directoryLabel;
    element.hidden = session.role === "admin";
  });

  const assignmentsLabel = session.role === "student" ? "Предметы" : "Задания";
  document.querySelectorAll('a[href="/assignments"]').forEach((element) => {
    element.textContent = assignmentsLabel;
  });
}

export async function updateAssignmentsNavDeadlineDot(session) {
  if (!session || session.role === "admin") {
    return;
  }

  const assignmentLinks = Array.from(document.querySelectorAll('a[href="/assignments"]'));
  if (!assignmentLinks.length) {
    return;
  }

  const setDotVisibility = (isVisible) => {
    assignmentLinks.forEach((link) => {
      let dot = link.querySelector(".nav-deadline-dot");
      if (!dot) {
        dot = document.createElement("span");
        dot.className = "nav-deadline-dot";
        dot.setAttribute("aria-hidden", "true");
        link.appendChild(dot);
      }
      dot.hidden = !isVisible;
    });
  };

  try {
    const assignments = await apiRequest("/api/assignments");
    const now = Date.now();
    const FOUR_DAYS_MS = 4 * 24 * 60 * 60 * 1000;
    const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

    let showDot = false;
    if (session.role === "student") {
      showDot = assignments.some((assignment) => {
        const diffMs = new Date(assignment.deadline).getTime() - now;
        return Number.isFinite(diffMs) && diffMs >= 0 && diffMs <= FOUR_DAYS_MS;
      });
    } else if (session.role === "teacher") {
      showDot = assignments.some((assignment) => {
        const overdueMs = now - new Date(assignment.deadline).getTime();
        return Boolean(assignment.has_ungraded_submissions)
          && Number.isFinite(overdueMs)
          && overdueMs >= 0
          && overdueMs <= THREE_DAYS_MS;
      });
    }

    setDotVisibility(showDot);
  } catch {
    setDotVisibility(false);
  }
}

export function setupLogout() {
  document.querySelectorAll("[data-logout-button]").forEach((button) => {
    button.addEventListener("click", () => {
      clearSession();
      window.location.replace("/");
    });
  });
}
