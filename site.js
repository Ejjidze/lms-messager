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
    window.location.replace("/profile");
    return null;
  }
  return session;
}

function guardRoleAccess(session) {
  if (!session) {
    return;
  }

  if (window.location.pathname === "/admin" && session.role !== "admin") {
    window.location.replace("/profile");
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

  const directoryLabel = session.role === "student"
    ? "Преподаватели"
    : session.role === "teacher"
      ? "Студенты"
      : "Пользователи";
  document.querySelectorAll('a[href="/directory"]').forEach((element) => {
    element.textContent = directoryLabel;
  });
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

function renderAssignmentsPage(session) {
  const list = document.getElementById("assignmentList");
  const emptyState = document.getElementById("assignmentEmptyState");
  const badge = document.getElementById("assignmentsCountBadge");
  const teacherPanel = document.getElementById("teacherAssignmentPanel");
  const form = document.getElementById("assignmentCreateForm");
  const showFormButton = document.getElementById("showAssignmentFormButton");

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

  const renderAssignments = async () => {
    try {
      const assignments = await apiRequest("/api/assignments");
      assignments.sort((left, right) => String(left.deadline).localeCompare(String(right.deadline)));
      list.innerHTML = "";

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
              const container = list.querySelector(`[data-submissions-container="${assignmentId}"]`);
              if (container) {
                await renderAssignmentSubmissions(assignmentId, assignmentMax, container);
              }
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
        });
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
      window.location.replace("/profile");
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
  setupLogout();
  renderProfileInfo(session);
  renderAssignmentsPage(session);
  renderDirectoryPage(session);
  renderTestsPage(session);
  renderMessengerPage(session);
}

if (isAuthPage()) {
  setupLoginForm();
}
