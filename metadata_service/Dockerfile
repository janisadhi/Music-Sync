FROM python:3.14-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ffmpeg \
        atomicparsley \
        libchromaprint-tools \
    && rm -rf /var/lib/apt/lists/*

COPY metadata_service/requirements.txt ./metadata_service/requirements.txt

RUN pip install --no-cache-dir -r metadata_service/requirements.txt

COPY app ./app
COPY metadata_service ./metadata_service

RUN mkdir -p /app/downloads /app/data/beets

EXPOSE 8001

CMD ["uvicorn", "metadata_service.main:app", "--host", "0.0.0.0", "--port", "8001"]
