# ============================================================================
#  RAG Chatbot Kit — image (single-stage, non-root). Không có native addon nào
#  (pg/multer/pdf-parse/mammoth/xlsx đều thuần JS) — khác Dockerfile CoreX gốc
#  (multi-stage vì better-sqlite3 cần biên dịch), nên không cần python3/make/g++.
# ============================================================================
FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3200
RUN groupadd -r app && useradd -r -g app app
COPY package.json ./
RUN npm install --omit=dev && npm cache clean --force
COPY --chown=app:app server.js ./
COPY --chown=app:app middleware ./middleware
COPY --chown=app:app lib ./lib
COPY --chown=app:app routes ./routes
COPY --chown=app:app public ./public
# thư mục lưu file gốc đã tải lên — cần ghi được khi chạy non-root (thường được mount volume đè lên)
RUN mkdir -p /app/kb-files && chown -R app:app /app/kb-files
USER app
EXPOSE 3200
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3200/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
