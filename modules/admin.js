import {
  ADMIN_TEACHER_SUBJECTS,
  apiRequest,
  escapeHtml,
} from "/modules/common.js";

export async function renderAdminPage(session) {
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

export async function renderAdminModerationPage(session) {
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

export async function renderAdminSettingsPage(session) {
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
