# MVP-план: Personal Scheduling Assistant на Next.js

## 1. Цель MVP

Создать первую рабочую версию персонального ассистента-планировщика, который позволяет пользователю:

- создавать задачи текстом;
- задавать дату, время и продолжительность;
- задавать приоритет и возможность переноса;
- создавать повторяющиеся задачи;
- получать напоминания;
- отмечать выполнение задачи;
- откладывать напоминание;
- видеть задачи на сегодня и ближайшие дни;
- получать предупреждение о пересечениях по времени.

В первой версии основной интерфейс — web-приложение на Next.js.

---

## 2. Что входит в MVP

### 2.1. Пользователь

Минимальный профиль:

- `id`
- `email`
- `name`
- `timezone`
- `createdAt`
- `updatedAt`

На первом этапе достаточно авторизации через email / magic link или OAuth.

Рекомендуемый вариант:
- Auth.js / NextAuth
- Google login или email login

---

## 2.2. Создание задачи

Пользователь должен иметь возможность создать задачу через форму.

Обязательные поля:

- Название
- Дата
- Время начала

Дополнительные:

- Описание
- Продолжительность
- Приоритет
- Гибкость
- Категория
- Повторяемость
- Настройка напоминания

Пример:

```text
Название: Тренировка
Дата: 10.09.2026
Время: 19:00
Продолжительность: 60 минут
Приоритет: HIGH
Гибкость: FLEXIBLE
```

---

## 2.3. Приоритет

```ts
enum Priority {
  LOW = "LOW",
  NORMAL = "NORMAL",
  HIGH = "HIGH",
  CRITICAL = "CRITICAL",
}
```

---

## 2.4. Гибкость задачи

Приоритет и возможность переноса должны быть разными параметрами.

```ts
enum Flexibility {
  FIXED = "FIXED",
  FLEXIBLE = "FLEXIBLE",
}
```

Примеры:

```text
Врач
HIGH + FIXED
```

```text
Тренировка
HIGH + FLEXIBLE
```

```text
Купить продукты
NORMAL + FLEXIBLE
```

---

## 2.5. Продолжительность

Для задач, занимающих время:

```text
startAt
durationMinutes
endAt
```

`endAt` можно вычислять на backend.

Некоторые задачи могут быть мгновенными:

```text
Выпить таблетку
09:00
duration = 0
```

---

## 2.6. Проверка пересечений

При сохранении задачи система должна искать существующие задачи пользователя, которые пересекаются по времени.

Два интервала пересекаются, если:

```text
newStart < existingEnd
AND
existingStart < newEnd
```

Пример:

```text
Тренировка
19:00–20:00

Врач
19:30–20:30
```

Результат:

```text
⚠️ Обнаружен конфликт

Тренировка пересекается с:
Врач 19:30–20:30
```

Пользователь может:

- отменить создание;
- сохранить несмотря на конфликт;
- выбрать другое время.

Для первой версии автоматический перенос не нужен.

---

## 2.7. Повторяющиеся задачи

В MVP поддержать:

- ежедневно;
- каждую неделю;
- выбранные дни недели;
- ежемесячно.

Примеры:

```text
Каждый день в 09:00
```

```text
Понедельник / Среда / Пятница в 19:00
```

Не создавать occurrences на годы вперед.

Рекомендуемый подход:

- хранить правило повторения в `Task`;
- создавать `TaskOccurrence` на ближайшие 30 дней;
- background job расширяет окно.

---

## 2.8. Task и TaskOccurrence

### Task

Описывает задачу как правило.

```text
Task
```

Основные поля:

```ts
id
userId

title
description

priority
flexibility
category

durationMinutes

recurrenceRule

active

createdAt
updatedAt
```

### TaskOccurrence

Описывает конкретный экземпляр задачи.

Например:

```text
Gym — Mon/Wed/Fri
```

одна `Task`, но много:

```text
TaskOccurrence
```

Пример:

```text
10 Sep 19:00
12 Sep 19:00
14 Sep 19:00
```

Поля:

```ts
id
taskId
userId

scheduledStart
scheduledEnd

status

completedAt
snoozeCount

createdAt
updatedAt
```

---

## 2.9. Статусы выполнения

```ts
enum TaskStatus {
  SCHEDULED = "SCHEDULED",
  DONE = "DONE",
  PARTIALLY_DONE = "PARTIALLY_DONE",
  SKIPPED = "SKIPPED",
  SNOOZED = "SNOOZED",
  CANCELLED = "CANCELLED",
}
```

---

## 2.10. Напоминания

Для MVP:

- напоминание в момент начала задачи;
- опционально — за N минут до начала.

Создать отдельную сущность:

```text
Notification
```

Поля:

