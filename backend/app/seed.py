from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models import Assignment, Chat, Course, Lesson, Message, Module, Notification, User


def seed_database(db: Session) -> None:
    user_exists = db.scalar(select(User.id).limit(1))
    if user_exists:
        return

    student = User(
        email="student@eduflow.local",
        password_hash=hash_password("student123"),
        full_name="Назир Г.",
        role="student",
        bio="Осваивает веб-разработку, UI/UX и современные инструменты онлайн-обучения.",
        avatar="NG",
        online=True,
    )
    teacher = User(
        email="teacher@eduflow.local",
        password_hash=hash_password("teacher123"),
        full_name="Алина Каримова",
        role="teacher",
        bio="Создаёт учебные программы, проверяет задания и сопровождает студентов по курсу.",
        avatar="AK",
        online=True,
    )
    admin = User(
        email="admin@eduflow.local",
        password_hash=hash_password("admin123"),
        full_name="Системный администратор",
        role="admin",
        bio="Отвечает за модерацию, безопасность и стабильность платформы.",
        avatar="SA",
        online=False,
    )
    db.add_all([student, teacher, admin])
    db.flush()

    fullstack = Course(
        title="Fullstack Web Development",
        description="HTML, CSS, JavaScript, FastAPI и архитектура веб-сервисов.",
        category="Programming",
        level="Intermediate",
        teacher_id=teacher.id,
        students_count=120,
        progress_percent=72,
        cover_url="/static/covers/fullstack.jpg",
    )
    ux = Course(
        title="UX/UI Design Essentials",
        description="Исследования пользователей, wireframes, интерфейсы и прототипирование.",
        category="Design",
        level="Beginner",
        teacher_id=teacher.id,
        students_count=80,
        progress_percent=54,
        cover_url="/static/covers/ux.jpg",
    )
    db.add_all([fullstack, ux])
    db.flush()

    module_one = Module(course_id=fullstack.id, title="Модуль 1. Введение в LMS")
    module_two = Module(course_id=fullstack.id, title="Модуль 2. Задания и тесты")
    db.add_all([module_one, module_two])
    db.flush()

    db.add_all(
        [
            Lesson(
                module_id=module_one.id,
                title="Введение в платформу",
                description="Обзор ролей пользователей, ключевых разделов и логики работы LMS.",
                content_type=["text", "video", "pdf"],
                duration_minutes=15,
            ),
            Lesson(
                module_id=module_one.id,
                title="Структура курса",
                description="Модули, уроки, файлы, внешние ссылки и последовательное обучение.",
                content_type=["text", "link", "doc"],
                duration_minutes=22,
            ),
            Lesson(
                module_id=module_two.id,
                title="Создание задания",
                description="Типы заданий, дедлайны и критерии оценки.",
                content_type=["video", "text"],
                duration_minutes=18,
            ),
        ]
    )

    db.add_all(
        [
            Assignment(
                course_id=fullstack.id,
                title="Спроектировать карточку курса",
                description="Создать карточку курса с названием, описанием, категорией и CTA-кнопкой.",
                deadline=datetime.fromisoformat("2026-04-02T18:00:00"),
                type="file",
                status="pending",
            ),
            Assignment(
                course_id=fullstack.id,
                title="Написать use case для LMS",
                description="Описать сценарии использования для студента, преподавателя и администратора.",
                deadline=datetime.fromisoformat("2026-04-04T20:00:00"),
                type="text",
                status="review",
                grade=92,
                teacher_comment="Хорошая структура, добавьте кейс модерации.",
            ),
        ]
    )

    db.add_all(
        [
            Notification(
                user_id=student.id,
                title="Новое задание",
                message="Преподаватель добавил задание по проектированию интерфейса.",
                kind="assignment",
                is_read=False,
                created_at=datetime.fromisoformat("2026-03-30T10:15:00"),
            ),
            Notification(
                user_id=student.id,
                title="Новое сообщение",
                message="В чате курса 4 непрочитанных сообщения.",
                kind="chat",
                is_read=False,
                created_at=datetime.fromisoformat("2026-03-30T09:31:00"),
            ),
        ]
    )

    group_chat = Chat(
        title="Frontend Bootcamp",
        chat_type="group",
        participant_ids=[student.id, teacher.id],
        course_id=fullstack.id,
    )
    direct_chat = Chat(
        title="Алина Каримова",
        chat_type="direct",
        participant_ids=[student.id, teacher.id],
        course_id=None,
    )
    admin_chat = Chat(
        title="Admin Desk",
        chat_type="admin",
        participant_ids=[teacher.id, admin.id],
        course_id=None,
    )
    db.add_all([group_chat, direct_chat, admin_chat])
    db.flush()

    db.add_all(
        [
            Message(
                chat_id=group_chat.id,
                sender_id=teacher.id,
                sender_name="Алина",
                content="Сегодня до 18:00 загружаем макеты на проверку.",
                message_type="text",
                status="read",
                created_at=datetime.fromisoformat("2026-03-30T09:20:00"),
            ),
            Message(
                chat_id=group_chat.id,
                sender_id=student.id,
                sender_name="Назир",
                content="Принято, добавлю экран мессенджера и панель курсов.",
                message_type="text",
                status="read",
                created_at=datetime.fromisoformat("2026-03-30T09:27:00"),
            ),
            Message(
                chat_id=direct_chat.id,
                sender_id=teacher.id,
                sender_name="Алина",
                content="Если понадобится, могу отдельно проверить структуру курсовой работы.",
                message_type="text",
                status="read",
                created_at=datetime.fromisoformat("2026-03-29T18:30:00"),
            ),
            Message(
                chat_id=admin_chat.id,
                sender_id=admin.id,
                sender_name="Система",
                content="Поступила жалоба на контент курса SMM Sprint.",
                message_type="text",
                status="delivered",
                created_at=datetime.fromisoformat("2026-03-30T08:02:00"),
            ),
        ]
    )

    db.commit()
