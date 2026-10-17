# Sprite Interpolator

Сервис для обработки видео: повышение разрешения и увеличение частоты кадров с помощью AI.

## Состояние проекта

Репозиторий сейчас содержит начальные заготовки сервисов:

- **Frontend** — React 19 + Vite; пока отображается стартовая страница Vite.
- **Backend** — FastAPI, PostgreSQL и Redis/Celery; реализованы загрузка видео, API задач и worker-пайплайн.
- **AI Service** — FastAPI; реализован health-check, в зависимостях подготовлена основа для PyTorch и обработки изображений.
- **API и сценарии** — контракты и последовательности описаны в `docs/api.md` и `docs/api_sequence_diagram.md`.

## Структура репозитория

```text
frontend/                    React + Vite
backend/                     FastAPI
ai/                          FastAPI + PyTorch dependencies
docs/api.md                  Контракт внешнего и внутреннего API
docs/api_sequence_diagram.md Диаграммы пользовательских сценариев
```

## Требования

- Git
- Node.js 20.19+ или 22.12+
- Python 3.13
- Poetry
- PostgreSQL и Redis для Backend
- FFprobe (обычно устанавливается вместе с FFmpeg) для проверки видео в Backend; FFmpeg также потребуется компонентам обработки

Docker Compose в репозитории пока нет; PostgreSQL и Redis требуется запустить отдельно.

## Запуск локально

Запускайте каждый сервис в отдельном терминале из корня репозитория.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Vite напечатает локальный адрес frontend. В `frontend/.env.example` указан `VITE_API_URL=http://localhost:8000`.

Для production-сборки доступны команды `npm run build` и `npm run preview`; проверка стиля — `npm run lint`.

### Backend

```bash
cd backend
poetry install
cp .env.example .env
poetry run alembic upgrade head
poetry run python main.py
```

- Celery worker запускается отдельно: `poetry run celery -A app.queue.celery_app worker --loglevel=info` (на Windows для локальной разработки добавьте `--pool=solo`).
- Health-check: `http://localhost:8000/health`
- Swagger UI: `http://localhost:8000/docs`
- Перед запуском настройте PostgreSQL, Redis и FFmpeg/FFprobe в `backend/.env`.
- Для видео и результатов используются локальные каталоги `backend/storage`; не удаляйте их, пока файлы нужны.
- Проверка Backend: `poetry run pytest`.
- Worker и AI Service должны иметь доступ к одной общей файловой системе и видеть `input_uri`/`output_uri` по одинаковым абсолютным путям; на одной машине локальный каталог уже общий.

### AI Service

```bash
cd ai
poetry install
poetry run uvicorn main:app --reload --port 8001
```

- Health-check: `http://localhost:8001/health`
- Swagger UI: `http://localhost:8001/docs`

AI Service пока содержит только health-check; обработчики моделей `/internal/v1/upscale` и `/internal/v1/interpolate` должны быть реализованы в самом AI Service, чтобы задачи успешно завершались.

## Конфигурация и секреты

В репозитории есть шаблоны `backend/.env.example`, `ai/.env.example` и `frontend/.env.example`. Backend загружает `backend/.env`; Vite читает frontend-переменные с префиксом `VITE_`.

Backend поддерживает загрузку проверенных MP4/MOV/WebM-видео, очередь задач с этапами `upscale` и `interpolate`, опрос статуса и скачивание готового результата. Для удаления видео сначала удалите связанные завершённые задачи. Склейка видео не входит в опубликованный MVP API-контракт (`docs/api.md`) и этим Backend пока не предоставляется.

Не коммитьте реальные `.env` и `.env.local`, пароли, токены или ключи. В шаблонах используйте только безопасные локальные значения и заглушки для секретов.

## Документация

- [Контракт API](docs/api.md)
- [Диаграммы последовательностей](docs/api_sequence_diagram.md)
