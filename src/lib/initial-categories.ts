import type { CategoryItem } from "@/lib/types";

export type CategorySeed = Pick<CategoryItem, "workType" | "label" | "sortOrder">;

export const INITIAL_CATEGORIES: CategorySeed[] = [
  { workType: "bhxh", label: "Nộp hồ sơ báo tăng lao động", sortOrder: 10 },
  { workType: "bhxh", label: "Thay đổi mức lương", sortOrder: 20 },
  { workType: "bhxh", label: "Thay đổi nơi khám chữa bệnh", sortOrder: 30 },
  { workType: "bhxh", label: "Đăng ký mở mã đơn vị", sortOrder: 40 },
  { workType: "bhxh", label: "Đóng mã đơn vị", sortOrder: 50 },
  { workType: "bhxh", label: "Đề nghị chốt thêm thời gian tham gia BHXH", sortOrder: 60 },
  { workType: "bhxh", label: "Đề nghị cấp lại quá trình tham gia BHXH", sortOrder: 70 },

  { workType: "tax", label: "Tờ khai thuế TNCN quý", sortOrder: 10 },
  { workType: "tax", label: "Điều chỉnh thông tin người nộp thuế", sortOrder: 20 },
  { workType: "tax", label: "Điều chỉnh thông tin người phụ thuộc", sortOrder: 30 },
  { workType: "tax", label: "Ngưng người phụ thuộc", sortOrder: 40 },
  { workType: "tax", label: "Nộp danh sách NLĐ khấu trừ thuế", sortOrder: 50 },
  { workType: "tax", label: "Tổng hợp thu nhập quý", sortOrder: 60 },
  { workType: "tax", label: "Tổng hợp thu nhập năm theo từng người lao động", sortOrder: 70 },
  { workType: "tax", label: "Kiểm tra thông tin trong tờ khai thuế TNCN quý", sortOrder: 80 },
  { workType: "tax", label: "Kiểm tra thông tin trong tờ khai thuế TNCN năm", sortOrder: 90 },
  { workType: "tax", label: "Tổng hợp số liệu xuất chứng từ khấu trừ thuế", sortOrder: 100 },
  { workType: "tax", label: "Kiểm tra thông tin trong chứng từ khấu trừ thuế", sortOrder: 110 },
  { workType: "tax", label: "Kiểm tra danh sách khấu trừ thuế", sortOrder: 120 },
  { workType: "tax", label: "Hướng dẫn đơn vị chuyển tiền để gia hạn phần mềm, CKS", sortOrder: 130 },

  { workType: "other", label: "Gửi bảng lương cho đơn vị", sortOrder: 10 },
  { workType: "other", label: "Scan ủy nhiệm chi", sortOrder: 20 },
  { workType: "other", label: "Gia hạn chữ ký số", sortOrder: 30 },
  { workType: "other", label: "Gia hạn phần mềm thuế", sortOrder: 40 },
  { workType: "other", label: "Giải đáp các thắc mắc của đơn vị liên quan đến chế độ BHXH, thuế", sortOrder: 50 },
  { workType: "other", label: "Liên hệ cơ quan thuế xử lý hồ sơ cho đơn vị", sortOrder: 60 },
  { workType: "other", label: "Liên hệ cơ quan BHXH xử lý hồ sơ cho đơn vị", sortOrder: 70 },
  { workType: "other", label: "Gửi CKS theo Đề nghị của đơn vị", sortOrder: 80 },
  { workType: "other", label: "Tìm kiếm hồ sơ các năm trước, Scan và Gửi cho đơn vị", sortOrder: 90 },
  { workType: "other", label: "Scan bảng lương", sortOrder: 100 },

  { workType: "vocational", label: "Cập nhật lịch khai giảng", sortOrder: 10 },
  { workType: "vocational", label: "Tổng hợp số lượng quyết định đã ban hành theo từng cơ sở đào tạo, từng nghề theo quý", sortOrder: 20 },
  { workType: "vocational", label: "Tổng hợp số lượng quyết định đã ban hành theo từng cơ sở đào tạo, từng nghề theo năm", sortOrder: 30 },
  { workType: "vocational", label: "Kiểm tra hồ sơ pháp lý", sortOrder: 40 }
];
