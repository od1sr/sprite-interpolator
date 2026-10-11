# API и sequence diagram пользовательских сценариев

Диаграммы ниже описывают путь от действия пользователя во Frontend до изменений в Backend, очереди, Worker, AI Service, БД и файловой системе. Состояния и ответы соответствуют разделу 4 документа [api.md](api.md).

## 1. Загрузка видео — 4.3.1

```mermaid
sequenceDiagram
    actor User as Пользователь
    participant Front as Frontend
    participant API as Backend API
    participant FF as FFmpeg
    participant DB as PostgreSQL
    participant FS as Файловое хранилище

    User->>Front: Выбирает видео и нажимает «Загрузить»
    Front->>API: POST /api/v1/videos (multipart/form-data, file)
    API->>FS: Сохраняет файл во временный путь
    API->>FF: Проверяет читаемость и извлекает метаданные
    alt Видео прошло проверку
        FF-->>API: Метаданные видео
        API->>FS: Перемещает/сохраняет файл по постоянному storage_key
        API->>DB: Создаёт Video со storage_key и метаданными
        DB-->>API: Video создан
        API-->>Front: 201 Created + Video
        Front-->>User: Показывает загруженное видео и доступные настройки
    else Ошибка проверки или сохранения
        FF-->>API: Ошибка формата/чтения (если применимо)
        API->>FS: Удаляет временный и неполный файл
        API-->>Front: 413 / 415 / 422 / 500 + error
        Front-->>User: Показывает ошибку загрузки
    end
```

## 2. Просмотр списка видео — 4.3.2

```mermaid
sequenceDiagram
    actor User as Пользователь
    participant Front as Frontend
    participant API as Backend API
    participant DB as PostgreSQL

    User->>Front: Открывает список видео
    Front->>API: GET /api/v1/videos?limit=20&offset=0
    alt limit и offset корректны
        API->>DB: Читает страницу Video и общее количество
        DB-->>API: Список метаданных и total
        API-->>Front: 200 OK + items, total, limit, offset
        Front-->>User: Показывает список
    else Ошибка параметров пагинации
        API-->>Front: 422 VALIDATION_ERROR
        Front-->>User: Показывает ошибку запроса
    end
    Note over API,DB: Файлы не читаются; файловая система не меняется
```

## 3. Просмотр метаданных видео — 4.3.3

```mermaid
sequenceDiagram
    actor User as Пользователь
    participant Front as Frontend
    participant API as Backend API
    participant DB as PostgreSQL

    User->>Front: Открывает карточку видео
    Front->>API: GET /api/v1/videos/{video_id}
    API->>DB: Ищет Video по id
    alt Видео найдено
        DB-->>API: Video
        API-->>Front: 200 OK + Video
        Front-->>User: Показывает метаданные
    else Видео отсутствует или UUID некорректен
        DB-->>API: Нет записи (если UUID корректен)
        API-->>Front: 404 RESOURCE_NOT_FOUND или 422 VALIDATION_ERROR
        Front-->>User: Показывает ошибку
    end
    Note over API,DB: Файл не читается и не изменяется
```

## 4. Удаление видео — 4.3.4

```mermaid
sequenceDiagram
    actor User as Пользователь
    participant Front as Frontend
    participant API as Backend API
    participant DB as PostgreSQL
    participant FS as Файловое хранилище

    User->>Front: Подтверждает удаление видео
    Front->>API: DELETE /api/v1/videos/{video_id}
    API->>DB: Ищет Video и проверяет активные Job
    alt Видео не найдено
        API-->>Front: 404 RESOURCE_NOT_FOUND
    else Видео используется активной Job
        API-->>Front: 409 INVALID_STATE
    else Удаление разрешено
        API->>FS: Удаляет исходный файл по storage_key
        alt Файл удалён
            API->>DB: Удаляет запись Video
            DB-->>API: Запись удалена
            API-->>Front: 204 No Content
        else Ошибка удаления файла
            API-->>Front: 500 INTERNAL_ERROR
        end
    end
    Front-->>User: Показывает результат операции
    Note over API,FS: Удаление связанных Job и Result должно следовать отдельной политике хранения
```

## 5. Создание Job и обработка видео — 4.4.1

