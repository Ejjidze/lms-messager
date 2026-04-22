import {
  STUDENT_PROFILE_META,
  TEACHER_PROFILE_META,
  apiRequest,
} from "/modules/common.js";

export function renderProfileInfo(session) {
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

export async function renderStudentGpa(session) {
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

export async function renderStudentAttendance(session) {
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
