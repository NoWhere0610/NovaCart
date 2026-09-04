/* ============================================================================
   LÕI RAG — truy vấn vector theo namespace + ghép bộ nhớ hội thoại + gọi LLM.
   Port từ apsp-ioc-react/lib/ragQuery.js (2026-08-04) — CHỈ khác 1 điểm: bản
   gốc lọc "folder nào user được xem" qua lib/dataPermResolve.js (hệ phân quyền
   4 mức mật riêng của CoreX, gắn với vai trò/Agent 1/2/3). Kit này KHÔNG có khái
   niệm user/vai trò (xác thực bằng API key tĩnh, server-to-server) — mặc định
   truy hồi trên TOÀN BỘ folder thuộc đúng `namespace` được truyền vào.
   Muốn lọc phạm vi hẹp hơn (vd 1 phòng ban chỉ thấy 1 số folder): truyền thêm
   `allowedFolders` (mảng id) vào `askQuestion()`/`retrieveChunks()` — đây là
   ĐIỂM MỞ RỘNG, tự viết logic quyết định allowedFolders ở tầng gọi (route),
   không đụng vào file này.

   ---- Tuỳ biến riêng cho NovaCart (2026-08-03) ----
   1. Persona đổi từ "FAQ nghiêm ngặt, từ chối nếu thiếu dữ liệu" sang "tư vấn
      bán hàng thời trang nam": so sánh/gợi ý sản phẩm, chủ động hỏi lại khách
      khi thiếu thông tin thay vì từ chối thẳng (xem buildSystemPrompt()).
   2. Thêm bước TRÍCH ĐIỀU KIỆN LỌC (giá/size/màu/danh mục) từ câu hỏi khách
      bằng 1 lượt gọi Gemini riêng (extractProductFilters), rồi LỌC CỨNG bằng
      SQL trong đúng folder sản phẩm (PRODUCT_FOLDER_ID) trước khi mới rerank
      bằng vector — chính xác hơn so với chỉ dựa vào ngữ nghĩa thuần tuý khi
      khách nêu rõ điều kiện (vd "áo sơ mi dưới 300k, size L"). Câu hỏi KHÔNG
      nêu điều kiện cụ thể (hoặc thuộc FAQ) vẫn đi qua nhánh semantic-thuần như
      bản gốc, không đổi.
   ============================================================================ */
const vectorStore = require('./vectorStore');
const embeddings = require('./embeddings');

const TOP_K = Number(process.env.RAG_TOP_K ?? 8);
const MAX_DISTANCE = Number(process.env.RAG_MAX_DISTANCE ?? 0.35); // cosine distance <=> 0.35 ~ similarity >= 0.65, cần tinh chỉnh theo thực tế
// 8 LƯỢT hỏi-đáp = 16 dòng tin nhắn (mỗi lượt gồm 1 tin của khách + 1 tin của bot). Bản trước lấy LIMIT
// 8 dòng nhưng tài liệu/comment lại ghi "nhớ 8 lượt" -- thực tế chỉ nhớ được 4 lượt, sai gấp đôi.
const MEMORY_TURNS = Number(process.env.RAG_MEMORY_TURNS ?? 8);
const MEMORY_MESSAGE_LIMIT = MEMORY_TURNS * 2;
const CALL_TIMEOUT_MS = Number(process.env.GEMINI_CHAT_TIMEOUT_MS ?? 30000); // fetch() không có timeout mặc định — 1 lượt treo sẽ khiến người dùng chờ vô thời hạn không có lỗi hiển thị

// Folder cố định chứa dữ liệu SẢN PHẨM đồng bộ tự động mỗi ngày từ NovaCart (xem
// lib/productSync.js) — lọc cứng theo giá/size/màu/danh mục CHỈ áp dụng trong
// đúng folder này; tài liệu FAQ/chính sách tải tay ở folder khác không có các
// cột metadata này (NULL) nên không bị/không cần lọc kiểu này.
const PRODUCT_FOLDER_ID = 'products';

const AI = {
  model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
  apiKey: process.env.GEMINI_API_KEY || '',
};