```mermaid
sequenceDiagram
    actor User as Пользователь
    participant Front as Frontend
    participant API as Backend API
    participant DB as PostgreSQL
    participant Queue as Redis / Celery
    participant Worker as Celery Worker
    participant FF as FFmpeg
    participant AI as AI Service
    participant FS as Общая файловая система

    User->>Front: Выбирает операции и параметры, запускает обработку
    Front->>API: POST /api/v1/jobs (video_id, steps)
    API->>DB: Проверяет Video и валидирует непустой steps
    alt Video отсутствует или недоступно
        API-->>Front: 404 RESOURCE_NOT_FOUND или 409 INVALID_STATE
    else Запрос невалиден
        API-->>Front: 422 VALIDATION_ERROR
    else Запрос корректен
        API->>DB: Создаёт Job со статусом queued и steps
        API->>Queue: Публикует job_id
        API-->>Front: 202 Accepted + полный Job
        Front-->>User: Показывает созданную задачу

        Queue-->>Worker: Передаёт job_id
        Worker->>DB: Загружает Job, Video и параметры
        Worker->>DB: Устанавливает processing и текущий step
        Worker->>FS: Читает исходный файл Video по storage_key
        opt Для этапа нужны проверка или подготовка видео
            Worker->>FF: Обрабатывает/извлекает данные через FFmpeg
            FF-->>Worker: Результат этапа подготовки
        end
        loop Для каждого PipelineStep по порядку
            Worker->>FS: Формирует input_uri и output_uri в общей FS
            Worker->>AI: POST /internal/v1/upscale или /internal/v1/interpolate
            AI->>FS: Читает input_uri
            AI->>AI: Выполняет операцию с выбранной конфигурацией модели
            AI->>FS: Записывает файл по output_uri
            AI-->>Worker: 200 AIResult с output_uri и метаданными
            Worker->>DB: Помечает step completed и обновляет прогресс
        end
        Worker->>DB: Создаёт Result, связывает result_id с Job
        Worker->>DB: Устанавливает Job.status=completed
        Worker->>FS: Удаляет временные/intermediate файлы, если они не являются итоговым Result
        Note over Worker,FS: Итоговый файл остаётся доступен для скачивания
    end
```

Если обработка завершается ошибкой, Worker сохраняет `Job.error`, помечает текущий этап/задачу как `failed` и удаляет временные файлы, если это безопасно. Клиент получает состояние через `GET /api/v1/jobs/{job_id}` (диаграмма 6).

## 6. Опрос статуса Job — 4.4.2

```mermaid
sequenceDiagram
    actor User as Пользователь
    participant Front as Frontend
    participant API as Backend API
    participant DB as PostgreSQL

    loop Пока Job не в терминальном статусе
        Front->>API: GET /api/v1/jobs/{job_id}
        API->>DB: Читает Job и PipelineStep
        alt Job найдена и UUID корректен
            DB-->>API: Текущее состояние
            API-->>Front: 200 OK + полный Job
            Front-->>User: Показывает status, текущий этап и progress (если доступен)
        else Job не найдена или UUID некорректен
            API-->>Front: 404 RESOURCE_NOT_FOUND или 422 VALIDATION_ERROR
            Front-->>User: Показывает ошибку
        end
    end
    Note over Front,API: Опрос прекращается при completed, failed или cancelled
    Note over API,DB: Запрос только читает БД; файлы не затрагиваются
```

## 7. Отмена Job — 4.4.3

```mermaid
sequenceDiagram
    actor User as Пользователь
    participant Front as Frontend
    participant API as Backend API
    participant DB as PostgreSQL
    participant Queue as Redis / Celery
    participant Worker as Celery Worker
    participant FF as FFmpeg
    participant AI as AI Service
    participant FS as Общая файловая система

    User->>Front: Нажимает «Отменить»
    Front->>API: POST /api/v1/jobs/{job_id}/cancel
    API->>DB: Читает статус Job
    alt Job queued
        API->>Queue: Удаляет/помечает сообщение, чтобы Worker его не начал
        API->>DB: Устанавливает status=cancelled и finished_at
        API-->>Front: 200 OK + полный Job
    else Job processing
        API->>DB: Устанавливает status=cancelling
        API->>Queue: Передаёт Worker сигнал отмены
        API-->>Front: 200 OK + Job со статусом cancelling
        Worker->>AI: Прерывает текущую операцию при поддержке отмены
        Worker->>FF: Останавливает дочерние процессы FFmpeg
        Worker->>FS: Удаляет временные файлы/частичный output
        Worker->>DB: Устанавливает status=cancelled, finished_at
        Front->>API: GET /api/v1/jobs/{job_id}
        API->>DB: Читает обновлённый Job
        DB-->>API: Job со статусом cancelled
        API-->>Front: 200 OK + полный Job
    else Job already cancelling or cancelled
        API-->>Front: 200 OK + текущий полный Job без повторного сигнала
    else Job completed or failed
        API-->>Front: 409 INVALID_STATE
    else Job не найден или UUID некорректен
        API-->>Front: 404 RESOURCE_NOT_FOUND или 422 VALIDATION_ERROR
    end
    Front-->>User: Показывает актуальный статус
```

