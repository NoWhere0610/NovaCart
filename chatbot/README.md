# RAG Chatbot Kit

Dịch vụ tái dùng: kho tri thức (upload tài liệu → chia đoạn → nhúng vector) + hỏi-đáp có nhớ ngữ cảnh phiên chat. Tách lõi RAG đã chạy ổn định trong dự án CoreX (apsp-ioc-react) ra thành dịch vụ độc lập — dùng cho các dự án khác cần xử lý tài liệu dài vượt giới hạn context window của AI native (vd chứng từ/hợp đồng hàng chục trang PDF).

**Không** đi kèm: giao diện React, hệ đăng nhập/vai trò, kết nối API đa hệ thống ngoài (Gitiho/BSC/Mobiwork...). Đây là 1 dịch vụ backend thuần, gọi qua REST API — dự án chủ quản tự xây giao diện theo stack của mình.

## Chạy thử

```bash
cp .env.example .env   # điền GEMINI_API_KEY + đổi API_KEY
docker compose up -d --build
```

Mở `http://127.0.0.1:3200/demo.html` — trang test nhanh (không cần build gì thêm).

## Xác thực

Mọi request tới `/api/kb/*` và `/api/chat/*` cần header:

```
X-API-Key: <giá trị API_KEY trong .env>
```

Không có khái niệm đăng nhập/vai trò — dịch vụ nội bộ, chỉ 1 hệ thống chủ quản gọi vào (server-to-server). Người dùng cuối do dự án chủ quản tự định danh qua trường `userId` (không xác thực gì thêm, dự án chủ quản tự chịu trách nhiệm định danh đúng) — dùng để nhớ đúng lịch sử chat theo từng người.

## Khái niệm `namespace`

Mỗi dữ liệu/tài liệu/phiên chat thuộc 1 `namespace` (chuỗi tự do, tự đặt) — dùng để tách phạm vi nếu 1 kit phục vụ nhiều "khu vực" dữ liệu khác nhau trong cùng 1 dự án (vd `noi-bo` vs `khach-hang`). Không bắt buộc phải dùng nhiều namespace — 1 dự án đơn giản chỉ cần 1 namespace cố định (vd `"default"`).

## API chính

**Kho tri thức** (`/api/kb`):
- `GET /folders?namespace=...` — danh sách nhóm + tài liệu.
- `POST /folders` — tạo/cập nhật nhóm `{ namespace, id, ten, moTa? }`.
- `DELETE /folders/:id`
- `POST /upload` (multipart) — trường `namespace`, `folderId`, `nguoiTai?`, file `file`.
- `POST /documents/:id/reindex` — lập lại chỉ mục (bỏ qua nếu file không đổi, so checksum).
- `GET /documents/:id/download` / `GET /documents/:id/content`
- `DELETE /documents/:id`

**Chat** (`/api/chat`) — mọi request cần `userId` (body hoặc query):
- `POST /ask` — `{ namespace, userId, sessionId?, question }` → tạo phiên mới nếu chưa có `sessionId`, trả `{ answer, sources, sessionId }`. Gọi lại với đúng `sessionId` để tiếp tục hỏi trong CÙNG ngữ cảnh (nhớ tối đa 8 lượt gần nhất).
- `GET /sessions?namespace=...` — danh sách phiên của 1 `userId`.
- `GET /sessions/:id/messages`
- `DELETE /sessions/:id`
- `PATCH /messages/:id/feedback` — `{ danhGia: 1 | -1 | null }`.

## Đồng bộ dữ liệu từ hệ thống nội bộ của dự án bạn

Nếu ngoài tài liệu tải tay, bạn còn muốn RAG trả lời được cả dữ liệu luôn thay đổi trong chính hệ thống của mình (vd danh sách sản phẩm) — xem `examples/internal-sync.example.js`: copy ra, điền 2 chỗ `TODO`, tự chạy định kỳ (cron/node-cron tuỳ ý). Đây KHÔNG phải hệ connector đa xác thực như CoreX gốc — chỉ là 1 script gọi thẳng nguồn nội bộ CỦA BẠN, hard-code, không cần giao diện cấu hình.

## Giới hạn đã lược bớt so với bản gốc CoreX (cân nhắc tự bổ sung nếu dự án cần)

- **Không phân quyền theo người dùng** khi truy hồi RAG — mọi tài liệu trong 1 `namespace` đều được tìm khi hỏi. Cần lọc theo người dùng (vd chỉ thấy tài liệu phòng ban mình) → tự viết logic quyết định `allowedFolders` (mảng id folder) rồi truyền vào `POST /ask`, xem chú thích trong `lib/ragQuery.js`.
- **Không kết nối API bên ngoài định kỳ** (kiểu Gitiho/BSC/Mobiwork) — chỉ có upload tay + script đồng bộ nội bộ tự viết (xem trên).
- **Không có báo cáo KPI vận hành** (mức độ hài lòng, chủ đề hỏi nhiều...) — có thể tự truy vấn trực tiếp từ Postgres (`chat_message.danh_gia`, `chat_message.tra_loi_duoc`, `kb_cau_hoi_chua_tra_loi`) nếu cần.
