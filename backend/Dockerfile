# Используем официальный Python образ
FROM python:3.13-slim

# Устанавливаем системные зависимости
# zbar - для работы pyzbar
# libzbar0 - библиотека zbar
# build-essential - для компиляции некоторых Python пакетов
# libpq-dev - для работы с PostgreSQL
RUN apt-get update && apt-get install -y \
    libzbar0 \
    zbar-tools \
    libpq-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Устанавливаем рабочую директорию
WORKDIR /app

# Копируем файл зависимостей
COPY requirements.txt .

# Устанавливаем Python зависимости
RUN pip install --no-cache-dir -r requirements.txt

# Копируем весь код приложения
COPY . .

# Открываем порт
EXPOSE 8000

# Команда для запуска приложения
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

