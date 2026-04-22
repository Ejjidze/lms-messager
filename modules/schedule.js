import {
  ADMIN_TEACHER_SUBJECTS,
  TEACHER_PROFILE_META,
  apiRequest,
  escapeHtml,
} from "/modules/common.js";

export async function renderSchedulePage(session) {
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
