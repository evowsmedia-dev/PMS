## 1. Role & Test Account

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

| TC ID      | Feature ID | Related AC | Test Scenario                         | Priority | Test Type     | Role            | Preconditions                                                 | Test Data                     | Test Steps                                                                                                                                               | Expected Result                                                                                    | Actual Result         | Status  | Defect / Evidence                            |
| ---------- | ---------- | ---------- | ------------------------------------- | -------- | ------------- | --------------- | ------------------------------------------------------------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | --------------------- | ------- | -------------------------------------------- |
| TC-F01-001 | F01        | AC01, AC06 | Tạo mới thành công với dữ liệu hợp lệ | High     | Functional    | Admin / Manager | User đã đăng nhập, có quyền tạo mới, dữ liệu test đã sẵn sàng | TD01 - Valid data             | 1. Truy cập màn hình [Tên màn hình]<br>2. Nhấn [Create / Add]<br>3. Nhập dữ liệu hợp lệ<br>4. Nhấn [Save / Submit]<br>5. Kiểm tra kết quả sau khi submit | Hệ thống lưu thành công, hiển thị message thành công và dữ liệu mới/cập nhật hiển thị đúng trên UI | [Ghi kết quả thực tế] | Not Run | [Link bug / screenshot / video / log nếu có] |
| TC-F01-002 | F01        | AC03, AC04 | Submit khi thiếu field bắt buộc       | High     | Validation    | Admin / Manager | User đã đăng nhập, có quyền submit form                       | TD02 - Missing required field | 1. Truy cập màn hình [Tên màn hình]<br>2. Mở form [Create / Edit]<br>3. Bỏ trống field bắt buộc<br>4. Nhấn [Save / Submit]<br>5. Kiểm tra message lỗi    | Hệ thống không cho submit, highlight field lỗi và hiển thị message required rõ ràng                | [Ghi kết quả thực tế] | Not Run | [Link bug / screenshot / video / log nếu có] |
| TC-F01-003 | F01        | AC05, AC10 | Submit dữ liệu trùng                  | Medium   | Business Rule | Admin / Manager | Dữ liệu trùng đã tồn tại trong hệ thống                       | TD04 - Duplicate data         | 1. Mở form [Create / Edit]<br>2. Nhập dữ liệu đã tồn tại<br>3. Nhấn [Save / Submit]<br>4. Kiểm tra phản hồi hệ thống                                     | Hệ thống không cho lưu và hiển thị message dữ liệu đã tồn tại                                      | [Ghi kết quả thực tế] | Not Run | [Link bug / screenshot / video / log nếu có] |
| TC-F01-004 | F01        | AC08, AC09 | User không có quyền truy cập action   | High     | Permission    | User / Guest    | User đăng nhập bằng account không có quyền hoặc chưa login    | TD05 - No permission account  | 1. Truy cập màn hình/action bị giới hạn<br>2. Thực hiện action [Create / Edit / Delete / Export]<br>3. Kiểm tra phản hồi hệ thống                        | Hệ thống chặn action, ẩn button hoặc redirect; nếu cần thì hiển thị message không có quyền         | [Ghi kết quả thực tế] | Not Run | [Link bug / screenshot / video / log nếu có] |
| TC-F01-005 | F01        | AC05       | Hệ thống xử lý lỗi server/network     | Medium   | Exception     | Admin / Manager | Có thể giả lập API lỗi hoặc mất mạng                          | Server 500 / Network off      | 1. Mở form<br>2. Nhập dữ liệu hợp lệ<br>3. Submit khi server/network lỗi<br>4. Kiểm tra message và trạng thái dữ liệu                                    | Hệ thống không lưu sai dữ liệu, hiển thị lỗi chung và giữ dữ liệu user đã nhập nếu có thể          | [Ghi kết quả thực tế] | Not Run | [Link bug / screenshot / video / log nếu có] |

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