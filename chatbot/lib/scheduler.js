/* ============================================================================
   LỊCH TỰ ĐỘNG đồng bộ sản phẩm (lib/productSync.js) — mặc định 3h sáng mỗi ngày.
   Chạy TRONG CÙNG tiến trình `node server.js`, không phải job riêng — nên chỉ hoạt
   động khi server đang chạy (server tắt = lịch tắt theo, không tự bù lại lượt đã lỡ).
   ============================================================================ */
const cron = require('node-cron');
const { syncProducts } = require('./productSync');

const ENABLED = (process.env.PRODUCT_SYNC_ENABLED ?? 'true') !== 'false';
const SCHEDULE = process.env.PRODUCT_SYNC_CRON || '0 3 * * *'; // 3h sáng mỗi ngày (giờ hệ thống chạy server)

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

/** Gọi 1 lần lúc server khởi động (server.js). Không tự sync ngay khi bật (tránh mỗi lần deploy/restart
 * server đều tốn lượt gọi Gemini) -- chỉ đăng ký lịch, đợi đúng giờ mới chạy. Muốn sync ngay lập tức thì
 * vẫn dùng `node lib/productSync.js` (chạy tay) như trước, không đổi. */
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
}

module.exports = { start };
