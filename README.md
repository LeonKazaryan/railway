# RailLens

Система мониторинга телеметрии железнодорожного подвижного состава (локомотивы серии ТЭ33А). Включает симулятор телеметрии, мост передачи данных, Spring Boot бэкенд и React-фронтенд с картой флота и цифровым двойником.

## Стек

- **Frontend** — React + Vite + TypeScript
- **Backend** — Spring Boot (Java)
- **Симулятор** — Python (`stream/version2.py`)
- **Мост** — Python (`stream/telemetry_bridge.py`)

## Запуск

### 1. Переменные окружения

Создайте файл `front/.env.local`:

```env
VITE_API_URL=http://localhost:8080
VITE_MAPTILER_KEY=<your_key>
VITE_STADIA_MAPS_API_KEY=<your_key>
VITE_AUTH_LOGIN=admin
VITE_AUTH_PASSWORD=<password>
```

### 2. Установка зависимостей

```bash
npm install
npm install --prefix front
```

### 3. Запуск всех сервисов

```bash
npm run dev
```

Команда запускает одновременно фронтенд, бэкенд, симулятор и мост.

| Сервис    | Адрес                   |
|-----------|-------------------------|
| Frontend  | http://localhost:5173   |
| Backend   | http://localhost:8080   |
