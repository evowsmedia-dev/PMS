export type DocTemplateId = "blank" | "rfid-process-flow";

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
    content: `**Actor:** _(VD: Thủ kho)_
**RFID:** _(VD: Scan hàng loạt / Scan đơn lẻ)_
**Chứng từ:** _(VD: Phiếu nhập/xuất NPL)_

## Mô tả nghiệp vụ

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
};
