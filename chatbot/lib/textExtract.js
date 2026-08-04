/* ============================================================================
   TRÍCH XUẤT TEXT cho pipeline ingest kho tri thức — PDF/Word/Excel -> danh
   sách đoạn (chunk) thô, CHƯA embedding. Port từ apsp-ioc-react/lib/textExtract.js
   (2026-08-04), giữ nguyên logic.
   File Excel dạng FAQ (5 cột: Tình huống/Phản ánh khách/Nguyên nhân/Cách kiểm
   tra/Cách khắc phục) được nhận diện qua đúng tiêu đề cột và chia theo QUY TẮC
   RIÊNG (1 dòng = 1 chunk) — không cắt cơ học theo độ dài như PDF/Word thường.
   ============================================================================ */
const XLSX = require('xlsx');

/** Cắt văn bản dài thành các đoạn ~700 ký tự (gần đúng độ dài token cho tiếng Việt), overlap ~15% để
 * không cắt đứt ngữ cảnh giữa 2 đoạn liền nhau. */
function chunkPlainText(text, { size = 700, overlapRatio = 0.15 } = {}) {
  const clean = String(text || '').replace(/\r\n/g, '\n').replace(/[ \t]+\n/g, '\n').trim();
  if (!clean) return [];
  const overlap = Math.round(size * overlapRatio);
  const out = [];
  let i = 0;
  while (i < clean.length) {
    const end = Math.min(i + size, clean.length);
    // tránh cắt giữa từ — lùi về khoảng trắng gần nhất nếu chưa tới cuối văn bản
    let cut = end;
    if (end < clean.length) {
      const lastSpace = clean.lastIndexOf(' ', end);
      if (lastSpace > i + size * 0.5) cut = lastSpace;
    }
    const piece = clean.slice(i, cut).trim();
    if (piece) out.push(piece);
    if (cut >= clean.length) break;
    i = cut - overlap;
    if (i < 0) i = cut;
  }
  return out;
}

async function extractPdf(buffer) {
  const pdfParse = require('pdf-parse');
  const r = await pdfParse(buffer);
  return chunkPlainText(r.text);
}

async function extractWord(buffer) {
  const mammoth = require('mammoth');
  const r = await mammoth.extractRawText({ buffer });
  return chunkPlainText(r.value);
}

const FAQ_HEADER_HINTS = ['tình huống', 'phản ánh', 'nguyên nhân', 'cách kiểm tra', 'cách khắc phục'];

function looksLikeFaqSheet(headerRow) {
  const cells = (headerRow || []).map((c) => String(c || '').trim().toLowerCase());
  return FAQ_HEADER_HINTS.every((hint) => cells.some((c) => c.includes(hint)));
}

/** Excel FAQ: mỗi sheet = 1 nhóm, mỗi dòng dữ liệu (sau header) = 1 sự cố -> 1 chunk, ghép đúng 5 cột
 * theo template cố định. */
function extractFaqRow(sheetName, headerRow, row) {
  const idx = (hint) => headerRow.findIndex((c) => String(c || '').trim().toLowerCase().includes(hint));
  const iTinhHuong = idx('tình huống');
  const iPhanAnh = idx('phản ánh');
  const iNguyenNhan = idx('nguyên nhân');
  const iKiemTra = idx('cách kiểm tra');
  const iKhacPhuc = idx('cách khắc phục');
  const cell = (i) => String((i >= 0 ? row[i] : '') || '').trim();
  const tinhHuong = cell(iTinhHuong);
  if (!tinhHuong) return null;
  return [
    `[Nhóm: ${sheetName}] ${tinhHuong}`,
    `Phản ánh của khách: ${cell(iPhanAnh)}`,
    `Nguyên nhân: ${cell(iNguyenNhan)}`,
    `Cách kiểm tra: ${cell(iKiemTra)}`,
    `Cách khắc phục: ${cell(iKhacPhuc)}`,
  ].join('\n');
}

/** Excel thường (không khớp mẫu FAQ): mỗi dòng dữ liệu ghép thành 1 chunk dạng "cột: giá trị", theo
 * đúng tên cột ở header — vẫn là 1 đơn vị dữ liệu có nghĩa (1 dòng bảng), không cắt cơ học theo độ dài. */
function extractGenericRow(sheetName, headerRow, row) {
  const parts = headerRow
    .map((h, i) => [String(h || '').trim(), String((row[i] == null ? '' : row[i])).trim()])
    .filter(([h, v]) => h && v);
  if (!parts.length) return null;
  return `[${sheetName}] ` + parts.map(([h, v]) => `${h}: ${v}`).join(' | ');
}

function extractExcel(buffer) {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const chunks = [];
  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, defval: '' });
    if (!rows.length) continue;
    const header = rows[0];
    const isFaq = looksLikeFaqSheet(header);
    for (let r = 1; r < rows.length; r++) {
      const chunk = isFaq ? extractFaqRow(sheetName, header, rows[r]) : extractGenericRow(sheetName, header, rows[r]);
      if (chunk) chunks.push(chunk);
    }
  }
  return chunks;
}

/** Điểm vào chung — trả về mảng chunk (string[]) THEO ĐÚNG LOẠI file, chưa embedding. */
async function extractChunks(buffer, ten_file) {
  const ext = (ten_file.split('.').pop() || '').toLowerCase();
  if (ext === 'pdf') return extractPdf(buffer);
  if (ext === 'doc' || ext === 'docx') return extractWord(buffer);
  if (ext === 'xls' || ext === 'xlsx') return extractExcel(buffer);
  if (ext === 'txt' || ext === 'md') return chunkPlainText(buffer.toString('utf8'));
  throw new Error(`Định dạng ".${ext}" chưa được hỗ trợ trích xuất (chỉ PDF/DOCX/XLSX/TXT).`);
}

module.exports = { extractChunks, chunkPlainText };
