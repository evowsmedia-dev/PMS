export type DocTemplateId = "blank" | "rfid-process-flow" | "functional-specification";

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
    content: `## 1. Feature Summary

**Feature Name:** [Tên chức năng]

**Purpose:**
[Mô tả ngắn gọn chức năng này dùng để làm gì.]

**Actors:**
- [Admin]
- [Manager]
- [User]
- [Guest]

**Preconditions:**
- [Người dùng đã đăng nhập]
- [Người dùng có quyền truy cập]
- [Dữ liệu liên quan đã tồn tại nếu có]

---

## 2. Flow

### 2.1 Main Flow

1. User truy cập màn hình [Tên màn hình].
2. User thực hiện hành động [Tên hành động].
3. System hiển thị [Form / Popup / Danh sách / Chi tiết].
4. User nhập hoặc chọn thông tin cần thiết.
5. User nhấn [Submit / Save / Confirm].
6. System validate dữ liệu.
7. System xử lý yêu cầu.
8. System hiển thị kết quả thành công.

### 2.2 Alternative Flow

| Case | Flow |
|---|---|
| [User hủy thao tác] | System đóng popup/form và không lưu dữ liệu |
| [User quay lại màn hình trước] | System giữ/ngắt trạng thái theo rule của feature |
| [Không có dữ liệu] | System hiển thị empty state |

---

## 3. Business Rules

| Rule ID | Rule Description |
|---|---|
| BR01 | [Tên không được trùng trong cùng một project] |
| BR02 | [Ngày kết thúc phải lớn hơn hoặc bằng ngày bắt đầu] |
| BR03 | [Chỉ user có quyền Admin/Manager mới được tạo mới] |
| BR04 | [Không cho xóa dữ liệu đã được sử dụng ở module khác] |
| BR05 | [Trạng thái mặc định khi tạo mới là Active] |

---

## 4. Field List & Validation

| Field | Type | Required | Validation / Rule | Example |
|---|---|---:|---|---|
| [Name] | Text | Yes | Max 255 characters, unique | Project A |
| [Description] | Textarea | No | Max 1000 characters | Mô tả dự án |
| [Status] | Dropdown | Yes | Active / Inactive / Completed | Active |
| [Start Date] | Date | Yes | Format YYYY-MM-DD | 2026-07-04 |
| [End Date] | Date | No | Must be >= Start Date | 2026-07-31 |
| [File Upload] | File | No | PDF, DOCX, XLSX; max 10MB | document.pdf |

---

## 5. Permission

| Action | Admin | Manager / PO | User | Guest |
|---|---:|---:|---:|---:|
| View list | Yes | Yes | Yes | No |
| View detail | Yes | Yes | Yes | No |
| Create | Yes | Yes | No | No |
| Edit | Yes | Yes | No | No |
| Delete | Yes | No | No | No |
| Export | Yes | Yes | No | No |
| Approve | Yes | Yes | No | No |

---

## 6. Exception & Error Handling

| Case | System Behavior | Message |
|---|---|---|
| Missing required field | Không cho submit, highlight field lỗi | Please enter [field name] |
| Invalid format | Không cho submit, hiển thị lỗi tại field | [Field name] is invalid |
| Duplicate data | Không cho lưu dữ liệu | [Data name] already exists |
| No permission | Chặn thao tác hoặc redirect | You do not have permission to perform this action |
| Data not found | Hiển thị trang hoặc message not found | Data not found |
| Server error | Không lưu dữ liệu, hiển thị lỗi chung | Something went wrong. Please try again |
| Network error | Giữ trạng thái hiện tại nếu có thể | Network error. Please check your connection |
| Delete item in use | Không cho xóa hoặc yêu cầu xử lý liên kết trước | This item is being used and cannot be deleted |

---

## 7. Acceptance Criteria

| AC ID | Acceptance Criteria |
|---|---|
| AC01 | User có quyền có thể truy cập màn hình chức năng. |
| AC02 | System hiển thị đúng các field theo danh sách field. |
| AC03 | System validate đầy đủ các required field. |
| AC04 | System không cho submit nếu dữ liệu không hợp lệ. |
| AC05 | System hiển thị message lỗi rõ ràng khi có exception. |
| AC06 | System lưu dữ liệu thành công khi input hợp lệ. |
| AC07 | Sau khi lưu thành công, dữ liệu mới/cập nhật được hiển thị đúng trên UI. |
| AC08 | User không có quyền không thể thực hiện action bị giới hạn. |
| AC09 | Permission được áp dụng đúng theo từng role. |
| AC10 | Các business rule được áp dụng đúng trong tất cả flow liên quan. |

---

## 8. Test Notes

| Test Case | Expected Result |
|---|---|
| Submit form với dữ liệu hợp lệ | Lưu thành công |
| Submit form thiếu required field | Hiển thị lỗi required field |
| Submit form với dữ liệu sai format | Hiển thị lỗi format |
| Submit dữ liệu trùng | Không cho lưu, hiển thị lỗi duplicate |
| User không có quyền truy cập | Bị chặn hoặc redirect |
| User cancel thao tác | Không lưu dữ liệu |
| Server trả lỗi | Hiển thị lỗi chung |
| Network lỗi | Hiển thị lỗi kết nối |

---

## 9. Open Questions

| ID | Question | Owner | Status | Answer |
|---|---|---|---|---|
| Q01 | [Cần confirm rule nào?] | [PO/Client] | Open |  |
| Q02 | [Cần confirm permission nào?] | [PO/Client] | Open |  |
`,
  },
};
