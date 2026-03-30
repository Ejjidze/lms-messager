# EduFlow LMS

EduFlow LMS - это демонстрационный проект веб-платформы для онлайн-обучения со встроенным мессенджером. Проект можно открыть локально без сборки: достаточно запустить файл `index.html` в браузере.

## Что реализовано

- роли пользователей: `student`, `teacher`, `admin`
- каталог курсов с фильтрацией по категории и уровню
- структура курса: модули и уроки
- блок заданий и мини-тест с автопроверкой
- отслеживание прогресса и уведомления
- профиль пользователя и административная панель
- интегрированный мессенджер:
  - личные чаты
  - групповые чаты курса
  - административный канал
  - статусы сообщений
  - индикатор набора текста
  - поиск по чатам
  - отправка сообщений и файлов в demo-режиме

## Стек технологий

### Frontend

- HTML
- CSS
- JavaScript

### Backend для полной версии

- FastAPI
- MySQL
- SQLAlchemy
- WebSocket

## Предлагаемая структура backend-версии

```text
eduflow-lms/
├── backend/
│   ├── app/
│   │   ├── core/
│   │   ├── routers/
│   │   ├── schemas/
│   │   ├── data.py
│   │   └── main.py
│   └── requirements.txt
├── static/
└── frontend files
```

## Основные сущности системы

- `User`: общая модель пользователя
- `StudentProfile`, `TeacherProfile`, `AdminProfile`
- `Course`: курс
- `Category`: категория курса
- `Module`: модуль курса
- `Lesson`: урок
- `Assignment`: задание
- `Submission`: решение студента
- `Quiz`, `Question`, `AnswerOption`
- `Enrollment`: запись студента на курс
- `Progress`: прогресс по курсу
- `Chat`: чат
- `ChatParticipant`: участник чата
- `Message`: сообщение
- `Notification`: уведомление

## Use Case Diagram

```mermaid
graph TD
    Student["Студент"] --> UC1["Просмотр курсов"]
    Student --> UC2["Запись на курс"]
    Student --> UC3["Прохождение уроков"]
    Student --> UC4["Отправка задания"]
    Student --> UC5["Общение в чате"]

    Teacher["Преподаватель"] --> UC6["Создание курса"]
    Teacher --> UC7["Редактирование контента"]
    Teacher --> UC8["Проверка задания"]
    Teacher --> UC5

    Admin["Администратор"] --> UC9["Управление пользователями"]
    Admin --> UC10["Модерация контента"]
    Admin --> UC11["Мониторинг системы"]
```

## Class Diagram

```mermaid
classDiagram
    class User {
      +id
      +name
      +email
      +password_hash
      +role
      +photo
    }

    class Course {
      +id
      +title
      +description
      +category
      +cover
      +level
    }

    class Module {
      +id
      +title
    }

    class Lesson {
      +id
      +title
      +content
      +video_url
      +file
    }

    class Assignment {
      +id
      +title
      +deadline
      +type
    }

    class Submission {
      +id
      +content
      +grade
      +comment
    }

    class Chat {
      +id
      +type
      +title
    }

    class Message {
      +id
      +text
      +status
      +created_at
    }

    User "1" --> "*" Course : creates
    Course "1" --> "*" Module
    Module "1" --> "*" Lesson
    Course "1" --> "*" Assignment
    Assignment "1" --> "*" Submission
    Chat "1" --> "*" Message
    User "*" --> "*" Chat : participates
    User "1" --> "*" Message : sends
```

## Sequence Diagram: Отправка сообщения

```mermaid
sequenceDiagram
    participant User as Пользователь
    participant UI as Интерфейс LMS
    participant WS as WebSocket Server
    participant DB as База данных
    participant Peer as Получатель

    User->>UI: Вводит сообщение и нажимает "Отправить"
    UI->>WS: Передаёт сообщение через WebSocket
    WS->>DB: Сохраняет сообщение
    WS-->>UI: Возвращает статус "отправлено"
    WS-->>Peer: Доставляет сообщение в чат
    Peer-->>WS: Подтверждает прочтение
    WS-->>UI: Обновляет статус на "прочитано"
```

## Component Diagram

```mermaid
graph LR
    A["Frontend UI"] --> B["Auth Module"]
    A --> C["Course Module"]
    A --> D["Assignment Module"]
    A --> E["Messenger Module"]
    A --> F["Notification Module"]
    B --> G["FastAPI Backend"]
    C --> G
    D --> G
    E --> H["WebSocket Gateway"]
    F --> G
    G --> I["MySQL Database"]
    H --> I
```

## Что можно сделать следующим этапом

- реализовать регистрацию и авторизацию
- добавить миграции Alembic и `.env`-конфигурацию
- подключить полноценный WebSocket-чат
- сделать загрузку файлов и хранение медиа
- вынести админ-панель в отдельный раздел
