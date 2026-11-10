# Railway: kleiner Node-Server (ohne Abhängigkeiten) liefert site-v2 aus
# und speichert die Nachschub-Liste (/einkauf/) in /app/data.
# WICHTIG: In Railway ein Volume auf /app/data hängen, sonst ist die Liste
# nach jedem Deploy leer. TEAM_PIN als Variable setzen = PIN-Schutz.
FROM node:22-alpine
ENV NODE_ENV=production DATA_DIR=/app/data
WORKDIR /app
COPY server ./server
COPY site-v2 ./site-v2
RUN mkdir -p /app/data
EXPOSE 8080
CMD ["node", "server/server.mjs"]
