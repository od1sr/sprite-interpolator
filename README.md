# Sprite Interpolator

Сервис для обработки видео: повышение разрешения (upscale) и увеличение частоты кадров (interpolate) с помощью AI.

> **Для новичков:** если ты просто хочешь запустить проект, следуй разделу «Быстрый старт» — он всё сделает сам.

## Состояние проекта

Это ранняя версия. Из трёх сервисов сейчас полностью работает Backend, а Frontend пока отображает стартовую заглушку Vite.

- **Frontend** — React 19 + Vite. Пока это заглушка, а не готовый интерфейс.
- **Backend** — FastAPI + PostgreSQL + Redis/Celery. Реализованы загрузка видео, очередь задач, опрос статуса и скачивание результата.
- **AI Service** — FastAPI + PyTorch. Сейчас есть только health-check; сами обработчики моделей ещё не реализованы.

> То есть загрузить видео и создать задачу уже можно, а сама AI-обработка пока не доведена до конца.

## Быстрый старт (рекомендуется)

Всё развертывание делает один скрипт — `deploy.py`. Он:

1. проверяет/ставит PostgreSQL и Redis (через [scoop](https://scoop.sh)),
2. создаёт базу и пользователя,
3. ставит зависимости Backend, AI и Frontend,
4. применяет миграции базы,
5. запускает все сервисы и открывает сайт в браузере,
6. пишет логи в `deploy/logs/`.

**Запуск (из корня репозитория):**

```powershell
python deploy.py
```

Сайт откроется автоматически на http://localhost:5173.

Полезные флаги:

```powershell
python deploy.py --only infra      # только PostgreSQL + Redis
python deploy.py --only backend    # backend + воркер + миграции
python deploy.py --only frontend   # только фронтенд
python deploy.py --skip-install    # не ставить зависимости (poetry/npm)
python deploy.py --no-worker       # не запускать Celery-воркер
```

Проверить, что всё поднялось:

```powershell
Test-NetConnection localhost -Port 5432,6379,8000,8001,5173 -InformationLevel Quiet
```

## Ручной запуск (по сервисам)

Если хочешь запускать сервисы по отдельности — каждую команду выполняй в своём терминале из корня репозитория.

### Требования

- Git
- Node.js 20.19+ или 22.12+
- Python 3.13
- Poetry
- [scoop](https://scoop.sh) (ставит PostgreSQL и Redis без прав администратора)
- FFprobe (обычно идёт с FFmpeg) — нужен Backend для проверки видео

### PostgreSQL и Redis

```powershell
# один раз, если ещё не установлены
scoop install postgresql redis

# запуск PostgreSQL (каталог данных — persist scoop)
& "C:\Users\Ivan\scoop\apps\postgresql\current\bin\pg_ctl.exe" start -D "C:\Users\Ivan\scoop\persist\postgresql\data" -l "postgres.log" -w

# запуск Redis
& "C:\Users\Ivan\scoop\apps\redis\current\redis-server.exe" --port 6379
```

База и пользователь (`sprite` / `sprite`, база `sprite_interpolator`) создаются скриптом `deploy.py` автоматически.

### Backend

```powershell
cd backend
poetry install
cp .env.example .env
poetry run alembic upgrade head
poetry run python main.py
```

- Health-check: http://localhost:8000/health
- Swagger UI (вся документация и ручное тестирование API): http://localhost:8000/docs

### Celery worker

Воркер обрабатывает задачи из очереди. Запускается отдельно:

```powershell
cd backend
poetry run celery -A app.queue.celery_app worker --loglevel=info --pool=solo
```

Флаг `--pool=solo` нужен на Windows для локальной разработки.

### AI Service

```powershell
cd ai
poetry install
cp .env.example .env
poetry run uvicorn main:app --reload --port 8001
```

- Health-check: http://localhost:8001/health
- Swagger UI: http://localhost:8001/docs

### Frontend

```powershell
cd frontend
npm install
npm run dev
```

Адрес frontend печатает Vite при старте (обычно http://localhost:5173/). В `frontend/.env.example` указан `VITE_API_URL=http://localhost:8000`.

Для production-сборки: `npm run build` и `npm run preview`. Проверка стиля: `npm run lint`.

## Структура репозитория

```text
frontend/                    React + Vite
backend/                     FastAPI + PostgreSQL + Redis/Celery
ai/                          FastAPI + PyTorch
docs/api.md                  Контракт внешнего и внутреннего API
docs/api_sequence_diagram.md Диаграммы пользовательских сценариев
deploy.py                    Скрипт полного развертывания и запуска
```

## Конфигурация и секреты

В репозитории есть шаблоны `backend/.env.example`, `ai/.env.example` и `frontend/.env.example`. Backend загружает `backend/.env`; Vite читает frontend-переменные с префиксом `VITE_`.

Не коммитьте реальные `.env` и `.env.local`, пароли, токены или ключи. В шаблонах используйте только безопасные локальные значения и заглушки для секретов.

## Как всё работает вместе

1. Пользователь загружает видео через `POST /api/v1/videos`.
2. Создаётся задача `POST /api/v1/jobs` — она попадает в очередь Celery (Redis).
3. Celery-воркер берёт задачу и вызывает AI Service для этапов `upscale` и `interpolate`.
4. Статус задачи можно смотреть через `GET /api/v1/jobs/{job_id}`.
5. Готовый результат скачивается через `GET /api/v1/jobs/{job_id}/result/download`.

Важные ограничения:

- Для видео и результатов используется локальный каталог `backend/storage` — не удаляй его, пока файлы нужны.
- Для удаления видео сначала удали связанные завершённые задачи.
- Склейка видео не входит в опубликованный MVP API-контракт (`docs/api.md`) и Backend её не предоставляет.
- Worker и AI Service должны видеть `input_uri`/`output_uri` по одинаковым абсолютным путям; на одной машине локальный каталог уже общий.

## Тестирование

```powershell
cd backend
poetry run pytest
```

## Документация

- [Контракт API](docs/api.md)
- [Диаграммы последовательностей](docs/api_sequence_diagram.md)