```ts
id
occurrenceId

sendAt
status
attemptCount
sentAt

createdAt
updatedAt
```

Статусы:

```ts
PENDING
PROCESSING
SENT
FAILED
CANCELLED
```

---

## 2.11. Snooze

После напоминания пользователь может перенести его:

- +15 минут
- +30 минут
- +1 час
- завтра

При snooze:

- увеличивается `snoozeCount`;
- создаётся новое время напоминания;
- occurrence остаётся связанным с той же задачей.

---

## 2.12. Главный экран

Страница:

```text
/dashboard
```

Показывает:

### Сегодня

```text
09:00  Витамины
13:00  Позвонить
19:00  Тренировка
```

### Статусы

Кнопки:

```text
Done
Partial
Snooze
Skip
```

### Quick Add

```text
+ Добавить задачу
```

---

## 2.13. Календарь

Для MVP достаточно:

- список по дням;
- дневной вид;
- недельный вид — optional.

Не нужно сразу строить полноценный Google Calendar clone.

---

## 3. Что НЕ входит в MVP

Не делать в первой версии:

- Telegram-бот;
- Viber;
- native iOS;
- native Android;
- Google Calendar integration;
- Outlook integration;
- Apple Calendar integration;
- voice input;
- AI/NLP;
- автоматическое перепланирование;
- ML-рекомендации;
- командные задачи;
- социальные функции;
- сложную аналитику;
- Kafka;
- microservices.

Главная цель первой версии — проверить основной workflow.

---

# 4. Основной пользовательский сценарий

## Scenario 1 — обычная задача

Пользователь нажимает:

```text
Add task
```

Создаёт:

```text
Тренировка
10 Sep
19:00
60 min
HIGH
FLEXIBLE
```

Backend:

1. валидирует данные;
2. вычисляет `endAt`;
3. проверяет конфликты;
4. создаёт `Task`;
5. создаёт `TaskOccurrence`;
6. создаёт `Notification`.

---

# 5. Scenario 2 — конфликт

Есть:

```text
Стоматолог
19:30–20:30
HIGH
FIXED
```

Пользователь создаёт:

```text
Тренировка
19:00–20:00
HIGH
FLEXIBLE
```

UI показывает:

```text
⚠️ Конфликт

Тренировка 19:00–20:00
пересекается с
Стоматолог 19:30–20:30
```

Кнопки:

```text
Изменить время
Создать всё равно
Отмена
```

---

# 6. Scenario 3 — recurring task

Пользователь создаёт:

```text
Тренировка
Пн / Ср / Пт
19:00
60 минут
```

Backend:

```text
Task
↓
OccurrenceGenerator
↓
Occurrences на следующие 30 дней
```

---

# 7. Scenario 4 — выполнение

Когда наступает время:

```text
🏃 Тренировка
19:00–20:00
```

UI предлагает:

```text
✅ Done
🟡 Partial
⏰ Snooze
❌ Skip
```

После действия обновляется `TaskOccurrence`.

---

# 8. Технологический стек

## Frontend + Backend

```text
Next.js
TypeScript
App Router
React Server Components
Server Actions / Route Handlers
```

---

## UI

Рекомендация:

```text
Tailwind CSS
shadcn/ui
```

Дополнительно:

```text
Lucide Icons
```

---

## Database

```text
PostgreSQL
```

ORM:

```text
Prisma
```

или:

```text
Drizzle ORM
```

Для быстрого MVP я бы выбрал Prisma.

---

## Authentication

```text
Auth.js
```

---

## Background jobs

Для локального MVP можно начать с:

```text
cron endpoint
```

Но для более надёжного варианта:

```text
Inngest
```

или:

```text
Trigger.dev
```

Задачи:

- генерация recurring occurrences;
- отправка notifications;
- retry failed notifications.

---

## Deployment

Удобный вариант:

```text
Vercel
+
PostgreSQL
```

БД:

- Neon
- Supabase
- Railway
- Vercel Postgres

---

# 9. Предлагаемая структура Next.js проекта

```text
src/
│
├── app/
│   ├── (auth)/
│   │   └── login/
│   │
│   ├── dashboard/
│   │
│   ├── tasks/
│   │   ├── new/
│   │   └── [id]/
│   │
│   ├── calendar/
│   │
│   ├── settings/
│   │
│   └── api/
│
├── components/
│   ├── tasks/
│   ├── calendar/
│   ├── notifications/
│   └── ui/
│
├── features/
│   ├── tasks/
│   ├── scheduling/
│   ├── notifications/
│   └── recurrence/
│
├── lib/
│   ├── db/
│   ├── auth/
│   ├── date/
│   └── validation/
│
└── types/
```

---

# 10. Prisma model — первый вариант

```prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?
  timezone  String

  tasks     Task[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Task {
  id              String       @id @default(cuid())
  userId          String

  title           String
  description     String?

  priority        Priority     @default(NORMAL)
  flexibility     Flexibility  @default(FLEXIBLE)

  durationMinutes Int          @default(0)

  recurrenceRule  String?
  active          Boolean      @default(true)

  user            User         @relation(fields: [userId], references: [id])
  occurrences     TaskOccurrence[]

  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt
}

model TaskOccurrence {
  id             String           @id @default(cuid())

  taskId         String
  userId         String

  scheduledStart DateTime
  scheduledEnd   DateTime?

  status         OccurrenceStatus @default(SCHEDULED)

  snoozeCount    Int              @default(0)
  completedAt    DateTime?

  task           Task             @relation(fields: [taskId], references: [id])

  notifications  Notification[]

  createdAt      DateTime         @default(now())
  updatedAt      DateTime         @updatedAt

  @@index([userId, scheduledStart])
}

model Notification {
  id            String             @id @default(cuid())

  occurrenceId  String

  sendAt        DateTime
  status        NotificationStatus @default(PENDING)

  attemptCount  Int                @default(0)
  sentAt        DateTime?

  occurrence    TaskOccurrence     @relation(fields: [occurrenceId], references: [id])

  createdAt     DateTime           @default(now())
  updatedAt     DateTime           @updatedAt

  @@index([status, sendAt])
}

enum Priority {
  LOW
  NORMAL
  HIGH
  CRITICAL
}

enum Flexibility {
  FIXED
  FLEXIBLE
}

enum OccurrenceStatus {
  SCHEDULED
  DONE
  PARTIALLY_DONE
  SKIPPED
  SNOOZED
  CANCELLED
}

enum NotificationStatus {
  PENDING
  PROCESSING
  SENT
  FAILED
  CANCELLED
}
```

---

# 11. Backend / domain services

Не размещать всю business logic в React components или route handlers.

Минимально выделить:

```text
TaskService
```

Отвечает за:

- создание;
- изменение;
- удаление;
- завершение.

---

```text
ConflictService
```

Отвечает за:

- поиск временных пересечений.

---

```text
OccurrenceService
```

Отвечает за:

- создание occurrences;
- recurring generation.

---

```text
NotificationService
```

Отвечает за:

- создание reminders;
- snooze;
- отправку уведомлений.

---

# 12. ConflictService

API:

```ts
type ConflictRequest = {
  userId: string
  start: Date
  end: Date
}
```

Возвращает:

```ts
type ScheduleConflict = {
  occurrenceId: string
  title: string
  start: Date
  end: Date
  priority: Priority
  flexibility: Flexibility
}
```

---

# 13. API / Server Actions

Для MVP можно использовать Server Actions.

Основные операции:

```text
createTask()
updateTask()
deleteTask()

completeOccurrence()
partiallyCompleteOccurrence()
skipOccurrence()

snoozeOccurrence()

findConflicts()

getTodayTasks()
getUpcomingTasks()
```

---

# 14. Валидация

Использовать:

```text
Zod
```

Например:

```ts
const createTaskSchema = z.object({
  title: z.string().min(1).max(200),
  startAt: z.date(),
  durationMinutes: z.number().min(0).max(1440),
  priority: z.nativeEnum(Priority),
  flexibility: z.nativeEnum(Flexibility),
})
```

---

# 15. Работа со временем

Это критичная часть приложения.

Правила:

1. У пользователя всегда есть timezone.
2. В БД хранить время в UTC.
3. В UI показывать время в timezone пользователя.
4. Recurrence рассчитывать в timezone пользователя.
5. Не рассчитывать recurring события простым `+24 hours`.

Рекомендуемая библиотека:

```text
date-fns
```

или:

```text
Luxon
```

Для timezone-heavy логики Luxon может быть удобнее.

---

# 16. UI страницы MVP

## `/dashboard`

- Сегодняшние задачи
- Просроченные задачи
- Quick Add
- Upcoming

---

## `/tasks/new`

Форма:

```text
Title
Description
Date
Time
Duration
Priority
Flexibility
Repeat
Reminder
```

---

## `/tasks/[id]`

- информация о задаче;
- upcoming occurrences;
- edit;
- deactivate;
- delete.

---

## `/calendar`

Минимальный календарный список:

```text
Today
Tomorrow
This week
```

---

## `/settings`

- timezone;
- notification defaults;
- start/end of day.

---

# 17. Минимальная аналитика

В первой версии достаточно:

```text
Tasks today
Completed today
Skipped today
Completion rate — last 7 days
```

Например:

```text
Последние 7 дней

Всего: 34
Done: 25
Partial: 3
Skipped: 6

Completion rate: 74%
```

