/* ============================================================================
   BỘ ĐO CHẤT LƯỢNG LỌC SẢN PHẨM — 4 chỉ số, câu hỏi sinh bằng máy, không ai chấm tay.

   ══════ VÌ SAO KHÔNG ĐO top-1 / top-5 ══════
   Cách đo thông dụng cho RAG là xếp hạng: "đoạn đúng có đứng đầu bảng không". Cách đó hợp với kho tài
   liệu, nơi mỗi câu hỏi có ĐÚNG MỘT đoạn trả lời. Kho của NovaCart thì khác: hỏi "áo sơ mi trắng dưới
   300k" có thể có 12 sản phẩm cùng đúng -- không tồn tại "đáp án thứ nhất".

   Quan trọng hơn: đã đo được các đoạn sản phẩm chỉ cách nhau 0,14-0,19 (chúng dùng chung một khuôn văn
   bản), tức trong bán kính đó thứ hạng vector là NHIỄU -- chênh lệch giữa hạng 1 và hạng 20 nhỏ hơn sai
   số của chính mô hình nhúng. Đo top-1 sẽ ra một con số ổn định trông rất đẹp mà không phản ứng với bất
   kỳ thay đổi nào trong mã. Đó là định nghĩa của một phép đo vô nghĩa.

   Nên bộ này đo đúng khâu ĐANG QUYẾT ĐỊNH kết quả: trích điều kiện + lọc SQL.

     M1  Độ đúng của bước trích điều kiện (extractProductFilters), chấm theo từng trường
     M2  Precision -- mọi sản phẩm trả về có thật sự thoả điều kiện không (bot nói sai với khách)
     M3  Recall    -- có bỏ sót sản phẩm đúng điều kiện không (bot liệt kê thiếu)
     M4  Tỉ lệ cặp size/màu MA -- phải bằng 0 tuyệt đối

   ══════ CHỐNG BỘ ĐO TỰ CHO ĐIỂM ══════
   Nếu đáp án đúng suy được từ chính chuỗi ký tự trong câu hỏi thì bộ đo đang đo ILIKE, không đo hệ
   thống. Bốn chốt chặn, tất cả bằng máy:
     1. Không dùng TÊN sản phẩm để hỏi; và loại mọi câu còn chép >= 3 từ liên tiếp của tên/mã/danh mục.
     2. Chỉ lấy bộ điều kiện có >= 3 sản phẩm thoả -- bộ có nghiệm duy nhất thì câu hỏi tự nó là khoá
        định danh, precision/recall luôn 100% mà chẳng đo được gì.
     3. Giá luôn diễn đạt bằng KHẨU NGỮ ("3 xị", "dưới nửa triệu"), cấm số thô -- số thô là số học,
        không phải ngôn ngữ.
     4. Có nhóm câu ÂM TÍNH (điều kiện không sản phẩm nào thoả). Bộ đo không có nhóm này thì mặc định
        là bộ đo tự cho điểm.

   Chi phí: 2 lượt gọi Gemini cho mỗi câu hỏi (nhúng + trích điều kiện). Mặc định 20 câu = ~40 lượt.
   Chạy 1-2 lần trước khi bảo vệ, không chạy thường xuyên.

       node scripts/do-loc-san-pham.js
       node scripts/do-loc-san-pham.js --so 30
   ============================================================================ */
const { chay, NAMESPACE } = require('./tienKiem');
const vectorStore = require('../lib/vectorStore');
const ragQuery = require('../lib/ragQuery');

const SO_CAU = (() => {
  const i = process.argv.indexOf('--so');
  return i >= 0 && process.argv[i + 1] ? Number(process.argv[i + 1]) : 20;
})();

/* ---------------- Cách gọi của khách, KHÔNG dùng nguyên văn giá trị trong dữ liệu ----------------
   Chỉ giữ những cách gọi mà một người bán hàng thật cũng ánh xạ được về ĐÚNG MỘT danh mục. Đã CỐ Ý bỏ
   các cách nói mơ hồ từng dùng ở bản đầu ("quần vải mềm đi chơi" -> Quần tây hay Quần kaki đều hợp lý;
   "áo cổ trụ" -> Áo polo hay Áo sơ mi đều hợp lý; "áo ba lỗ mặc trong" -> model trả về trống). Giữ
   chúng lại thì con số M1 đo cách hỏi của bộ đo, không đo hệ thống -- và một phép đo như vậy không giúp
   quyết định gì.

   HẠN CHẾ ĐÃ BIẾT: bộ lọc chống chép định danh dùng n-gram >= 3 từ, nên danh mục chỉ 2 tiếng ("Áo lót",
   "Blazer") không được nó bảo vệ. Với các danh mục đó phải tự chọn từ đồng nghĩa, không dựa vào bộ lọc. */
