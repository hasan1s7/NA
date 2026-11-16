FROM python:3.13-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 NABU_HOST=0.0.0.0 PORT=8000 NABU_DB=/data/nabu.sqlite3
WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt && useradd --uid 10001 --create-home nabu && mkdir -p /data && chown nabu:nabu /data
COPY --chown=nabu:nabu server.py social.py language_services.py upgrades.py backup_service.py word_links.py translation_memory.py media_services.py content_progress.py decision_engine.py intents.py next_step_inputs.py institutions.py ./
COPY --chown=nabu:nabu public ./public
COPY --chown=nabu:nabu data ./data
COPY --chown=nabu:nabu tools/check_providers.py tools/backup_database.py tools/restore_database.py tools/backup_status.py tools/verify_offsite_backup.py ./tools/
USER nabu
VOLUME ["/data"]
EXPOSE 8000
CMD ["python", "server.py"]
