/* ============================================================================
   EMBEDDING cho kho tri thức — Google `gemini-embedding-2`, 768 chiều (Matryoshka
   truncation — cắt bớt từ 3072 vẫn giữ phần lớn chất lượng vì model train riêng
   cho việc này). Port từ apsp-ioc-react/lib/embeddings.js (2026-08-04), giữ
   nguyên logic — chỉ đổi thông điệp lỗi sang trung tính (không gắn thương hiệu
   cụ thể của dự án gốc).
   ============================================================================ */
const MODEL = process.env.GEMINI_EMBED_MODEL || 'gemini-embedding-2';
const OUTPUT_DIM = 768;
// Giãn cách tối thiểu (ms) giữa 2 lượt gọi Gemini embedding LIÊN TIẾP — áp dụng CHUNG cho mọi nơi gọi
// (đồng bộ nội bộ, tải file lên kho tri thức, câu hỏi chatbot), vì tất cả dùng chung 1 GEMINI_API_KEY
// nên chung 1 hạn mức "Request per minute". Chỉnh qua .env khi nâng cấp gói trả phí (đặt 0 để tắt hẳn
// giãn cách) — không cần sửa code.
const MIN_INTERVAL_MS = Number(process.env.GEMINI_EMBED_MIN_INTERVAL_MS ?? 4000);
const MAX_RETRY_429 = 3;
// Thời gian chờ tối đa cho MỘT lượt gọi embedding (dùng chung biến với lượt gọi chat để chỉnh 1 chỗ).
const CALL_TIMEOUT_MS = Number(process.env.GEMINI_CHAT_TIMEOUT_MS ?? 30000);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function apiKey() {
  const k = process.env.GEMINI_API_KEY || '';
  if (!k.trim()) throw new Error('Chưa cấu hình GEMINI_API_KEY — không thể tạo embedding.');
  return k;
}

// Hàng đợi tuần tự DÙNG CHUNG cho mọi lượt gọi embedding trong toàn app — đảm bảo giãn cách tối thiểu
// được tôn trọng dù nhiều nơi gọi gần như đồng thời. Không dùng cách "so sánh mốc thời gian" đơn giản vì
// có thể đua nhau (race condition) khi 2 lượt gọi tới cùng lúc — xếp hàng qua chuỗi Promise đảm bảo
// đúng thứ tự, đúng giãn cách.
let queue = Promise.resolve();
let lastCallAt = 0;
function enqueue(fn) {
  const run = queue.then(async () => {
    if (MIN_INTERVAL_MS > 0) {
      const wait = lastCallAt + MIN_INTERVAL_MS - Date.now();
      if (wait > 0) await sleep(wait);
    }
    lastCallAt = Date.now();
    return fn();
  });
  queue = run.catch(() => {}); // 1 lượt lỗi không được làm "vỡ" hàng đợi, các lượt sau vẫn phải chạy
  return run;
}

async function callGeminiEmbed(prefixed) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:embedContent?key=${encodeURIComponent(apiKey())}`;
  const body = {
    content: { parts: [{ text: prefixed }] },
    output_dimensionality: OUTPUT_DIM,
  };
  for (let attempt = 0; ; attempt++) {
    // fetch() KHÔNG có timeout mặc định -- 1 lượt treo sẽ giữ người dùng chờ tới giới hạn ngầm của
    // undici (~5 phút), nhân thêm số lần retry, và KHÔNG tầng nào phía trên cắt được. Cắt tại đây.
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), CALL_TIMEOUT_MS);
    let r;
    try {
      r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
    } catch (e) {
      if (e.name === 'AbortError') throw new Error('Dịch vụ AI phản hồi quá lâu. Vui lòng thử lại.');
      throw e;
    } finally {
      clearTimeout(timer);
    }
    if (r.status === 429 && attempt < MAX_RETRY_429) {
      // Vẫn hết hạn mức dù đã giãn cách (vd hạn mức thật khắt khe hơn mặc định) — đợi thêm rồi thử lại,
      // đợi tăng dần theo số lần thử thay vì báo lỗi ngay.
      await sleep(Math.max(MIN_INTERVAL_MS, 3000) * (attempt + 2));
      continue;
    }
    const j = await r.json();
    if (!r.ok) {
      console.error(`  [embeddings] Gemini embedding lỗi (HTTP ${r.status}):`, (j && j.error && j.error.message) || 'không rõ nguyên nhân');
      throw new Error(`Dịch vụ AI tạm thời lỗi (mã ${r.status}). Vui lòng thử lại.`);
    }
    // response là { embedding: { values: [...] } } (số ít), không phải { embeddings: [{values}] }.
    const values = j.embedding && j.embedding.values;
    if (!Array.isArray(values)) throw new Error('Dịch vụ AI trả về sai định dạng dữ liệu.');
    return values;
  }
}

/** 1 lần gọi = 1 đoạn text -> 1 vector 768 chiều. Model chưa hỗ trợ task_type riêng nên nhúng chỉ dẫn
 * ngay trong text theo đúng cú pháp tài liệu Google: "task: ... | query/text: ...".
 * `throttle`: có xếp vào hàng đợi giãn cách 4s hay không — CHỈ nên bật cho việc gọi HÀNG LOẠT (đồng bộ
 * nội bộ, tải file lên — hàng chục/trăm lượt gọi liên tiếp, thứ thật sự gây hết quota). Câu hỏi chatbot
 * (embedQuery) chỉ gọi ĐÚNG 1 lần/câu hỏi, không cần giãn cách. */
async function embedText(text, { task = 'retrieval_document', throttle = true } = {}) {
  const prefixed = task === 'retrieval_query' ? `task: search result | query: ${text}` : `task: search document | text: ${text}`;
  return throttle ? enqueue(() => callGeminiEmbed(prefixed)) : callGeminiEmbed(prefixed);
}

/** Embedding cho tài liệu khi ingest vào kho tri thức — gọi HÀNG LOẠT, có giãn cách để tránh hết quota RPM. */
function embedDocument(text) { return embedText(text, { task: 'retrieval_document', throttle: true }); }
/** Embedding cho câu hỏi người dùng khi truy vấn RAG — CHỈ 1 lượt/câu hỏi, KHÔNG giãn cách để trả lời
 * nhanh, không bị xếp hàng chờ sau việc đồng bộ hàng loạt đang chạy nền. */
function embedQuery(text) { return embedText(text, { task: 'retrieval_query', throttle: false }); }

/** Chuyển mảng số thành literal `[..]` mà pgvector hiểu được khi truyền qua tham số SQL dạng text. */
function toVectorLiteral(values) {
  return `[${values.join(',')}]`;
}

module.exports = { MODEL, OUTPUT_DIM, embedDocument, embedQuery, toVectorLiteral };
