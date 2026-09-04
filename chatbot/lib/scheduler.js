/* ============================================================================
   LỊCH TỰ ĐỘNG đồng bộ sản phẩm (lib/productSync.js) — mặc định 3h sáng mỗi ngày.
   Chạy TRONG CÙNG tiến trình `node server.js`, không phải job riêng — nên chỉ hoạt
   động khi server đang chạy (server tắt = lịch tắt theo, không tự bù lại lượt đã lỡ).
   ============================================================================ */
const cron = require('node-cron');
const { syncProducts, countProductChunks } = require('./productSync');
const { syncPolicies, countPolicyChunks } = require('./policySync');

const ENABLED = (process.env.PRODUCT_SYNC_ENABLED ?? 'true') !== 'false';
// Mỗi giờ, không phải 1 lần/ngày nữa: từ khi productSync so checksum, lần chạy "không có gì đổi" tốn 0
// lượt gọi Gemini và vài giây -- không còn lý do để lịch thưa, mà lịch thưa chính là nguyên nhân bot đọc
// giá cũ tới 24 tiếng và vẫn tư vấn sản phẩm admin vừa ẩn.
const SCHEDULE = process.env.PRODUCT_SYNC_CRON || '0 * * * *';

let isRunning = false;

async function runSync(trigger) {
  // Bỏ qua nếu lượt trước (cron trước đó, hoặc gọi tay) vẫn đang chạy -- tránh 2 lượt sync chồng nhau
  // cùng ghi vào kb_document/kb_chunk (đồng bộ vài trăm sản phẩm có thể mất vài phút do giãn cách gọi
  // Gemini embedding, xem lib/embeddings.js).
  if (isRunning) {
    console.warn(`  [scheduler] bỏ qua lượt sync (${trigger}) -- lượt trước vẫn đang chạy.`);
    return;
  }
  isRunning = true;
  console.log(`  [scheduler] bắt đầu đồng bộ sản phẩm (${trigger})...`);
  try {
    await syncProducts();
  } catch (e) {
    // Lỗi (hết quota Gemini, backend Java tắt...) không được làm crash cả server -- lượt sync kế tiếp
    // (cron ngày mai) vẫn phải chạy bình thường.
    console.error(`  [scheduler] lượt sync (${trigger}) thất bại:`, e.message);
  } finally {
    isRunning = false;
  }
}

/**
 * Gọi 1 lần lúc server khởi động (server.js).
 *
 * Vẫn KHÔNG sync vô điều kiện mỗi lần khởi động (tránh mỗi lần restart đều gọi Gemini), nhưng sync ngay
 * nếu kho tri thức sản phẩm đang RỖNG. Trước đây chỉ đăng ký lịch: máy vừa cài xong / vừa dựng lại
 * container / lịch chưa từng chạy vì máy tắt ban đêm -> kho rỗng cho tới 3h sáng hôm sau, và triệu chứng
 * duy nhất là bot lịch sự trả "hiện chưa có sản phẩm phù hợp" -- không phân biệt được với hỏng cấu hình.
 */
function start() {
  if (!ENABLED) {
    console.log('  [scheduler] PRODUCT_SYNC_ENABLED=false -- không đăng ký lịch tự động (vẫn chạy tay được qua lib/productSync.js).');
    return;
  }
  if (!cron.validate(SCHEDULE)) {
    console.error(`  [scheduler] PRODUCT_SYNC_CRON="${SCHEDULE}" không hợp lệ -- không đăng ký lịch tự động.`);
    return;
  }
  cron.schedule(SCHEDULE, () => runSync('cron'));
  console.log(`  [scheduler] đã đăng ký lịch tự động đồng bộ sản phẩm: "${SCHEDULE}"`);

  // Tài liệu chính sách nằm trong repo (kb-files/seed) nên nạp được ngay, không phụ thuộc backend Java.
  countPolicyChunks()
    .then((n) => (n === 0 ? syncPolicies() : null))
    .catch((e) => console.error('  [scheduler] không nạp được tài liệu chính sách:', e.message));

  countProductChunks()
    .then((n) => {
      if (n === 0) {
        console.warn('  [scheduler] kho tri thức sản phẩm đang RỖNG -- chạy đồng bộ ngay thay vì đợi lịch.');
        return runSync('khởi động (kho rỗng)');
      }
      console.log(`  [scheduler] kho tri thức sản phẩm đã có ${n} sản phẩm -- không cần sync ngay, đợi lịch.`);
    })
    .catch((e) => console.error('  [scheduler] không kiểm tra được kho tri thức lúc khởi động:', e.message));
}

module.exports = { start };
