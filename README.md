# Интеллектуальный сервис по обработке видео

Веб-сервис для автоматического улучшения видеоматериалов при помощи ИИ с использованием технологии апскейлинга

## Структура проекта

```text
frontend/   React + Vite
backend/    FastAPI + Poetry
ai/         PyTorch service + Poetry
docs/       Документация и API
```

## Требования

- Git
- Node.js 22+
- Python 3.13+
- Poetry
- Docker (желательно)

## Настройка окружения

Каждый сервис использует собственный `.env` файл, в котором будут храниться все **secrets**:

- API ключи
- токены
- пароли
- адреса продовых БД

> [!WARNING]
> Не добавляйте файлы `.env` и `.env.local` в `git commit` и тем более `git push`. Храните нужные для работы кода **secrets**-поля только в `.env.example` с тестовыми значениями (порты и localhost можно и нужно вставлять в .env.example без изменений).

Пример:

```bash
# .env

DATABASE_URL="pgsql+aiopsycopg://petya:password@example.com:666"
API_TOKEN="bearer FJOIJijvOIjoifJIFJ98934u5"
API_SECRET="7*Y&Y77hv78hwfh327hf"
API_URL="api.bablo.com"

APP_HOST="0.0.0.0"
APP_PORT=8000

BACKEND_HOST="localhost" # то же самое что 127.0.0.1
BACKEND_PORT=8001
BACKEND_ACCESS_TOKEN="bearer ZalupaMedvedya228666"
```

Для воспроизводства приложения в новом месте этот файл должен попасть в репозиторий примерно в таком виде:

```bash
# .env.example

DATABASE_URL="pgsql+aiopsycopg://USER:PASSWORD@URL:PORT" # сохраняем схему,  убираем логин, URL на котором работает БД
# Все ключи, токены вообще убираем
API_TOKEN= 
API_SECRET=
API_URL="api.bablo.com" # если URL доступен публично, то можно и оставить

# дефолтные значения, спокойно оставляем
APP_HOST="0.0.0.0"
APP_PORT=8000 # порт можно вообще не прятать

# тоже дефолтные
BACKEND_HOST="localhost"
BACKEND_PORT=8001
BACKEND_ACCESS_TOKEN=
```

Ну и если оригинальные значения из `.env` понадобятся для развертывания приложения, то нужно скинуть загрузить на сервер напрямую (либо скинуть тому, кто этим занимается - тобишь мне в группу в тг).

Создайте файлы из шаблонов:

```bash
cp backend/.env.example backend/.env
cp ai/.env.example ai/.env
cp frontend/.env.example frontend/.env.local
```

## Запуск Frontend

```bash
cd frontend
npm install
npm run dev
```

> В консоли появится ссылка на локальный сайт - переходим и смотрим.

> [!TIP]
> Для доступа переменных окружения (из `.env.local`) в vite.js достаточно просто написать в любом месте кода:
>
> ```js
> import.meta.env.API_TOKEN;
> ```

## Запуск Backend

```bash
cd backend
poetry install
poetry run uvicorn main:app --reload --port 8000
```

> Проверяем по ссылке http://localhost:8000/docs

## Запуск AI Service

```bash
cd ai
poetry install
poetry run uvicorn main:app --reload --port 8001
```

## Git Workflow

Получить изменения:

```bash
git pull origin main
```

Создать ветку:

```bash
git checkout -b feature/my-task
```

Зафиксировать изменения:

```bash
git add .
git commit -m "feat: add upload page"
```

Отправить изменения:

```bash
git push origin feature/my-task
```

После завершения работы создавайте Pull Request.

## Полезные правила

- Перед началом работы делайте `git pull`.
- Не пушьте большие датасеты и модели.
- Все изменения API документировать в `docs/api.md`.
- Работайте каждый в своей ветке: frontent, backend, AI. Если вашей ветви нет в репе - создайте.

---

см. [Документацию](docs/api.md)
