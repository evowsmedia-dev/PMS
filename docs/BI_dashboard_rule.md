# Bảng công thức các chỉ số dự án phần mềm

## I. Nhóm chỉ số Tiến độ & Thời gian

| Chỉ số | Công thức | Nguồn dữ liệu đầu vào (Input) | Giải thích / Áp dụng |
| :--- | :--- | :--- | :--- |
| **Tỷ lệ phần trăm hoàn thành (Progress %)** | `(Nỗ lực thực tế / Nỗ lực dự kiến khi hoàn thành) × 100` | `Actual effort`, `Estimate at Complete (EAC)` | Theo dõi tiến độ thực tế của từng task/dự án. |
| **Phần trăm hoàn thành theo kế hoạch (Target %)** | `(Số giờ dự kiến / Tổng giờ kế hoạch) × 100`<br>Trong đó: `Số giờ dự kiến = (Thời gian dự kiến × Tổng giờ kế hoạch) / Thời gian kế hoạch` | `Planned effort`, `Planned start/finish date`, `Current date` | So sánh với % thực tế để phát hiện chênh lệch. |
| **Thời gian hoàn thành trung bình (Cycle Time)** | `Tổng thời gian hoàn thành tất cả task / Tổng số task` | `Task completion timestamps` (ngày bắt đầu và kết thúc) | Đo hiệu suất xử lý công việc trung bình. |
| **Thời gian dẫn (Lead Time)** | `Thời gian từ lúc yêu cầu được tạo đến lúc hoàn thành` | `Request creation date`, `Completion date` | Đo thời gian chờ đợi của khách hàng/người dùng. |
| **Tỷ lệ hoàn thành đúng hạn** | `(Số task hoàn thành đúng hạn / Tổng số task) × 100` | `Task due date`, `Actual completion date` | Đánh giá mức độ đáp ứng tiến độ. |
| **Tỷ lệ hoàn thành task** | `(Số task đã hoàn thành / Số task được giao) × 100` | `Assigned tasks`, `Completed tasks` | Đo khối lượng công việc đã xử lý. |
| **Tỷ lệ làm thêm giờ** | `(Tổng số giờ làm thêm / Tổng số giờ làm việc) × 100` | `Overtime hours`, `Total worked hours` | Cảnh báo quá tải và hiệu quả quy trình. |

---

## II. Nhóm chỉ số Hiệu suất Nhóm & Năng suất (Agile/Scrum)

| Chỉ số | Công thức | Nguồn dữ liệu đầu vào (Input) | Giải thích / Áp dụng |
| :--- | :--- | :--- | :--- |
| **Vận tốc nhóm (Team Velocity)** | `Tổng Story Points hoàn thành / Số Sprint` | `Story points` của các user story đã hoàn thành trong sprint | Đo năng suất trung bình của nhóm qua các sprint. |
| **Tốc độ đốt cháy (Burndown Rate)** | `(Khối lượng công việc còn lại / Tổng khối lượng công việc) × 100` | `Remaining work`, `Total work` trong sprint | Theo dõi tiến độ hoàn thành sprint. |

---

## III. Nhóm chỉ số Chi phí & Ngân sách (EVM)

| Chỉ số | Công thức | Nguồn dữ liệu đầu vào (Input) | Giải thích / Áp dụng |
| :--- | :--- | :--- | :--- |
| **Giá trị thu được (Earned Value - EV)** | `% Hoàn thành × Ngân sách khi hoàn thành (BAC)` | `% Completion`, `Budget at Completion (BAC)` | Giá trị công việc thực tế hoàn thành. |
| **Giá trị theo kế hoạch (Planned Value - PV)** | `% Kế hoạch × BAC` | `% Planned`, `BAC` | Giá trị công việc dự kiến hoàn thành theo kế hoạch. |
| **Chi phí thực tế (Actual Cost - AC)** | Tổng chi phí thực tế đã chi đến thời điểm hiện tại | `Actual costs` từ hệ thống kế toán/chấm công | – |
| **Chênh lệch tiến độ (Schedule Variance - SV)** | `EV - PV` | `EV`, `PV` | >0: vượt tiến độ; <0: chậm tiến độ. |
| **Chỉ số hiệu suất tiến độ (SPI)** | `EV / PV` | `EV`, `PV` | >1: hiệu quả tốt; <1: kém hiệu quả. |
| **Chênh lệch chi phí (Cost Variance - CV)** | `EV - AC` | `EV`, `AC` | >0: dưới ngân sách; <0: vượt ngân sách. |
| **Chỉ số hiệu suất chi phí (CPI)** | `EV / AC` | `EV`, `AC` | >1: hiệu quả chi phí tốt; <1: kém. |
| **Dự toán khi hoàn thành (EAC)** | `AC + (BAC - EV) / CPI` | `AC`, `BAC`, `EV`, `CPI` | Dự báo tổng chi phí cuối cùng của dự án. |

