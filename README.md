# Sprite Interpolator

Конвертер sprite sheets в плавную анимацию.

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
- Python 3.12+
- Poetry
- Docker (желательно)

## Настройка окружения

Каждый сервис использует собственный `.env` файл.

Никогда не храните:
- API ключи
- токены
- пароли
- адреса продовых БД

в коде или в git.

Создайте файлы из шаблонов:

```bash
cp backend/.env.example backend/.env
cp ai/.env.example ai/.env
cp frontend/.env.example frontend/.env
```

## Запуск Frontend

```bash
cd frontend
npm install
npm run dev
```

## Запуск Backend

```bash
cd backend
poetry install
poetry run uvicorn main:app --reload --port 8000
```

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
- Не пушьте `.env`.
- Не пушьте большие датасеты и модели.
- Все изменения API документировать в `docs/api.md`.
