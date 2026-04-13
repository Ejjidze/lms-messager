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
    && ["/assignments", "/messenger", "/directory", "/tests"].includes(pathname)
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
    document.querySelectorAll('a[href="/assignments"], a[href="/messenger"], a[href="/directory"], a[href="/tests"]').forEach((element) => {
      element.hidden = true;
    });
  }

  const directoryLabel = session.role === "student"
    ? "Преподаватели"
    : session.role === "teacher"
      ? "Студенты"
      : "Пользователи";
  document.querySelectorAll('a[href="/directory"]').forEach((element) => {
    element.textContent = directoryLabel;
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

  let schedule = null;
  let editMode = false;

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
    schedule = await apiRequest("/api/schedule");
  } catch (error) {
    setStatus(error.message || "Не удалось загрузить расписание.", "error");
    return;
  }

  if (session.role === "admin" && adminControls) {
    adminControls.hidden = false;
  }

  renderSheet();

  if (session.role !== "admin" || !editToggleButton || !saveButton || !cancelButton) {
    return;
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
        schedule = await apiRequest("/api/schedule", {
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
        let courseList = [];
        try {
          courseList = await apiRequest("/api/courses");
        } catch {
          courseList = [];
        }
        const courseMap = new Map(courseList.map((course) => [course.id, course]));
        studentSubjects.clear();
        assignments.forEach((assignment) => {
          const course = courseMap.get(assignment.course_id);
          const courseId = Number(assignment.course_id);
          const teacherName = assignment.teacher_name || course?.teacher_name || "Преподаватель";
          const key = `${courseId}:${teacherName}`;
          if (!studentSubjects.has(key)) {
            studentSubjects.set(key, {
              key,
              courseId,
              title: assignment.course_title || course?.title || "Предмет не указан",
              teacherName,
              items: [],
            });
          }
          studentSubjects.get(key).items.push(assignment);
        });

        const subjects = Array.from(studentSubjects.values()).sort((a, b) => a.title.localeCompare(b.title, "ru"));
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
                      <td>${formatSubjectAverage(averageFivePoint)}</td>
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
      const maxScoreValue = Number(formData.get("max_score") || 100);
      const materialFile = formData.get("file");

      if (!title || !deadline || !(materialFile instanceof File) || !materialFile.name) {
        return;
      }
      if (!Number.isFinite(maxScoreValue) || maxScoreValue < 1 || maxScoreValue > 1000) {
        if (emptyState) {
          emptyState.hidden = false;
          emptyState.textContent = "Максимальный балл должен быть от 1 до 1000.";
        }
        return;
      }

      if (!materialFile.name.toLowerCase().endsWith(".txt")) {
        if (emptyState) {
          emptyState.hidden = false;
          emptyState.textContent = "Разрешены только .txt файлы.";
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

async function renderDirectoryPage(session) {
  const list = document.getElementById("directoryList");
  const emptyState = document.getElementById("directoryEmptyState");
  const badge = document.getElementById("directoryCountBadge");
  const title = document.getElementById("directoryTitle");

  if (!list) {
    return;
  }

  if (title) {
    title.textContent = session.role === "student"
      ? "Список преподавателей"
      : session.role === "teacher"
        ? "Список студентов"
        : "Список пользователей";
  }

  try {
    const users = await apiRequest("/api/users/directory");
    list.innerHTML = "";

    users.forEach((user) => {
      const teacherMeta = TEACHER_PROFILE_META[user.email] || {
        department: "Кафедра информационных технологий",
        office: "A101",
      };
      const roleSpecificLine = user.role === "teacher"
        ? `Кафедра: ${escapeHtml(teacherMeta.department)}`
        : `Курс: ${escapeHtml(STUDENT_PROFILE_META.direction)}`;
      const roleSecondaryLine = user.role === "teacher"
        ? `<p>Кабинет: ${escapeHtml(teacherMeta.office)}</p>`
        : "";

      const card = document.createElement("article");
      card.className = "assignment-card directory-card";
      card.innerHTML = `
        <div class="assignment-card-header">
          <strong>${escapeHtml(user.full_name)}</strong>
          <span class="course-tag">${user.role === "teacher" ? "Преподаватель" : "Студент"}</span>
        </div>
        <p>${roleSpecificLine}</p>
        ${roleSecondaryLine}
        <p>Статус: ${user.online ? "В сети" : "Не в сети"}</p>
        <a class="directory-chat-button" href="/messenger?peer=${user.id}" title="Открыть чат">
          <i class="bi bi-chat-dots"></i>
        </a>
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
            sender_id: session.userId || 0,
            sender_name: session.name || "",
            content,
            message_type: "text",
            created_at: new Date().toISOString(),
          }),
        });
        messageInput.value = "";
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
  renderSchedulePage(session);
  renderAssignmentsPage(session);
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