const CACH_GOI = {
  'Áo sơ mi': ['áo có cổ đi làm', 'áo bỏ trong quần'],
  'Áo thun': ['áo phông', 'áo cộc tay'],
  'Áo polo': ['áo thun có cổ'],
  'Áo khoác': ['áo choàng ngoài'],
  'Quần jean': ['quần bò', 'quần denim'],
  'Quần tây': ['quần âu đi làm', 'quần vải công sở'],
  'Quần short': ['quần cộc', 'quần đùi'],
  'Quần boxer': ['quần chíp nam'],
  'Bộ suit': ['bộ vest nam'],
  'Áo dài': ['áo dài truyền thống nam'],
};

const GIA_KHAU_NGU = {
  300000: ['dưới 3 xị', 'dưới ba trăm', 'tầm ba trăm đổ lại'],
  500000: ['dưới nửa triệu', 'dưới 5 xị'],
  1000000: ['dưới 1 củ', 'dưới một triệu'],
};

const bocNgauNhien = (xs) => xs[Math.floor(Math.random() * xs.length)];

/* ---------------- Chốt chặn 1: loại câu hỏi còn chép định danh sản phẩm ----------------
   Bê nguyên bộ lọc n-gram >= 3 của dự án anh em (APSP), chỉ đổi đối tượng so từ "tiêu đề mục" sang
   3 nguồn định danh của sản phẩm. Đây là chốt bằng MÁY, không dựa vào việc người viết bản mẫu có cẩn
   thận hay không. */
function chepDinhDanh(hoi, ...nguonDinhDanh) {
  const chuan = (s) => String(s || '').toLowerCase().normalize('NFC')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean);
  const h = chuan(hoi).join(' ');
  for (const nguon of nguonDinhDanh) {
    const t = chuan(nguon);
    for (let i = 0; i + 3 <= t.length; i++) {
      if (h.includes(t.slice(i, i + 3).join(' '))) return true;
    }
  }
  return false;
}

/* ---------------- Sinh bộ điều kiện + đáp án chuẩn, thẳng từ kho tri thức ----------------
   Đáp án nằm trong CƠ SỞ DỮ LIỆU, tách rời hoàn toàn khỏi văn bản đem đi nhúng -- không ai soạn tay,
   và không có đường nào để câu hỏi "rò rỉ" đáp án. */
