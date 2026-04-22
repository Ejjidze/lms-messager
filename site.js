import {
  DEFAULT_COURSE_ID,
  DEMO_USERS,
  applySessionToUi,
  apiRequest,
  buildDraftQuizQuestions,
  guardRoleAccess,
  isAuthPage,
  requireSession,
  setSession,
  setupLogout,
  updateAssignmentsNavDeadlineDot,
  updateTopbarTime,
  formatAssignmentDeadline,
} from "/modules/common.js";
import { renderProfileInfo, renderStudentAttendance, renderStudentGpa } from "/modules/profile.js";
import { renderSchedulePage } from "/modules/schedule.js";
import { renderAssignmentsPage, renderAdminAssignmentsPage } from "/modules/assignments.js";
import { renderDirectoryPage } from "/modules/directory.js";
import { renderMessengerPage } from "/modules/messenger.js";
import { renderAdminPage, renderAdminModerationPage, renderAdminSettingsPage } from "/modules/admin.js";

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
