# FastAPI Backend

## Запуск

```bash
cd backend
mysql -u root -p < init_db.sql
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# при необходимости измени DATABASE_URL, API_HOST, API_PORT
alembic upgrade head
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

После запуска API будет доступно по адресу:

- `http://127.0.0.1:8000/api/health`
- `http://127.0.0.1:8000/docs`

## Что уже есть

- настройки вынесены в `.env`
- подключение к MySQL через `SQLAlchemy`
- Alembic-миграции для актуализации схемы БД
- первичное заполнение demo-данными через `seed_database`
- JWT-аутентификация через `Bearer`-токен
- локальное media-хранилище для файлов и изображений
- ограничения доступа к чатам и загрузкам по ролям и участникам
- отдельные миграции для `enrollments`, `grades` и `progress_history`
- API для записи на курс, выставления оценок и просмотра истории прогресса
- аналитические endpoints, использующие `Grade` и `ProgressHistory`
- API для прохождения уроков, тестов и авторасчёта прогресса
- агрегаты для leaderboard, retention и completion rate
- API для ручного создания тестов преподавателем и редактора вопросов
- materialized summaries и refresh-endpoints для ускорения analytics
- cron-friendly job для фонового автообновления analytics summaries
- `POST /api/auth/login` - получение access token
- `GET /api/users` - список пользователей
- `GET /api/users/me` - текущий пользователь
- `GET /api/courses` - список курсов с фильтрами
- `GET /api/courses/{course_id}` - курс с модулями и уроками
- `GET /api/analytics/overview` - сводная аналитика LMS для текущего пользователя
- `GET /api/analytics/courses/{course_id}` - аналитика по конкретному курсу
- `GET /api/analytics/courses/{course_id}/leaderboard` - рейтинг студентов курса
- `GET /api/analytics/courses/{course_id}/retention` - удержание студентов по активности
- `GET /api/analytics/courses/{course_id}/completion-rate` - доля завершивших курс
- `POST /api/analytics/refresh` - полное обновление materialized summaries
- `POST /api/analytics/courses/{course_id}/refresh` - обновить summaries по одному курсу
- `POST /api/enrollments/courses/{course_id}` - запись студента на курс
- `GET /api/enrollments/courses/{course_id}` - список записей на курс
- `GET /api/assignments` - список заданий
- `POST /api/assignments/{assignment_id}/submit` - отправка решения
- `POST /api/assignments/{assignment_id}/upload` - загрузка файла решения
- `GET /api/assignments/{assignment_id}/submissions` - список отправленных решений
- `POST /api/grades/submissions/{submission_id}` - выставление или обновление оценки
- `GET /api/grades/submissions/{submission_id}` - просмотр оценки
- `POST /api/lessons/{lesson_id}/complete` - отметить урок как пройденный
- `GET /api/quizzes/courses/{course_id}` - список тестов курса
- `POST /api/quizzes/courses/{course_id}` - создать тест для курса
- `GET /api/quizzes/{quiz_id}` - получить тест с вопросами
- `PATCH /api/quizzes/{quiz_id}` - обновить тест
- `DELETE /api/quizzes/{quiz_id}` - удалить тест
- `POST /api/quizzes/{quiz_id}/questions` - добавить вопрос в тест
- `PATCH /api/questions/{question_id}` - обновить вопрос и варианты ответа
- `DELETE /api/questions/{question_id}` - удалить вопрос из теста
- `POST /api/quizzes/{quiz_id}/submit` - отправить ответы и получить автопроверку
- `POST /api/progress/courses/{course_id}` - добавить событие прогресса
- `GET /api/progress/courses/{course_id}` - получить историю прогресса
- `GET /api/notifications` - уведомления пользователя
- `GET /api/chats` - список чатов
- `GET /api/chats/{chat_id}` - чат с историей сообщений
- `POST /api/chats/{chat_id}/messages` - отправка сообщения
- `POST /api/chats/{chat_id}/attachments` - загрузка файла или изображения в чат
- `WS /ws/chats/{chat_id}` - realtime-канал мессенджера

