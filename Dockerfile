# بيعرض الموقع الجديد (site-v2) على Railway.
# Railway بيعطي البورت بمتغيّر PORT، و Caddy بيسمع عليه.
FROM caddy:2.8-alpine
COPY site-v2 /srv
EXPOSE 8080
CMD ["sh", "-c", "caddy file-server --root /srv --listen :${PORT:-8080}"]