async function sinhBoDieuKien(soCau) {
  // Nhóm 1: danh mục + cặp size/màu, chỉ lấy bộ có >= 3 sản phẩm (chốt chặn 2).
  const r1 = await vectorStore.query(
    `SELECT danh_muc, split_part(sc, '|', 1) AS size, split_part(sc, '|', 2) AS mau,
            array_agg(DISTINCT SUBSTRING(noi_dung FROM 'Mã sản phẩm: (\\S+)')) AS dap_an
       FROM kb_chunk, unnest(size_colors) AS sc
      WHERE namespace = $1 AND folder_id = 'products'
      GROUP BY 1, 2, 3
     HAVING COUNT(DISTINCT SUBSTRING(noi_dung FROM 'Mã sản phẩm: (\\S+)')) >= 3
      ORDER BY random() LIMIT $2`,
    [NAMESPACE, Math.ceil(soCau * 0.45)],
  );

  // Nhóm 2: danh mục + trần giá (khẩu ngữ).
  const r2 = await vectorStore.query(
    `SELECT danh_muc, tran,
            array_agg(SUBSTRING(noi_dung FROM 'Mã sản phẩm: (\\S+)')) AS dap_an
       FROM kb_chunk, (VALUES (300000), (500000), (1000000)) AS t(tran)
      WHERE namespace = $1 AND folder_id = 'products' AND gia <= tran
      GROUP BY 1, 2
     HAVING COUNT(*) >= 3
      ORDER BY random() LIMIT $2`,
    [NAMESPACE, Math.ceil(soCau * 0.4)],
  );

  // Nhóm 3 (chốt chặn 4): câu ÂM TÍNH -- điều kiện KHÔNG sản phẩm nào thoả.
  const r3 = await vectorStore.query(
    `SELECT danh_muc, split_part(sc, '|', 1) AS size, split_part(sc, '|', 2) AS mau
       FROM kb_chunk c, unnest(ARRAY['4xl|hồng', '3xl|cam', 'xs|vàng']) AS sc
      WHERE c.namespace = $1 AND c.folder_id = 'products'
        AND NOT (sc = ANY(c.size_colors))
      GROUP BY 1, 2, 3
     HAVING COUNT(*) = (SELECT COUNT(*) FROM kb_chunk k
                         WHERE k.namespace = $1 AND k.folder_id = 'products' AND k.danh_muc = c.danh_muc)
      ORDER BY random() LIMIT $2`,
    [NAMESPACE, Math.max(1, Math.round(soCau * 0.15))],
  );

  const ra = [];
  for (const x of r1.rows) {
    const goi = CACH_GOI[x.danh_muc];
    if (!goi) continue;
    ra.push({
      loai: 'size+màu',
      hoi: `Shop còn ${bocNgauNhien(goi)} nào size ${x.size.toUpperCase()} màu ${x.mau} không ạ?`,
      dieuKien: { category: x.danh_muc, size: x.size, color: x.mau, maxPrice: null },
      dapAn: x.dap_an,
    });
  }
  for (const x of r2.rows) {
    const goi = CACH_GOI[x.danh_muc];
    const gia = GIA_KHAU_NGU[x.tran];
    if (!goi || !gia) continue;
    ra.push({
      loai: 'giá',
      hoi: `Mình tìm ${bocNgauNhien(goi)} ${bocNgauNhien(gia)}`,
      dieuKien: { category: x.danh_muc, size: null, color: null, maxPrice: Number(x.tran) },
      dapAn: x.dap_an,
    });
  }
  for (const x of r3.rows) {
    const goi = CACH_GOI[x.danh_muc];
    if (!goi) continue;
    ra.push({
      loai: 'âm tính',
      hoi: `Shop có ${bocNgauNhien(goi)} size ${x.size.toUpperCase()} màu ${x.mau} không?`,
      dieuKien: { category: x.danh_muc, size: x.size, color: x.mau, maxPrice: null },
      dapAn: [],
    });
  }

  // Chốt chặn 1 + 3, áp dụng bằng máy sau khi đã sinh.
  const loaiChep = [];
  const loaiSoTho = [];
  const sach = ra.filter((c) => {
    if (chepDinhDanh(c.hoi, c.dieuKien.category)) { loaiChep.push(c.hoi); return false; }
    if (/\d{4,}/.test(c.hoi)) { loaiSoTho.push(c.hoi); return false; }
    return true;
  });
  return { cau: sach.sort(() => Math.random() - 0.5).slice(0, soCau), loaiChep, loaiSoTho };
}

const maSanPham = (s) => {
  const m = String(s).match(/Mã sản phẩm: (\S+)/);
  return m ? m[1] : null;
};

/** So 2 chiều như chính câu SQL đang làm -- Gemini có thể trích cụm dài/ngắn hơn giá trị lưu. */
function khopDanhMuc(trichRa, that) {
  if (!trichRa) return false;
  const a = String(trichRa).toLowerCase();
  const b = String(that).toLowerCase();
  return a.includes(b) || b.includes(a);
}

