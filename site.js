const STORAGE_KEY = "eduflow-session";
const AUTH_PAGE_PATHS = new Set(["/", "/login"]);
const DEFAULT_COURSE_ID = 1;
const DEMO_USERS = {
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

const STUDENT_PROFILE_META = {
  direction: "Программный инжиниринг",
  curator: "Baxtiyorov Ubaydullo",
};

const TEACHER_PROFILE_META = {
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

const ADMIN_TEACHER_SUBJECTS = {
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

const ALLOWED_ASSIGNMENT_MATERIAL_EXTENSIONS = new Set([
  "txt", "doc", "docx", "xls", "xlsx", "ppt", "pptx",
  "png", "jpg", "jpeg", "gif", "webp", "bmp", "tif", "tiff",
  "zip", "rar", "7z", "tar", "gz",
]);

function getSession() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setSession(session) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

function clearSession() {
  window.localStorage.removeItem(STORAGE_KEY);
}

function isAuthPage() {
  return AUTH_PAGE_PATHS.has(window.location.pathname);
}

function requireSession() {
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

function guardRoleAccess(session) {
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

function updateTopbarTime() {
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

function formatAssignmentDeadline(value) {
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

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildDraftQuizQuestions(questionsCount) {
  return Array.from({ length: questionsCount }, (_, index) => ({
    text: `Черновик вопроса ${index + 1}`,
    question_type: "single",
    options: [
      { text: "Вариант 1", is_correct: true },
      { text: "Вариант 2", is_correct: false },
    ],
  }));
}

function extractSubjectCode(value) {
  const text = String(value || "").toUpperCase();
  const match = text.match(/([A-Z]{2,}\d{3}(?:-\d+)?)/);
  if (!match) {
    return "";
  }
  return match[1].replace(/-\d+$/, "");
}

function normalizeSubjectTitle(rawTitle) {
  const title = String(rawTitle || "").trim();
  if (!title) {
    return "";
  }
  return title
    .replace(/\s*[-–—]\s*[A-Z]{2,}\d{3}(?:-\d+)?\s*$/i, "")
    .trim();
}

async function apiRequest(path, options = {}) {
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

async function apiDownload(path, fileName = "assignment.txt") {
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

function applySessionToUi(session) {
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

async function updateAssignmentsNavDeadlineDot(session) {
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

function renderProfileInfo(session) {
  const directionLabel = document.getElementById("profileDirectionLabel");
  const directionValue = document.getElementById("profileDirectionValue");
  const deanLabel = document.getElementById("profileDeanLabel");
  const deanValue = document.getElementById("profileDeanValue");
  if (!directionLabel || !directionValue || !deanLabel || !deanValue) {
    return;
  }

  const studentOnlyRows = document.querySelectorAll("[data-profile-student-only]");
  if (session.role === "teacher") {
    const teacherMeta = TEACHER_PROFILE_META[session.email] || {
      department: "Кафедра информационных технологий",
      dean: "Абдурахмонов Шерзод Бахтиёрович",
    };
    studentOnlyRows.forEach((element) => {
      element.hidden = true;
    });
    directionLabel.textContent = "Кафедра";
    directionValue.textContent = teacherMeta.department;
    deanLabel.textContent = "Декан";
    deanValue.textContent = teacherMeta.dean;
    return;
  }

  studentOnlyRows.forEach((element) => {
    element.hidden = false;
  });
  directionLabel.textContent = "Направление";
  directionValue.textContent = STUDENT_PROFILE_META.direction;
  deanLabel.textContent = "Куратор";
  deanValue.textContent = STUDENT_PROFILE_META.curator;
}

async function renderStudentGpa(session) {
  const gpaNode = document.getElementById("profileGpaValue");
  if (!gpaNode || session.role !== "student") {
    return;
  }

  try {
    const assignments = await apiRequest("/api/assignments");
    const gradedItems = assignments.filter((assignment) => assignment.current_user_grade != null);
    if (!gradedItems.length) {
      gpaNode.textContent = "0.00 / 4.00";
      return;
    }

    const totals = gradedItems.reduce((acc, assignment) => {
      const maxScore = Math.max(0, Number(assignment.max_score) || 0);
      const score = Math.max(0, Number(assignment.current_user_grade) || 0);
      if (maxScore <= 0) {
        return acc;
      }
      acc.totalScore += Math.min(score, maxScore);
      acc.totalMax += maxScore;
      return acc;
    }, { totalScore: 0, totalMax: 0 });

    if (totals.totalMax <= 0) {
      gpaNode.textContent = "0.00 / 4.00";
      return;
    }

    const gpa = Math.max(0, Math.min(4, (totals.totalScore / totals.totalMax) * 4));
    gpaNode.textContent = `${gpa.toFixed(2)} / 4.00`;
  } catch {
    gpaNode.textContent = "0.00 / 4.00";
  }
}

async function renderStudentAttendance(session) {
  const attendanceNode = document.getElementById("profileAttendanceValue");
  const nbPillNode = document.getElementById("profileAttendanceNbPill");
  const attendanceAlertNode = document.getElementById("profileAttendanceAlert");
  if (!attendanceNode || session.role !== "student") {
    return;
  }

  const MAX_NB = 72;
  try {
    const summary = await apiRequest("/api/users/me/attendance-summary");
    const totalNb = Math.max(0, (summary || []).reduce((acc, item) => acc + (Number(item.nb_count) || 0), 0));
    const cappedNb = Math.min(totalNb, MAX_NB);
    const percent = ((MAX_NB - cappedNb) / MAX_NB) * 100;
    attendanceNode.textContent = `${percent.toFixed(2)}%`;
    if (nbPillNode) {
      nbPillNode.textContent = `НБ: ${cappedNb}/${MAX_NB}`;
      nbPillNode.classList.remove("nb-warning", "nb-danger");
      if (cappedNb >= MAX_NB) {
        nbPillNode.classList.add("nb-danger");
      } else if (cappedNb >= 36) {
        nbPillNode.classList.add("nb-warning");
      }
    }
    if (attendanceAlertNode) {
      attendanceAlertNode.hidden = cappedNb < MAX_NB;
    }
  } catch {
    attendanceNode.textContent = "100%";
    if (nbPillNode) {
      nbPillNode.textContent = "НБ: 0/72";
      nbPillNode.classList.remove("nb-warning", "nb-danger");
    }
    if (attendanceAlertNode) {
      attendanceAlertNode.hidden = true;
    }
  }
}

async function renderSchedulePage(session) {
  const sheet = document.getElementById("scheduleSheet");
  if (!sheet) {
    return;
  }

  const statusBox = document.getElementById("scheduleStatusBox");
  const adminControls = document.getElementById("scheduleAdminControls");
  const editToggleButton = document.getElementById("scheduleEditToggle");
  const saveButton = document.getElementById("scheduleSaveButton");
  const cancelButton = document.getElementById("scheduleCancelButton");
  const groupSelect = document.getElementById("scheduleGroupSelect");

  let schedule = null;
  let editMode = false;
  let selectedGroup = "321";

  if (session.role === "admin" && groupSelect) {
    const savedGroup = window.localStorage.getItem("adminScheduleGroup");
    if (savedGroup === "320" || savedGroup === "321") {
      selectedGroup = savedGroup;
    }
    groupSelect.value = selectedGroup;
  }

  const setStatus = (message, tone = "info") => {
    if (!statusBox) {
      return;
    }
    if (!message) {
      statusBox.innerHTML = "";
      return;
    }
    const className = tone === "error" ? "alert alert-danger py-2 mb-0" : "alert alert-success py-2 mb-0";
    statusBox.innerHTML = `<div class="${className}" role="alert">${escapeHtml(message)}</div>`;
  };

  const readScheduleFromInputs = () => {
    const days = Array.from(sheet.querySelectorAll("[data-schedule-day]")).map((dayNode) => {
      const dayKey = dayNode.dataset.scheduleDay || "";
      const dayLabel = dayNode.dataset.scheduleLabel || "";
      const lessons = Array.from(dayNode.querySelectorAll("[data-schedule-row]")).map((row) => ({
        time: String(row.querySelector("[data-field='time']")?.value || "").trim(),
        subject: String(row.querySelector("[data-field='subject']")?.value || "").trim(),
        room: String(row.querySelector("[data-field='room']")?.value || "").trim(),
      }));
      return { day_key: dayKey, day_label: dayLabel, lessons };
    });
    return { days };
  };

  const buildScheduleUrl = () => {
    if (session.role !== "admin") {
      return "/api/schedule";
    }
    const group = selectedGroup === "320" ? "320" : "321";
    return `/api/schedule?group=${group}`;
  };

  const loadSchedule = async () => {
    schedule = await apiRequest(buildScheduleUrl());
    if (session.role === "teacher" && schedule?.days) {
      const subjectMeta = String(ADMIN_TEACHER_SUBJECTS[session.email] || "");
      const subjectCodeMatch = subjectMeta.match(/\(([A-Z0-9-]+)\)/i);
      const subjectCode = (subjectCodeMatch?.[1] || "").toUpperCase();
      const teacherOffice = String(TEACHER_PROFILE_META[session.email]?.office || "A101");
      const buildRoomSequence = (baseOffice) => {
        const normalized = String(baseOffice || "").toUpperCase().trim();
        const match = normalized.match(/^([A-E])([1-5])(\d{2})$/);
        if (!match) {
          return [normalized || "A101", "A102", "A103", "A104"];
        }
        const block = match[1];
        const floor = match[2];
        const roomNumber = Number(match[3]);
        const offsets = [0, 2, 4, 6];
        return offsets.map((offset) => {
          const nextRoom = ((roomNumber - 1 + offset) % 20) + 1;
          return `${block}${floor}${String(nextRoom).padStart(2, "0")}`;
        });
      };
      const roomSequence = buildRoomSequence(teacherOffice);
      if (subjectCode) {
        const fallbackSubject = subjectMeta.includes(subjectCode)
          ? subjectMeta
          : `${subjectMeta} (${subjectCode})`;
        schedule = {
          ...schedule,
          days: schedule.days.map((day) => ({
            ...day,
            lessons: (() => {
              const defaultTimes = ["08:30", "10:00", "11:30", "13:00"];
              const existingTimes = (day.lessons || [])
                .map((lesson) => String(lesson.time || "").trim())
                .filter(Boolean);
              const times = [...new Set([...existingTimes, ...defaultTimes])].slice(0, 4);
              while (times.length < 4) {
                times.push(defaultTimes[times.length] || "08:30");
              }
              return times.map((time, index) => ({
                time,
                subject: fallbackSubject,
                room: roomSequence[index % roomSequence.length],
              }));
            })(),
          })),
        };
      }
    }
  };

  const renderSheet = () => {
    if (!schedule || !Array.isArray(schedule.days)) {
      sheet.innerHTML = "";
      return;
    }

    sheet.innerHTML = schedule.days.map((day) => {
      const rowsHtml = (day.lessons || []).map((lesson) => {
        if (!editMode) {
          return `
            <div class="schedule-day-row">
              <span>${escapeHtml(lesson.time || "")}</span>
              <span>${escapeHtml(lesson.subject || "")}</span>
              <span>${escapeHtml(lesson.room || "")}</span>
            </div>
          `;
        }
        return `
          <div class="schedule-day-row schedule-day-row-edit" data-schedule-row>
            <input class="form-control form-control-sm" data-field="time" value="${escapeHtml(lesson.time || "")}">
            <input class="form-control form-control-sm" data-field="subject" value="${escapeHtml(lesson.subject || "")}">
            <input class="form-control form-control-sm" data-field="room" value="${escapeHtml(lesson.room || "")}">
          </div>
        `;
      }).join("");

      return `
        <section class="schedule-day-card" data-schedule-day="${escapeHtml(day.day_key || "")}" data-schedule-label="${escapeHtml(day.day_label || "")}">
          <h2>${escapeHtml(day.day_label || "")}</h2>
          <div class="schedule-day-rows">${rowsHtml}</div>
        </section>
      `;
    }).join("");
  };

  try {
    await loadSchedule();
  } catch (error) {
    setStatus(error.message || "Не удалось загрузить расписание.", "error");
    return;
  }

  if (adminControls) {
    if (session.role === "admin") {
      adminControls.hidden = false;
    } else {
      adminControls.remove();
    }
  }

  renderSheet();

  if (session.role !== "admin" || !editToggleButton || !saveButton || !cancelButton) {
    return;
  }

  if (groupSelect && !groupSelect.dataset.bound) {
    groupSelect.dataset.bound = "true";
    groupSelect.addEventListener("change", async () => {
      selectedGroup = groupSelect.value === "320" ? "320" : "321";
      window.localStorage.setItem("adminScheduleGroup", selectedGroup);
      editMode = false;
      editToggleButton.hidden = false;
      saveButton.hidden = true;
      cancelButton.hidden = true;
      setStatus("");
      try {
        await loadSchedule();
        renderSheet();
      } catch (error) {
        setStatus(error.message || "Не удалось загрузить расписание группы.", "error");
      }
    });
  }

  if (!editToggleButton.dataset.bound) {
    editToggleButton.dataset.bound = "true";
    editToggleButton.addEventListener("click", () => {
      editMode = true;
      editToggleButton.hidden = true;
      saveButton.hidden = false;
      cancelButton.hidden = false;
      setStatus("");
      renderSheet();
    });
  }

  if (!cancelButton.dataset.bound) {
    cancelButton.dataset.bound = "true";
    cancelButton.addEventListener("click", () => {
      editMode = false;
      editToggleButton.hidden = false;
      saveButton.hidden = true;
      cancelButton.hidden = true;
      setStatus("");
      renderSheet();
    });
  }

  if (!saveButton.dataset.bound) {
    saveButton.dataset.bound = "true";
    saveButton.addEventListener("click", async () => {
      const payload = readScheduleFromInputs();
      if (!payload.days.length) {
        setStatus("Расписание пустое.", "error");
        return;
      }
      const hasInvalidTime = payload.days.some((day) => (day.lessons || []).some((lesson) => !lesson.time));
      if (hasInvalidTime) {
        setStatus("У каждой строки должно быть заполнено время.", "error");
        return;
      }

      try {
        schedule = await apiRequest(buildScheduleUrl(), {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        editMode = false;
        editToggleButton.hidden = false;
        saveButton.hidden = true;
        cancelButton.hidden = true;
        setStatus("Расписание сохранено.", "success");
        renderSheet();
      } catch (error) {
        setStatus(error.message || "Не удалось сохранить расписание.", "error");
      }
    });
  }
}

function renderAssignmentsPage(session) {
  const list = document.getElementById("assignmentList");
  const emptyState = document.getElementById("assignmentEmptyState");
  const badge = document.getElementById("assignmentsCountBadge");
  const pageTitle = document.getElementById("assignmentPageTitle");
  const pageLabel = document.getElementById("assignmentSectionLabel");
  const teacherPanel = document.getElementById("teacherAssignmentPanel");
  const form = document.getElementById("assignmentCreateForm");
  const showFormButton = document.getElementById("showAssignmentFormButton");
  const deadlineNotifications = document.getElementById("assignmentDeadlineNotifications");

  if (!list) {
    return;
  }

  if (pageTitle) {
    pageTitle.textContent = session.role === "student" ? "Мои предметы" : "Задания";
  }
  if (pageLabel) {
    pageLabel.textContent = session.role === "student" ? "Subjects" : "Assignments";
  }

  if (teacherPanel && session.role === "teacher") {
    teacherPanel.hidden = false;
  }

  if (showFormButton && teacherPanel && !showFormButton.dataset.bound) {
    showFormButton.dataset.bound = "true";
    showFormButton.addEventListener("click", () => {
      teacherPanel.hidden = false;
      teacherPanel.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  let subjectActivitiesModal = document.getElementById("subjectActivitiesModal");
  if (!subjectActivitiesModal) {
    subjectActivitiesModal = document.createElement("div");
    subjectActivitiesModal.id = "subjectActivitiesModal";
    subjectActivitiesModal.className = "subject-activities-modal";
    subjectActivitiesModal.hidden = true;
    subjectActivitiesModal.innerHTML = `
      <div class="subject-activities-backdrop" data-close-subject-activities></div>
      <div class="subject-activities-dialog" role="dialog" aria-modal="true" aria-labelledby="subjectActivitiesTitle">
        <div class="subject-activities-header">
          <h2 id="subjectActivitiesTitle" class="h5 mb-0">Активности</h2>
          <button type="button" class="btn btn-sm btn-outline-secondary" data-close-subject-activities>Закрыть</button>
        </div>
        <div class="subject-activities-content" id="subjectActivitiesContent"></div>
      </div>
    `;
    document.body.appendChild(subjectActivitiesModal);
  }

  const closeSubjectActivitiesModal = () => {
    if (!subjectActivitiesModal) {
      return;
    }
    subjectActivitiesModal.hidden = true;
    document.body.style.removeProperty("overflow");
  };

  if (!subjectActivitiesModal.dataset.bound) {
    subjectActivitiesModal.dataset.bound = "true";
    subjectActivitiesModal.addEventListener("click", async (event) => {
      if (event.target.closest("[data-close-subject-activities]")) {
        closeSubjectActivitiesModal();
        return;
      }
      const downloadButton = event.target.closest("[data-download-url]");
      if (downloadButton) {
        try {
          await apiDownload(downloadButton.dataset.downloadUrl, downloadButton.dataset.downloadName || "file");
        } catch (error) {
          const contentElement = subjectActivitiesModal.querySelector("#subjectActivitiesContent");
          if (contentElement) {
            contentElement.insertAdjacentHTML("afterbegin", `<p class="submission-meta">${escapeHtml(error.message || "Не удалось скачать файл.")}</p>`);
          }
        }
      }
    });
  }

  const openSubjectActivitiesModal = (subject) => {
    if (!subjectActivitiesModal) {
      return;
    }
    const titleElement = subjectActivitiesModal.querySelector("#subjectActivitiesTitle");
    const contentElement = subjectActivitiesModal.querySelector("#subjectActivitiesContent");
    if (titleElement) {
      titleElement.textContent = `${subject.title}: задания`;
    }
    if (contentElement) {
      contentElement.innerHTML = subject.items
        .map((assignment) => {
          const materialDownloadButton = assignment.material_file_name
            ? `<button type="button" class="btn btn-outline-primary btn-sm mt-2" data-download-url="/api/assignments/${assignment.id}/material" data-download-name="${escapeHtml(assignment.material_file_name)}">Скачать файл задания</button>`
            : "";
          const studentGradeBlock = assignment.current_user_grade != null
            ? `
              <p>Моя оценка: <strong>${assignment.current_user_grade}/${Number(assignment.max_score) || 100}</strong></p>
              <p>Комментарий преподавателя: ${assignment.current_user_feedback ? escapeHtml(assignment.current_user_feedback) : "Нет комментария"}</p>
            `
            : "";
          return `
            <article class="assignment-card">
              <div class="assignment-card-header">
                <strong>${escapeHtml(assignment.title)}</strong>
                <span class="course-tag">${escapeHtml(assignment.type)}</span>
              </div>
              <p>Преподаватель: ${escapeHtml(assignment.teacher_name || "Не указан")}</p>
              <p>Дедлайн: ${formatAssignmentDeadline(assignment.deadline)}</p>
              <p>${escapeHtml(assignment.description || "Описание не указано.")}</p>
              ${studentGradeBlock}
              ${materialDownloadButton}
              <form class="submission-upload-form mt-3" data-upload-form="true" data-assignment-id="${assignment.id}">
                <label class="form-label mb-1">Загрузить выполненное задание (до 50 МБ)</label>
                <input type="file" class="form-control form-control-sm" data-submission-file required>
                <div class="d-flex align-items-center gap-2 mt-2">
                  <button type="submit" class="btn btn-primary btn-sm">Отправить решение</button>
                  <span class="submission-meta" data-upload-status></span>
                </div>
              </form>
            </article>
          `;
        })
        .join("");
    }
    subjectActivitiesModal.hidden = false;
    document.body.style.overflow = "hidden";
  };

  const studentSubjects = new Map();
  const subjectNbDatesByKey = new Map();

  const handleUploadFormSubmit = async (uploadForm) => {
    const assignmentId = uploadForm.dataset.assignmentId;
    const fileInput = uploadForm.querySelector("[data-submission-file]");
    const statusElement = uploadForm.querySelector("[data-upload-status]");
    const selectedFile = fileInput?.files?.[0];

    if (!selectedFile) {
      if (statusElement) {
        statusElement.textContent = "Выберите файл.";
      }
      return;
    }

    if (selectedFile.size > 50 * 1024 * 1024) {
      if (statusElement) {
        statusElement.textContent = "Файл больше 50 МБ.";
      }
      return;
    }

    if (statusElement) {
      statusElement.textContent = "Загрузка...";
    }

    const payload = new FormData();
    payload.append("file", selectedFile);

    try {
      await apiRequest(`/api/assignments/${assignmentId}/upload`, {
        method: "POST",
        body: payload,
      });
      if (statusElement) {
        statusElement.textContent = "Решение отправлено.";
      }
      uploadForm.reset();
    } catch (error) {
      if (statusElement) {
        statusElement.textContent = error.message || "Не удалось отправить файл.";
      }
    }
  };

  if (!subjectActivitiesModal.dataset.uploadBound) {
    subjectActivitiesModal.dataset.uploadBound = "true";
    subjectActivitiesModal.addEventListener("submit", async (event) => {
      const uploadForm = event.target.closest("[data-upload-form='true']");
      if (!uploadForm) {
        return;
      }
      event.preventDefault();
      await handleUploadFormSubmit(uploadForm);
    });
  }

  let nbDatesModal = document.getElementById("nbDatesModal");
  if (!nbDatesModal) {
    nbDatesModal = document.createElement("div");
    nbDatesModal.id = "nbDatesModal";
    nbDatesModal.className = "subject-activities-modal";
    nbDatesModal.hidden = true;
    nbDatesModal.innerHTML = `
      <div class="subject-activities-backdrop" data-close-nb-dates></div>
      <div class="subject-activities-dialog" role="dialog" aria-modal="true" aria-labelledby="nbDatesTitle">
        <div class="subject-activities-header">
          <h2 id="nbDatesTitle" class="h5 mb-0">Даты НБ</h2>
          <button type="button" class="btn btn-sm btn-outline-secondary" data-close-nb-dates>Закрыть</button>
        </div>
        <div class="subject-activities-content" id="nbDatesContent"></div>
      </div>
    `;
    document.body.appendChild(nbDatesModal);
  }

  const closeNbDatesModal = () => {
    if (!nbDatesModal) {
      return;
    }
    nbDatesModal.hidden = true;
    document.body.style.removeProperty("overflow");
  };

  const openNbDatesModal = (subjectTitle, dates) => {
    if (!nbDatesModal) {
      return;
    }
    const titleNode = nbDatesModal.querySelector("#nbDatesTitle");
    const contentNode = nbDatesModal.querySelector("#nbDatesContent");
    if (titleNode) {
      titleNode.textContent = `НБ по предмету: ${subjectTitle}`;
    }
    if (contentNode) {
      if (!dates.length) {
        contentNode.innerHTML = "<p class='submission-meta'>По этому предмету пока нет НБ.</p>";
      } else {
        contentNode.innerHTML = `
          <ul class="mb-0 ps-3">
            ${dates.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
          </ul>
        `;
      }
    }
    nbDatesModal.hidden = false;
    document.body.style.overflow = "hidden";
  };

  if (!nbDatesModal.dataset.bound) {
    nbDatesModal.dataset.bound = "true";
    nbDatesModal.addEventListener("click", (event) => {
      if (event.target.closest("[data-close-nb-dates]")) {
        closeNbDatesModal();
      }
    });
  }

  const renderAssignmentSubmissions = async (assignmentId, assignmentMaxScore, container) => {
    container.innerHTML = "<p class='submission-meta'>Загрузка решений...</p>";
    try {
      const submissions = await apiRequest(`/api/assignments/${assignmentId}/submissions`);
      const submissionsWithFiles = submissions.filter((item) => item.submitted_file_name && item.id);

      if (!submissionsWithFiles.length) {
        container.innerHTML = "<p class='submission-meta'>Пока никто не загрузил решение.</p>";
        return;
      }

      container.innerHTML = submissionsWithFiles
        .map(
          (item) => `
            <div class="submission-row">
              <div class="d-flex flex-wrap align-items-center gap-2">
                <span class="submission-meta">${escapeHtml(item.student_name || `Студент #${item.student_id}`)}: ${escapeHtml(item.submitted_file_name)}</span>
                <button
                  type="button"
                  class="btn btn-outline-secondary btn-sm"
                  data-download-url="/api/assignments/${assignmentId}/submissions/${item.id}/download"
                  data-download-name="${escapeHtml(item.submitted_file_name)}"
                >
                  Скачать решение
                </button>
              </div>
              <div class="d-flex flex-wrap align-items-center gap-2 mt-2">
                <input
                  type="number"
                  min="0"
                  max="${Number(assignmentMaxScore) || 100}"
                  class="form-control form-control-sm"
                  style="max-width: 120px;"
                  data-grade-score
                  value="${item.grade_score ?? ""}"
                  placeholder="Балл"
                >
                <input
                  type="text"
                  class="form-control form-control-sm"
                  style="min-width: 200px;"
                  data-grade-feedback
                  value="${escapeHtml(item.grade_feedback || "")}"
                  placeholder="Комментарий"
                >
                <button
                  type="button"
                  class="btn btn-primary btn-sm"
                  data-grade-submission="${item.id}"
                  data-assignment-id="${assignmentId}"
                  data-assignment-max="${Number(assignmentMaxScore) || 100}"
                >
                  Оценить
                </button>
                <span class="submission-meta" data-grade-status>
                  ${item.grade_score != null ? `Текущая оценка: ${item.grade_score}/${item.grade_max_score || Number(assignmentMaxScore) || 100}` : ""}
                </span>
              </div>
            </div>
          `
        )
        .join("");
    } catch (error) {
      container.innerHTML = `<p class='submission-meta'>${error.message || "Не удалось загрузить решения."}</p>`;
    }
  };

  const bindAssignmentListHandlers = () => {
    if (!list.dataset.downloadBound) {
      list.dataset.downloadBound = "true";
      list.addEventListener("click", async (event) => {
        const downloadButton = event.target.closest("[data-download-url]");
        if (downloadButton) {
          try {
            await apiDownload(downloadButton.dataset.downloadUrl, downloadButton.dataset.downloadName || "file");
          } catch (error) {
            if (emptyState) {
              emptyState.hidden = false;
              emptyState.textContent = error.message || "Не удалось скачать файл.";
            }
          }
          return;
        }

        const toggleSubjectButton = event.target.closest("[data-toggle-subject]");
        if (toggleSubjectButton) {
          const subjectId = toggleSubjectButton.dataset.toggleSubject;
          const subject = studentSubjects.get(String(subjectId));
          if (subject) {
            openSubjectActivitiesModal(subject);
          }
          return;
        }

        const nbDatesButton = event.target.closest("[data-show-nb-dates]");
        if (nbDatesButton) {
          const subjectKey = String(nbDatesButton.dataset.showNbDates || "");
          const dates = subjectNbDatesByKey.get(subjectKey) || [];
          const formatted = dates
            .map((value) => {
              const date = new Date(`${value}T00:00:00`);
              if (Number.isNaN(date.getTime())) {
                return value;
              }
              return new Intl.DateTimeFormat("ru-RU", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
              }).format(date);
            })
            .sort((a, b) => a.localeCompare(b, "ru"));
          const subject = studentSubjects.get(subjectKey);
          openNbDatesModal(subject?.title || "Предмет", formatted);
          return;
        }

        const loadSubmissionsButton = event.target.closest("[data-load-submissions]");
        if (loadSubmissionsButton) {
          const assignmentId = loadSubmissionsButton.dataset.loadSubmissions;
          const assignmentMax = Number(loadSubmissionsButton.dataset.assignmentMax || 100);
          const container = list.querySelector(`[data-submissions-container="${assignmentId}"]`);
          if (container) {
            await renderAssignmentSubmissions(assignmentId, assignmentMax, container);
          }
          return;
        }

        const gradeButton = event.target.closest("[data-grade-submission]");
        if (gradeButton) {
          const submissionId = gradeButton.dataset.gradeSubmission;
          const assignmentId = gradeButton.dataset.assignmentId;
          const assignmentMax = Number(gradeButton.dataset.assignmentMax || 100);
          const row = gradeButton.closest(".submission-row");
          const scoreInput = row?.querySelector("[data-grade-score]");
          const feedbackInput = row?.querySelector("[data-grade-feedback]");
          const statusElement = row?.querySelector("[data-grade-status]");
          const score = Number(scoreInput?.value);

          if (!Number.isFinite(score) || score < 0 || score > assignmentMax) {
            if (statusElement) {
              statusElement.textContent = `Введите балл от 0 до ${assignmentMax}.`;
            }
            return;
          }

          if (statusElement) {
            statusElement.textContent = "Сохранение...";
          }

          try {
            await apiRequest(`/api/grades/submissions/${submissionId}`, {
              method: "POST",
              body: JSON.stringify({
                score: Math.floor(score),
                max_score: assignmentMax,
                feedback: String(feedbackInput?.value || "").trim() || null,
              }),
            });
            if (statusElement) {
              statusElement.textContent = `Сохранено: ${Math.floor(score)}/${assignmentMax}`;
            }
            await renderAssignments();
          } catch (error) {
            if (statusElement) {
              statusElement.textContent = error.message || "Не удалось сохранить оценку.";
            }
          }
          return;
        }

        const deleteAssignmentButton = event.target.closest("[data-delete-assignment]");
        if (deleteAssignmentButton) {
          const assignmentId = deleteAssignmentButton.dataset.deleteAssignment;
          try {
            await apiRequest(`/api/assignments/${assignmentId}`, { method: "DELETE" });
            await renderAssignments();
          } catch (error) {
            if (emptyState) {
              emptyState.hidden = false;
              emptyState.textContent = error.message || "Не удалось удалить задание.";
            }
          }
        }
      });
    }

    if (!list.dataset.uploadBound) {
      list.dataset.uploadBound = "true";
      list.addEventListener("submit", async (event) => {
        const uploadForm = event.target.closest("[data-upload-form='true']");
        if (!uploadForm) {
          return;
        }
        event.preventDefault();
        await handleUploadFormSubmit(uploadForm);
      });
    }
  };

  const renderAssignments = async () => {
    try {
      const assignments = await apiRequest("/api/assignments");
      assignments.sort((left, right) => String(left.deadline).localeCompare(String(right.deadline)));
      list.innerHTML = "";

      if (deadlineNotifications) {
        deadlineNotifications.hidden = true;
        deadlineNotifications.innerHTML = "";
      }

      if (session.role === "student" && deadlineNotifications) {
        const now = Date.now();
        const FOUR_DAYS_MS = 4 * 24 * 60 * 60 * 1000;
        const urgentAssignments = assignments
          .map((assignment) => {
            const deadlineMs = new Date(assignment.deadline).getTime();
            const diffMs = deadlineMs - now;
            return { assignment, diffMs };
          })
          .filter(({ diffMs }) => Number.isFinite(diffMs) && diffMs >= 0 && diffMs <= FOUR_DAYS_MS)
          .sort((a, b) => a.diffMs - b.diffMs);

        if (urgentAssignments.length) {
          deadlineNotifications.hidden = false;
          deadlineNotifications.innerHTML = urgentAssignments
            .map(({ assignment, diffMs }) => {
              const totalHours = Math.max(1, Math.ceil(diffMs / (60 * 60 * 1000)));
              const days = Math.floor(totalHours / 24);
              const hours = totalHours % 24;
              const timeLeft = days > 0 ? `${days} дн. ${hours} ч.` : `${hours} ч.`;
              return `
                <div class="alert alert-warning mb-2" role="alert">
                  <strong>Скоро дедлайн:</strong> ${escapeHtml(assignment.title)}. Осталось ${timeLeft}.
                </div>
              `;
            })
            .join("");
        }
      }
      if (session.role === "teacher" && deadlineNotifications) {
        const now = Date.now();
        const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
        const reviewAssignments = assignments
          .map((assignment) => {
            const deadlineMs = new Date(assignment.deadline).getTime();
            const overdueMs = now - deadlineMs;
            const reviewWindowLeftMs = THREE_DAYS_MS - overdueMs;
            return { assignment, overdueMs, reviewWindowLeftMs };
          })
          .filter(
            ({ assignment, overdueMs }) =>
              Boolean(assignment.has_ungraded_submissions)
              && Number.isFinite(overdueMs)
              && overdueMs >= 0
              && overdueMs <= THREE_DAYS_MS
          )
          .sort((a, b) => a.reviewWindowLeftMs - b.reviewWindowLeftMs);

        if (reviewAssignments.length) {
          deadlineNotifications.hidden = false;
          deadlineNotifications.innerHTML = reviewAssignments
            .map(({ assignment, reviewWindowLeftMs }) => {
              const totalHours = Math.max(1, Math.ceil(reviewWindowLeftMs / (60 * 60 * 1000)));
              const days = Math.floor(totalHours / 24);
              const hours = totalHours % 24;
              const timeLeft = days > 0 ? `${days} дн. ${hours} ч.` : `${hours} ч.`;
              return `
                <div class="alert alert-danger mb-2" role="alert">
                  <strong>Нужно оценить:</strong> ${escapeHtml(assignment.title)}.
                  До конца окна проверки осталось ${timeLeft}.
                </div>
              `;
            })
            .join("");
        }
      }

      if (session.role === "student") {
        const [courseList, scheduleData, teachersDirectory, attendanceSummary] = await Promise.all([
          (async () => {
            try {
              return await apiRequest("/api/courses");
            } catch {
              return [];
            }
          })(),
          (async () => {
            try {
              return await apiRequest("/api/schedule");
            } catch {
              return { days: [] };
            }
          })(),
          (async () => {
            try {
              return await apiRequest("/api/users/directory");
            } catch {
              return [];
            }
          })(),
          (async () => {
            try {
              return await apiRequest("/api/users/me/attendance-summary");
            } catch {
              return [];
            }
          })(),
        ]);

        const teacherCodeToName = new Map();
        const teacherCodeToId = new Map();
        const teacherNameToCode = new Map();
        const teacherNameToId = new Map();
        teachersDirectory.forEach((teacher) => {
          const subjectMeta = String(ADMIN_TEACHER_SUBJECTS[teacher.email] || "");
          const subjectCode = extractSubjectCode(subjectMeta);
          if (teacher.full_name) {
            teacherNameToId.set(String(teacher.full_name).toLowerCase(), teacher.id);
          }
          if (subjectCode) {
            teacherCodeToName.set(subjectCode, teacher.full_name || "Преподаватель");
            teacherCodeToId.set(subjectCode, teacher.id);
            teacherNameToCode.set(String(teacher.full_name || "").toLowerCase(), subjectCode);
          }
        });
        const attendanceByTeacherId = new Map(
          (attendanceSummary || []).map((item) => [Number(item.teacher_id), Number(item.nb_count) || 0]),
        );
        const attendanceDatesByTeacherId = new Map(
          (attendanceSummary || []).map((item) => [Number(item.teacher_id), Array.isArray(item.dates) ? item.dates : []]),
        );

        studentSubjects.clear();
        const scheduleSubjects = new Map();
        (scheduleData.days || []).forEach((day) => {
          (day.lessons || []).forEach((lesson) => {
            const rawSubject = String(lesson.subject || "").trim();
            if (!rawSubject) {
              return;
            }
            const subjectCode = extractSubjectCode(rawSubject);
            if (!subjectCode || scheduleSubjects.has(subjectCode)) {
              return;
            }
            scheduleSubjects.set(subjectCode, {
              key: subjectCode,
              courseId: 0,
              title: normalizeSubjectTitle(rawSubject) || rawSubject,
              teacherName: teacherCodeToName.get(subjectCode) || "Преподаватель",
              teacherId: Number(teacherCodeToId.get(subjectCode)) || 0,
              nbCount: attendanceByTeacherId.get(Number(teacherCodeToId.get(subjectCode))) || 0,
              nbDates: attendanceDatesByTeacherId.get(Number(teacherCodeToId.get(subjectCode))) || [],
              items: [],
            });
          });
        });

        scheduleSubjects.forEach((subject) => {
          studentSubjects.set(subject.key, subject);
        });

        const courseMap = new Map(courseList.map((course) => [course.id, course]));
        assignments.forEach((assignment) => {
          const course = courseMap.get(assignment.course_id);
          const teacherName = String(assignment.teacher_name || course?.teacher_name || "").trim();
          const byTeacherCode = teacherName ? teacherNameToCode.get(teacherName.toLowerCase()) : "";
          const assignmentSubjectCode = byTeacherCode
            || extractSubjectCode(assignment.course_title)
            || extractSubjectCode(assignment.title)
            || extractSubjectCode(assignment.description);

          let key = assignmentSubjectCode || "";
          if (!key) {
            key = `fallback:${assignment.id}`;
          }

          if (!studentSubjects.has(key)) {
            const fallbackTitle = assignment.course_title || course?.title || "Предмет не указан";
            studentSubjects.set(key, {
              key,
              courseId: Number(assignment.course_id) || 0,
              title: normalizeSubjectTitle(fallbackTitle) || fallbackTitle,
              teacherName: teacherName || (assignmentSubjectCode ? (teacherCodeToName.get(assignmentSubjectCode) || "Преподаватель") : "Преподаватель"),
              teacherId: assignmentSubjectCode ? (Number(teacherCodeToId.get(assignmentSubjectCode)) || 0) : (Number(teacherNameToId.get(teacherName.toLowerCase())) || 0),
              nbCount: assignmentSubjectCode ? (attendanceByTeacherId.get(Number(teacherCodeToId.get(assignmentSubjectCode))) || 0) : 0,
              nbDates: assignmentSubjectCode ? (attendanceDatesByTeacherId.get(Number(teacherCodeToId.get(assignmentSubjectCode))) || []) : [],
              items: [],
            });
          }
          const targetSubject = studentSubjects.get(key);
          targetSubject.items.push(assignment);
          if ((!targetSubject.teacherName || targetSubject.teacherName === "Преподаватель") && teacherName) {
            targetSubject.teacherName = teacherName;
          }
          if (targetSubject.nbCount === 0 && teacherName) {
            const teacherIdByName = teacherNameToId.get(teacherName.toLowerCase());
            if (teacherIdByName) {
              targetSubject.teacherId = Number(teacherIdByName);
              targetSubject.nbCount = attendanceByTeacherId.get(Number(teacherIdByName)) || 0;
              targetSubject.nbDates = attendanceDatesByTeacherId.get(Number(teacherIdByName)) || [];
            }
          }
        });

        const mergedSubjects = new Map();
        studentSubjects.forEach((subject) => {
          const normalizedTitle = normalizeSubjectTitle(subject.title) || subject.title || "Предмет не указан";
          const dedupeKey = normalizedTitle.toLowerCase();
          if (!mergedSubjects.has(dedupeKey)) {
            mergedSubjects.set(dedupeKey, {
              ...subject,
              title: normalizedTitle,
              teacherId: Number(subject.teacherId) || 0,
              nbCount: Number(subject.nbCount) || 0,
              nbDates: Array.isArray(subject.nbDates) ? subject.nbDates : [],
              items: [...(subject.items || [])],
            });
            return;
          }
          const existing = mergedSubjects.get(dedupeKey);
          existing.items.push(...(subject.items || []));
          existing.nbCount = Math.max(Number(existing.nbCount) || 0, Number(subject.nbCount) || 0);
          if ((existing.nbDates || []).length === 0 && Array.isArray(subject.nbDates) && subject.nbDates.length) {
            existing.nbDates = subject.nbDates;
          }
          if ((existing.teacherName === "Преподаватель" || !existing.teacherName) && subject.teacherName && subject.teacherName !== "Преподаватель") {
            existing.teacherName = subject.teacherName;
            const teacherIdByName = teacherNameToId.get(String(subject.teacherName || "").toLowerCase());
            if (teacherIdByName) {
              existing.teacherId = Number(teacherIdByName);
              existing.nbCount = attendanceByTeacherId.get(Number(teacherIdByName)) || existing.nbCount;
              existing.nbDates = attendanceDatesByTeacherId.get(Number(teacherIdByName)) || existing.nbDates || [];
            }
          }
          if (!existing.courseId && subject.courseId) {
            existing.courseId = subject.courseId;
          }
        });

        const subjects = Array.from(mergedSubjects.values()).sort((a, b) => a.title.localeCompare(b.title, "ru"));
        subjectNbDatesByKey.clear();
        subjects.forEach((subject) => {
          const uniqueDates = [...new Set((subject.nbDates || []).map((value) => String(value)))];
          subjectNbDatesByKey.set(String(subject.key), uniqueDates);
        });
        const formatSubjectAverage = (value) => {
          const normalized = Math.max(0, Math.min(5, Number(value) || 0));
          return Number.isInteger(normalized) ? String(normalized) : normalized.toFixed(2);
        };
        if (!subjects.length) {
          if (badge) {
            badge.textContent = "0 предметов";
          }
          if (emptyState) {
            emptyState.hidden = false;
            emptyState.textContent = "Пока предметов нет.";
          }
          return;
        }

        list.innerHTML = `
          <div class="table-responsive">
            <table class="table table-striped align-middle">
              <thead>
                <tr>
                  <th>Дисциплина</th>
                  <th>Преподаватель</th>
                  <th>НБ</th>
                  <th>Средний балл</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                ${subjects
                  .map((subject) => {
                    const gradedItems = subject.items.filter((assignment) => assignment.current_user_grade != null);
                    const averageFivePoint = gradedItems.length
                      ? gradedItems.reduce((acc, assignment) => {
                          const maxScore = Number(assignment.max_score) || 100;
                          const score = Number(assignment.current_user_grade) || 0;
                          const normalized = maxScore > 0 ? (score / maxScore) * 5 : 0;
                          return acc + Math.max(0, Math.min(5, normalized));
                        }, 0) / gradedItems.length
                      : 0;
                    return `
                    <tr>
                      <td>${escapeHtml(subject.title)}</td>
                      <td>${escapeHtml(subject.teacherName)}</td>
                      <td>
                        <button type="button" class="subject-metric-pill subject-metric-pill-button" data-show-nb-dates="${escapeHtml(subject.key)}">
                          ${Number(subject.nbCount) || 0}
                        </button>
                      </td>
                      <td><span class="subject-metric-pill">${formatSubjectAverage(averageFivePoint)}</span></td>
                      <td>
                        <button type="button" class="btn btn-outline-primary btn-sm" data-toggle-subject="${escapeHtml(subject.key)}">
                          Активности
                        </button>
                      </td>
                    </tr>
                  `;
                  })
                  .join("")}
              </tbody>
            </table>
          </div>
        `;

        if (badge) {
          badge.textContent = `${subjects.length} предметов`;
        }
        if (emptyState) {
          emptyState.hidden = true;
        }
        return;
      }

      assignments.forEach((assignment) => {
        const card = document.createElement("article");
        card.className = "assignment-card";

        const materialDownloadButton = assignment.material_file_name
          ? `<button type="button" class="btn btn-outline-primary btn-sm mt-2" data-download-url="/api/assignments/${assignment.id}/material" data-download-name="${assignment.material_file_name}">Скачать файл задания</button>`
          : "";

        const studentUploadBlock = session.role === "student"
          ? `
            <form class="submission-upload-form mt-3" data-upload-form="true" data-assignment-id="${assignment.id}">
              <label class="form-label mb-1">Загрузить выполненное задание (до 50 МБ)</label>
              <input type="file" class="form-control form-control-sm" data-submission-file required>
              <div class="d-flex align-items-center gap-2 mt-2">
                <button type="submit" class="btn btn-primary btn-sm">Отправить решение</button>
                <span class="submission-meta" data-upload-status></span>
              </div>
            </form>
          `
          : "";

        const teacherReviewBlock = session.role === "teacher"
          ? `
            <div class="mt-3">
              <button type="button" class="btn btn-outline-secondary btn-sm" data-load-submissions="${assignment.id}" data-assignment-max="${Number(assignment.max_score) || 100}">
                Показать решения студентов
              </button>
              <div class="submission-list mt-2" data-submissions-container="${assignment.id}"></div>
            </div>
          `
          : "";
        const studentGradeBlock = session.role === "student" && assignment.current_user_grade != null
          ? `
            <p>Моя оценка: <strong>${assignment.current_user_grade}/${Number(assignment.max_score) || 100}</strong></p>
            <p>Комментарий преподавателя: ${assignment.current_user_feedback ? escapeHtml(assignment.current_user_feedback) : "Нет комментария"}</p>
          `
          : "";
        const teacherDeleteButton = session.role === "teacher" && assignment.can_delete
          ? `<button type="button" class="btn btn-outline-danger btn-sm mt-2" data-delete-assignment="${assignment.id}">Удалить задание</button>`
          : "";

        card.innerHTML = `
          <div class="assignment-card-header">
            <strong>${assignment.title}</strong>
            <span class="course-tag">${assignment.type}</span>
          </div>
          <p>Преподаватель: ${assignment.teacher_name || "Не указан"}</p>
          <p>Дедлайн: ${formatAssignmentDeadline(assignment.deadline)}</p>
          <p>Максимальный балл: ${Number(assignment.max_score) || 100}</p>
          <p>${assignment.description || "Описание не указано."}</p>
          <p>Статус: ${session.role === "teacher" ? "Опубликовано для студентов" : "Доступно к выполнению"}</p>
          ${studentGradeBlock}
          ${materialDownloadButton}
          ${teacherDeleteButton}
          ${studentUploadBlock}
          ${teacherReviewBlock}
        `;
        list.appendChild(card);
      });

      if (badge) {
        badge.textContent = `${assignments.length} активных`;
      }

      if (emptyState) {
        emptyState.hidden = assignments.length > 0;
        if (!emptyState.hidden) {
          emptyState.textContent = "Пока заданий нет.";
        }
      }

    } catch (error) {
      list.innerHTML = "";
      if (badge) {
        badge.textContent = "Нет доступа";
      }
      if (emptyState) {
        emptyState.hidden = false;
        emptyState.textContent = error.message || "Не удалось загрузить задания.";
      }
    }
  };

  bindAssignmentListHandlers();
  renderAssignments();

  if (form && !form.dataset.bound) {
    form.dataset.bound = "true";
    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      if (session.role !== "teacher") {
        return;
      }

      const formData = new FormData(form);
      const title = String(formData.get("title") || "").trim();
      const deadline = String(formData.get("deadline") || "").trim();
      const maxScoreValue = Number(formData.get("max_score") || 5);
      const materialFile = formData.get("file");

      if (!title || !deadline || !(materialFile instanceof File) || !materialFile.name) {
        return;
      }
      if (!Number.isFinite(maxScoreValue) || maxScoreValue < 1 || maxScoreValue > 50) {
        if (emptyState) {
          emptyState.hidden = false;
          emptyState.textContent = "Максимальный балл должен быть от 1 до 50.";
        }
        return;
      }

      const materialFileExtension = String(materialFile.name || "").toLowerCase().split(".").pop() || "";
      if (!ALLOWED_ASSIGNMENT_MATERIAL_EXTENSIONS.has(materialFileExtension)) {
        if (emptyState) {
          emptyState.hidden = false;
          emptyState.textContent = "Недопустимый формат файла задания.";
        }
        return;
      }

      const payload = new FormData();
      payload.append("title", title);
      payload.append("deadline", `${deadline}T23:59:00`);
      payload.append("max_score", String(Math.floor(maxScoreValue)));
      payload.append("description", String(formData.get("description") || "").trim());
      payload.append("file", materialFile);

      try {
        await apiRequest(`/api/assignments/courses/${DEFAULT_COURSE_ID}/upload`, {
          method: "POST",
          body: payload,
        });
        form.reset();
        await renderAssignments();
      } catch (error) {
        if (emptyState) {
          emptyState.hidden = false;
          emptyState.textContent = error.message || "Не удалось создать задание.";
        }
      }
    });
  }
}

async function renderAdminAssignmentsPage(session) {
  const list = document.getElementById("adminAssignmentsList");
  const emptyState = document.getElementById("adminAssignmentsEmptyState");
  const badge = document.getElementById("adminAssignmentsCountBadge");
  const statusBox = document.getElementById("adminAssignmentsStatusBox");

  if (!list || session.role !== "admin") {
    return;
  }

  const showStatus = (text, isError = false) => {
    if (!statusBox) {
      return;
    }
    statusBox.hidden = false;
    statusBox.textContent = text;
    statusBox.style.color = isError ? "#b42318" : "var(--app-muted)";
  };

  const renderList = async () => {
    const assignments = await apiRequest("/api/assignments");
    list.innerHTML = "";
    assignments.forEach((assignment) => {
      const card = document.createElement("article");
      card.className = "assignment-card";
      card.innerHTML = `
        <div class="assignment-card-header">
          <strong>${escapeHtml(assignment.title)}</strong>
          <span class="course-tag">${escapeHtml(assignment.type || "file")}</span>
        </div>
        <p>Предмет: ${escapeHtml(assignment.course_title || "Не указан")}</p>
        <p>Преподаватель: ${escapeHtml(assignment.teacher_name || "Не указан")}</p>
        <p>Дедлайн: ${formatAssignmentDeadline(assignment.deadline)}</p>
        <p>Максимальный балл: ${Number(assignment.max_score) || 0}</p>
        <div class="d-flex justify-content-end">
          <button type="button" class="btn btn-outline-danger btn-sm" data-admin-delete-assignment="${assignment.id}">
            Удалить задание
          </button>
        </div>
      `;
      list.appendChild(card);
    });

    if (badge) {
      badge.textContent = `${assignments.length}`;
    }

    if (emptyState) {
      emptyState.hidden = assignments.length > 0;
      if (!emptyState.hidden) {
        emptyState.textContent = "Задания не найдены.";
      }
    }
  };

  if (!list.dataset.bound) {
    list.dataset.bound = "true";
    list.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-admin-delete-assignment]");
      if (!button) {
        return;
      }
      const assignmentId = Number(button.dataset.adminDeleteAssignment || 0);
      if (!assignmentId) {
        return;
      }
      const confirmed = window.confirm("Удалить это задание? Действие нельзя отменить.");
      if (!confirmed) {
        return;
      }
      try {
        await apiRequest(`/api/assignments/${assignmentId}`, { method: "DELETE" });
        showStatus("Задание удалено.");
        await renderList();
      } catch (error) {
        showStatus(error.message || "Не удалось удалить задание.", true);
      }
    });
  }

  try {
    await renderList();
  } catch (error) {
    list.innerHTML = "";
    if (badge) {
      badge.textContent = "0";
    }
    if (emptyState) {
      emptyState.hidden = false;
      emptyState.textContent = error.message || "Не удалось загрузить задания.";
    }
  }
}

async function renderDirectoryPage(session) {
  const list = document.getElementById("directoryList");
  const emptyState = document.getElementById("directoryEmptyState");
  const badge = document.getElementById("directoryCountBadge");
  const title = document.getElementById("directoryTitle");
  const teacherFilters = document.getElementById("directoryTeacherFilters");
  const groupFilter = document.getElementById("directoryGroupFilter");
  const studentSearch = document.getElementById("directoryStudentSearch");
  const studentFilters = document.getElementById("directoryStudentFilters");
  const subjectFilter = document.getElementById("directorySubjectFilter");
  const teacherSearch = document.getElementById("directoryTeacherSearch");
  const attendanceDateInput = document.getElementById("directoryAttendanceDate");
  const attendanceStatusBox = document.getElementById("directoryAttendanceStatus");

  if (!list) {
    return;
  }

  if (title) {
    title.textContent = session.role === "student"
      ? "Мои преподаватели"
      : session.role === "teacher"
        ? "Список студентов"
        : "Список пользователей";
  }

  const extractStudentGroupFromBio = (bio) => {
    const text = String(bio || "");
    const labelMatch = text.match(/Группа:\s*([^\n]+)/i);
    if (labelMatch && labelMatch[1]) {
      return labelMatch[1].trim();
    }
    const fallbackMatch = text.match(/(\d{3}-\d{2}\s*[A-Za-zА-Яа-я]+)/);
    return fallbackMatch ? fallbackMatch[1].trim() : "Без группы";
  };

  const transliterateRuToLat = (value) => {
    const map = {
      а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y",
      к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f",
      х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
      ў: "u", қ: "q", ғ: "g", ҳ: "h", ң: "ng",
    };
    return String(value || "")
      .toLowerCase()
      .split("")
      .map((char) => map[char] ?? char)
      .join("");
  };

  const normalizeSearchText = (value) => String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’'`"]/g, "")
    .replace(/[^a-zа-яё0-9]+/gi, " ")
    .trim();

  const matchesStudentSearch = (student, query) => {
    const normalizedQuery = normalizeSearchText(query);
    if (!normalizedQuery) {
      return true;
    }

    const queryTokens = normalizedQuery.split(/\s+/).filter(Boolean);
    const baseText = normalizeSearchText(`${student.full_name || ""} ${student.email || ""}`);
    const transliteratedText = normalizeSearchText(transliterateRuToLat(`${student.full_name || ""} ${student.email || ""}`));
    const transliteratedQuery = normalizeSearchText(transliterateRuToLat(normalizedQuery));

    return queryTokens.every((token) => {
      if (baseText.includes(token) || transliteratedText.includes(token)) {
        return true;
      }
      if (transliteratedQuery && transliteratedText.includes(transliteratedQuery)) {
        return true;
      }
      return false;
    });
  };

  const isSundayDate = (value) => {
    if (!value) {
      return false;
    }
    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) {
      return false;
    }
    return date.getDay() === 0;
  };

  const getDefaultAttendanceDate = () => {
    const now = new Date();
    if (now.getDay() === 0) {
      now.setDate(now.getDate() - 1);
    }
    return now.toISOString().slice(0, 10);
  };

  const showAttendanceStatus = (text, isError = false) => {
    if (!attendanceStatusBox) {
      return;
    }
    if (!text) {
      attendanceStatusBox.hidden = true;
      attendanceStatusBox.textContent = "";
      attendanceStatusBox.style.removeProperty("color");
      return;
    }
    attendanceStatusBox.hidden = false;
    attendanceStatusBox.textContent = text;
    attendanceStatusBox.style.color = isError ? "#b42318" : "var(--app-muted)";
  };

  const renderCards = (users, options = {}) => {
    list.innerHTML = "";
    users.forEach((user) => {
      const isTeacherView = session.role === "teacher" && user.role === "student";
      const attendanceDate = options.attendanceDate || "";
      const attendanceEnabled = Boolean(options.attendanceEnabled);
      const attendanceMap = options.attendanceMap || new Map();
      const markedNb = attendanceMap.get(user.id) === "NB";
      const attendanceBlock = isTeacherView
        ? `
          <div class="d-flex align-items-center justify-content-between gap-2 mt-2">
            <span class="submission-meta">Посещаемость ${attendanceDate ? `на ${escapeHtml(attendanceDate)}` : ""}</span>
            <div class="directory-actions-row">
              <button
                type="button"
                class="btn btn-sm ${markedNb ? "btn-danger" : "btn-outline-secondary"}"
                data-attendance-toggle="${user.id}"
                data-attendance-nb="${markedNb ? "1" : "0"}"
                ${attendanceEnabled ? "" : "disabled"}
              >
                НБ
              </button>
              <a class="directory-chat-button inline" href="/messenger?peer=${user.id}" title="Открыть чат">
                <i class="bi bi-chat-dots"></i>
              </a>
            </div>
          </div>
        `
        : "";
      const teacherMeta = TEACHER_PROFILE_META[user.email] || {
        department: "Кафедра информационных технологий",
        office: "A101",
      };
      const roleSpecificLine = user.role === "teacher"
        ? `Кафедра: ${escapeHtml(teacherMeta.department)}`
        : `Курс: ${escapeHtml(STUDENT_PROFILE_META.direction)}`;
      const roleSecondaryLine = user.role === "teacher"
        ? `<p>Предмет: ${escapeHtml(ADMIN_TEACHER_SUBJECTS[user.email] || "Не назначен")}</p><p>Кабинет: ${escapeHtml(teacherMeta.office)}</p>`
        : `<p>Группа: ${escapeHtml(extractStudentGroupFromBio(user.bio))}</p>`;

      const card = document.createElement("article");
      card.className = "assignment-card directory-card";
      card.innerHTML = `
        <div class="assignment-card-header">
          <strong class="directory-name-with-status">
            <span class="directory-online-dot ${user.online ? "online" : "offline"}" aria-hidden="true"></span>
            ${escapeHtml(user.full_name)}
          </strong>
          <span class="course-tag">${user.role === "teacher" ? "Преподаватель" : "Студент"}</span>
        </div>
        <p>${roleSpecificLine}</p>
        ${roleSecondaryLine}
        ${attendanceBlock}
        ${isTeacherView ? "" : `
          <a class="directory-chat-button" href="/messenger?peer=${user.id}" title="Открыть чат">
            <i class="bi bi-chat-dots"></i>
          </a>
        `}
      `;
      list.appendChild(card);
    });

    if (badge) {
      badge.textContent = `${users.length}`;
    }

    if (emptyState) {
      emptyState.hidden = users.length > 0;
      if (!emptyState.hidden) {
        emptyState.textContent = "Пользователи не найдены.";
      }
    }
  };

  try {
    const users = await apiRequest("/api/users/directory");

    if (session.role === "student") {
      if (teacherFilters) {
        teacherFilters.hidden = true;
      }
      showAttendanceStatus("");
      if (studentFilters) {
        studentFilters.hidden = false;
      }

      const scheduleData = await (async () => {
        try {
          return await apiRequest("/api/schedule");
        } catch {
          return { days: [] };
        }
      })();

      const scheduleSubjectsByCode = new Map();
      (scheduleData.days || []).forEach((day) => {
        (day.lessons || []).forEach((lesson) => {
          const rawSubject = String(lesson.subject || "").trim();
          const subjectCode = extractSubjectCode(rawSubject);
          if (!rawSubject || !subjectCode || scheduleSubjectsByCode.has(subjectCode)) {
            return;
          }
          scheduleSubjectsByCode.set(subjectCode, normalizeSubjectTitle(rawSubject) || rawSubject);
        });
      });

      const teachers = users
        .filter((user) => user.role === "teacher")
        .map((teacher) => {
          const subjectMeta = String(ADMIN_TEACHER_SUBJECTS[teacher.email] || "");
          const subjectCode = extractSubjectCode(subjectMeta);
          return {
            ...teacher,
            subjectCode,
            subjectTitle: scheduleSubjectsByCode.get(subjectCode) || normalizeSubjectTitle(subjectMeta) || subjectMeta || "Предмет не назначен",
          };
        })
        .filter((teacher) => teacher.subjectCode && scheduleSubjectsByCode.has(teacher.subjectCode))
        .sort((a, b) => String(a.full_name || "").localeCompare(String(b.full_name || ""), "ru"));

      if (subjectFilter) {
        const subjectOptions = Array.from(scheduleSubjectsByCode.entries())
          .sort((a, b) => String(a[1]).localeCompare(String(b[1]), "ru"))
          .map(([code, label]) => `<option value="${escapeHtml(code)}">${escapeHtml(label)}</option>`)
          .join("");
        subjectFilter.innerHTML = `<option value="">Все предметы</option>${subjectOptions}`;
      }

      const applyStudentFilters = () => {
        const selectedSubject = String(subjectFilter?.value || "");
        const teacherQuery = String(teacherSearch?.value || "").trim().toLowerCase();
        const filtered = teachers.filter((teacher) => {
          const bySubject = !selectedSubject || teacher.subjectCode === selectedSubject;
          const byName = !teacherQuery || matchesStudentSearch(teacher, teacherQuery);
          return bySubject && byName;
        });
        renderCards(filtered);
      };

      if (subjectFilter && !subjectFilter.dataset.bound) {
        subjectFilter.dataset.bound = "true";
        subjectFilter.addEventListener("change", () => {
          applyStudentFilters();
        });
      }

      if (teacherSearch && !teacherSearch.dataset.bound) {
        teacherSearch.dataset.bound = "true";
        teacherSearch.addEventListener("input", () => {
          applyStudentFilters();
        });
      }

      applyStudentFilters();
      return;
    }

    if (studentFilters) {
      studentFilters.hidden = true;
    }

    if (session.role !== "teacher") {
      if (teacherFilters) {
        teacherFilters.hidden = true;
      }
      showAttendanceStatus("");
      renderCards(users);
      return;
    }

    if (teacherFilters) {
      teacherFilters.hidden = false;
    }
    if (attendanceDateInput && !attendanceDateInput.value) {
      attendanceDateInput.value = getDefaultAttendanceDate();
    }

    const students = users
      .map((user) => ({ ...user, group: extractStudentGroupFromBio(user.bio) }))
      .sort((a, b) => a.full_name.localeCompare(b.full_name, "ru"));
    const groups = [...new Set(students.map((student) => student.group))].sort((a, b) => a.localeCompare(b, "ru"));

    if (groupFilter) {
      groupFilter.innerHTML = `<option value="">Выберите группу</option>${groups
        .map((group) => `<option value="${escapeHtml(group)}">${escapeHtml(group)}</option>`)
        .join("")}`;
    }

    const loadAttendanceMap = async (attendanceDate) => {
      if (!attendanceDate || isSundayDate(attendanceDate)) {
        return new Map();
      }
      const rows = await apiRequest(`/api/users/attendance?date=${encodeURIComponent(attendanceDate)}`);
      return new Map((rows || []).map((row) => [Number(row.student_id), row.status]));
    };

    const applyTeacherFilters = async () => {
      const selectedGroup = groupFilter?.value || "";
      const searchQuery = String(studentSearch?.value || "").trim().toLowerCase();
      const attendanceDate = String(attendanceDateInput?.value || "");
      const attendanceDateAllowed = Boolean(attendanceDate) && !isSundayDate(attendanceDate);

      if (!selectedGroup) {
        if (studentSearch) {
          studentSearch.disabled = true;
          studentSearch.value = "";
        }
        renderCards([], {
          attendanceDate,
          attendanceEnabled: attendanceDateAllowed,
          attendanceMap: new Map(),
        });
        if (emptyState) {
          emptyState.hidden = false;
          emptyState.textContent = "Выберите группу, чтобы увидеть студентов.";
        }
        showAttendanceStatus("");
        return;
      }

      const inGroup = students.filter((student) => student.group === selectedGroup);
      if (studentSearch) {
        studentSearch.disabled = false;
      }

      const filtered = searchQuery
        ? inGroup.filter((student) => matchesStudentSearch(student, searchQuery))
        : inGroup;
      if (attendanceDate && !attendanceDateAllowed) {
        showAttendanceStatus("На воскресенье отметку НБ ставить нельзя. Выбери другую дату.", true);
        renderCards(filtered, {
          attendanceDate,
          attendanceEnabled: false,
          attendanceMap: new Map(),
        });
        return;
      }

      let attendanceMap = new Map();
      if (attendanceDateAllowed) {
        try {
          attendanceMap = await loadAttendanceMap(attendanceDate);
          showAttendanceStatus("");
        } catch (error) {
          showAttendanceStatus(error.message || "Не удалось загрузить посещаемость.", true);
        }
      } else {
        showAttendanceStatus("Выбери дату, чтобы выставлять НБ.");
      }

      renderCards(filtered, {
        attendanceDate,
        attendanceEnabled: attendanceDateAllowed,
        attendanceMap,
      });
    };

    if (groupFilter && !groupFilter.dataset.bound) {
      groupFilter.dataset.bound = "true";
      groupFilter.addEventListener("change", async () => {
        if (studentSearch) {
          studentSearch.value = "";
        }
        await applyTeacherFilters();
      });
    }

    if (studentSearch && !studentSearch.dataset.bound) {
      studentSearch.dataset.bound = "true";
      studentSearch.addEventListener("input", async () => {
        await applyTeacherFilters();
      });
    }

    if (attendanceDateInput && !attendanceDateInput.dataset.bound) {
      attendanceDateInput.dataset.bound = "true";
      attendanceDateInput.addEventListener("change", async () => {
        await applyTeacherFilters();
      });
    }

    if (!list.dataset.attendanceBound) {
      list.dataset.attendanceBound = "true";
      list.addEventListener("click", async (event) => {
        const button = event.target.closest("[data-attendance-toggle]");
        if (!button) {
          return;
        }
        const studentId = Number(button.dataset.attendanceToggle || 0);
        const attendanceDate = String(attendanceDateInput?.value || "");
        if (!studentId || !attendanceDate) {
          showAttendanceStatus("Сначала выбери дату посещаемости.", true);
          return;
        }
        if (isSundayDate(attendanceDate)) {
          showAttendanceStatus("На воскресенье отметку НБ ставить нельзя.", true);
          return;
        }
        const currentlyNb = button.dataset.attendanceNb === "1";
        try {
          await apiRequest(`/api/users/${studentId}/attendance`, {
            method: "POST",
            body: JSON.stringify({
              date: attendanceDate,
              is_absent: !currentlyNb,
            }),
          });
          showAttendanceStatus(!currentlyNb ? "Отметка НБ сохранена." : "Отметка НБ снята.");
          await applyTeacherFilters();
        } catch (error) {
          showAttendanceStatus(error.message || "Не удалось обновить посещаемость.", true);
        }
      });
    }

    await applyTeacherFilters();
  } catch (error) {
    list.innerHTML = "";
    if (badge) {
      badge.textContent = "0";
    }
    if (emptyState) {
      emptyState.hidden = false;
      emptyState.textContent = error.message || "Не удалось загрузить список пользователей.";
    }
  }
}

async function renderAdminPage(session) {
  const teachersTableBody = document.querySelector("#adminTeachersTable tbody");
  const studentsTableBody = document.querySelector("#adminStudentsTable tbody");
  const securityList = document.getElementById("adminSecurityList");
  const securityToggle = document.getElementById("adminSecurityToggle");
  const statusBox = document.getElementById("adminStatusBox");
  const userSearchInput = document.getElementById("adminUserSearch");
  const editModal = document.getElementById("adminEditUserModal");
  const editForm = document.getElementById("adminEditUserForm");
  const editStudentFields = document.getElementById("editStudentFields");

  if (!teachersTableBody || !studentsTableBody || session.role !== "admin") {
    return;
  }

  let cachedUsers = [];

  const showStatus = (text, isError = false) => {
    if (!statusBox) {
      return;
    }
    statusBox.hidden = false;
    statusBox.textContent = text;
    statusBox.style.color = isError ? "#b42318" : "var(--app-muted)";
  };

  const extractStudentGroup = (bio) => {
    const match = String(bio || "").match(/(\d{3}-\d{2}\s*[A-Za-zА-Яа-я]+)/);
    return match ? match[1].trim() : "321-23 DIr";
  };

  const parseStudentProfileFromBio = (bio) => {
    const text = String(bio || "");
    const pick = (label, fallback = "") => {
      const match = text.match(new RegExp(`${label}:\\s*([^\\n]+)`));
      return match ? match[1].trim() : fallback;
    };
    return {
      curator: pick("Куратор"),
      direction: pick("Направление"),
      degree: pick("Степень", "Бакалавр"),
      study_year: Number(pick("Курс", "1")) || 1,
      language: pick("Язык обучения", "RU").toLowerCase(),
      study_type: pick("Тип обучения", "Очная"),
      group_name: pick("Группа", "321-23 DIr"),
      scholarship: pick("Стипендия", "Нет").toLowerCase() === "да",
    };
  };

  const closeEditModal = () => {
    if (!editModal) {
      return;
    }
    editModal.hidden = true;
    document.body.style.removeProperty("overflow");
  };

  const openEditModal = (userId) => {
    if (!editModal || !editForm) {
      return;
    }
    const user = cachedUsers.find((item) => item.id === Number(userId));
    if (!user) {
      showStatus("Пользователь не найден.", true);
      return;
    }

    const isStudent = user.role === "student";
    const profile = parseStudentProfileFromBio(user.bio || "");

    const setValue = (id, value) => {
      const node = document.getElementById(id);
      if (node) {
        node.value = value ?? "";
      }
    };

    setValue("editUserId", String(user.id));
    setValue("editUserFullName", user.full_name || "");
    setValue("editUserLogin", user.email || "");
    setValue("editUserPassword", "");

    setValue("editStudentCurator", profile.curator);
    setValue("editStudentDirection", profile.direction);
    setValue("editStudentDegree", profile.degree);
    setValue("editStudentYear", String(profile.study_year));
    setValue("editStudentLanguage", ["ru", "uz", "en"].includes(profile.language) ? profile.language : "ru");
    setValue("editStudentStudyType", profile.study_type);
    setValue("editStudentGroup", profile.group_name);
    const scholarshipNode = document.getElementById("editStudentScholarship");
    if (scholarshipNode) {
      scholarshipNode.checked = profile.scholarship;
    }

    if (editStudentFields) {
      editStudentFields.hidden = !isStudent;
    }

    editModal.hidden = false;
    document.body.style.overflow = "hidden";
  };

  const loadStats = async () => {
    const stats = await apiRequest("/api/admin/analytics/system");
    const setText = (id, value) => {
      const node = document.getElementById(id);
      if (node) {
        node.textContent = String(value);
      }
    };
    setText("statTotalUsers", stats.total_users);
    setText("statActiveUsers", stats.active_users);
  };

  const loadUsers = async () => {
    const users = await apiRequest("/api/admin/users");
    cachedUsers = users;
    const query = String(userSearchInput?.value || "").trim().toLowerCase();
    const filteredUsers = !query
      ? users
      : users.filter((user) => {
          const subject = String(ADMIN_TEACHER_SUBJECTS[user.email] || "").toLowerCase();
          const group = String(extractStudentGroup(user.bio)).toLowerCase();
          const fullName = String(user.full_name || "").toLowerCase();
          const login = String(user.email || "").toLowerCase();
          const role = String(user.role || "").toLowerCase();
          return [fullName, login, role, subject, group].some((value) => value.includes(query));
        });
    const renderRows = (items, kind) => items
      .map((user) => `
        <tr>
          <td>${user.id}</td>
          <td>${escapeHtml(user.full_name)}</td>
          <td>${
            kind === "teacher"
              ? escapeHtml(ADMIN_TEACHER_SUBJECTS[user.email] || "Предмет не указан")
              : escapeHtml(extractStudentGroup(user.bio))
          }</td>
          <td class="d-flex flex-wrap gap-1">
            <button class="btn btn-outline-secondary btn-sm" data-admin-edit-user="${user.id}">Редактировать пользователя</button>
          </td>
        </tr>
      `)
      .join("");
    teachersTableBody.innerHTML = renderRows(filteredUsers.filter((user) => user.role === "teacher"), "teacher");
    studentsTableBody.innerHTML = renderRows(filteredUsers.filter((user) => user.role === "student"), "student");
  };

  const loadSecurity = async () => {
    const events = await apiRequest("/api/admin/security-events?limit=30");
    if (!events.length) {
      securityList.innerHTML = "<div class='moderation-item'><p>Событий пока нет.</p></div>";
      return;
    }
    securityList.innerHTML = events
      .map((event) => `
        <div class="moderation-item">
          <strong>${escapeHtml(event.event_type)} [${escapeHtml(event.severity)}]</strong>
          <p>${escapeHtml(event.details || "")}</p>
        </div>
      `)
      .join("");
  };

  const bindUsersActions = (tableBody) => {
    if (!tableBody || tableBody.dataset.bound) {
      return;
    }
    tableBody.dataset.bound = "true";
    tableBody.addEventListener("click", async (event) => {
        const editUserButton = event.target.closest("[data-admin-edit-user]");
        if (editUserButton) {
          openEditModal(editUserButton.dataset.adminEditUser);
          return;
        }
    });
  };

  const bindAdminHandlers = () => {
    bindUsersActions(teachersTableBody);
    bindUsersActions(studentsTableBody);

    const createUserForm = document.getElementById("adminCreateUserForm");
    const roleSelect = document.getElementById("newUserRole");
    const studentFields = document.getElementById("newStudentFields");
    const toggleStudentFields = () => {
      const isStudent = roleSelect?.value === "student";
      if (studentFields) {
        studentFields.hidden = !isStudent;
      }
    };
    if (roleSelect && !roleSelect.dataset.bound) {
      roleSelect.dataset.bound = "true";
      roleSelect.addEventListener("change", toggleStudentFields);
      toggleStudentFields();
    }
    if (createUserForm && !createUserForm.dataset.bound) {
      createUserForm.dataset.bound = "true";
      createUserForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const role = String(document.getElementById("newUserRole")?.value || "student");
        const payload = {
          full_name: String(document.getElementById("newUserFullName")?.value || "").trim(),
          login: String(document.getElementById("newUserLogin")?.value || "").trim(),
          password: String(document.getElementById("newUserPassword")?.value || "").trim(),
          role,
          student_profile: null,
        };

        if (!payload.full_name || !payload.login || !payload.password) {
          showStatus("Заполни ФИО, логин и пароль.", true);
          return;
        }

        if (role === "student") {
          payload.student_profile = {
            curator: String(document.getElementById("newStudentCurator")?.value || "").trim(),
            direction: String(document.getElementById("newStudentDirection")?.value || "").trim(),
            degree: String(document.getElementById("newStudentDegree")?.value || "").trim(),
            study_year: Number(document.getElementById("newStudentYear")?.value || 1),
            language: String(document.getElementById("newStudentLanguage")?.value || "ru"),
            study_type: String(document.getElementById("newStudentStudyType")?.value || "").trim(),
            group_name: String(document.getElementById("newStudentGroup")?.value || "").trim(),
            scholarship: Boolean(document.getElementById("newStudentScholarship")?.checked),
          };
          if (
            !payload.student_profile.curator
            || !payload.student_profile.direction
            || !payload.student_profile.degree
            || !payload.student_profile.study_type
            || !payload.student_profile.group_name
          ) {
            showStatus("Для студента заполни все поля профиля.", true);
            return;
          }
        }

        try {
          await apiRequest("/api/admin/users", {
            method: "POST",
            body: JSON.stringify(payload),
          });
          showStatus("Пользователь добавлен.");
          createUserForm.reset();
          toggleStudentFields();
          await loadUsers();
          await loadStats();
        } catch (error) {
          showStatus(error.message || "Не удалось добавить пользователя.", true);
        }
      });
    }

    if (userSearchInput && !userSearchInput.dataset.bound) {
      userSearchInput.dataset.bound = "true";
      userSearchInput.addEventListener("input", async () => {
        await loadUsers();
      });
    }

    if (securityToggle && securityList && !securityToggle.dataset.bound) {
      securityToggle.dataset.bound = "true";
      securityToggle.addEventListener("click", () => {
        const isHidden = securityList.hidden;
        securityList.hidden = !isHidden;
        securityToggle.textContent = isHidden ? "Свернуть" : "Развернуть";
        securityToggle.setAttribute("aria-expanded", isHidden ? "true" : "false");
      });
    }

    if (editModal && !editModal.dataset.bound) {
      editModal.dataset.bound = "true";
      editModal.addEventListener("click", (event) => {
        if (event.target.closest("[data-close-admin-edit-modal]")) {
          closeEditModal();
        }
      });
    }

    if (editForm && !editForm.dataset.bound) {
      editForm.dataset.bound = "true";
      editForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const userId = Number(document.getElementById("editUserId")?.value || 0);
        const fullName = String(document.getElementById("editUserFullName")?.value || "").trim();
        const login = String(document.getElementById("editUserLogin")?.value || "").trim();
        const password = String(document.getElementById("editUserPassword")?.value || "").trim();

        const user = cachedUsers.find((item) => item.id === userId);
        if (!user) {
          showStatus("Пользователь не найден.", true);
          return;
        }
        if (!fullName || !login) {
          showStatus("Заполни ФИО и логин.", true);
          return;
        }

        const payload = { full_name: fullName, login };
        if (password) {
          if (password.length < 8) {
            showStatus("Новый пароль должен быть минимум 8 символов.", true);
            return;
          }
          payload.password = password;
        }

        if (user.role === "student") {
          payload.student_profile = {
            curator: String(document.getElementById("editStudentCurator")?.value || "").trim(),
            direction: String(document.getElementById("editStudentDirection")?.value || "").trim(),
            degree: String(document.getElementById("editStudentDegree")?.value || "").trim(),
            study_year: Number(document.getElementById("editStudentYear")?.value || 1),
            language: String(document.getElementById("editStudentLanguage")?.value || "ru"),
            study_type: String(document.getElementById("editStudentStudyType")?.value || "").trim(),
            group_name: String(document.getElementById("editStudentGroup")?.value || "").trim(),
            scholarship: Boolean(document.getElementById("editStudentScholarship")?.checked),
          };
          if (
            !payload.student_profile.curator
            || !payload.student_profile.direction
            || !payload.student_profile.degree
            || !payload.student_profile.study_type
            || !payload.student_profile.group_name
          ) {
            showStatus("Для студента заполни все поля профиля.", true);
            return;
          }
        }

        try {
          await apiRequest(`/api/admin/users/${userId}`, {
            method: "PATCH",
            body: JSON.stringify(payload),
          });
          closeEditModal();
          showStatus("Пользователь обновлён.");
          await loadUsers();
        } catch (error) {
          showStatus(error.message || "Не удалось обновить пользователя.", true);
        }
      });
    }
  };

  try {
    await Promise.all([loadStats(), loadUsers(), loadSecurity()]);
    bindAdminHandlers();
  } catch (error) {
    showStatus(error.message || "Не удалось загрузить данные админ-панели.", true);
  }
}

async function renderAdminModerationPage(session) {
  const reportsList = document.getElementById("adminReportsList");
  const reportsBadge = document.getElementById("adminReportsBadge");
  const statusBox = document.getElementById("adminModerationStatusBox");

  if (!reportsList || session.role !== "admin") {
    return;
  }

  const showStatus = (text, isError = false) => {
    if (!statusBox) {
      return;
    }
    statusBox.hidden = false;
    statusBox.textContent = text;
    statusBox.style.color = isError ? "#b42318" : "var(--app-muted)";
  };

  const loadReports = async () => {
    const reports = await apiRequest("/api/admin/moderation/reports");
    if (reportsBadge) {
      reportsBadge.textContent = `${reports.filter((item) => item.status === "open").length} жалоб`;
    }
    if (!reports.length) {
      reportsList.innerHTML = "<div class='moderation-item'><p>Жалоб пока нет.</p></div>";
      return;
    }
    reportsList.innerHTML = reports
      .map((item) => `
        <div class="moderation-item">
          <strong>#${item.id} ${escapeHtml(item.target_type)}:${item.target_id} — ${escapeHtml(item.reporter_name || `User ${item.reporter_id}`)}</strong>
          <p>${escapeHtml(item.reason)}</p>
          <div class="d-flex gap-2">
            <button class="btn btn-outline-success btn-sm" data-admin-resolve-report="${item.id}" data-status="resolved">Resolve</button>
            <button class="btn btn-outline-secondary btn-sm" data-admin-resolve-report="${item.id}" data-status="rejected">Reject</button>
          </div>
        </div>
      `)
      .join("");
  };

  if (!reportsList.dataset.bound) {
    reportsList.dataset.bound = "true";
    reportsList.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-admin-resolve-report]");
      if (!button) {
        return;
      }
      try {
        await apiRequest(`/api/admin/moderation/reports/${button.dataset.adminResolveReport}`, {
          method: "PATCH",
          body: JSON.stringify({ status: button.dataset.status, resolution_note: null }),
        });
        showStatus("Жалоба обработана.");
        await loadReports();
      } catch (error) {
        showStatus(error.message || "Не удалось обновить жалобу.", true);
      }
    });
  }

  try {
    await loadReports();
  } catch (error) {
    showStatus(error.message || "Не удалось загрузить модерацию.", true);
  }
}

async function renderAdminSettingsPage(session) {
  const settingsForm = document.getElementById("adminSettingsForm");
  const statusBox = document.getElementById("adminSettingsStatusBox");

  if (!settingsForm || session.role !== "admin") {
    return;
  }

  const showStatus = (text, isError = false) => {
    if (!statusBox) {
      return;
    }
    statusBox.hidden = false;
    statusBox.textContent = text;
    statusBox.style.color = isError ? "#b42318" : "var(--app-muted)";
  };

  const loadSettings = async () => {
    const settings = await apiRequest("/api/admin/settings");
    const maxUploadNode = document.getElementById("adminMaxUploadMb");
    const policyNode = document.getElementById("adminGradingPolicy");
    const cronNode = document.getElementById("adminCronExpr");
    if (maxUploadNode) maxUploadNode.value = settings.max_upload_mb;
    if (policyNode) policyNode.value = settings.grading_policy;
    if (cronNode) cronNode.value = settings.cron_expression;
  };

  if (!settingsForm.dataset.bound) {
    settingsForm.dataset.bound = "true";
    settingsForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const maxUploadMb = Number(document.getElementById("adminMaxUploadMb")?.value || 50);
      const gradingPolicy = String(document.getElementById("adminGradingPolicy")?.value || "standard").trim();
      const cronExpression = String(document.getElementById("adminCronExpr")?.value || "*/15 * * * *").trim();
      try {
        await apiRequest("/api/admin/settings", {
          method: "PUT",
          body: JSON.stringify({ max_upload_mb: maxUploadMb, grading_policy: gradingPolicy, cron_expression: cronExpression }),
        });
        showStatus("Настройки платформы сохранены.");
      } catch (error) {
        showStatus(error.message || "Не удалось сохранить настройки.", true);
      }
    });
  }

  try {
    await loadSettings();
  } catch (error) {
    showStatus(error.message || "Не удалось загрузить настройки.", true);
  }
}

async function renderTestsPage(session) {
  const list = document.getElementById("testsList");
  const emptyState = document.getElementById("testsEmptyState");
  const badge = document.getElementById("testsCountBadge");
  const teacherPanel = document.getElementById("teacherTestPanel");
  const form = document.getElementById("testCreateForm");
  const showFormButton = document.getElementById("showTestFormButton");

  if (!list) {
    return;
  }

  if (teacherPanel && session.role === "teacher") {
    teacherPanel.hidden = false;
  }

  if (showFormButton && teacherPanel && !showFormButton.dataset.bound) {
    showFormButton.dataset.bound = "true";
    showFormButton.addEventListener("click", () => {
      teacherPanel.hidden = false;
      teacherPanel.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  try {
    const tests = await apiRequest(`/api/quizzes/courses/${DEFAULT_COURSE_ID}`);
    list.innerHTML = "";

    tests.forEach((test) => {
      const card = document.createElement("article");
      card.className = "builder-preview";
      card.innerHTML = `
        <div class="builder-preview-header">
          <strong>${test.title}</strong>
          <span class="course-tag">${test.questions.length} вопросов</span>
        </div>
        <p class="quiz-result">Дедлайн: ${formatAssignmentDeadline(test.deadline)}</p>
        <p class="quiz-result">${test.description || "Описание не указано."}</p>
        <p class="quiz-result">${session.role === "teacher" ? "Статус: Опубликован для студентов" : "Статус: Доступен к прохождению"}</p>
      `;
      list.appendChild(card);
    });

    if (badge) {
      badge.textContent = `${tests.length} опубликовано`;
    }

    if (emptyState) {
      emptyState.hidden = tests.length > 0;
      if (!emptyState.hidden) {
        emptyState.textContent = "Пока тестов нет.";
      }
    }
  } catch (error) {
    list.innerHTML = "";
    if (badge) {
      badge.textContent = "Нет доступа";
    }
    if (emptyState) {
      emptyState.hidden = false;
      emptyState.textContent = error.message || "Не удалось загрузить тесты.";
    }
  }

  if (form && !form.dataset.bound) {
    form.dataset.bound = "true";
    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      if (session.role !== "teacher") {
        return;
      }

      const formData = new FormData(form);
      const title = String(formData.get("title") || "").trim();
      const deadline = String(formData.get("deadline") || "").trim();
      const questionsCount = Number(formData.get("questionsCount") || 1);

      if (!title || !deadline || questionsCount < 1) {
        return;
      }

      try {
        await apiRequest(`/api/quizzes/courses/${DEFAULT_COURSE_ID}`, {
          method: "POST",
          body: JSON.stringify({
            title,
            description: String(formData.get("description") || "").trim(),
            deadline: `${deadline}T23:59:00`,
            lesson_id: null,
            passing_score: 60,
            questions: buildDraftQuizQuestions(questionsCount),
          }),
        });
        form.reset();
        await renderTestsPage(session);
      } catch (error) {
        if (emptyState) {
          emptyState.hidden = false;
          emptyState.textContent = error.message || "Не удалось сохранить тест.";
        }
      }
    });
  }
}

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

function renderMessengerPage(session) {
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

function setupLogout() {
  document.querySelectorAll("[data-logout-button]").forEach((button) => {
    button.addEventListener("click", () => {
      clearSession();
      window.location.replace("/");
    });
  });
}

function setupLoginForm() {
  const form = document.getElementById("loginForm");
  const errorBox = document.getElementById("loginError");
  if (!form) {
    return;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(form);
    const username = String(formData.get("username") || "").trim().toLowerCase();
    const password = String(formData.get("password") || "").trim();
    const user = DEMO_USERS[username];
    const isDemoAlias = Boolean(user);

    if (isDemoAlias && user.password !== password) {
      if (errorBox) {
        errorBox.hidden = false;
      }
      return;
    }

    try {
      const payloadEmail = isDemoAlias ? user.email : username;
      const payloadPassword = isDemoAlias ? user.backendPassword : password;
      const payload = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: payloadEmail,
          password: payloadPassword,
        }),
      });

      if (!payload.ok) {
        throw new Error("Не удалось выполнить вход.");
      }

      const result = await payload.json();
      const roleLabelMap = {
        student: "Студент",
        teacher: "Преподаватель",
        admin: "Администратор",
      };

      setSession({
        username: payloadEmail,
        accessToken: result.access_token,
        role: result.user.role,
        name: result.user.full_name,
        roleLabel: roleLabelMap[result.user.role] || result.user.role,
        avatar: result.user.avatar,
        email: result.user.email,
        userId: result.user.id,
      });
      window.location.replace(result.user.role === "admin" ? "/admin" : "/profile");
    } catch {
      if (errorBox) {
        errorBox.hidden = false;
      }
    }
  });
}

const session = requireSession();

if (!isAuthPage()) {
  guardRoleAccess(session);
  updateTopbarTime();
  setInterval(updateTopbarTime, 60_000);
  applySessionToUi(session);
  updateAssignmentsNavDeadlineDot(session);
  setInterval(() => {
    updateAssignmentsNavDeadlineDot(session);
  }, 120_000);
  setupLogout();
  renderProfileInfo(session);
  renderStudentGpa(session);
  renderStudentAttendance(session);
  renderSchedulePage(session);
  renderAssignmentsPage(session);
  renderAdminAssignmentsPage(session);
  renderDirectoryPage(session);
  renderAdminPage(session);
  renderAdminModerationPage(session);
  renderAdminSettingsPage(session);
  renderTestsPage(session);
  renderMessengerPage(session);
}

if (isAuthPage()) {
  setupLoginForm();
}
