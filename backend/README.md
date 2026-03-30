# FastAPI Backend

## Запуск

```bash
cd backend
mysql -u root -p < init_db.sql
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload
```

После запуска API будет доступно по адресу:

- `http://127.0.0.1:8000/api/health`
- `http://127.0.0.1:8000/docs`

## Что уже есть

- подключение к MySQL через `SQLAlchemy`
- автоматическое создание таблиц при старте приложения
- первичное заполнение demo-данными через `seed_database`
- `POST /api/auth/login` - demo-авторизация
- `GET /api/users` - список пользователей
- `GET /api/users/me` - текущий пользователь
- `GET /api/courses` - список курсов с фильтрами
- `GET /api/courses/{course_id}` - курс с модулями и уроками
- `GET /api/assignments` - список заданий
- `POST /api/assignments/{assignment_id}/submit` - отправка решения
- `GET /api/notifications` - уведомления пользователя
- `GET /api/chats` - список чатов
- `GET /api/chats/{chat_id}` - чат с историей сообщений
- `POST /api/chats/{chat_id}/messages` - отправка сообщения
- `WS /ws/chats/{chat_id}` - realtime-канал мессенджера

## Demo-аккаунты

- `student@eduflow.local / student123`
- `teacher@eduflow.local / teacher123`
- `admin@eduflow.local / admin123`

## Следующий этап

- вынести настройки в `.env`
- добавить JWT-аутентификацию
- реализовать хранение файлов и изображений
- добавить read/delivered-статусы через WebSocket-события
