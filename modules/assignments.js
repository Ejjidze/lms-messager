import {
  ADMIN_TEACHER_SUBJECTS,
  ALLOWED_ASSIGNMENT_MATERIAL_EXTENSIONS,
  DEFAULT_COURSE_ID,
  apiDownload,
  apiRequest,
  escapeHtml,
  extractSubjectCode,
  formatAssignmentDeadline,
  normalizeSubjectTitle,
} from "/modules/common.js";

export function renderAssignmentsPage(session) {
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

export async function renderAdminAssignmentsPage(session) {
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