chay('Bộ đo chất lượng lọc sản phẩm (M1-M4)', async () => {
  const { cau, loaiChep, loaiSoTho } = await sinhBoDieuKien(SO_CAU);
  console.log(`\n  Sinh ${cau.length} câu hỏi từ cơ sở dữ liệu`
    + ` (loại ${loaiChep.length} câu chép định danh, ${loaiSoTho.length} câu chứa giá viết thô)`);
  console.log(`  Chi phí: ~${cau.length * 2} lượt gọi Gemini\n`);

  const dem = {
    m1DanhMuc: 0, m1Size: 0, m1Mau: 0, m1Gia: 0, m1CoLoc: 0,
    tongPrecision: 0, tongRecall: 0, soCauCoDapAn: 0,
    capMa: 0, tongMaKiemCap: 0,
    amTinhDung: 0, soAmTinh: 0,
  };

  // Giãn cách giữa các câu: bộ đo bắn liên tục sẽ tự đốt hạn mức theo PHÚT của khoá Gemini rồi nhận
  // 429, và lượt trích lọc thất bại bị NUỐT LẶNG (trả hasFilter=false) -- tức bộ đo sẽ báo chất lượng
  // thấp vì lỗi của chính nó. Đã gặp thật ở lần chạy đầu: 3/20 câu dính 429.
  const nghi = (ms) => new Promise((r) => setTimeout(r, ms));

  for (const c of cau) {
    await nghi(Number(process.env.DO_LOC_GIAN_CACH_MS ?? 4000));
    const kq = await ragQuery.retrieveChunks({ namespace: NAMESPACE, question: c.hoi });
    const f = kq.filters || {};
    const traVe = [...new Set(kq.chunks.map((x) => maSanPham(x.noi_dung)).filter(Boolean))];

    // ----- M1: chấm bước trích điều kiện, từng trường -----
    if (f.hasFilter) dem.m1CoLoc++;
    if (khopDanhMuc(f.category, c.dieuKien.category)) dem.m1DanhMuc++;
    if (!c.dieuKien.size || String(f.size || '').toLowerCase() === c.dieuKien.size) dem.m1Size++;
    if (!c.dieuKien.color || String(f.color || '').toLowerCase() === c.dieuKien.color) dem.m1Mau++;
    if (!c.dieuKien.maxPrice || Number(f.maxPrice) === c.dieuKien.maxPrice) dem.m1Gia++;

    // ----- M2/M3: precision & recall trên tập -----
    if (c.dapAn.length) {
      dem.soCauCoDapAn++;
      const dung = new Set(c.dapAn);
      const trung = traVe.filter((x) => dung.has(x)).length;
      dem.tongPrecision += traVe.length ? trung / traVe.length : 0;
      dem.tongRecall += trung / dung.size;
    } else {
      dem.soAmTinh++;
      if (traVe.length === 0) dem.amTinhDung++;
    }

    // ----- M4: cặp size/màu ma -----
    if (c.dieuKien.size && c.dieuKien.color && traVe.length) {
      const cap = `${c.dieuKien.size}|${c.dieuKien.color}`;
      const r = await vectorStore.query(
        `SELECT SUBSTRING(noi_dung FROM 'Mã sản phẩm: (\\S+)') AS ma, size_colors
           FROM kb_chunk WHERE namespace = $1 AND folder_id = 'products'
            AND SUBSTRING(noi_dung FROM 'Mã sản phẩm: (\\S+)') = ANY($2)`,
        [NAMESPACE, traVe],
      );
      dem.tongMaKiemCap += r.rows.length;
      dem.capMa += r.rows.filter((x) => !(x.size_colors || []).includes(cap)).length;
    }
  }

  const pc = (x) => `${(x * 100).toFixed(0)}%`;
  const n = cau.length;
  const precision = dem.soCauCoDapAn ? dem.tongPrecision / dem.soCauCoDapAn : 1;
  const recall = dem.soCauCoDapAn ? dem.tongRecall / dem.soCauCoDapAn : 1;

  console.log('  ── M1: độ đúng của bước trích điều kiện ──');
  console.log(`     nhận ra có điều kiện lọc : ${pc(dem.m1CoLoc / n)}`);
  console.log(`     trích đúng danh mục      : ${pc(dem.m1DanhMuc / n)}`);
  console.log(`     trích đúng size          : ${pc(dem.m1Size / n)}`);
  console.log(`     trích đúng màu           : ${pc(dem.m1Mau / n)}`);
  console.log(`     trích đúng giá (khẩu ngữ): ${pc(dem.m1Gia / n)}`);
  console.log('');
  console.log('  ── M2/M3: chất lượng tập trả về ──');
  console.log(`     precision (không trả sản phẩm sai điều kiện): ${pc(precision)}`);
  console.log(`     recall    (không bỏ sót sản phẩm đúng)      : ${pc(recall)}`);
  console.log('');
  console.log('  ── M4: cặp size/màu ma ──');
  console.log(`     ${dem.capMa}/${dem.tongMaKiemCap} sản phẩm trả về KHÔNG thật sự còn cặp được hỏi`
    + ` (phải bằng 0)`);
  console.log('');
  console.log('  ── Nhóm câu âm tính (điều kiện không sản phẩm nào thoả) ──');
  console.log(`     trả rỗng đúng: ${dem.amTinhDung}/${dem.soAmTinh}`);
  console.log('');

  // Chỉ M4 là điều kiện ĐẠT/TRƯỢT tuyệt đối -- nó là lỗi bot nói sai với khách hàng thật.
  // M1/M2/M3 là số liệu để báo cáo, không có ngưỡng "đúng" phổ quát nào để phán.
  const dat = dem.capMa === 0;
  console.log(dat
    ? '  M4 = 0 -> không có tổ hợp size/màu nào bị bịa ra.'
    : '  M4 > 0 -> BOT ĐANG NÓI SAI VỚI KHÁCH về phân loại còn hàng.');
  return dat;
});