## 8. Удаление Job — 4.4.4

```mermaid
sequenceDiagram
    actor User as Пользователь
    participant Front as Frontend
    participant API as Backend API
    participant DB as PostgreSQL
    participant Queue as Redis / Celery
    participant FS as Общая файловая система

    User->>Front: Подтверждает удаление Job
    Front->>API: DELETE /api/v1/jobs/{job_id}
    API->>DB: Проверяет Job и её статус
    alt Job не найдена
        API-->>Front: 404 RESOURCE_NOT_FOUND
    else Job активна
        API-->>Front: 409 INVALID_STATE
    else Удаление разрешено
        API->>Queue: Удаляет оставшееся queued-сообщение (если есть)
        API->>FS: Удаляет связанные файлы согласно политике хранения
        API->>DB: Удаляет Job, steps, error и связанные записи согласно политике хранения
        API-->>Front: 204 No Content
    end
    Front-->>User: Показывает результат операции
    Note over API,FS: Удаление исходного Video зависит от того, используется ли он другими Job
```

## 9. Повторная постановка Job — 4.4.5

```mermaid
sequenceDiagram
    actor User as Пользователь
    participant Front as Frontend
    participant API as Backend API
    participant DB as PostgreSQL
    participant Queue as Redis / Celery
    participant FS as Файловое хранилище

    User->>Front: Нажимает «Повторить» для failed Job
    Front->>API: POST /api/v1/jobs/{job_id}/retry
    API->>DB: Загружает исходный Job, JobError и Video
    API->>FS: Проверяет доступность исходного файла Video
    alt Job или Video отсутствуют
        API-->>Front: 404 RESOURCE_NOT_FOUND
    else Job не failed или JobError.retryable=false
        API-->>Front: 409 INVALID_STATE
    else Повтор разрешён
        API->>DB: Создаёт новую Job с новым id и исходными video_id/steps
        API->>Queue: Публикует новый job_id
        API-->>Front: 202 Accepted + полный новый Job
    end
    Front-->>User: Показывает новую задачу либо ошибку
    Note over API,FS: Обработку и итоговый файл создаёт Worker как в диаграмме 5
```

## 10. Получение метаданных результата — 4.4.6

```mermaid
sequenceDiagram
    actor User as Пользователь
    participant Front as Frontend
    participant API as Backend API
    participant DB as PostgreSQL

    User->>Front: Открывает готовый результат
    Front->>API: GET /api/v1/jobs/{job_id}/result
    API->>DB: Проверяет Job.status и загружает Result
    alt Job completed и Result существует
        DB-->>API: Result metadata
        API-->>Front: 200 OK + Result и download_url
        Front-->>User: Показывает сведения и кнопку скачивания
    else Job не завершена
        API-->>Front: 409 INVALID_STATE
    else Job или Result отсутствуют
        API-->>Front: 404 RESOURCE_NOT_FOUND
    else Result больше недоступен
        API-->>Front: 410 RESOURCE_GONE
    end
    Note over API,DB: Файл не читается; файловая система не меняется
```

## 11. Скачивание результата — 4.4.7

```mermaid
sequenceDiagram
    actor User as Пользователь
    participant Front as Frontend
    participant API as Backend API
    participant DB as PostgreSQL
    participant FS as Файловое хранилище

    User->>Front: Нажимает «Скачать»
    Front->>API: GET /api/v1/jobs/{job_id}/result/download
    API->>DB: Проверяет Job и загружает Result
    alt Result доступен
        DB-->>API: storage_key, filename, content_type, size_bytes
        API->>FS: Открывает итоговый файл для потокового чтения
        alt Файл прочитан
            FS-->>API: Поток байтов
            API-->>Front: 200 OK + video stream и Content-Disposition
            Front-->>User: Сохраняет файл
        else Файл отсутствует или чтение завершилось ошибкой
            API-->>Front: 410 RESOURCE_GONE или 500 INTERNAL_ERROR
        end
    else Job не найдена / UUID невалиден / результат ещё не готов
        API-->>Front: 404 / 422 / 409 с JSON error
    end
    Note over API,FS: Путь хранения не раскрывается клиенту; Backend передаёт файл потоком
```

[Главная страница](api.md)