---

## IV. Nhóm chỉ số Chất lượng & Rủi ro

| Chỉ số | Công thức | Nguồn dữ liệu đầu vào (Input) | Giải thích / Áp dụng |
| :--- | :--- | :--- | :--- |
| **Tỷ lệ lỗi (Defect Rate)** | `(Số lỗi / Tổng số sản phẩm bàn giao) × 100` | `Defects`, `Total deliverables` | Đo chất lượng sản phẩm bàn giao. |
| **Mức độ rủi ro (Risk Exposure)** | `Xác suất × Tác động` | `Probability`, `Impact` của từng rủi ro | Đánh giá mức độ nghiêm trọng của rủi ro. |
| **Tỷ lệ giải quyết vấn đề** | `(Số vấn đề đã giải quyết / Tổng số vấn đề) × 100` | `Resolved issues`, `Total issues` | Đánh giá khả năng xử lý sự cố. |

---

## V. Nhóm chỉ số Phạm vi & Nguồn lực

| Chỉ số | Công thức | Nguồn dữ liệu đầu vào (Input) | Giải thích / Áp dụng |
| :--- | :--- | :--- | :--- |
| **Tỷ lệ thay đổi phạm vi** | `(Số thay đổi phạm vi / Số sản phẩm ban đầu) × 100` | `Scope changes`, `Original deliverables` | Cảnh báo tình trạng "phạm vi bị kéo dài" (scope creep). |
| **Tỷ lệ sử dụng nguồn lực** | `(Số giờ làm việc / Số giờ khả dụng) × 100` | `Hours worked`, `Available hours` | Đo mức độ sử dụng nhân lực. |

---

## Hướng dẫn triển khai trong phần mềm

- **Tự động hóa**: Tất cả các công thức trên đều có thể lập trình tự động tính toán từ dữ liệu đầu vào (giờ công, ngày tháng, chi phí, v.v.) để giảm sai sót và tiết kiệm thời gian.
- **Cài ngưỡng cảnh báo**: Thiết lập các ngưỡng cho `SPI < 0.8`, `CPI < 0.9`, `Cycle Time > X ngày`, v.v. để hệ thống tự động thông báo cho quản lý.
- **Cá nhân hóa Dashboard**: Cho phép người dùng lựa chọn nhóm chỉ số phù hợp với vai trò (quản lý cấp cao hay cấp trung).

## Mapping hiện tại trong PMS

- `/dashboard/overview` là BI dashboard portfolio tổng hợp tất cả dự án user có quyền xem; admin thấy toàn bộ dự án active. Dữ liệu auto-refresh theo chu kỳ cấp cao và click từng dự án để drill-down vào BI riêng của dự án.
- `/projects/:projectId/bi-dashboard?view=executive` là tab mặc định cho quản lý cấp cao của một dự án, tập trung health, progress, SPI proxy, effort/cost proxy, rủi ro và nguồn lực.
- `/projects/:projectId/bi-dashboard?view=manager` là tab quản lý cấp trung, tập trung task, burndown, cycle/lead time, overdue/blocked, defect và hiệu suất thành viên; dữ liệu auto-refresh theo chu kỳ vận hành.
- Chỉ số tự động chỉ dùng dữ liệu thật hiện có: `Task`, `Bug`, `TimeLog`, `ProjectEstimatedTimelineItem`, `DailyProjectSnapshot`, `Sprint`, `ProjectMember`. Chỉ số chưa có nguồn dữ liệu như AC/CPI/CV/EAC tài chính, overtime thật, risk register và scope baseline phải hiển thị "Chưa cấu hình dữ liệu".