## Demo-аккаунты

- `student@eduflow.local / student123`
- `teacher@eduflow.local / teacher123`
- `admin@eduflow.local / admin123`

## JWT flow

1. Выполните `POST /api/auth/login` с `email` и `password`.
2. Возьмите `access_token` из ответа.
3. Передавайте его в заголовке:

```text
Authorization: Bearer <access_token>
```

## Медиафайлы

- файлы сохраняются в `backend/media`
- FastAPI раздаёт их по пути `/media/...`
- изображения и документы можно прикреплять к чатам и заданиям

## Analytics Refresh Job

Ручной запуск фоновой задачи:

```bash
cd backend
python3 -m app.jobs.refresh_summaries
```

Пример запуска по `cron` лежит в:

- [analytics_refresh.cron.example](/Users/nailgabidin/Documents/New project 2/backend/cron/analytics_refresh.cron.example)

Рекомендуемый сценарий:

```bash
crontab -e
```

И добавить строку по примеру из файла, чтобы summaries обновлялись каждые 15 минут. Расписание по умолчанию также отражено в `.env` через `ANALYTICS_REFRESH_CRON`.

## Alembic

Для новой базы:

```bash
alembic upgrade head
```

Для уже существующей базы, созданной до подключения Alembic и соответствующей старой базовой схеме:

```bash
alembic stamp 0001_initial
alembic upgrade head
```

Такой сценарий пометит текущую старую схему как базовую и применит только следующие изменения, например таблицу `submissions` и поля вложений в `messages`.

Новые миграции поверх текущей схемы:

- `0003_enrollments` - запись студентов на курсы
- `0004_grades` - оценки и feedback по submissions
- `0005_progress_history` - история прогресса по курсу и урокам
- `0006_quizzes_attempts` - тесты, вопросы, варианты ответов и попытки прохождения
- `0007_analytics_summaries` - summary-таблицы для ускоренной аналитики LMS

## WebSocket events

Подключение:

```text
ws://127.0.0.1:8000/ws/chats/{chat_id}?token=<access_token>
```

События от клиента:

- `message:new` - создать новое сообщение
- `message:delivered` - подтвердить доставку сообщения
- `message:read` - подтвердить прочтение сообщения
- `typing:start` - пользователь начал печатать
- `typing:stop` - пользователь перестал печатать

События от сервера:

- `message:new` - новое сообщение с полным payload
- `message:status` - обновление статуса сообщения до `delivered` или `read`
- `typing:start` - индикатор набора текста
- `typing:stop` - завершение набора текста

## Доступ и роли

- список чатов и содержимое чата доступны только его участникам; администратор может просматривать все чаты
- course-чаты доступны студентам только при активной записи через `Enrollment`, преподавателю курса и администратору
- отправка сообщений и загрузка вложений в чат доступны только участникам этого чата
- `sender_id` и `sender_name` для сообщений больше не берутся от клиента, а определяются по JWT-пользователю
- задания курса доступны студенту только при активной записи через `Enrollment`
- отправка решений и загрузка файлов по заданиям доступны только студентам, записанным на курс
- просмотр всех решений по заданию доступен только преподавателю этого курса и администратору
- студент видит только свои собственные submissions
- список курсов и заданий теперь отдаёт реальные метрики прогресса и оценок, где это уместно
- прогресс по курсу теперь пересчитывается автоматически после завершения урока и успешной сдачи теста
- analytics теперь включает leaderboard, retention 7/30 дней и completion rate по курсу
- analytics теперь читает materialized summaries вместо тяжёлых обходов сырых данных
- создавать и редактировать тесты может только преподаватель курса или администратор

## Следующий этап

- добавить UI-формы для конструктора тестов и редактора вопросов
- при необходимости вынести фоновую задачу с cron на Celery worker