Не делать сложные AI-рекомендации.

---

# 18. Что добавить сразу после MVP

Порядок развития:

## V1.1 — Natural language

Поле:

```text
"Что нужно сделать?"
```

Пользователь пишет:

```text
Завтра в 19 тренировка на час
```

LLM преобразует это в `TaskDraft`.

---

## V1.2 — Voice

```text
Voice
↓
Speech-to-text
↓
TaskDraft
↓
тот же create flow
```

---

## V1.3 — Telegram bot

Telegram становится дополнительным UI.

Один backend и одна база.

---

## V1.4 — Google Calendar

Сначала только чтение busy intervals.

---

## V1.5 — Smart scheduling

Пользователь:

```text
Найди завтра вечером час для тренировки
```

Система ищет свободные окна.

---

## V1.6 — Behavioral analytics

Например:

```text
Ты выполняешь 86% задач утром,
но только 51% после 20:00.
```

---

# 19. Порядок разработки

## Sprint 1 — Foundation

- Next.js project
- PostgreSQL
- Prisma
- Auth.js
- User
- timezone
- базовый layout

Результат:

```text
пользователь может войти в приложение
```

---

## Sprint 2 — Tasks

- Task model
- TaskOccurrence
- Create task
- Edit task
- Delete task
- Today list

Результат:

```text
можно полноценно управлять одноразовыми задачами
```

---

## Sprint 3 — Completion

- DONE
- PARTIAL
- SKIPPED
- dashboard
- overdue

Результат:

```text
можно отслеживать фактическое выполнение
```

---

## Sprint 4 — Conflicts

- duration
- overlap query
- conflict dialog
- fixed/flexible
- priority

Результат:

```text
приложение предупреждает о пересечениях
```

---

## Sprint 5 — Recurrence

- daily
- weekly
- weekdays
- monthly
- occurrence generation

Результат:

```text
работают повторяющиеся задачи
```

---

## Sprint 6 — Notifications

- Notification model
- worker / cron
- in-app/browser notification
- snooze
- retry

Результат:

```text
пользователь получает реальные напоминания
```

---

## Sprint 7 — Polish

- mobile layout
- timezone edge cases
- error handling
- loading states
- empty states
- tests
- deployment

После этого MVP можно отдавать первым пользователям.

---

# 20. Definition of Done для MVP

MVP считается готовым, когда пользователь может:

- зарегистрироваться;
- установить timezone;
- создать одноразовую задачу;
- указать duration;
- выбрать priority;
- выбрать fixed/flexible;
- создать повторяющуюся задачу;
- увидеть конфликт времени;
- подтвердить конфликт или изменить время;
- увидеть задачи на сегодня;
- получить reminder;
- отметить `Done`;
- отметить `Partial`;
- отметить `Skipped`;
- сделать `Snooze`;
- увидеть completion rate;
- использовать приложение нормально с телефона.

---

# 21. Первый milestone

Первый технический milestone:

```text
User
↓
Create Task
↓
TaskOccurrence
↓
Dashboard
↓
Done
```

Не начинать с AI, Voice или Telegram.

Когда этот flow работает полностью — перейти к:

```text
Conflict Detection
↓
Recurrence
↓
Notifications
```

---

# 22. Рекомендуемый первый backlog

```text
MVP-001 Configure PostgreSQL
MVP-002 Configure Prisma
MVP-003 Add authentication
MVP-004 Add User timezone
MVP-005 Create Task model
MVP-006 Create TaskOccurrence model
MVP-007 Create task form
MVP-008 Create task service
MVP-009 Add Today dashboard
MVP-010 Add task statuses
MVP-011 Complete task
MVP-012 Skip task
MVP-013 Partial completion
MVP-014 Add duration
MVP-015 Add priority
MVP-016 Add flexibility
MVP-017 Implement conflict detection
MVP-018 Add conflict dialog
MVP-019 Add recurrence model
MVP-020 Generate occurrences
MVP-021 Add Notification model
MVP-022 Add notification worker
MVP-023 Add Snooze
MVP-024 Add 7-day statistics
MVP-025 Mobile responsive UI
MVP-026 Add tests
MVP-027 Deploy production MVP
```

---

# 23. Главное архитектурное правило

Даже несмотря на Next.js, не смешивать domain logic с UI.

Правильное направление:

```text
React component
      ↓
Server Action / Route
      ↓
Application service
      ↓
Domain logic
      ↓
Repository
      ↓
PostgreSQL
```

Не:

```text
React component
↓
Prisma queries + scheduling + validation + business rules
```

Это особенно важно, потому что позже этот же backend смогут использовать:

```text
Web UI
Telegram
Voice
Mobile app
Calendar integrations
```

без переписывания бизнес-логики.
