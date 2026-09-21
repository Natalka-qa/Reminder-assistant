# Sprint 9 — V1.2: Voice input

Источник: [nextjs-personal-scheduling-assistant-mvp-plan.md](./nextjs-personal-scheduling-assistant-mvp-plan.md), §18, **V1.2 — Voice**:

```text
Voice
↓
Speech-to-text
↓
TaskDraft
↓
тот же create flow
```

План не расписывает спринты после Sprint 7 (см. sprint-8-tasks.md), поэтому, как и Sprint 8, этот документ написан сейчас по тому же принципу. Продолжение [sprint-8-tasks.md](./sprint-8-tasks.md) — Sprint 8 смержен (PR [#8](https://github.com/Natalka-qa/Reminder-assistant/pull/8), в `main`), ветка `sprint-9-tasks` ответвляется от актуального `main` (который с тех пор получил ещё и полный визуальный редизайн, PR [#9](https://github.com/Natalka-qa/Reminder-assistant/pull/9) — TaskForm ниже уже в его вёрстке).

**Цель спринта:** добавить кнопку микрофона рядом с существующим полем «What do you need to do?» на `/tasks/new`. Диктовка идёт через встроенное в браузер распознавание речи (Web Speech API) и просто заполняет то же текстовое поле, дальше — **тот же** путь, что Sprint 8 уже построил (`parseTaskDraftAction` → `TaskDraft` → предзаполнение формы). Никакого нового LLM-вызова, сервер-экшна или секрета — голос производит текст, всё остальное уже есть.

**Sprint Definition of Done**

- [ ] `npm run build`, `npm run lint`, `npm run typecheck`, `npm run test`, `npm run format:check` зелёные; CI на PR проходит.
- [ ] На `/tasks/new`, рядом с текстовым полем «Fill from text», есть кнопка микрофона (только когда `showTextDraft` включён — то же условие, что и у самого поля).
- [ ] Кнопки микрофона **нет**, если браузер не поддерживает `SpeechRecognition`/`webkitSpeechRecognition` — фича обнаруживается в рантайме, не флагом окружения; текстовый флоу Sprint 8 не затронут никак.
- [ ] Тап по кнопке начинает диктовку; промежуточный результат живо обновляет текстовое поле; когда распознавание завершается непустым текстом — это автоматически запускает тот же `handleFillFromText`, что и кнопка «Fill from text» (без второго тапа).
- [ ] Повторный тап во время диктовки останавливает её раньше — то, что уже услышано, сохраняется в поле как обычный текст.
- [ ] Отказ в доступе к микрофону / ошибка распознавания → toast с понятным сообщением, поле и форма не ломаются; тишина без единого слова не показывает ошибку.
- [ ] Новый unit-тест только на чистую логику (feature-detection предикат) — само распознавание речи не мокается и не тестируется (см. «Расхождения» п.7).

---

## 1. Стартовое состояние (аудит по факту)

| Область | Что нашли |
|---|---|
| **«Fill from text» сейчас** | `TaskForm` (`task-form.tsx`) держит `draftText` в state, кнопка «Fill from text» вызывает `handleFillFromText()`, который читает `draftText` из замыкания и вызывает `parseTaskDraftAction(draftText)` (Sprint 8). Поле рендерится только при `showTextDraft` (`isTaskDraftEnabled()` — есть ли `ANTHROPIC_API_KEY`). После редизайна (PR #9) это `rose-tint` блок с `Textarea` + `Button variant="secondary"`. |
| **Голос / аудио в проекте** | Не используется нигде. Ни одной зависимости, ни одного файла. |
| **Web Speech API и TypeScript** | `SpeechRecognition` — нестандартный/экспериментальный Web API, его нет в TypeScript `lib.dom.d.ts` (`tsconfig.json`: `"lib": ["dom", "dom.iterable", "esnext"]`) — нужна собственная ambient-декларация типов. |
| **Поддержка браузерами** | Chrome/Edge (desktop и Android) реализуют `webkitSpeechRecognition`; Firefox и Safari — не гарантированно/не всегда. Обнаруживается только в рантайме (`typeof window !== "undefined" && ("SpeechRecognition" in window \|\| "webkitSpeechRecognition" in window)`), не собирается статически. |
| **Иконки** | `lucide-react` уже используется (сайдбар/нижняя навигация) — `Mic` есть в наборе, новая зависимость не нужна. |
| **Паттерн опциональных фич** | Sprint 8 уже установил принцип: если предпосылка фичи недоступна (там — `ANTHROPIC_API_KEY`), элемент управления просто не рендерится, а не показывается disabled/сломанным (`isTaskDraftEnabled()`). Тот же принцип подходит для отсутствия `SpeechRecognition` в браузере. |

### Расхождения плана / решения на этот спринт

1. **Speech-to-text — браузерный Web Speech API, не платный сторонний сервис (Whisper API, Deepgram и т.п.).** У проекта уже нет настроенного биллинга для внешних платных API — именно поэтому `ANTHROPIC_API_KEY` в Sprint 8 сделан необязательным (sprint-8-tasks.md «Расхождения» п.8). Второй платный внешний сервис упёрся бы в ту же стену ещё до того, как его можно было бы протестировать. Браузерное распознавание не требует ни сервера, ни секрета, ни бюджета — и прямо реализует «Speech-to-text» из диаграммы плана, просто силами браузера, а не нового бэкенд-вызова.
2. **Никакого нового сервиса или server action.** Весь путь «текст → `TaskDraft`» уже есть (`task-draft.service.ts`, `parseTaskDraftAction`, Sprint 8). Голос отвечает только за один шаг: речь → текст в то же поле — это чистая клиентская логика (хук + кнопка) внутри `TaskForm`, не новый слой архитектуры.
3. **Graceful feature detection — кнопка скрыта, не задизейблена.** Зеркалит `isTaskDraftEnabled()` из Sprint 8: нет `SpeechRecognition` в `window` → кнопки микрофона просто нет. Пользователь в неподдерживаемом браузере не видит ничего сломанного — ровно текстовый флоу Sprint 8, без изменений.
4. **Автозапуск «Fill from text» по окончании диктовки, не второй ручной тап.** Диаграмма плана рисует «Voice → Speech-to-text → TaskDraft» как один пайплайн, не два раздельных шага. Когда распознавание заканчивается непустым текстом, компонент вызывает ту же функцию, что и кнопка «Fill from text» — с той же обработкой ошибок и тем же toast. Кнопка «Fill from text» остаётся на месте — для текста, введённого руками, или чтобы повторить попытку.
5. **Промежуточный (interim) результат виден в поле, но не уходит в LLM.** Пока идёт диктовка, `draftText` живо обновляется промежуточными результатами (пользователь видит, что его слышат) — но `parseTaskDraftAction` вызывается один раз, после финализации распознавания, а не на каждый промежуточный фрагмент посреди фразы.
6. **Одноразовая диктовка (`continuous = false`), не постоянное прослушивание.** Соответствует масштабу самого поля (короткое свободное описание одной задачи, как и в Sprint 8) и не требует отдельного UI для «остановить и не искать». Повторный тап по кнопке во время диктовки останавливает её раньше — уже услышанное остаётся в поле.
7. **Реальное распознавание речи не тестируется.** Та же причина, что и в Sprint 8 для реального вызова Anthropic (sprint-8-tasks.md «Расхождения» п.7): в jsdom/vitest нет реализации `SpeechRecognition`, а мокать весь event-callback интерфейс ради теста — тестировать мок, не фичу. Тестируется только то, что действительно чистая логика: предикат поддержки браузером.

---

## 2. Обзор задач

| ID | Задача | Оценка | Зависит от |
|---|---|---|---|
| S9-01 | Ambient-типы `SpeechRecognition` + `isSpeechDictationSupported()` | 0.5 ч | — |
| S9-02 | `useSpeechDictation` — хук управления диктовкой (start/stop, interim/final, ошибки) | 1.5 ч | S9-01 |
| S9-03 | `TaskForm`: кнопка микрофона рядом с «Fill from text», автозапуск парсинга по финалу | 1 ч | S9-02 |
| S9-04 | Тест на `isSpeechDictationSupported` | 0.5 ч | S9-01 |

**Итого:** ≈ 3.5 ч.

---

## 3. Задачи

### S9-01 · Типы и feature detection

**Что сделать**
- `src/lib/speech/speech-recognition.d.ts` — минимальная ambient-декларация `SpeechRecognition`/`SpeechRecognitionEvent`/`SpeechRecognitionErrorEvent` и `Window.SpeechRecognition`/`Window.webkitSpeechRecognition`, покрывающая только то, что реально используется (`start`/`stop`, `continuous`/`interimResults`/`lang`, `onresult`/`onerror`/`onend`).
- `src/lib/speech/use-speech-dictation.ts` — `isSpeechDictationSupported()`, чистый предикат без побочных эффектов.

**Acceptance criteria**
- [ ] `isSpeechDictationSupported()` возвращает `false` на сервере (`typeof window === "undefined"`) и в браузере без конструктора распознавания; `true`, когда конструктор есть.

---

### S9-02 · `useSpeechDictation`

**Что сделать**
- Хук в том же файле: `useSpeechDictation({ onTranscriptChange, onError?, lang? })` → `{ supported, listening, toggle }`.
- `onTranscriptChange(text, isFinal)` вызывается на каждый `onresult` (живой interim-текст) и один раз с `isFinal = true` при завершении фразы.
- `onerror`: `"no-speech"` и `"aborted"` — не ошибки (тишина/намеренная остановка), без вызова `onError`; остальные коды (`"not-allowed"`, `"service-not-allowed"`, `"audio-capture"`, `"network"`, …) — вызывают `onError(code)`.
- Один экземпляр `SpeechRecognition` на сессию диктовки (в `ref`), останавливается при размонтировании компонента.

**Acceptance criteria**
- [ ] `toggle()` вызывает `start()`, когда не слушает, и `stop()` — когда слушает.
- [ ] Компонент, размонтированный во время диктовки, не оставляет висящий активный `SpeechRecognition`.

---

### S9-03 · UI в `TaskForm`

**Что сделать**
- `handleFillFromText` принимает текст параметром (`(text: string)`), а не читает `draftText` из замыкания — кнопка «Fill from text» передаёт `draftText` явно, диктовка передаёт финальный транскрипт напрямую (без гонки с асинхронным `setState`).
- Кнопка-иконка (`Mic`, `lucide-react`) рядом с «Fill from text», видна только при `showTextDraft && voiceSupported`. Во время диктовки — визуально другое состояние (акцент, `aria-label="Stop listening"` вместо `"Start voice input"`).
- `onTranscriptChange`: всегда `setDraftText(text)`; если `isFinal` и текст не пустой — тем же вызовом `handleFillFromText(text)`.
- `onError`: `toast.error(...)` с понятным сообщением («Microphone access was denied.» для `not-allowed`/`service-not-allowed`, иначе общее «Voice input failed. Please try again or type instead.»).

**Acceptance criteria**
- [ ] Диктовка «Tomorrow at 7pm, workout for an hour» заполняет `draftText`, затем автоматически заполняет форму — тем же результатом, что и ручной ввод + клик «Fill from text».
- [ ] Без `ANTHROPIC_API_KEY` (то есть `showTextDraft = false`) кнопки микрофона нет вообще — как и всего блока «Fill from text».
- [ ] Без поддержки браузером кнопки микрофона нет, блок «Fill from text» работает как в Sprint 8.

---

### S9-04 · Тест

**Что сделать**
- Юнит-тест на `isSpeechDictationSupported()` — подмена `window.SpeechRecognition`/`webkitSpeechRecognition` (есть/нет обоих) в `jsdom`, без реального распознавания речи.

**Acceptance criteria**
- [ ] Тест не требует сети и не запускает настоящее распознавание речи.

---

## 4. Не входит в Sprint 9

Постоянное/фоновое прослушивание; голосовой ввод где-либо, кроме `/tasks/new` (Sprint 8's «Fill from text» и так пока живёт только там); озвучивание ответа (text-to-speech) — плане про это не сказано; поддержка языков, отличных от `en-US`, — `lang` захардкожен, локализация не входит в масштаб MVP; Telegram-бот (V1.3), чтение Google Calendar (V1.4) и всё, что план явно откладывает дальше V1.2.

---

## 5. Риски

| Риск | Влияние | Что делаем |
|---|---|---|
| Браузер начинает, но не поддерживает событие правильно (частичная/глючная реализация) | Диктовка молча не работает | Кнопка скрыта, только если конструктора нет вообще — частичная поддержка не отлавливается на этом масштабе; при реальной ошибке — toast, а не тишина |
| Разрешение на микрофон не выдано (или выдано один раз и потом забыто браузером) | Пользователь не понимает, что пошло не так | `onerror` с кодом `not-allowed`/`service-not-allowed` → явный toast «Microphone access was denied.» |
| Автозапуск парсинга после диктовки дублирует стоимость/задержку ручного клика «Fill from text» | Лишний вызов Claude Haiku, если пользователь и продиктовал, и потом ещё раз нажал кнопку | Кнопка «Fill from text» задизейблена тем же `draftPending`, что и во время диктовкой запущенного парсинга — второй клик, пока первый ещё не завершился, невозможен |

---

## 6. Предлагаемый порядок работы

| Шаг | Задачи |
|---|---|
| 1 | S9-01, S9-02 |
| 2 | S9-03 |
| 3 | S9-04, прогон Sprint DoD |
