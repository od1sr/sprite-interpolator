# API

## Frontend -> Backend

### POST /process

Загрузка sprite sheet на обработку.

Request:

multipart/form-data

Fields:
- file (png)
- factor (int, optional)

Response:

```json
{
  "task_id": "uuid"
}
```

---

### GET /status/{task_id}

Получение статуса обработки.

Response:

```json
{
  "status": "queued"
}
```

Возможные статусы:
- queued
- processing
- done
- error

---

### GET /result/{task_id}

Возвращает итоговый PNG либо архив кадров.

---

## Backend -> AI

### POST /interpolate

Отправка исходного sprite sheet в AI сервис.

Request:
- PNG файл
- настройки интерполяции

Response:
- PNG файл
или
- ZIP архив кадров

---

## Health Checks

### Backend

GET /health

```json
{
  "status": "ok"
}
```

### AI

GET /health

```json
{
  "status": "ok"
}
```
