# Sprite Interpolator

Сервис для обработки видео: повышение разрешения и увеличение частоты кадров с помощью AI.

## Состояние проекта

Репозиторий сейчас содержит начальные заготовки сервисов:

- **Frontend** — React 19 + Vite; пока отображается стартовая страница Vite.
- **Backend** — FastAPI; реализован health-check.
- **AI Service** — FastAPI; реализован health-check, в зависимостях подготовлена основа для PyTorch и обработки изображений.
- **API и сценарии** — целевые контракты и последовательности описаны в `docs/api.md` и `docs/api_sequence_diagram.md`. Описанные там пользовательские маршруты обработки видео ещё не реализованы в приложениях.

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

FFmpeg понадобится для реализации описанных сценариев обработки видео. Docker Compose в репозитории пока нет.

## Запуск локально

Запускайте каждый сервис в отдельном терминале из корня репозитория.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Vite напечатает локальный адрес frontend. В `frontend/.env.example` указан `VITE_API_URL=http://localhost:8000`; текущая стартовая страница эту переменную пока не использует.

Для production-сборки доступны команды `npm run build` и `npm run preview`; проверка стиля — `npm run lint`.

### Backend

```bash
cd backend
poetry install
poetry run uvicorn main:app --reload --port 8000
```

- Health-check: `http://localhost:8000/health`
- Swagger UI: `http://localhost:8000/docs`

### AI Service

```bash
cd ai
poetry install
poetry run uvicorn main:app --reload --port 8001
```

- Health-check: `http://localhost:8001/health`
- Swagger UI: `http://localhost:8001/docs`

В обоих FastAPI-приложениях сейчас реализован только `/health`. Остальные маршруты из `docs/api.md` являются проектным API-контрактом.

## Конфигурация и секреты

В репозитории есть шаблоны `backend/.env.example`, `ai/.env.example` и `frontend/.env.example`. Они фиксируют предполагаемые настройки; Backend и AI Service пока не загружают эти переменные в коде. Vite читает frontend-переменные с префиксом `VITE_`.

Не коммитьте реальные `.env` и `.env.local`, пароли, токены или ключи. В шаблонах используйте только безопасные локальные значения и заглушки для секретов.

## Документация

- [Контракт API](docs/api.md)
- [Диаграммы последовательностей](docs/api_sequence_diagram.md)
