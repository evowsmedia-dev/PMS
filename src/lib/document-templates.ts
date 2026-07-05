export type DocTemplateId =
  | "blank"
  | "rfid-process-flow"
  | "functional-specification"
  | "change-request"
  | "test-plan-case";

interface DocTemplate {
  label: string;
  content: string;
}

export const DOC_TEMPLATES: Record<DocTemplateId, DocTemplate> = {
  blank: {
    label: "Trống",
    content: "",
  },
  "rfid-process-flow": {
    label: "Sơ đồ quy trình nghiệp vụ (RFID)",
    content: `## Mô tả nghiệp vụ

_Mô tả ngắn gọn mục đích và phạm vi của quy trình..._

## Mô tả chi tiết các bước

| TT | Bước | Mô tả nghiệp vụ | Thao tác cụ thể | Lưu ý kỹ thuật |
| --- | --- | --- | --- | --- |
| 1 | | | | |
| 2 | | | | |
| 3 | | | | |
| ✓ | Kết thúc | | | |
`,
  },
  "functional-specification": {
    label: "Functional Specification Document",
    content: `## 1. Tổng quan tài liệu

| Hạng mục | Nội dung |
|---|---|
| **Mục đích** | Mô tả các chức năng chính của hệ thống để phục vụ phát triển, kiểm thử và bàn giao. |
| **Phạm vi** | [Liệt kê module/chức năng thuộc phạm vi tài liệu] |
| **Ngoài phạm vi** | [Liệt kê nội dung không xử lý trong phase này, nếu có] |
| **Người đọc chính** | PO/BA, PM, Dev, Tester, Tech Lead |
| **Tài liệu liên quan** | BRD, Figma, API Docs, Technical Design, UAT Checklist |
| **Ghi chú** | Tài liệu này ưu tiên ngắn gọn, tập trung vào flow, rule, field, permission, exception và acceptance criteria. |

---

## 2. Thuật ngữ & vai trò

| Nhóm | Giá trị | Mô tả |
|---|---|---|
| **Thuật ngữ** | CRUD | Create, Read, Update, Delete |
| **Thuật ngữ** | JWT | JSON Web Token |
| **Thuật ngữ** | UAT | User Acceptance Testing |
| **Role** | Admin | Quản trị toàn hệ thống |
| **Role** | PO/BA | Quản lý nghiệp vụ, review yêu cầu |
| **Role** | Manager | Quản lý module/dữ liệu được phân quyền |
| **Role** | User | Người dùng thông thường |
| **Role** | Guest | Người dùng chưa đăng nhập, nếu có |

---

## 3. Feature Map

> Bảng này thay cho phần “Yêu cầu chức năng” và “Use cases” riêng lẻ.
> Mục tiêu là nhìn một lần thấy được: module nào có chức năng gì, ai dùng, màn hình nào liên quan, kết quả mong muốn là gì.

| Module | Feature ID | Feature | Actor | Mục đích | Màn hình liên quan | Kết quả mong muốn |
|---|---|---|---|---|---|---|
| Quản lý người dùng | UC01 | Đăng nhập | User | Cho phép người dùng truy cập hệ thống bằng email/mật khẩu | Login | User đăng nhập thành công và vào dashboard |
| Quản lý người dùng | UC02 | Quản lý hồ sơ | User | Cho phép user xem/cập nhật thông tin cá nhân | Profile | Thông tin cá nhân được cập nhật |
| Quản lý dự án | UC03 | Tạo dự án mới | Admin / PO | Tạo dự án với thông tin cơ bản và danh sách thành viên | Project List / Create Project | Dự án mới được tạo với mã duy nhất |
| Quản lý dự án | UC04 | Xem danh sách dự án | All Users | Hiển thị danh sách dự án, hỗ trợ lọc/sắp xếp | Project List | User xem được danh sách dự án theo quyền |
| Quản lý tài liệu | UC05 | Tải lên tài liệu | All Users | Upload file và gán vào dự án cụ thể | Document List / Upload Popup | File được lưu và liên kết với dự án |
| Quản lý tài liệu | UC06 | Xem nội dung tài liệu | Authorized User | Xem nội dung hoặc tải tài liệu theo quyền | Document Detail / Viewer | User xem hoặc tải được tài liệu hợp lệ |

---

## 4. Feature Detail Matrix

> Mỗi feature nên có 1 dòng.
> Không cần viết quá dài; chỉ ghi đủ flow chính, rule chính, exception chính và acceptance criteria chính.

| Feature ID | Preconditions | Main Flow | Business Rules | Exceptions | Acceptance Criteria |
|---|---|---|---|---|---|
| UC01 | Tài khoản đã tồn tại | 1. User vào Login<br>2. Nhập email/password<br>3. System xác thực<br>4. Redirect dashboard | Email/password bắt buộc<br>Khóa tài khoản 15 phút nếu sai quá 5 lần | Sai email/password → báo lỗi<br>Quá số lần thử → khóa tạm thời | Đăng nhập thành công với thông tin đúng<br>Không cho đăng nhập với thông tin sai<br>Hiển thị lỗi rõ ràng |
| UC02 | User đã đăng nhập | 1. User vào Profile<br>2. Xem thông tin<br>3. Sửa field được phép<br>4. Nhấn Lưu | Chỉ cho sửa họ tên, số điện thoại, ảnh đại diện<br>Email không được sửa nếu hệ thống không cho phép | Field sai định dạng → báo lỗi<br>Upload ảnh lỗi → báo lỗi | User xem được hồ sơ<br>User cập nhật được field hợp lệ<br>Dữ liệu mới hiển thị đúng sau khi lưu |
| UC03 | User có quyền Admin/PO | 1. User nhấn Tạo dự án<br>2. Nhập thông tin<br>3. System validate<br>4. Lưu và hiển thị trong danh sách | Tên dự án không trùng<br>Ngày kết thúc >= ngày bắt đầu<br>Mã dự án sinh duy nhất | Trùng tên → báo lỗi<br>Thiếu field bắt buộc → báo lỗi | Tạo dự án thành công khi input hợp lệ<br>Dự án xuất hiện trong danh sách<br>Không tạo được khi vi phạm rule |
| UC04 | User đã đăng nhập | 1. User vào Project List<br>2. System hiển thị danh sách<br>3. User lọc/sắp xếp nếu cần | Chỉ hiển thị dự án user có quyền xem<br>Hỗ trợ lọc theo trạng thái/người phụ trách/thời gian | Không có dữ liệu → empty state<br>Lỗi tải dữ liệu → báo lỗi | Danh sách hiển thị đúng quyền<br>Filter/sort hoạt động đúng<br>Empty state hiển thị khi không có dữ liệu |
| UC05 | User có quyền trong dự án | 1. User chọn dự án<br>2. Nhấn Upload<br>3. Chọn file<br>4. System kiểm tra file<br>5. Lưu file | File hỗ trợ: pdf, docx, xlsx, pptx, txt, md<br>Dung lượng tối đa 10MB<br>File phải gắn với 1 dự án | Sai định dạng → từ chối<br>Quá dung lượng → báo lỗi<br>Upload lỗi → báo lỗi | Upload thành công với file hợp lệ<br>File xuất hiện trong danh sách tài liệu<br>Không upload được file sai rule |
| UC06 | User có quyền xem tài liệu | 1. User click tài liệu<br>2. System kiểm tra quyền<br>3. Hiển thị nội dung hoặc link tải | Chỉ thành viên dự án được xem<br>File văn bản có thể preview<br>File khác cho tải về | Không có quyền → chặn truy cập<br>File không tồn tại → báo lỗi | User có quyền xem/tải được tài liệu<br>User không có quyền bị chặn<br>Thông báo lỗi rõ ràng khi file lỗi |

---

## 5. Field & Validation Matrix

> Bảng này gom field theo feature để dev dễ build form và tester dễ viết test case.

| Feature ID | Field | Type | Required | Validation / Rule | Example |
|---|---|---|---:|---|---|
| UC01 | Email | Text | Yes | Đúng định dạng email | user@example.com |
| UC01 | Password | Password | Yes | Không để trống | ******** |
| UC02 | Họ tên | Text | Yes | Tối đa 255 ký tự | Nguyễn Văn A |
| UC02 | Số điện thoại | Text | No | Đúng định dạng số điện thoại | 0900000000 |
| UC02 | Ảnh đại diện | File/Image | No | JPG/PNG, giới hạn theo cấu hình | avatar.png |
| UC03 | Tên dự án | Text | Yes | Không trùng, tối đa 255 ký tự | Dự án A |
| UC03 | Mô tả | Textarea | No | Tối đa 1000 ký tự | Mô tả dự án |
| UC03 | Ngày bắt đầu | Date | Yes | YYYY-MM-DD | 2026-07-04 |
| UC03 | Ngày kết thúc | Date | No | >= ngày bắt đầu | 2026-07-31 |
| UC03 | Thành viên | Multi-select | No | Chọn từ danh sách user hợp lệ | User A, User B |
| UC04 | Trạng thái | Dropdown/Filter | No | Active / Completed / On-hold | Active |
| UC04 | Người phụ trách | Dropdown/Filter | No | User hợp lệ trong hệ thống | PO A |
| UC04 | Thời gian | Date Range | No | From date <= To date | 2026-07-01 - 2026-07-31 |
| UC05 | Dự án | Dropdown | Yes | Project hợp lệ và user có quyền | Project A |
| UC05 | File | File | Yes | pdf, docx, xlsx, pptx, txt, md; max 10MB | document.pdf |
| UC06 | Document ID | System | Yes | Tài liệu tồn tại và user có quyền | DOC001 |

---

## 6. Permission Matrix

> Bảng này thay cho việc ghi phân quyền rải rác trong từng use case.

| Module | Action | Admin | PO/BA | Manager | User | Guest |
|---|---|---:|---:|---:|---:|---:|
| User | Login | Yes | Yes | Yes | Yes | No |
| User | View profile | Yes | Yes | Yes | Yes | No |
| User | Edit own profile | Yes | Yes | Yes | Yes | No |
| Project | View project list | Yes | Yes | Yes | Yes* | No |
| Project | Create project | Yes | Yes | No | No | No |
| Project | Edit project | Yes | Yes | Manager-owned only | No | No |
| Project | Delete project | Yes | No | No | No | No |
| Document | Upload document | Yes | Yes | Yes | Yes* | No |
| Document | View document | Yes | Yes | Yes | Yes* | No |
| Document | Delete document | Yes | Yes | Manager-owned only | Owner only* | No |

**Ghi chú:**
\`Yes*\` nghĩa là chỉ được thao tác với dữ liệu thuộc phạm vi được phân quyền, ví dụ project mà user là thành viên.

---

## 7. Screen / Data / API Map

> Bảng này gom UI, data object và API/data flow để dev hiểu chức năng liên quan đến màn hình nào và dữ liệu nào.

| Feature ID | Screen | Main Data Object | API / Service gợi ý | Data Flow Summary | Ghi chú UI |
|---|---|---|---|---|---|
| UC01 | Login | User / Auth Token | \`POST /api/auth/login\` | Client → Auth Service → DB → Client | Form gồm Email, Password, nút Đăng nhập |
| UC02 | Profile | User Profile | \`GET /api/profile\`<br>\`PUT /api/profile\` | Client → User Service → DB → Client | Form profile, nút Lưu |
| UC03 | Project Create | Project | \`POST /api/projects\` | Client → Project Service → DB → Client | Popup/page tạo dự án |
| UC04 | Project List | Project | \`GET /api/projects\` | Client → Project Service → DB → Client | Table, search, filter, sort |
| UC05 | Document Upload | Document / File | \`POST /api/documents/upload\` | Client → Document Service → File Storage + DB → Client | Upload button/popup |
| UC06 | Document Viewer | Document / File | \`GET /api/documents/{id}\` | Client → Document Service → DB/File Storage → Client | Preview hoặc download link |

---

## 8. Non-functional Requirements, Constraints & Assumptions

> Gộp yêu cầu phi chức năng, ràng buộc và giả định vào một bảng để tránh tách thành nhiều phần ngắn.

| Nhóm | Hạng mục | Nội dung / Target | Áp dụng cho |
|---|---|---|---|
| Performance | Response time | Trang thông thường < 2s; tra cứu dữ liệu lớn < 5s | Toàn hệ thống |
| Performance | Concurrent users | Hỗ trợ tối thiểu 100 user đồng thời | Toàn hệ thống |
| Security | Authentication | Các trang private bắt buộc đăng nhập | Toàn hệ thống |
| Security | Token | Sử dụng JWT, thời gian hết hạn token 1 giờ | Auth |
| Security | Encryption | Mật khẩu và dữ liệu nhạy cảm phải được mã hóa | User/Auth |
| Availability | Uptime | 99.9%, không tính bảo trì định kỳ | Production |
| Availability | Backup | Sao lưu hằng ngày, lưu 30 ngày | Database/File |
| Compatibility | Browser | Chrome, Firefox, Safari, Edge bản mới | Web app |
| UI | Responsive | Hỗ trợ màn hình từ 320px trở lên | Frontend |
| Data | Input validation | Validate cả client và server | Form/API |
| Data | Reference constraint | Không xóa bản ghi đang được tham chiếu | Project/Document |
| Assumption | User account | User đã có tài khoản và được phân quyền đúng | Private features |
| Assumption | Network | Kết nối mạng ổn định, không yêu cầu offline mode nếu chưa nêu rõ | Web app |
| Assumption | File limit | File upload không vượt quá giới hạn cấu hình | Document |

---

## 9. Global Exception Matrix

> Các lỗi dùng chung toàn hệ thống. Nếu feature có lỗi riêng thì ghi thêm ở \`Feature Detail Matrix\`.

| Tình huống | Hành vi hệ thống | Message gợi ý | Áp dụng cho |
|---|---|---|---|
| Mất kết nối internet | Giữ trạng thái hiện tại nếu có thể | Mất kết nối. Vui lòng thử lại. | Toàn hệ thống |
| Token hết hạn | Yêu cầu đăng nhập lại | Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại. | Trang private |
| Không có quyền | Chặn thao tác hoặc redirect | Bạn không có quyền thực hiện hành động này. | Trang/action private |
| Dữ liệu không tồn tại | Hiển thị not found/empty state | Dữ liệu không tồn tại. | Detail pages |
| Lỗi server | Không lưu dữ liệu, hiển thị lỗi chung | Có lỗi xảy ra. Vui lòng thử lại. | API actions |
| Sai định dạng file | Từ chối upload | Định dạng file không được hỗ trợ. | Upload |
| File quá dung lượng | Từ chối upload | File vượt quá dung lượng cho phép. | Upload |
| Trùng dữ liệu | Không cho lưu | Dữ liệu đã tồn tại. | Create/Edit |
| Xóa dữ liệu đang được tham chiếu | Không cho xóa hoặc yêu cầu xử lý liên kết trước | Không thể xóa vì dữ liệu đang được sử dụng. | Delete actions |

---

## 10. Acceptance Criteria Summary

> Bảng tổng hợp để PO/Tester check nhanh trước khi UAT.

| AC ID | Nhóm kiểm tra | Acceptance Criteria | Feature liên quan |
|---|---|---|---|
| AC01 | Access | User có quyền có thể truy cập màn hình/chức năng | All private features |
| AC02 | Permission | User không có quyền bị chặn đúng cách | UC03, UC05, UC06 |
| AC03 | UI | Màn hình hiển thị đúng field, button, table, filter theo spec | All UI features |
| AC04 | Validation | Required field và format được validate đúng | UC01, UC02, UC03, UC05 |
| AC05 | Business rule | Các rule như trùng tên, giới hạn file, quyền xem được áp dụng đúng | UC01, UC03, UC05, UC06 |
| AC06 | Success case | Dữ liệu hợp lệ được xử lý và lưu thành công | UC02, UC03, UC05 |
| AC07 | Error case | Lỗi được hiển thị rõ ràng, không làm mất dữ liệu không cần thiết | All features |
| AC08 | Data display | Dữ liệu mới/cập nhật hiển thị đúng trên UI sau khi thao tác | UC02, UC03, UC05 |
| AC09 | Filter/sort | Bộ lọc và sắp xếp hoạt động đúng | UC04 |
| AC10 | Document access | User có quyền xem/tải tài liệu, user không có quyền bị chặn | UC06 |

---

## 11. Open Questions

| ID | Nội dung cần xác nhận | Liên quan đến | Owner | Status | Answer |
|---|---|---|---|---|---|
| Q01 | [Có cho user tự đăng ký tài khoản không?] | Auth/User | PO/Client | Open |  |
| Q02 | [Email có được phép chỉnh sửa trong Profile không?] | UC02 | PO/Client | Open |  |
| Q03 | [Manager có được xóa document của user khác không?] | UC05/UC06 | PO/Client | Open |  |
| Q04 | [Có cần preview tất cả định dạng file hay chỉ text/PDF?] | UC06 | PO/Client/Dev | Open |  |
`,
  },
  "change-request": {
    label: "Change Request Document",
    content: `# BẢNG QUẢN LÝ REQUEST CHANGE (1 ROW = 1 REQUEST)

| ID | Mức ưu tiên | Loại thay đổi | Người đề xuất | Ngày gửi | Tiêu đề (Tóm tắt) | Trạng thái hiện tại (Tóm tắt) | Thay đổi đề xuất (Tóm tắt) | Công sức (giờ) | Module ảnh hưởng | Thay đổi CSDL? | Rủi ro & Tác động tiến độ | Người phê duyệt | Quyết định | Trạng thái thực hiện | Ngày hoàn thành |
| :--- | :---: | :--- | :--- | :--- | :--- | :--- | :--- | :---: | :--- | :---: | :--- | :--- | :---: | :--- | :--- |
| **RFC-001** | Cao | [Bổ sung tính năng / Sửa giao diện / Sửa lỗi / Thay đổi quy trình] | [Họ tên (Bộ phận)] | [dd/mm/yy] | [Tóm tắt ngắn gọn nội dung request] | [Mô tả hiện trạng trước khi thay đổi] | [Mô tả nội dung thay đổi đề xuất] | [Số giờ ước tính] | [Module/Phân hệ bị ảnh hưởng] | [Có/Không] | [Đánh giá mức độ rủi ro và tác động tiến độ] | [PM/Người phê duyệt] | [⏳ Cần phân tích thêm / ✅ Chấp nhận / ❌ Từ chối] | [Mới tạo / Đang phát triển / Chờ kiểm thử (QA) / Hoàn thành] | [_Chưa có_ / dd/mm/yy] |
`,
  },
  "test-plan-case": {
    label: "Test Plan / Test Case Document",
    content: `## 1. Role & Test Account

| Role | Account | Permission Summary | Notes |
|---|---|---|---|
| Admin | [admin@example.com] | Full access |  |
| Manager / PO | [manager@example.com] | Create / Edit / View / Export |  |
| User | [user@example.com] | View only / Limited access |  |
| Guest | N/A | No private access |  |

---

## 2. Test Data

| Data ID | Data Name | Related Feature | Input / Value | Expected Usage |
|---|---|---|---|---|
| TD01 | Valid data | [F01] | [Dữ liệu hợp lệ] | Dùng để test flow thành công |
| TD02 | Missing required field | [F01] | [Bỏ trống field bắt buộc] | Dùng để test validation |
| TD03 | Invalid format | [F01] | [Sai định dạng email/ngày/file...] | Dùng để test lỗi format |
| TD04 | Duplicate data | [F01] | [Tên/mã đã tồn tại] | Dùng để test rule trùng dữ liệu |
| TD05 | No permission account | [F01] | [Account không có quyền] | Dùng để test permission |

---

## 3. Requirement Traceability Matrix

> Dùng bảng này để nối Functional Spec với Test Case.
> Mỗi rule, field, permission, exception quan trọng nên có ít nhất 1 test case tương ứng.

| Feature ID | Requirement / Rule / Field / Exception | Type | Related AC | Test Case ID | Coverage Status |
|---|---|---|---|---|---|
| F01 | [Main flow tạo mới thành công] | Flow | AC01, AC06 | TC-F01-001 | Covered |
| F01 | [Validate required field] | Field Validation | AC03, AC04 | TC-F01-002 | Covered |
| F01 | [Không cho nhập dữ liệu trùng] | Business Rule | AC05, AC10 | TC-F01-003 | Covered |
| F01 | [User không có quyền không được thao tác] | Permission | AC08, AC09 | TC-F01-004 | Covered |
| F01 | [Server error] | Exception | AC05 | TC-F01-005 | Covered |

---

## 4. Test Case Matrix

> Bảng này dùng để quản lý test case ngắn gọn cho tester và dev.

| TC ID | Feature ID | Related AC | Test Scenario | Priority | Test Type | Role | Preconditions | Test Data | Test Steps | Expected Result | Actual Result | Status | Defect / Evidence |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| TC-F01-001 | F01 | AC01, AC06 | Tạo mới thành công với dữ liệu hợp lệ | High | Functional | Admin / Manager | User đã đăng nhập, có quyền tạo mới, dữ liệu test đã sẵn sàng | TD01 - Valid data | 1. Truy cập màn hình [Tên màn hình]<br>2. Nhấn [Create / Add]<br>3. Nhập dữ liệu hợp lệ<br>4. Nhấn [Save / Submit]<br>5. Kiểm tra kết quả sau khi submit | Hệ thống lưu thành công, hiển thị message thành công và dữ liệu mới/cập nhật hiển thị đúng trên UI | [Ghi kết quả thực tế] | Not Run | [Link bug / screenshot / video / log nếu có] |
| TC-F01-002 | F01 | AC03, AC04 | Submit khi thiếu field bắt buộc | High | Validation | Admin / Manager | User đã đăng nhập, có quyền submit form | TD02 - Missing required field | 1. Truy cập màn hình [Tên màn hình]<br>2. Mở form [Create / Edit]<br>3. Bỏ trống field bắt buộc<br>4. Nhấn [Save / Submit]<br>5. Kiểm tra message lỗi | Hệ thống không cho submit, highlight field lỗi và hiển thị message required rõ ràng | [Ghi kết quả thực tế] | Not Run | [Link bug / screenshot / video / log nếu có] |
| TC-F01-003 | F01 | AC05, AC10 | Submit dữ liệu trùng | Medium | Business Rule | Admin / Manager | Dữ liệu trùng đã tồn tại trong hệ thống | TD04 - Duplicate data | 1. Mở form [Create / Edit]<br>2. Nhập dữ liệu đã tồn tại<br>3. Nhấn [Save / Submit]<br>4. Kiểm tra phản hồi hệ thống | Hệ thống không cho lưu và hiển thị message dữ liệu đã tồn tại | [Ghi kết quả thực tế] | Not Run | [Link bug / screenshot / video / log nếu có] |
| TC-F01-004 | F01 | AC08, AC09 | User không có quyền truy cập action | High | Permission | User / Guest | User đăng nhập bằng account không có quyền hoặc chưa login | TD05 - No permission account | 1. Truy cập màn hình/action bị giới hạn<br>2. Thực hiện action [Create / Edit / Delete / Export]<br>3. Kiểm tra phản hồi hệ thống | Hệ thống chặn action, ẩn button hoặc redirect; nếu cần thì hiển thị message không có quyền | [Ghi kết quả thực tế] | Not Run | [Link bug / screenshot / video / log nếu có] |
| TC-F01-005 | F01 | AC05 | Hệ thống xử lý lỗi server/network | Medium | Exception | Admin / Manager | Có thể giả lập API lỗi hoặc mất mạng | Server 500 / Network off | 1. Mở form<br>2. Nhập dữ liệu hợp lệ<br>3. Submit khi server/network lỗi<br>4. Kiểm tra message và trạng thái dữ liệu | Hệ thống không lưu sai dữ liệu, hiển thị lỗi chung và giữ dữ liệu user đã nhập nếu có thể | [Ghi kết quả thực tế] | Not Run | [Link bug / screenshot / video / log nếu có] |

**Status values:** Not Run / Passed / Failed / Blocked / Skipped
**Priority values:** High / Medium / Low
**Test Type values:** Functional / UI / API / Validation / Permission / Business Rule / Exception / Regression

---

## 5. Permission Test Matrix

| Feature ID | Action | Admin | Manager / PO | User | Guest | Expected Behavior | TC ID |
|---|---|---:|---:|---:|---:|---|---|
| F01 | View list | Yes | Yes | Yes | No | Role được phép xem danh sách, Guest bị chặn | TC-F01-009 |
| F01 | View detail | Yes | Yes | Yes | No | Role được phép xem chi tiết, Guest bị chặn | TC-F01-010 |
| F01 | Create | Yes | Yes | No | No | Admin/Manager tạo được, User/Guest bị chặn | TC-F01-011 |
| F01 | Edit | Yes | Yes | No | No | Admin/Manager sửa được, User/Guest bị chặn | TC-F01-012 |
| F01 | Delete | Yes | No | No | No | Chỉ Admin được xóa | TC-F01-013 |
| F01 | Export | Yes | Yes | No | No | Admin/Manager export được | TC-F01-014 |

---

## 6. Exception Test Matrix

| Feature ID | Exception Case | Trigger / Test Data | Expected Behavior | Expected Message | TC ID |
|---|---|---|---|---|---|
| F01 | Missing required field | Submit khi bỏ trống field bắt buộc | Không cho submit, highlight field lỗi | Please enter [field name] | TC-F01-002 |
| F01 | Invalid format | Nhập sai format email/ngày/file | Không cho submit/upload | [Field name] is invalid | TC-F01-006 |
| F01 | Duplicate data | Nhập dữ liệu đã tồn tại | Không cho lưu | [Data name] already exists | TC-F01-003 |
| F01 | No permission | User không có quyền truy cập action | Chặn action hoặc redirect | You do not have permission | TC-F01-004 |
| F01 | Data not found | Truy cập item không tồn tại | Hiển thị not found state | Data not found | TC-F01-015 |
| F01 | Server error | API trả 500 | Không lưu dữ liệu, hiển thị lỗi chung | Something went wrong. Please try again | TC-F01-005 |
| F01 | Network error | Ngắt mạng khi submit | Không mất dữ liệu đang nhập nếu có thể | Network error. Please check your connection | TC-F01-016 |
`,
  },
};
