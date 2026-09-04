/* ============================================================================
   TIỀN KIỂM MÔI TRƯỜNG — phân biệt "test trượt" với "test không chạy được".

   Vì sao cần: các script hồi quy dưới scripts/ chạy THẬT vào kho tri thức và Gemini. Thiếu một điều
   kiện môi trường (chưa bật Postgres, chưa cấu hình khoá, chưa đồng bộ sản phẩm) thì chúng đỏ vì lý do
   chẳng liên quan gì tới mã. Một test luôn đỏ vì môi trường thì sau vài ngày cả nhóm sẽ mặc kệ nó, và
   lúc nó đỏ THẬT cũng không ai để ý.

   Nên: thiếu môi trường -> in lý do rồi THOÁT VỚI MÃ 0 (bỏ qua), không phải 1 (thất bại).
   ============================================================================ */
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
const vectorStore = require('../lib/vectorStore');

const NAMESPACE = process.env.CHATBOT_NAMESPACE || 'novacart';

/** Trả về chuỗi lý do nếu KHÔNG chạy được, null nếu đủ điều kiện. */
async function tienKiem({ canGemini = true } = {}) {
  if (canGemini && !String(process.env.GEMINI_API_KEY || '').trim()) {
    return 'chưa cấu hình GEMINI_API_KEY trong chatbot/.env';
  }
  try {
    await vectorStore.query('SELECT 1');
  } catch (e) {
    return `không kết nối được Postgres (${process.env.CHATBOT_PG_HOST}:${process.env.CHATBOT_PG_PORT}): `
      + `${e.message} -- chạy "docker compose up -d" trong thư mục chatbot/`;
  }
  const r = await vectorStore.query(
    `SELECT COUNT(*)::int AS n FROM kb_chunk WHERE namespace = $1 AND folder_id = 'products'`,
    [NAMESPACE],
  );
  if (r.rows[0].n === 0) {
    return `kho tri thức của namespace "${NAMESPACE}" chưa có sản phẩm nào -- `
      + 'chạy "node lib/productSync.js" trước (backend Java phải đang chạy)';
  }
  return null;
}

/** Bọc phần thân của một script hồi quy: tiền kiểm -> chạy -> đóng pool -> đặt mã thoát. */
async function chay(ten, than, opts) {
  const lyDo = await tienKiem(opts);
  if (lyDo) {
    console.log(`⊘ BỎ QUA ${ten}: ${lyDo}`);
    await vectorStore.pool.end().catch(() => {});
    process.exit(0);
  }
  console.log(`▶ ${ten}`);
  let dat = false;
  try {
    dat = await than();
  } catch (e) {
    console.error('  LỖI:', e.message);
  }
  await vectorStore.pool.end().catch(() => {});
  console.log(dat ? `✔ ĐẠT — ${ten}` : `✖ TRƯỢT — ${ten}`);
  process.exit(dat ? 0 : 1);
}

module.exports = { tienKiem, chay, NAMESPACE };
