FROM python:3.9-slim

WORKDIR /app

# Copy requirements first for caching
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY backend/ ./backend/
COPY frontend/ ./frontend/

# Expose port
EXPOSE 5000

# Run the app with Gunicorn
CMD ["sh", "-c", "cd backend && gunicorn app:app --bind 0.0.0.0:5000"]
