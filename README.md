# Sprite Interpolator

Сервис для обработки видео: повышение разрешения (upscale) и увеличение частоты кадров (interpolate) с помощью AI.

## Состояние проекта

- **Frontend** — React 19 + Vite. Загрузка видео, запрос на апскейл, скачивание результата (последнее надо пофиксить).
- **Backend** — FastAPI + PostgreSQL + Redis/Celery. Реализованы загрузка видео, очередь задач, опрос статуса и скачивание результата.
- **AI Service** — FastAPI + PyTorch. Есть апскейл, интерполяция.

## Запуск проекта

### Linux

```bash
cd sprite-interpolator
./compose.sh
```

### Windows

Нужны Windows 10/11, [Docker Desktop](https://www.docker.com/products/docker-desktop/) с включённым WSL 2 и Git. После установки запусти Docker Desktop и дождись статуса **Engine running**. Команды ниже выполняются в PowerShell.

```powershell
cd sprite-interpolator
.\compose.cmd
```

Стартовый скрипт создаёт корневой `.env` из `.env.example`, только если `.env` ещё нет, затем запускает `docker compose up --build`. Если `.env` уже существует, локальные настройки сохраняются. Compose запускает frontend, backend API, AI Service, Celery worker, PostgreSQL, Redis и миграцию базы. Первый запуск скачивает базовые образы и Python/Node-зависимости, поэтому может занять несколько минут. Оставь окно PowerShell открытым, пока работаешь с приложением.

Порты настраиваются в `.env` рядом с `compose.yaml`. Значения по умолчанию: frontend `5173`, backend `8000`, AI `8001`, PostgreSQL `5432`, Redis `6379`. Если порт занят, поменяй соответствующее значение в `.env`; при смене `BACKEND_PORT` также укажи тот же порт в `VITE_API_URL`, например `http://localhost:8010/api/v1`.

Скрипт передаёт аргументы Docker Compose дальше, поэтому его можно использовать для остальных команд: `.\compose.cmd up --build -d`, `.\compose.cmd ps`, `.\compose.cmd logs -f`, `.\compose.cmd down`. Для полного сброса данных, включая базу и загруженные файлы: `.\compose.cmd down -v`.

### Запуск и пересборка отдельных сервисов

Все команды выполняй в отдельном окне PowerShell из корня проекта. Если сервис ещё не запускался, Compose автоматически поднимет его зависимости. Например, для backend это миграция базы, PostgreSQL, Redis и AI Service.

```powershell
.\compose.cmd up --build -d frontend   # пересобрать и запустить только frontend
.\compose.cmd up --build -d backend    # backend и необходимые зависимости
.\compose.cmd up --build -d ai         # пересобрать и перезапустить AI Service
.\compose.cmd up --build -d worker     # worker и необходимые зависимости
.\compose.cmd up -d postgres redis    # только PostgreSQL и Redis
```

После изменения кода пересобирай и запускай нужный сервис той же командой с `--build`. Для просмотра логов конкретного сервиса используй `.\compose.cmd logs -f frontend`; для перезапуска без пересборки — `.\compose.cmd restart frontend`; для остановки — `.\compose.cmd stop frontend`. Имена сервисов: `frontend`, `backend`, `ai`, `worker`, `postgres`, `redis`, `migrate`. `migrate` — одноразовый сервис миграции базы, он выполняется автоматически как зависимость backend и worker.

AI-контейнер запускается без весов моделей. Для операций обработки положи веса в `ai/weights/realesrgan/realesr-animevideov3.pth` и `ai/weights/rife/flownet.safetensors`; папка подключается в контейнер только для чтения. На компьютере без настроенного GPU стек запускается без NVIDIA GPU (обработка будет выполняться на CPU, если поддерживается приложением). NVIDIA GPU требует отдельной настройки Docker Desktop и драйвера, а также запуска с дополнительным Compose-файлом:

```powershell
.\compose.cmd -f compose.yaml -f compose.gpu.yaml up --build
```

Не добавляй GPU-файл в обычный запуск на компьютере без NVIDIA GPU.

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
- FFprobe (обычно идёт с FFmpeg) — нужен Backend для проверки видео

## Структура репозитория

```text
frontend/                    React + Vite
backend/                     FastAPI + PostgreSQL + Redis/Celery
ai/                          FastAPI + PyTorch
docs/api.md                  Контракт внешнего и внутреннего API
docs/api_sequence_diagram.md Диаграммы пользовательских сценариев
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
