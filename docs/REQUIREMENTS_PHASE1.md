# REQUIREMENTS.md
# PMS - Functional Requirements (Phase 1)

> Phiên bản này tập trung vào các chức năng quan trọng (Core Features) để triển khai MVP.

---

# 1. Authentication & User

## FR-AUTH-001 Đăng nhập
- Email + Password
- JWT/NextAuth
- Remember login
- Session timeout

## FR-AUTH-002 Hồ sơ cá nhân
- Avatar
- Full name
- Department
- Đổi mật khẩu

## FR-AUTH-003 Quản lý người dùng (Admin)
- Tạo tài khoản
- Khóa/Mở khóa
- Gán Role
- Reset Password

---

# 2. Dashboard

## FR-DASH-001 Dashboard tổng quan
Hiển thị:
- Tổng Project
- Tổng Module
- Tổng Document
- Tổng Task
- Activity Feed

## FR-DASH-002 My Tasks
- Task của tôi
- Sắp hết hạn
- Quá hạn
- Đã hoàn thành

## FR-DASH-003 Recent Activity
- Document tạo/sửa
- Task thay đổi
- Comment
- Approval

---

# 3. Project Management

## FR-PRJ-001 Danh sách Project
- Card/Grid
- Search
- Filter
- Sort

## FR-PRJ-002 Tạo Project
Thông tin:
- Name
- Code
- Description
- Icon
- Start/End Date
- Priority
- Template

## FR-PRJ-003 Dashboard Project
Hiển thị:
- KPI
- Progress
- Module
- Document Status
- Task Progress
- Upcoming Deadlines
- Team Members
- Highlight Issues

## FR-PRJ-004 Members
- Thêm thành viên
- Xóa thành viên
- Đổi Role trong Project

## FR-PRJ-005 Settings
- Edit thông tin
- Archive
- Delete
- Export JSON

---

# 4. Module Management

## FR-MOD-001 CRUD Module
- Create
- Rename
- Delete
- Sort
- Icon

## FR-MOD-002 Sidebar
- Collapse
- Expand
- Active Module
- Drag & Drop Sort

---

# 5. Document Management (CORE)

## FR-DOC-001 Document List
- Table View
- Search
- Filter
- Sort
- Pagination

## FR-DOC-002 Create Document
Fields:
- Title
- Category
- Role
- Content (Markdown)
- Attachment
- Status

## FR-DOC-003 Document Detail
Hiển thị:
- Metadata
- Markdown
- Related Tasks
- Version
- Comments

## FR-DOC-004 Edit Document
- Markdown Editor
- Autosave
- Versioning
- Audit Log

## FR-DOC-005 Workflow
Draft
→ Review
→ Approved
→ Archived

## FR-DOC-006 Attachment
- Image
- PDF
- Excel
- External Link

## FR-DOC-007 Comment
- Thread
- Mention
- Resolve

---

# 6. Task Management

## FR-TASK-001 Kanban
Columns:
- Todo
- In Progress
- Review
- Done

## FR-TASK-002 Create Task
- Manual
- From Document Highlight

Fields:
- Title
- Description
- Assignee
- Priority
- Due Date
- Related Document

## FR-TASK-003 Task Detail
- History
- Comment
- Change Status
- Reassign

---

# 7. Admin

## FR-ADM-001 User Management
## FR-ADM-002 Project Management
## FR-ADM-003 Template Management
## FR-ADM-004 Audit Logs
## FR-ADM-005 System Settings

---

# 8. Non Functional

- Responsive
- Authentication
- RBAC
- MongoDB
- Versioning
- Audit Log
- API <300ms
- Page Load <2s
