# FUNCTIONAL SPECIFICATION DOCUMENT

**Tác giả:** [Họ tên người viết]  
**Ngày tạo:** [YYYY-MM-DD]  
**Trạng thái:** [Nháp / Đang review / Đã duyệt]

---

## 1. Mục lục
1. [Giới thiệu](#1-giới-thiệu)  
2. [Yêu cầu chức năng](#2-yêu-cầu-chức-năng)  
3. [Yêu cầu phi chức năng](#3-yêu-cầu-phi-chức-năng)  
4. [Use cases](#4-use-cases)  
5. [Luồng dữ liệu](#5-luồng-dữ-liệu)  
6. [Giao diện người dùng](#6-giao-diện-người-dùng)  
7. [Ràng buộc & giả định](#7-ràng-buộc--giả-định)  
8. [Các trường hợp ngoại lệ](#8-các-trường-hợp-ngoại-lệ)  
9. [Phụ lục](#9-phụ-lục)  
10. [Lịch sử thay đổi](#10-lịch-sử-thay-đổi)

---

## 1. Giới thiệu
### 1.1 Mục đích
Tài liệu này nhằm mô tả chi tiết các chức năng của hệ thống [tên hệ thống], phục vụ cho việc phát triển, kiểm thử và bàn giao.

### 1.2 Phạm vi
Hệ thống bao gồm các module: [liệt kê module]. Tài liệu tập trung vào các chức năng cốt lõi, không bao gồm tích hợp bên thứ ba (nếu có) sẽ được mô tả riêng.

### 1.3 Định nghĩa & từ viết tắt
| Ký hiệu | Giải thích |
|---------|------------|
| CRUD    | Create, Read, Update, Delete |
| JWT     | JSON Web Token |
| UAT     | User Acceptance Testing |

---

## 2. Yêu cầu chức năng

### 2.1 Module: Quản lý người dùng
#### 2.1.1 UC01 – Đăng nhập
- **ID:** UC01
- **Tên chức năng:** Đăng nhập
- **Tác nhân:** Người dùng
- **Mô tả:** Người dùng nhập email và mật khẩu để truy cập hệ thống.
- **Điều kiện tiên quyết:** Tài khoản đã được tạo.
- **Luồng sự kiện chính:**
  1. Người dùng truy cập trang đăng nhập.
  2. Nhập email và mật khẩu.
  3. Hệ thống xác thực thông tin.
  4. Chuyển hướng đến dashboard.
- **Luồng ngoại lệ:**
  - Nếu sai email hoặc mật khẩu → hiển thị thông báo lỗi.
  - Nếu quá 5 lần thử sai → khóa tài khoản trong 15 phút.
- **Kết quả:** Người dùng đã đăng nhập thành công.

#### 2.1.2 UC02 – Quản lý hồ sơ
- **ID:** UC02
- **Tên chức năng:** Quản lý hồ sơ
- **Tác nhân:** Người dùng
- **Mô tả:** Cho phép xem và cập nhật thông tin cá nhân.
- **Luồng sự kiện chính:**
  1. Người dùng vào trang "Hồ sơ".
  2. Xem thông tin hiện tại.
  3. Sửa các trường được phép (họ tên, số điện thoại, ảnh đại diện).
  4. Nhấn "Lưu" để cập nhật.
- **Kết quả:** Thông tin được cập nhật thành công.

### 2.2 Module: Quản lý dự án
#### 2.2.1 UC03 – Tạo dự án mới
- **ID:** UC03
- **Tên chức năng:** Tạo dự án mới
- **Tác nhân:** Quản trị viên / PO
- **Mô tả:** Cho phép tạo một dự án mới với thông tin tên, mô tả, ngày bắt đầu, ngày kết thúc, danh sách thành viên.
- **Luồng sự kiện chính:**
  1. Người dùng nhấn nút "Tạo dự án".
  2. Điền các thông tin bắt buộc.
  3. Hệ thống kiểm tra tính hợp lệ.
  4. Lưu dự án và hiển thị trong danh sách.
- **Ràng buộc:** Tên dự án không trùng lặp.
- **Kết quả:** Dự án mới được tạo với mã số duy nhất.

#### 2.2.2 UC04 – Xem danh sách dự án
- **ID:** UC04
- **Tên chức năng:** Xem danh sách dự án
- **Tác nhân:** Tất cả người dùng
- **Mô tả:** Hiển thị danh sách tất cả dự án với các thông tin: tên, mô tả, trạng thái, tiến độ, người phụ trách.
- **Bộ lọc:** Theo trạng thái, theo người phụ trách, theo thời gian.
- **Sắp xếp:** Theo tên, ngày tạo, tiến độ.

### 2.3 Module: Quản lý tài liệu
#### 2.3.1 UC05 – Tải lên tài liệu
- **ID:** UC05
- **Tên chức năng:** Tải lên tài liệu
- **Tác nhân:** Tất cả người dùng
- **Mô tả:** Cho phép tải lên một file tài liệu (hỗ trợ các định dạng .pdf, .docx, .xlsx, .pptx, .txt, .md) và gán vào một dự án cụ thể.
- **Luồng sự kiện chính:**
  1. Người dùng chọn dự án.
  2. Nhấn "Tải lên" và chọn file.
  3. Hệ thống kiểm tra định dạng, dung lượng (tối đa 10MB).
  4. Lưu file và cập nhật danh sách tài liệu của dự án.
- **Kết quả:** File được lưu trữ và liên kết với dự án.

#### 2.3.2 UC06 – Xem nội dung tài liệu
- **ID:** UC06
- **Tên chức năng:** Xem nội dung tài liệu
- **Tác nhân:** Người dùng có quyền truy cập
- **Mô tả:** Hiển thị nội dung tài liệu (đối với file văn bản) hoặc cung cấp link tải về (đối với các file khác).
- **Luồng sự kiện chính:**
  1. Người dùng nhấp vào tên tài liệu.
  2. Hệ thống hiển thị nội dung (hoặc tải file xuống).
- **Phân quyền:** Chỉ người trong dự án mới được xem.

---

## 3. Yêu cầu phi chức năng

| Loại | Yêu cầu | Mô tả |
|------|---------|-------|
| **Hiệu năng** | Thời gian phản hồi | Các trang thông thường < 2s. Tra cứu dữ liệu lớn < 5s. |
| **Hiệu năng** | Số lượng người dùng đồng thời | Hỗ trợ tối thiểu 100 người dùng cùng lúc. |
| **Bảo mật** | Xác thực | Sử dụng JWT, thời gian hết hạn token 1 giờ. |
| **Bảo mật** | Mã hóa | Dữ liệu nhạy cảm (mật khẩu, thông tin cá nhân) được mã hóa AES-256. |
| **Khả dụng** | Thời gian hoạt động | Đảm bảo 99.9% uptime (không tính bảo trì định kỳ). |
| **Khả dụng** | Sao lưu | Sao lưu dữ liệu hàng ngày, lưu trữ 30 ngày. |
| **Khả năng mở rộng** | Kiến trúc | Hỗ trợ thêm module mới mà không ảnh hưởng module cũ. |
| **Tương thích** | Trình duyệt | Hỗ trợ Chrome, Firefox, Safari, Edge phiên bản mới nhất. |
| **Giao diện** | Responsive | Tương thích với màn hình từ 320px trở lên. |
| **Quốc tế hóa** | Ngôn ngữ | Hỗ trợ tiếng Việt và tiếng Anh (có thể mở rộng). |

---

## 4. Use cases

### 4.1 Biểu đồ Use case tổng thể
*(Có thể vẽ sơ đồ hoặc mô tả bằng văn bản)*

**Tác nhân chính:**
- Người dùng (User)
- Quản trị viên (Admin)
- PO/BA

**Các Use case:**
- Đăng nhập, Quản lý hồ sơ, Quản lý dự án, Quản lý tài liệu, Quản lý thành viên, Xem báo cáo, Phê duyệt tài liệu.

### 4.2 Mô tả chi tiết Use case chính

#### UC01 – Đăng nhập (xem ở 2.1.1)
#### UC03 – Tạo dự án mới (xem ở 2.2.1)

*(Các use case khác có thể tham chiếu đến phần yêu cầu chức năng)*

---

## 5. Luồng dữ liệu

### 5.1 Sơ đồ luồng dữ liệu tổng thể
*(Mô tả các thành phần và luồng di chuyển dữ liệu)*

**Các thành phần:**
- Client (Web/Mobile)
- API Gateway
- Service User
- Service Project
- Service Document
- Database (PostgreSQL)
- File Storage (S3 hoặc local)

**Luồng chính:**
1. Client gửi request đến API Gateway.
2. API Gateway xác thực token, định tuyến đến service tương ứng.
3. Service xử lý logic, đọc/ghi dữ liệu từ Database hoặc File Storage.
4. Trả về response cho Client.

### 5.2 Luồng dữ liệu cho từng chức năng
#### Luồng tạo dự án mới (UC03)
- Client → API Gateway → Service Project → Database → Service Project → API Gateway → Client.

---

## 6. Giao diện người dùng

### 6.1 Danh sách màn hình
- **Màn hình đăng nhập**
- **Màn hình dashboard**
- **Màn hình danh sách dự án**
- **Màn hình chi tiết dự án**
- **Màn hình danh sách tài liệu**
- **Màn hình xem tài liệu**
- **Màn hình hồ sơ người dùng**

### 6.2 Mockup (mô tả bằng văn bản)
#### Màn hình đăng nhập
- Form gồm 2 trường: Email, Password.
- Nút "Đăng nhập", link "Quên mật khẩu".
- Hiển thị logo và tên hệ thống.

#### Màn hình danh sách dự án
- Header: tên trang, nút "Tạo dự án".
- Bảng gồm các cột: Tên dự án, Mô tả, Trạng thái, Tiến độ, Hành động (Xem/Sửa/Xóa).
- Thanh công cụ lọc và tìm kiếm.

*(Có thể cung cấp file hình ảnh mockup riêng)*

---

## 7. Ràng buộc & giả định

### 7.1 Ràng buộc
- Dữ liệu đầu vào phải được validate cả client lẫn server.
- Tất cả API phải có xác thực token.
- Không cho phép xóa các bản ghi đã được tham chiếu.

### 7.2 Giả định
- Người dùng đã có tài khoản và được phân quyền đúng.
- Hệ thống mạng ổn định.
- Dung lượng file tải lên không vượt quá giới hạn.

---

## 8. Các trường hợp ngoại lệ

| Tình huống | Hành vi hệ thống |
|------------|------------------|
| Mất kết nối internet | Hiển thị thông báo và lưu trạng thái hiện tại (offline mode nếu có). |
| Sai định dạng file tải lên | Từ chối và hiển thị thông báo hỗ trợ định dạng. |
| Quá hạn token | Yêu cầu đăng nhập lại. |
| Xóa dự án có tài liệu | Hỏi xác nhận và thông báo số lượng tài liệu sẽ bị xóa. |
| Trùng tên dự án | Báo lỗi và yêu cầu đặt tên khác. |

---

## 9. Phụ lục

### 9.1 Định dạng dữ liệu
- **Ngày tháng:** Định dạng ISO 8601 (YYYY-MM-DD)
- **Tiền tệ:** VND, hiển thị có dấu phân cách nghìn.
- **Trạng thái dự án:** 'active', 'completed', 'on-hold'

### 9.2 API Reference (tóm tắt)
*(Có thể tham khảo tài liệu API riêng)*

---

## 10. Lịch sử thay đổi

| Ngày | Phiên bản | Người sửa | Nội dung thay đổi |
|------|-----------|-----------|-------------------|
| 2026-07-04 | 1.0 | [Tên] | Tạo mới tài liệu |
| 2026-07-05 | 1.1 | [Tên] | Bổ sung use cases UC05, UC06 |