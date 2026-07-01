/**
 * "Kho RFID" template structure, transliterated from the original prototype's
 * DOC_TEMPLATES/CATEGORY_TEMPLATES (PMS index.html). {{projectName}} is
 * interpolated with the real project name at project-creation time.
 */
export interface TemplateDocDef {
  title: string;
  category: "MANAGEMENT" | "REQUIREMENTS" | "TECHNICAL" | "TESTING" | "TASKS" | "KNOWLEDGE" | "HISTORY";
  role: "PO" | "BA" | "DEV" | "TESTER" | "ALL";
  status: "DRAFT" | "REVIEW" | "APPROVED" | "ARCHIVED";
  description: string;
  content: string;
}

export const RFID_TEMPLATE_DOCS: TemplateDocDef[] = [
  // ---- 01-Project-Management ----
  {
    title: "vision.md",
    category: "MANAGEMENT",
    role: "PO",
    status: "APPROVED",
    description: 'Tầm nhìn và mục tiêu chiến lược cho dự án "{{projectName}}"',
    content: `# Tầm nhìn dự án: {{projectName}}

## Mục tiêu tổng thể
- Cung cấp giải pháp toàn diện cho {{projectName}}.
- Tăng hiệu quả vận hành lên 30%.
- Giảm thời gian xử lý xuống còn 2 ngày.

## Phạm vi
- Module A, B, C.
- Tích hợp với hệ thống hiện có.

## Các bên liên quan
- PO, BA, Dev, Tester, End-users.`,
  },
  {
    title: "project-plan.md",
    category: "MANAGEMENT",
    role: "PO",
    status: "APPROVED",
    description: 'Kế hoạch triển khai dự án "{{projectName}}"',
    content: `# Kế hoạch dự án: {{projectName}}

## Mốc thời gian
- **Tuần 1-2**: Khảo sát & Phân tích
- **Tuần 3-4**: Thiết kế giải pháp
- **Tuần 5-8**: Phát triển
- **Tuần 9**: Kiểm thử
- **Tuần 10**: Triển khai

## Nguồn lực
- 2 Dev, 1 BA, 1 Tester, 1 PO.

## Rủi ro
- Chậm tiến độ do thay đổi yêu cầu.`,
  },
  {
    title: "meeting-minutes.md",
    category: "MANAGEMENT",
    role: "BA",
    status: "APPROVED",
    description: 'Biên bản họp định kỳ dự án "{{projectName}}"',
    content: `# Biên bản họp - {{projectName}}

**Thành phần**: PO, BA, Dev Lead, Tester Lead

## Nội dung
1. Cập nhật tiến độ sprint hiện tại.
2. Thảo luận về yêu cầu thay đổi từ khách hàng.
3. Lên kế hoạch cho sprint tiếp theo.

## Quyết định
- Phê duyệt thiết kế database.
- Ưu tiên xử lý lỗi thanh toán.`,
  },

  // ---- 02-Requirements ----
  {
    title: "brd-customer.md",
    category: "REQUIREMENTS",
    role: "BA",
    status: "APPROVED",
    description: 'Đặc tả yêu cầu nghiệp vụ từ khách hàng cho "{{projectName}}"',
    content: `# BRD - {{projectName}}

## Yêu cầu chức năng
- **F1**: Đăng nhập / phân quyền.
- **F2**: Quản lý danh mục.
- **F3**: Tạo / cập nhật / xóa bản ghi.
- **F4**: Báo cáo thống kê.

## Yêu cầu phi chức năng
- Hiệu năng: < 2s response.
- Bảo mật: mã hóa dữ liệu nhạy cảm.`,
  },
  {
    title: "functional-spec.md",
    category: "REQUIREMENTS",
    role: "BA",
    status: "APPROVED",
    description: 'Đặc tả kỹ thuật chức năng cho "{{projectName}}"',
    content: `# Functional Specification - {{projectName}}

## Use Cases
- **UC01**: Người dùng tạo đơn hàng.
- **UC02**: Quản trị viên phê duyệt.
- **UC03**: Hệ thống gửi thông báo.

## Luồng dữ liệu
- Input → Validation → Processing → Output.

## Giao diện
- Mockup được đính kèm trong tài liệu riêng.`,
  },
  {
    title: "solution-proposal-approved.md",
    category: "REQUIREMENTS",
    role: "BA",
    status: "APPROVED",
    description: 'Đề xuất giải pháp đã được phê duyệt cho "{{projectName}}"',
    content: `# Giải pháp được phê duyệt - {{projectName}}

## Phương án lựa chọn
- Sử dụng microservices.
- Database: PostgreSQL.
- Frontend: React + Tailwind.
- Backend: Node.js + Express.

## Lý do
- Mở rộng linh hoạt.
- Cộng đồng hỗ trợ tốt.
- Phù hợp với nguồn lực hiện có.`,
  },

  // ---- 03-Technical ----
  {
    title: "01-architecture-overview.md",
    category: "TECHNICAL",
    role: "DEV",
    status: "APPROVED",
    description: 'Tổng quan kiến trúc hệ thống cho "{{projectName}}"',
    content: `# Kiến trúc tổng thể - {{projectName}}

## Các thành phần
- **API Gateway**: xác thực, định tuyến.
- **Service A**: quản lý dữ liệu core.
- **Service B**: xử lý nghiệp vụ.
- **Message Queue**: RabbitMQ.
- **Database**: PostgreSQL.

## Sơ đồ
[Client] → [Gateway] → [Service A/B] → [DB]`,
  },
  {
    title: "02-database-schema.md",
    category: "TECHNICAL",
    role: "DEV",
    status: "APPROVED",
    description: 'Thiết kế database cho "{{projectName}}"',
    content: `# Database Schema - {{projectName}}

## Bảng chính
- **users** (id, name, email, role)
- **projects** (id, name, description, created_at)
- **documents** (id, title, category, role, status, author, date, content)
- **comments** (id, doc_id, author, text, time)

## Quan hệ
- users 1--n projects
- projects 1--n documents
- documents 1--n comments`,
  },
  {
    title: "03-api-specification.md",
    category: "TECHNICAL",
    role: "DEV",
    status: "REVIEW",
    description: 'Đặc tả API cho "{{projectName}}"',
    content: `# API Specification - {{projectName}}

## Endpoints
- **GET /api/projects** - danh sách dự án
- **POST /api/projects** - tạo mới
- **GET /api/projects/:id** - chi tiết
- **PUT /api/projects/:id** - cập nhật
- **DELETE /api/projects/:id** - xóa

## Authentication
- Bearer token JWT.

## Response format
\`\`\`json
{ "status": "success", "data": {} }
\`\`\``,
  },
  {
    title: "04-setup-guide.md",
    category: "TECHNICAL",
    role: "DEV",
    status: "APPROVED",
    description: 'Hướng dẫn cài đặt và chạy dự án "{{projectName}}"',
    content: `# Setup Guide - {{projectName}}

## Yêu cầu
- Node.js v18+
- PostgreSQL v15+
- Git

## Các bước
1. Clone repository
2. \`npm install\`
3. Tạo file .env với cấu hình DB
4. \`npm run migrate\`
5. \`npm run dev\`

## Biến môi trường
\`\`\`env
PORT=3000
DB_URL=postgresql://localhost:5432/erp
JWT_SECRET=secret
\`\`\``,
  },

  // ---- 04-Testing ----
  {
    title: "test-strategy.md",
    category: "TESTING",
    role: "TESTER",
    status: "APPROVED",
    description: 'Chiến lược kiểm thử cho "{{projectName}}"',
    content: `# Chiến lược kiểm thử - {{projectName}}

## Các cấp độ
- Unit test (Jest)
- Integration test (Supertest)
- E2E (Cypress)

## Công cụ
- Jest + React Testing Library
- Supertest
- Cypress

## Kế hoạch
- Chạy tự động trên CI/CD.
- Báo cáo kết quả hàng ngày.`,
  },
  {
    title: "test-cases.md",
    category: "TESTING",
    role: "TESTER",
    status: "REVIEW",
    description: 'Các test case cho "{{projectName}}"',
    content: `# Test Cases - {{projectName}}

## TC01: Đăng nhập thành công
- Input: user + pass đúng
- Expected: redirect đến dashboard

## TC02: Đăng nhập thất bại
- Input: sai mật khẩu
- Expected: hiển thị lỗi

## TC03: Tạo mới project
- Input: tên hợp lệ
- Expected: project xuất hiện trong danh sách`,
  },
  {
    title: "bug-reports.md",
    category: "TESTING",
    role: "TESTER",
    status: "DRAFT",
    description: 'Báo cáo lỗi phát hiện trong "{{projectName}}"',
    content: `# Bug Reports - {{projectName}}

## BUG-001: Lỗi hiển thị danh sách
- **Mức độ**: Trung bình
- **Mô tả**: Khi tải trang, danh sách hiển thị trống.
- **Tái hiện**: Tải lại trang nhiều lần.
- **Trạng thái**: Đang xử lý.

## BUG-002: API trả về sai mã lỗi
- **Mức độ**: Cao
- **Mô tả**: Khi xóa không thành công, API trả về 200 thay vì 400.
- **Trạng thái**: Đã sửa.`,
  },

  // ---- 05-Tasks-and-Progress ----
  {
    title: "wbs-work-breakdown.md",
    category: "TASKS",
    role: "PO",
    status: "APPROVED",
    description: 'Phân rã công việc (WBS) cho "{{projectName}}"',
    content: `# WBS - {{projectName}}

## 1. Khảo sát
- 1.1 Phỏng vấn stakeholders
- 1.2 Phân tích hiện trạng

## 2. Thiết kế
- 2.1 Kiến trúc tổng thể
- 2.2 Database schema
- 2.3 Giao diện UI

## 3. Phát triển
- 3.1 Backend API
- 3.2 Frontend
- 3.3 Tích hợp

## 4. Kiểm thử
- 4.1 Unit test
- 4.2 Integration test
- 4.3 UAT`,
  },
  {
    title: "sprint-board.md",
    category: "TASKS",
    role: "ALL",
    status: "REVIEW",
    description: 'Bảng theo dõi tiến độ sprint của "{{projectName}}"',
    content: `# Sprint Board - {{projectName}}

## Sprint hiện tại (Sprint 3)
- **To Do**: 5 tasks
- **In Progress**: 3 tasks
- **Review**: 2 tasks
- **Done**: 8 tasks

## Tasks
- [ ] Tối ưu query database
- [ ] Xử lý lỗi timeout
- [x] Hoàn thành API login
- [x] Thiết kế giao diện dashboard`,
  },

  // ---- 06-Knowledge ----
  {
    title: "glossary.md",
    category: "KNOWLEDGE",
    role: "BA",
    status: "APPROVED",
    description: 'Từ điển thuật ngữ cho "{{projectName}}"',
    content: `# Glossary - {{projectName}}

- **BPMN**: Business Process Model and Notation – ký hiệu mô hình hóa quy trình nghiệp vụ.
- **CRUD**: Create, Read, Update, Delete – bốn thao tác cơ bản.
- **JWT**: JSON Web Token – tiêu chuẩn mở cho token.
- **ORM**: Object-Relational Mapping – kỹ thuật ánh xạ đối tượng.
- **UAT**: User Acceptance Testing – kiểm thử chấp nhận người dùng.`,
  },
  {
    title: "coding-style-guide.md",
    category: "KNOWLEDGE",
    role: "DEV",
    status: "APPROVED",
    description: 'Hướng dẫn coding style cho "{{projectName}}"',
    content: `# Coding Style Guide - {{projectName}}

## Quy tắc chung
- Sử dụng ESLint + Prettier.
- Đặt tên biến rõ ràng, có nghĩa.
- Viết comment cho các hàm phức tạp.
- Tuân thủ nguyên tắc DRY.

## JavaScript
- Dùng camelCase cho biến/hàm.
- Dùng PascalCase cho class/component.
- Sử dụng const/let, tránh var.

## CSS
- Sử dụng Tailwind classes.
- Tránh inline style.`,
  },

  // ---- 07-History-and-Decisions ----
  {
    title: "CHANGELOG.md",
    category: "HISTORY",
    role: "ALL",
    status: "APPROVED",
    description: 'Nhật ký thay đổi của "{{projectName}}"',
    content: `# CHANGELOG - {{projectName}}

## [1.2.0]
### Added
- Chức năng xuất báo cáo PDF.
- Hỗ trợ đa ngôn ngữ.

### Fixed
- Sửa lỗi hiển thị biểu đồ.
- Tối ưu hiệu năng tải trang.

### Changed
- Nâng cấp version thư viện.

## [1.1.0]
### Added
- Module quản lý người dùng.
- Tích hợp logging.`,
  },
  {
    title: "adr/adr-001-choose-database.md",
    category: "HISTORY",
    role: "ALL",
    status: "APPROVED",
    description: 'ADR-001: Lựa chọn database cho "{{projectName}}"',
    content: `# ADR-001: Lựa chọn Database - {{projectName}}

## Bối cảnh
Cần chọn database phù hợp cho dự án.

## Lựa chọn
- **PostgreSQL**: SQL, ACID, hỗ trợ JSON, performance tốt.

## Lý do
- Đáp ứng yêu cầu giao dịch.
- Dễ mở rộng.
- Cộng đồng mạnh.

## Hệ quả
- Dev team cần nắm vững SQL.
- Chi phí hosting có thể cao hơn NoSQL.`,
  },
];