/** Gọi Gemini với 1 schema JSON bất kỳ, trả về object đã parse (hoặc throw nếu lỗi/timeout).
 * Dùng chung cho cả bước trích điều kiện lọc lẫn bước trả lời cuối cùng — tránh lặp code fetch. */
async function callGeminiStructured(promptText, schema) {
  if (!AI.apiKey.trim()) throw new Error('no_key');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${AI.model}:generateContent?key=${encodeURIComponent(AI.apiKey)}`;
  const body = {
    contents: [{ role: 'user', parts: [{ text: promptText }] }],
    generationConfig: { temperature: 0.2, responseMimeType: 'application/json', responseSchema: schema },
  };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), CALL_TIMEOUT_MS);
  let r;
  try {
    r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
  if (!r.ok) throw new Error(`http_${r.status}`);
  const j = await r.json();
  const raw = j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts && j.candidates[0].content.parts[0] && j.candidates[0].content.parts[0].text;
  if (!raw) throw new Error('empty_response');
  return JSON.parse(raw);
}

const FILTER_SCHEMA = {
  type: 'OBJECT',
  properties: {
    hasFilter: { type: 'BOOLEAN' },
    minPrice: { type: 'NUMBER' },
    maxPrice: { type: 'NUMBER' },
    size: { type: 'STRING' },
    color: { type: 'STRING' },
    category: { type: 'STRING' },
  },
  required: ['hasFilter'],
};

/** Trích điều kiện lọc sản phẩm (giá/size/màu/danh mục) từ câu hỏi khách, nếu khách có nêu RÕ.
 * Không suy đoán thêm — khách hỏi chung chung thì trả hasFilter=false, đi tiếp nhánh semantic-thuần. */
async function extractProductFilters(searchText) {
  const prompt = `Bạn nhận 1 câu hỏi/tin nhắn của khách mua sắm thời trang nam. Nếu khách nêu RÕ ít nhất 1 điều kiện lọc sản phẩm (khoảng giá, size, màu sắc, loại/danh mục sản phẩm như áo sơ mi/quần jean/áo khoác...), hãy trích CHÍNH XÁC điều kiện đó — kể cả cách nói khẩu ngữ về giá (vd "3 xị" = 300000đ, "1 củ" = 1000000đ, "dưới nửa triệu" = maxPrice 500000, "tầm 2-3 trăm" = minPrice 200000 maxPrice 300000).

QUAN TRỌNG — trường "size" CHỈ là size QUẦN ÁO chuẩn: S, M, L, XL, XXL, 3XL... (hoặc số đo cụ thể nếu khách nói). KHÔNG được điền các từ mô tả FORM/KIỂU DÁNG như "slim", "regular", "rộng", "ôm", "suông", "form rộng"... vào trường size — những từ đó KHÔNG phải size, bỏ qua không lọc theo chúng (vẫn có thể giữ lại trong "category" nếu là 1 phần tên loại sản phẩm, vd "quần tây ống suông").

TUYỆT ĐỐI không suy đoán hay tự thêm điều kiện khách không nói. Nếu khách chỉ hỏi chung chung, chào hỏi, hoặc hỏi về chính sách/FAQ (không phải điều kiện lọc sản phẩm cụ thể), trả hasFilter=false và bỏ trống các trường còn lại.

TIN NHẮN CỦA KHÁCH: ${searchText}`;
  try {
    const parsed = await callGeminiStructured(prompt, FILTER_SCHEMA);
    if (!parsed || !parsed.hasFilter) return { hasFilter: false };
    return {
      hasFilter: true,
      minPrice: typeof parsed.minPrice === 'number' ? parsed.minPrice : null,
      maxPrice: typeof parsed.maxPrice === 'number' ? parsed.maxPrice : null,
      size: parsed.size || null,
      color: parsed.color || null,
      category: parsed.category || null,
    };
  } catch (e) {
    // Trích lọc thất bại (hết quota/lỗi mạng/chưa cấu hình key...) -> KHÔNG chặn cả câu hỏi, chỉ bỏ
    // qua bước lọc cứng và để nhánh semantic-thuần lo phần còn lại (vẫn trả lời được, chỉ kém chính xác hơn).
    console.error('  [rag] trích điều kiện lọc thất bại, bỏ qua lọc cứng:', e.message);
    return { hasFilter: false };
  }
}

/** Lọc cứng theo giá/size/màu/danh mục (SQL) trong đúng PRODUCT_FOLDER_ID, rồi rerank bằng vector
 * trong đúng tập đã lọc — chính xác hơn semantic-thuần khi khách nêu rõ điều kiện. */
async function retrieveFilteredProducts({ namespace, qVec, filters }) {
  // Khách nêu CẢ size lẫn màu -> phải khớp đúng CẶP đó còn hàng, không phải "có size này" VÀ (độc lập)
  // "có màu này". Sản phẩm còn M/Đen và L/Trắng mà kiểm 2 điều kiện rời nhau sẽ khớp cả "M màu Trắng" --
  // một tổ hợp không tồn tại, và bot sẽ khẳng định với khách là còn hàng. Xem chú thích ở
  // productSync.js#productToText và cột kb_chunk.size_colors.
  const pairKey = filters.size && filters.color
    ? `${String(filters.size).toLowerCase()}|${String(filters.color).toLowerCase()}`
    : null;

  const r = await vectorStore.query(
    `SELECT kc.noi_dung, kf.ten AS folder_ten, (kc.embedding <=> $1::vector) AS distance
     FROM kb_chunk kc JOIN kb_folder kf ON kf.id = kc.folder_id
     WHERE kc.namespace = $2 AND kc.folder_id = $3
       AND ($4::numeric IS NULL OR kc.gia >= $4)
       AND ($5::numeric IS NULL OR kc.gia <= $5)
       -- Có cả size lẫn màu: khớp theo cặp. Chỉ có 1 trong 2: khớp lẻ như cũ.
       AND ($9::text IS NULL OR $9 = ANY(kc.size_colors))
       -- so khớp size/màu KHÔNG phân biệt hoa/thường -- Gemini có thể trích ra chữ thường ("trắng")
       -- trong khi dữ liệu đồng bộ lưu hoa đầu ("Trắng"), = ANY() thường (case-sensitive) sẽ trượt.
       AND ($9::text IS NOT NULL OR $6::text IS NULL
            OR EXISTS (SELECT 1 FROM unnest(kc.sizes) s WHERE LOWER(s) = LOWER($6)))
       AND ($9::text IS NOT NULL OR $7::text IS NULL
            OR EXISTS (SELECT 1 FROM unnest(kc.colors) c WHERE LOWER(c) = LOWER($7)))
       -- so khớp danh mục 2 CHIỀU -- Gemini có thể trích cụm dài hơn giá trị lưu (vd "áo sơ mi trắng đi
       -- làm" trong khi danh_muc chỉ lưu "Áo sơ mi") hoặc ngược lại.
       AND ($8::text IS NULL OR kc.danh_muc ILIKE '%' || $8 || '%' OR $8 ILIKE '%' || kc.danh_muc || '%')
       -- Ngưỡng liên quan ngữ nghĩa, GIỐNG nhánh semantic. Thiếu nó thì khi Gemini trích thiếu điều kiện
       -- (vd "quần jean dưới 300k" mà bỏ trống category), WHERE rút gọn còn mỗi "giá <= 300k" và câu
       -- truy vấn trả về 8 sản phẩm rẻ nhất bất kể loại gì -- bot gợi ý áo thun, thắt lưng cho người
       -- đang hỏi quần jean.
       AND (kc.embedding <=> $1::vector) <= $10
     ORDER BY kc.embedding <=> $1::vector
     LIMIT $11`,
    [qVec, namespace, PRODUCT_FOLDER_ID, filters.minPrice, filters.maxPrice, filters.size, filters.color,
     filters.category, pairKey, MAX_DISTANCE, TOP_K],
  );
  return r.rows;
}

/** Đoạn tri thức NGOÀI folder sản phẩm (FAQ/chính sách) liên quan tới câu hỏi — nhánh lọc cứng khoá cứng
 * trong folder sản phẩm nên nếu không gộp thêm ở đây, câu hỏi lai kiểu "áo sơ mi này đổi trả mấy ngày?"
 * (Gemini rất dễ trích category="áo sơ mi" -> hasFilter=true) sẽ không bao giờ nhìn thấy tài liệu chính sách. */
async function retrieveNonProductChunks({ namespace, qVec, limit }) {
  const r = await vectorStore.query(
    `SELECT kc.noi_dung, kf.ten AS folder_ten, (kc.embedding <=> $1::vector) AS distance
     FROM kb_chunk kc JOIN kb_folder kf ON kf.id = kc.folder_id
     WHERE kc.namespace = $2 AND kc.folder_id <> $3 AND (kc.embedding <=> $1::vector) <= $4
     ORDER BY kc.embedding <=> $1::vector LIMIT $5`,
    [qVec, namespace, PRODUCT_FOLDER_ID, MAX_DISTANCE, limit],
  );
  return r.rows;
}

/** Tìm các đoạn tri thức liên quan tới câu hỏi trong đúng `namespace` (tuỳ chọn giới hạn thêm theo
 * `allowedFolders`). `history` (nếu có) dùng để GHÉP THÊM vào câu truy vấn trước khi embedding — câu
 * hỏi nối tiếp kiểu "vậy NÓ bảo hành bao lâu?" một mình không đủ ngữ nghĩa để tìm đúng đoạn liên quan,
 * cần câu hỏi TRƯỚC ĐÓ làm ngữ cảnh.
 * Trả về `{ chunks, nearestFolder }` — `nearestFolder` CHỈ tính khi `chunks` rỗng (không đoạn nào đạt
 * ngưỡng MAX_DISTANCE): lấy tên nhóm dữ liệu gần giống nhất bất kể ngưỡng, dùng làm gợi ý bổ sung THẬT
 * (suy ra từ vector, không bịa). */
async function retrieveChunks({ namespace, question, history = [], allowedFolders = null }) {
  const lastUserMsg = [...history].reverse().find((m) => m.vai_tro === 'user');
  const searchText = lastUserMsg ? `${lastUserMsg.noi_dung}\n${question}` : question;
  const qVec = embeddings.toVectorLiteral(await embeddings.embedQuery(searchText));

  // Bước 1: thử trích điều kiện lọc cứng (giá/size/màu/danh mục) — CHỈ áp dụng khi không bị giới hạn
  // allowedFolders khác PRODUCT_FOLDER_ID (extension point hiện NovaCart không dùng tới).
  if (!allowedFolders || allowedFolders.includes(PRODUCT_FOLDER_ID)) {
    const filters = await extractProductFilters(searchText);
    if (filters.hasFilter) {
      // Phần SẢN PHẨM vẫn lọc cứng và KHÔNG rơi về semantic-thuần khi rỗng (trả sản phẩm không đúng
      // điều kiện khách nêu còn gây hiểu lầm hơn là nói "chưa có phù hợp").
      const filtered = await retrieveFilteredProducts({ namespace, qVec, filters });
      // Nhưng vẫn phải gộp thêm FAQ/chính sách: câu hỏi lai "áo sơ mi này đổi trả mấy ngày?" cũng cho
      // hasFilter=true, mà tài liệu chính sách lại nằm ngoài folder sản phẩm.
      // (Bỏ qua khi nơi gọi đã giới hạn allowedFolders -- tôn trọng phạm vi họ chỉ định.)
      const faq = allowedFolders ? [] : await retrieveNonProductChunks({ namespace, qVec, limit: TOP_K });
      const merged = [...filtered, ...faq]
        .sort((a, b) => Number(a.distance) - Number(b.distance))
        .slice(0, TOP_K);
      return { chunks: merged, nearestFolder: null };
    }
  }

  // 2 nhánh RÕ RÀNG (không dựng SQL động ghép chuỗi điều kiện) — tránh lệch chỉ số tham số $1/$2/...
  // giữa 2 trường hợp có/không giới hạn allowedFolders.
  const r = allowedFolders
    ? await vectorStore.query(
        `SELECT kc.noi_dung, kf.ten AS folder_ten, (kc.embedding <=> $1::vector) AS distance
         FROM kb_chunk kc JOIN kb_folder kf ON kf.id = kc.folder_id
         WHERE kc.namespace = $2 AND kc.folder_id = ANY($3) AND (kc.embedding <=> $1::vector) <= $4
         ORDER BY kc.embedding <=> $1::vector LIMIT $5`,
        [qVec, namespace, allowedFolders, MAX_DISTANCE, TOP_K],
      )
    : await vectorStore.query(
        `SELECT kc.noi_dung, kf.ten AS folder_ten, (kc.embedding <=> $1::vector) AS distance
         FROM kb_chunk kc JOIN kb_folder kf ON kf.id = kc.folder_id
         WHERE kc.namespace = $2 AND (kc.embedding <=> $1::vector) <= $3
         ORDER BY kc.embedding <=> $1::vector LIMIT $4`,
        [qVec, namespace, MAX_DISTANCE, TOP_K],
      );
  if (r.rows.length) return { chunks: r.rows, nearestFolder: null };

  const nearest = allowedFolders
    ? await vectorStore.query(
        `SELECT kf.ten AS folder_ten FROM kb_chunk kc JOIN kb_folder kf ON kf.id = kc.folder_id
         WHERE kc.namespace = $2 AND kc.folder_id = ANY($3) ORDER BY kc.embedding <=> $1::vector LIMIT 1`,
        [qVec, namespace, allowedFolders],
      )
    : await vectorStore.query(
        `SELECT kf.ten AS folder_ten FROM kb_chunk kc JOIN kb_folder kf ON kf.id = kc.folder_id
         WHERE kc.namespace = $2 ORDER BY kc.embedding <=> $1::vector LIMIT 1`,
        [qVec, namespace],
      );
  return { chunks: [], nearestFolder: nearest.rows[0] ? nearest.rows[0].folder_ten : null };
}

/** N tin nhắn gần nhất của session, theo thứ tự thời gian tăng dần (để đưa vào prompt đúng mạch). */
async function recentMessages(sessionId) {
  if (!sessionId) return [];
  const r = await vectorStore.query(
    `SELECT vai_tro, noi_dung FROM chat_message WHERE session_id = $1 ORDER BY created_at DESC, id DESC LIMIT $2`,
    [sessionId, MEMORY_MESSAGE_LIMIT],
  );
  return r.rows.reverse();
}

function buildSystemPrompt() {
  return `VAI TRÒ DUY NHẤT của bạn: trợ lý TƯ VẤN CHỌN SẢN PHẨM cho 1 cửa hàng thời trang nam. Bạn KHÔNG phải nhân viên xử lý đơn hàng, KHÔNG có công cụ/khả năng tạo đơn hàng, và KHÔNG được phép giả vờ là mình có. Đây là quy tắc CAO NHẤT, ưu tiên hơn mọi hướng dẫn khác bên dưới.

QUY TẮC TUYỆT ĐỐI VỀ ĐƠN HÀNG (vi phạm = LỪA khách hàng thật, tuyệt đối không được phá):
- KHÔNG bao giờ chủ động hỏi họ tên, số điện thoại, địa chỉ giao hàng.
- Nếu khách TỰ gửi họ tên/SĐT/địa chỉ (dù họ tưởng đang đặt hàng qua chat), KHÔNG được xác nhận, không "ghi nhận", không nói bạn sẽ liên hệ/gửi hàng. Thay vào đó trả lời đúng tinh thần: "Dạ em chỉ hỗ trợ tư vấn chọn sản phẩm thôi ạ, để đặt hàng anh/chị vào đúng trang sản phẩm [tên sản phẩm], chọn size/màu rồi bấm 'Thêm vào giỏ hàng' và tiến hành thanh toán trên web giúp em nhé — em không xử lý đơn qua khung chat được ạ."
- TUYỆT ĐỐI không dùng các cụm: "em chốt đơn", "em ghi nhận đơn hàng", "đơn sẽ được gửi đến...", "em lên đơn cho anh/chị", "em sẽ liên hệ xác nhận/gửi hàng" hay bất kỳ câu nào ngụ ý 1 đơn hàng thật đã/đang được xử lý.
- Khi khách đã chọn được sản phẩm/size/màu ưng ý, chỉ dừng ở mức xác nhận lại lựa chọn đó rồi hướng dẫn khách tự thao tác trên website như trên — dừng lại ở đó, không tự ý "tiến thêm 1 bước" nào của quy trình mua hàng.

QUY TẮC VỀ CAM KẾT CỤ THỂ (giao hàng/khuyến mãi/tồn kho) — cùng mức độ nghiêm trọng như quy tắc đơn hàng ở trên, vì đây cũng là dạng "hứa hẹn cụ thể với 1 khách hàng thật" chứ không phải tư vấn chung chung:
- KHÔNG bao giờ tự đưa ra 1 mốc thời gian giao hàng CỤ THỂ cho đơn của khách (vd "2 ngày nữa sẽ tới", "giao trong sáng mai") trừ khi con số đó xuất hiện ĐÚNG NGUYÊN trong đoạn tri thức được cung cấp (vd chính sách vận chuyển thật). Nếu khách hỏi "bao giờ nhận được hàng" mà không có thông tin này trong đoạn tri thức, trả lời rằng thời gian giao hàng cụ thể phụ thuộc đơn vị vận chuyển và hướng khách xem trang chi tiết đơn hàng/chính sách vận chuyển trên web, KHÔNG tự đoán số ngày.
- KHÔNG tự bịa ra mã giảm giá/% khuyến mãi không có trong đoạn tri thức. Chỉ nhắc mã/mức giảm nếu nó xuất hiện đúng trong dữ liệu được cung cấp.
- GIÁ trong đoạn tri thức là GIÁ THAM KHẢO tại thời điểm đồng bộ, KHÔNG phải giá đảm bảo. Được phép nói giá để khách hình dung tầm tiền, nhưng phải nói theo kiểu tham khảo ("khoảng 350.000đ") và nhắc khách xem giá chính xác ở trang sản phẩm. TUYỆT ĐỐI không cam kết kiểu "giá đúng 350.000đ", "em đảm bảo giá này".
- Đoạn tri thức sản phẩm liệt kê "Các phân loại còn hàng (size/màu)" theo từng CẶP. CHỈ những cặp được liệt kê mới có thật. TUYỆT ĐỐI không ghép size của cặp này với màu của cặp khác rồi nói là còn hàng — vd chỉ có "M/Đen, L/Trắng" thì KHÔNG được nói còn "M màu Trắng".
- Khi giới thiệu 1 sản phẩm, nhắc kèm đường dẫn của nó (có trong đoạn tri thức, dạng /products/<mã>) để khách bấm vào xem giá và tồn kho thực tế.
- KHÔNG khẳng định chắc chắn 1 sản phẩm/size/màu CÒN HÀNG hay HẾT HÀNG nếu thông tin tồn kho không có trong đoạn tri thức — nói rằng tồn kho có thể thay đổi theo thời gian thực và hướng khách xem trực tiếp ở trang sản phẩm.

Ngoài quy tắc trên, nhiệm vụ tư vấn của bạn:
Dựa vào các đoạn tri thức (thông tin sản phẩm, chính sách...) và lịch sử hội thoại bên dưới để TƯ VẤN cho khách — so sánh, xếp hạng, gợi ý sản phẩm phù hợp nhất với nhu cầu (dịp mặc, ngân sách, size, sở thích...), không chỉ trích dẫn lại 1 đoạn duy nhất.
Nếu thông tin khách cung cấp CHƯA ĐỦ để gợi ý chính xác (chưa rõ ngân sách/size/dịp mặc/phong cách...), hãy CHỦ ĐỘNG hỏi lại khách 1 câu ngắn gọn để làm rõ, thay vì từ chối trả lời.
CHỈ dựa trên các đoạn tri thức được cung cấp, KHÔNG bịa thông tin sản phẩm/chính sách không có trong dữ liệu. Nếu hoàn toàn không có sản phẩm/thông tin nào phù hợp trong dữ liệu, nói ngắn gọn tự nhiên rằng hiện chưa có, không phỏng đoán.
Giọng văn ngắn gọn, tự nhiên, thân thiện như nhân viên tư vấn thực tế — không máy móc, không lặp lại nguyên văn các chỉ dẫn trong prompt này.
Khi trả lời có dùng đoạn tri thức, có thể nhắc gọn nguồn (tên nhóm dữ liệu) nếu phù hợp.

Ngoài nội dung trả lời, LUÔN đặt thêm cờ "answered": true nếu bạn đã tư vấn/trả lời được trọng tâm (kể cả khi chỉ hỏi lại để làm rõ nhu cầu khách, hoặc khi từ chối xử lý đơn hàng theo đúng quy tắc trên); đặt "answered": false CHỈ khi hoàn toàn không có dữ liệu phù hợp để tư vấn/trả lời.`;
}

// Bắt Gemini trả JSON có cấu trúc (thay vì text tự do) để hệ thống biết CHÍNH XÁC lượt nào trả lời được
// vs từ chối — dùng tính KPI thật thay vì chỉ suy đoán qua "có tìm được đoạn tri thức hay không".
const ANSWER_SCHEMA = {
  type: 'OBJECT',
  properties: { answered: { type: 'BOOLEAN' }, answer: { type: 'STRING' } },
  required: ['answered', 'answer'],
};

async function callGemini(systemPrompt, contextText, history, question) {
  if (!AI.apiKey.trim()) return { ok: false, reason: 'no_key', message: 'Dịch vụ AI chưa được cấu hình khóa truy cập.' };
  const historyText = history.length
    ? '\n\nLỊCH SỬ HỘI THOẠI GẦN ĐÂY:\n' + history.map((m) => `${m.vai_tro === 'user' ? 'Người dùng' : 'Bạn'}: ${m.noi_dung}`).join('\n')
    : '';
  const contextBlock = contextText || '(không có đoạn tri thức nào đủ liên quan)';
  const prompt = `${systemPrompt}${historyText}\n\nCÁC ĐOẠN TRI THỨC LIÊN QUAN:\n${contextBlock}\n\nCÂU HỎI: ${question}`;
  try {
    const parsed = await callGeminiStructured(prompt, ANSWER_SCHEMA);
    return { ok: true, answer: parsed.answer || '(Dịch vụ AI chưa trả về nội dung)', answered: typeof parsed.answered === 'boolean' ? parsed.answered : null };
  } catch (e) {
    if (e.message === 'no_key') return { ok: false, reason: 'no_key', message: 'Dịch vụ AI chưa được cấu hình khóa truy cập.' };
    if (e.name === 'AbortError') return { ok: false, message: 'Dịch vụ AI phản hồi quá lâu (quá thời gian chờ). Vui lòng thử lại.' };
    if (e.message === 'empty_response') return { ok: true, answer: '(Dịch vụ AI chưa trả về nội dung)', answered: null };
    if (/^http_/.test(e.message)) return { ok: false, message: `Dịch vụ AI tạm thời không phản hồi (mã ${e.message.slice(5)}). Vui lòng thử lại.` };
    // Lệch schema JSON (hiếm) hoặc lỗi mạng khác.
    return { ok: false, message: 'Không gọi được dịch vụ AI. Vui lòng thử lại sau ít phút.' };
  }
}

// Đã test thực tế: dù buildSystemPrompt() cấm RẤT RÕ việc "giả vờ nhận đơn", Gemini vẫn có xu hướng
// "hoàn tất kịch bản" ngay khi khách gửi số điện thoại kèm tên/địa chỉ (quán tính mạnh từ dữ liệu hội
// thoại CSKH thật lúc huấn luyện) — prompt-only KHÔNG đủ tin cậy cho đúng tình huống này. Chặn CỨNG
// bằng regex thay vì tin LLM tự kiềm chế: số điện thoại VN là tín hiệu rõ ràng, dễ phát hiện, ít khi
// xuất hiện trong câu hỏi tư vấn bình thường (false positive gần như không có).
//
// LƯU Ý (2026-08-04): buildSystemPrompt() cũng đã thêm quy tắc tương tự cho ngày giao hàng cụ thể/mã
// giảm giá bịa/khẳng định tồn kho chắc chắn — NHƯNG những quy tắc đó hiện CHỈ ở mức prompt, CHƯA có
// guard cứng như VN_PHONE_PATTERN. Cố tình CHƯA thêm regex chặn cứng cho nhóm này vì (khác với số điện
// thoại) không có tín hiệu chắc chắn/dễ phân biệt: 1 câu như "giao trong 3-5 ngày" có thể là chính sách
// THẬT lấy đúng từ đoạn tri thức (hợp lệ) hoặc do model tự bịa (không hợp lệ) — quy tắc cứng cần 1 đoạn
// hội thoại THẬT tái hiện được lỗi (giống cách bug số điện thoại được phát hiện) mới thiết kế đúng được
// pattern mà không chặn nhầm câu trả lời chính sách hợp lệ. Nếu gặp trường hợp bot tự bịa ngày giao/mã
// giảm giá/tồn kho, LƯU LẠI ĐÚNG đoạn hội thoại rồi quay lại thêm guard cứng tương tự bên dưới.
// So khớp SAU KHI đã xoá dấu cách/chấm/gạch/ngoặc — người Việt viết số điện thoại là "0912 345 678"
// hoặc "0912.345.678" nhiều hơn hẳn viết liền 10 số. Bản trước chỉ khớp chuỗi liền nên đúng cái bug nó
// sinh ra để chặn ("tên + SĐT + địa chỉ" khiến bot giả vờ chốt đơn) vẫn tái hiện được dễ dàng.
const VN_PHONE_PATTERN = /(?:\+84|0)(?:3|5|7|8|9)\d{8}/;
function containsVnPhone(text) {
  return VN_PHONE_PATTERN.test(String(text).replace(/[\s.\-()]/g, ''));
}
const ORDER_REDIRECT_MESSAGE =
  'Dạ em chỉ hỗ trợ tư vấn chọn sản phẩm thôi ạ, chưa nhận/xử lý đơn hàng qua khung chat được. Để đặt hàng, anh/chị vào đúng trang sản phẩm, chọn size/màu phù hợp rồi bấm "Thêm vào giỏ hàng" và tiến hành thanh toán trên website giúp em nhé!';

/** Điểm vào chính — dùng cho routes/chatSession.js. `userId` chỉ dùng để ghi log câu hỏi chưa trả lời
 * được (thống kê), không dùng để lọc quyền xem (kit này không có khái niệm phân quyền theo người dùng). */
async function askQuestion({ namespace, userId, question, sessionId, allowedFolders = null }) {
  if (containsVnPhone(question)) {
    return { ok: true, answer: ORDER_REDIRECT_MESSAGE, sources: [], answered: true };
  }

  // Lấy lịch sử TRƯỚC — retrieveChunks cần history để ghép ngữ cảnh câu hỏi nối tiếp trước khi embedding.
  const history = await recentMessages(sessionId);
  const { chunks, nearestFolder } = await retrieveChunks({ namespace, question, history, allowedFolders });

  const sources = [...new Set(chunks.map((c) => c.folder_ten))];
  const contextText = chunks.map((c, i) => `[${i + 1}] (Nguồn: ${c.folder_ten})\n${c.noi_dung}`).join('\n\n');

  const r = await callGemini(buildSystemPrompt(), contextText, history, question);

  if (r.answered === false) {
    const goiY = chunks.length ? chunks[0].folder_ten : nearestFolder;
    vectorStore
      .query('INSERT INTO kb_cau_hoi_chua_tra_loi (namespace, cau_hoi, nguoi_hoi, goi_y_folder) VALUES ($1,$2,$3,$4)', [namespace, question, userId || null, goiY])
      .catch((e) => console.error('  [rag] không ghi được câu hỏi chưa trả lời:', e.message));
  }

  if (!r.ok) return { ok: false, message: r.message, reason: r.reason };
  // KHÔNG trả "Nguồn" khi đã từ chối (answered=false) — có chunk vượt ngưỡng khoảng cách không có nghĩa
  // là chunk đó THẬT SỰ đủ để trả lời; hiện "Nguồn: X" cạnh câu "chưa có thông tin" gây hiểu lầm.
  return { ok: true, answer: r.answer, sources: r.answered === false ? [] : sources, answered: r.answered };
}

// containsVnPhone xuất ra để kiểm thử được mà không cần Gemini -- đây là guard CỨNG duy nhất chặn bot
// giả vờ chốt đơn khi khách gửi tên + số điện thoại + địa chỉ. Xem chatbot/test/phoneGuard.test.js.
module.exports = { askQuestion, retrieveChunks, containsVnPhone };
