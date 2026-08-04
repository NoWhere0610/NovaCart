/* ============================================================================
   KHO TRI THỨC (Postgres + pgvector) — kết nối + schema + hàm truy cập.
   Port từ apsp-ioc-react/lib/vectorStore.js (2026-08-04) — CHỈ đổi `bot` (chỉ
   nhận đúng 2 giá trị 'in'/'web' của CoreX) thành `namespace` (chuỗi tự do bất
   kỳ) để dự án tái dùng tự đặt phạm vi riêng, không bị khoá cứng.
   ============================================================================ */
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.CHATBOT_PG_HOST || '127.0.0.1',
  port: Number(process.env.CHATBOT_PG_PORT) || 5433,
  database: process.env.CHATBOT_PG_DATABASE || 'chatbot_kb',
  user: process.env.CHATBOT_PG_USER || 'chatbot',
  password: process.env.CHATBOT_PG_PASSWORD || 'changeme',
  max: 10,
  // 1 câu treo (bug/khoá bảng ngoài ý muốn) mà không có giới hạn sẽ chiếm giữ 1/10 connection của pool
  // vô thời hạn, dần dần nghẽn hết cả pool — tự huỷ sau 15s.
  statement_timeout: 15000,
});
pool.on('error', (err) => console.error('  [vector-store] lỗi pool ngoài ý muốn:', err.message));

/* ---------------- schema (idempotent — chạy an toàn mỗi lần khởi động) ---------------- */
const SCHEMA_SQL = `
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS kb_folder (
  id              TEXT PRIMARY KEY,
  namespace       TEXT NOT NULL,
  ten             TEXT NOT NULL,
  nguon           TEXT NOT NULL CHECK (nguon IN ('api','file')),
  mo_ta           TEXT DEFAULT '',
  dong_bo_tu_dong BOOLEAN NOT NULL DEFAULT false,
  tan_suat        TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS kb_document (
  id            BIGSERIAL PRIMARY KEY,
  folder_id     TEXT NOT NULL REFERENCES kb_folder(id) ON DELETE CASCADE,
  ten_file      TEXT NOT NULL,
  loai          TEXT NOT NULL,
  duong_dan     TEXT,
  checksum      TEXT,
  trang_thai    TEXT NOT NULL DEFAULT 'moi' CHECK (trang_thai IN ('moi','dang_xu_ly','xong','loi')),
  loi           TEXT,
  nguoi_tai     TEXT,
  mo_ta         TEXT NOT NULL DEFAULT '',
  cap_nhat_luc  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS kb_document_folder_idx ON kb_document (folder_id);

CREATE TABLE IF NOT EXISTS kb_chunk (
  id            BIGSERIAL PRIMARY KEY,
  document_id   BIGINT NOT NULL REFERENCES kb_document(id) ON DELETE CASCADE,
  folder_id     TEXT NOT NULL,
  namespace     TEXT NOT NULL,
  thu_tu        INT NOT NULL,
  noi_dung      TEXT NOT NULL,
  embedding     VECTOR(768),
  -- Metadata CHỈ có giá trị với chunk thuộc folder sản phẩm (đồng bộ tự động từ NovaCart, xem
  -- lib/productSync.js) — NULL với chunk thuộc tài liệu FAQ/chính sách tải tay. Dùng để LỌC CỨNG
  -- (giá/size/màu/danh mục) trước khi rerank bằng vector, xem retrieveFilteredProducts() trong ragQuery.js.
  danh_muc      TEXT,
  thuong_hieu   TEXT,
  gia           NUMERIC(12,2),
  sizes         TEXT[],
  colors        TEXT[],
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- ADD COLUMN IF NOT EXISTS cho DB đã tạo từ trước khi có các cột metadata này (idempotent, an toàn
-- chạy lại nhiều lần) — CREATE TABLE IF NOT EXISTS ở trên không tự thêm cột vào bảng đã tồn tại.
ALTER TABLE kb_chunk ADD COLUMN IF NOT EXISTS danh_muc TEXT;
ALTER TABLE kb_chunk ADD COLUMN IF NOT EXISTS thuong_hieu TEXT;
ALTER TABLE kb_chunk ADD COLUMN IF NOT EXISTS gia NUMERIC(12,2);
ALTER TABLE kb_chunk ADD COLUMN IF NOT EXISTS sizes TEXT[];
ALTER TABLE kb_chunk ADD COLUMN IF NOT EXISTS colors TEXT[];
CREATE INDEX IF NOT EXISTS kb_chunk_embedding_idx ON kb_chunk USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS kb_chunk_scope_idx ON kb_chunk (namespace, folder_id);
CREATE INDEX IF NOT EXISTS kb_chunk_document_idx ON kb_chunk (document_id);
CREATE INDEX IF NOT EXISTS kb_chunk_gia_idx ON kb_chunk (folder_id, gia);

CREATE TABLE IF NOT EXISTS kb_cau_hoi_chua_tra_loi (
  id            BIGSERIAL PRIMARY KEY,
  namespace     TEXT NOT NULL,
  cau_hoi       TEXT NOT NULL,
  nguoi_hoi     TEXT,
  goi_y_folder  TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS kb_cau_hoi_chua_tra_loi_ns_idx ON kb_cau_hoi_chua_tra_loi (namespace, created_at DESC);

CREATE TABLE IF NOT EXISTS chat_session (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  namespace     TEXT NOT NULL,
  user_id       TEXT,
  device_id     TEXT,
  tieu_de       TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS chat_session_owner_idx ON chat_session (namespace, user_id, device_id);
CREATE INDEX IF NOT EXISTS chat_session_created_idx ON chat_session (created_at);

CREATE TABLE IF NOT EXISTS chat_message (
  id              BIGSERIAL PRIMARY KEY,
  session_id      UUID NOT NULL REFERENCES chat_session(id) ON DELETE CASCADE,
  vai_tro         TEXT NOT NULL CHECK (vai_tro IN ('user','bot')),
  noi_dung        TEXT NOT NULL,
  nguon_trich_dan TEXT[],
  danh_gia        SMALLINT,
  tra_loi_duoc    BOOLEAN,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS chat_message_session_idx ON chat_message (session_id, created_at);
CREATE INDEX IF NOT EXISTS chat_message_role_created_idx ON chat_message (vai_tro, created_at);
`;

let migrated = null;
/** Chạy 1 lần khi cần (lazy — tránh chặn khởi động server nếu Postgres chưa sẵn sàng ngay lúc boot). */
async function ensureSchema() {
  if (!migrated) {
    migrated = pool.query(SCHEMA_SQL).then(
      () => console.log('  [vector-store] schema sẵn sàng (kb_*, chat_session, chat_message)'),
      (err) => { migrated = null; throw err; },
    );
  }
  return migrated;
}

async function query(text, params) {
  await ensureSchema();
  return pool.query(text, params);
}

module.exports = { pool, query, ensureSchema };
