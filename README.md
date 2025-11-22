# POS Terminal Emulator (TCP)

Емулятор POS-терміналу ПриватБанку, який працює через TCP-з’єднання та обмінюється JSON-повідомленнями, завершеними символом `NULL` (`\u0000`). Підходить для розробників касових систем, яким потрібно тестувати інтеграцію без фізичного POS-пристрою.

## Можливості
- TCP-емуляція POS-терміналу, сумісна з клієнтами на Flutter, C#, Java, Python та іншими TCP-клієнтами.
- Обмін JSON-повідомленнями з обов’язковим `NULL`-термінатором.
- Підтримка методів: `PingDevice`, `ServiceMessage` (identify), `Purchase`.
- Web-панель із живими логами (SSE) та автоматичним визначенням локальних IP для підключення.

## Структура проєкту
```
pos-emulator/
 +- server.js          # TCP-сервер, Web UI, логування
 +- public/
 |    L- index.html    # Веб-інтерфейс із логом
 L- README.md
```

## Вимоги
- Node.js 16+

## Встановлення
У директорії проєкту встановіть залежності:
```bash
npm install
```

## Запуск
```bash
npm start
# або
node server.js
```
Очікуваний вивід у консолі:
```
Web UI running on http://localhost:8080
POS TCP emulator running on port 2222
```

## Web UI
- Адреса: `http://localhost:8080`
- Показує список локальних IP (щоб вибрати адресу для клієнта), порт TCP-емулятора та живий лог підключень, запитів і відповідей.

## Підключення касовим клієнтом
Відкрити TCP-з’єднання:
- IP: локальна IP адреса машини, де запущено емулятор
- PORT: `2222`

Усі повідомлення мають завершуватися `NULL` (`\u0000`).

Приклад адреси: `192.168.0.147:2222`

## Формати запитів
**PingDevice**
```json
{"method":"PingDevice","step":0}
```
Надсилається як: `{"method":"PingDevice","step":0}\u0000`

**Identify**
```json
{"method":"ServiceMessage","step":0,"params":{"msgType":"identify"}}
```

**Purchase**
```json
{
  "method": "Purchase",
  "step": 0,
  "params": {
    "amount": "11.00",
    "discount": "0.00"
  }
}
```

## Формат відповідей
- `PingDevice` → `responseCode: "0000"`.
- `ServiceMessage` `msgType: identify` → базова інформація про термінал (`vendor`, `model`).
- `Purchase` → `responseCode`, `approvalCode`, `rrn`, `receipt`.
- Для невідомих методів повертається службове повідомлення `methodNotImplemented`.
