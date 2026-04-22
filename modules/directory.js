import {
  ADMIN_TEACHER_SUBJECTS,
  STUDENT_PROFILE_META,
  TEACHER_PROFILE_META,
  apiRequest,
  escapeHtml,
  extractSubjectCode,
  normalizeSubjectTitle,
} from "/modules/common.js";

export async function renderDirectoryPage(session) {
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
