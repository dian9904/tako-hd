(() => {
  const STORAGE_KEY = "tako-ramen-manager-v2";
  const STORAGE_BACKUP_KEY = `${STORAGE_KEY}-last-safe-backup`;
  const RETIRED_STORAGE_KEYS = ["tako-ramen-manager-v1"];
  const ACCESS_STORAGE_KEY = "tako-ramen-access-v1";
  const ROLE_SESSION_KEY = "tako-ramen-active-role-v1";
  const ACCOUNTANT_ROLE = "accountant";
  const OBSERVER_ROLE = "observer";
  const KITCHEN_ROLE = "kitchen";
  const ONLINE_VIEWER_CONFIG = window.TAKO_ONLINE_VIEWER_CONFIG || null;
  const ONLINE_VIEWER_MODE = Boolean(ONLINE_VIEWER_CONFIG?.supabaseUrl && ONLINE_VIEWER_CONFIG?.publishableKey);
  const OBSERVER_HIDDEN_VIEWS = new Set(["employee-claims", "payroll", "ingredients", "ingredient-waste", "cost"]);
  const KITCHEN_ALLOWED_VIEWS = new Set(["ingredients", "ingredient-waste", "cost"]);
  const ADVANCE_SETTLEMENT_SOURCE = "Cấn trừ tạm ứng NCC";
  const COLORS = ["#111111", "#e60012", "#880000", "#f87171", "#a86a14", "#6f6666", "#ffffff", "#2b2b2b"];
  // Level 1: hệ thống nhóm P&L cố định. Mã và loại dùng để báo cáo nhất quán
  // giữa các kỳ; người dùng chỉ thêm/sửa Level 2 (mã chi) bên trong các nhóm này.
  const PNL_GROUPS = [
    { code: "REV", name: "Doanh thu", type: "Revenue", usage: "Doanh thu tại quầy, App, thẻ và các kênh bán." },
    { code: "DISC", name: "Giảm trừ doanh thu", type: "Contra Revenue", usage: "Chiết khấu, voucher, hoàn/giảm doanh thu hợp lệ." },
    { code: "COGS", name: "Giá vốn hàng bán", type: "Cost of Sales", usage: "Nguyên liệu, hao hụt, hủy món và bao bì trực tiếp." },
    { code: "PAY", name: "Chi phí nhân sự", type: "Operating Expense", usage: "Lương, thưởng, tăng ca, phúc lợi và bảo hiểm." },
    { code: "RENT", name: "Chi phí thuê mặt bằng", type: "Operating Expense", usage: "Thuê quán, kho, bếp và phí quản lý mặt bằng." },
    { code: "UTIL", name: "Chi phí tiện ích", type: "Operating Expense", usage: "Điện, nước, gas, Internet, điện thoại, rác, camera." },
    { code: "PACK", name: "Bao bì", type: "Operating Expense", usage: "Hộp, ly, túi, tem, seal và vật tư đóng gói gián tiếp." },
    { code: "INB", name: "Phí vận chuyển hàng về", type: "Cost of Sales", usage: "Chi phí vận chuyển nguyên vật liệu, hàng hóa mua vào." },
    { code: "MKT", name: "Marketing & Quảng cáo", type: "Operating Expense", usage: "Ads, KOL/KOC, voucher, thiết kế, in ấn, hình ảnh." },
    { code: "OUTB", name: "Giao hàng & Hoa hồng sàn", type: "Operating Expense", usage: "Ship, commission, phí COD và phí nền tảng giao hàng." },
    { code: "REP", name: "Sửa chữa & Bảo trì", type: "Operating Expense", usage: "Sửa máy móc, POS, điện nước, tủ mát/tủ đông." },
    { code: "DEP", name: "Khấu hao", type: "Operating Expense", usage: "Khấu hao máy móc, thiết bị, xe và nội thất." },
    { code: "TOOL", name: "Công cụ dụng cụ", type: "Operating Expense", usage: "Dao, thớt, nồi chảo, bếp, kệ, bàn ghế, chén ly." },
    { code: "OFFICE", name: "Văn phòng phẩm", type: "Operating Expense", usage: "Giấy, bút, sổ sách, mực in và đồ văn phòng." },
    { code: "TAX", name: "Thuế & Phí", type: "Operating Expense", usage: "VAT, thuế môn bài, lệ phí và thuế hộ kinh doanh." },
    { code: "FIN", name: "Chi phí tài chính", type: "Financial", usage: "Lãi vay, phí ngân hàng, chuyển khoản, QR và thẻ." },
    { code: "OTHER", name: "Thu nhập / Chi phí khác", type: "Other", usage: "Thanh lý, phạt, bồi thường, ủng hộ, hoàn nhập." },
    { code: "CIT", name: "Thuế TNDN", type: "Tax", usage: "Thuế thu nhập doanh nghiệp." },
  ];
  const PNL_SCHEMA_VERSION = 3;
  const EMPLOYEE_CATEGORY_SCHEMA_VERSION = 1;
  const CATEGORY_CODE_SCHEMA_VERSION = 1;
  // Từ schema 2: mã chi chỉ là tài khoản/nhóm chi. Nhà cung cấp nằm ở chứng từ
  // phát sinh để cùng một sản phẩm/mã COGS vẫn mua được từ nhiều NCC khác nhau.
  const CATEGORY_SUPPLIER_SCHEMA_VERSION = 2;
  const CATEGORY_DUPLICATE_SCHEMA_VERSION = 2;
  const INGREDIENT_UNIT_SCHEMA_VERSION = 1;
  const SUPPLIER_ADVANCE_CLEANUP_VERSION = 1;
  const FUND_ACCOUNT_CLEANUP_VERSION = 1;
  // Dọn dữ liệu phát sinh trước khi đưa hệ thống vào chạy thật. Giữ lại danh mục vận hành
  // như mã chi, NCC, nguyên vật liệu và nhân sự; chỉ xóa số liệu giao dịch/kế toán.
  const TRANSACTION_CLEANUP_VERSION = 1;
  const STANDARD_EMPLOYEE_CATEGORIES = [
    { code: "L1", name: "Lương cơ bản / lương ca", payrollOnly: true, pnl: true, note: "Nhập tại Chi trả lương theo từng nhân viên." },
    { code: "L1.1", name: "Thưởng / KPI / lễ Tết", payrollOnly: true, pnl: true, note: "Nhập tại Chi trả lương theo từng nhân viên." },
    { code: "L2", name: "Ăn ca / Makanai", payrollOnly: false, pnl: true, note: "Nhập tại Chi phí khi quán thanh toán." },
    { code: "L4", name: "Liên hoan / phúc lợi nhân viên", payrollOnly: false, pnl: true, note: "Nhập tại Chi phí khi quán thanh toán." },
    { code: "L5", name: "Du lịch / team building nhân viên", payrollOnly: false, pnl: true, note: "Nhập tại Chi phí khi quán thanh toán." },
  ];
  const PNL_GROUP_BY_CODE = new Map(PNL_GROUPS.map(group => [group.code, group]));
  const pnlGroupLabel = (code) => {
    const group = PNL_GROUP_BY_CODE.get(code) || PNL_GROUP_BY_CODE.get("OTHER");
    return `${group.code} · ${group.name}`;
  };
  const pnlGroupCodeFromValue = (value) => {
    const text = String(value || "").trim();
    if (PNL_GROUP_BY_CODE.has(text)) return text;
    const group = PNL_GROUPS.find(item => text === item.name || text === `${item.code} · ${item.name}`);
    return group?.code || "";
  };
  const LEGACY_GROUP_CODES = {
    "Thực phẩm / Nguyên liệu": "COGS",
    "Vật tư tiêu hao": "TOOL",
    "Nhân sự": "PAY",
    "Chi phí vận hành cố định": "UTIL",
    "Marketing / Bán hàng": "MKT",
    "Thuế / Phạt": "TAX",
    "Điều chỉnh / Khác": "OTHER",
  };
  const legacyCategoryGroupCode = (category) => {
    const code = String(category?.code || "").toUpperCase();
    if (/^T\d/.test(code)) return "COGS";
    if (/^L\d/.test(code) || code === "UL") return "PAY";
    if (code === "C1") return "RENT";
    if (/^C[2-5]$/.test(code)) return "UTIL";
    if (code === "V1" || code === "V4") return "TOOL";
    if (code === "V2") return "REP";
    if (code === "V3") return "MKT";
    if (["M1", "M2", "M3"].includes(code)) return "MKT";
    if (["M4", "M5"].includes(code)) return "DEL";
    if (code === "M6") return "FIN";
    if (code === "P1") return "TAX";
    if (code === "P2" || /^K\d/.test(code)) return "OTHER";
    return pnlGroupCodeFromValue(category?.pnlGroupCode) || pnlGroupCodeFromValue(category?.group) || LEGACY_GROUP_CODES[category?.group] || "OTHER";
  };
  const CASH_SOURCE = "Tiền mặt";
  const TRANSFER_SOURCE = "Chuyển khoản";
  const DEFAULT_SOURCES = [CASH_SOURCE, TRANSFER_SOURCE];
  // Ngưỡng mặc định để theo dõi vận hành nhà hàng. Có thể nâng cấp thành phần
  // thiết lập riêng sau này, nhưng luôn lưu vào dữ liệu để các kỳ báo cáo dùng nhất quán.
  const DEFAULT_KPI_TARGETS = {
    // Kế hoạch vận hành chuẩn: 65 suất/ngày × 55.000 đồng, bán đủ 30 ngày.
    // Giá vốn nguyên liệu chiếm 47%; nhân sự 7 triệu lương cứng + 2 triệu KPI.
    kpiVersion: 12,
    primeCost: 0.65,
    ingredientPurchase: 0.47,
    payroll: 0.20,
    fixedCost: 0.08,
    netMargin: 0.15,
    dailyPortions: 65,
    averageTicket: 55000,
    operatingDaysPerMonth: 30,
    dailyRevenue: 3575000,
    monthlyRevenueTarget: 70000000,
    // Điểm hòa vốn được tính động theo số nhân sự đang hoạt động trong Danh mục:
    // [(mặt bằng + điện nước + gas) + số nhân sự × (lương cứng + KPI)] / (1 - giá vốn).
    monthlyRent: 4000000,
    monthlyUtilities: 1000000,
    monthlyGas: 800000,
    monthlyPosAndPrinter: 2500000,
    monthlyBaseSalaryPerEmployee: 7000000,
    monthlyKpiPerEmployee: 2000000,
    safeDailyRevenue: 1980000,
    cashVariance: 0,
    appPayoutDays: 14,
  };
  const ACCOUNT_TYPES = { cash: "Tiền mặt", bank: "Ngân hàng", app: "App chờ đối soát" };
  const DEFAULT_ACCOUNTS = [
    { id: "cash-operating", name: "Tiền mặt vận hành", type: "cash", openingBalance: 0, active: true, system: true },
    { id: "cash-management", name: "Két tổng / Quản lý", type: "cash", openingBalance: 0, active: true, system: true },
    { id: "bank-restaurant", name: "Tài khoản ngân hàng", type: "bank", openingBalance: 0, active: true, system: true },
    { id: "app-clearing", name: "App chờ đối soát", type: "app", openingBalance: 0, active: true, system: true },
  ];
  const DEFAULT_NVL_STANDARDS = [
    { name: "Râu bạch tuộc đông lạnh", specification: "Túi 1Kg", purchaseUnit: "túi", conversionFactor: 1000, stockUnit: "g" },
    { name: "Hành tây trắng", specification: "Mua theo kg", purchaseUnit: "kg", conversionFactor: 1000, stockUnit: "g" },
    { name: "Ngô ngọt", specification: "Mua theo kg", purchaseUnit: "kg", conversionFactor: 1000, stockUnit: "g" },
    { name: "Phô Mai Mozzarella", specification: "Khối 2,5Kg", purchaseUnit: "khối", conversionFactor: 2500, stockUnit: "g" },
    { name: "Cá ngừ bào mỏng KATSUO", specification: "Gói 500Gr", purchaseUnit: "gói", conversionFactor: 500, stockUnit: "g" },
    { name: "Trứng cá chuồn Tobiko", specification: "Hộp 500Gr", purchaseUnit: "hộp", conversionFactor: 500, stockUnit: "g" },
    { name: "Vụn rong biển mix Tân Trúc", specification: "Gói 250Gr", purchaseUnit: "gói", conversionFactor: 250, stockUnit: "g" },
    { name: "Bột ớt nhật Tân Trúc", specification: "Gói 200Gr", purchaseUnit: "gói", conversionFactor: 200, stockUnit: "g" },
    { name: "Bột rong biển Tân Trúc", specification: "Gói 200Gr", purchaseUnit: "gói", conversionFactor: 200, stockUnit: "g" },
    { name: "Nước tương Takoyaki", specification: "Túi 1000Ml", purchaseUnit: "túi", conversionFactor: 1000, stockUnit: "ml" },
    { name: "Sốt Teri", specification: "Túi 1000Ml", purchaseUnit: "túi", conversionFactor: 1000, stockUnit: "ml" },
    { name: "Sốt chua cay", specification: "Túi 1000Ml", purchaseUnit: "túi", conversionFactor: 1000, stockUnit: "ml" },
    { name: "Sốt cay ngọt", specification: "Túi 1000Ml", purchaseUnit: "túi", conversionFactor: 1000, stockUnit: "ml" },
    { name: "Sốt mù tạt xanh", specification: "Túi 1000Ml", purchaseUnit: "túi", conversionFactor: 1000, stockUnit: "ml" },
    { name: "Sốt mù tạt vàng", specification: "Túi 1000Ml", purchaseUnit: "túi", conversionFactor: 1000, stockUnit: "ml" },
    { name: "Sốt phomai", specification: "Túi 1000Ml", purchaseUnit: "túi", conversionFactor: 1000, stockUnit: "ml" },
    { name: "Sốt mè rang", specification: "Túi 1000Ml", purchaseUnit: "túi", conversionFactor: 1000, stockUnit: "ml" },
    { name: "Chà bông xù", specification: "Túi 1Kg", purchaseUnit: "túi", conversionFactor: 1000, stockUnit: "g" },
    { name: "Sốt mayonaise Kewpie", specification: "Túi 3Kg", purchaseUnit: "túi", conversionFactor: 3000, stockUnit: "g" },
    { name: "Bột bánh takoyaki", specification: "Túi 1Kg", purchaseUnit: "túi", conversionFactor: 1000, stockUnit: "g" },
    { name: "Túi nilong", specification: "Túi 2kg - 1kg", purchaseUnit: "túi", conversionFactor: 1, stockUnit: "túi" },
    { name: "Đường mía lỏng Wonderfull", specification: "Can 7Kg", purchaseUnit: "can", conversionFactor: 7000, stockUnit: "g" },
    { name: "Rong biển tươi Hàn Quốc", specification: "Túi 1Kg", purchaseUnit: "túi", conversionFactor: 1000, stockUnit: "g" },
  ];
  const cost2Line = (name, unit, qty4, qty6, qty8, cost4, cost6, cost8) => ({ name, unit, qty4, qty6, qty8, cost4, cost6, cost8 });
  const cost2Recipe = (index, name, sizes, lines) => ({ sourceKey: `cost2-cost-${index}`, sourceFile: "Cost_2 - COST.csv", name, sizes, lines });
  const COST2_COST_RECIPE_TEMPLATES = [
    cost2Recipe(1, "TAKOYAKI · Vị Truyền Thống", [{ label: "4 bánh", cost: 14874, price: 35000, margin: .58 }, { label: "6 bánh", cost: 20387, price: 50000, margin: .59 }, { label: "8 bánh", cost: 26741, price: 65000, margin: .59 }], [
      cost2Line("Bánh takoyaki đã nướng", "viên", 4, 6, 8, 8660, 12990, 17320),
      cost2Line("Sốt Teri", "ml", 10, 15, 20, 1550, 2325, 3100),
      cost2Line("Sốt mayonaise Kewpie 3Kg", "ml", 10, 15, 20, 817, 1225, 1633),
      cost2Line("Bột rong biển", "g", .5, .5, .5, 288, 288, 288),
      cost2Line("Cá ngừ bào", "g", 2, 2, 3, 1680, 1680, 2520),
      cost2Line("Hộp giấy", "cái", 1, 1, 1, 1800, 1800, 1800),
      cost2Line("Túi", "cái", 1, 1, 1, 80, 80, 80),
    ]),
    cost2Recipe(2, "TERITAMA · Vị Kem Trứng", [{ label: "4 bánh", cost: 18805, price: 50000, margin: .62 }, { label: "6 bánh", cost: 29817, price: 65000, margin: .54 }, { label: "8 bánh", cost: 38190, price: 80000, margin: .52 }], [
      cost2Line("Bánh takoyaki đã nướng", "viên", 4, 6, 8, 8660, 12990, 17320),
      cost2Line("Sốt Teri túi 1000Ml", "ml", 10, 15, 20, 1550, 2325, 3100),
      cost2Line("Sốt mayonaise 1000Ml", "g", 5, 10, 15, 408, 817, 1225),
      cost2Line("Bột rong biển", "g", .5, .5, .5, 288, 288, 288),
      cost2Line("Hỗn hợp kem trứng", "g", 60, 120, 150, 5279, 10558, 13198),
      cost2Line("Bột ớt nhật gói 200Gr", "g", .5, .5, 1, 300, 300, 300),
      cost2Line("Vụn rong biển mix 250Gr", "g", 2, 3, 4, 440, 660, 880),
      cost2Line("Hộp giấy đựng bánh mang đi có Logo thương hiệu - 4 & 6 bánh", "cái", 1, 1, 1, 1800, 1800, 1800),
      cost2Line("Túi", "cái", 1, 1, 1, 80, 80, 80),
    ]),
    cost2Recipe(3, "DOUPLE CHEESE · Vị Phô Mai", [{ label: "4 bánh", cost: 17965, price: 55000, margin: .67 }, { label: "6 bánh", cost: 26050, price: 75000, margin: .65 }, { label: "8 bánh", cost: 33195, price: 95000, margin: .65 }], [
      cost2Line("Bánh takoyaki đã nướng", "viên", 4, 6, 8, 8660, 12990, 17320),
      cost2Line("Sốt phomai túi 1000Ml", "ml", 10, 15, 20, 1700, 2550, 3400),
      cost2Line("Chà bông xù 1Kg", "g", 5, 10, 15, 1025, 2050, 3075),
      cost2Line("Phô Mai Mozzarella Oldenburger - Khối 2,5Kg", "g", 25, 35, 40, 4700, 6580, 7520),
      cost2Line("Hộp giấy đựng bánh mang đi có Logo thương hiệu - 4 & 6 bánh", "cái", 1, 1, 1, 1800, 1800, 1800),
      cost2Line("Túi", "cái", 1, 1, 1, 80, 80, 80),
    ]),
    cost2Recipe(4, "SUCOSHI WASHABI · Vị Mù Tạt Xanh", [{ label: "4 bánh", cost: 14302, price: 45000, margin: .68 }, { label: "6 bánh", cost: 21307, price: 60000, margin: .64 }, { label: "8 bánh", cost: 28312, price: 75000, margin: .62 }], [
      cost2Line("Bánh takoyaki đã nướng", "viên", 4, 6, 8, 8660, 12990, 17320),
      cost2Line("Sốt mù tạt xanh túi 1000Ml", "ml", 10, 15, 20, 1600, 2400, 3200),
      cost2Line("Sốt Teri túi 1000Ml", "ml", 5, 10, 15, 775, 1550, 2325),
      cost2Line("Bột rong biển", "g", .5, .5, .5, 288, 288, 288),
      cost2Line("Vụn rong biển mix 250Gr", "g", 5, 10, 15, 1100, 2200, 3300),
      cost2Line("Hộp giấy đựng bánh mang đi có Logo thương hiệu - 4 & 6 bánh", "cái", 1, 1, 1, 1800, 1800, 1800),
      cost2Line("Túi", "cái", 1, 1, 1, 80, 80, 80),
    ]),
    cost2Recipe(5, "HONEY WASHABI · Vị Mù Tạt Vàng", [{ label: "4 bánh", cost: 13877, price: 50000, margin: .72 }, { label: "6 bánh", cost: 20282, price: 65000, margin: .69 }, { label: "8 bánh", cost: 26687, price: 80000, margin: .67 }], [
      cost2Line("Bánh takoyaki đã nướng", "viên", 4, 6, 8, 8660, 12990, 17320),
      cost2Line("Sốt mù tạt vàng túi 1000Ml", "ml", 10, 15, 20, 1950, 2925, 3900),
      cost2Line("Bột rong biển", "g", .5, .5, .5, 288, 288, 288),
      cost2Line("Vụn rong biển mix 250Gr", "g", 5, 10, 15, 1100, 2200, 3300),
      cost2Line("Hộp giấy đựng bánh mang đi có Logo thương hiệu - 4 & 6 bánh", "cái", 1, 1, 1, 1800, 1800, 1800),
      cost2Line("Túi", "cái", 1, 1, 1, 80, 80, 80),
    ]),
    cost2Recipe(6, "TAKOKARAI · Vị Chua Cay", [{ label: "4 bánh", cost: 14580, price: 45000, margin: .68 }, { label: "6 bánh", cost: 21750, price: 60000, margin: .64 }, { label: "8 bánh", cost: 28920, price: 75000, margin: .61 }], [
      cost2Line("Bánh takoyaki đã nướng", "viên", 4, 6, 8, 8660, 12990, 17320),
      cost2Line("Sốt chua cay túi 1000Ml", "ml", 10, 15, 20, 1800, 2700, 3600),
      cost2Line("Bột ớt Nhật", "g", .5, .5, .5, 300, 300, 300),
      cost2Line("Vụn rong biển mix 250Gr", "g", 5, 10, 15, 1100, 2200, 3300),
      cost2Line("Cá ngừ bào", "g", 1, 2, 3, 840, 1680, 2520),
      cost2Line("Hộp giấy đựng bánh mang đi có Logo thương hiệu - 4 & 6 bánh", "cái", 1, 1, 1, 1800, 1800, 1800),
      cost2Line("Túi", "cái", 1, 1, 1, 80, 80, 80),
    ]),
    cost2Recipe(7, "Cheese Sweet · Phô mai Cay Ngọt", [{ label: "4 bánh", cost: 20820, price: 65000, margin: .68 }, { label: "6 bánh", cost: 29670, price: 85000, margin: .65 }, { label: "8 bánh", cost: 37580, price: 100000, margin: .62 }], [
      cost2Line("Bánh takoyaki đã nướng", "viên", 4, 6, 8, 8660, 12990, 17320),
      cost2Line("Sốt cay ngọt túi 1000Ml", "ml", 20, 30, 40, 3600, 5400, 7200),
      cost2Line("Bột ớt Nhật", "g", .5, .5, .5, 300, 300, 300),
      cost2Line("Phô Mai Mozzarella Oldenburger - Khối 2,5Kg", "g", 25, 35, 40, 4700, 6580, 7520),
      cost2Line("Cá ngừ bào", "g", 2, 3, 4, 1680, 2520, 3360),
      cost2Line("Hộp giấy đựng bánh mang đi có Logo thương hiệu - 4 & 6 bánh", "cái", 1, 1, 1, 1800, 1800, 1800),
      cost2Line("Túi", "cái", 1, 1, 1, 80, 80, 80),
    ]),
    cost2Recipe(8, "Wakame · Sốt mè rang", [{ label: "4 bánh", cost: 31379, price: 65000, margin: .52 }, { label: "6 bánh", cost: 35957, price: 85000, margin: .58 }, { label: "8 bánh", cost: 48296, price: 100000, margin: .52 }], [
      cost2Line("Bánh takoyaki đã nướng", "viên", 4, 6, 8, 8660, 12990, 17320),
      cost2Line("Sốt Teri túi 1000Ml", "ml", 10, 15, 20, 1550, 2325, 3100),
      cost2Line("Sốt mayonaise Kewpie 3Kg", "ml", 10, 15, 20, 817, 1225, 1633),
      cost2Line("Bột rong biển", "g", .5, .5, .5, 288, 288, 288),
      cost2Line("Rong biển tươi Hàn Quốc 1Kg", "g", 20, 30, 35, 3600, 5400, 6300),
      cost2Line("Sốt mè rang túi 1000Ml", "ml", 5, 10, 15, 725, 1450, 2175),
      cost2Line("Trứng cá chuồn Tobiko 500Gr", "g", 5, 10, 15, 5200, 10400, 15600),
      cost2Line("Hộp giấy đựng bánh mang đi có Logo thương hiệu - 4 & 6 bánh", "cái", 1, 1, 1, 1800, 1800, 1800),
      cost2Line("Túi", "cái", 1, 1, 1, 80, 80, 80),
    ]),
  ];
  const DEFAULT_ACCOUNT_IDS = { cash: "cash-operating", handover: "cash-management", bank: "bank-restaurant", app: "app-clearing" };
  // Các nghiệp vụ này làm thay đổi số dư tiền, nhưng không phải doanh thu hay chi phí.
  // Tách riêng để không làm sai P&L và để bộ lọc báo cáo nhận diện đúng bản chất giao dịch.
  const SPECIAL_CASHFLOW_GROUP = "Điều chỉnh dòng tiền ngoài P&L";
  const LEGACY_SETTLEMENT_ACCOUNT_IDS = new Set(["card-clearing"]);
  RETIRED_STORAGE_KEYS.forEach(key => localStorage.removeItem(key));
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const stored = localStorage.getItem(STORAGE_KEY);
  let state = stored ? JSON.parse(stored) : clone(window.TAKO_SEED || {});
  const writeStateStorage = () => {
    try {
      const current = localStorage.getItem(STORAGE_KEY);
      const next = JSON.stringify(state);
      if (current && current !== next) localStorage.setItem(STORAGE_BACKUP_KEY, current);
      localStorage.setItem(STORAGE_KEY, next);
    } catch (error) {
      console.warn("Không thể lưu dữ liệu TAKO:", error);
    }
  };
  window.TAKO_RESTORE_LAST_SAFE_BACKUP = () => {
    const backup = localStorage.getItem(STORAGE_BACKUP_KEY);
    if (!backup) return false;
    localStorage.setItem(STORAGE_KEY, backup);
    window.location.reload();
    return true;
  };
  const sharedStateRecordCount = (data) => [
    "categories", "ingredients", "supplierProducts", "suppliers", "supplierProfiles", "employees", "menuItems",
    "revenues", "appSales", "appPayouts", "expenses", "payrolls", "employeeClaims",
    "supplierAdvances", "fixedAssets", "inventoryMovements", "fundTransactions", "reconciliations", "accounts",
  ].reduce((total, key) => total + (Array.isArray(data?.[key]) ? data[key].length : 0), 0);
  let serverSyncReady = false;
  let serverSaveTimer = 0;
  let serverSaveInFlight = false;
  let serverSaveQueued = false;
  const queueServerSave = () => {
    if (ONLINE_VIEWER_MODE) return;
    if (!serverSyncReady || !/^https?:$/.test(location.protocol)) return;
    serverSaveQueued = true;
    clearTimeout(serverSaveTimer);
    serverSaveTimer = setTimeout(saveServerState, 450);
  };
  async function saveServerState() {
    if (serverSaveInFlight) return;
    serverSaveInFlight = true;
    serverSaveQueued = false;
    try {
      const response = await fetch("/api/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(state),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
    } catch (error) {
      console.warn("Không thể đồng bộ dữ liệu lên server:", error);
    } finally {
      serverSaveInFlight = false;
      if (serverSaveQueued) saveServerState();
    }
  }
  async function loadServerState() {
    if (ONLINE_VIEWER_MODE) return loadOnlineViewerState();
    if (!/^https?:$/.test(location.protocol)) return;
    const localSnapshot = clone(state);
    let backupSnapshot = null;
    try {
      backupSnapshot = JSON.parse(localStorage.getItem(STORAGE_BACKUP_KEY) || "null");
    } catch (_error) {
      backupSnapshot = null;
    }
    const bestLocalSnapshot = sharedStateRecordCount(backupSnapshot) > sharedStateRecordCount(localSnapshot)
      ? backupSnapshot
      : localSnapshot;
    try {
      const response = await fetch("/api/state", { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      const serverState = payload?.state && typeof payload.state === "object" ? payload.state : null;
      if (!serverState) throw new Error("Dữ liệu server không hợp lệ");
      const serverRecords = sharedStateRecordCount(serverState);
      const localRecords = sharedStateRecordCount(bestLocalSnapshot);
      const seedRecords = sharedStateRecordCount(window.TAKO_SEED || {});
      if ((!payload.exists || serverRecords <= seedRecords + 10) && localRecords > serverRecords) {
        state = bestLocalSnapshot;
        serverSyncReady = true;
        writeStateStorage();
        queueServerSave();
        toast("Đã khởi tạo dữ liệu chung từ dữ liệu cũ trên máy này");
      } else {
        state = serverState;
        let migratedAccessPin = false;
        try {
          const legacyAccess = JSON.parse(localStorage.getItem(ACCESS_STORAGE_KEY) || "{}");
          if (!state.accessControl?.accountantPinHash && legacyAccess.accountantPinHash) {
            state.accessControl = { ...legacyAccess, sharedOnServer: true };
            migratedAccessPin = true;
          }
        } catch (_error) {
          // Bỏ qua cấu hình PIN cũ không hợp lệ.
        }
        serverSyncReady = true;
        writeStateStorage();
        normalizeMasterData();
        if (migratedAccessPin) queueServerSave();
        toast("Đã đồng bộ dữ liệu chung từ server");
        render();
      }
    } catch (error) {
      console.warn("Không thể tải dữ liệu chung từ server:", error);
      serverSyncReady = false;
      toast("Đang dùng dữ liệu trên máy này vì chưa kết nối được server");
    }
  }
  async function loadOnlineViewerState() {
    const table = ONLINE_VIEWER_CONFIG.table || "tako_online_snapshots";
    const id = ONLINE_VIEWER_CONFIG.id || "observer-online-copy";
    const baseUrl = String(ONLINE_VIEWER_CONFIG.supabaseUrl || "").replace(/\/+$/, "");
    try {
      const response = await fetch(`${baseUrl}/rest/v1/${encodeURIComponent(table)}?select=state,updated_at&id=eq.${encodeURIComponent(id)}&limit=1`, {
        cache: "no-store",
        headers: {
          apikey: ONLINE_VIEWER_CONFIG.publishableKey,
          Authorization: `Bearer ${ONLINE_VIEWER_CONFIG.publishableKey}`,
        },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const rows = await response.json();
      const snapshot = Array.isArray(rows) ? rows[0]?.state : null;
      if (!snapshot) throw new Error("Chưa có dữ liệu online từ máy kế toán");
      state = snapshot;
      activeRole = OBSERVER_ROLE;
      sessionStorage.setItem(ROLE_SESSION_KEY, OBSERVER_ROLE);
      writeStateStorage();
      serverSyncReady = false;
      normalizeMasterData();
      toast("Đã tải dữ liệu online quyền Nhân viên quan sát");
      render();
    } catch (error) {
      console.warn("Không thể tải dữ liệu online:", error);
      toast(`Chưa đọc được dữ liệu online: ${error.message}`);
    }
  }
  let activeRole = sessionStorage.getItem(ROLE_SESSION_KEY) || "";
  if (![ACCOUNTANT_ROLE, OBSERVER_ROLE, KITCHEN_ROLE].includes(activeRole)) activeRole = "";
  if (ONLINE_VIEWER_MODE) activeRole = OBSERVER_ROLE;
  let view = "dashboard";
  let catalogTab = "categories";
  let materialTab = "stock";
  let ingredientWasteCompareMode = "month";
  let catalogPnlFilter = "";
  let debtSupplierFilter = "";
  let showVoidedRevenues = false;
  let pendingExpenseAdvanceId = "";

  const app = document.querySelector("#app");
  const periodInput = document.querySelector("#period");
  const reportStartInput = document.querySelector("#report-start");
  const reportEndInput = document.querySelector("#report-end");
  const pageTitle = document.querySelector("#page-title");
  const eyebrow = document.querySelector("#eyebrow");
  const modal = document.querySelector("#modal-backdrop");
  const modalContent = document.querySelector("#modal-content");
  const accessGate = document.querySelector("#access-gate");
  const accessGateContent = document.querySelector("#access-gate-content");
  const accessRoleButton = document.querySelector("#access-role-button");
  const accessRoleBadge = document.querySelector("#access-role-badge");
  const accessRoleCaption = document.querySelector("#access-role-caption");
  const lockSessionButton = document.querySelector("#lock-session-button");
  const currentRoleAvatar = document.querySelector("#current-role-avatar");
  const currentRoleLabel = document.querySelector("#current-role-label");
  const currentRoleDetail = document.querySelector("#current-role-detail");
  const today = new Date().toISOString().slice(0, 10);
  const monthBounds = (monthValue) => {
    const value = String(monthValue || today.slice(0, 7));
    const [year, month] = value.split("-").map(Number);
    const end = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
    return { start: `${value}-01`, end };
  };
  const payrollPeriod = (payroll) => {
    const value = String(payroll?.period || "");
    return /^\d{4}-\d{2}$/.test(value) ? value : String(payroll?.date || today).slice(0, 7);
  };
  // Chi phí lương luôn được trích tại ngày cuối kỳ lương; ngày "date" là ngày tiền thực trả.
  const payrollAccrualDate = (payroll) => monthBounds(payrollPeriod(payroll)).end;
  // Quy định vận hành: lương của một kỳ được thanh toán vào ngày 10 tháng kế tiếp.
  const payrollPaymentDate = (periodValue) => {
    const periodText = /^\d{4}-\d{2}$/.test(String(periodValue || "")) ? String(periodValue) : today.slice(0, 7);
    const [year, month] = periodText.split("-").map(Number);
    return new Date(Date.UTC(year, month, 10)).toISOString().slice(0, 10);
  };
  const periods = [
    ...(state.revenues || []).map(x => x.date?.slice(0, 7)),
    ...(state.appSales || []).map(x => x.date?.slice(0, 7)),
    ...(state.appPayouts || []).flatMap(x => [x.requestDate?.slice(0, 7), x.settledDate?.slice(0, 7)]),
    ...(state.expenses || []).map(x => x.date?.slice(0, 7)),
    ...(state.supplierAdvances || []).flatMap(x => (x.payments || []).map(payment => payment.date?.slice(0, 7))),
    ...(state.payrolls || []).flatMap(x => [x.date?.slice(0, 7), payrollAccrualDate(x).slice(0, 7)]),
    ...(state.fundTransactions || []).map(x => x.date?.slice(0, 7)),
    ...(state.employeeClaims || []).flatMap(x => [x.date?.slice(0, 7), ...(x.recoveries || []).map(recovery => recovery.date?.slice(0, 7))]),
  ].filter(Boolean).sort();
  // Ưu tiên kỳ hiện tại nếu đã có dữ liệu. Ngày chi lương tháng sau không
  // được tự kéo giao diện sang tháng sau và làm người dùng tưởng mất dữ liệu.
  const currentMonth = today.slice(0, 7);
  periodInput.value = periods.includes(currentMonth) ? currentMonth : (periods.at(-1) || currentMonth);
  const initialBounds = monthBounds(periodInput.value);
  reportStartInput.value = initialBounds.start;
  reportEndInput.value = initialBounds.end;

  const fmt = new Intl.NumberFormat("vi-VN");
  const money = (value) => `${fmt.format(Math.round(Number(value) || 0))} ₫`;
  const flowMoney = (value) => {
    const amount = num(value);
    const tone = amount > 0 ? "in" : amount < 0 ? "out" : "zero";
    const sign = amount > 0 ? "+" : amount < 0 ? "-" : "";
    return `<span class="money-flow ${tone}">${sign}${money(Math.abs(amount))}</span>`;
  };
  const pct = (value) => `${((Number(value) || 0) * 100).toFixed(1).replace(".0", "")}%`;
  const dateVi = (value) => value ? new Intl.DateTimeFormat("vi-VN").format(new Date(`${value}T00:00:00`)) : "—";
  const num = (value) => Number(String(value ?? 0).replace(/[^0-9.-]/g, "")) || 0;
  const uid = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const normalizeCatalogText = (value) => String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("vi")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d");
  const recordOrder = (item, fallback = 0) => {
    const explicit = Number(item?.updatedAt || item?.createdAt || item?.sortOrder);
    if (Number.isFinite(explicit) && explicit > 0) return explicit;
    const timestamp = String(item?.id || "").match(/-(\d{10,})-/)?.[1];
    return timestamp ? Number(timestamp) : fallback;
  };
  // Quy ước chung cho mọi danh sách giao dịch: ngày mới ở trên; cùng ngày,
  // dòng được ghi/cập nhật sau cùng ở trên. Không dùng mã chứng từ để sắp xếp.
  const newestFirst = (items, dateOf = (item) => item?.date) => (items || [])
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const dateCompare = String(dateOf(b.item) || "").localeCompare(String(dateOf(a.item) || ""));
      if (dateCompare) return dateCompare;
      const orderCompare = recordOrder(b.item, b.index) - recordOrder(a.item, a.index);
      return orderCompare || b.index - a.index;
    })
    .map(({ item }) => item);
  const localToday = () => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; };
  const compactDate = (dateValue) => String(dateValue || localToday()).replaceAll("-", "");
  const shortCompactDate = (dateValue) => compactDate(dateValue).slice(2);
  const shortCompactMonth = (dateValue) => compactDate(dateValue).slice(2, 6);
  const nextInvoiceCode = (dateValue) => {
    const compact = shortCompactDate(dateValue);
    const legacyCompact = compactDate(dateValue);
    const prefix = `HD-${compact}-`;
    const legacyPrefix = `HD-${legacyCompact}-`;
    let highest = 0;
    for (const item of (state.expenses || [])) {
      const invoice = String(item.invoice || "").toUpperCase();
      const matchedPrefix = invoice.startsWith(prefix) ? prefix : (invoice.startsWith(legacyPrefix) ? legacyPrefix : "");
      if (!matchedPrefix) continue;
      const suffix = invoice.slice(matchedPrefix.length);
      if (/^\d+$/.test(suffix)) highest = Math.max(highest, Number(suffix));
    }
    return `${prefix}${String(highest + 1).padStart(3, "0")}`;
  };
  const nextAppWithdrawalCode = (dateValue) => {
    const compact = String(dateValue || localToday()).replaceAll("-", "");
    const prefix = `APP-${compact}-`;
    let highest = 0;
    for (const item of (state.appPayouts || [])) {
      const code = String(item.withdrawalCode || "").toUpperCase();
      if (!code.startsWith(prefix)) continue;
      const suffix = code.slice(prefix.length);
      if (/^\d+$/.test(suffix)) highest = Math.max(highest, Number(suffix));
    }
    return `${prefix}${String(highest + 1).padStart(3, "0")}`;
  };
  const nextMisreceivedCode = (dateValue) => {
    const compact = String(dateValue || localToday()).replaceAll("-", "");
    const prefix = `NNT-${compact}-`;
    let highest = 0;
    for (const item of (state.fundTransactions || [])) {
      const code = String(item.caseCode || "").toUpperCase();
      if (!code.startsWith(prefix)) continue;
      const suffix = code.slice(prefix.length);
      if (/^\d+$/.test(suffix)) highest = Math.max(highest, Number(suffix));
    }
    return `${prefix}${String(highest + 1).padStart(3, "0")}`;
  };
  const nextEmployeeClaimCode = (dateValue) => {
    const compact = String(dateValue || localToday()).replaceAll("-", "");
    const prefix = `BTNV-${compact}-`;
    let highest = 0;
    for (const item of (state.employeeClaims || [])) {
      const code = String(item.claimCode || "").toUpperCase();
      if (!code.startsWith(prefix)) continue;
      const suffix = code.slice(prefix.length);
      if (/^\d+$/.test(suffix)) highest = Math.max(highest, Number(suffix));
    }
    return `${prefix}${String(highest + 1).padStart(3, "0")}`;
  };
  const nextSupplierAdvanceCode = (dateValue) => {
    const compact = shortCompactMonth(dateValue);
    const dayCompact = shortCompactDate(dateValue);
    const legacyCompact = compactDate(dateValue);
    const prefix = `TU-${compact}-`;
    const legacyPrefixes = [`TU-${dayCompact}-`, `TU-NCC-${dayCompact}-`, `TU-NCC-${legacyCompact}-`];
    let highest = 0;
    for (const item of (state.supplierAdvances || [])) {
      const code = String(item.advanceCode || "").toUpperCase();
      const matchedPrefix = code.startsWith(prefix) ? prefix : legacyPrefixes.find(item => code.startsWith(item));
      let suffix = matchedPrefix ? code.slice(matchedPrefix.length) : "";
      if (!suffix) {
        const legacyMatch = code.match(/^TU(?:-NCC)?-(\d{6}|\d{8})-(\d{3})$/);
        if (legacyMatch && legacyMatch[1].slice(-6, -2) === compact) suffix = legacyMatch[2];
      }
      if (!suffix) continue;
      if (/^\d+$/.test(suffix)) highest = Math.max(highest, Number(suffix));
    }
    return `${prefix}${String(highest + 1).padStart(3, "0")}`;
  };
  const nextEmployeeCode = () => {
    let highest = 0;
    for (const item of (state.employees || [])) {
      const match = String(item.code || "").toUpperCase().match(/^NV-?(\d+)$/);
      if (match) highest = Math.max(highest, Number(match[1]));
    }
    return `NV${String(highest + 1).padStart(3, "0")}`;
  };
  const nextPayrollCode = (periodValue, employeeCode) => {
    const compact = String(periodValue || localToday().slice(0, 7)).replaceAll("-", "");
    const codePart = String(employeeCode || "NV").replace(/[^A-Za-z0-9]/g, "").toUpperCase() || "NV";
    const prefix = `LUONG-${compact}-${codePart}-`;
    let highest = 0;
    for (const item of (state.payrolls || [])) {
      const code = String(item.payrollCode || "").toUpperCase();
      if (!code.startsWith(prefix)) continue;
      const suffix = code.slice(prefix.length);
      if (/^\d+$/.test(suffix)) highest = Math.max(highest, Number(suffix));
    }
    return `${prefix}${String(highest + 1).padStart(3, "0")}`;
  };
  const appPayouts = () => state.appPayouts || [];
  // Doanh thu bị hủy do phát hiện tiền nhận nhầm vẫn được lưu vết trong dữ liệu,
  // nhưng tuyệt đối không được tính vào sổ quỹ, doanh thu hay P&L.
  const isVoidedRevenue = (revenue) => Boolean(revenue?.voidedAt || revenue?.voided?.at);
  const activeRevenues = () => (state.revenues || []).filter(revenue => !isVoidedRevenue(revenue));
  const findAppPayout = (id) => appPayouts().find(item => item.id === id);
  const payoutSales = (payout) => (payout?.appSaleIds || []).map(id => (state.appSales || []).find(item => item.id === id)).filter(Boolean);
  const payoutNet = (payout) => payout?.net === undefined ? payoutSales(payout).reduce((total, item) => total + num(item.net), 0) : num(payout.net);
  const appSalePayout = (sale) => sale?.payoutId ? findAppPayout(sale.payoutId) : null;
  const appSalesWaitingForWithdrawal = (asOfDate = "") => (state.appSales || []).filter(sale => {
    if (num(sale.net) <= 0 || (asOfDate && sale.date > asOfDate)) return false;
    const payout = appSalePayout(sale);
    return !payout || !payout.requestDate || (asOfDate && payout.requestDate > asOfDate);
  });
  const appPayoutsWaitingForPayment = (asOfDate = "") => appPayouts().filter(payout => {
    if (asOfDate && payout.requestDate > asOfDate) return false;
    return !payout.settledDate || (asOfDate && payout.settledDate > asOfDate);
  });
  const appSaleStatus = (sale) => {
    const payout = appSalePayout(sale);
    if (!payout) return { label: "Chưa yêu cầu rút", tone: "gray", payout: null };
    if (payout.settledDate) return { label: `Đã nhận ${dateVi(payout.settledDate)}`, tone: "green", payout };
    return { label: `Chờ app thanh toán · ${payout.withdrawalCode}`, tone: "orange", payout };
  };
  // Hóa đơn cũ chỉ có trường "paid" vẫn được đọc như một lần thanh toán tại ngày hóa đơn.
  // Các khoản mới dùng lịch sử thanh toán để dòng tiền luôn theo đúng ngày thực chi.
  const paymentEntries = (expense) => (Array.isArray(expense?.payments) && expense.payments.length > 0)
    ? expense.payments
    : (num(expense?.paid) > 0 ? [{ id: `legacy-${expense.id || "payment"}`, date: expense.date, amount: num(expense.paid), source: expense.source || "" }] : []);
  const paidAmount = (expense) => paymentEntries(expense).reduce((total, payment) => total + num(payment.amount), 0);
  // Lương gộp có thể được tất toán bằng hai phần: tiền thực trả và khoản
  // bồi thường NV đã khấu trừ. Phần khấu trừ không còn là công nợ phải trả.
  const payrollDeductionAmount = (expense) => Math.max(0, num(expense?.payrollDeduction));
  const expenseOutstanding = (expense) => Math.max(0, num(expense?.amount) - paidAmount(expense) - payrollDeductionAmount(expense));
  // Công nợ phải trả (AP) chỉ hình thành với hóa đơn đã gắn nhà cung cấp.
  // Khấu hao và các bút toán nội bộ có thể có giá trị/đã trả = 0 nhưng không phải công nợ NCC.
  const isSupplierPayable = (expense) => String(expense?.supplier || "").trim() !== "" && expense?.operation !== "Trích khấu hao";
  // Chỉ cho sửa mã chi của phiếu chi thông thường. Lương, CAPEX và khấu hao là
  // bút toán hệ thống có liên kết riêng nên không được đổi mã từ màn hình Chi phí.
  const canEditExpenseCategory = (expense) => Boolean(expense)
    && !expense.payrollId
    && expense.operation !== "Trích khấu hao"
    && expense.operation !== "Đầu tư tài sản (CAPEX)"
    && expense.operation !== "Chênh lệch thanh toán"
    && !expense.fixedAssetId
    && !expense.depreciationAssetKey;
  const canEditExpenseDate = (expense) => Boolean(expense)
    && !expense.payrollId
    && expense.operation !== "Trích khấu hao"
    && expense.operation !== "Chênh lệch thanh toán"
    && !expense.fixedAssetId
    && !expense.depreciationAssetKey;
  const paymentLog = (expenses = state.expenses || []) => expenses.flatMap((expense) => paymentEntries(expense).map((payment) => ({ ...payment, expense })));
  const supplierAdvances = () => state.supplierAdvances || [];
  const findSupplierAdvance = (id) => supplierAdvances().find(item => item.id === id);
  const supplierAdvancePaid = (advance, asOfDate = "") => sum((advance?.payments || []).filter(payment => !asOfDate || payment.date <= asOfDate), "amount");
  const supplierAdvanceApplied = (advance, asOfDate = "") => sum(paymentLog().filter(payment => payment.type === "advance-settlement" && payment.advanceId === advance?.id && (!asOfDate || payment.date <= asOfDate)), "amount");
  const supplierAdvanceAvailable = (advance, asOfDate = "") => Math.max(0, supplierAdvancePaid(advance, asOfDate) - supplierAdvanceApplied(advance, asOfDate));
  const supplierAdvanceSettlementPayment = (advance, amount, dateValue) => ({
    id: uid("pay"),
    date: dateValue,
    source: ADVANCE_SETTLEMENT_SOURCE,
    accountId: "",
    amount: num(amount),
    type: "advance-settlement",
    advanceId: advance?.id || "",
    advanceCode: advance?.advanceCode || advance?.id || "",
  });
  const expenseMentionsAdvance = (expense, advance) => {
    const code = String(advance?.advanceCode || advance?.id || "").trim();
    if (!code) return false;
    const haystack = [expense?.invoice, expense?.note, expense?.description].map(value => String(value || "")).join(" ").toUpperCase();
    return haystack.includes(code.toUpperCase());
  };
  function repairAdvanceInvoiceSettlements() {
    let changed = false;
    for (const expense of (state.expenses || [])) {
      if (!isSupplierPayable(expense) || expenseOutstanding(expense) <= 0) continue;
      if (paymentEntries(expense).some(payment => payment.type === "advance-settlement")) continue;
      const supplierKey = normalizeCatalogText(expense.supplier);
      const candidates = supplierAdvances().filter(advance => normalizeCatalogText(advance.supplier) === supplierKey && supplierAdvanceAvailable(advance, expense.date) > 0);
      const mentioned = candidates.find(advance => expenseMentionsAdvance(expense, advance));
      const exactSingle = candidates.filter(advance => Math.abs(supplierAdvanceAvailable(advance, expense.date) - expenseOutstanding(expense)) < 1);
      const advance = mentioned || (candidates.length === 1 && exactSingle.length === 1 ? exactSingle[0] : null);
      if (!advance) continue;
      const amount = Math.min(expenseOutstanding(expense), supplierAdvanceAvailable(advance, expense.date));
      if (amount <= 0) continue;
      if (!Array.isArray(expense.payments)) expense.payments = paymentEntries(expense).map(payment => ({ ...payment }));
      expense.payments.push(supplierAdvanceSettlementPayment(advance, amount, expense.date));
      expense.paid = paidAmount(expense);
      expense.note = [expense.note || "", `Tự cấn trừ tạm ứng ${advance.advanceCode || advance.id}`].filter(Boolean).join(" · ");
      changed = true;
    }
    if (changed) persist();
    return changed;
  }
  const isRealCashPayment = (payment) => payment?.type !== "advance-settlement";
  const supplierAdvanceOptions = (supplier, asOfDate = "", selected = "") => supplierAdvances()
    .filter(advance => normalizeCatalogText(advance.supplier) === normalizeCatalogText(supplier) && supplierAdvanceAvailable(advance, asOfDate) > 0)
    .sort((a, b) => String(a.advanceCode || "").localeCompare(String(b.advanceCode || ""), "vi"))
    .map(advance => `<option value="${escapeHtml(advance.id)}" ${advance.id === selected ? "selected" : ""}>${escapeHtml(advance.advanceCode || advance.id)} · ${escapeHtml(advance.orderName || "Tạm ứng NCC")} · còn ${money(supplierAdvanceAvailable(advance, asOfDate))}</option>`)
    .join("");
  const invoiceCodeFromAdvance = (advance, fallbackDate = localToday()) => {
    const suffix = String(advance?.advanceCode || "").replace(/^TU-NCC-/, "").replace(/^TU-/, "");
    if (/^\d{6}-\d{3}$/.test(suffix)) return `HD-${suffix}`;
    if (/^\d{8}-\d{3}$/.test(suffix)) return `HD-${suffix.slice(2)}`;
    if (/^\d{4}-\d{3}$/.test(suffix)) return nextInvoiceCode(fallbackDate);
    return nextInvoiceCode(fallbackDate);
  };
  const paidByDate = (expense, dateValue) => paymentEntries(expense)
    .filter((payment) => payment.date && payment.date <= dateValue)
    .reduce((total, payment) => total + num(payment.amount), 0);
  // Dùng cho các báo cáo "tại ngày". Ví dụ: xem tháng 06 thì một hóa đơn
  // tháng 06 trả vào tháng 07 vẫn phải được xem là còn nợ tại 30/06.
  const expenseOutstandingAsOf = (expense, dateValue = "") => Math.max(0, num(expense?.amount) - paidByDate(expense, dateValue));
  // Dòng mới có recordingBasis="net-claim" chỉ ghi số tiền App phải trả theo
  // báo cáo ngày. Không suy diễn phí từ chênh lệch tiền về ngân hàng.
  // Dòng lịch sử giữ nguyên cơ chế giá gộp và các phí đã nhập rõ ràng.
  const appPnlExpenses = (sales = []) => sales.filter(sale => sale.recordingBasis !== "net-claim").flatMap((sale) => [
    { amount: num(sale.ads), code: "APP-ADS", pnlGroupCode: "MKT", description: `Quảng cáo App · ${sale.app || "Khác"}` },
    { amount: num(sale.deduction), code: "APP-FEE", pnlGroupCode: "DEL", description: `Phí / hoa hồng App · ${sale.app || "Khác"}` },
    { amount: num(sale.vat), code: "APP-VAT", pnlGroupCode: "TAX", description: `Thuế GTGT App · ${sale.app || "Khác"}` },
    { amount: num(sale.pit), code: "APP-PIT", pnlGroupCode: "TAX", description: `Thuế TNCN App · ${sale.app || "Khác"}` },
  ].filter(item => item.amount > 0).map(item => ({
    ...item, id: `${sale.id || "app"}-${item.code}`, date: sale.date,
    group: pnlGroupLabel(item.pnlGroupCode), pnl: true, source: "App", operation: "Khấu trừ App tự động", appSaleId: sale.id,
  })));
  const normalizeSource = (source) => ["Quán chi tiền mặt", "Tiền mặt Quán", CASH_SOURCE].includes(source) ? CASH_SOURCE : TRANSFER_SOURCE;
  const supplierNames = () => [...new Set((state.suppliers || []).map(x => String(x || "").trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"vi"));
  const supplierProfile = (name) => (state.supplierProfiles || []).find(profile => normalizeCatalogText(profile.name) === normalizeCatalogText(name)) || { name: String(name || "").trim(), taxCode: "" };
  const supplierTaxCode = (name) => String(supplierProfile(name).taxCode || "").trim();
  const upsertSupplierProfile = (name, taxCode = "") => {
    const cleanName = String(name || "").trim();
    if (!cleanName) return;
    if (!Array.isArray(state.supplierProfiles)) state.supplierProfiles = [];
    const profile = (state.supplierProfiles || []).find(item => normalizeCatalogText(item.name) === normalizeCatalogText(cleanName));
    if (profile) { profile.name = cleanName; profile.taxCode = String(taxCode || "").trim(); }
    else state.supplierProfiles.push({ name: cleanName, taxCode: String(taxCode || "").trim() });
  };
  const supplierProductLinks = () => state.supplierProducts || [];
  const supplierProductKey = (supplier, code) => `${normalizeCatalogText(supplier)}|${String(code || "").trim().toUpperCase()}`;
  const supplierForCategory = (code) => {
    const normalizedCode = String(code || "").trim().toUpperCase();
    const linked = supplierProductLinks().filter(link => String(link.code || "").toUpperCase() === normalizedCode && String(link.supplier || "").trim())
      .sort((a, b) => Number(b.lastUsedAt || b.updatedAt || b.createdAt || 0) - Number(a.lastUsedAt || a.updatedAt || a.createdAt || 0));
    return linked[0]?.supplier || "";
  };
  const preferredSupplierForCategory = (code) => {
    const normalizedCode = String(code || "").trim().toUpperCase();
    if (!normalizedCode) return null;
    const linked = [...supplierProductLinks()]
      .filter(link => String(link.code || "").toUpperCase() === normalizedCode && String(link.supplier || "").trim())
      .sort((a, b) => Number(b.lastUsedAt || b.updatedAt || b.createdAt || 0) - Number(a.lastUsedAt || a.updatedAt || a.createdAt || 0));
    if (linked[0]) return { supplier: linked[0].supplier, source: "NCC hay dùng gần nhất" };
    const historical = newestFirst((state.expenses || []).filter(expense => String(expense.code || "").toUpperCase() === normalizedCode && String(expense.supplier || "").trim()));
    return historical[0] ? { supplier: historical[0].supplier, source: "lần mua gần nhất" } : null;
  };
  const rememberSupplierProduct = (supplier, code, lastUsedAt = Date.now()) => {
    const cleanSupplier = String(supplier || "").trim();
    const cleanCode = String(code || "").trim().toUpperCase();
    if (!cleanSupplier || !cleanCode) return;
    if (!Array.isArray(state.supplierProducts)) state.supplierProducts = [];
    const key = supplierProductKey(cleanSupplier, cleanCode);
    const existing = state.supplierProducts.find(link => supplierProductKey(link.supplier, link.code) === key);
    if (existing) {
      existing.supplier = cleanSupplier;
      existing.code = cleanCode;
      existing.lastUsedAt = Math.max(Number(existing.lastUsedAt || 0), Number(lastUsedAt || 0));
    } else {
      state.supplierProducts.push({ id: uid("supplier-product"), supplier: cleanSupplier, code: cleanCode, createdAt: Date.now(), lastUsedAt: Number(lastUsedAt || Date.now()) });
    }
  };
  const employeeRecoveryCategoryCode = () => (state.categories || []).find(category => category.systemKey === "employee-recovery")?.code || "OTHER-001";
  const isShippingCategory = (category) => {
    const text = normalizeCatalogText(`${category?.code || ""} ${category?.name || ""} ${category?.pnlGroupCode || ""} ${category?.group || ""}`);
    return category?.systemKey === "shipping-fee" || text.includes("phi ship") || text.includes("phi van chuyen");
  };
  const shippingCategory = () => (state.categories || []).find(category => !category.internalOnly && !category.payrollOnly && isShippingCategory(category))
    || null;
  const paymentRoundingCategory = () => (state.categories || []).find(category => category.systemKey === "payment-rounding")
    || (state.categories || []).find(category => normalizeCatalogText(category.name).includes("chenh lech thanh toan"));
  const categorySortIndex = (category) => PNL_GROUPS.findIndex(group => group.code === (category?.pnlGroupCode || legacyCategoryGroupCode(category)));
  const categorySortValue = (code) => {
    const match = String(code || "").toUpperCase().match(/^[A-Z]+-(\d+)$/);
    return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
  };
  const sortCategories = (categories = []) => [...categories].sort((a, b) => {
    const groupDiff = (categorySortIndex(a) < 0 ? 999 : categorySortIndex(a)) - (categorySortIndex(b) < 0 ? 999 : categorySortIndex(b));
    if (groupDiff) return groupDiff;
    const numberDiff = categorySortValue(a.code) - categorySortValue(b.code);
    if (numberDiff) return numberDiff;
    return String(a.code || "").localeCompare(String(b.code || ""), "vi", { numeric: true });
  });
  const ensurePaymentRoundingCategory = () => {
    let category = paymentRoundingCategory();
    if (category) return category;
    const usedNumbers = (state.categories || [])
      .map(item => String(item.code || "").toUpperCase().match(/^FIN-(\d+)$/)?.[1])
      .filter(Boolean)
      .map(value => Number(value));
    category = {
      code: `FIN-${String(usedNumbers.length ? Math.max(...usedNumbers) + 1 : 1).padStart(3, "0")}`,
      name: "Chênh lệch thanh toán",
      supplier: "",
      group: pnlGroupLabel("FIN"),
      pnlGroupCode: "FIN",
      payrollOnly: false,
      pnl: true,
      systemKey: "payment-rounding",
      note: "Tự sinh khi tiền thực thanh toán lớn hơn giá trị chứng từ để sổ ngân hàng khớp sao kê.",
    };
    state.categories.push(category);
    return category;
  };
  const normalizeMasterData = () => {
    let changed = false;
    if (JSON.stringify(state.sources || []) !== JSON.stringify(DEFAULT_SOURCES)) { state.sources = [...DEFAULT_SOURCES]; changed = true; }
    // Chuyển các bộ dữ liệu KPI cũ sang bộ KPI quản trị hiện hành một lần.
    if (!state.targets || num(state.targets.kpiVersion) < DEFAULT_KPI_TARGETS.kpiVersion) {
      state.targets = { ...DEFAULT_KPI_TARGETS };
      changed = true;
    } else {
      const targets = { ...DEFAULT_KPI_TARGETS, ...state.targets };
      if (JSON.stringify(state.targets) !== JSON.stringify(targets)) { state.targets = targets; changed = true; }
    }
    // Chuẩn hóa các nhóm P&L cũ theo Level 1 cố định. Lịch sử hóa đơn được
    // giữ nguyên số tiền, chỉ đổi nhãn/mã nhóm để báo cáo các kỳ thống nhất.
    if (num(state.pnlSchemaVersion) < PNL_SCHEMA_VERSION) {
      const categoryByCode = new Map();
      for (const category of (state.categories || [])) {
        const pnlGroupCode = legacyCategoryGroupCode(category);
        const group = pnlGroupLabel(pnlGroupCode);
        if (category.pnlGroupCode !== pnlGroupCode || category.group !== group) {
          category.pnlGroupCode = pnlGroupCode;
          category.group = group;
          changed = true;
        }
        categoryByCode.set(String(category.code || "").toUpperCase(), category);
      }
      for (const expense of (state.expenses || [])) {
        const category = categoryByCode.get(String(expense.code || "").toUpperCase());
        const pnlGroupCode = category?.pnlGroupCode || legacyCategoryGroupCode(expense);
        const group = pnlGroupLabel(pnlGroupCode);
        if (expense.pnlGroupCode !== pnlGroupCode || expense.group !== group) {
          expense.pnlGroupCode = pnlGroupCode;
          expense.group = group;
          changed = true;
        }
      }
      state.pnlSchemaVersion = PNL_SCHEMA_VERSION;
      changed = true;
    }
    // P2 không còn là "nộp phạt ca". Đây là mã hệ thống nhận diện khoản
    // thu hồi tổn thất nhân viên có hồ sơ/bằng chứng, không phải khoản chi.
    let employeeRecoveryCategory = (state.categories || []).find(category => category.systemKey === "employee-recovery")
      || (state.categories || []).find(category => String(category.code || "").toUpperCase() === "P2");
    const employeeRecoveryValues = {
      code: employeeRecoveryCategory?.code || "P2",
      name: "Thu hồi tổn thất nhân viên",
      group: pnlGroupLabel("OTHER"),
      pnlGroupCode: "OTHER",
      pnl: false,
      internalOnly: true,
      systemKey: "employee-recovery",
      note: "Mã hệ thống: tạo/thu hồi qua Hồ sơ bồi thường nhân viên, không nhập tại phiếu Chi phí.",
    };
    if (employeeRecoveryCategory) {
      for (const [key, value] of Object.entries(employeeRecoveryValues)) {
        if (employeeRecoveryCategory[key] !== value) { employeeRecoveryCategory[key] = value; changed = true; }
      }
    } else {
      employeeRecoveryCategory = employeeRecoveryValues;
      state.categories.push(employeeRecoveryCategory);
      changed = true;
    }
    // Chuẩn hóa vị trí nhập của các khoản nhân sự. Lương và thưởng cần gắn
    // đúng nhân viên nên chỉ xuất hiện trong Chi trả lương; phúc lợi chung
    // của tập thể được hạch toán qua Chi phí nhưng vẫn vào nhóm PAY/P&L.
    if (num(state.employeeCategorySchemaVersion) < EMPLOYEE_CATEGORY_SCHEMA_VERSION) {
      for (const template of STANDARD_EMPLOYEE_CATEGORIES) {
        const existing = (state.categories || []).find(category => String(category.code || "").toUpperCase() === template.code);
        const values = { ...template, group: pnlGroupLabel("PAY"), pnlGroupCode: "PAY" };
        if (existing) Object.assign(existing, values);
        else state.categories.push(values);
      }
      state.employeeCategorySchemaVersion = EMPLOYEE_CATEGORY_SCHEMA_VERSION;
      changed = true;
    }
    // Chuẩn hóa Level 2: mọi mã chi luôn mang tiền tố của nhóm P&L và số
    // thứ tự 3 chữ số (ví dụ PAY-003). Mã tham chiếu trong lịch sử, lương
    // và liên kết NCC được đổi cùng một lần để không mất dấu vết.
    if (num(state.categoryCodeSchemaVersion) < CATEGORY_CODE_SCHEMA_VERSION) {
      const codeMap = new Map();
      for (const group of PNL_GROUPS) {
        const categories = (state.categories || [])
          .filter(category => (category.pnlGroupCode || legacyCategoryGroupCode(category)) === group.code)
          .sort((a, b) => String(a.code || "").localeCompare(String(b.code || ""), "vi", { numeric: true }));
        categories.forEach((category, index) => {
          const oldCode = String(category.code || "").trim().toUpperCase();
          const newCode = `${group.code}-${String(index + 1).padStart(3, "0")}`;
          if (oldCode) codeMap.set(oldCode, newCode);
          if (category.code !== newCode) { category.code = newCode; changed = true; }
        });
      }
      const replaceCode = (value) => codeMap.get(String(value || "").trim().toUpperCase()) || value;
      for (const expense of (state.expenses || [])) {
        const code = replaceCode(expense.code);
        if (expense.code !== code) { expense.code = code; changed = true; }
      }
      for (const payroll of (state.payrolls || [])) {
        const code = replaceCode(payroll.categoryCode);
        if (payroll.categoryCode !== code) { payroll.categoryCode = code; changed = true; }
      }
      for (const link of (state.supplierProducts || [])) {
        const code = replaceCode(link.code);
        if (link.code !== code) { link.code = code; changed = true; }
      }
      for (const claim of (state.employeeClaims || [])) {
        const categoryCode = replaceCode(claim.recoveryCategoryCode);
        if (claim.recoveryCategoryCode !== categoryCode) { claim.recoveryCategoryCode = categoryCode; changed = true; }
        for (const recovery of (claim.recoveries || [])) {
          const code = replaceCode(recovery.categoryCode);
          if (recovery.categoryCode !== code) { recovery.categoryCode = code; changed = true; }
        }
      }
      state.categoryCodeSchemaVersion = CATEGORY_CODE_SCHEMA_VERSION;
      changed = true;
    }
    // Tách NCC khỏi mã chi. Danh mục mã chi chỉ còn dùng để phân loại P&L;
    // NCC nằm ở từng hóa đơn/phiếu chi để cùng một mã vẫn mua được từ nhiều NCC.
    if (num(state.categorySupplierSchemaVersion) < CATEGORY_SUPPLIER_SCHEMA_VERSION) {
      for (const category of (state.categories || [])) {
        if (String(category.supplier || "").trim()) {
          rememberSupplierProduct(category.supplier, category.code, category.updatedAt || category.createdAt || Date.now());
          category.supplier = "";
          changed = true;
        }
      }
      state.categorySupplierSchemaVersion = CATEGORY_SUPPLIER_SCHEMA_VERSION;
      changed = true;
    }
    // Gộp các mã chi trùng cùng diễn giải, cùng Nhóm P&L và cùng NCC. Giữ mã có số
    // nhỏ nhất làm mã chuẩn, chuyển toàn bộ hóa đơn, lương, hồ sơ bồi thường
    // và liên kết NCC về mã đó để lịch sử không bị mất.
    if (num(state.categoryDuplicateSchemaVersion) < CATEGORY_DUPLICATE_SCHEMA_VERSION) {
      const groupedCategories = new Map();
      const uniqueCategories = [];
      const duplicateCodeMap = new Map();
      for (const category of (state.categories || [])) {
        const groupCode = category.pnlGroupCode || legacyCategoryGroupCode(category);
        const normalizedName = normalizeCatalogText(category.name);
        // Không tự gộp các dòng không có diễn giải vì đó là dữ liệu chưa hoàn chỉnh.
        if (!normalizedName) {
          uniqueCategories.push(category);
          continue;
        }
        const key = `${groupCode}|${normalizedName}`;
        const matches = groupedCategories.get(key) || [];
        matches.push(category);
        groupedCategories.set(key, matches);
      }
      for (const matches of groupedCategories.values()) {
        matches.sort((a, b) => String(a.code || "").localeCompare(String(b.code || ""), "en", { numeric: true }));
        const [primary, ...duplicates] = matches;
        uniqueCategories.push(primary);
        for (const duplicate of duplicates) {
          duplicateCodeMap.set(String(duplicate.code || "").toUpperCase(), primary.code);
          if (!primary.systemKey && duplicate.systemKey) primary.systemKey = duplicate.systemKey;
        }
      }
      const replaceDuplicateCode = (value) => duplicateCodeMap.get(String(value || "").trim().toUpperCase()) || value;
      if (duplicateCodeMap.size) {
        state.categories = uniqueCategories;
        for (const expense of (state.expenses || [])) {
          const code = replaceDuplicateCode(expense.code);
          if (expense.code !== code) { expense.code = code; changed = true; }
        }
        for (const payroll of (state.payrolls || [])) {
          const code = replaceDuplicateCode(payroll.categoryCode);
          if (payroll.categoryCode !== code) { payroll.categoryCode = code; changed = true; }
        }
        for (const link of (state.supplierProducts || [])) {
          const code = replaceDuplicateCode(link.code);
          if (link.code !== code) { link.code = code; changed = true; }
        }
        for (const claim of (state.employeeClaims || [])) {
          const categoryCode = replaceDuplicateCode(claim.recoveryCategoryCode);
          if (claim.recoveryCategoryCode !== categoryCode) { claim.recoveryCategoryCode = categoryCode; changed = true; }
          for (const recovery of (claim.recoveries || [])) {
            const code = replaceDuplicateCode(recovery.categoryCode);
            if (recovery.categoryCode !== code) { recovery.categoryCode = code; changed = true; }
          }
        }
        changed = true;
      }
      state.categoryDuplicateSchemaVersion = CATEGORY_DUPLICATE_SCHEMA_VERSION;
      changed = true;
    }
    employeeRecoveryCategory = (state.categories || []).find(category => category.systemKey === "employee-recovery") || employeeRecoveryCategory;
    if (num(state.transactionCleanupVersion) < TRANSACTION_CLEANUP_VERSION) {
      // Không tự động xóa dữ liệu giao dịch khi mở app. Việc làm sạch dữ liệu chỉ được thực hiện
      // bằng nút xác nhận thủ công trong Danh mục, tránh mất lịch sử chi phí/doanh thu ngoài ý muốn.
      state.transactionCleanupVersion = TRANSACTION_CLEANUP_VERSION;
      changed = true;
    }
    if (num(state.supplierAdvanceCleanupVersion) < SUPPLIER_ADVANCE_CLEANUP_VERSION) {
      state.supplierAdvanceCleanupVersion = SUPPLIER_ADVANCE_CLEANUP_VERSION;
      changed = true;
    }
    if (num(state.fundAccountCleanupVersion) < FUND_ACCOUNT_CLEANUP_VERSION) {
      state.fundAccountCleanupVersion = FUND_ACCOUNT_CLEANUP_VERSION;
      changed = true;
    }
    const employeeRecoveryCode = employeeRecoveryCategory.code;
    for (const expense of (state.expenses || [])) {
      const source = normalizeSource(expense.source);
      if (expense.source !== source) { expense.source = source; changed = true; }
      if (Array.isArray(expense.payments)) for (const payment of expense.payments) {
        const paymentSource = normalizeSource(payment.source || expense.source);
        if (payment.source !== paymentSource) { payment.source = paymentSource; changed = true; }
      }
    }
    if (!Array.isArray(state.ingredients)) { state.ingredients = []; changed = true; }
    if (num(state.ingredientUnitSchemaVersion) < INGREDIENT_UNIT_SCHEMA_VERSION) {
      const usedIngredientCodes = new Set();
      state.ingredients.forEach(item => {
        const currentCode = String(item.code || "").trim().toUpperCase();
        if (currentCode) usedIngredientCodes.add(currentCode);
      });
      const nextSkuCode = () => {
        let index = 1;
        while (usedIngredientCodes.has(`NVL-${String(index).padStart(3, "0")}`)) index += 1;
        const code = `NVL-${String(index).padStart(3, "0")}`;
        usedIngredientCodes.add(code);
        return code;
      };
      state.ingredients = state.ingredients.map(item => {
        const saved = { ...item };
        if (!saved.id) { saved.id = uid("ingredient"); changed = true; }
        if (!saved.code) { saved.code = nextSkuCode(); changed = true; }
        if (saved.specification === undefined) { saved.specification = ""; changed = true; }
        if (saved.purchaseUnit === undefined) { saved.purchaseUnit = ""; changed = true; }
        if (saved.stockUnit === undefined) { saved.stockUnit = saved.purchaseUnit || ""; changed = true; }
        if (saved.conversionFactor === undefined) { saved.conversionFactor = 1; changed = true; }
        if (saved.trackStock === undefined) { saved.trackStock = true; changed = true; }
        return saved;
      });
      state.ingredientUnitSchemaVersion = INGREDIENT_UNIT_SCHEMA_VERSION;
      changed = true;
    }
    const usedDefaultIngredientCodes = new Set((state.ingredients || []).map(item => String(item.code || "").trim().toUpperCase()).filter(Boolean));
    const nextDefaultIngredientCode = () => {
      let index = 1;
      while (usedDefaultIngredientCodes.has(`NVL-${String(index).padStart(3, "0")}`)) index += 1;
      const code = `NVL-${String(index).padStart(3, "0")}`;
      usedDefaultIngredientCodes.add(code);
      return code;
    };
    for (const item of DEFAULT_NVL_STANDARDS) {
      const exists = (state.ingredients || []).some(ingredient =>
        normalizeCatalogText(ingredient.name) === normalizeCatalogText(item.name)
        && normalizeCatalogText(ingredient.specification) === normalizeCatalogText(item.specification)
      );
      if (exists) continue;
      state.ingredients.push({
        id: uid("ingredient"),
        code: nextDefaultIngredientCode(),
        name: item.name,
        specification: item.specification,
        supplier: "",
        purchaseUnit: item.purchaseUnit,
        conversionFactor: item.conversionFactor,
        stockUnit: item.stockUnit,
        trackStock: true,
      });
      changed = true;
    }
    const existingSupplierProductLinks = Array.isArray(state.supplierProducts) ? state.supplierProducts : [];
    const normalizedSupplierProductMap = new Map();
    const addSupplierProductLink = (supplier, code, lastUsedAt = 0, id = "", createdAt = 0) => {
      const cleanSupplier = String(supplier || "").trim();
      const cleanCode = String(code || "").trim().toUpperCase();
      if (!cleanSupplier || !cleanCode) return;
      const key = supplierProductKey(cleanSupplier, cleanCode);
      const current = normalizedSupplierProductMap.get(key);
      const currentLastUsedAt = Number(current?.lastUsedAt || 0);
      const nextLastUsedAt = Number(lastUsedAt || 0);
      if (!current || nextLastUsedAt >= currentLastUsedAt) normalizedSupplierProductMap.set(key, { id: current?.id || id || uid("supplier-product"), supplier: cleanSupplier, code: cleanCode, createdAt: current?.createdAt || createdAt || Date.now(), lastUsedAt: Math.max(currentLastUsedAt, nextLastUsedAt) });
    };
    // Liên kết NCC–mã chi chỉ dùng để gợi ý chọn nhanh, không khóa công nợ.
    existingSupplierProductLinks.forEach(link => addSupplierProductLink(link.supplier, link.code, link.lastUsedAt || link.updatedAt || link.createdAt, link.id, link.createdAt));
    (state.expenses || []).forEach(expense => addSupplierProductLink(expense.supplier, expense.code, expense.updatedAt || expense.createdAt || Date.parse(`${expense.date || ""}T00:00:00`) || 0));
    const normalizedSupplierProductLinks = [...normalizedSupplierProductMap.values()];
    if (JSON.stringify(existingSupplierProductLinks) !== JSON.stringify(normalizedSupplierProductLinks)) { state.supplierProducts = normalizedSupplierProductLinks; changed = true; }
    if (!Array.isArray(state.supplierAdvances)) { state.supplierAdvances = []; changed = true; }
    if (!Array.isArray(state.inventoryMovements)) { state.inventoryMovements = []; changed = true; }
    if (!Array.isArray(state.menuRecipes)) { state.menuRecipes = []; changed = true; }
    if (state.menuRecipes.some(recipe => recipe.sourceKey === "cost2-csv-xe-bach-tuoc")) {
      state.menuRecipes = state.menuRecipes.filter(recipe => recipe.sourceKey !== "cost2-csv-xe-bach-tuoc");
      COST2_COST_RECIPE_TEMPLATES.forEach(template => state.menuRecipes.push({ id: uid("recipe"), createdAt: Date.now(), ...clone(template), updatedAt: Date.now() }));
      changed = true;
    }
    for (const advance of state.supplierAdvances) {
      if (!advance.id) { advance.id = uid("advance"); changed = true; }
      if (!advance.advanceCode) { advance.advanceCode = nextSupplierAdvanceCode(advance.date || localToday()); changed = true; }
      if (!advance.supplier) { advance.supplier = "Chưa xác định"; changed = true; }
      if (!advance.orderName) { advance.orderName = "Tạm ứng nhà cung cấp"; changed = true; }
      if (advance.expectedAmount === undefined) { advance.expectedAmount = 0; changed = true; }
      if (!Array.isArray(advance.payments)) { advance.payments = []; changed = true; }
      if (!advance.createdAt) { advance.createdAt = Date.now(); changed = true; }
      for (const payment of advance.payments) {
        if (!payment.id) { payment.id = uid("advance-pay"); changed = true; }
        if (!payment.date) { payment.date = advance.date || localToday(); changed = true; }
        if (payment.amount === undefined) { payment.amount = 0; changed = true; }
        if (!payment.source) { payment.source = TRANSFER_SOURCE; changed = true; }
        if (!payment.accountId) { payment.accountId = payment.source === CASH_SOURCE ? DEFAULT_ACCOUNT_IDS.cash : DEFAULT_ACCOUNT_IDS.bank; changed = true; }
        if (!payment.createdAt) { payment.createdAt = advance.createdAt || Date.now(); changed = true; }
      }
    }
    if (!Array.isArray(state.supplierProfiles)) { state.supplierProfiles = []; changed = true; }
    const mergedSuppliers = [...new Set([...(state.suppliers || []), ...(state.expenses || []).map(x => x.supplier), ...(state.supplierAdvances || []).map(x => x.supplier), ...normalizedSupplierProductLinks.map(x => x.supplier)].map(x => String(x || "").trim()).filter(x => x && x !== "Không xác định"))];
    if (JSON.stringify(state.suppliers || []) !== JSON.stringify(mergedSuppliers)) { state.suppliers = mergedSuppliers; changed = true; }
    const profileMap = new Map((state.supplierProfiles || []).map(profile => [normalizeCatalogText(profile.name), { ...profile, name: String(profile.name || "").trim(), taxCode: String(profile.taxCode || "").trim() }]).filter(([key, profile]) => key && profile.name));
    for (const supplier of mergedSuppliers) {
      const key = normalizeCatalogText(supplier);
      if (!profileMap.has(key)) { profileMap.set(key, { name: supplier, taxCode: "" }); changed = true; }
      else if (profileMap.get(key).name !== supplier) { profileMap.get(key).name = supplier; changed = true; }
    }
    const supplierProfiles = [...profileMap.values()].filter(profile => mergedSuppliers.some(name => normalizeCatalogText(name) === normalizeCatalogText(profile.name))).sort((a,b)=>a.name.localeCompare(b.name,"vi"));
    if (JSON.stringify(state.supplierProfiles || []) !== JSON.stringify(supplierProfiles)) { state.supplierProfiles = supplierProfiles; changed = true; }
    if (!Array.isArray(state.accounts)) { state.accounts = []; changed = true; }
    let legacyOpeningForNewBank = 0;
    let legacyOpeningDateForNewBank = "";
    const legacySettlementAccounts = state.accounts.filter(account => LEGACY_SETTLEMENT_ACCOUNT_IDS.has(account.id) || account.type === "card");
    const removedSettlementAccountIds = new Set(legacySettlementAccounts.map(account => account.id));
    if (legacySettlementAccounts.length) {
      const bank = state.accounts.find(account => account.id === DEFAULT_ACCOUNT_IDS.bank);
      const legacyOpeningBalance = legacySettlementAccounts.reduce((total, account) => total + num(account.openingBalance), 0);
      const earliestOpeningDate = legacySettlementAccounts.map(account => account.openingDate).filter(Boolean).sort()[0];
      if (bank && legacyOpeningBalance) bank.openingBalance = num(bank.openingBalance) + legacyOpeningBalance;
      if (bank && earliestOpeningDate && (!bank.openingDate || earliestOpeningDate < bank.openingDate)) bank.openingDate = earliestOpeningDate;
      if (!bank) { legacyOpeningForNewBank = legacyOpeningBalance; legacyOpeningDateForNewBank = earliestOpeningDate; }
      state.accounts = state.accounts.filter(account => !removedSettlementAccountIds.has(account.id));
      state.reconciliations = (state.reconciliations || []).filter(item => !removedSettlementAccountIds.has(item.accountId));
      changed = true;
    }
    for (const defaultAccount of DEFAULT_ACCOUNTS) {
      const existing = state.accounts.find(x => x.id === defaultAccount.id);
      if (!existing) { state.accounts.push({ ...clone(defaultAccount), openingDate: localToday() }); changed = true; continue; }
      if (!existing.type) { existing.type = defaultAccount.type; changed = true; }
      if (existing.openingBalance === undefined) { existing.openingBalance = 0; changed = true; }
      if (existing.openingDate === undefined) { existing.openingDate = localToday(); changed = true; }
      if (existing.active === undefined) { existing.active = true; changed = true; }
    }
    // Rút gọn tên tài khoản hệ thống nhưng không động đến các tài khoản do người dùng tự đặt tên.
    const restaurantBank = state.accounts.find(account => account.id === DEFAULT_ACCOUNT_IDS.bank);
    if (["Tài khoản ngân hàng Quán", "Ngân hàng Quán"].includes(restaurantBank?.name)) { restaurantBank.name = "Tài khoản ngân hàng"; changed = true; }
    if (legacyOpeningForNewBank) {
      const bank = state.accounts.find(account => account.id === DEFAULT_ACCOUNT_IDS.bank);
      bank.openingBalance = num(bank.openingBalance) + legacyOpeningForNewBank;
      if (legacyOpeningDateForNewBank && (!bank.openingDate || legacyOpeningDateForNewBank < bank.openingDate)) bank.openingDate = legacyOpeningDateForNewBank;
    }
    if (!Array.isArray(state.fundTransactions)) { state.fundTransactions = []; changed = true; }
    if (!Array.isArray(state.reconciliations)) { state.reconciliations = []; changed = true; }
    if (!Array.isArray(state.employees)) { state.employees = []; changed = true; }
    for (const employee of state.employees) {
      if (!employee.id) { employee.id = uid("employee"); changed = true; }
      if (!employee.code) { employee.code = nextEmployeeCode(); changed = true; }
      if (!employee.name) { employee.name = "Chưa ghi tên"; changed = true; }
      if (employee.active === undefined) { employee.active = true; changed = true; }
      if (!employee.createdAt) { employee.createdAt = Date.now(); changed = true; }
    }
    if (!Array.isArray(state.payrolls)) { state.payrolls = []; changed = true; }
    for (const payroll of state.payrolls) {
      if (!payroll.id) { payroll.id = uid("payroll"); changed = true; }
      if (!payroll.date) { payroll.date = localToday(); changed = true; }
      const periodValue = payrollPeriod(payroll);
      if (payroll.period !== periodValue) { payroll.period = periodValue; changed = true; }
      const accrualDate = payrollAccrualDate(payroll);
      if (payroll.accrualDate !== accrualDate) { payroll.accrualDate = accrualDate; changed = true; }
      if (!Array.isArray(payroll.deductions)) { payroll.deductions = []; changed = true; }
      if (payroll.gross === undefined) { payroll.gross = 0; changed = true; }
      if (payroll.netPaid === undefined) { payroll.netPaid = Math.max(0, num(payroll.gross) - payroll.deductions.reduce((total, item) => total + num(item.amount), 0)); changed = true; }
      if (!payroll.createdAt) { payroll.createdAt = Date.now(); changed = true; }
      // Chuyển dữ liệu lương cũ sang mô hình trích trước: P&L theo kỳ lương,
      // dòng tiền theo ngày chi thực tế nằm trong payments và không bị lùi ngày.
      const linkedExpenses = (state.expenses || []).filter(expense => expense.payrollId === payroll.id || (!expense.payrollId && payroll.payrollCode && expense.invoice === payroll.payrollCode));
      const payrollDeduction = (payroll.deductions || []).reduce((total, deduction) => total + num(deduction.amount), 0);
      for (const expense of linkedExpenses) {
        if (expense.payrollId !== payroll.id) { expense.payrollId = payroll.id; changed = true; }
        if (expense.date !== accrualDate) { expense.date = accrualDate; changed = true; }
        if (expense.payrollAccrualDate !== accrualDate) { expense.payrollAccrualDate = accrualDate; changed = true; }
        if (expense.operation !== "Trích trước lương") { expense.operation = "Trích trước lương"; changed = true; }
        if (num(expense.payrollDeduction) !== payrollDeduction) { expense.payrollDeduction = payrollDeduction; changed = true; }
      }
    }
    if (!Array.isArray(state.employeeClaims)) { state.employeeClaims = []; changed = true; }
    for (const claim of state.employeeClaims) {
      if (!claim.id) { claim.id = uid("employee-claim"); changed = true; }
      if (!claim.date) { claim.date = localToday(); changed = true; }
      if (!claim.claimCode) { claim.claimCode = nextEmployeeClaimCode(claim.date); changed = true; }
      if (!claim.employee) { claim.employee = "Chưa ghi nhân viên"; changed = true; }
      if (!claim.item) { claim.item = claim.reason || "Order nhầm / làm lại món"; changed = true; }
      if (claim.amount === undefined) { claim.amount = 0; changed = true; }
      if (claim.recoveryCategoryCode !== employeeRecoveryCode) { claim.recoveryCategoryCode = employeeRecoveryCode; changed = true; }
      if (!Array.isArray(claim.recoveries)) { claim.recoveries = []; changed = true; }
      if (!claim.createdAt) { claim.createdAt = Date.now(); changed = true; }
      const existingEmployee = state.employees.find(employee => employee.id === claim.employeeId)
        || state.employees.find(employee => String(employee.code || "").toUpperCase() === String(claim.employeeCode || "").toUpperCase())
        || state.employees.find(employee => String(employee.name || "").trim().toLocaleLowerCase("vi") === String(claim.employee || "").trim().toLocaleLowerCase("vi"));
      if (existingEmployee) {
        if (claim.employeeId !== existingEmployee.id || claim.employeeCode !== existingEmployee.code || claim.employee !== existingEmployee.name) {
          claim.employeeId = existingEmployee.id; claim.employeeCode = existingEmployee.code; claim.employee = existingEmployee.name; changed = true;
        }
      } else if (claim.employee && claim.employee !== "Chưa ghi nhân viên") {
        const employee = { id: uid("employee"), code: nextEmployeeCode(), name: claim.employee, role: "", active: true, createdAt: Date.now() };
        state.employees.push(employee);
        claim.employeeId = employee.id; claim.employeeCode = employee.code; claim.employee = employee.name; changed = true;
      }
      for (const recovery of claim.recoveries) {
        if (!recovery.id) { recovery.id = uid("employee-recovery"); changed = true; }
        if (!recovery.date) { recovery.date = claim.date; changed = true; }
        if (!recovery.method) { recovery.method = "cash"; changed = true; }
        if (recovery.amount === undefined) { recovery.amount = 0; changed = true; }
        if (recovery.categoryCode !== employeeRecoveryCode) { recovery.categoryCode = employeeRecoveryCode; changed = true; }
      }
    }
    for (const revenue of (state.revenues || [])) {
      if (revenue.cashAccountId !== DEFAULT_ACCOUNT_IDS.cash) { revenue.cashAccountId = DEFAULT_ACCOUNT_IDS.cash; changed = true; }
      if (revenue.transferAccountId !== DEFAULT_ACCOUNT_IDS.bank) { revenue.transferAccountId = DEFAULT_ACCOUNT_IDS.bank; changed = true; }
      if (revenue.cardAccountId !== DEFAULT_ACCOUNT_IDS.bank) { revenue.cardAccountId = DEFAULT_ACCOUNT_IDS.bank; changed = true; }
      if (revenue.handoverAccountId && !state.accounts.some(account => account.id === revenue.handoverAccountId)) { revenue.handoverAccountId = DEFAULT_ACCOUNT_IDS.handover; changed = true; }
    }
    if (!Array.isArray(state.appPayouts)) { state.appPayouts = []; changed = true; }
    for (const appSale of (state.appSales || [])) {
      // Dữ liệu cũ từng coi mỗi dòng doanh thu như một lệnh rút. Chuyển thành
      // một đợt rút 1 dòng để giữ nguyên lịch sử và số dư, nhưng dữ liệu mới
      // sẽ chỉ có doanh thu ngày cho đến khi kế toán tạo đợt rút gộp.
      if (!appSale.payoutId && (appSale.withdrawalCode || Object.prototype.hasOwnProperty.call(appSale, "settledDate"))) {
        const payoutId = `legacy-payout-${appSale.id || uid("app")}`;
        state.appPayouts.push({
          id: payoutId,
          withdrawalCode: appSale.withdrawalCode || nextAppWithdrawalCode(appSale.date),
          requestDate: appSale.requestDate || appSale.date,
          app: appSale.app || "Khác",
          appSaleIds: appSale.id ? [appSale.id] : [],
          net: num(appSale.net),
          payoutReference: appSale.payoutReference || "",
          settledDate: appSale.settledDate || null,
          bankReference: appSale.bankReference || "",
          settlementNote: appSale.settlementNote || "",
          note: "Chuyển đổi từ dữ liệu trước khi tách đợt rút app",
          legacy: true,
        });
        appSale.payoutId = payoutId;
        changed = true;
      }
      if (appSale.accountId !== DEFAULT_ACCOUNT_IDS.app) { appSale.accountId = DEFAULT_ACCOUNT_IDS.app; changed = true; }
    }
    for (const payout of state.appPayouts) {
      if (!payout.id) { payout.id = uid("payout"); changed = true; }
      if (!payout.requestDate) { payout.requestDate = payout.date || payout.createdDate || localToday(); changed = true; }
      if (!payout.withdrawalCode) { payout.withdrawalCode = nextAppWithdrawalCode(payout.requestDate); changed = true; }
      if (!Array.isArray(payout.appSaleIds)) { payout.appSaleIds = []; changed = true; }
      if (payout.net === undefined) { payout.net = payoutSales(payout).reduce((total, item) => total + num(item.net), 0); changed = true; }
      if (payout.settledDate === undefined) { payout.settledDate = null; changed = true; }
    }
    for (const transaction of (state.fundTransactions || [])) {
      for (const key of ["fromAccountId", "toAccountId", "accountId"]) {
        if (removedSettlementAccountIds.has(transaction[key])) { transaction[key] = DEFAULT_ACCOUNT_IDS.bank; changed = true; }
      }
    }
    if (JSON.stringify(state.accountDefaults || {}) !== JSON.stringify(DEFAULT_ACCOUNT_IDS)) { state.accountDefaults = { ...DEFAULT_ACCOUNT_IDS }; changed = true; }
    if (changed) writeStateStorage();
  };
  normalizeMasterData();
  const accounts = (types = null) => (state.accounts || []).filter(x => x.active !== false && (!types || types.includes(x.type)));
  const findAccount = (id) => (state.accounts || []).find(x => x.id === id);
  const defaultAccountId = (key) => {
    const preferred = state.accountDefaults?.[key];
    if (findAccount(preferred)) return preferred;
    const fallback = DEFAULT_ACCOUNT_IDS[key];
    return findAccount(fallback) ? fallback : accounts().find(x => x.type === key)?.id || accounts()[0]?.id || "";
  };
  const accountName = (id) => findAccount(id)?.name || "Không xác định";
  const accountOptions = (types = null, selected = "") => accounts(types).map(x => `<option value="${escapeHtml(x.id)}" ${x.id === selected ? "selected" : ""}>${escapeHtml(x.name)}</option>`).join("");
  const accountTypeLabel = (type) => ACCOUNT_TYPES[type] || "Khác";
  const fundAdjustmentNote = (item, fallback = "Điều chỉnh quỹ") => [
    item.counterparty ? `Đối tượng: ${item.counterparty}` : "",
    item.bankReference ? `Mã GD/CT: ${item.bankReference}` : "",
    item.note || fallback,
  ].filter(Boolean).join(" · ");
  const misreceivedCases = () => (state.fundTransactions || []).filter(item => item.type === "misreceived");
  const misreceivedRefunds = () => (state.fundTransactions || []).filter(item => item.type === "misreceived-refund");
  const refundedForMisreceivedCase = (caseId) => sum(misreceivedRefunds().filter(item => item.caseId === caseId), "amount");
  const outstandingMisreceived = (item) => Math.max(0, num(item?.amount) - refundedForMisreceivedCase(item?.id));
  const employeeClaims = () => state.employeeClaims || [];
  const employees = (includeInactive = false) => (state.employees || []).filter(item => includeInactive || item.active !== false).slice().sort((a, b) => String(a.code || "").localeCompare(String(b.code || ""), "vi"));
  const findEmployee = (id) => (state.employees || []).find(item => item.id === id);
  const employeeLabel = (employee) => employee ? `${employee.code || "NV"} · ${employee.name || "Chưa ghi tên"}` : "Chưa chọn nhân viên";
  const employeeOptions = (selectedId = "") => `<option value="">-- Chọn nhân viên --</option>${employees().map(item => `<option value="${escapeHtml(item.id)}" ${item.id === selectedId ? "selected" : ""}>${escapeHtml(employeeLabel(item))}</option>`).join("")}`;
  const payrolls = () => state.payrolls || [];
  const findPayroll = (id) => payrolls().find(item => item.id === id);
  const payrollCategories = () => (state.categories || []).filter(item => (item.pnlGroupCode || pnlGroupCodeFromValue(item.group)) === "PAY" && item.pnl !== false && item.payrollOnly === true);
  const defaultPayrollCategory = () => payrollCategories().find(item => String(item.code || "").toUpperCase() === "PAY-001") || payrollCategories()[0] || null;
  const employeeClaimRecovered = (claim, asOfDate = "") => sum((claim?.recoveries || []).filter(item => !asOfDate || item.date <= asOfDate), "amount");
  const employeeClaimOutstanding = (claim, asOfDate = "") => Math.max(0, num(claim?.amount) - employeeClaimRecovered(claim, asOfDate));
  const employeeRecoveryMethodLabel = (method) => ({ cash: "Nộp tiền mặt", transfer: "Chuyển khoản", payroll: "Khấu trừ lương" }[method] || "Thu hồi");
  const paymentAccountId = (payment) => {
    if (payment.accountId && findAccount(payment.accountId)) return payment.accountId;
    return payment.source === CASH_SOURCE ? defaultAccountId("cash") : defaultAccountId("bank");
  };
  const paymentReference = (payment, fallback = "") => String(payment?.bankReference || payment?.reference || fallback || payment?.id || "").trim();
  const ledgerReferenceText = (label, reference) => reference ? `${label} · Mã GD/CT: ${reference}` : label;
  const ledgerEntries = () => {
    const entries = [];
    const add = (date, accountId, amount, kind, note, reference = "", sortOrder = 0) => {
      if (!date || !accountId || !num(amount)) return;
      entries.push({ id: `${reference || kind}-${accountId}-${entries.length}`, date, accountId, amount: num(amount), kind, note, reference, sortOrder });
    };
    for (const [index, revenue] of (state.revenues || []).entries()) {
      if (isVoidedRevenue(revenue)) continue;
      const sortOrder = recordOrder(revenue, index);
      const revRef = String(revenue.bankReference || revenue.reference || revenue.receiptReference || revenue.id || "").trim();
      add(revenue.date, revenue.cashAccountId || defaultAccountId("cash"), num(revenue.cash), "Thu tiền mặt", ledgerReferenceText("Doanh thu tiền mặt", revRef), revRef || revenue.id, sortOrder);
      add(revenue.date, revenue.transferAccountId || defaultAccountId("bank"), num(revenue.transfer), "Thu chuyển khoản", ledgerReferenceText("Doanh thu chuyển khoản", revRef), revRef || revenue.id, sortOrder);
      add(revenue.date, defaultAccountId("bank"), num(revenue.card), "Thu thẻ", ledgerReferenceText("Doanh thu thẻ đã nhận", revRef), revRef || revenue.id, sortOrder);
      if (num(revenue.handover) > 0) {
        add(revenue.date, revenue.cashAccountId || defaultAccountId("cash"), -num(revenue.handover), "Bàn giao", "Bàn giao tiền mặt", revenue.id, sortOrder);
        add(revenue.date, revenue.handoverAccountId || defaultAccountId("handover"), num(revenue.handover), "Bàn giao", "Nhận bàn giao tiền mặt", revenue.id, sortOrder);
      }
    }
    for (const [index, appSale] of (state.appSales || []).entries()) {
      const amount = num(appSale.net);
      add(appSale.date, defaultAccountId("app"), amount, "Tiền App chờ rút", `App ${appSale.app || ""} phải trả theo báo cáo ngày`, appSale.id, recordOrder(appSale, index));
    }
    for (const [index, payout] of appPayouts().entries()) {
      const amount = payoutNet(payout);
      if (!payout.settledDate) continue;
      const code = payout.withdrawalCode || "APP";
      const sortOrder = recordOrder(payout, index);
      const payoutRef = String(payout.bankReference || payout.payoutReference || payout.id || "").trim();
      add(payout.settledDate, defaultAccountId("app"), -amount, "App đã thanh toán", ledgerReferenceText(`Đợt rút ${code} · ${payout.app || "App"}`, payoutRef), payoutRef || payout.id, sortOrder);
      add(payout.settledDate, defaultAccountId("bank"), amount, "Nhận tiền app", ledgerReferenceText(`Đợt rút ${code} · ${payout.app || "App"}`, payoutRef), payoutRef || payout.id, sortOrder);
    }
    for (const [index, payment] of paymentLog().entries()) {
      if (payment.type === "advance-settlement") continue;
      const payRef = paymentReference(payment, payment.expense?.invoice);
      add(payment.date, paymentAccountId(payment), -num(payment.amount), "Thanh toán chi phí", ledgerReferenceText(payment.expense?.invoice || payment.expense?.description || "Chi phí", payRef), payRef || payment.id, recordOrder(payment, index));
    }
    for (const [advanceIndex, advance] of supplierAdvances().entries()) {
      for (const [paymentIndex, payment] of (advance.payments || []).entries()) {
        const payRef = paymentReference(payment, advance.advanceCode || advance.id);
        add(payment.date, payment.accountId, -num(payment.amount), "Tạm ứng NCC", ledgerReferenceText(`${advance.advanceCode || advance.id} · ${advance.supplier || ""} · ${advance.orderName || ""}`, payRef), payRef || payment.id, recordOrder(payment, recordOrder(advance, advanceIndex) + paymentIndex));
      }
    }
    // Bồi thường nhân viên chỉ tạo dòng tiền khi quán thực nhận tiền mặt/chuyển khoản.
    // Không tạo doanh thu hoặc chi phí P&L; khấu trừ lương chỉ tất toán khoản phải thu nội bộ.
    for (const [claimIndex, claim] of employeeClaims().entries()) {
      for (const [recoveryIndex, recovery] of (claim.recoveries || []).entries()) {
        if (!['cash', 'transfer'].includes(recovery.method) || !findAccount(recovery.accountId)) continue;
        const reference = recovery.id || `${claim.id || 'employee-claim'}-${recoveryIndex}`;
        const note = [
          `Bồi thường NV · ${claim.claimCode || claim.id || ''}`,
          claim.employee || '',
          claim.orderCode ? `Order ${claim.orderCode}` : '',
          claim.item || '',
        ].filter(Boolean).join(' · ');
        const recoveryRef = paymentReference(recovery, reference);
        add(recovery.date, recovery.accountId, num(recovery.amount), "Thu bồi thường nhân viên", ledgerReferenceText(note, recoveryRef), recoveryRef || reference, recordOrder(recovery, recordOrder(claim, claimIndex)));
      }
    }
    for (const [index, item] of (state.fundTransactions || []).entries()) {
      const sortOrder = recordOrder(item, index);
      if (item.type === "transfer" || item.type === "customer-exchange") {
        if (item.fromAccountId !== item.toAccountId) {
          const kind = item.type === "customer-exchange" ? "Đổi tiền khách" : "Chuyển quỹ";
          const fromNote = item.note || (item.type === "customer-exchange" ? "Đổi tiền cho khách" : "Chuyển giữa các quỹ");
          const toNote = item.note || (item.type === "customer-exchange" ? "Nhận tiền đổi từ khách" : "Nhận chuyển quỹ");
          const fundRef = String(item.bankReference || item.reference || item.id || "").trim();
          add(item.date, item.fromAccountId, -num(item.amount), kind, ledgerReferenceText(fromNote, fundRef), fundRef || item.id, sortOrder);
          add(item.date, item.toAccountId, num(item.amount), kind, ledgerReferenceText(toNote, fundRef), fundRef || item.id, sortOrder);
        }
      } else if (item.type === "misreceived") {
        add(item.date, item.accountId, num(item.amount), "Tiền nhận nhầm", item.note || `Hồ sơ ${item.caseCode || item.id}`, item.id, sortOrder);
      } else if (item.type === "misreceived-refund") {
        add(item.date, item.accountId, -num(item.amount), "Hoàn tiền nhận nhầm", item.note || `Hoàn hồ sơ ${item.caseCode || item.caseId || ""}`, item.id, sortOrder);
      } else if (item.type === "adjustment") {
        add(item.date, item.accountId, item.direction === "in" ? num(item.amount) : -num(item.amount), item.direction === "in" ? "Bổ sung quỹ" : "Rút / điều chỉnh quỹ", fundAdjustmentNote(item), item.bankReference || item.id, sortOrder);
      }
    }
    return entries;
  };
  const accountBalance = (accountId, dateValue = "") => {
    const account = findAccount(accountId);
    const startDate = account?.openingDate || "";
    const opening = !dateValue || !startDate || startDate <= dateValue ? num(account?.openingBalance) : 0;
    return opening + sum(ledgerEntries().filter(x => x.accountId === accountId && (!dateValue || x.date <= dateValue)), "amount");
  };
  const accountBalanceBefore = (accountId, dateValue) => {
    const account = findAccount(accountId);
    const startDate = account?.openingDate || "";
    const opening = !startDate || startDate < dateValue ? num(account?.openingBalance) : 0;
    return opening + sum(ledgerEntries().filter(x => x.accountId === accountId && x.date < dateValue), "amount");
  };
  const accountDailyMovement = (accountId, dateValue) => sum(ledgerEntries().filter(x => x.accountId === accountId && x.date === dateValue), "amount");
  const totalLiquidity = (dateValue = "") => sum(accounts(["cash", "bank"]), x => accountBalance(x.id, dateValue));
  const period = () => periodInput.value;
  const reportStart = () => reportStartInput.value || monthBounds(period()).start;
  const reportEnd = () => reportEndInput.value || monthBounds(period()).end;
  const inReportRange = (dateValue) => Boolean(dateValue && dateValue >= reportStart() && dateValue <= reportEnd());
  const quarterBounds = (year, quarter) => {
    const startMonth = (quarter - 1) * 3 + 1;
    const start = `${year}-${String(startMonth).padStart(2, "0")}-01`;
    const endDate = new Date(Date.UTC(year, startMonth + 2, 0));
    return { start, end: endDate.toISOString().slice(0, 10) };
  };
  const ingredientWasteComparison = () => {
    const selectedPeriod = /^\d{4}-\d{2}$/.test(period()) ? period() : today.slice(0, 7);
    const [year, month] = selectedPeriod.split("-").map(Number);
    if (ingredientWasteCompareMode === "year") {
      const previousYear = year - 1;
      return {
        mode: "year",
        current: { start: `${year}-01-01`, end: `${year}-12-31`, label: `Năm ${year}` },
        previous: { start: `${previousYear}-01-01`, end: `${previousYear}-12-31`, label: `Năm ${previousYear}` },
        shortCurrent: String(year),
        shortPrevious: String(previousYear),
      };
    }
    if (ingredientWasteCompareMode === "quarter") {
      const currentQuarter = Math.ceil(month / 3);
      const previousQuarter = currentQuarter === 1 ? 4 : currentQuarter - 1;
      const previousYear = currentQuarter === 1 ? year - 1 : year;
      return {
        mode: "quarter",
        current: { ...quarterBounds(year, currentQuarter), label: `Quý ${currentQuarter}/${year}` },
        previous: { ...quarterBounds(previousYear, previousQuarter), label: `Quý ${previousQuarter}/${previousYear}` },
        shortCurrent: `Q${currentQuarter}/${String(year).slice(2)}`,
        shortPrevious: `Q${previousQuarter}/${String(previousYear).slice(2)}`,
      };
    }
    const previousMonthDate = new Date(`${selectedPeriod}-01T00:00:00`);
    previousMonthDate.setMonth(previousMonthDate.getMonth() - 1);
    const previousPeriod = `${previousMonthDate.getFullYear()}-${String(previousMonthDate.getMonth() + 1).padStart(2, "0")}`;
    return {
      mode: "month",
      current: { ...monthBounds(selectedPeriod), label: `Tháng ${selectedPeriod.slice(5)}/${selectedPeriod.slice(0, 4)}` },
      previous: { ...monthBounds(previousPeriod), label: `Tháng ${previousPeriod.slice(5)}/${previousPeriod.slice(0, 4)}` },
      shortCurrent: `${selectedPeriod.slice(5)}/${selectedPeriod.slice(2, 4)}`,
      shortPrevious: `${previousPeriod.slice(5)}/${previousPeriod.slice(2, 4)}`,
    };
  };
  const inPeriod = (item) => inReportRange(item?.date);
  const reportRangeLabel = () => {
    const start = reportStart(), end = reportEnd(), bounds = monthBounds(period());
    if (start === bounds.start && end === bounds.end) return new Intl.DateTimeFormat("vi-VN", { month: "long", year: "numeric" }).format(new Date(`${period()}-01T00:00:00`));
    return `${dateVi(start)} – ${dateVi(end)}`;
  };
  const sum = (items, field) => items.reduce((total, item) => total + num(typeof field === "function" ? field(item) : item[field]), 0);
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>'"]/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]));
  const attachmentField = (label = "File chứng từ / ảnh giao dịch") => `<div class="field full"><label>${label} <small>(không bắt buộc)</small></label><input name="attachment" type="file" accept="image/*,.pdf"></div>`;
  const readAttachment = async (formData, fieldName = "attachment", required = false) => {
    const file = formData.get(fieldName);
    if (!file || !file.size) {
      if (required) throw new Error("Vui lòng upload file chứng từ để kiểm soát giao dịch");
      return null;
    }
    if (file.size > 3 * 1024 * 1024) throw new Error("File chứng từ tối đa 3MB");
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve({ name: file.name, type: file.type, size: file.size, dataUrl: reader.result });
      reader.onerror = () => reject(new Error("Không đọc được file chứng từ"));
      reader.readAsDataURL(file);
    });
  };
  const persist = () => { writeStateStorage(); queueServerSave(); updateDebtCount(); updateEmployeeClaimCount(); updateAppPendingCount(); };
  const toast = (message) => { const el = document.querySelector("#toast"); el.textContent = message; el.classList.add("show"); setTimeout(() => el.classList.remove("show"), 2200); };
  const canManage = () => activeRole === ACCOUNTANT_ROLE;
  const canManageKitchen = () => activeRole === ACCOUNTANT_ROLE || activeRole === KITCHEN_ROLE;
  const exportStateForActiveRole = () => {
    const copy = JSON.parse(JSON.stringify(state));
    const wipe = (keys) => keys.forEach((key) => { copy[key] = []; });
    if (activeRole === KITCHEN_ROLE) {
      wipe(["revenues", "appSales", "appPayouts", "expenses", "payrolls", "employeeClaims", "supplierAdvances", "fundTransactions", "reconciliations", "fixedAssets", "employees", "suppliers", "supplierProfiles", "supplierProducts"]);
      copy.accounts = [];
      copy.sources = [];
      copy.targets = [];
      copy.__exportScope = "kitchen";
    } else if (activeRole === OBSERVER_ROLE) {
      wipe(["payrolls", "employeeClaims", "fixedAssets", "inventoryMovements", "employees", "menuItems", "menuRecipes"]);
      copy.__exportScope = "observer";
    } else {
      copy.__exportScope = "accountant";
    }
    delete copy.accessControl;
    return copy;
  };
  const accessConfig = () => {
    if (state.accessControl?.accountantPinHash || state.accessControl?.kitchenPinHash || state.accessControl?.observerPinHash) return state.accessControl;
    try { return JSON.parse(localStorage.getItem(ACCESS_STORAGE_KEY) || "{}"); }
    catch (_error) { return {}; }
  };
  const saveAccessConfig = (config) => {
    state.accessControl = { ...config, sharedOnServer: true, updatedAt: Date.now() };
    localStorage.setItem(ACCESS_STORAGE_KEY, JSON.stringify(state.accessControl));
    persist();
  };
  const canConfigureSharedPin = () => ["localhost", "127.0.0.1", "::1"].includes(location.hostname);
  const roleLabel = () => canManage() ? "Kế toán" : activeRole === KITCHEN_ROLE ? "Bếp" : activeRole === OBSERVER_ROLE ? "Nhân viên quan sát" : "Đang khóa";
  const roleDetail = () => canManage() ? "Được phép nhập, sửa và kiểm soát dữ liệu" : activeRole === KITCHEN_ROLE ? "Chỉ thao tác trong Kho hàng" : activeRole === OBSERVER_ROLE ? "Chỉ xem dữ liệu · không thể thay đổi" : "Chọn vai trò để tiếp tục";
  const pinIsValid = (pin) => /^\d{4,12}$/.test(String(pin || ""));
  const rolePinKey = (role) => role === ACCOUNTANT_ROLE ? "accountantPinHash" : role === KITCHEN_ROLE ? "kitchenPinHash" : "observerPinHash";
  const rolePinName = (role) => role === ACCOUNTANT_ROLE ? "Kế toán" : role === KITCHEN_ROLE ? "Bếp" : "Quan sát";
  const rolePinDescription = (role, configured) => {
    if (role === ACCOUNTANT_ROLE) return configured ? "Nhập PIN để mở quyền nhập, sửa, xóa và đối soát." : "Tạo PIN gồm 4–12 chữ số. PIN này chỉ dành cho người phụ trách kế toán.";
    if (role === KITCHEN_ROLE) return configured ? "Nhập PIN Bếp. PIN này chỉ mở khu Kho hàng, được nhập/sửa kho bếp nhưng không xem được dữ liệu kế toán/phân tích khác." : "Tạo PIN riêng cho Bếp. PIN này chỉ dùng trong Kho hàng để nhập/sửa kho bếp và xem hao hụt NVL.";
    return configured ? "Nhập PIN Quan sát. PIN này chỉ xem dữ liệu được phép, không thao tác chỉnh sửa." : "Tạo PIN riêng cho Nhân viên quan sát. PIN này không mở được quyền Bếp hoặc Kế toán.";
  };
  const pinDigest = async (pin, role = ACCOUNTANT_ROLE) => {
    const text = new TextEncoder().encode(`TAKO_HAIDUONG|${String(role).toUpperCase()}|${String(pin)}`);
    if (!window.crypto?.subtle) return btoa(String.fromCharCode(...text));
    const digest = await window.crypto.subtle.digest("SHA-256", text);
    return Array.from(new Uint8Array(digest)).map(value => value.toString(16).padStart(2, "0")).join("");
  };
  const legacyPinDigest = async (pin) => {
    const text = new TextEncoder().encode(`TAKO_HAIDUONG|ACCOUNTANT|${String(pin)}`);
    if (!window.crypto?.subtle) return btoa(String.fromCharCode(...text));
    const digest = await window.crypto.subtle.digest("SHA-256", text);
    return Array.from(new Uint8Array(digest)).map(value => value.toString(16).padStart(2, "0")).join("");
  };
  const syncRoleUi = () => {
    const accountant = canManage();
    document.body.classList.toggle("observer-mode", activeRole === OBSERVER_ROLE);
    document.body.classList.toggle("kitchen-mode", activeRole === KITCHEN_ROLE);
    document.body.classList.toggle("accountant-mode", accountant);
    accessRoleBadge.textContent = roleLabel();
    accessRoleCaption.textContent = accountant ? "Đổi vai trò / khóa" : activeRole === KITCHEN_ROLE ? "Bếp · đổi vai trò" : activeRole === OBSERVER_ROLE ? "Chỉ xem · đổi vai trò" : "Chọn vai trò";
    currentRoleAvatar.textContent = accountant ? "KT" : activeRole === KITCHEN_ROLE ? "BP" : activeRole === OBSERVER_ROLE ? "NV" : "--";
    currentRoleLabel.textContent = roleLabel();
    currentRoleDetail.textContent = roleDetail();
    lockSessionButton.disabled = !activeRole;
    if (ONLINE_VIEWER_MODE) {
      accessRoleButton.disabled = true;
      accessRoleCaption.textContent = "Online chỉ xem";
      lockSessionButton.hidden = true;
    }
  };
  const activateRole = (role) => {
    activeRole = role;
    if (role === KITCHEN_ROLE) {
      view = "ingredients";
      materialTab = "kitchen";
    }
    sessionStorage.setItem(ROLE_SESSION_KEY, role);
    accessGate.classList.remove("open");
    syncRoleUi();
    render({ preserveScroll: true });
    toast(role === ACCOUNTANT_ROLE ? "Đã mở quyền Kế toán" : role === KITCHEN_ROLE ? "Đã mở quyền Bếp" : "Đang ở chế độ Nhân viên quan sát");
  };
  const showRoleChoice = () => {
    accessGateContent.innerHTML = `<div class="access-gate-brand">TAKO HẢI DƯƠNG</div><h2 id="access-gate-title">Chọn vai trò truy cập</h2><p>Mỗi khu vực dùng một mã PIN riêng. Kế toán có toàn quyền; Bếp chỉ mở Kho hàng; Quan sát chỉ xem dữ liệu được phép.</p><div class="role-choice-grid"><button type="button" class="role-choice accountant" id="choose-accountant"><strong>Kế toán</strong><span>Nhập liệu, chỉnh sửa, đối soát và quản lý danh mục</span></button><button type="button" class="role-choice kitchen" id="choose-kitchen"><strong>Bếp</strong><span>Chỉ mở Kho hàng để nhập/sửa kho bếp, xem tồn và hao hụt NVL</span></button><button type="button" class="role-choice observer" id="choose-observer"><strong>Nhân viên quan sát</strong><span>Chỉ xem số liệu, không dùng được PIN Bếp/Kế toán</span></button></div><small class="access-gate-note">PIN của vai trò nào chỉ mở đúng vai trò đó.</small>`;
    document.querySelector("#choose-accountant").addEventListener("click", () => showRolePin(ACCOUNTANT_ROLE));
    document.querySelector("#choose-kitchen").addEventListener("click", () => showRolePin(KITCHEN_ROLE));
    document.querySelector("#choose-observer").addEventListener("click", () => showRolePin(OBSERVER_ROLE));
  };
  const showRolePin = (targetRole) => {
    const config = accessConfig();
    const key = rolePinKey(targetRole);
    const configured = Boolean(config[key]);
    const roleName = rolePinName(targetRole);
    if (!configured && !canConfigureSharedPin()) {
      accessGateContent.innerHTML = `<button type="button" class="access-back" id="access-back">← Quay lại</button><div class="access-gate-brand">TAKO HẢI DƯƠNG</div><h2 id="access-gate-title">PIN ${roleName} chưa được thiết lập</h2><p>Thiết bị này không được phép tạo PIN mới. Hãy mở ứng dụng trên máy chạy server bằng <strong>localhost</strong>, thiết lập PIN ${roleName} một lần rồi tải lại trang.</p>`;
      document.querySelector("#access-back").addEventListener("click", showRoleChoice);
      return;
    }
    accessGateContent.innerHTML = `<button type="button" class="access-back" id="access-back">← Quay lại</button><div class="access-gate-brand">TAKO HẢI DƯƠNG</div><h2 id="access-gate-title">${configured ? `Đăng nhập ${roleName}` : `Thiết lập PIN ${roleName}`}</h2><p>${rolePinDescription(targetRole, configured)}</p><form id="role-pin-form" class="access-pin-form"><label>PIN ${roleName}<input name="pin" type="password" inputmode="numeric" autocomplete="${configured ? "current-password" : "new-password"}" maxlength="12" placeholder="••••••" autofocus required></label>${configured ? "" : `<label>Xác nhận PIN<input name="confirmPin" type="password" inputmode="numeric" autocomplete="new-password" maxlength="12" placeholder="••••••" required></label>`}<button class="primary-button" type="submit">${configured ? `Mở quyền ${roleName}` : `Lưu PIN ${roleName}`}</button></form>`;
    document.querySelector("#access-back").addEventListener("click", showRoleChoice);
    document.querySelector("#role-pin-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const fd = new FormData(event.currentTarget);
      const pin = String(fd.get("pin") || "");
      if (!pinIsValid(pin)) { toast("PIN phải gồm từ 4 đến 12 chữ số"); return; }
      if (!configured) {
        if (pin !== String(fd.get("confirmPin") || "")) { toast("PIN xác nhận chưa khớp"); return; }
        config[key] = await pinDigest(pin, targetRole);
        config.updatedAt = Date.now();
        if (!config.createdAt) config.createdAt = Date.now();
        saveAccessConfig(config);
      } else {
        const digest = await pinDigest(pin, targetRole);
        const legacyDigest = targetRole === ACCOUNTANT_ROLE ? await legacyPinDigest(pin) : "";
        if (config[key] !== digest && config[key] !== legacyDigest) {
          toast(`PIN ${roleName} không đúng`);
          return;
        }
        if (config[key] === legacyDigest && config[key] !== digest) {
          config[key] = digest;
          saveAccessConfig(config);
        }
      }
      activateRole(targetRole);
    });
  };
  const openAccessGate = () => {
    closeModal();
    accessGate.classList.add("open");
    showRoleChoice();
  };
  const showCurrentRoleMenu = () => {
    if (!activeRole) { openAccessGate(); return; }
    const roleName = rolePinName(activeRole);
    accessGate.classList.add("open");
    accessGateContent.innerHTML = `<button type="button" class="access-back" id="access-back">← Đóng</button><div class="access-gate-brand">TAKO HẢI DƯƠNG</div><h2 id="access-gate-title">${roleName}</h2><p>Chọn thao tác cho vai trò đang đăng nhập. Mỗi vai trò có PIN riêng và chỉ đổi được PIN của chính vai trò đó.</p><div class="role-choice-grid"><button type="button" class="role-choice accountant" id="change-current-pin"><strong>Đổi PIN</strong><span>Nhập PIN cũ, đặt PIN mới cho ${roleName}</span></button><button type="button" class="role-choice observer" id="switch-role"><strong>Đổi vai trò</strong><span>Quay lại màn hình chọn Kế toán / Bếp / Quan sát</span></button><button type="button" class="role-choice kitchen" id="lock-current-role"><strong>Khóa phiên</strong><span>Thoát khỏi vai trò hiện tại</span></button></div>`;
    document.querySelector("#access-back").addEventListener("click", () => accessGate.classList.remove("open"));
    document.querySelector("#change-current-pin").addEventListener("click", () => showChangePin(activeRole));
    document.querySelector("#switch-role").addEventListener("click", showRoleChoice);
    document.querySelector("#lock-current-role").addEventListener("click", lockSession);
  };
  const showChangePin = (targetRole) => {
    const config = accessConfig();
    const key = rolePinKey(targetRole);
    const roleName = rolePinName(targetRole);
    if (!config[key]) { showRolePin(targetRole); return; }
    accessGateContent.innerHTML = `<button type="button" class="access-back" id="access-back">← Quay lại</button><div class="access-gate-brand">TAKO HẢI DƯƠNG</div><h2 id="access-gate-title">Đổi PIN ${roleName}</h2><p>PIN mới chỉ áp dụng cho vai trò ${roleName}; không mở được quyền của vai trò khác.</p><form id="change-pin-form" class="access-pin-form"><label>PIN hiện tại<input name="oldPin" type="password" inputmode="numeric" autocomplete="current-password" maxlength="12" placeholder="••••••" autofocus required></label><label>PIN mới<input name="newPin" type="password" inputmode="numeric" autocomplete="new-password" maxlength="12" placeholder="••••••" required></label><label>Xác nhận PIN mới<input name="confirmPin" type="password" inputmode="numeric" autocomplete="new-password" maxlength="12" placeholder="••••••" required></label><button class="primary-button" type="submit">Lưu PIN ${roleName}</button></form>`;
    document.querySelector("#access-back").addEventListener("click", showCurrentRoleMenu);
    document.querySelector("#change-pin-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const fd = new FormData(event.currentTarget);
      const oldPin = String(fd.get("oldPin") || "");
      const newPin = String(fd.get("newPin") || "");
      const confirmPin = String(fd.get("confirmPin") || "");
      if (!pinIsValid(oldPin) || !pinIsValid(newPin)) { toast("PIN phải gồm từ 4 đến 12 chữ số"); return; }
      if (newPin !== confirmPin) { toast("PIN mới xác nhận chưa khớp"); return; }
      const oldDigest = await pinDigest(oldPin, targetRole);
      const legacyDigest = targetRole === ACCOUNTANT_ROLE ? await legacyPinDigest(oldPin) : "";
      if (config[key] !== oldDigest && config[key] !== legacyDigest) { toast("PIN hiện tại không đúng"); return; }
      config[key] = await pinDigest(newPin, targetRole);
      config.updatedAt = Date.now();
      saveAccessConfig(config);
      accessGate.classList.remove("open");
      toast(`Đã đổi PIN ${roleName}`);
    });
  };
  const lockSession = () => {
    activeRole = "";
    sessionStorage.removeItem(ROLE_SESSION_KEY);
    syncRoleUi();
    openAccessGate();
  };
  const MUTATION_ACTION_SELECTOR = [
    "#quick-add", "#sync-online-button", "#create-app-payout", "#add-expense-line", "#confirm-load-cost2-demo",
    "[data-revenue-void]", "[data-app-settle]", "[data-expense-edit]", "[data-pay]", "[data-advance-pay]", "[data-advance-payment-edit]",
    "[data-employee-claim-recover]", "[data-account-add]", "[data-account-edit]", "[data-account-reconcile]",
    "[data-fund-transaction]", "[data-fund-edit]", "[data-special-cash-transaction]", "[data-category-add]", "[data-category-delete]",
    "[data-category-edit]", "[data-category-from-ingredient]", "[data-ingredient-add]", "[data-ingredient-delete]",
    "[data-ingredient-edit]", "[data-ingredient-code]", "[data-inventory-movement-add]", "[data-inventory-movement-edit]", "[data-recipe-add]", "[data-recipe-edit]", "[data-recipe-delete]", "[data-supplier-add]", "[data-supplier-delete]",
    "[data-supplier-edit]", "[data-asset-setup]", "[data-asset-edit]", "[data-employee-add]",
    "[data-employee-edit]", "[data-employee-delete]", "[data-clear-transactional-data]", "[data-reset-form]",
    "[data-remove-expense-line]"
  ].join(", ");
  const applyAccessControl = () => {
    const observer = activeRole === OBSERVER_ROLE;
    const kitchen = activeRole === KITCHEN_ROLE;
    document.querySelectorAll(MUTATION_ACTION_SELECTOR).forEach(control => control.dataset.accountantOnly = "true");
    document.querySelectorAll("#nav button[data-view]").forEach(button => {
      const blocked = (kitchen && !KITCHEN_ALLOWED_VIEWS.has(button.dataset.view)) || (observer && KITCHEN_ALLOWED_VIEWS.has(button.dataset.view));
      button.hidden = blocked;
    });
    document.querySelectorAll("[data-kitchen-hidden]").forEach(element => {
      element.hidden = kitchen;
    });
    document.querySelectorAll("[data-kitchen-section], [data-kitchen-view]").forEach(element => {
      element.hidden = observer;
    });
    const topActionDropdown = document.querySelector("#top-action-dropdown");
    if (topActionDropdown) topActionDropdown.hidden = !activeRole || ONLINE_VIEWER_MODE;
    document.querySelector("#quick-add")?.toggleAttribute("hidden", !canManage());
    document.querySelector("#export-pdf-button")?.toggleAttribute("hidden", !canManage());
    document.querySelectorAll("#app .form-panel").forEach(panel => {
      panel.closest(".section-grid")?.classList.toggle("observer-readonly-layout", observer);
    });
  };
  const blockObserverMutation = (event) => {
    if (canManage()) return;
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    if (activeRole === KITCHEN_ROLE && target.closest("[data-inventory-movement-add], [data-inventory-movement-edit], [data-recipe-add], [data-recipe-edit], [data-recipe-delete], #kitchen-stock-form, #kitchen-movement-edit-form, #recipe-form")) return;
    if (target.closest(MUTATION_ACTION_SELECTOR) || target.closest("#app form, #modal form")) {
      event.preventDefault();
      event.stopImmediatePropagation();
      toast(activeRole === KITCHEN_ROLE ? "Quyền Bếp chỉ được thao tác trong Kho hàng" : "Chế độ Nhân viên quan sát chỉ cho phép xem dữ liệu");
    }
  };
  const bindAmountPreview = (form, inputName, previewId) => {
    const input = form.querySelector(`[name="${inputName}"]`);
    const preview = form.querySelector(`#${previewId}`);
    if (!input || !preview) return;
    const update = () => { preview.textContent = money(num(input.value)); };
    input.addEventListener("input", update);
    update();
  };

  function periodData() {
    const revenues = activeRevenues().filter(inPeriod);
    const apps = (state.appSales || []).filter(inPeriod);
    const expenses = (state.expenses || []).filter(inPeriod);
    const appExpenses = appPnlExpenses(apps);
    const payments = paymentLog().filter((payment) => inReportRange(payment.date) && isRealCashPayment(payment));
    const storeRevenue = sum(revenues, x => x.cash + x.transfer + x.card);
    const appGross = sum(apps, x => x.recordingBasis === "net-claim" ? num(x.net) : num(x.gross));
    const appNet = sum(apps, "net");
    const settledApps = appPayouts().filter(x => inReportRange(x.settledDate));
    const appReceived = sum(settledApps, payoutNet);
    const totalRevenue = storeRevenue + appGross;
    const pnlExpenses = [...expenses.filter(x => x.pnl), ...appExpenses];
    const totalExpenses = sum(pnlExpenses, "amount");
    const profit = totalRevenue - totalExpenses;
    const payableExpenses = (state.expenses || []).filter(x => isSupplierPayable(x) && x.date <= reportEnd());
    const debt = sum(payableExpenses, x => expenseOutstandingAsOf(x, reportEnd()));
    const paid = sum(payments, "amount");
    const paidBySource = new Map();
    payments.forEach((payment) => paidBySource.set(payment.source, (paidBySource.get(payment.source) || 0) + num(payment.amount)));
    const cashSpend = paidBySource.get(CASH_SOURCE) || 0;
    const transferSpend = paidBySource.get(TRANSFER_SOURCE) || 0;
    const cashIn = storeRevenue + appReceived;
    const newDebt = sum(expenses.filter(isSupplierPayable), x => expenseOutstandingAsOf(x, x.date));
    const groupMap = new Map();
    pnlExpenses.forEach(x => groupMap.set(x.group, (groupMap.get(x.group) || 0) + x.amount));
    const channelMap = new Map([["Tại quán", storeRevenue]]);
    apps.forEach(x => channelMap.set(x.app, (channelMap.get(x.app) || 0) + (x.recordingBasis === "net-claim" ? num(x.net) : num(x.gross))));
    return { revenues, apps, settledApps, appPayouts: appPayouts(), expenses, appExpenses, payments, storeRevenue, appGross, appNet, appReceived, totalRevenue, pnlExpenses, totalExpenses, profit, debt, paid, paidBySource, cashSpend, transferSpend, cashIn, netCashFlow: cashIn - paid, newDebt, groupMap, channelMap };
  }

  const dayNames = ["Chủ nhật", "Thứ hai", "Thứ ba", "Thứ tư", "Thứ năm", "Thứ sáu", "Thứ bảy"];
  function dailySummaryRows() {
    const revenues = activeRevenues().filter(x => inReportRange(x.date));
    const apps = (state.appSales || []).filter(x => inReportRange(x.date));
    const expenses = (state.expenses || []).filter(x => inReportRange(x.date));
    const payments = paymentLog().filter(x => inReportRange(x.date) && isRealCashPayment(x));
    const dates = [...new Set([...revenues, ...apps, ...expenses, ...payments].map(x => x.date).filter(Boolean))].sort();
    return dates.map(dateValue => {
      const rev = revenues.filter(x => x.date === dateValue);
      const appRows = apps.filter(x => x.date === dateValue);
      const exp = expenses.filter(x => x.date === dateValue);
      const paymentRows = payments.filter(x => x.date === dateValue);
      const cash = sum(rev, "cash"), transfer = sum(rev, "transfer"), card = sum(rev, "card");
      const storeRevenue = cash + transfer + card;
      const appRevenue = sum(appRows, "gross");
      const cashSpend = sum(paymentRows.filter(x => x.source === CASH_SOURCE), "amount");
      const transferSpend = sum(paymentRows.filter(x => x.source === TRANSFER_SOURCE), "amount");
      const paid = cashSpend + transferSpend;
      const debt = sum(exp.filter(isSupplierPayable), x => expenseOutstandingAsOf(x, dateValue));
      const pnlCost = sum(exp.filter(x => x.pnl), "amount");
      const cashAccountId = defaultAccountId("cash");
      const openingCash = accountBalanceBefore(cashAccountId, dateValue), handover = sum(rev, "handover");
      const actualRows = rev.filter(x => x.actualCash !== undefined && x.actualCash !== null && String(x.actualCash) !== "");
      const actualCash = actualRows.length ? sum(actualRows, "actualCash") : null;
      const bookCash = accountBalance(cashAccountId, dateValue);
      return {
        date: dateValue, day: dayNames[new Date(`${dateValue}T00:00:00`).getDay()], storeRevenue, appRevenue,
        totalRevenue: storeRevenue + appRevenue, cash, transferCard: transfer + card, cashSpend,
        transferSpend, paid, debt, pnlCost, profit: storeRevenue + appRevenue - pnlCost,
        openingCash, handover, bookCash, actualCash, variance: actualCash === null ? null : actualCash - bookCash,
        note: rev.map(x => x.note).filter(Boolean).join("; "),
      };
    });
  }

  function gradient(entries, total) {
    if (!total || !entries.length) return "conic-gradient(#dfe4dc 0 100%)";
    let current = 0;
    const stops = entries.map(([_, value], index) => {
      const start = current; current += value / total * 100;
      return `${COLORS[index % COLORS.length]} ${start}% ${current}%`;
    });
    return `conic-gradient(${stops.join(",")})`;
  }

  function legend(entries, total, max = 6, showValue = false) {
    return entries.slice(0, max).map(([label, value], index) => {
      const profitHighlight = /Lợi nhuận (gộp|thuần)/i.test(String(label));
      return `<div class="legend-row${showValue ? " with-value" : ""}${profitHighlight ? " profit-highlight" : ""}"><i class="dot" style="background:${COLORS[index % COLORS.length]}"></i><span>${escapeHtml(label)}</span>${showValue ? `<b>${money(value)}</b>` : ""}<strong>${pct(total ? value / total : 0)}</strong></div>`;
    }).join("");
  }

  function donutLabels(entries, total) {
    if (!total) return "";
    let current = 0;
    return entries.map(([_, rawValue]) => {
      const value = Math.max(0, num(rawValue));
      const share = value / total;
      const start = current;
      current += share;
      if (!value || share < .002) return "";
      const angle = (start + share / 2) * Math.PI * 2;
      const x = 50 + Math.sin(angle) * 42;
      const y = 50 - Math.cos(angle) * 42;
      const compact = share < .03 ? " compact" : "";
      return `<span class="donut-percent${compact}" style="left:${x.toFixed(2)}%;top:${y.toFixed(2)}%">${pct(share)}</span>`;
    }).join("");
  }

  function panelDonut(title, subtitle, centerValue, centerLabel, entries, total, showLegendValues = true) {
    return `<div class="panel"><div class="panel-head"><div><h3>${title}</h3><p>${subtitle}</p></div></div><div class="pnl-layout"><div class="donut" style="--segments:${gradient(entries, total)}">${donutLabels(entries, total)}<div class="donut-center"><strong>${centerValue}</strong><span>${centerLabel}</span></div></div><div class="legend">${legend(entries, total, 6, showLegendValues)}</div></div></div>`;
  }

  function updateDebtCount() {
    const count = (state.expenses || []).filter(x => String(x.supplier || "").trim() && x.amount > paidAmount(x)).length;
    document.querySelector("#debt-count").textContent = count;
  }

  function updateEmployeeClaimCount() {
    const element = document.querySelector("#employee-claim-count");
    if (!element) return;
    element.textContent = employeeClaims().filter(item => employeeClaimOutstanding(item) > 0).length;
  }

  function updateAppPendingCount() {
    const element = document.querySelector("#app-pending-count");
    if (!element) return;
    const count = appSalesWaitingForWithdrawal().length;
    element.textContent = count;
    element.title = `${count} dòng doanh thu App chưa yêu cầu rút`;
  }

  function setHeader(title, overline) { pageTitle.textContent = title; eyebrow.textContent = overline; }

  function renderDashboard() {
    setHeader("Tổng quan kinh doanh", "TRUNG TÂM VẬN HÀNH");
    const d = periodData();
    const monthLabel = reportRangeLabel();
    const costEntries = [...d.groupMap.entries()].sort((a,b) => b[1] - a[1]);
    const food = d.groupMap.get(pnlGroupLabel("COGS")) || 0;
    const grossProfit = d.totalRevenue - food;
    const pnlRevenueEntries = [["Giá vốn hàng bán", Math.min(Math.max(food, 0), d.totalRevenue)], ["Lợi nhuận gộp", Math.max(0, grossProfit)]];
    const pnlSummaryEntries = [["Giá vốn hàng bán", food], ["Lợi nhuận gộp", grossProfit], ["Tổng chi P&L", d.totalExpenses], ["Lợi nhuận thuần", d.profit]];
    const pnlRevenuePanel = `<div class="panel"><div class="panel-head"><div><h3>Vòng tròn P&L</h3><p>Tổng doanh thu là 100%; phần trăm được hiển thị trực tiếp trên vòng tròn.</p></div></div><div class="pnl-layout"><div class="donut" style="--segments:${gradient(pnlRevenueEntries, d.totalRevenue)}">${donutLabels(pnlRevenueEntries, d.totalRevenue)}<div class="donut-center"><strong>${money(d.totalRevenue)}</strong><span>Tổng doanh thu</span></div></div><div class="legend">${legend(pnlSummaryEntries, d.totalRevenue, 6, true)}</div></div></div>`;
    const payroll = d.groupMap.get(pnlGroupLabel("PAY")) || 0;
    const targets = { ...DEFAULT_KPI_TARGETS, ...(state.targets || {}) };
    const activeEmployeeCount = employees().length;
    const monthlyPremisesCost = num(targets.monthlyRent) + num(targets.monthlyUtilities) + num(targets.monthlyGas) + num(targets.monthlyPosAndPrinter);
    const monthlyPayrollBudget = activeEmployeeCount * (num(targets.monthlyBaseSalaryPerEmployee) + num(targets.monthlyKpiPerEmployee));
    const targetMonthlyRevenue = num(targets.monthlyRevenueTarget);
    const payrollTarget = targetMonthlyRevenue ? monthlyPayrollBudget / targetMonthlyRevenue : num(targets.payroll);
    const operatingExpenseTarget = targetMonthlyRevenue ? monthlyPremisesCost / targetMonthlyRevenue : num(targets.fixedCost);
    const foodTarget = num(targets.ingredientPurchase);
    const monthlyRevenue = d.totalRevenue;
    const hasMonthlyRevenue = monthlyRevenue > 0;
    const modeledMonthlyFood = monthlyRevenue * foodTarget;
    const foodRecordedRatio = monthlyRevenue ? food / monthlyRevenue : 0;
    const foodEstimated = monthlyRevenue > 0 && foodRecordedRatio < foodTarget * .5;
    const payrollHasRecordedCost = hasMonthlyRevenue && payroll >= monthlyPayrollBudget * .5;
    const monthlyFoodForKpi = foodEstimated ? modeledMonthlyFood : food;
    const monthlyPayrollForKpi = payrollHasRecordedCost ? payroll : monthlyPayrollBudget;
    const foodRatio = hasMonthlyRevenue ? monthlyFoodForKpi / monthlyRevenue : 0;
    const payrollRatio = hasMonthlyRevenue ? monthlyPayrollForKpi / monthlyRevenue : 0;
    const primeCostRatio = foodRatio + payrollRatio;
    const operatingExpenseRatio = hasMonthlyRevenue ? monthlyPremisesCost / monthlyRevenue : 0;
    const netMarginRatio = hasMonthlyRevenue ? 1 - foodRatio - payrollRatio - operatingExpenseRatio : 0;
    const monthlyRevenueShortfall = Math.max(0, targetMonthlyRevenue - monthlyRevenue);
    const revenueLevel = monthlyRevenue >= targetMonthlyRevenue ? "good" : monthlyRevenue >= targetMonthlyRevenue * .85 ? "warning" : "danger";
    const revenueAction = revenueLevel === "good"
      ? "Doanh thu lũy kế đã đạt mục tiêu tháng; tiếp tục duy trì số đơn và giá trị hóa đơn."
      : `Doanh thu lũy kế còn thiếu ${money(monthlyRevenueShortfall)} so với mục tiêu tháng; rà số đơn, giá trị hóa đơn và doanh thu từng kênh.`;
    const noRevenueAction = "Chưa có doanh thu trong tháng nên chưa thể đo tỷ lệ; nhập doanh thu thực tế trước.";
    const foodLevel = !hasMonthlyRevenue ? "danger" : foodEstimated ? "warning" : foodRatio <= foodTarget ? "good" : foodRatio <= foodTarget + .03 ? "warning" : "danger";
    const foodAction = !hasMonthlyRevenue
      ? noRevenueAction
      : foodEstimated
      ? `Chưa đủ giá vốn trong tháng; hệ thống đang tạm tính theo định mức ${pct(foodTarget)}. Nhập nguyên liệu/giá vốn để có số thực tế.`
      : foodLevel === "good"
      ? "Giữ định lượng, giá mua và kiểm soát hao hụt theo từng món."
      : `Giảm ít nhất ${pct(foodRatio - foodTarget)} doanh thu: kiểm tra định lượng, giá mua, hủy món và thất thoát nguyên liệu.`;
    const payrollLevel = !hasMonthlyRevenue ? "danger" : payrollRatio <= payrollTarget ? "good" : payrollRatio <= payrollTarget + .03 ? "warning" : "danger";
    const payrollAction = !hasMonthlyRevenue
      ? noRevenueAction
      : payrollLevel === "good"
      ? `${payrollHasRecordedCost ? "Chi phí đã ghi nhận" : `Dự toán ${money(monthlyPayrollBudget)}/tháng`} đang phù hợp với doanh thu; duy trì lịch ca theo lưu lượng bán.`
      : `Chi nhân sự vượt ${pct(payrollRatio - payrollTarget)} doanh thu; rà lịch ca, năng suất/suất và doanh thu cần gánh cho mỗi nhân sự.`;
    const primeLevel = !hasMonthlyRevenue ? "danger" : primeCostRatio > .65 ? "danger" : foodEstimated || primeCostRatio > .60 ? "warning" : "good";
    const primeDriver = foodRatio - foodTarget >= payrollRatio - payrollTarget ? "giá vốn nguyên liệu" : "chi phí nhân sự";
    const primeAction = !hasMonthlyRevenue
      ? noRevenueAction
      : foodEstimated
      ? "Prime Cost đang dùng giá vốn ước tính; hoàn thiện dữ liệu nguyên liệu trước khi dùng để quyết định cắt chi phí."
      : primeLevel === "good"
      ? "Prime Cost trong vùng an toàn; tiếp tục theo dõi đồng thời nguyên liệu và nhân sự."
      : `Ưu tiên xử lý ${primeDriver} trước; đây là phần đang kéo Prime Cost lên cao nhất.`;
    const operatingLevel = !hasMonthlyRevenue ? "danger" : operatingExpenseRatio <= operatingExpenseTarget ? "good" : operatingExpenseRatio <= operatingExpenseTarget + .03 ? "warning" : "danger";
    const operatingAction = !hasMonthlyRevenue
      ? noRevenueAction
      : operatingLevel === "good"
      ? "Chi phí vận hành đang nằm trong ngân sách mô hình."
      : `Vượt ${pct(operatingExpenseRatio - operatingExpenseTarget)} doanh thu; kiểm tra mặt bằng, điện nước, gas, POS và các chi phí ngoài kế hoạch.`;
    const marginLevel = !hasMonthlyRevenue ? "danger" : netMarginRatio >= num(targets.netMargin) ? "good" : netMarginRatio >= .10 ? "warning" : "danger";
    const plannedMonthlyProfit = targetMonthlyRevenue * netMarginRatio;
    const marginAction = !hasMonthlyRevenue
      ? noRevenueAction
      : marginLevel === "good"
      ? `Mô hình đạt biên lợi nhuận kế hoạch, tương đương khoảng ${money(plannedMonthlyProfit)}/tháng khi doanh thu đạt ${money(targetMonthlyRevenue)}.`
      : `Biên lợi nhuận kế hoạch thấp; xử lý ${primeLevel !== "good" ? primeDriver : operatingLevel !== "good" ? "chi phí vận hành" : "doanh thu tháng"} trước.`;
    const ceoKpiPanel = `<div class="panel ceo-kpi-panel"><div class="panel-head"><div><h3>KPI kiểm soát tháng</h3></div><span class="ceo-kpi-summary">${[revenueLevel, foodLevel, payrollLevel, primeLevel, operatingLevel, marginLevel].filter(level => level === "danger").length} chỉ số đỏ</span></div><div class="ceo-kpi-grid">
      ${ceoKpiCard("Doanh thu tháng", money(monthlyRevenue), `Mục tiêu cố định ${money(targetMonthlyRevenue)}`, revenueLevel, revenueAction, "Lũy kế")}
      ${ceoKpiCard("Food Cost", hasMonthlyRevenue ? pct(foodRatio) : "—", `Mục tiêu ≤ ${pct(foodTarget)}`, foodLevel, foodAction, !hasMonthlyRevenue ? "Chưa đo" : foodEstimated ? "Ước tính" : "Thực tế")}
      ${ceoKpiCard("Labor Cost", hasMonthlyRevenue ? pct(payrollRatio) : "—", `Ngân sách ${money(monthlyPayrollBudget)} · Mục tiêu ≤ ${pct(payrollTarget)} · ${activeEmployeeCount} nhân sự`, payrollLevel, payrollAction, !hasMonthlyRevenue ? "Chưa đo" : payrollHasRecordedCost ? "Thực tế" : "Kế hoạch")}
      ${ceoKpiCard("Prime Cost", hasMonthlyRevenue ? pct(primeCostRatio) : "—", "An toàn ≤ 60% · Cảnh báo 60–65%", primeLevel, primeAction, !hasMonthlyRevenue ? "Chưa đo" : foodEstimated ? "Ước tính" : "Thực tế")}
      ${ceoKpiCard("Chi phí vận hành tháng", hasMonthlyRevenue ? pct(operatingExpenseRatio) : "—", `Ngân sách ${money(monthlyPremisesCost)} · Mục tiêu ≤ ${pct(operatingExpenseTarget)}`, operatingLevel, operatingAction, hasMonthlyRevenue ? "Kế hoạch" : "Chưa đo")}
      ${ceoKpiCard("Biên lợi nhuận tháng", hasMonthlyRevenue ? pct(netMarginRatio) : "—", `Mục tiêu ≥ ${pct(num(targets.netMargin))}`, marginLevel, marginAction, hasMonthlyRevenue ? "Ước tính" : "Chưa đo")}
    </div></div>`;
    const supplierPurchaseItems = newestFirst(d.expenses).slice(0, 200);
    const supplierPnlGroups = [...new Set(supplierPurchaseItems.map(item => item.group || "Chưa phân nhóm"))].sort((a,b) => a.localeCompare(b, "vi"));
    const supplierPurchaseRows = (items) => items.map(item => [
      `<strong>${escapeHtml(item.supplier || "Chưa xác định")}</strong>`,
      `<strong>${escapeHtml(item.code || "—")}</strong>`,
      `<strong>${escapeHtml(item.description || item.code || "—")}</strong>${item.note ? `<br><small>${escapeHtml(item.note)}</small>` : ""}`,
      money(item.amount),
      item.pnl ? '<span class="pill green">Tính P&L</span>' : '<span class="pill gray">Ngoài P&L</span>',
      item.pnl && d.totalRevenue ? pct(item.amount / d.totalRevenue) : "—",
    ]);
    const supplierPurchaseTable = (items, filtered = false) => items.length
      ? table(["Nhà cung cấp","Mã chi","Sản phẩm mua","Giá trị HĐ","P&L","% DT"],supplierPurchaseRows(items),[3,5])
      : `<div class="empty">${filtered ? "Không có dòng chi phí thuộc nhóm P&L đã chọn." : "Chưa có khoản mua từ nhà cung cấp trong phạm vi đang chọn."}</div>`;
    const supplierPurchasePanel = `<div class="panel dashboard-supplier-purchases"><div class="panel-head"><div><h3>Tổng hợp chi theo nhà cung cấp</h3><p>${monthLabel} · Mỗi hóa đơn/sản phẩm là một dòng riêng; không gộp theo nhà cung cấp.</p></div><div class="supplier-pnl-filter"><label for="supplier-purchase-pnl">Nhóm P&L</label><select id="supplier-purchase-pnl"><option value="">Tất cả nhóm P&L</option>${supplierPnlGroups.map(group=>`<option value="${escapeHtml(group)}">${escapeHtml(group)}</option>`).join("")}</select><small id="supplier-purchase-count">${supplierPurchaseItems.length} dòng mua hàng</small></div></div><div class="table-wrap" id="supplier-purchase-table">${supplierPurchaseTable(supplierPurchaseItems)}</div></div>`;
    const accountFlowEntries = newestFirst(ledgerEntries().filter(entry => inReportRange(entry.date)));
    const isInternalTransfer = (entry) => ["Chuyển quỹ", "Bàn giao", "Đổi tiền khách"].includes(entry.kind);
    const actualCashAccounts = accounts(["cash", "bank"]);
    const actualFlowEntries = accountFlowEntries.filter(entry => actualCashAccounts.some(account => account.id === entry.accountId) && !isInternalTransfer(entry));
    const accountCashIn = sum(actualFlowEntries.filter(entry => entry.amount > 0), "amount");
    const accountCashOut = Math.abs(sum(actualFlowEntries.filter(entry => entry.amount < 0), "amount"));
    const netCashFlow = accountCashIn - accountCashOut;
    const specialCashIn = sum(actualFlowEntries.filter(entry => entry.kind === "Tiền nhận nhầm"), "amount");
    const specialCashOut = Math.abs(sum(actualFlowEntries.filter(entry => entry.kind === "Hoàn tiền nhận nhầm"), "amount"));
    const employeeRecoveryCashIn = sum(actualFlowEntries.filter(entry => entry.kind === "Thu bồi thường nhân viên"), "amount");
    const specialCashFlowNote = specialCashIn || specialCashOut || employeeRecoveryCashIn ? `Bao gồm ${money(specialCashIn)} tiền nhận nhầm, ${money(specialCashOut)} hoàn tiền và ${money(employeeRecoveryCashIn)} thu bồi thường nhân viên ngoài P&L.` : "Chưa có khoản tiền nhận nhầm, hoàn tiền hoặc bồi thường nhân viên ngoài P&L trong kỳ.";
    const internalTransferAmount = Math.abs(sum(accountFlowEntries.filter(entry => entry.amount < 0 && isInternalTransfer(entry)), "amount"));
    const accountCashInEntries = actualCashAccounts.map(account => [
      account.name,
      sum(actualFlowEntries.filter(entry => entry.accountId === account.id && entry.amount > 0), "amount"),
    ]).filter(([, value]) => value > 0);
    const accountCashOutEntries = actualCashAccounts.map(account => [
      account.name,
      Math.abs(sum(actualFlowEntries.filter(entry => entry.accountId === account.id && entry.amount < 0), "amount")),
    ]).filter(([, value]) => value > 0);
    const accountBalanceCards = actualCashAccounts.map(account => `<div class="account-balance-mini"><span>${escapeHtml(account.name)}</span><strong>${money(accountBalance(account.id, reportEnd()))}</strong></div>`).join("");
    const pendingAppSales = appSalesWaitingForWithdrawal(reportEnd());
    const pendingAppPayouts = appPayoutsWaitingForPayment(reportEnd());
    const pendingAppAmount = sum(pendingAppSales, "net") + sum(pendingAppPayouts, payoutNet);
    const overdueAppPayouts = pendingAppPayouts.filter(payout => {
      if (!payout.requestDate) return false;
      const age = Math.floor((new Date(`${reportEnd()}T00:00:00`) - new Date(`${payout.requestDate}T00:00:00`)) / 86400000);
      return age > targets.appPayoutDays;
    });
    const reconciliationsAsOf = actualCashAccounts.map(account => ({
      account,
      reconciliation: newestFirst((state.reconciliations || []).filter(item => item.accountId === account.id && item.date <= reportEnd()))[0],
    }));
    const reconciledAccounts = reconciliationsAsOf.filter(item => item.reconciliation);
    const cashVariance = sum(reconciledAccounts, item => Math.abs(num(item.reconciliation.actual) - accountBalance(item.account.id, item.reconciliation.date)));
    const openMisreceived = sum(misreceivedCases().filter(item => item.date <= reportEnd()), item => {
      const refunded = sum(misreceivedRefunds().filter(refund => refund.caseId === item.id && refund.date <= reportEnd()), "amount");
      return Math.max(0, num(item.amount) - refunded);
    });
    const accountFlowDonut = (title, centerValue, centerLabel, entries, total) => `<section class="account-flow-donut"><h4>${title}</h4><div class="pnl-layout"><div class="donut" style="--segments:${gradient(entries, total)}">${donutLabels(entries, total)}<div class="donut-center"><strong>${centerValue}</strong><span>${centerLabel}</span></div></div><div class="legend">${legend(entries, total, 6, true)}</div></div></section>`;
    const accountFlowPanel = `<div class="panel account-flow-panel"><div class="panel-head"><div><h3>Dòng tiền theo quỹ / tài khoản</h3><p>${monthLabel} · Chỉ tính tiền thực tại quỹ tiền mặt và ngân hàng; chuyển nội bộ được tách riêng.</p></div></div><div class="cash-flow-kpis"><div class="cash-flow-kpi in"><span>Tiền vào thực</span><strong>${money(accountCashIn)}</strong></div><div class="cash-flow-kpi out"><span>Tiền ra thực</span><strong>${money(accountCashOut)}</strong></div><div class="cash-flow-kpi ${netCashFlow >= 0 ? "net-positive" : "net-negative"}"><span>Dòng tiền thuần</span><strong>${netCashFlow > 0 ? "+" : netCashFlow < 0 ? "−" : ""}${money(Math.abs(netCashFlow))}</strong></div><div class="cash-flow-kpi internal"><span>Chuyển nội bộ</span><strong>${money(internalTransferAmount)}</strong></div></div><p class="form-hint">${specialCashFlowNote}</p><div class="account-flow-donuts">${accountFlowDonut("Tiền vào theo tài khoản", money(accountCashIn), "Tổng vào thực", accountCashInEntries, accountCashIn)}${accountFlowDonut("Tiền ra theo tài khoản", money(accountCashOut), "Tổng ra thực", accountCashOutEntries, accountCashOut)}</div><div class="account-balance-section"><h4>Số dư thực dùng tại cuối kỳ</h4><div class="account-balance-minis">${accountBalanceCards}</div><div class="pending-app-flow"><div><strong>Tiền App chờ về</strong><small>${pendingAppSales.length} dòng chưa yêu cầu rút · ${pendingAppPayouts.length} đợt chờ App thanh toán</small></div><b>${money(pendingAppAmount)}</b></div></div></div>`;
    const operationalAlertPanel = `<div class="panel operational-alert-panel"><div class="panel-head"><div><h3>Cảnh báo tài chính & vận hành</h3><p>Các khoản cần xử lý để số dư tiền và báo cáo không bị treo hoặc sai bản chất.</p></div></div><div class="alerts operational-alerts">
          ${amountAlertRow("Tiền App chờ về", pendingAppAmount, pendingAppAmount === 0 ? "Không còn tiền chờ App." : `${pendingAppSales.length} dòng chưa yêu cầu rút · ${pendingAppPayouts.length} đợt chờ App thanh toán${overdueAppPayouts.length ? ` · ${overdueAppPayouts.length} đợt quá ${targets.appPayoutDays} ngày` : ""}`, pendingAppAmount === 0 ? "good" : overdueAppPayouts.length ? "danger" : "warning")}
          ${amountAlertRow("Công nợ NCC còn mở", d.debt, d.debt ? "Hóa đơn chưa thanh toán hết; kiểm tra tại Công nợ NCC." : "Không còn hóa đơn công nợ.", d.debt === 0 ? "good" : "warning")}
          ${amountAlertRow("Tiền nhận nhầm chờ hoàn", openMisreceived, openMisreceived ? "Chỉ hoàn khi có chứng từ giao dịch gốc và lệnh hoàn tiền." : "Không có hồ sơ nhận nhầm cần hoàn.", openMisreceived === 0 ? "good" : "danger")}
          ${cashVarianceAlert(cashVariance, reconciledAccounts.length, actualCashAccounts.length)}
        </div></div>`;
    app.innerHTML = `
      <div class="welcome"><div><h2>Chào buổi làm việc 👋</h2><p>Số liệu ${monthLabel} được tổng hợp từ Thu, Bán App và Chi.</p></div><span class="status-chip">● Hệ thống hoạt động</span></div>
      <div class="dashboard-grid">
        ${pnlRevenuePanel}
        ${ceoKpiPanel}
        ${panelDonut("Cơ cấu chi phí", "Tổng chi phí là 100%; các chỉ số hiển thị theo tỷ lệ trên chi phí.", money(d.totalExpenses), "Tổng chi phí", costEntries, d.totalExpenses)}
        ${panelDonut("Cơ cấu doanh thu", "Doanh thu gộp theo kênh", money(d.totalRevenue), "Tổng doanh thu", [...d.channelMap.entries()].sort((a,b)=>b[1]-a[1]), d.totalRevenue, true)}
      </div>
      ${operationalAlertPanel}`;
    app.insertAdjacentHTML("beforeend", accountFlowPanel + supplierPurchasePanel);
    const supplierPnlInput = document.querySelector("#supplier-purchase-pnl");
    const supplierPurchaseTableEl = document.querySelector("#supplier-purchase-table");
    const supplierPurchaseCount = document.querySelector("#supplier-purchase-count");
    supplierPnlInput?.addEventListener("change", () => {
      const group = supplierPnlInput.value;
      const filteredItems = group ? supplierPurchaseItems.filter(item => (item.group || "Chưa phân nhóm") === group) : supplierPurchaseItems;
      supplierPurchaseTableEl.innerHTML = supplierPurchaseTable(filteredItems, Boolean(group));
      supplierPurchaseCount.textContent = group ? `${filteredItems.length}/${supplierPurchaseItems.length} dòng thuộc nhóm` : `${supplierPurchaseItems.length} dòng mua hàng`;
    });
  }

  const kpi = (label, value, note, icon, accent) => `<div class="kpi-card" style="--accent:${accent}22"><div class="kpi-label"><span>${label}</span><b class="kpi-icon" style="color:${accent}">${icon}</b></div><div class="kpi-value">${value}</div><div class="kpi-note">${note}</div></div>`;
  function ceoKpiCard(label, value, target, level, action, valueMode = "Thực tế") {
    const status = level === "good" ? "Đạt" : level === "warning" ? "Cần chú ý" : "Hành động ngay";
    const icon = level === "good" ? "✓" : level === "warning" ? "!" : "×";
    return `<article class="ceo-kpi-card ${level}"><div class="ceo-kpi-icon">${icon}</div><div class="ceo-kpi-copy"><div class="ceo-kpi-card-head"><span>${escapeHtml(label)}</span><b>${status}</b></div><small>${target}</small><p><strong>Gợi ý:</strong> ${action}</p></div><div class="ceo-kpi-actual"><span>${escapeHtml(valueMode)}</span><strong class="ceo-kpi-value">${value}</strong></div></article>`;
  }
  function alertMarkup(label, note, value, level) {
    const icon = level === "good" ? "✓" : level === "warning" ? "!" : "×";
    return `<div class="alert"><div class="alert-icon ${level}">${icon}</div><div><h4>${label}</h4><p>${note}</p></div><b class="${level}">${value}</b></div>`;
  }
  function maxRatioAlertRow(label, actual, target, detail = "") {
    const delta = actual - target;
    const level = delta > .03 ? "danger" : delta > 0 ? "warning" : "good";
    const note = delta > 0 ? `${detail} · Cao hơn mục tiêu ${pct(delta)}` : `${detail} · Trong mục tiêu ≤ ${pct(target)}`;
    return alertMarkup(label, note, pct(actual), level);
  }
  function minRatioAlertRow(label, actual, target, detail = "") {
    const delta = target - actual;
    const level = delta > .03 ? "danger" : delta > 0 ? "warning" : "good";
    const note = delta > 0 ? `${detail} · Thấp hơn mục tiêu ${pct(delta)}` : `${detail} · Đạt mục tiêu ≥ ${pct(target)}`;
    return alertMarkup(label, note, pct(actual), level);
  }
  function minAmountAlertRow(label, actual, target, detail = "") {
    const delta = target - actual;
    const level = delta > target * .10 ? "danger" : delta > 0 ? "warning" : "good";
    const note = delta > 0 ? `${detail} · Thiếu ${money(delta)} để đạt mục tiêu ${money(target)}/ngày` : `${detail} · Đạt mục tiêu ≥ ${money(target)}/ngày`;
    return alertMarkup(label, note, money(actual), level);
  }
  function cashVarianceAlert(variance, reconciledCount, accountCount) {
    if (!reconciledCount) return alertMarkup("Chênh lệch quỹ & ngân hàng", `Chưa đối soát ${accountCount} quỹ / tài khoản tiền thực.`, "Chưa đối soát", "warning");
    const level = variance === 0 ? "good" : "danger";
    const note = variance === 0
      ? `${reconciledCount}/${accountCount} quỹ / tài khoản đã đối soát · Khớp sổ.`
      : `${reconciledCount}/${accountCount} quỹ / tài khoản đã đối soát · Cần giải thích bằng chứng từ.`;
    return alertMarkup("Chênh lệch quỹ & ngân hàng", note, money(variance), level);
  }
  function amountAlertRow(label, amount, note, level = "good") {
    return alertMarkup(label, note, money(amount), level);
  }

  function renderRevenue() {
    setHeader("Nhập doanh thu quán", "NHẬP LIỆU HẰNG NGÀY");
    const allRows = newestFirst((state.revenues || []).filter(inPeriod));
    const voidedRows = allRows.filter(isVoidedRevenue);
    const activeRows = allRows.filter(row => !isVoidedRevenue(row));
    const rows = showVoidedRevenues ? allRows : activeRows;
    const history = `<div class="panel"><div class="panel-head"><div><h3>Lịch sử doanh thu</h3><p>${activeRows.length} dòng được tính doanh thu trong kỳ${voidedRows.length ? ` · ${voidedRows.length} dòng đã hủy không tính P&L` : ""}</p></div>${voidedRows.length ? `<div class="panel-actions"><button class="small-button" id="revenue-void-toggle">${showVoidedRevenues ? "Ẩn dòng đã hủy" : `Xem ${voidedRows.length} dòng đã hủy`}</button></div>` : ""}</div><div class="table-wrap">${revenueTable(rows)}</div><div class="pagination-note">Dòng chuyển khoản nhập nhầm có thể hủy để tạo hồ sơ tiền nhận nhầm; lịch sử hủy vẫn được lưu để đối chiếu chứng từ.</div></div>`;
    app.innerHTML = sectionWithForm(revenueForm(), history, "compact-form-layout");
    bindRevenueForm();
    document.querySelector("#revenue-void-toggle")?.addEventListener("click", () => { showVoidedRevenues = !showVoidedRevenues; render(); });
    document.querySelectorAll("[data-revenue-void]").forEach(button => button.addEventListener("click", () => openRevenueVoid(button.dataset.revenueVoid)));
  }

  function revenueForm() {
    return `<div class="panel form-panel"><div class="panel-head"><div><h3>Chốt doanh thu ngày</h3><p>Thay cho sheet Thu</p></div></div><form id="revenue-form"><div class="form-grid">
      ${field("Ngày", "date", "date", today)}
      <div class="field"><label>Hình thức nhận tiền</label><select name="receiptMethod" id="receipt-method"><option value="cash">Tiền mặt</option><option value="transfer">Chuyển khoản</option><option value="card">Thẻ</option></select></div>
      ${field("Số tiền thực nhận", "amount", "number", "", "0", true)}
      ${field("Mã giao dịch / chứng từ", "bankReference", "text", "", "Ví dụ: FT..., POS..., PT-001", true)}
      ${field("Ghi chú", "note", "text", "", "", true)}
      </div><div class="calc-box"><span>Số tiền đã nhập</span><strong id="revenue-amount-preview">0 ₫</strong></div><div class="calc-box"><span>Hạch toán tự động vào</span><strong id="receipt-account">Tiền mặt vận hành</strong></div><p class="form-hint">Chuyển khoản và thẻ được ghi nhận ngay vào Tài khoản ngân hàng. Doanh thu App được theo dõi riêng tại App chờ đối soát cho đến khi tạo đợt rút và tiền thực về ngân hàng.</p><div class="form-actions"><button class="primary-button">Lưu doanh thu</button></div></form></div>`;
  }

  function revenueTable(rows) {
    return table(["Ngày","Hình thức","Nơi nhận tiền","Số tiền","Ghi chú","Trạng thái","Thao tác"], rows.slice(0,100).map(x => {
      const methods = [["Tiền mặt", num(x.cash)], ["Chuyển khoản", num(x.transfer)], ["Thẻ", num(x.card)]].filter(([, amount]) => amount > 0);
      const destinations = new Set(methods.map(([label]) => label === "Tiền mặt" ? "Tiền mặt vận hành" : "Tài khoản ngân hàng"));
      const voidInfo = x.voided || {};
      const canVoid = !isVoidedRevenue(x) && num(x.transfer) > 0 && num(x.cash) === 0 && num(x.card) === 0;
      const note = isVoidedRevenue(x)
        ? [x.note, voidInfo.caseCode ? `Hồ sơ: ${voidInfo.caseCode}` : "", voidInfo.bankReference ? `Mã gốc: ${voidInfo.bankReference}` : "", voidInfo.evidenceReference ? `CT: ${voidInfo.evidenceReference}` : ""].filter(Boolean).map(escapeHtml).join("<br>") || "—"
        : escapeHtml(x.note) || "—";
      const status = isVoidedRevenue(x)
        ? `<span class="pill red">Đã hủy khỏi doanh thu</span><br><small>${escapeHtml(voidInfo.reason || "Tiền nhận nhầm")}</small>`
        : '<span class="pill green">Tính doanh thu</span>';
      const action = isVoidedRevenue(x) ? "—" : canVoid
        ? `<button class="small-button danger-button" data-revenue-void="${escapeHtml(x.id)}">Hủy / đổi loại</button>`
        : "—";
      return [dateVi(x.date), methods.length === 1 ? methods[0][0] : "Hỗn hợp", [...destinations].join(" / "), isVoidedRevenue(x) ? `<del>${money(num(x.cash) + num(x.transfer) + num(x.card))}</del>` : money(num(x.cash) + num(x.transfer) + num(x.card)), note, status, action];
    }), [3]);
  }

  function bindRevenueForm() {
    const form = document.querySelector("#revenue-form");
    const methodInput = form.querySelector("#receipt-method");
    const receiptAccount = form.querySelector("#receipt-account");
    const updateAccountLabel = () => { receiptAccount.textContent = methodInput.value === "cash" ? "Tiền mặt vận hành" : "Tài khoản ngân hàng"; };
    methodInput.addEventListener("change", updateAccountLabel); updateAccountLabel(); bindAmountPreview(form, "amount", "revenue-amount-preview");
    form.addEventListener("submit", async event => { event.preventDefault(); const fd = new FormData(form); const amount=num(fd.get("amount")), method=fd.get("receiptMethod"), bankReference=String(fd.get("bankReference")||"").trim(); if(amount<=0){toast("Vui lòng nhập số tiền thực nhận lớn hơn 0");return;} if(["transfer","card"].includes(method)&&!bankReference){toast("Vui lòng nhập mã giao dịch/sao kê cho khoản tiền vào tài khoản");return;} state.revenues.push({id:uid("rev"),createdAt:Date.now(), date:fd.get("date"), cash:method==="cash"?amount:0,transfer:method==="transfer"?amount:0,card:method==="card"?amount:0,cashAccountId:defaultAccountId("cash"),transferAccountId:defaultAccountId("bank"),cardAccountId:defaultAccountId("bank"),handover:0,openingCash:0,actualCash:null,bankReference,note:fd.get("note")}); persist(); toast(`Đã lưu doanh thu và cập nhật ${method === "cash" ? "Tiền mặt vận hành" : "Tài khoản ngân hàng"}`); render(); });
  }

  function openRevenueVoid(revenueId) {
    const revenue = (state.revenues || []).find(item => item.id === revenueId);
    if (!revenue || isVoidedRevenue(revenue)) { toast("Dòng doanh thu này không còn hiệu lực để hủy"); return; }
    const amount = num(revenue.transfer);
    if (amount <= 0 || num(revenue.cash) > 0 || num(revenue.card) > 0) {
      toast("Chỉ hủy trực tiếp được dòng chuyển khoản riêng; dòng hỗn hợp cần tách riêng trước");
      return;
    }
    const accountId = revenue.transferAccountId || defaultAccountId("bank");
    modalContent.innerHTML=`<h2>Hủy / đổi phân loại doanh thu</h2><p>Chỉ dùng khi dòng chuyển khoản đã nhập nhầm là doanh thu. Hệ thống không xóa dấu vết: sau khi tạo hồ sơ tiền nhận nhầm, dòng này sẽ bị loại khỏi doanh thu và P&L.</p><form id="revenue-void-form"><div class="form-grid"><div class="field"><label>Ngày doanh thu đã nhập</label><input type="text" value="${escapeHtml(dateVi(revenue.date))}" readonly></div><div class="field"><label>Số tiền cần tách</label><input type="text" value="${escapeHtml(money(amount))}" readonly></div><div class="field full"><label>Tài khoản đang nhận tiền</label><input type="text" value="${escapeHtml(accountName(accountId))}" readonly></div>${field("Mã giao dịch ngân hàng gốc","bankReference","text","","Ví dụ: FT45435345/BK",true)}${field("Người chuyển / khách","counterparty","text","","Nếu xác định được",true)}${field("Số chứng từ / ghi chú hồ sơ giấy","evidenceReference","text","","Ví dụ: BB-1807-01 hoặc lưu kèm bản in",true)}${field("Ghi chú hủy doanh thu","note","text","","Lý do hoặc người kiểm tra",true)}</div><div class="calc-box"><span>Sau khi hoàn tất</span><strong>${money(amount)} sẽ là tiền nhận nhầm chờ hoàn</strong></div><p class="form-hint">Bước tiếp theo sẽ mở sẵn form Giao dịch đặc biệt. Nếu bạn đóng form đó mà chưa lưu, dòng doanh thu này vẫn giữ nguyên.</p><div class="form-actions"><button class="primary-button">Tiếp tục tạo hồ sơ nhận nhầm</button></div></form>`;
    openModal();
    document.querySelector("#revenue-void-form").addEventListener("submit", event => {
      event.preventDefault();
      const fd = new FormData(event.currentTarget);
      const bankReference = String(fd.get("bankReference") || "").trim();
      if (!bankReference) { toast("Vui lòng nhập mã giao dịch ngân hàng gốc để truy vết"); return; }
      const counterparty = String(fd.get("counterparty") || "").trim();
      const evidenceReference = String(fd.get("evidenceReference") || "").trim();
      const note = String(fd.get("note") || "").trim();
      closeModal();
      openSpecialCashTransaction({
        requireMisreceived: true,
        sourceRevenueId: revenue.id,
        date: revenue.date,
        amount,
        accountId,
        bankReference,
        counterparty,
        note: ["Tách từ doanh thu nhập nhầm", note, evidenceReference ? `Chứng từ: ${evidenceReference}` : ""].filter(Boolean).join(" · "),
        onMisreceivedCreated: transaction => {
          const voidedAt = Date.now();
          revenue.voidedAt = voidedAt;
          revenue.updatedAt = voidedAt;
          revenue.voided = {
            at: voidedAt,
            reason: "Tiền khách chuyển nhầm",
            bankReference,
            counterparty,
            evidenceReference,
            note,
            specialTransactionId: transaction.id,
            caseCode: transaction.caseCode,
          };
        },
      });
    });
  }

  function renderApps() {
    setHeader("Tiền App phải trả", "BÁO CÁO APP");
    const rows = newestFirst((state.appSales || []).filter(inPeriod));
    const options = (state.apps || []).map(x=>`<option>${escapeHtml(x)}</option>`).join("");
    const payoutRows = newestFirst(appPayouts().filter(item => inReportRange(item.requestDate) || inReportRange(item.settledDate) || payoutSales(item).some(sale => inReportRange(sale.date))), item => item.settledDate || item.requestDate);
    const unrequestedCount = (state.appSales || []).filter(item => !item.payoutId && num(item.net) > 0).length;
    const form = `<div class="panel form-panel"><div class="panel-head"><div><h3>Ghi nhận tiền App phải trả theo ngày</h3></div></div><form id="app-form"><div class="form-grid">${field("Ngày báo cáo","date","date",today)}<div class="field"><label>Ứng dụng</label><select name="app">${options}</select></div>${field("Grab phải trả quán","amount","number","","0")}${field("Số đơn báo cáo","orders","number","","Không bắt buộc")}${field("Mã / tệp báo cáo","reportReference","text","","Không bắt buộc",true)}${field("Ghi chú","note","text","","",true)}</div><div class="calc-box"><span>Tiền đang chờ rút tại App</span><strong id="app-net">0 ₫</strong></div><div class="form-actions"><button class="primary-button">Lưu tiền App phải trả</button></div></form></div>`;
    const salesHtml = table(["Ngày báo cáo","App","Số đơn","App phải trả","Mã báo cáo","Tình trạng"], rows.slice(0,100).map(x=>{const status=appSaleStatus(x);return [dateVi(x.date),`<span class="pill green">${escapeHtml(x.app)}</span>`,x.orders ? fmt.format(num(x.orders)) : "—",money(x.net),escapeHtml(x.reportReference || "—"),`<span class="pill ${status.tone}">${escapeHtml(status.label)}</span>`];}), [3]);
    const payoutsHtml = table(["Ngày yêu cầu rút","Mã đối soát","App","Số ngày","App phải trả","Trạng thái","Thao tác"], payoutRows.slice(0,100).map(item=>[dateVi(item.requestDate),`<strong>${escapeHtml(item.withdrawalCode || "—")}</strong>${item.payoutReference?`<br><small>${escapeHtml(item.payoutReference)}</small>`:""}`,`<span class="pill green">${escapeHtml(item.app || "Khác")}</span>`,fmt.format(payoutSales(item).length),money(payoutNet(item)),item.settledDate?`<span class="pill green">Đã nhận ${dateVi(item.settledDate)}</span>`:'<span class="pill orange">Chờ App thanh toán</span>',item.settledDate?'—':`<button class="small-button" data-app-settle="${escapeHtml(item.id)}">Đã nhận</button>`]), [4]);
    const content = `<div class="app-panels"><div class="panel app-payout-callout"><div><h3>Gom tiền App thành một đợt rút</h3><p>Chọn các ngày của cùng App đã có báo cáo. Mỗi đợt rút chỉ tạo một mã APP và một giao dịch nhận tiền tại ngân hàng.</p></div><button class="primary-button" id="create-app-payout">＋ Tạo đợt rút gộp</button></div>${tablePanel("Tiền App phải trả đã ghi nhận", `${rows.length} dòng trong kỳ · ${unrequestedCount} dòng chưa yêu cầu rút`, salesHtml)}${tablePanel("Đợt rút App", `${payoutRows.length} đợt liên quan kỳ đang chọn`, payoutsHtml)}</div>`;
    app.innerHTML = sectionWithForm(form, content, "compact-form-layout");
    const el = document.querySelector("#app-form"); bindAmountPreview(el, "amount", "app-net");
    el.addEventListener("submit",async event=>{event.preventDefault();const fd=new FormData(el);const amount=num(fd.get("amount"));if(amount<=0){toast("Vui lòng nhập số tiền Grab phải trả lớn hơn 0");return;}state.appSales.push({id:uid("app"),createdAt:Date.now(),date:fd.get("date"),app:fd.get("app"),accountId:defaultAccountId("app"),gross:amount,ads:0,deduction:0,vat:0,pit:0,net:amount,recordingBasis:"net-claim",orders:num(fd.get("orders")),reportReference:String(fd.get("reportReference")||"").trim(),note:fd.get("note")});persist();toast("Đã lưu tiền App phải trả; tiền đang tích lũy tại App");render();});
    document.querySelectorAll("[data-app-settle]").forEach(button=>button.addEventListener("click",()=>openAppSettlement(button.dataset.appSettle)));
    document.querySelector("#create-app-payout").addEventListener("click",openAppPayout);
  }

  function openAppPayout() {
    const unrequested = newestFirst((state.appSales || []).filter(item => !item.payoutId && num(item.net) > 0));
    if (!unrequested.length) { toast("Không có tiền App nào chưa yêu cầu rút"); return; }
    const apps = [...new Set(unrequested.map(item=>item.app || "Khác"))].sort((a,b)=>a.localeCompare(b,"vi"));
    modalContent.innerHTML=`<h2>Tạo đợt rút gộp từ App</h2><p>Chọn các ngày thuộc cùng một App đã có báo cáo. Hệ thống tạo một mã APP duy nhất; khi tiền về ngân hàng chỉ đối soát một giao dịch cho cả đợt.</p><form id="app-payout-form"><div class="form-grid"><div class="field"><label>Ứng dụng</label><select name="app" id="payout-app">${apps.map(name=>`<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("")}</select></div>${field("Ngày xác nhận rút","requestDate","date",localToday())}${field("Mã rút / Payout ID App","payoutReference","text","","Ví dụ: GRAB-PO-12345",true)}${field("Ghi chú đợt rút","note","text","","",true)}<div class="field full"><label>Các ngày App phải trả cần gộp</label><div id="payout-sale-list" class="check-list"></div></div></div><div class="calc-box"><span>Tổng tiền App phải trả của đợt rút</span><strong id="payout-total">0 ₫</strong></div><p class="form-hint">Không thể thêm dòng mới vào đợt đã gửi yêu cầu rút. Dòng mới sẽ thuộc đợt rút kế tiếp.</p><div class="form-actions"><button class="primary-button">Tạo mã đợt rút</button></div></form>`;
    if (!openModal()) return;
    const form=document.querySelector("#app-payout-form"),appInput=form.querySelector("#payout-app"),list=form.querySelector("#payout-sale-list"),total=form.querySelector("#payout-total");
    const renderSales=()=>{const scoped=unrequested.filter(item=>(item.app||"Khác")===appInput.value);list.innerHTML=scoped.map(item=>`<label class="check-row"><input type="checkbox" name="saleId" value="${escapeHtml(item.id)}" checked><span>${dateVi(item.date)} · ${escapeHtml(item.app)}</span><strong>${money(item.net)}</strong></label>`).join("")||'<div class="empty">Không có dòng phù hợp.</div>';list.querySelectorAll("input").forEach(input=>input.addEventListener("change",updateTotal));updateTotal();};
    const updateTotal=()=>{const ids=new Set([...form.querySelectorAll('input[name="saleId"]:checked')].map(input=>input.value));total.textContent=money(unrequested.filter(item=>ids.has(item.id)).reduce((sum,item)=>sum+num(item.net),0));};
    appInput.addEventListener("change",renderSales);renderSales();
    form.addEventListener("submit",event=>{event.preventDefault();const fd=new FormData(form),ids=new Set(fd.getAll("saleId"));const selected=unrequested.filter(item=>ids.has(item.id));if(!selected.length){toast("Chọn ít nhất một ngày App phải trả để tạo đợt rút");return;}const requestDate=fd.get("requestDate"),lastSaleDate=selected.map(item=>item.date).sort().at(-1);if(requestDate<lastSaleDate){toast("Ngày xác nhận rút không thể trước ngày báo cáo cuối cùng");return;}const payout={id:uid("payout"),createdAt:Date.now(),withdrawalCode:nextAppWithdrawalCode(requestDate),requestDate,app:fd.get("app"),appSaleIds:selected.map(item=>item.id),net:selected.reduce((sum,item)=>sum+num(item.net),0),payoutReference:String(fd.get("payoutReference")||"").trim(),settledDate:null,bankReference:"",settlementNote:"",note:String(fd.get("note")||"").trim()};state.appPayouts.push(payout);selected.forEach(item=>{item.payoutId=payout.id;});persist();closeModal();toast(`Đã tạo ${payout.withdrawalCode} gồm ${selected.length} ngày App phải trả`);render();});
  }

  function openAppSettlement(payoutId="") {
    const pending = appPayouts().filter(item => !item.settledDate && payoutNet(item) > 0);
    if (!pending.length) { toast("Không có đợt rút App nào đang chờ đối soát"); return; }
    const selectedId = pending.some(item => item.id === payoutId) ? payoutId : pending[0].id;
    const optionHtml = pending.map(item => `<option value="${escapeHtml(item.id)}" ${item.id===selectedId?"selected":""}>${item.withdrawalCode || "APP"} · ${escapeHtml(item.app)} · ${fmt.format(payoutSales(item).length)} ngày · ${money(payoutNet(item))}</option>`).join("");
    modalContent.innerHTML=`<h2>Xác nhận tiền App đã về ngân hàng</h2><p>Một mã nội bộ ứng với đúng một giao dịch ngân hàng, dù đợt rút gom nhiều ngày doanh thu.</p><form id="app-settlement-form"><div class="form-grid"><div class="field full"><label>Đợt rút chờ đối soát</label><select name="payoutId" id="settlement-payout-select">${optionHtml}</select></div><div class="field"><label>Mã đối soát nội bộ</label><input id="settlement-code" type="text" readonly></div><div class="field"><label>Mã rút / Payout ID App</label><input id="settlement-payout" type="text" readonly></div>${field("Ngày tiền về ngân hàng","settledDate","date",localToday())}<div class="field"><label>Số tiền nhận</label><input id="settlement-amount" type="text" readonly></div>${field("Mã giao dịch / sao kê ngân hàng","bankReference","text","","Bắt buộc để truy vết",true)}${field("Ghi chú đối soát","note","text","","",true)}</div><div class="form-actions"><button class="primary-button">Xác nhận đã nhận tiền</button></div></form>`;
    openModal();
    const form=document.querySelector("#app-settlement-form"), payoutInput=form.querySelector("#settlement-payout-select"), amountInput=form.querySelector("#settlement-amount"), codeInput=form.querySelector("#settlement-code"), appReferenceInput=form.querySelector("#settlement-payout");
    const syncAmount=()=>{const payout=findAppPayout(payoutInput.value);amountInput.value=money(payoutNet(payout));codeInput.value=payout?.withdrawalCode||"";appReferenceInput.value=payout?.payoutReference||"Chưa có mã payout";}; payoutInput.addEventListener("change",syncAmount);syncAmount();
    form.addEventListener("submit",async event=>{event.preventDefault();const fd=new FormData(form),payout=findAppPayout(fd.get("payoutId")),bankReference=String(fd.get("bankReference")||"").trim();if(!payout||payout.settledDate){toast("Đợt rút App này đã được đối soát");return;}if(!bankReference){toast("Vui lòng nhập mã giao dịch hoặc mã sao kê ngân hàng");return;}if(fd.get("settledDate")<payout.requestDate){toast("Ngày tiền về không thể trước ngày xác nhận rút");return;}payout.settledDate=fd.get("settledDate");payout.updatedAt=Date.now();payout.bankReference=bankReference;payout.settlementNote=String(fd.get("note")||"").trim();persist();closeModal();toast(`Đã chuyển ${payout.withdrawalCode} về Tài khoản ngân hàng`);render();});
  }

  function renderExpenses() {
    setHeader("Nhập chi phí", "CHI PHÍ & THANH TOÁN");
    const rows = newestFirst((state.expenses || []).filter(inPeriod));
    const depreciationRows = rows.filter(x => x.operation === "Trích khấu hao");
    const documentRows = rows.filter(x => x.operation !== "Trích khấu hao" && x.operation !== "Chênh lệch thanh toán");
    const totalInvoiceAmount = sum(documentRows, "amount");
    const totalPnlAmount = sum(rows.filter(x => x.pnl), "amount");
    const totalUnpaidAmount = sum(rows.filter(isSupplierPayable), x => expenseOutstandingAsOf(x, reportEnd()));
    const invoiceCount = new Set(documentRows.map(x => String(x.invoice || x.id))).size;
    const pendingAdvance = pendingExpenseAdvanceId ? findSupplierAdvance(pendingExpenseAdvanceId) : null;
    const pendingAdvanceAmount = pendingAdvance ? (num(pendingAdvance.expectedAmount) || supplierAdvanceAvailable(pendingAdvance, reportEnd()) || supplierAdvancePaid(pendingAdvance, reportEnd())) : 0;
    const expenseCategories = sortCategories((state.categories || []).filter(x=>!x.internalOnly && !x.payrollOnly));
    const defaultExpenseCode = expenseCategories[0]?.code || "";
    const codeOptions = (selectedCode="") => expenseCategories.map(x=>{
      const fullText = `${x.code} · ${x.name}`;
      const shortText = x.name || x.code;
      return `<option value="${escapeHtml(x.code)}" data-full="${escapeHtml(fullText)}" data-short="${escapeHtml(shortText)}" ${x.code===selectedCode?"selected":""}>${escapeHtml(fullText)}</option>`;
    }).join("");
    const supplierOptionsHtml = supplierNames().map(name => `<option value="${escapeHtml(name)}"></option>`).join("");
    const sourceOptions = (state.sources || []).map(x=>`<option>${escapeHtml(x)}</option>`).join("");
    const expenseDate = localToday();
    const expenseLine = (selectedCode=defaultExpenseCode, amount="") => `<div class="expense-line" data-expense-line><select data-expense-line-code aria-label="Mã chi">${codeOptions(selectedCode)}</select><input data-expense-line-qty type="number" min="0" step="0.001" value="${amount ? "1" : ""}" placeholder="SL" aria-label="Số lượng"><input data-expense-line-amount type="number" min="0" step="1" value="${escapeHtml(amount)}" placeholder="Tổng tiền" aria-label="Tổng tiền dòng"><div class="expense-line-tools"><span class="expense-line-unit" data-expense-line-unit>SL</span><button class="small-button danger-button" type="button" data-remove-expense-line aria-label="Xóa mã chi" title="Xóa mã chi">×</button></div></div>`;
    const advanceHint = pendingAdvance ? `<div class="form-alert success"><strong>Tạo hóa đơn từ tạm ứng ${escapeHtml(pendingAdvance.advanceCode || pendingAdvance.id)}</strong><br>NCC: ${escapeHtml(pendingAdvance.supplier || "—")} · Giá trị gợi ý: ${money(pendingAdvanceAmount)}. Ô <strong>Tiền thực thanh toán</strong> để 0; sau khi lưu hệ thống sẽ tự cấn trừ tạm ứng NCC, không tạo thêm dòng tiền ra.</div>` : "";
    let form = `<div class="panel form-panel"><div class="panel-head"><div><h3>Ghi nhận khoản chi</h3></div></div>${advanceHint}<form id="expense-form"><div class="form-grid">${field("Ngày","date","date",expenseDate)}${field("Mã hóa đơn","invoice","text",pendingAdvance ? invoiceCodeFromAdvance(pendingAdvance, expenseDate) : nextInvoiceCode(expenseDate))}<div class="field full"><label>Nhà cung cấp <small>(không bắt buộc nếu đã trả ngay và không cần công nợ)</small></label><input name="supplier" type="text" list="expense-supplier-list" value="${escapeHtml(pendingAdvance?.supplier || "")}" ${pendingAdvance ? "readonly" : ""} placeholder="Chọn hoặc nhập NCC"><datalist id="expense-supplier-list">${supplierOptionsHtml}</datalist></div><div class="field full"><label>Chi tiết mã chi</label><div class="expense-lines" id="expense-lines">${expenseLine(defaultExpenseCode, pendingAdvanceAmount || "")}</div><div class="expense-lines-actions"><button class="small-button" type="button" id="add-expense-line">+ Thêm mã chi</button>${pendingAdvance ? `<small>Hóa đơn này sẽ tự cấn trừ với tạm ứng của NCC ${escapeHtml(pendingAdvance.supplier || "")}.</small>` : ""}</div></div><div class="field"><label>Nguồn tiền</label><select name="source" id="expense-source">${sourceOptions}</select></div><div class="field"><label>Tài khoản chi</label><select name="accountId" id="expense-account">${accountOptions(["cash"], defaultAccountId("cash"))}</select></div>${field("Đã thanh toán","paid","number","0","0")}${field("Mã giao dịch thanh toán","bankReference","text","","Ví dụ: FT..., UNC..., PC-001",true)}${attachmentField("File hóa đơn / chứng từ thanh toán")}${field("Ghi chú","note","text",pendingAdvance ? `Hóa đơn về từ hồ sơ tạm ứng ${pendingAdvance.advanceCode || pendingAdvance.id}` : "","",true)}</div><div class="calc-box"><span>Tổng giá trị các mã chi</span><strong id="expense-amount-preview">0 ₫</strong></div><div class="calc-box"><span>Số tiền hóa đơn đã thanh toán</span><strong id="expense-paid-preview">0 ₫</strong></div><div class="form-actions"><button class="primary-button">Lưu khoản chi</button></div></form></div>`;
    form = form
      .replace(`${field("Đã thanh toán","paid","number","0","0")}`, `${field("Đã thanh toán","paid","number","0","0")}<div class="field"><label>Phí ship</label><input name="shippingFee" type="number" min="0" step="1" value="0" placeholder="0"></div>`)
      .replace(`${field("Ghi chú","note","text",pendingAdvance ? `Hóa đơn về từ hồ sơ tạm ứng ${pendingAdvance.advanceCode || pendingAdvance.id}` : "","",true)}`, `<label class="field checkbox-field"><span>Hóa đơn / chứng từ</span><span class="inline-check"><input name="hasInvoice" type="checkbox" checked> Có hóa đơn</span></label>${field("Ghi chú","note","text",pendingAdvance ? `Hóa đơn về từ hồ sơ tạm ứng ${pendingAdvance.advanceCode || pendingAdvance.id}` : "","",true)}`)
      .replaceAll("Đã thanh toán", "Tiền thực thanh toán")
      .replace("Tổng giá trị các mã chi", "Tổng giá trị chứng từ")
      .replace(`<div class="calc-box"><span>Số tiền hóa đơn đã thanh toán</span><strong id="expense-paid-preview">0 ₫</strong></div>`, `<div class="calc-box"><span>Tiền thực thanh toán</span><strong id="expense-paid-preview">0 ₫</strong></div><div class="calc-box" id="expense-diff-box" hidden><span>Chênh lệch thanh toán</span><strong id="expense-diff-preview">0 ₫</strong></div>`);
    const rowsHtml = table(["Ngày","Mã chi","Diễn giải","Nguồn","Giá trị","Đã trả","Trạng thái","Thao tác"],rows.slice(0,120).map(x=>{
      const description = x.description || "—";
      const sourceLabel = x.operation === "Trích khấu hao" ? DEPRECIATION_SOURCE : x.source;
      return [dateVi(x.date),`<strong title="${escapeHtml(x.code)}">${escapeHtml(x.code)}</strong>`,`<span class="expense-history-description" title="${escapeHtml(description)}"><strong>${escapeHtml(description)}</strong></span>`,escapeHtml(sourceLabel),money(x.amount),money(paidByDate(x,reportEnd())),statusPill(x),canEditExpenseDate(x)?`<button class="small-button" data-expense-edit="${escapeHtml(x.id)}">Sửa</button>`:"—"];
    }),[4,5]).replace('class="data-table"', 'class="data-table expense-history-table"');
    const historyPanel = `<div class="panel"><div class="panel-head"><div><h3>Lịch sử chi phí</h3><p>${rows.length} dòng hạch toán · ${invoiceCount} chứng từ${depreciationRows.length ? ` · ${depreciationRows.length} bút toán khấu hao không tính là hóa đơn` : ""}</p></div><div class="panel-metrics"><div class="panel-metric"><span>Tổng giá trị chứng từ</span><strong>${money(totalInvoiceAmount)}</strong></div><div class="panel-metric"><span>Chi phí P&amp;L</span><strong>${money(totalPnlAmount)}</strong></div><div class="panel-metric debt"><span>Công nợ NCC</span><strong>${money(totalUnpaidAmount)}</strong></div></div></div><div class="table-wrap">${rowsHtml}</div><div class="pagination-note">Hiển thị tối đa các dòng gần nhất trong kỳ đang chọn.</div></div>`;
    app.innerHTML=`<div class="section-grid compact-form-layout expense-mobile-layout">${form}${historyPanel}</div>`;
    document.querySelectorAll("[data-expense-edit]").forEach(button=>button.addEventListener("click",()=>openExpenseCategoryEditor(button.dataset.expenseEdit)));
    const el=document.querySelector("#expense-form"), dateInput=el.querySelector('input[name="date"]'), invoiceInput=el.querySelector('input[name="invoice"]'), sourceInput=el.querySelector('#expense-source'), accountInput=el.querySelector('#expense-account'), lineContainer=el.querySelector('#expense-lines');
    const lineNodes=()=>[...lineContainer.querySelectorAll('[data-expense-line]')];
    const syncLineActions=()=>lineNodes().forEach(line=>{line.querySelector('[data-remove-expense-line]').disabled=lineNodes().length===1;});
    const syncLineUnit=(line)=>{
      const select=line.querySelector('[data-expense-line-code]');
      const unit=line.querySelector('[data-expense-line-unit]');
      if(!select||!unit)return;
      const meta=ingredientStockMetaForCategory(select.value);
      unit.textContent=meta.purchaseUnit || "SL";
      unit.title=meta.stockUnit&&meta.purchaseUnit ? `Quy đổi: 1 ${meta.purchaseUnit} = ${fmt.format(meta.conversionFactor)} ${meta.stockUnit}` : "Chưa thiết lập quy đổi NVL";
    };
    const setExpenseSelectDisplay=(select,expanded=false)=>{
      [...select.options].forEach(option=>{
        option.textContent = expanded || !option.selected
          ? (option.dataset.full || option.textContent)
          : (option.dataset.short || option.textContent);
      });
    };
    const setupExpenseSelects=()=>lineNodes().forEach(line=>{
      const select=line.querySelector('[data-expense-line-code]');
      if(!select || select.dataset.compactBound==="1") return;
      select.dataset.compactBound="1";
      select.addEventListener("pointerdown",()=>setExpenseSelectDisplay(select,true));
      select.addEventListener("focus",()=>setExpenseSelectDisplay(select,true));
      select.addEventListener("change",()=>setTimeout(()=>{setExpenseSelectDisplay(select,false);syncLineUnit(line);},0));
      select.addEventListener("blur",()=>setExpenseSelectDisplay(select,false));
      setExpenseSelectDisplay(select,false);
      syncLineUnit(line);
    });
    const lineQuantity = (line) => num(line.querySelector('[data-expense-line-qty]')?.value);
    const lineAmount = (line) => num(line.querySelector('[data-expense-line-amount]')?.value);
    const shippingAmount = () => num(el.querySelector('input[name="shippingFee"]')?.value);
    const updateInvoiceTotal=()=>{const total=lineNodes().reduce((sumValue,line)=>sumValue+lineAmount(line),0)+shippingAmount(),paidValue=num(el.querySelector('input[name="paid"]')?.value),diff=paidValue-total,diffBox=el.querySelector('#expense-diff-box'),diffPreview=el.querySelector('#expense-diff-preview');el.querySelector('#expense-amount-preview').textContent=money(total);if(diffBox&&diffPreview){diffBox.hidden=Boolean(pendingAdvance)||diff===0;diffBox.classList.toggle("negative",diff<0);diffPreview.textContent=`${diff>0?"+":""}${money(diff)}`;}};
    const syncAccount=()=>{const types=sourceInput.value===CASH_SOURCE?["cash"]:["bank"];const preferred=types.includes(findAccount(accountInput.value)?.type)?accountInput.value:defaultAccountId(types[0]);accountInput.innerHTML=accountOptions(types,preferred);};
    sourceInput.addEventListener("change",syncAccount);
    dateInput.addEventListener("change",()=>{invoiceInput.value=nextInvoiceCode(dateInput.value);});
    el.querySelector('#add-expense-line').addEventListener("click",()=>{lineContainer.insertAdjacentHTML("beforeend",expenseLine());syncLineActions();setupExpenseSelects();updateInvoiceTotal();});
    lineContainer.addEventListener("input",event=>{if(event.target.matches('[data-expense-line-qty], [data-expense-line-amount]'))updateInvoiceTotal();});
    el.querySelector('input[name="shippingFee"]')?.addEventListener("input",updateInvoiceTotal);
    el.querySelector('input[name="paid"]')?.addEventListener("input",updateInvoiceTotal);
    lineContainer.addEventListener("click",event=>{const button=event.target.closest?.('[data-remove-expense-line]');if(!button||lineNodes().length===1)return;button.closest('[data-expense-line]').remove();syncLineActions();updateInvoiceTotal();});
    syncAccount();syncLineActions();setupExpenseSelects();updateInvoiceTotal();bindAmountPreview(el,"paid","expense-paid-preview");el.querySelector('input[name="paid"]')?.addEventListener("input",updateInvoiceTotal);
    const handleExpenseSubmit = async (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      const fd = new FormData(el);
      const invoice = String(fd.get("invoice") || "").trim().toUpperCase();
      const date = fd.get("date");
      const source = fd.get("source");
      const accountId = fd.get("accountId");
      const advanceInvoiceMode = Boolean(pendingAdvance);
      const hasInvoice = fd.get("hasInvoice") === "on";
      const supplier = String(fd.get("supplier") || "").trim();
      const bankReference = String(fd.get("bankReference") || "").trim();
      const detailLines = lineNodes().map(line => {
        const code = line.querySelector('[data-expense-line-code]').value;
        const purchaseQuantity = lineQuantity(line);
        const amount = lineAmount(line);
        const cat = (state.categories || []).find(item => item.code === code);
        const pnlGroupCode = cat?.pnlGroupCode || pnlGroupCodeFromValue(cat?.group);
        const isCapitalAsset = pnlGroupCode === "DEP";
        const stockMeta = ingredientStockMetaForCategory(code);
        const stockQuantity = purchaseQuantity * stockMeta.conversionFactor;
        return { cat, amount, quantity: stockQuantity, purchaseQuantity, stockQuantity, stockMeta, supplier, pnlGroupCode, isCapitalAsset };
      });
      const shipAmount = num(fd.get("shippingFee"));
      if (shipAmount > 0) {
        let cat = shippingCategory();
        if (!cat) {
          const usedNumbers = (state.categories || []).map(category => String(category.code || "").toUpperCase().match(/^DEL-(\d+)$/)?.[1]).filter(Boolean).map(value => Number(value));
          cat = { code: `DEL-${String(usedNumbers.length ? Math.max(...usedNumbers) + 1 : 1).padStart(3, "0")}`, name: "Phí ship / vận chuyển", supplier: "", group: pnlGroupLabel("DEL"), pnlGroupCode: "DEL", payrollOnly: false, pnl: true, systemKey: "shipping-fee", note: "Dùng cho phí giao hàng/vận chuyển phát sinh kèm phiếu chi." };
          state.categories.push(cat);
        }
        detailLines.push({ cat, amount: shipAmount, quantity: 1, purchaseQuantity: 1, stockQuantity: 1, stockMeta: { purchaseUnit: "lần", stockUnit: "lần", conversionFactor: 1, trackStock: false }, supplier, pnlGroupCode: "DEL", isCapitalAsset: false, isShipping: true });
      }
      const documentAmount = sum(detailLines, "amount");
      const paid = num(fd.get("paid"));
      const paymentDifference = paid - documentAmount;
      if (!invoice) { toast("Vui lòng nhập mã hóa đơn"); return; }
      if ((state.expenses || []).some(x => String(x.invoice || "").toUpperCase() === invoice)) { toast(`Mã hóa đơn ${invoice} đã tồn tại`); return; }
      if (!detailLines.length || detailLines.some(line => !line.cat || line.purchaseQuantity <= 0 || line.amount <= 0)) { toast("Mỗi mã chi phải có SL và tổng tiền lớn hơn 0"); return; }
      if (advanceInvoiceMode && normalizeCatalogText(supplier) !== normalizeCatalogText(pendingAdvance.supplier)) { toast(`Hóa đơn từ tạm ứng ${pendingAdvance.advanceCode || pendingAdvance.id} phải giữ đúng NCC ${pendingAdvance.supplier}`); return; }
      if (documentAmount > paid && !supplier) { toast("Hóa đơn còn công nợ phải chọn/nhập Nhà cung cấp"); return; }
      if (!findAccount(accountId)) { toast("Vui lòng chọn tài khoản chi"); return; }
      if (paid > 0 && source === TRANSFER_SOURCE && !bankReference) { toast("Vui lòng nhập mã giao dịch ngân hàng cho khoản chuyển khoản"); return; }
      if (paid > 0 && paid > accountBalance(accountId, date)) { toast(`Không thể thanh toán ${money(paid)} từ ${accountName(accountId)} vì số dư theo sổ chỉ còn ${money(accountBalance(accountId, date))}`); return; }
      let attachment = null;
      try { attachment = await readAttachment(fd, "attachment", false); } catch (error) { toast(error.message); return; }
      const createdAt = Date.now();
      const invoiceGroupId = uid("invoice");
      let remainingPaid = Math.min(paid, documentAmount);
      let remainingAdvanceSettlement = advanceInvoiceMode ? Math.min(Math.max(0, documentAmount - remainingPaid), supplierAdvanceAvailable(pendingAdvance, date)) : 0;
      detailLines.forEach((line, index) => {
        const linePaid = Math.min(line.amount, remainingPaid);
        remainingPaid -= linePaid;
        const lineAdvancePaid = Math.min(line.amount - linePaid, remainingAdvanceSettlement);
        remainingAdvanceSettlement -= lineAdvancePaid;
        const payments = [];
        if (linePaid) payments.push({ id: uid("pay"), date, source, accountId, amount: linePaid, bankReference, attachment });
        if (lineAdvancePaid) payments.push(supplierAdvanceSettlementPayment(pendingAdvance, lineAdvancePaid, date));
        const expenseRecord = { id: uid("exp"), invoice, invoiceGroupId, invoiceLineNumber: index + 1, invoiceLineCount: detailLines.length, createdAt: createdAt + detailLines.length - index, date, code: line.cat.code, group: line.cat.group, pnlGroupCode: line.pnlGroupCode, description: line.cat.name, source, amount: line.amount, quantity: line.stockQuantity, purchaseQuantity: line.purchaseQuantity, purchaseUnit: line.stockMeta.purchaseUnit || "", stockUnit: line.stockMeta.stockUnit || "", conversionFactor: line.stockMeta.conversionFactor || 1, ingredientId: line.stockMeta.ingredientId || "", paid: linePaid + lineAdvancePaid, payments, supplier: line.supplier, operation: line.isCapitalAsset ? "Đầu tư tài sản (CAPEX)" : "Mua hàng / Chi phí", pnl: line.isCapitalAsset ? false : line.cat.pnl, note: fd.get("note"), hasInvoice, documentStatus: hasInvoice ? "Có hóa đơn" : "Không hóa đơn", attachment };
        state.expenses.push(expenseRecord);
        if (line.supplier) rememberSupplierProduct(line.supplier, line.cat.code, createdAt);
      });
      if (paymentDifference > 0) {
        const category = ensurePaymentRoundingCategory();
        state.expenses.push({ id: uid("exp"), invoice, invoiceGroupId, invoiceLineNumber: detailLines.length + 1, invoiceLineCount: detailLines.length + 1, createdAt: createdAt - 1, date, code: category.code, group: category.group, pnlGroupCode: category.pnlGroupCode, description: category.name, source, amount: paymentDifference, paid: paymentDifference, payments: [{ id: uid("pay"), date, source, accountId, amount: paymentDifference, bankReference, attachment, note: `Chênh lệch thanh toán ${invoice}` }], supplier: "", operation: "Chênh lệch thanh toán", pnl: true, note: `Tự sinh do tiền thực thanh toán ${money(paid)} lớn hơn chứng từ ${money(documentAmount)}. ${String(fd.get("note") || "").trim()}`, hasInvoice: false, documentStatus: "Không hóa đơn", attachment });
      }
      persist();
      pendingExpenseAdvanceId = "";
      toast(advanceInvoiceMode ? `Đã tạo hóa đơn ${invoice} và tự cấn trừ tạm ứng ${money(Math.min(documentAmount - paid, supplierAdvancePaid(pendingAdvance, date)))}.` : (documentAmount > paid ? `Đã lưu ${detailLines.length} mã chi; còn thiếu ${money(documentAmount - paid)} sẽ theo dõi công nợ` : `Đã lưu ${detailLines.length} mã chi cùng hóa đơn ${invoice}${paymentDifference > 0 ? ` · tự ghi chênh lệch ${money(paymentDifference)}` : ""}`));
      render();
    };
    el.addEventListener("submit", handleExpenseSubmit, true);
    el.addEventListener("submit",event=>{event.preventDefault();const fd=new FormData(el);const invoice=String(fd.get("invoice")||"").trim().toUpperCase(),date=fd.get("date"),source=fd.get("source"),accountId=fd.get("accountId"),advanceInvoiceMode=Boolean(pendingAdvance),hasInvoice=fd.get("hasInvoice")==="on";const detailLines=lineNodes().map(line=>{const code=line.querySelector('[data-expense-line-code]').value,amount=num(line.querySelector('[data-expense-line-amount]').value),cat=(state.categories||[]).find(item=>item.code===code),supplier=supplierForCategory(code),pnlGroupCode=cat?.pnlGroupCode||pnlGroupCodeFromValue(cat?.group),isCapitalAsset=pnlGroupCode==="DEP";return {cat,amount,supplier,pnlGroupCode,isCapitalAsset};});const shipAmount=num(fd.get("shippingFee"));if(shipAmount>0){let cat=shippingCategory();if(!cat){const usedNumbers=(state.categories||[]).map(category=>String(category.code||"").toUpperCase().match(/^DEL-(\d+)$/)?.[1]).filter(Boolean).map(value=>Number(value));cat={code:`DEL-${String(usedNumbers.length?Math.max(...usedNumbers)+1:1).padStart(3,"0")}`,name:"Phí ship / vận chuyển",supplier:"",group:pnlGroupLabel("DEL"),pnlGroupCode:"DEL",payrollOnly:false,pnl:true,note:"Dùng cho phí giao hàng/vận chuyển phát sinh kèm phiếu chi."};state.categories.push(cat);}detailLines.push({cat,amount:shipAmount,supplier:pendingAdvance?.supplier||supplierForCategory(cat.code)||detailLines[0]?.supplier||"",pnlGroupCode:"DEL",isCapitalAsset:false,isShipping:true});}const amount=sum(detailLines,"amount");if(!invoice){toast("Vui lòng nhập mã hóa đơn");return;}if((state.expenses||[]).some(x=>String(x.invoice||"").toUpperCase()===invoice)){toast(`Mã hóa đơn ${invoice} đã tồn tại`);return;}if(!detailLines.length||detailLines.some(line=>!line.cat||line.amount<=0)){toast("Mỗi mã chi phải có số tiền lớn hơn 0");return;}if(advanceInvoiceMode&&detailLines.some(line=>normalizeCatalogText(line.supplier)!==normalizeCatalogText(pendingAdvance.supplier))){toast(`Hóa đơn từ tạm ứng ${pendingAdvance.advanceCode||pendingAdvance.id} phải chọn mã chi gắn đúng NCC ${pendingAdvance.supplier}`);return;}if(!findAccount(accountId)){toast("Vui lòng chọn tài khoản chi");return;}const paid=Math.min(amount,num(fd.get("paid")));if(paid>0&&paid>accountBalance(accountId,date)){toast(`Không thể thanh toán ${money(paid)} từ ${accountName(accountId)} vì số dư theo sổ chỉ còn ${money(accountBalance(accountId,date))}`);return;}const createdAt=Date.now(),invoiceGroupId=uid("invoice");let remainingPaid=paid;detailLines.forEach((line,index)=>{const linePaid=Math.min(line.amount,remainingPaid);remainingPaid-=linePaid;state.expenses.push({id:uid("exp"),invoice,invoiceGroupId,invoiceLineNumber:index+1,invoiceLineCount:detailLines.length,createdAt:createdAt+detailLines.length-index,date,code:line.cat.code,group:line.cat.group,pnlGroupCode:line.pnlGroupCode,description:line.cat.name,source,amount:line.amount,paid:linePaid,payments:linePaid?[{id:uid("pay"),date,source,accountId,amount:linePaid}]:[],supplier:line.supplier,operation:line.isCapitalAsset?"Đầu tư tài sản (CAPEX)":"Mua hàng / Chi phí",pnl:line.isCapitalAsset?false:line.cat.pnl,note:fd.get("note"),hasInvoice,documentStatus:hasInvoice?"Có hóa đơn":"Không hóa đơn"});});persist();pendingExpenseAdvanceId="";toast(advanceInvoiceMode?`Đã tạo hóa đơn ${invoice}. Vào Công nợ NCC để thanh toán bằng Cấn trừ tạm ứng NCC.`:(amount>paid?`Đã lưu ${detailLines.length} mã chi; công nợ được tự gắn theo NCC của mã chi`:`Đã lưu ${detailLines.length} mã chi cùng hóa đơn ${invoice}`));render();});
  }

  function openExpenseCategoryEditor(id) {
    const expense = (state.expenses || []).find(item => item.id === id);
    if (!expense || !canEditExpenseDate(expense)) { toast("Dòng này là bút toán hệ thống, không thể sửa tại đây"); return; }
    const canChangeCode = canEditExpenseCategory(expense);
    const categories = sortCategories((state.categories || []).filter(category => !category.internalOnly && !category.payrollOnly));
    if (canChangeCode && !categories.length) { toast("Chưa có mã chi để lựa chọn"); return; }
    const relatedExpenses = (state.expenses || []).filter(item => {
      if (expense.invoiceGroupId && item.invoiceGroupId === expense.invoiceGroupId) return true;
      return expense.invoice && item.invoice === expense.invoice;
    });
    const editablePayments = relatedExpenses.flatMap(item => paymentEntries(item).map(payment => ({ item, payment })));
    const firstPaymentDate = editablePayments[0]?.payment?.date || expense.date || localToday();
    const codeField = canChangeCode
      ? `<div class="field full"><label>Mã chi mới</label><select name="code">${categories.map(category => `<option value="${escapeHtml(category.code)}" ${category.code === expense.code ? "selected" : ""}>${escapeHtml(category.code)} · ${escapeHtml(category.name)}</option>`).join("")}</select><small class="form-hint">Ngày chứng từ áp dụng cho ${relatedExpenses.length} dòng cùng hóa đơn. Mã chi chỉ đổi cho dòng đang chọn.</small></div>`
      : `<div class="field full"><label>Mã chi</label><input name="code" value="${escapeHtml(expense.code || "—")}" readonly><small class="form-hint">Dòng CAPEX/tạm ứng chỉ sửa ngày; mã chi được khóa để không sai loại tài sản hoặc bút toán.</small></div>`;
    modalContent.innerHTML = `<h2>Sửa khoản chi</h2><p>Sửa ngày khi nhập sai. Số tiền, mã hóa đơn, NCC và mã giao dịch vẫn giữ nguyên.</p><form id="expense-category-edit-form"><div class="form-grid"><div class="field"><label>Ngày chứng từ / hạch toán</label><input name="date" type="date" value="${escapeHtml(expense.date || localToday())}"></div><div class="field"><label>Ngày thanh toán / cấn trừ</label><input name="paymentDate" type="date" value="${escapeHtml(firstPaymentDate)}" ${editablePayments.length ? "" : "disabled"}></div><div class="field"><label>Mã hóa đơn</label><input value="${escapeHtml(expense.invoice || "—")}" readonly></div><div class="field"><label>Nhà cung cấp</label><input value="${escapeHtml(expense.supplier || "—")}" readonly></div>${codeField}</div><div class="calc-box"><span>Giá trị dòng giữ nguyên</span><strong>${money(expense.amount)}</strong></div><div class="calc-box"><span>Đã thanh toán / còn lại</span><strong>${money(paidAmount(expense))} / ${money(expenseOutstanding(expense))}</strong></div><div class="form-actions"><button class="primary-button">Lưu thay đổi</button></div></form>`;
    openModal();
    document.querySelector("#expense-category-edit-form").addEventListener("submit", event => {
      event.preventDefault();
      const fd = new FormData(event.currentTarget);
      const code = String(fd.get("code") || "").trim().toUpperCase();
      const newDate = String(fd.get("date") || "").trim();
      const newPaymentDate = String(fd.get("paymentDate") || "").trim();
      const category = canChangeCode ? categories.find(item => item.code === code) : null;
      if (canChangeCode && !category) { toast("Mã chi không hợp lệ"); return; }
      if (!newDate) { toast("Vui lòng chọn ngày chứng từ"); return; }
      relatedExpenses.forEach(item => {
        item.date = newDate;
      });
      if (newPaymentDate && editablePayments.length) {
        editablePayments.forEach(({ payment }) => {
          payment.date = newPaymentDate;
        });
      }
      if (canChangeCode) {
        const pnlGroupCode = category.pnlGroupCode || pnlGroupCodeFromValue(category.group);
        const isCapitalAsset = pnlGroupCode === "DEP";
        Object.assign(expense, {
          code: category.code,
          group: category.group,
          pnlGroupCode,
          description: category.name,
          operation: isCapitalAsset ? "Đầu tư tài sản (CAPEX)" : expense.operation,
          pnl: isCapitalAsset ? false : category.pnl,
        });
      }
      persist(); closeModal(); toast(canChangeCode ? "Đã cập nhật ngày và mã chi; nhà cung cấp giữ nguyên theo chứng từ" : "Đã cập nhật ngày chứng từ và ngày thanh toán/cấn trừ"); render({ preserveScroll: true });
    });
  }

  function renderPayroll() {
    setHeader("Chi trả lương", "LƯƠNG GỘP · KHẤU TRỪ BỒI THƯỜNG · THỰC TRẢ");
    const accruedRows = payrolls().filter(item => inReportRange(payrollAccrualDate(item)));
    const paidRows = payrolls().filter(item => inReportRange(item.date));
    const rows = newestFirst(payrolls().filter(item => inReportRange(payrollAccrualDate(item)) || inReportRange(item.date)));
    const totalGross = sum(accruedRows, "gross");
    const totalDeductions = sum(paidRows, item => sum(item.deductions || [], "amount"));
    const totalNet = sum(paidRows, "netPaid");
    const categories = payrollCategories();
    const baseCategory = categories.find(item => item.code === "PAY-001") || null;
    const bonusCategory = categories.find(item => item.code === "PAY-002") || null;
    const payrollPeriodValue = localToday().slice(0, 7);
    const payrollDate = payrollPaymentDate(payrollPeriodValue);
    const form = `<div class="panel form-panel"><div class="panel-head"><div><h3>Lập phiếu chi trả lương</h3></div></div><form id="payroll-form"><div class="form-grid"><div class="field"><label>Ngày chi trả <small>(cố định ngày 10)</small></label><input name="date" type="date" value="${escapeHtml(payrollDate)}" readonly></div><div class="field"><label>Kỳ lương</label><input name="period" type="month" value="${escapeHtml(payrollPeriodValue)}"></div><div class="field full"><label>Nhân viên</label><select name="employeeId" id="payroll-employee">${employeeOptions()}</select></div><div class="field"><label>PAY-001 · Lương cơ bản / lương ca</label><input name="baseGross" type="number" min="0" step="1" value="0" placeholder="0"></div><div class="field"><label>PAY-002 · Thưởng / KPI / lễ Tết</label><input name="bonusGross" type="number" min="0" step="1" value="0" placeholder="0"></div><div class="field"><label>Nguồn tiền</label><select name="source" id="payroll-source">${(state.sources||[]).map(item=>`<option ${item===TRANSFER_SOURCE?"selected":""}>${escapeHtml(item)}</option>`).join("")}</select></div><div class="field"><label>Tài khoản chi</label><select name="accountId" id="payroll-account">${accountOptions(["bank"], defaultAccountId("bank"))}</select></div>${field("Mã giao dịch / chứng từ lương","bankReference","text","","Ví dụ: FT..., UNC..., PC-LUONG-001",true)}${attachmentField("File bảng lương / chứng từ chi lương")}<div class="field full"><label>Các khoản bồi thường được khấu trừ</label><div class="check-list" id="payroll-claim-list"><div class="empty">Chọn nhân viên để xem các khoản còn phải thu.</div></div></div>${field("Ghi chú","note","text","","Ví dụ: Lương tháng 07/2026",true)}</div><div class="calc-box"><span>Tổng lương gộp</span><strong id="payroll-gross-preview">0 ₫</strong></div><div class="calc-box"><span>Ngày trích chi phí P&amp;L</span><strong id="payroll-accrual-preview">—</strong></div><div class="calc-box"><span>Khấu trừ bồi thường</span><strong id="payroll-deduction-preview">0 ₫</strong></div><div class="calc-box"><span>Lương thực trả</span><strong id="payroll-net-preview">0 ₫</strong></div><p class="form-hint">PAY-001 và PAY-002 được ghi thành hai dòng P&amp;L riêng; tổng thực trả được tính từ cả hai khoản.</p><div class="form-actions"><button class="primary-button">Lưu chi trả lương</button></div></form></div>`;
    const history = table(["Trích P&L / Chi thực tế","Mã phiếu lương","Nhân viên","Lương gộp","Khấu trừ BT","Thực trả","Tài khoản chi","Trạng thái"], rows.slice(0,150).map(item => {
      const deduction = sum(item.deductions || [], "amount");
      return [`<strong>Trích: ${dateVi(payrollAccrualDate(item))}</strong><br><small>Chi: ${dateVi(item.date)}</small>`, `<strong>${escapeHtml(item.payrollCode || item.id)}</strong><br><small>Kỳ ${escapeHtml(payrollPeriod(item))}</small>`, `<strong>${escapeHtml(item.employeeCode ? `${item.employeeCode} · ${item.employee}` : item.employee || "—")}</strong>`, money(item.gross), money(deduction), money(item.netPaid), item.netPaid > 0 ? escapeHtml(accountName(item.accountId)) : "Không chi tiền", '<span class="pill green">Đã trích &amp; đã chi</span>'];
    }), [3,4,5]);
    const content = `<div class="panel"><div class="panel-head"><div><h3>Lịch sử lương</h3><p>${rows.length} phiếu liên quan ${reportRangeLabel()} · P&amp;L đọc theo ngày trích, dòng tiền đọc theo ngày chi thực tế.</p></div></div><div class="table-wrap">${history}</div></div>`;
    app.innerHTML = `<div class="kpi-grid">${kpi("Lương đã trích", money(totalGross), "Chi phí Nhân sự/P&L trong kỳ", "♧", "#880000")}${kpi("Khấu trừ bồi thường", money(totalDeductions), "Tất toán phát sinh trong ngày chi", "−", "#d3a447")}${kpi("Lương thực trả", money(totalNet), "Dòng tiền chi thực tế trong kỳ", "↘", "#e60012")}${kpi("Phiếu liên quan", fmt.format(rows.length), `Phạm vi ${reportRangeLabel()}`, "≡", "#e60012")}</div>${sectionWithForm(form, content, "compact-form-layout")}`;
    const payrollForm = document.querySelector("#payroll-form");
    const employeeInput = payrollForm.querySelector("#payroll-employee");
    const sourceInput = payrollForm.querySelector("#payroll-source");
    const accountInput = payrollForm.querySelector("#payroll-account");
    const baseInput = payrollForm.querySelector('[name="baseGross"]');
    const bonusInput = payrollForm.querySelector('[name="bonusGross"]');
    const periodInput = payrollForm.querySelector('[name="period"]');
    const dateInput = payrollForm.querySelector('[name="date"]');
    const claimsList = payrollForm.querySelector("#payroll-claim-list");
    const deductionPreview = payrollForm.querySelector("#payroll-deduction-preview");
    const netPreview = payrollForm.querySelector("#payroll-net-preview");
    const grossPreview = payrollForm.querySelector("#payroll-gross-preview");
    const accrualPreview = payrollForm.querySelector("#payroll-accrual-preview");
    const syncAccount = () => { const types = sourceInput.value === CASH_SOURCE ? ["cash"] : ["bank"]; const selected = types.includes(findAccount(accountInput.value)?.type) ? accountInput.value : defaultAccountId(types[0]); accountInput.innerHTML = accountOptions(types, selected); };
    const selectedClaimDeductions = () => [...claimsList.querySelectorAll('[data-payroll-claim]:checked')].map(input => ({ claimId: input.value, amount: num(claimsList.querySelector(`[data-payroll-amount="${input.value}"]`)?.value) }));
    const grossAmount = () => num(baseInput.value) + num(bonusInput.value);
    const updateTotals = () => { const deduction = sum(selectedClaimDeductions(), "amount"), gross = grossAmount(); grossPreview.textContent = money(gross); deductionPreview.textContent = money(deduction); netPreview.textContent = money(Math.max(0, gross - deduction)); accrualPreview.textContent = dateVi(payrollAccrualDate({ period: periodInput.value, date: dateInput.value })); };
    const renderClaims = () => { const employee = findEmployee(employeeInput.value); const claimDate = dateInput.value; if (!employee) { claimsList.innerHTML = '<div class="empty">Chọn nhân viên để xem các khoản còn phải thu.</div>'; updateTotals(); return; } const claims = employeeClaims().filter(claim => claim.employeeId === employee.id && claim.date <= claimDate && employeeClaimOutstanding(claim) > 0 && employeeClaimOutstanding(claim, claimDate) > 0); claimsList.innerHTML = claims.length ? claims.map(claim => { const due = Math.min(employeeClaimOutstanding(claim), employeeClaimOutstanding(claim, claimDate)); return `<label class="check-row"><input type="checkbox" data-payroll-claim value="${escapeHtml(claim.id)}"><span><strong>${escapeHtml(claim.claimCode || claim.id)}</strong><br><small>${escapeHtml(claim.item || "Order nhầm / làm lại món")}</small></span><input type="number" min="0" max="${due}" step="1" value="${due}" data-payroll-amount="${escapeHtml(claim.id)}" disabled><b>${money(due)}</b></label>`; }).join("") : '<div class="empty">Nhân viên này không có khoản bồi thường còn phải thu đến ngày chi lương.</div>'; claimsList.querySelectorAll('[data-payroll-claim]').forEach(input => input.addEventListener("change", () => { const amount = claimsList.querySelector(`[data-payroll-amount="${input.value}"]`); if (amount) amount.disabled = !input.checked; updateTotals(); })); claimsList.querySelectorAll('[data-payroll-amount]').forEach(input => input.addEventListener("input", updateTotals)); updateTotals(); };
    const syncScheduledPaymentDate = () => { dateInput.value = payrollPaymentDate(periodInput.value); renderClaims(); };
    sourceInput.addEventListener("change", syncAccount); employeeInput.addEventListener("change", renderClaims); baseInput.addEventListener("input", updateTotals); bonusInput.addEventListener("input", updateTotals); periodInput.addEventListener("change", syncScheduledPaymentDate); syncAccount(); syncScheduledPaymentDate();
    payrollForm.addEventListener("submit", async event => {
      event.preventDefault();
      const fd = new FormData(event.currentTarget);
      const employee = findEmployee(fd.get("employeeId"));
      const date = fd.get("date");
      const periodValue = fd.get("period") || date.slice(0, 7);
      const scheduledDate = payrollPaymentDate(periodValue);
      const allocations = [
        { category: baseCategory, amount: num(fd.get("baseGross")) },
        { category: bonusCategory, amount: num(fd.get("bonusGross")) },
      ].filter(item => item.amount > 0);
      const gross = sum(allocations, "amount");
      const deductions = selectedClaimDeductions();
      const deductionTotal = sum(deductions, "amount");
      const netPaid = gross - deductionTotal;
      if (!employee || !date) { toast("Vui lòng chọn nhân viên và kỳ lương"); return; }
      if (!baseCategory || !bonusCategory) { toast("Chưa có đủ mã PAY-001 và PAY-002 trong Danh mục"); return; }
      if (date !== scheduledDate) { toast(`Ngày chi lương được cố định là ${dateVi(scheduledDate)}`); return; }
      if (gross <= 0) { toast("Nhập lương cơ bản hoặc thưởng/KPI lớn hơn 0"); return; }
      if (deductionTotal > gross) { toast("Tổng khấu trừ không thể lớn hơn tổng lương gộp"); return; }
      const validated = [];
      for (const selected of deductions) {
        const claim = employeeClaims().find(item => item.id === selected.claimId && item.employeeId === employee.id);
        const due = Math.min(employeeClaimOutstanding(claim), employeeClaimOutstanding(claim, date));
        if (!claim || selected.amount <= 0 || selected.amount > due) { toast("Khoản khấu trừ vượt số phải thu hoặc không còn hiệu lực"); return; }
        validated.push({ claim, amount: selected.amount });
      }
      const source = fd.get("source"), accountId = fd.get("accountId"), bankReference = String(fd.get("bankReference") || "").trim();
      if (netPaid > 0) {
        if (!findAccount(accountId)) { toast("Vui lòng chọn tài khoản chi lương"); return; }
        if (source === TRANSFER_SOURCE && !bankReference) { toast("Vui lòng nhập mã giao dịch ngân hàng/chứng từ chi lương"); return; }
        const balance = accountBalance(accountId, date);
        if (balance <= 0 || netPaid > balance) { toast(`Không thể chi ${money(netPaid)} từ ${accountName(accountId)} vì số dư theo sổ chỉ còn ${money(balance)}`); return; }
      }
      let attachment = null;
      try { attachment = await readAttachment(fd, "attachment", false); } catch (error) { toast(error.message); return; }
      const accrualDate = payrollAccrualDate({ period: periodValue, date });
      const paymentBatchId = uid("payroll-batch");
      const deductionQueue = validated.map(item => ({ ...item, remaining: item.amount }));
      const takeDeductions = (capacity) => {
        const lineDeductions = [];
        let remainingCapacity = capacity;
        for (const item of deductionQueue) {
          if (remainingCapacity <= 0 || item.remaining <= 0) continue;
          const amount = Math.min(remainingCapacity, item.remaining);
          item.remaining -= amount;
          remainingCapacity -= amount;
          lineDeductions.push({ id: uid("payroll-deduction"), claimId: item.claim.id, claimCode: item.claim.claimCode || item.claim.id, amount });
        }
        return lineDeductions;
      };
      const createdPayrolls = allocations.map((allocation, index) => {
        const lineDeductions = takeDeductions(allocation.amount);
        const deduction = sum(lineDeductions, "amount");
        const lineNetPaid = allocation.amount - deduction;
        const payroll = {
          id: uid("payroll"), createdAt: Date.now() + index, payrollCode: nextPayrollCode(periodValue, employee.code), period: periodValue, accrualDate, date,
          employeeId: employee.id, employeeCode: employee.code, employee: employee.name, categoryCode: allocation.category.code, gross: allocation.amount,
          deductions: lineDeductions,
          netPaid: lineNetPaid, source, accountId: lineNetPaid > 0 ? accountId : "", bankReference, attachment, paymentBatchId, note: String(fd.get("note") || "").trim(),
        };
        state.payrolls.push(payroll);
        state.expenses.push({
          id: uid("exp"), invoice: payroll.payrollCode, invoiceGroupId: paymentBatchId, invoiceLineNumber: index + 1, invoiceLineCount: allocations.length, createdAt: Date.now() + index,
          date: accrualDate, code: allocation.category.code, group: allocation.category.group, pnlGroupCode: allocation.category.pnlGroupCode || pnlGroupCodeFromValue(allocation.category.group),
          description: `${allocation.category.name} ${periodValue} · ${employeeLabel(employee)}`, source, amount: allocation.amount, paid: lineNetPaid,
          payments: lineNetPaid > 0 ? [{ id: uid("pay"), date, source, accountId, amount: lineNetPaid, bankReference, attachment, paymentBatchId }] : [], supplier: "", operation: "Trích trước lương",
          payrollId: payroll.id, payrollAccrualDate: accrualDate, payrollDeduction: deduction, pnl: true, note: payroll.note, attachment,
        });
        return payroll;
      });
      validated.forEach(item => item.claim.recoveries.push({
        id: uid("employee-recovery"), createdAt: Date.now(), date, amount: item.amount, method: "payroll", payrollId: createdPayrolls[0].id,
        reference: createdPayrolls.map(item => item.payrollCode).join(" / "), note: `Khấu trừ tại phiếu lương ${periodValue}`,
      }));
      persist();
      toast(`Đã trích P&L ${dateVi(accrualDate)} · thực trả ${money(netPaid)} ngày ${dateVi(date)}`);
      render();
    });
  }

  function statusPill(x) { if(x.operation === "Trích khấu hao")return '<span class="pill green">Đã trích khấu hao</span>'; if(x.payrollId)return `<span class="pill green">Đã trích P&amp;L${paidByDate(x,reportEnd())>0 ? " · đã chi" : " · chờ chi"}${x.payrollDeduction ? " · đã khấu trừ" : ""}</span>`; const paid=paidByDate(x,reportEnd()),debt=expenseOutstandingAsOf(x,reportEnd()); if(debt<=0)return '<span class="pill green">Đã thanh toán</span>'; if(paid>0)return '<span class="pill orange">Một phần</span>'; return '<span class="pill red">Công nợ</span>'; }

  function renderDebts() {
    setHeader("Công nợ nhà cung cấp", "THEO DÕI PHẢI TRẢ");
    // AP chỉ nhận các hóa đơn đã gắn nhà cung cấp. Khoản chi không có NCC vẫn
    // được ghi P&L/dòng tiền, nhưng không được xem là công nợ phải trả theo NCC.
    const asOfDate=reportEnd();
    const dueAsOf=(expense)=>expenseOutstandingAsOf(expense,asOfDate);
    const periodExpenses=(state.expenses||[]).filter(x=>inReportRange(x.date)&&isSupplierPayable(x));
    const allDebts=newestFirst(periodExpenses.filter(x=>dueAsOf(x)>0));
    const suppliers=[...new Set(periodExpenses.map(x=>x.supplier).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"vi"));
    if(debtSupplierFilter&&!suppliers.includes(debtSupplierFilter))debtSupplierFilter="";
    const debts=debtSupplierFilter?allDebts.filter(x=>x.supplier===debtSupplierFilter):allDebts;
    const scopedExpenses=debtSupplierFilter?periodExpenses.filter(x=>x.supplier===debtSupplierFilter):periodExpenses;
    const settledDate = (expense) => paymentEntries(expense).map(item=>item.date).filter(Boolean).sort().at(-1)||expense.date;
    const settledInvoices=newestFirst(scopedExpenses.filter(x=>num(x.amount)>0&&dueAsOf(x)<=0), settledDate);
    const bySupplier=new Map();debts.forEach(x=>bySupplier.set(x.supplier,(bySupplier.get(x.supplier)||0)+dueAsOf(x)));
    const supplierTotals = new Map();
    periodExpenses.forEach(expense => {
      const name = String(expense.supplier || "Chưa xác định").trim() || "Chưa xác định";
      const total = supplierTotals.get(name) || { name, invoices: 0, amount: 0, pnl: 0, paid: 0, debt: 0 };
      const amount = num(expense.amount), paid = paidByDate(expense, asOfDate);
      total.invoices += 1;
      total.amount += amount;
      total.pnl += expense.pnl ? amount : 0;
      total.paid += paid;
      total.debt += dueAsOf(expense);
      supplierTotals.set(name, total);
    });
    const supplierSpendRows = [...supplierTotals.values()]
      .sort((a,b) => b.pnl - a.pnl || b.amount - a.amount || a.name.localeCompare(b.name, "vi"))
      .map(item => [
        `<strong>${escapeHtml(item.name)}</strong>`, fmt.format(item.invoices), money(item.amount), money(item.pnl), money(item.paid), money(item.debt),
        `<button class="small-button" data-supplier-focus="${escapeHtml(item.name)}">Xem chi tiết</button>`,
      ]);
    const filter=`<div class="supplier-filter"><label>Nhà cung cấp</label><select id="debt-supplier-filter"><option value="">Tất cả nhà cung cấp</option>${suppliers.map(x=>`<option value="${escapeHtml(x)}" ${x===debtSupplierFilter?'selected':''}>${escapeHtml(x)}</option>`).join("")}</select></div>`;
    const settledRows=settledInvoices.slice(0,150).map(item=>{const payments=paymentEntries(item).filter(payment=>payment.date<=asOfDate),lastDate=payments.map(payment=>payment.date).filter(Boolean).sort().at(-1)||item.date;return [dateVi(item.date),`<strong>${escapeHtml(item.invoice)}</strong>`,escapeHtml(item.supplier),escapeHtml(item.description),money(item.amount),money(paidByDate(item,asOfDate)),dateVi(lastDate),'<span class="pill green">Đã tất toán</span>'];});
    const periodLabel=reportRangeLabel();
    const supplierSpendPanel = `<div class="panel"><div class="panel-head"><div><h3>Tổng hợp chi theo nhà cung cấp</h3><p>${periodLabel} · Tổng hóa đơn là chi phí ghi nhận để tính P&L; đã trả và công nợ dùng để kiểm soát dòng tiền.</p></div></div><div class="table-wrap">${supplierSpendRows.length ? table(["Nhà cung cấp","Số hóa đơn","Tổng hóa đơn","Chi phí P&L","Đã thanh toán","Còn nợ","Thao tác"],supplierSpendRows,[2,3,4,5]) : '<div class="empty">Chưa có hóa đơn nhà cung cấp trong phạm vi đang chọn.</div>'}</div></div>`;
    app.innerHTML=`<div class="kpi-grid">${kpi("Tổng công nợ",money(sum(debts,dueAsOf)),`${debts.length} hóa đơn còn mở tại ngày chốt ${dateVi(asOfDate)}`,"◫","#e60012")}${kpi("Nhà cung cấp",fmt.format(bySupplier.size),debtSupplierFilter?`Đang lọc: <strong>${escapeHtml(debtSupplierFilter)}</strong>`:`Phát sinh trong ${periodLabel}`,"♙","#d3a447")}${kpi("Đã thanh toán",money(sum(scopedExpenses,x=>paidByDate(x,asOfDate))),`Theo trạng thái tại ${dateVi(asOfDate)}`,"✓","#e60012")}${kpi("Hóa đơn lớn nhất",money(Math.max(0,...debts.map(dueAsOf))),"Ưu tiên kiểm tra","!","#e60012")}</div><div class="panel"><div class="panel-head"><div><h3>Hóa đơn chưa tất toán</h3><p>Chỉ hiển thị hóa đơn phát sinh trong ${periodLabel}; số đã trả và còn nợ được chốt tại ${dateVi(asOfDate)}.</p></div>${filter}</div><div class="debt-list">${debts.length?debts.slice(0,150).map(x=>debtCard(x,asOfDate)).join(""):'<div class="empty">Không còn công nợ nhà cung cấp theo bộ lọc này trong kỳ báo cáo.</div>'}</div></div><div class="panel"><div class="panel-head"><div><h3>Hóa đơn đã tất toán</h3><p>${settledInvoices.length} hóa đơn phát sinh trong ${periodLabel} đã thanh toán đủ tại ngày chốt</p></div></div><div class="table-wrap">${settledRows.length?table(["Ngày hóa đơn","Mã hóa đơn","Nhà cung cấp","Diễn giải","Giá trị","Đã thanh toán","Ngày tất toán","Trạng thái"],settledRows,[4,5]):'<div class="empty">Chưa có hóa đơn đã tất toán theo bộ lọc này trong kỳ báo cáo.</div>'}</div></div>`;
    document.querySelectorAll("[data-pay]").forEach(button=>button.addEventListener("click",()=>openPayment(button.dataset.pay)));
    document.querySelector("#debt-supplier-filter").addEventListener("change",event=>{debtSupplierFilter=event.target.value;render();});
  }

  function renderSupplierAdvances() {
    setHeader("Tạm ứng nhà cung cấp", "ĐẶT CỌC · ỨNG TRƯỚC · CẤN TRỪ HÓA ĐƠN");
    const rows = newestFirst(supplierAdvances().filter(item => (item.payments || []).some(payment => inReportRange(payment.date)) || supplierAdvanceAvailable(item, reportEnd()) > 0), item => (item.payments || []).map(payment => payment.date).filter(Boolean).sort().at(-1) || "");
    const paidInPeriod = sum(supplierAdvances().flatMap(item => (item.payments || []).filter(payment => inReportRange(payment.date))), "amount");
    const appliedInPeriod = sum(paymentLog().filter(payment => payment.type === "advance-settlement" && inReportRange(payment.date)), "amount");
    const openBalance = sum(supplierAdvances(), item => supplierAdvanceAvailable(item, reportEnd()));
    const sourceOptions = (state.sources || []).map(item => `<option ${item === TRANSFER_SOURCE ? "selected" : ""}>${escapeHtml(item)}</option>`).join("");
    const supplierOptions = supplierNames().map(name => `<option value="${escapeHtml(name)}"></option>`).join("");
    const form = `<div class="panel form-panel"><div class="panel-head"><div><h3>Tạo hồ sơ tạm ứng NCC</h3></div></div><form id="supplier-advance-form"><div class="form-grid"><div class="field"><label>Ngày chuyển</label><input name="date" type="date" value="${escapeHtml(localToday())}" required></div><div class="field"><label>Mã hồ sơ</label><input name="advanceCode" type="text" value="${escapeHtml(nextSupplierAdvanceCode(localToday()))}" readonly></div><div class="field full"><label>Nhà cung cấp</label><input name="supplier" type="text" list="advance-supplier-list" placeholder="Chọn hoặc nhập NCC" required><datalist id="advance-supplier-list">${supplierOptions}</datalist></div><div class="field full"><label>Nội dung đơn hàng / hợp đồng</label><input name="orderName" type="text" placeholder="Ví dụ: Cọc nguyên liệu tháng 7" required></div>${field("Tổng giá trị dự kiến","expectedAmount","number","","0")}<div class="field"><label>Số tiền cọc lần này</label><input name="amount" type="number" min="0" step="1" placeholder="0" required></div><div class="field"><label>Nguồn tiền</label><select name="source" id="advance-source">${sourceOptions}</select></div><div class="field"><label>Tài khoản chi</label><select name="accountId" id="advance-account">${accountOptions(["bank"], defaultAccountId("bank"))}</select></div><div class="field full"><label>Mã giao dịch ngân hàng</label><input name="bankReference" type="text" placeholder="Ví dụ: FT45435345/BK"></div>${attachmentField("File chứng từ cọc / chuyển khoản")}${field("Ghi chú","note","text","","",true)}</div><div class="calc-box"><span>Số tiền cọc đã nhập</span><strong id="advance-amount-preview">0 ₫</strong></div><div class="form-actions"><button class="primary-button">Lưu hồ sơ tạm ứng</button></div></form></div>`;
    const paymentRows = rows.flatMap(advance => {
      const paidTotal = supplierAdvancePaid(advance, reportEnd());
      const appliedTotal = supplierAdvanceApplied(advance, reportEnd());
      const expectedAmount = num(advance.expectedAmount);
      const contractRemaining = expectedAmount > 0 ? Math.max(0, expectedAmount - paidTotal) : 0;
      const fullyApplied = paidTotal > 0 && appliedTotal >= paidTotal;
      const canCreateInvoice = !fullyApplied && expectedAmount > 0 && paidTotal >= expectedAmount;
      const contractStatus = fullyApplied
        ? '<span class="pill green">Đã tạo HĐ</span>'
        : expectedAmount > 0
        ? (paidTotal >= expectedAmount ? '<span class="pill green">Đã cọc đủ</span>' : `<span class="pill orange">Còn ${money(contractRemaining)}</span>`)
        : '<span class="pill gray">Chưa nhập HĐ</span>';
      return (advance.payments || []).map(payment => [
        dateVi(payment.date),
        `<strong>${escapeHtml(advance.advanceCode || advance.id)}</strong>`,
        escapeHtml(advance.supplier || "Chưa xác định"),
        escapeHtml(advance.orderName || "Tạm ứng NCC"),
        money(paidTotal),
        money(payment.amount),
        contractStatus,
        escapeHtml(accountName(payment.accountId)),
        escapeHtml(payment.bankReference || "—"),
        money(appliedTotal),
        `<div class="advance-actions"><button class="small-button advance-main-action ${canCreateInvoice ? "success-button" : ""}" ${fullyApplied ? "disabled" : ""} data-advance-invoice="${escapeHtml(advance.id)}" title="${fullyApplied ? "Hồ sơ đã được cấn trừ vào hóa đơn chi phí" : canCreateInvoice ? "Đã cọc đủ, có thể tạo hóa đơn chi phí" : "Có thể tạo hóa đơn khi hàng về; nếu muốn báo đủ cọc, nhập tổng giá trị hợp đồng/dự kiến"}">${fullyApplied ? "Đã tạo HĐ" : "Tạo HĐ chi phí"}</button><div class="advance-sub-actions"><button class="small-button" data-advance-payment-edit="${escapeHtml(advance.id)}|${escapeHtml(payment.id)}">Sửa</button><button class="small-button" data-advance-pay="${escapeHtml(advance.id)}">Thêm lần cọc</button></div></div>`,
      ]);
    });
    const list = `<div class="panel"><div class="panel-head"><div><h3>Hồ sơ tạm ứng NCC</h3><p>${rows.length} hồ sơ liên quan kỳ đang chọn. Khi hàng/hóa đơn về, bấm <strong>Tạo HĐ chi phí</strong>, nhập đúng mã chi rồi thanh toán bằng <strong>Cấn trừ tạm ứng NCC</strong>.</p></div></div><div class="table-wrap">${paymentRows.length ? table(["Ngày chuyển","Mã hồ sơ","Nhà cung cấp","Nội dung","Đã cọc tổng","Cọc lần này","Tiến độ cọc","Tài khoản chi","Mã giao dịch","Đã cấn trừ","Thao tác"], paymentRows, [4,5,9]) : '<div class="empty">Chưa có hồ sơ tạm ứng nhà cung cấp.</div>'}</div></div>`;
    app.innerHTML = `<div class="kpi-grid">${kpi("Tạm ứng còn mở", money(openBalance), "Số tiền đã chuyển nhưng chưa cấn trừ hóa đơn", "⇥", "#d3a447")}${kpi("Cọc trong kỳ", money(paidInPeriod), "Dòng tiền ra trước hóa đơn", "↘", "#e60012")}${kpi("Đã cấn trừ trong kỳ", money(appliedInPeriod), "Tất toán vào hóa đơn NCC", "✓", "#e60012")}${kpi("Hồ sơ theo dõi", fmt.format(rows.length), reportRangeLabel(), "≡", "#880000")}</div><div class="section-grid supplier-advance-layout">${form}${list}</div>`;
    const advanceForm = document.querySelector("#supplier-advance-form");
    const dateInput = advanceForm.querySelector('[name="date"]');
    const codeInput = advanceForm.querySelector('[name="advanceCode"]');
    const sourceInput = advanceForm.querySelector("#advance-source");
    const accountInput = advanceForm.querySelector("#advance-account");
    const syncAccount = () => { const types = sourceInput.value === CASH_SOURCE ? ["cash"] : ["bank"]; const preferred = types.includes(findAccount(accountInput.value)?.type) ? accountInput.value : defaultAccountId(types[0]); accountInput.innerHTML = accountOptions(types, preferred); };
    dateInput.addEventListener("change", () => { codeInput.value = nextSupplierAdvanceCode(dateInput.value); });
    sourceInput.addEventListener("change", syncAccount);
    syncAccount();
    bindAmountPreview(advanceForm, "amount", "advance-amount-preview");
    advanceForm.addEventListener("submit", async event => {
      event.preventDefault();
      const fd = new FormData(event.currentTarget);
      const date = fd.get("date"), supplier = String(fd.get("supplier") || "").trim(), amount = num(fd.get("amount")), accountId = fd.get("accountId"), bankReference = String(fd.get("bankReference") || "").trim();
      if (!supplier) { toast("Vui lòng chọn hoặc nhập nhà cung cấp"); return; }
      if (amount <= 0) { toast("Số tiền tạm ứng phải lớn hơn 0"); return; }
      if (!findAccount(accountId)) { toast("Vui lòng chọn tài khoản chi"); return; }
      if (fd.get("source") === TRANSFER_SOURCE && !bankReference) { toast("Vui lòng nhập mã giao dịch ngân hàng cho khoản tạm ứng"); return; }
      const balance = accountBalance(accountId, date);
      if (amount > balance) { toast(`Không thể tạm ứng ${money(amount)} từ ${accountName(accountId)} ngày ${dateVi(date)} vì số dư tại ngày này chỉ còn ${money(balance)}. Số dư ngày chốt ${dateVi(reportEnd())} là ${money(accountBalance(accountId, reportEnd()))}; kiểm tra lại ngày chuyển hoặc ngày góp vốn.`); return; }
      let attachment = null;
      try { attachment = await readAttachment(fd, "attachment", false); } catch (error) { toast(error.message); return; }
      const existingSupplier = supplierNames().find(name => normalizeCatalogText(name) === normalizeCatalogText(supplier));
      const cleanSupplier = existingSupplier || supplier;
      if (!existingSupplier) state.suppliers.push(cleanSupplier);
      const advanceCode = nextSupplierAdvanceCode(date);
      const advance = {
        id: uid("advance"), advanceCode, supplier: cleanSupplier,
        orderName: String(fd.get("orderName") || "").trim(), expectedAmount: num(fd.get("expectedAmount")), note: String(fd.get("note") || "").trim(), createdAt: Date.now(),
        payments: [{ id: uid("advance-pay"), createdAt: Date.now(), date, amount, source: fd.get("source"), accountId, bankReference, attachment, note: String(fd.get("note") || "").trim() }],
      };
      state.supplierAdvances.push(advance);
      persist(); toast(`Đã tạo hồ sơ ${advance.advanceCode} cho ${cleanSupplier}`); render();
    });
    document.querySelectorAll("[data-advance-pay]").forEach(button => button.addEventListener("click", () => openSupplierAdvancePayment(button.dataset.advancePay)));
    document.querySelectorAll("[data-advance-invoice]").forEach(button => button.addEventListener("click", () => {
      const advance = findSupplierAdvance(button.dataset.advanceInvoice);
      pendingExpenseAdvanceId = advance?.id || "";
      view = "expenses";
      toast(`Đã chuyển sang tạo hóa đơn cho ${advance?.supplier || "NCC"}; chọn mã chi rồi lưu hóa đơn.`);
      render();
    }));
    document.querySelectorAll("[data-advance-payment-edit]").forEach(button => button.addEventListener("click", () => {
      const [advanceId, paymentId] = String(button.dataset.advancePaymentEdit || "").split("|");
      openSupplierAdvancePayment(advanceId, paymentId);
    }));
  }

  function openSupplierAdvancePayment(id, paymentId = "") {
    const advance = findSupplierAdvance(id);
    if (!advance) { toast("Không tìm thấy hồ sơ tạm ứng"); return; }
    const payment = paymentId ? (advance.payments || []).find(item => item.id === paymentId) : null;
    const isEdit = Boolean(payment);
    const selectedSource = payment?.source || TRANSFER_SOURCE;
    const paidBeforeThisPayment = supplierAdvancePaid(advance) - (isEdit ? num(payment.amount) : 0);
    const appliedTotal = supplierAdvanceApplied(advance);
    modalContent.innerHTML = `<h2>${isEdit ? "Sửa lần cọc NCC" : "Thêm lần cọc NCC"}</h2><p>${escapeHtml(advance.advanceCode || advance.id)} · ${escapeHtml(advance.supplier || "")} · ${escapeHtml(advance.orderName || "")}</p><form id="advance-payment-form"><div class="form-grid">${field("Tổng giá trị hợp đồng / dự kiến","expectedAmount","number",advance.expectedAmount || "","0")}${field("Đã cọc trước lần này","paidBefore","text",money(paidBeforeThisPayment),"",false)}${field("Ngày chuyển","date","date",payment?.date || localToday())}${field("Số tiền cọc lần này","amount","number",payment?.amount || "","0")}<div class="field"><label>Nguồn tiền</label><select name="source" id="advance-payment-source">${(state.sources || []).map(item => `<option ${item === selectedSource ? "selected" : ""}>${escapeHtml(item)}</option>`).join("")}</select></div><div class="field"><label>Tài khoản chi</label><select name="accountId" id="advance-payment-account">${accountOptions([selectedSource === CASH_SOURCE ? "cash" : "bank"], payment?.accountId || defaultAccountId(selectedSource === CASH_SOURCE ? "cash" : "bank"))}</select></div><div class="field full"><label>Mã giao dịch ngân hàng</label><input name="bankReference" type="text" value="${escapeHtml(payment?.bankReference || "")}" placeholder="Ví dụ: FT45435345/BK"></div>${attachmentField(isEdit && payment?.attachment ? "File chứng từ mới (bỏ trống để giữ file cũ)" : "File chứng từ cọc / chuyển khoản")}${field("Ghi chú","note","text",payment?.note || "","",true)}</div><div class="calc-box"><span>${isEdit ? "Tổng đã cọc sau sửa" : "Tổng đã cọc sau lần này"}</span><strong id="advance-payment-total-preview">0 ₫</strong></div><div class="calc-box"><span>Còn cần cọc theo hợp đồng</span><strong id="advance-contract-remaining-preview">Chưa nhập giá trị HĐ</strong></div><div class="calc-box"><span>Đã cấn trừ vào hóa đơn</span><strong>${money(appliedTotal)}</strong></div><div class="form-actions"><button class="primary-button">${isEdit ? "Lưu chỉnh sửa" : "Lưu lần cọc"}</button></div></form>`;
    openModal();
    const form = document.querySelector("#advance-payment-form"), sourceInput = form.querySelector("#advance-payment-source"), accountInput = form.querySelector("#advance-payment-account");
    const syncAccount = () => { const types = sourceInput.value === CASH_SOURCE ? ["cash"] : ["bank"]; const preferred = types.includes(findAccount(accountInput.value)?.type) ? accountInput.value : defaultAccountId(types[0]); accountInput.innerHTML = accountOptions(types, preferred); };
    const updateContractPreview = () => {
      const amount = num(form.querySelector('[name="amount"]')?.value);
      const expectedAmount = num(form.querySelector('[name="expectedAmount"]')?.value);
      const totalAfter = paidBeforeThisPayment + amount;
      const totalPreview = form.querySelector("#advance-payment-total-preview");
      const remainingPreview = form.querySelector("#advance-contract-remaining-preview");
      if (totalPreview) totalPreview.textContent = money(totalAfter);
      if (!remainingPreview) return;
      if (expectedAmount <= 0) {
        remainingPreview.textContent = "Chưa nhập giá trị HĐ";
        remainingPreview.classList.remove("negative");
        return;
      }
      const remaining = expectedAmount - totalAfter;
      remainingPreview.textContent = remaining > 0 ? money(remaining) : (remaining === 0 ? "Đã cọc đủ" : `Vượt ${money(Math.abs(remaining))}`);
      remainingPreview.classList.toggle("negative", remaining < 0);
    };
    sourceInput.addEventListener("change", syncAccount);
    syncAccount();
    form.querySelector('[name="amount"]')?.addEventListener("input", updateContractPreview);
    form.querySelector('[name="expectedAmount"]')?.addEventListener("input", updateContractPreview);
    updateContractPreview();
    form.addEventListener("submit", async event => {
      event.preventDefault();
      const fd = new FormData(event.currentTarget), date = fd.get("date"), amount = num(fd.get("amount")), accountId = fd.get("accountId"), expectedAmount = num(fd.get("expectedAmount")), bankReference = String(fd.get("bankReference") || "").trim();
      if (amount <= 0) { toast("Số tiền tạm ứng phải lớn hơn 0"); return; }
      if (!findAccount(accountId)) { toast("Vui lòng chọn tài khoản chi"); return; }
      if (fd.get("source") === TRANSFER_SOURCE && !bankReference) { toast("Vui lòng nhập mã giao dịch ngân hàng cho lần cọc"); return; }
      const totalAfterPayment = paidBeforeThisPayment + amount;
      if (totalAfterPayment < appliedTotal) { toast(`Không thể sửa còn ${money(totalAfterPayment)} vì hồ sơ đã cấn trừ ${money(appliedTotal)} vào hóa đơn`); return; }
      if (expectedAmount > 0 && totalAfterPayment > expectedAmount) { toast(`Tổng đã cọc ${money(totalAfterPayment)} đang vượt giá trị hợp đồng ${money(expectedAmount)}. Nếu nhà cung cấp đổi giá, hãy sửa lại tổng giá trị hợp đồng/dự kiến trước khi lưu.`); return; }
      const currentPaymentEffect = isEdit && payment.accountId === accountId && payment.date <= date ? num(payment.amount) : 0;
      const availableBalance = accountBalance(accountId, date) + currentPaymentEffect;
      if (amount > availableBalance) { toast(`Không thể ${isEdit ? "sửa" : "tạm ứng"} ${money(amount)} từ ${accountName(accountId)} ngày ${dateVi(date)} vì số dư tại ngày này chỉ còn ${money(availableBalance)}. Số dư ngày chốt ${dateVi(reportEnd())} là ${money(accountBalance(accountId, reportEnd()))}; kiểm tra lại ngày chuyển hoặc ngày góp vốn.`); return; }
      let attachment = null;
      try { attachment = await readAttachment(fd, "attachment", false); } catch (error) { toast(error.message); return; }
      advance.expectedAmount = expectedAmount;
      advance.updatedAt = Date.now();
      const saved = { date, amount, source: fd.get("source"), accountId, bankReference, attachment: attachment || payment?.attachment || null, note: String(fd.get("note") || "").trim() };
      if (isEdit) Object.assign(payment, saved, { updatedAt: Date.now() });
      else advance.payments.push({ id: uid("advance-pay"), createdAt: Date.now(), ...saved });
      persist(); closeModal(); toast(isEdit ? `Đã sửa lần cọc của ${advance.advanceCode || advance.id}` : `Đã thêm lần cọc vào ${advance.advanceCode || advance.id}`); render();
    });
  }

  function debtCard(x,asOfDate=""){const paid=asOfDate?paidByDate(x,asOfDate):paidAmount(x),due=asOfDate?expenseOutstandingAsOf(x,asOfDate):expenseOutstanding(x),canPay=expenseOutstanding(x)>0;return `<div class="debt-card"><div><h4>${escapeHtml(x.supplier)}</h4><p>${escapeHtml(x.invoice)} · ${dateVi(x.date)} · ${escapeHtml(x.description)}</p><p>Giá trị ${money(x.amount)} · Đã trả ${money(paid)}</p></div><div class="debt-amount"><strong>${money(due)}</strong>${canPay?`<button class="primary-button" data-pay="${x.id}">Thanh toán</button>`:'<span class="pill green">Đã trả sau kỳ</span>'}</div></div>`;}
  function openPayment(id){
    const item=state.expenses.find(x=>x.id===id);const due=Math.max(0,item.amount-paidAmount(item));
    const advanceChoices = supplierAdvanceOptions(item.supplier, localToday(), "");
    const advanceSection = advanceChoices ? `<div class="field full"><label>Cấn trừ tạm ứng NCC</label><select name="advanceId" id="payment-advance"><option value="">-- Không cấn trừ --</option>${advanceChoices}</select><small class="form-hint">Dùng tiền đã cọc trước cho cùng nhà cung cấp; thao tác này không tạo thêm dòng tiền ra.</small></div>${field("Số tiền cấn trừ tạm ứng","advanceAmount","number","","0")}` : "";
    modalContent.innerHTML=`<h2>Thanh toán công nợ</h2><p>${escapeHtml(item.supplier)} · ${escapeHtml(item.invoice)}</p><form id="payment-form"><div class="form-grid">${field("Ngày thanh toán","date","date",localToday())}${field("Số tiền trả thêm","amount","number",due,"0")}<div class="field"><label>Nguồn tiền</label><select name="source" id="payment-source">${state.sources.map(x=>`<option>${escapeHtml(x)}</option>`).join("")}</select></div><div class="field"><label>Tài khoản chi</label><select name="accountId" id="payment-account">${accountOptions(["cash"],defaultAccountId("cash"))}</select></div>${field("Mã giao dịch ngân hàng","bankReference","text","","Ví dụ: FT45435345/BK",true)}${attachmentField("File chứng từ thanh toán / cấn trừ")}${advanceSection}</div><div class="calc-box"><span>Số tiền trả thêm đã nhập</span><strong id="payment-amount-preview">0 ₫</strong></div><div class="calc-box"><span>Còn phải trả sau lần này</span><strong id="payment-due-preview">${money(due)}</strong></div><div class="form-actions"><button class="primary-button">Xác nhận thanh toán</button></div></form>`;
    openModal();
    const form=document.querySelector("#payment-form"),sourceInput=form.querySelector("#payment-source"),accountInput=form.querySelector("#payment-account");
    const syncAccount=()=>{const types=sourceInput.value===CASH_SOURCE?["cash"]:["bank"];const preferred=types.includes(findAccount(accountInput.value)?.type)?accountInput.value:defaultAccountId(types[0]);accountInput.innerHTML=accountOptions(types,preferred);};
    const updateDuePreview=()=>{const cashAmount=num(form.querySelector('[name="amount"]')?.value),advanceAmount=num(form.querySelector('[name="advanceAmount"]')?.value);const remaining=Math.max(0,due-cashAmount-advanceAmount);const preview=form.querySelector("#payment-due-preview");if(preview)preview.textContent=money(remaining);};
    sourceInput.addEventListener("change",syncAccount);syncAccount();bindAmountPreview(form,"amount","payment-amount-preview");form.querySelector('[name="amount"]')?.addEventListener("input",updateDuePreview);form.querySelector('[name="advanceAmount"]')?.addEventListener("input",updateDuePreview);updateDuePreview();
    form.addEventListener("submit",async event=>{event.preventDefault();const fd=new FormData(event.currentTarget);const cashAmount=num(fd.get("amount")),advanceAmount=num(fd.get("advanceAmount")),advanceId=fd.get("advanceId"),accountId=fd.get("accountId"),paymentDate=fd.get("date"),bankReference=String(fd.get("bankReference")||"").trim();if(cashAmount<=0&&advanceAmount<=0){toast("Nhập số tiền trả thêm hoặc số tiền cấn trừ tạm ứng");return;}if(cashAmount+advanceAmount>due){toast(`Tổng thanh toán không thể vượt số còn nợ ${money(due)}`);return;}if(cashAmount>0){if(!findAccount(accountId)){toast("Vui lòng chọn tài khoản chi");return;}if(fd.get("source")===TRANSFER_SOURCE&&!bankReference){toast("Vui lòng nhập mã giao dịch ngân hàng cho khoản thanh toán công nợ");return;}const balance=accountBalance(accountId,paymentDate);if(cashAmount>balance){toast(`Không thể thanh toán ${money(cashAmount)} từ ${accountName(accountId)} vì số dư theo sổ chỉ còn ${money(balance)}`);return;}}let advance=null;if(advanceAmount>0){advance=findSupplierAdvance(advanceId);if(!advance||normalizeCatalogText(advance.supplier)!==normalizeCatalogText(item.supplier)){toast("Vui lòng chọn hồ sơ tạm ứng đúng nhà cung cấp");return;}const available=supplierAdvanceAvailable(advance,paymentDate);if(advanceAmount>available){toast(`Hồ sơ ${advance.advanceCode||advance.id} chỉ còn ${money(available)} có thể cấn trừ`);return;}}let attachment=null;try{attachment=await readAttachment(fd,"attachment",false);}catch(error){toast(error.message);return;}if(!Array.isArray(item.payments))item.payments=paymentEntries(item).map(payment=>({...payment}));if(cashAmount>0)item.payments.push({id:uid("pay"),date:paymentDate,source:fd.get("source"),accountId,amount:cashAmount,bankReference,attachment});if(advanceAmount>0)item.payments.push({id:uid("pay"),date:paymentDate,source:ADVANCE_SETTLEMENT_SOURCE,accountId:"",amount:advanceAmount,type:"advance-settlement",advanceId,advanceCode:advance.advanceCode||advance.id,attachment});item.paid=paidAmount(item);item.attachment=item.attachment||attachment;persist();closeModal();toast("Đã cập nhật công nợ, sổ quỹ và tạm ứng NCC");render();});
  }

  function renderEmployeeClaims() {
    setHeader("Bồi thường nhân viên", "ORDER NHẦM · LÀM LẠI MÓN · PHẢI THU NỘI BỘ");
    const asOfDate = reportEnd();
    const eligibleClaims = employeeClaims().filter(item => item.date && item.date <= asOfDate);
    const recoveriesInPeriod = eligibleClaims.flatMap(claim => (claim.recoveries || []).filter(recovery => inReportRange(recovery.date)).map(recovery => ({ claim, recovery })));
    const visibleClaims = eligibleClaims.filter(claim => {
      const outstanding = employeeClaimOutstanding(claim, asOfDate);
      return outstanding > 0 || inReportRange(claim.date) || (claim.recoveries || []).some(recovery => inReportRange(recovery.date));
    });
    const lastActivityDate = (claim) => [...(claim.recoveries || []).map(item => item.date), claim.date].filter(Boolean).sort().at(-1) || claim.date;
    const rows = newestFirst(visibleClaims, lastActivityDate).slice(0, 200).map(claim => {
      const recovered = employeeClaimRecovered(claim, asOfDate);
      const outstanding = employeeClaimOutstanding(claim, asOfDate);
      const status = outstanding <= 0
        ? '<span class="pill green">Đã tất toán</span>'
        : recovered > 0 ? '<span class="pill orange">Thu một phần</span>' : '<span class="pill red">Chờ thu</span>';
      const orderDetail = [claim.orderCode ? `Order ${claim.orderCode}` : "", claim.item || "Order nhầm / làm lại món"]
        .filter(Boolean).map(escapeHtml).join('<br><small>') + (claim.orderCode ? '</small>' : '');
      return [
        dateVi(claim.date),
        `<strong>${escapeHtml(claim.claimCode || claim.id)}</strong>${claim.evidence ? `<br><small>${escapeHtml(claim.evidence)}</small>` : ""}`,
        `<strong>${escapeHtml(claim.employeeCode ? `${claim.employeeCode} · ${claim.employee}` : (claim.employee || "Chưa ghi nhân viên"))}</strong>`,
        orderDetail,
        money(claim.amount), money(recovered),
        `<strong class="${outstanding > 0 ? "danger" : "good"}">${money(outstanding)}</strong>`,
        status,
        outstanding > 0 ? `<button class="small-button" data-employee-claim-recover="${escapeHtml(claim.id)}">Thu hồi</button>` : "—",
      ];
    });
    const openClaims = eligibleClaims.filter(item => employeeClaimOutstanding(item, asOfDate) > 0);
    const outstandingTotal = sum(openClaims, item => employeeClaimOutstanding(item, asOfDate));
    const recoveredInPeriod = sum(recoveriesInPeriod, item => item.recovery.amount);
    const payrollInPeriod = sum(recoveriesInPeriod.filter(item => item.recovery.method === "payroll"), item => item.recovery.amount);
    const form = `<div class="panel form-panel"><div class="panel-head"><div><h3>Tạo hồ sơ bồi thường</h3><p>Dùng khi nhân viên order nhầm hoặc làm lại món và quán quyết định thu lại từ nhân viên.</p></div></div><form id="employee-claim-form"><div class="form-grid employee-claim-grid">${field("Ngày ghi nhận","date","date",localToday())}<div class="field"><label>Nhân viên <small>(mã cố định)</small></label><select name="employeeId" id="employee-claim-employee">${employeeOptions()}</select></div><p class="form-hint employee-claim-hint">Thêm hoặc sửa nhân sự tại <strong>Danh mục → Nhân sự</strong>.</p>${field("Mã order / hóa đơn","orderCode","text","","Ví dụ: POS-1807-023",true)}${field("Món / lỗi phát sinh","item","text","","Ví dụ: Order nhầm Ramen miso",true)}${field("Số phải thu nhân viên","amount","number","","0")}${field("Mã biên bản / chứng từ","evidence","text","","Ví dụ: BB-BTNV-1807-01")}${attachmentField("File biên bản / ảnh lỗi món")}${field("Ghi chú","note","text","","Nêu rõ ca làm, nguyên nhân và người phê duyệt",true)}</div><div class="calc-box"><span>Khoản phải thu được tạo</span><strong id="employee-claim-amount-preview">0 ₫</strong></div><p class="form-hint">Hồ sơ này là <strong>phải thu nội bộ</strong>: không tăng doanh thu, không giảm chi phí và không đi vào P&amp;L. Lưu biên bản/phiếu xác nhận kèm hồ sơ theo quy định của quán.</p><div class="form-actions"><button class="primary-button">Tạo hồ sơ phải thu</button></div></form></div>`;
    const history = rows.length
      ? table(["Ngày","Mã hồ sơ","Nhân viên","Order / món","Phải thu","Đã thu","Còn lại","Trạng thái","Thao tác"], rows, [4,5,6])
      : '<div class="empty">Chưa có hồ sơ bồi thường nào trong phạm vi đang chọn.</div>';
    const content = `<div class="panel"><div class="panel-head"><div><h3>Hồ sơ order nhầm / làm lại món</h3><p>Hiển thị hồ sơ phát sinh, đã thu trong kỳ hoặc còn phải thu đến ${dateVi(asOfDate)}.</p></div></div><div class="table-wrap">${history}</div></div>`;
    app.innerHTML = `<div class="kpi-grid">${kpi("Phải thu nhân viên", money(outstandingTotal), `${openClaims.length} hồ sơ còn mở đến ${dateVi(asOfDate)}`, "⚑", outstandingTotal ? "#e60012" : "#e60012")}${kpi("Đã thu trong kỳ", money(recoveredInPeriod), `${recoveriesInPeriod.length} lần thu hồi`, "✓", "#e60012")}${kpi("Khấu trừ lương", money(payrollInPeriod), "Không tạo thêm doanh thu hoặc P&L", "−", "#880000")}${kpi("Hồ sơ trong kỳ", fmt.format(visibleClaims.length), `Phạm vi ${reportRangeLabel()}`, "≡", "#d3a447")}</div>${sectionWithForm(form, content, "compact-form-layout")}`;
    const claimForm = document.querySelector("#employee-claim-form");
    bindAmountPreview(claimForm, "amount", "employee-claim-amount-preview");
    claimForm.addEventListener("submit", async event => {
      event.preventDefault();
      const fd = new FormData(event.currentTarget);
      const date = fd.get("date");
      const employee = findEmployee(fd.get("employeeId"));
      const item = String(fd.get("item") || "").trim();
      const amount = num(fd.get("amount"));
      if (!date || !employee || !item) { toast("Vui lòng chọn nhân viên và điền đủ ngày, món/lỗi phát sinh"); return; }
      if (amount <= 0) { toast("Số phải thu nhân viên phải lớn hơn 0"); return; }
      let attachment = null;
      try { attachment = await readAttachment(fd, "attachment", false); } catch (error) { toast(error.message); return; }
      state.employeeClaims.push({
        id: uid("employee-claim"), createdAt: Date.now(), date,
        claimCode: nextEmployeeClaimCode(date), employeeId: employee.id, employeeCode: employee.code, employee: employee.name, item, amount,
        orderCode: String(fd.get("orderCode") || "").trim(),
        evidence: String(fd.get("evidence") || "").trim(), attachment,
        note: String(fd.get("note") || "").trim(), recoveryCategoryCode: employeeRecoveryCategoryCode(), recoveries: [],
      });
      persist(); toast("Đã tạo hồ sơ phải thu nhân viên ngoài P&L"); render();
    });
    document.querySelectorAll("[data-employee-claim-recover]").forEach(button => button.addEventListener("click", () => openEmployeeClaimRecovery(button.dataset.employeeClaimRecover)));
  }

  function openEmployeeClaimRecovery(claimId) {
    const claim = employeeClaims().find(item => item.id === claimId);
    if (!claim) { toast("Không tìm thấy hồ sơ phải thu nhân viên"); return; }
    const due = employeeClaimOutstanding(claim);
    if (due <= 0) { toast("Hồ sơ này đã được tất toán"); return; }
    modalContent.innerHTML = `<h2>Thu hồi bồi thường nhân viên</h2><p><strong>${escapeHtml(claim.claimCode || claim.id)}</strong> · <strong>${escapeHtml(claim.employeeCode ? `${claim.employeeCode} · ${claim.employee}` : (claim.employee || "Chưa ghi nhân viên"))}</strong> · ${escapeHtml(claim.item || "Order nhầm / làm lại món")}</p><form id="employee-recovery-form"><div class="form-grid"><div class="field"><label>Hình thức thu hồi</label><select name="method" id="employee-recovery-method"><option value="cash">Nộp tiền mặt</option><option value="transfer">Chuyển khoản</option></select></div>${field("Ngày thu hồi","date","date",localToday())}${field("Số tiền thu hồi","amount","number",due,"0")}<div class="field full" id="employee-recovery-account"></div>${field("Mã giao dịch / chứng từ","reference","text","","Ví dụ: FT98765432",true)}${attachmentField("File phiếu thu / ảnh chuyển khoản")}${field("Ghi chú","note","text","","Số phiếu thu, biên bản hoặc xác nhận",true)}</div><div class="calc-box"><span>Còn phải thu sau lần ghi này</span><strong id="employee-recovery-remaining">${money(due)}</strong></div><p class="form-hint">Tiền mặt/chuyển khoản sẽ tăng quỹ/tài khoản đã chọn. Nếu cần <strong>khấu trừ lương</strong>, hãy thực hiện tại màn hình <strong>Chi trả lương</strong> để hệ thống liên kết đúng nhân viên, kỳ lương và lương thực trả.</p><div class="form-actions"><button class="primary-button">Xác nhận thu hồi</button></div></form>`;
    openModal();
    const form = document.querySelector("#employee-recovery-form");
    const methodInput = form.querySelector("#employee-recovery-method");
    const accountArea = form.querySelector("#employee-recovery-account");
    const amountInput = form.querySelector('[name="amount"]');
    const dateInput = form.querySelector('[name="date"]');
    const remaining = form.querySelector("#employee-recovery-remaining");
    const renderAccount = () => {
      if (methodInput.value === "payroll") {
        accountArea.innerHTML = '<label>Nơi nhận</label><input type="text" value="Khấu trừ vào bảng lương" readonly>';
      } else {
        const types = methodInput.value === "cash" ? ["cash"] : ["bank"];
        accountArea.innerHTML = `<label>${methodInput.value === "cash" ? "Quỹ nhận tiền" : "Tài khoản nhận tiền"}</label><select name="accountId">${accountOptions(types, defaultAccountId(types[0]))}</select>`;
      }
    };
    const updateRemaining = () => { remaining.textContent = money(Math.max(0, due - num(amountInput.value))); };
    methodInput.addEventListener("change", renderAccount); amountInput.addEventListener("input", updateRemaining); renderAccount(); updateRemaining();
    form.addEventListener("submit", async event => {
      event.preventDefault();
      const fd = new FormData(event.currentTarget);
      const amount = num(fd.get("amount"));
      const date = fd.get("date");
      const method = fd.get("method");
      if (!date || date < claim.date) { toast("Ngày thu hồi không thể trước ngày lập hồ sơ"); return; }
      if (amount <= 0) { toast("Số tiền thu hồi phải lớn hơn 0"); return; }
      if (amount > due) { toast(`Hồ sơ này chỉ còn ${money(due)} cần thu`); return; }
      const accountId = method === "payroll" ? "" : fd.get("accountId");
      if (method !== "payroll" && !findAccount(accountId)) { toast("Vui lòng chọn quỹ hoặc tài khoản nhận tiền"); return; }
      let attachment = null;
      try { attachment = await readAttachment(fd, "attachment", false); } catch (error) { toast(error.message); return; }
      claim.recoveries.push({
        id: uid("employee-recovery"), createdAt: Date.now(), date, amount, method, accountId,
        reference: String(fd.get("reference") || "").trim(), attachment, note: String(fd.get("note") || "").trim(), categoryCode: employeeRecoveryCategoryCode(),
      });
      claim.updatedAt = Date.now();
      persist(); closeModal(); toast(`Đã ghi ${employeeRecoveryMethodLabel(method).toLowerCase()} cho ${claim.claimCode}`); render();
    });
  }

  const latestReconciliation = (accountId) => newestFirst((state.reconciliations || []).filter(x => x.accountId === accountId))[0];
  const ledgerAsOfDate = () => {
    const dates = [...ledgerEntries().map(x => x.date), ...(state.accounts || []).map(x => x.openingDate)].filter(Boolean).sort();
    return dates.at(-1) || localToday();
  };
  function accountCard(account, asOfDate) {
    const book = accountBalance(account.id, asOfDate);
    const unrequestedAppSales = account.type === "app" ? appSalesWaitingForWithdrawal(asOfDate) : [];
    const unrequestedAppAmount = sum(unrequestedAppSales, "net");
    const pendingAppPayouts = account.type === "app" ? appPayoutsWaitingForPayment(asOfDate) : [];
    const pendingAppPayoutAmount = sum(pendingAppPayouts, payoutNet);
    const displayBalance = account.type === "app" ? unrequestedAppAmount + pendingAppPayoutAmount : book;
    const reconciliation = latestReconciliation(account.id);
    const variance = reconciliation ? num(reconciliation.actual) - accountBalance(account.id, reconciliation.date) : null;
    const reconciliationNote = reconciliation ? `Đối soát ${dateVi(reconciliation.date)} · ${variance === 0 ? "Khớp sổ" : `Lệch ${money(variance)}`}` : "Chưa đối soát";
    const action = account.type === "app" ? `<button class="small-button" data-app-settle>Nhận tiền app</button>` : `<button class="small-button" data-account-reconcile="${escapeHtml(account.id)}">Đối soát</button>`;
    const accountDetail = account.type === "app" ? `${fmt.format(unrequestedAppSales.length)} dòng chưa yêu cầu rút · ${fmt.format(pendingAppPayouts.length)} đợt chờ App thanh toán` : `Số dư đầu kỳ ${money(account.openingBalance)} từ ${dateVi(account.openingDate)}`;
    const accountNote = account.type === "app" ? "Chỉ về 0 ₫ khi App đã chuyển tiền về ngân hàng" : reconciliationNote;
    return `<article class="account-card ${displayBalance < 0 ? "negative" : ""}"><div class="account-card-head"><span class="pill ${account.type === "cash" ? "orange" : "green"}">${escapeHtml(accountTypeLabel(account.type))}</span><div class="inline-actions">${action}<button class="small-button" data-account-edit="${escapeHtml(account.id)}">Sửa</button></div></div><h3>${escapeHtml(account.name)}</h3><strong>${money(displayBalance)}</strong><p>${accountDetail}</p><small class="${account.type === "app" ? "" : variance === 0 ? "good" : variance === null ? "" : "danger"}">${accountNote}</small></article>`;
  }
  function renderFunds(){
    setHeader("Sổ quỹ & tài khoản", "KIỂM SOÁT KÉT · NGÂN HÀNG · APP CHỜ ĐỐI SOÁT");
    const asOfDate = reportEnd();
    const cashBook = accountBalance(defaultAccountId("cash"), asOfDate);
    const managementBook = accountBalance(defaultAccountId("handover"), asOfDate);
    const bankBook = accountBalance(defaultAccountId("bank"), asOfDate);
    const entries = newestFirst(ledgerEntries().filter(inPeriod));
    const reconciliationCount = accounts().filter(x => latestReconciliation(x.id)).length;
    const entryRows = entries.slice(0,200).map(x => [dateVi(x.date), `<strong>${escapeHtml(accountName(x.accountId))}</strong>`, escapeHtml(x.kind), flowMoney(x.amount), escapeHtml(x.note || "—")]);
    const transferRows = newestFirst((state.fundTransactions || []).filter(item => inReportRange(item.date) && ["transfer", "adjustment", "customer-exchange"].includes(item.type))).slice(0,100).map(item => {
      const action = item.type === "adjustment" ? `<button class="small-button" data-fund-edit="${escapeHtml(item.id)}">Sửa</button>` : "—";
      if (item.type === "transfer" || item.type === "customer-exchange") return [dateVi(item.date), item.type === "customer-exchange" ? "Đổi tiền khách" : "Chuyển quỹ", `<strong>${escapeHtml(accountName(item.fromAccountId))}</strong>`, `<strong>${escapeHtml(accountName(item.toAccountId))}</strong>`, `<span class="money-flow zero">${money(item.amount)}</span>`, escapeHtml(item.note || (item.type === "customer-exchange" ? "Đổi tiền cho khách" : "—")), action];
      return [dateVi(item.date), item.direction === "in" ? "Bổ sung quỹ" : "Rút / điều chỉnh quỹ", `<strong>${escapeHtml(accountName(item.accountId))}</strong>`, escapeHtml(item.counterparty || "—"), flowMoney(item.direction === "in" ? item.amount : -num(item.amount)), escapeHtml(fundAdjustmentNote(item) || "—"), action];
    });
    const transferHistory = transferRows.length ? table(["Ngày","Nghiệp vụ","Quỹ / tài khoản","Đến / Đối tượng","Số tiền","Diễn giải","Thao tác"], transferRows, [4]) : '<div class="empty">Chưa có giao dịch chuyển hoặc điều chỉnh quỹ.</div>';
    const outstandingMisreceivedAsOf = (item) => Math.max(0, num(item.amount) - sum(misreceivedRefunds().filter(refund => refund.caseId === item.id && refund.date <= asOfDate), "amount"));
    const refundsInPeriod = misreceivedRefunds().filter(refund => inReportRange(refund.date));
    // Bảng điều chỉnh là báo cáo phát sinh trong kỳ: chỉ hiện hồ sơ nhận hoặc hoàn
    // có ngày nằm trong phạm vi đang chọn, không kéo hồ sơ của tháng tương lai vào.
    const specialCases = newestFirst(misreceivedCases().filter(item => inReportRange(item.date) || refundsInPeriod.some(refund => refund.caseId === item.id)));
    const pendingMisreceived = sum(specialCases.filter(item => item.date <= asOfDate), outstandingMisreceivedAsOf);
    const refundedInPeriod = sum(refundsInPeriod, "amount");
    const exchangedInPeriod = sum((state.fundTransactions || []).filter(item => item.type === "customer-exchange" && inReportRange(item.date)), "amount");
    const specialRows = specialCases.slice(0,100).map(item => {
      const refunded = sum(refundsInPeriod.filter(refund => refund.caseId === item.id), "amount");
      const outstanding = outstandingMisreceivedAsOf(item);
      return [dateVi(item.date), `<strong>${escapeHtml(item.caseCode || item.id)}</strong>`, escapeHtml(item.counterparty || "Chưa ghi người chuyển"), `<strong>${escapeHtml(accountName(item.accountId))}</strong>`, escapeHtml(item.bankReference || "—"), money(item.amount), money(refunded), `<strong class="${outstanding > 0 ? "danger" : "good"}">${money(outstanding)}</strong>`, outstanding > 0 ? '<span class="pill orange">Chờ hoàn</span>' : '<span class="pill green">Đã hoàn</span>'];
    });
    const specialHistory = specialRows.length ? table(["Ngày nhận","Mã hồ sơ","Người chuyển","Tài khoản nhận","Mã GD ngân hàng","Nhận nhầm","Đã hoàn trong kỳ","Còn chờ cuối kỳ","Trạng thái"], specialRows, [5,6,7]) : '<div class="empty">Chưa có giao dịch tiền nhận nhầm hoặc hoàn tiền nhận nhầm trong phạm vi đang chọn.</div>';
    const heldForRefundAsOf = sum(misreceivedCases().filter(item => item.date <= asOfDate), outstandingMisreceivedAsOf);
    app.innerHTML=`<div class="account-actions-row"><button class="outline-button" data-account-add>＋ Tài khoản / quỹ</button><button class="outline-button" data-special-cash-transaction>＋ Giao dịch đặc biệt</button><button class="primary-button" data-fund-transaction>⇄ Chuyển quỹ</button></div>
      <div class="kpi-grid">${kpi("Tiền mặt vận hành",money(cashBook),"Số dư két theo sổ","◉",cashBook>=0?"#111111":"#e60012")}${kpi("Két tổng / Quản lý",money(managementBook),"Tiền mặt đã bàn giao","◉",managementBook>=0?"#880000":"#e60012")}${kpi("Tài khoản ngân hàng",money(bankBook),"Tiền quán và app đã nhận","▣",bankBook>=0?"#e60012":"#e60012")}${kpi("Tiền thực của quán",money(totalLiquidity(asOfDate)-heldForRefundAsOf),heldForRefundAsOf>0?`Không gồm ${money(heldForRefundAsOf)} tiền nhận nhầm chờ hoàn`:"Tiền mặt + tiền tại ngân hàng","◈","#2b2b2b")}</div>
      <div class="account-grid">${accounts().map(account => accountCard(account, asOfDate)).join("")}</div>
      <div class="panel special-cashflow-panel"><div class="panel-head"><div><h3>Điều chỉnh dòng tiền ngoài P&L</h3><p>Tiền nhận nhầm là khoản phải hoàn; đổi tiền khách chỉ chuyển nơi giữ tiền. Cả ba nghiệp vụ không làm thay đổi doanh thu, chi phí hay lợi nhuận. Chỉ hiển thị phát sinh trong ${reportRangeLabel()}.</p></div><button class="outline-button" data-special-cash-transaction>＋ Ghi giao dịch đặc biệt</button></div><div class="special-cashflow-kpis"><div><span>Tiền nhận nhầm chờ hoàn</span><strong class="${pendingMisreceived>0?"danger":"good"}">${money(pendingMisreceived)}</strong></div><div><span>Đã hoàn trong kỳ</span><strong>${money(refundedInPeriod)}</strong></div><div><span>Đổi tiền khách trong kỳ</span><strong>${money(exchangedInPeriod)}</strong></div></div><div class="table-wrap">${specialHistory}</div></div>
      <div class="panel"><div class="panel-head"><div><h3>Lịch sử chuyển quỹ</h3><p>${transferRows.length} giao dịch chuyển, đổi tiền hoặc điều chỉnh trong kỳ báo cáo đang chọn</p></div><button class="outline-button" data-fund-transaction>＋ Ghi giao dịch quỹ</button></div><div class="table-wrap">${transferHistory}</div></div>
      <div class="panel"><div class="panel-head"><div><h3>Sổ quỹ tự động</h3><p>${entries.length} bút toán trong kỳ · ${reconciliationCount}/${accounts().length} quỹ đã có lần đối soát</p></div><button class="outline-button" data-fund-transaction>＋ Ghi giao dịch quỹ</button></div><div class="table-wrap">${table(["Ngày","Quỹ / tài khoản","Nghiệp vụ","Biến động","Diễn giải"],entryRows)}</div></div>`;
    document.querySelectorAll("[data-account-add]").forEach(button=>{button.textContent="＋ Thêm tài khoản khác";button.addEventListener("click",()=>openAccountEditor());});
    document.querySelectorAll("[data-fund-transaction]").forEach(button=>button.addEventListener("click",openFundTransaction));
    document.querySelectorAll("[data-fund-edit]").forEach(button=>button.addEventListener("click",()=>openFundTransaction(button.dataset.fundEdit)));
    document.querySelectorAll("[data-special-cash-transaction]").forEach(button=>button.addEventListener("click",openSpecialCashTransaction));
    document.querySelectorAll("[data-account-edit]").forEach(button=>{
      const account=findAccount(button.dataset.accountEdit);
      button.addEventListener("click",()=>openAccountEditor(account));
      if(!account||account.system)return;
      const deleteButton=document.createElement("button");
      deleteButton.type="button";deleteButton.className="small-button danger-button";deleteButton.textContent="Xóa";
      deleteButton.addEventListener("click",()=>{
        const hasLedgerEntry=ledgerEntries().some(entry=>entry.accountId===account.id);
        const hasReconciliation=(state.reconciliations||[]).some(item=>item.accountId===account.id);
        if(hasLedgerEntry||hasReconciliation){toast("Không thể xóa tài khoản đã có giao dịch hoặc đối soát. Hãy giữ tài khoản và điều chỉnh số dư về 0 đ.");return;}
        if(!window.confirm(`Xóa tài khoản ${account.name}? Số dư đầu kỳ sẽ bị xóa.`))return;
        state.accounts=state.accounts.filter(item=>item.id!==account.id);
        persist();toast("Đã xóa tài khoản");render();
      });
      button.insertAdjacentElement("afterend",deleteButton);
    });
    document.querySelectorAll("[data-account-reconcile]").forEach(button=>button.addEventListener("click",()=>openReconciliation(button.dataset.accountReconcile)));
    document.querySelectorAll("[data-app-settle]").forEach(button=>button.addEventListener("click",()=>openAppSettlement()));
  }
  function openAccountEditor(account=null){
    const isEdit=Boolean(account);const value=account||{id:"",name:"",type:"cash",openingBalance:0,openingDate:localToday(),active:true};
    modalContent.innerHTML=`<h2>${isEdit?"Sửa quỹ / tài khoản":"Thêm quỹ / tài khoản"}</h2><p>Số dư đầu kỳ là số đã kiểm đếm hoặc đã đối chiếu sao kê tại ngày bắt đầu theo dõi.</p><form id="account-form"><div class="form-grid"><div class="field full"><label>Tên quỹ / tài khoản</label><input name="name" type="text" value="${escapeHtml(value.name)}" placeholder="Ví dụ: Vietcombank Quán" autofocus></div><div class="field"><label>Loại</label><select name="type">${Object.entries(ACCOUNT_TYPES).map(([key,label])=>`<option value="${key}" ${key===value.type?"selected":""}>${label}</option>`).join("")}</select></div><div class="field"><label>Ngày bắt đầu theo dõi</label><input name="openingDate" type="date" value="${escapeHtml(value.openingDate||localToday())}"></div><div class="field full"><label>Số dư đầu kỳ</label><input name="openingBalance" type="number" step="1" value="${escapeHtml(value.openingBalance)}" placeholder="Có thể là số âm nếu tài khoản thấu chi"></div></div><div class="form-actions"><button class="primary-button">${isEdit?"Lưu thay đổi":"Thêm tài khoản"}</button></div></form>`;
    openModal();document.querySelector("#account-form").addEventListener("submit",event=>{event.preventDefault();const fd=new FormData(event.currentTarget),name=String(fd.get("name")||"").trim();if(!name){toast("Vui lòng nhập tên quỹ hoặc tài khoản");return;}if((state.accounts||[]).some(x=>x.name.localeCompare(name,"vi",{sensitivity:"accent"})===0&&x!==account)){toast("Tên quỹ hoặc tài khoản đã tồn tại");return;}const saved={name,type:fd.get("type"),openingDate:fd.get("openingDate"),openingBalance:num(fd.get("openingBalance")),active:true};if(account)Object.assign(account,saved);else state.accounts.push({id:uid("account"),...saved,system:false});persist();closeModal();toast(isEdit?"Đã cập nhật số dư đầu kỳ":"Đã thêm quỹ / tài khoản");render();});
  }
  function openFundTransaction(transactionId = ""){
    const editing = (state.fundTransactions || []).find(item => item.id === transactionId);
    const isEdit = Boolean(editing);
    modalContent.innerHTML=`<h2>${isEdit ? "Sửa giao dịch quỹ" : "Ghi giao dịch quỹ"}</h2><p>Chuyển quỹ không tạo doanh thu hoặc chi phí P&L; chỉ làm thay đổi nơi tiền đang nằm.</p><form id="fund-transaction-form"><div class="form-grid"><div class="field"><label>Nghiệp vụ</label><select name="type" id="fund-type" ${isEdit ? "disabled" : ""}><option value="transfer" ${editing?.type==="transfer"?"selected":""}>Chuyển giữa quỹ / tài khoản</option><option value="adjustment" ${editing?.type==="adjustment"?"selected":""}>Bổ sung, rút hoặc điều chỉnh quỹ</option></select><input type="hidden" name="typeValue" value="${escapeHtml(editing?.type || "")}"></div>${field("Ngày","date","date",editing?.date || localToday())}${field("Số tiền","amount","number",editing?.amount || "","0")}<div id="fund-transaction-fields" class="field full"></div>${attachmentField(isEdit && editing?.attachment ? "File chứng từ mới (bỏ trống để giữ file cũ)" : "File chứng từ giao dịch quỹ")}${field("Diễn giải","note","text",editing?.note || "","Ví dụ: Nộp tiền mặt vào ngân hàng",true)}</div><div class="calc-box"><span>Số tiền đã nhập</span><strong id="fund-amount-preview">0 ₫</strong></div><div class="calc-box" id="fund-source-balance"><span>Số dư nguồn sau chuyển</span><strong id="fund-source-balance-value">0 ₫</strong></div><div class="form-actions"><button class="primary-button">${isEdit ? "Lưu chỉnh sửa" : "Ghi vào sổ quỹ"}</button></div></form>`;
    openModal();const form=document.querySelector("#fund-transaction-form"),typeInput=form.querySelector("#fund-type"),fields=form.querySelector("#fund-transaction-fields");
    const amountInput=form.querySelector('input[name="amount"]'),dateInput=form.querySelector('input[name="date"]'),sourceBalanceBox=form.querySelector("#fund-source-balance"),sourceBalanceValue=form.querySelector("#fund-source-balance-value");
    const updateSourceBalance=()=>{if(typeInput.value!=="transfer"){sourceBalanceBox.hidden=true;return;}const fromInput=form.querySelector('[name="fromAccountId"]');if(!fromInput){sourceBalanceBox.hidden=true;return;}const balance=accountBalance(fromInput.value,dateInput.value),after=balance-num(amountInput.value);sourceBalanceBox.hidden=false;sourceBalanceBox.classList.toggle("negative",after<0);sourceBalanceValue.textContent=money(after);};
    const renderFields=()=>{if(typeInput.value==="transfer"){fields.innerHTML=`<div class="form-grid"><div class="field"><label>Từ quỹ / tài khoản</label><select name="fromAccountId">${accountOptions(["cash","bank"],editing?.fromAccountId||defaultAccountId("cash"))}</select></div><div class="field"><label>Đến quỹ / tài khoản</label><select name="toAccountId">${accountOptions(["cash","bank"],editing?.toAccountId||defaultAccountId("bank"))}</select></div>${field("Mã giao dịch / chứng từ chuyển quỹ","bankReference","text",editing?.bankReference||"","Ví dụ: FT..., RUT-TM-001")}</div>`;fields.querySelector('[name="fromAccountId"]').addEventListener("change",updateSourceBalance);}else{fields.innerHTML=`<div class="form-grid"><div class="field"><label>Quỹ / tài khoản</label><select name="accountId">${accountOptions(["cash","bank"],editing?.accountId||defaultAccountId("bank"))}</select></div><div class="field"><label>Chiều điều chỉnh</label><select name="direction"><option value="in" ${editing?.direction==="in"?"selected":""}>Bổ sung tiền vào</option><option value="out" ${editing?.direction==="out"?"selected":""}>Rút tiền ra / thiếu quỹ</option></select></div>${field("Người/đơn vị góp hoặc rút","counterparty","text",editing?.counterparty||"","Ví dụ: Cổ đông Nguyễn Văn A")}${field("Mã giao dịch / chứng từ","bankReference","text",editing?.bankReference||"","Ví dụ: FT45435345 hoặc PT-001")}</div><p class="form-hint">Nếu có nhiều cổ đông góp vốn, nhập mỗi người/mỗi lần chuyển thành một giao dịch riêng để tra vết theo mã giao dịch.</p>`;}updateSourceBalance();};typeInput.addEventListener("change",renderFields);amountInput.addEventListener("input",updateSourceBalance);dateInput.addEventListener("change",updateSourceBalance);renderFields();bindAmountPreview(form,"amount","fund-amount-preview");
    form.addEventListener("submit",async event=>{event.preventDefault();const fd=new FormData(form),amount=num(fd.get("amount"));if(amount<=0){toast("Số tiền giao dịch phải lớn hơn 0");return;}const transaction={...(editing||{}),id:editing?.id||uid("fund"),date:fd.get("date"),type:fd.get("type")||fd.get("typeValue")||typeInput.value,amount,note:String(fd.get("note")||"").trim(),updatedAt:isEdit?Date.now():undefined};if(transaction.type==="transfer"){transaction.fromAccountId=fd.get("fromAccountId");transaction.toAccountId=fd.get("toAccountId");transaction.bankReference=String(fd.get("bankReference")||"").trim();if(!findAccount(transaction.fromAccountId)||!findAccount(transaction.toAccountId)||transaction.fromAccountId===transaction.toAccountId){toast("Chọn hai quỹ/tài khoản khác nhau");return;}if(!transaction.bankReference){toast("Vui lòng nhập mã giao dịch hoặc chứng từ chuyển quỹ");return;}const currentEffect=isEdit&&editing?.fromAccountId===transaction.fromAccountId&&editing?.date<=transaction.date?num(editing.amount):0;const sourceBalance=accountBalance(transaction.fromAccountId,transaction.date)+currentEffect;if(sourceBalance<=0){toast(`Không thể chuyển từ ${accountName(transaction.fromAccountId)} vì số dư theo sổ đang ${money(sourceBalance)}`);return;}if(amount>sourceBalance){toast(`Không thể chuyển ${money(amount)}; ${accountName(transaction.fromAccountId)} chỉ còn ${money(sourceBalance)}`);return;}}else{transaction.accountId=fd.get("accountId");transaction.direction=fd.get("direction");transaction.counterparty=String(fd.get("counterparty")||"").trim();transaction.bankReference=String(fd.get("bankReference")||"").trim();if(!findAccount(transaction.accountId)){toast("Vui lòng chọn quỹ hoặc tài khoản");return;}if(transaction.direction==="in"&&!transaction.counterparty){toast("Vui lòng nhập người/đơn vị bổ sung tiền");return;}if(transaction.direction==="in"&&!transaction.bankReference){toast("Vui lòng nhập mã giao dịch hoặc mã chứng từ góp vốn");return;}}let attachment=null;try{attachment=await readAttachment(fd,"attachment",false);}catch(error){toast(error.message);return;}transaction.attachment=attachment||editing?.attachment||null;if(isEdit)Object.assign(editing,transaction);else state.fundTransactions.push(transaction);persist();closeModal();toast(isEdit?"Đã sửa giao dịch quỹ":"Đã ghi giao dịch vào sổ quỹ");render();});
  }
  function openSpecialCashTransaction(prefill={}){
    const openCases = misreceivedCases().filter(item => outstandingMisreceived(item) > 0);
    const typeOptions = prefill.requireMisreceived
      ? '<option value="misreceived">Tiền nhận nhầm chờ hoàn</option>'
      : '<option value="misreceived">Tiền nhận nhầm chờ hoàn</option><option value="misreceived-refund">Hoàn tiền nhận nhầm</option><option value="customer-exchange">Đổi tiền khách</option>';
    const title = prefill.requireMisreceived ? "Tạo hồ sơ tiền nhận nhầm" : "Giao dịch đặc biệt";
    const intro = prefill.requireMisreceived
      ? "Xác nhận hồ sơ này để đồng thời loại dòng đã chọn khỏi doanh thu/P&L. Tiền vẫn được ghi nhận tại ngân hàng dưới dạng tiền phải hoàn."
      : `Nhóm <strong>${SPECIAL_CASHFLOW_GROUP}</strong>: dùng cho tiền nhận nhầm, hoàn tiền nhận nhầm và đổi tiền cho khách. Các nghiệp vụ này không đi vào doanh thu, chi phí hoặc P&L.`;
    modalContent.innerHTML=`<h2>${title}</h2><p>${intro}</p><form id="special-cash-transaction-form"><div class="form-grid"><div class="field"><label>Nghiệp vụ</label><select name="type" id="special-cash-type">${typeOptions}</select></div>${field("Ngày","date","date",prefill.date||localToday())}${field("Số tiền","amount","number",prefill.amount||"","0")}<div id="special-cash-fields" class="field full"></div>${attachmentField("File chứng từ giao dịch đặc biệt")}${field("Ghi chú","note","text",prefill.note||"","Ví dụ: Khách chuyển nhầm đơn hàng",true)}</div><div class="calc-box"><span>Số tiền đã nhập</span><strong id="special-cash-amount-preview">0 ₫</strong></div><div class="calc-box" id="special-source-balance"><span>Số dư nguồn sau giao dịch</span><strong id="special-source-balance-value">0 ₫</strong></div><div class="form-actions"><button class="primary-button" id="special-cash-submit">${prefill.requireMisreceived ? "Xác nhận hồ sơ nhận nhầm" : "Lưu giao dịch đặc biệt"}</button></div></form>`;
    openModal();
    const form=document.querySelector("#special-cash-transaction-form"),typeInput=form.querySelector("#special-cash-type"),fields=form.querySelector("#special-cash-fields");
    const amountInput=form.querySelector('[name="amount"]'),dateInput=form.querySelector('[name="date"]'),sourceBalanceBox=form.querySelector("#special-source-balance"),sourceBalanceValue=form.querySelector("#special-source-balance-value"),submitButton=form.querySelector("#special-cash-submit");
    const selectedCase=()=>misreceivedCases().find(item=>item.id===form.querySelector('[name="caseId"]')?.value);
    const updateSourceBalance=()=>{const type=typeInput.value;const sourceId=type==="customer-exchange"?form.querySelector('[name="fromAccountId"]')?.value:type==="misreceived-refund"?form.querySelector('[name="accountId"]')?.value:"";if(!sourceId){sourceBalanceBox.hidden=true;return;}const balance=accountBalance(sourceId,dateInput.value),after=balance-num(amountInput.value);sourceBalanceBox.hidden=false;sourceBalanceBox.classList.toggle("negative",after<0);sourceBalanceValue.textContent=money(after);};
    const applyCaseAmount=()=>{const item=selectedCase();if(item){amountInput.value=outstandingMisreceived(item);updateSourceBalance();}};
    let firstRender = true;
    const renderFields=()=>{
      const type=typeInput.value;submitButton.disabled=false;
      if(type==="misreceived"){
        if(!firstRender) amountInput.value="";
        fields.innerHTML=`<div class="form-grid"><div class="field"><label>Tài khoản nhận tiền</label><select name="accountId">${accountOptions(["cash","bank"],prefill.accountId||defaultAccountId("bank"))}</select></div>${field("Người chuyển / khách","counterparty","text",prefill.counterparty||"","Ví dụ: Nguyễn Văn A")}${field("Mã giao dịch ngân hàng gốc","bankReference","text",prefill.bankReference||"","Ví dụ: FT260718...",true)}<p class="form-hint field full">Hệ thống sẽ tạo mã hồ sơ nhận nhầm sau khi lưu. Khoản này được theo dõi là tiền phải hoàn, không phải doanh thu.</p></div>`;
      } else if(type==="misreceived-refund"){
        amountInput.value="";
        const options=openCases.map(item=>`<option value="${escapeHtml(item.id)}">${escapeHtml(item.caseCode || item.id)} · ${escapeHtml(item.bankReference || "Chưa có mã GD")} · ${escapeHtml(item.counterparty || "Chưa rõ người chuyển")} · còn ${money(outstandingMisreceived(item))}</option>`).join("");
        if(!options){submitButton.disabled=true;fields.innerHTML='<p class="form-hint">Không có hồ sơ tiền nhận nhầm nào đang chờ hoàn.</p>';}else{fields.innerHTML=`<div class="form-grid"><div class="field full"><label>Hồ sơ tiền nhận nhầm cần hoàn (mã nhận gốc)</label><select name="caseId">${options}</select><p class="form-hint">Danh sách này hiển thị mã giao dịch khách đã chuyển nhầm để chọn đúng hồ sơ.</p></div><div class="field"><label>Tài khoản hoàn tiền</label><select name="accountId">${accountOptions(["cash","bank"],defaultAccountId("bank"))}</select></div>${field("Mã giao dịch hoàn tiền (mã mới)","bankReference","text","","Ví dụ: FT... của lệnh quán chuyển hoàn")}</div>`;fields.querySelector('[name="caseId"]').addEventListener("change",applyCaseAmount);fields.querySelector('[name="accountId"]').addEventListener("change",updateSourceBalance);applyCaseAmount();}
      } else {
        amountInput.value="";
        fields.innerHTML=`<div class="form-grid"><div class="field"><label>Từ quỹ / tài khoản</label><select name="fromAccountId">${accountOptions(["cash","bank"],defaultAccountId("cash"))}</select></div><div class="field"><label>Đến quỹ / tài khoản</label><select name="toAccountId">${accountOptions(["cash","bank"],defaultAccountId("bank"))}</select></div>${field("Tên khách / đối tượng","counterparty","text","","Ví dụ: Khách đổi tiền mặt",true)}<p class="form-hint field full">Đây là chuyển nội bộ giữa hai nơi giữ tiền. Không ghi thành khoản chi và không làm thay đổi dòng tiền thuần.</p></div>`;
        fields.querySelector('[name="fromAccountId"]').addEventListener("change",updateSourceBalance);
      }
      firstRender=false;
      updateSourceBalance();
    };
    typeInput.addEventListener("change",renderFields);amountInput.addEventListener("input",updateSourceBalance);dateInput.addEventListener("change",updateSourceBalance);renderFields();bindAmountPreview(form,"amount","special-cash-amount-preview");
    form.addEventListener("submit",async event=>{event.preventDefault();const fd=new FormData(form),type=fd.get("type"),amount=num(fd.get("amount"));if(amount<=0){toast("Số tiền giao dịch phải lớn hơn 0");return;}let attachment=null;try{attachment=await readAttachment(fd,"attachment",false);}catch(error){toast(error.message);return;}const transaction={id:uid("special"),date:fd.get("date"),type,amount,attachment,note:String(fd.get("note")||"").trim(),group:SPECIAL_CASHFLOW_GROUP,createdAt:Date.now()};
      if(type==="misreceived"){
        transaction.accountId=fd.get("accountId");transaction.counterparty=String(fd.get("counterparty")||"").trim();transaction.bankReference=String(fd.get("bankReference")||"").trim();transaction.caseCode=nextMisreceivedCode(transaction.date);
        transaction.sourceRevenueId=prefill.sourceRevenueId||"";
        if(!findAccount(transaction.accountId)){toast("Vui lòng chọn tài khoản nhận tiền");return;}
        if(!transaction.bankReference){toast("Vui lòng nhập mã giao dịch ngân hàng gốc để truy vết");return;}
      } else if(type==="misreceived-refund"){
        const item=misreceivedCases().find(caseItem=>caseItem.id===fd.get("caseId"));transaction.caseId=item?.id;transaction.caseCode=item?.caseCode;transaction.accountId=fd.get("accountId");transaction.counterparty=item?.counterparty||"";transaction.bankReference=String(fd.get("bankReference")||"").trim();
        if(!item){toast("Vui lòng chọn hồ sơ tiền nhận nhầm cần hoàn");return;}const outstanding=outstandingMisreceived(item);if(amount>outstanding){toast(`Hồ sơ ${item.caseCode || item.id} chỉ còn ${money(outstanding)} cần hoàn`);return;}const balance=accountBalance(transaction.accountId,transaction.date);if(balance<=0||amount>balance){toast(`Không thể hoàn từ ${accountName(transaction.accountId)} vì số dư theo sổ chỉ còn ${money(balance)}`);return;}
      } else {
        transaction.fromAccountId=fd.get("fromAccountId");transaction.toAccountId=fd.get("toAccountId");transaction.counterparty=String(fd.get("counterparty")||"").trim();
        if(!findAccount(transaction.fromAccountId)||!findAccount(transaction.toAccountId)||transaction.fromAccountId===transaction.toAccountId){toast("Chọn hai quỹ/tài khoản khác nhau");return;}const balance=accountBalance(transaction.fromAccountId,transaction.date);if(balance<=0||amount>balance){toast(`Không thể đổi tiền từ ${accountName(transaction.fromAccountId)} vì số dư theo sổ chỉ còn ${money(balance)}`);return;}
      }
      state.fundTransactions.push(transaction);
      if(type==="misreceived"&&typeof prefill.onMisreceivedCreated==="function")prefill.onMisreceivedCreated(transaction);
      persist();closeModal();toast(type==="misreceived"?(prefill.requireMisreceived?`Đã hủy doanh thu và tạo hồ sơ ${transaction.caseCode}`:`Đã tạo hồ sơ ${transaction.caseCode}`):type==="misreceived-refund"?"Đã ghi hoàn tiền nhận nhầm":"Đã ghi đổi tiền khách");render();
    });
  }
  function openReconciliation(accountId){
    const account=findAccount(accountId);if(!account)return;const date=localToday();const book=accountBalance(accountId,date);
    modalContent.innerHTML=`<h2>Đối soát ${escapeHtml(account.name)}</h2><p>Số theo sổ tại ${dateVi(date)}: <strong>${money(book)}</strong>. Chỉ ghi nhận số thực tế; nếu có lệch, dùng nghiệp vụ điều chỉnh quỹ để giải thích.</p><form id="reconciliation-form"><div class="form-grid">${field("Ngày đối soát","date","date",date)}<div class="field"><label>Số thực tế / sao kê</label><input name="actual" type="number" step="1" value="" placeholder="Nhập số đã kiểm đếm hoặc sao kê"></div>${field("Ghi chú","note","text","","Số sao kê, người kiểm…",true)}</div><div class="calc-box"><span>Số tiền đã nhập</span><strong id="reconciliation-amount-preview">0 ₫</strong></div><div class="form-actions"><button class="primary-button">Lưu kết quả đối soát</button></div></form>`;
    openModal();const form=document.querySelector("#reconciliation-form");bindAmountPreview(form,"actual","reconciliation-amount-preview");form.addEventListener("submit",event=>{event.preventDefault();const fd=new FormData(event.currentTarget);if(String(fd.get("actual")||"").trim()===""){toast("Vui lòng nhập số thực tế hoặc sao kê");return;}state.reconciliations.push({id:uid("recon"),accountId,date:fd.get("date"),actual:num(fd.get("actual")),note:String(fd.get("note")||"").trim()});persist();closeModal();toast("Đã lưu đối soát; chênh lệch cần có chứng từ điều chỉnh");render();});
  }

  function renderDaily(){
    setHeader("Tổng hợp theo ngày", "DOANH THU · CHI PHÍ · DÒNG TIỀN");
    const rows=dailySummaryRows();
    const quickDay = reportStart() === reportEnd() ? reportStart() : "";
    const totalRevenue=sum(rows,"totalRevenue"), pnlCost=sum(rows,"pnlCost"), paid=sum(rows,"paid"), debt=sum(rows,"debt");
    const body=rows.slice().reverse().map(x=>`<tr>
      <td class="daily-sticky daily-date"><strong>${dateVi(x.date)}</strong></td><td class="daily-sticky daily-day">${x.day}</td>
      <td class="money revenue-cell">${money(x.storeRevenue)}</td><td class="money revenue-cell">${money(x.appRevenue)}</td><td class="money revenue-cell total-cell">${money(x.totalRevenue)}</td>
      <td class="money revenue-cell">${money(x.cash)}</td><td class="money revenue-cell">${money(x.transferCard)}</td>
      <td class="money expense-cell">${money(x.cashSpend)}</td><td class="money expense-cell">${money(x.transferSpend)}</td><td class="money expense-cell total-cell">${money(x.paid)}</td><td class="money expense-cell">${money(x.debt)}</td>
      <td class="money cash-cell">${money(x.openingCash)}</td><td class="money cash-cell">${money(x.handover)}</td><td class="money cash-cell">${money(x.bookCash)}</td><td class="money cash-cell">${x.actualCash === null ? '—' : money(x.actualCash)}</td><td class="money cash-cell ${x.variance===0?'good':x.variance===null?'':'danger'}">${x.variance === null ? '—' : money(x.variance)}</td><td>${escapeHtml(x.note)||'—'}</td>
    </tr>`).join("");
    app.innerHTML=`<div class="kpi-grid">${kpi("Tổng doanh thu",money(totalRevenue),`${rows.length} ngày có phát sinh`,"↗","#111111")}${kpi("Chi phí P&L",money(pnlCost),"Theo giá trị hóa đơn phát sinh","↘","#e60012")}${kpi("Tiền đã chi",money(paid),"Theo nguồn tiền thanh toán","▣","#d3a447")}${kpi("Công nợ phát sinh",money(debt),"Số còn chưa thanh toán","◫","#e60012")}</div>
      <div class="panel daily-panel"><div class="panel-head"><div><h3>Bảng Tổng Hợp Ngày</h3></div><div class="daily-header-actions"><label class="daily-day-picker"><span>Xem nhanh 1 ngày</span><input id="daily-quick-date" type="date" value="${quickDay}"></label><div class="daily-legend"><span class="legend-revenue">Doanh thu</span><span class="legend-expense">Chi phí</span><span class="legend-cash">Két tiền</span></div></div></div>
      <div class="table-wrap daily-wrap"><table class="data-table daily-table"><thead><tr><th>Ngày</th><th>Thứ</th><th class="revenue-head">DT quán</th><th class="revenue-head">DT app</th><th class="revenue-head">Tổng DT</th><th class="revenue-head">Thu TM</th><th class="revenue-head">Thu CK + thẻ</th><th class="expense-head">Chi TM Quán</th><th class="expense-head">Chi CK Quán</th><th class="expense-head">Tổng chi đã TT</th><th class="expense-head">Công nợ</th><th class="cash-head">Dư TM đầu</th><th class="cash-head">Bàn giao</th><th class="cash-head">Két cuối sổ</th><th class="cash-head">Két thực tế</th><th class="cash-head">Chênh lệch</th><th>Ghi chú</th></tr></thead><tbody>${body||'<tr><td colspan="17" class="empty">Chưa có dữ liệu trong tháng này.</td></tr>'}</tbody></table></div></div>`;
    document.querySelector("#daily-quick-date").addEventListener("change",event=>{const date=event.target.value;if(!date)return;periodInput.value=date.slice(0,7);reportStartInput.value=date;reportEndInput.value=date;render();});
  }

  function renderPnl(){
    setHeader("P&L Chi phí & dòng tiền", "KIỂM SOÁT LỢI NHUẬN · DÒNG TIỀN");
    const d=periodData();
    const costs=[...d.groupMap.entries()].sort((a,b)=>b[1]-a[1]);
    const channels=[...d.channelMap.entries()].sort((a,b)=>b[1]-a[1]);
    const foodCost=d.groupMap.get(pnlGroupLabel("COGS"))||0;
    const grossProfit=d.totalRevenue-foodCost;
    const otherPnlCosts=Math.max(0,d.totalExpenses-foodCost);
    const groupPnlRows=costs.map(([group,value])=>[escapeHtml(group),money(value),pct(d.totalRevenue?value/d.totalRevenue:0),pct(d.totalExpenses?value/d.totalExpenses:0)]);
    groupPnlRows.push(["<strong>TỔNG CHI P&L</strong>",`<strong>${money(d.totalExpenses)}</strong>`,`<strong>${pct(d.totalRevenue?d.totalExpenses/d.totalRevenue:0)}</strong>`,`<strong>100%</strong>`]);
    const groupPnlPanel=`<div class="panel pnl-group-panel"><div class="panel-head"><div><h3>Chi phí theo nhóm P&L</h3><p>Giá trị, tỷ lệ trên doanh thu và cơ cấu trong tổng chi.</p></div><span class="status-chip">${costs.length} nhóm có phát sinh</span></div><div class="table-wrap">${table(["Nhóm P&L","Giá trị","% DT","% CP"],groupPnlRows,[1,2,3])}</div></div>`;
    const pnlStatementRows=[
      ["Doanh thu thuần",d.totalRevenue,"revenue"],
      ["Giá vốn hàng bán",foodCost,"cost"],
      ["Lợi nhuận gộp",grossProfit,"gross"],
      ["Chi phí P&L còn lại",otherPnlCosts,"cost"],
      ["Tổng chi P&L",d.totalExpenses,"total-cost"],
      ["Lợi nhuận thuần",d.profit,"net"],
    ];
    const pnlStatement=`<div class="panel pnl-statement-panel"><div class="panel-head"><div><h3>Báo cáo lợi nhuận nhanh</h3><p>Đọc từ trên xuống: doanh thu → giá vốn → lợi nhuận gộp → chi phí → lợi nhuận thuần.</p></div><span class="status-chip">${reportRangeLabel()}</span></div><div class="pnl-statement">${pnlStatementRows.map(([label,value,tone])=>`<div class="pnl-statement-row ${tone}"><span>${label}</span><strong>${money(value)}</strong><b>${pct(d.totalRevenue?value/d.totalRevenue:0)}</b></div>`).join("")}</div></div>`;
    const pnlGlance=`<div class="pnl-glance-bar"><div><span>Doanh thu</span><strong>${money(d.totalRevenue)}</strong></div><div><span>Giá vốn hàng bán</span><strong>${money(foodCost)}</strong><small>${pct(d.totalRevenue?foodCost/d.totalRevenue:0)} DT</small></div><div class="positive"><span>Lợi nhuận gộp</span><strong>${money(grossProfit)}</strong><small>${pct(d.totalRevenue?grossProfit/d.totalRevenue:0)} DT</small></div><div><span>Tổng chi P&L</span><strong>${money(d.totalExpenses)}</strong><small>${pct(d.totalRevenue?d.totalExpenses/d.totalRevenue:0)} DT</small></div><div class="positive"><span>Lợi nhuận thuần</span><strong>${money(d.profit)}</strong><small>${pct(d.totalRevenue?d.profit/d.totalRevenue:0)} DT</small></div></div>`;
    const cashFlowEntries=[
      ["Thu quán",d.storeRevenue],
      ["App đã về ngân hàng",d.appReceived],
      ["Chi tiền mặt",d.cashSpend],
      ["Chi chuyển khoản",d.transferSpend],
    ].filter(([,value])=>value>0);
    const totalCashMovement=d.cashIn+d.paid;
    const controlTable=table(["Chỉ tiêu kiểm soát","Giá trị","Ý nghĩa"],[
      ["Chi phí P&L ghi nhận",money(d.totalExpenses),"Tính theo ngày hóa đơn"],
      ["Lợi nhuận P&L",money(d.profit),`Biên ${pct(d.totalRevenue?d.profit/d.totalRevenue:0)}`],
      ["Công nợ phát sinh",money(d.newDebt),"Phần hóa đơn chưa trả tại ngày ghi nhận"],
      ["Công nợ còn phải trả",money(d.debt),"Số dư cần bố trí dòng tiền"],
    ],[1]);
    app.innerHTML=`<div class="kpi-grid">${kpi("Doanh thu P&L",money(d.totalRevenue),"Doanh thu gộp trong kỳ","↗","#111111")}${kpi("Tổng chi P&L",money(d.totalExpenses),"Theo hóa đơn phát sinh","↘","#e60012")}${kpi("Lợi nhuận P&L",money(d.profit),`Biên ${pct(d.totalRevenue?d.profit/d.totalRevenue:0)}`,"◔",d.profit>=0?"#e60012":"#e60012")}${kpi("Dòng tiền thuần",money(d.netCashFlow),"Tiền thực thu trừ tiền đã chi","▣",d.netCashFlow>=0?"#e60012":"#e60012")}</div>${pnlGlance}<div class="pnl-overview-grid">${pnlStatement}${groupPnlPanel}</div><div class="dashboard-grid pnl-analysis-grid">${panelDonut("Kiểm soát dòng tiền","Tiền vào thực nhận và tiền đã chi trong kỳ · tỷ lệ trên tổng luân chuyển tiền.",money(d.netCashFlow),"Dòng tiền thuần",cashFlowEntries,totalCashMovement)}${panelDonut("Cơ cấu doanh thu","Doanh thu gộp theo kênh",money(d.totalRevenue),"Doanh thu",channels,d.totalRevenue)}<div class="panel"><div class="panel-head"><div><h3>Công nợ & chi phí</h3><p>Tách bạch lợi nhuận và dòng tiền để không tính trùng</p></div></div><div class="table-wrap">${controlTable}</div></div></div>`;
  }

  function inventorySummary(){
    const categoryByCode = new Map((state.categories || []).map(item => [item.code, item]));
    const inventoryMap = new Map();
    const ensureRow = (codeValue, fallback = {}) => {
      const code = String(codeValue || "").toUpperCase();
      if (!code) return null;
      const key = code;
      const meta = ingredientStockMetaForCategory(code);
      const current = inventoryMap.get(key) || {
        code,
        itemName: fallback.itemName || categoryByCode.get(code)?.name || "",
        suppliers: new Set(),
        supplier: "",
        documentPurchaseQuantity: 0,
        documentStockQuantity: 0,
        kitchenInQuantity: 0,
        purchaseUnit: fallback.purchaseUnit || meta.purchaseUnit || "",
        quantity: 0,
        stockUnit: fallback.stockUnit || meta.stockUnit || "",
        amount: 0,
        inQuantity: 0,
        inAmount: 0,
        outQuantity: 0,
        lastDate: "",
      };
      current.itemName = current.itemName || fallback.itemName || categoryByCode.get(code)?.name || "";
      current.purchaseUnit = current.purchaseUnit || fallback.purchaseUnit || meta.purchaseUnit || "";
      current.stockUnit = current.stockUnit || fallback.stockUnit || meta.stockUnit || "";
      inventoryMap.set(key, current);
      return current;
    };
    (state.expenses || []).filter(expense => (expense.pnlGroupCode || legacyCategoryGroupCode(expense)) === "COGS").forEach(expense => {
      const row = ensureRow(expense.code, { itemName: expense.description, purchaseUnit: expense.purchaseUnit, stockUnit: expense.stockUnit });
      if (!row) return;
      const meta = ingredientStockMetaForCategory(expense.code);
      const purchaseQuantity = num(expense.purchaseQuantity !== undefined ? expense.purchaseQuantity : (expense.quantity && expense.conversionFactor ? num(expense.quantity) / num(expense.conversionFactor) : expense.quantity));
      const stockQuantity = num(expense.quantity) || purchaseQuantity * (num(expense.conversionFactor) || meta.conversionFactor || 1);
      row.documentPurchaseQuantity += purchaseQuantity;
      row.documentStockQuantity += stockQuantity;
      row.amount += num(expense.amount);
      row.inAmount += num(expense.amount);
      if (String(expense.supplier || "").trim()) row.suppliers.add(String(expense.supplier || "").trim());
      row.supplier = [...row.suppliers].join(", ");
      if (!row.lastDate || String(expense.date || "") > row.lastDate) row.lastDate = expense.date || "";
    });
    (state.inventoryMovements || []).filter(item => !item.expenseId).forEach(item => {
      const row = ensureRow(item.code, { itemName: item.itemName, purchaseUnit: item.purchaseUnit, stockUnit: item.stockUnit });
      if (!row) return;
      const meta = ingredientStockMetaForCategory(item.code);
      const purchaseUnit = item.purchaseUnit || meta.purchaseUnit || "";
      const stockUnit = item.stockUnit || meta.stockUnit || "";
      const stockQuantity = num(item.stockQuantity !== undefined ? item.stockQuantity : item.quantity);
      const purchaseQuantity = num(item.purchaseQuantity !== undefined ? item.purchaseQuantity : (item.quantity && item.conversionFactor ? num(item.quantity) / num(item.conversionFactor) : item.quantity));
      const type = String(item.type || "in");
      const sign = type === "out" ? -1 : 1;
      if (String(item.supplier || "").trim()) row.suppliers.add(String(item.supplier || "").trim());
      row.supplier = [...row.suppliers].join(", ");
      row.purchaseUnit = row.purchaseUnit || purchaseUnit;
      row.stockUnit = row.stockUnit || stockUnit;
      if (type === "in") {
        row.kitchenInQuantity += stockQuantity;
        row.inQuantity += stockQuantity;
      } else {
        row.outQuantity += Math.abs(stockQuantity);
      }
      row.quantity += sign * stockQuantity;
      if (!row.lastDate || String(item.date || "") > row.lastDate) row.lastDate = item.date || "";
    });
    return { categoryByCode, rows: [...inventoryMap.values()].sort((a,b)=>a.code.localeCompare(b.code,"vi")) };
  }

  function averageStockCostByCode(){
    const costs = new Map();
    (state.expenses || []).filter(expense => (expense.pnlGroupCode || legacyCategoryGroupCode(expense)) === "COGS").forEach(expense => {
      const code = String(expense.code || "").toUpperCase();
      if (!code) return;
      const meta = ingredientStockMetaForCategory(code);
      const current = costs.get(code) || { quantity: 0, amount: 0 };
      const purchaseQuantity = num(expense.purchaseQuantity !== undefined ? expense.purchaseQuantity : (expense.quantity && expense.conversionFactor ? num(expense.quantity) / num(expense.conversionFactor) : expense.quantity));
      const stockQuantity = num(expense.quantity) || purchaseQuantity * (num(expense.conversionFactor) || meta.conversionFactor || 1);
      current.quantity += stockQuantity;
      current.amount += num(expense.amount);
      costs.set(code, current);
    });
    return new Map([...costs.entries()].map(([code, value]) => [code, value.quantity > 0 ? value.amount / value.quantity : 0]));
  }

  function inventoryPanelHtml(){
    const { categoryByCode, rows } = inventorySummary();
    const inventoryRows = rows.map(item => [
      `<strong>${escapeHtml(item.code)}</strong>`,
      escapeHtml(item.itemName || categoryByCode.get(item.code)?.name || "—"),
      escapeHtml(item.supplier || "Không gắn NCC"),
      item.documentPurchaseQuantity > 0 ? formatQuantityWithUnit(item.documentPurchaseQuantity, item.purchaseUnit) : "—",
      item.kitchenInQuantity > 0 ? formatQuantityWithUnit(item.kitchenInQuantity, item.stockUnit) : "—",
      `<strong class="${Math.abs(num(item.kitchenInQuantity) - num(item.documentStockQuantity)) < 0.001 ? "good" : "danger"}">${formatQuantityWithUnit(num(item.kitchenInQuantity) - num(item.documentStockQuantity), item.stockUnit)}</strong>`,
      formatQuantityWithUnit(item.quantity, item.stockUnit),
      item.outQuantity > 0 ? formatQuantityWithUnit(item.outQuantity, item.stockUnit) : "—",
      money(item.inAmount),
      item.documentStockQuantity > 0 ? money(item.inAmount / item.documentStockQuantity) : "—",
      item.lastDate ? dateVi(item.lastDate) : "—",
    ]);
    return `<div class="panel"><div class="panel-head"><div><h3>Kho nguyên liệu / COGS</h3></div><span class="status-chip">${inventoryRows.length} dòng theo mã COGS</span></div><div class="table-wrap">${inventoryRows.length ? table(["Mã COGS","Sản phẩm","NCC đã mua","SL chứng từ","Bếp đã nhập","Lệch bếp-KT","Tồn khả dụng","Đã xuất","Giá trị CT","Đơn giá CT/ĐVT kho","Gần nhất"], inventoryRows, [8,9]) : '<div class="empty">Chưa có dòng kho. Khi kế toán lưu chi phí COGS hoặc bếp ghi nhập/xuất, hệ thống sẽ cập nhật tại đây.</div>'}</div></div>`;
  }

  function inventoryWastePanelHtml(){
    const avgCost = averageStockCostByCode();
    const compare = ingredientWasteComparison();
    const currentBounds = compare.current;
    const previousBounds = compare.previous;
    const inRange = (dateValue, bounds) => Boolean(dateValue && dateValue >= bounds.start && dateValue <= bounds.end);
    const rows = new Map();
    const ensure = (codeValue, itemName = "", stockUnit = "", purchaseUnit = "") => {
      const code = String(codeValue || "").toUpperCase();
      if (!code) return null;
      const meta = ingredientStockMetaForCategory(code);
      const current = rows.get(code) || { code, itemName: itemName || (state.categories || []).find(item => item.code === code)?.name || "", stockUnit: stockUnit || meta.stockUnit || "", purchaseUnit: purchaseUnit || meta.purchaseUnit || "", currentDoc: 0, currentIn: 0, currentOut: 0, previousOut: 0 };
      current.itemName = current.itemName || itemName;
      current.stockUnit = current.stockUnit || stockUnit || meta.stockUnit || "";
      current.purchaseUnit = current.purchaseUnit || purchaseUnit || meta.purchaseUnit || "";
      rows.set(code, current);
      return current;
    };
    (state.expenses || []).filter(expense => (expense.pnlGroupCode || legacyCategoryGroupCode(expense)) === "COGS" && inRange(expense.date, currentBounds)).forEach(expense => {
      const row = ensure(expense.code, expense.description, expense.stockUnit, expense.purchaseUnit);
      if (!row) return;
      const meta = ingredientStockMetaForCategory(expense.code);
      const purchaseQuantity = num(expense.purchaseQuantity !== undefined ? expense.purchaseQuantity : (expense.quantity && expense.conversionFactor ? num(expense.quantity) / num(expense.conversionFactor) : expense.quantity));
      row.currentDoc += num(expense.quantity) || purchaseQuantity * (num(expense.conversionFactor) || meta.conversionFactor || 1);
    });
    (state.inventoryMovements || []).filter(item => !item.expenseId && (inRange(item.date, currentBounds) || inRange(item.date, previousBounds))).forEach(item => {
      const row = ensure(item.code, item.itemName, item.stockUnit, item.purchaseUnit);
      if (!row) return;
      const qty = Math.abs(num(item.stockQuantity !== undefined ? item.stockQuantity : item.quantity));
      const type = String(item.type || "in");
      if (inRange(item.date, currentBounds)) {
        if (type === "out") row.currentOut += qty;
        else row.currentIn += qty;
      } else if (inRange(item.date, previousBounds) && type === "out") {
        row.previousOut += qty;
      }
    });
    const data = [...rows.values()].filter(item => item.currentDoc || item.currentIn || item.currentOut || item.previousOut);
    const totalCurrentOut = sum(data, "currentOut");
    const totalPreviousOut = sum(data, "previousOut");
    const increasedRows = data.filter(item => item.currentOut > item.previousOut && item.currentOut > 0).length;
    const chartRows = data
      .filter(item => item.currentOut || item.previousOut)
      .sort((a,b) => (b.currentOut + b.previousOut) - (a.currentOut + a.previousOut) || a.code.localeCompare(b.code, "vi"))
      .slice(0, 14);
    const maxOut = Math.max(1, ...chartRows.flatMap(item => [item.previousOut, item.currentOut]));
    const chartHtml = chartRows.length ? chartRows.map(item => {
      const previousWidth = Math.max(2, Math.min(100, item.previousOut / maxOut * 100));
      const currentWidth = Math.max(2, Math.min(100, item.currentOut / maxOut * 100));
      const diff = item.currentOut - item.previousOut;
      const diffTone = diff > 0 ? "danger" : diff < 0 ? "good" : "";
      return `<div class="nvl-compare-row">
        <div class="nvl-compare-name"><strong>${escapeHtml(item.code)}</strong><span>${escapeHtml(item.itemName || "Nguyên liệu")}</span></div>
        <div class="nvl-bar-pair">
          <div class="nvl-bar-line"><span>${escapeHtml(compare.shortPrevious)}</span><div class="nvl-bar-track"><i class="previous" style="width:${previousWidth}%"></i></div><b>${formatQuantityWithUnit(item.previousOut, item.stockUnit)}</b></div>
          <div class="nvl-bar-line"><span>${escapeHtml(compare.shortCurrent)}</span><div class="nvl-bar-track"><i class="current" style="width:${currentWidth}%"></i></div><b>${formatQuantityWithUnit(item.currentOut, item.stockUnit)}</b></div>
          <div class="nvl-bar-diff ${diffTone}">Chênh lệch: ${formatQuantityWithUnit(diff, item.stockUnit)}</div>
        </div>
      </div>`;
    }).join("") : '<div class="empty">Chưa có dữ liệu xuất/hao hụt để vẽ biểu đồ so sánh.</div>';
    const compareButtons = ["month","quarter","year"].map(mode => {
      const label = mode === "month" ? "Tháng" : mode === "quarter" ? "Quý" : "Năm";
      return `<button class="small-button ${ingredientWasteCompareMode === mode ? "active" : ""}" data-waste-compare="${mode}">${label}</button>`;
    }).join("");
    const tableRows = data
      .sort((a,b) => (b.currentOut - b.previousOut) - (a.currentOut - a.previousOut) || a.code.localeCompare(b.code, "vi"))
      .map(item => {
        const diff = item.currentOut - item.previousOut;
        const receiveGap = item.currentIn - item.currentDoc;
        const rate = item.currentIn > 0 ? item.currentOut / item.currentIn : 0;
        const tone = diff > 0 ? "danger" : diff < 0 ? "good" : "";
        return [
          `<strong>${escapeHtml(item.code)}</strong>`,
          escapeHtml(item.itemName || "—"),
          formatQuantityWithUnit(item.currentDoc, item.stockUnit),
          formatQuantityWithUnit(item.currentIn, item.stockUnit),
          `<strong class="${Math.abs(receiveGap) < 0.001 ? "good" : "danger"}">${formatQuantityWithUnit(receiveGap, item.stockUnit)}</strong>`,
          formatQuantityWithUnit(item.previousOut, item.stockUnit),
          formatQuantityWithUnit(item.currentOut, item.stockUnit),
          `<strong class="${tone}">${formatQuantityWithUnit(diff, item.stockUnit)}</strong>`,
          pct(rate),
        ];
      });
    return `<div class="kpi-grid">${kpi("Xuất/hao hụt kỳ này",formatQuantityWithUnit(totalCurrentOut, ""),compare.current.label,"↘","#e60012")}${kpi("Kỳ trước",formatQuantityWithUnit(totalPreviousOut, ""),compare.previous.label,"◔","#111111")}${kpi("Chênh lệch",formatQuantityWithUnit(totalCurrentOut-totalPreviousOut, ""),`${increasedRows} mã tăng so với kỳ trước`,"!","#e60012")}${kpi("Phạm vi",compare.mode === "month" ? "Theo tháng" : compare.mode === "quarter" ? "Theo quý" : "Theo năm","Không đưa vào P&L tổng","◎","#111111")}</div><div class="panel"><div class="panel-head"><div><h3>Biểu đồ tiêu hao NVL</h3><p>So sánh ${escapeHtml(compare.previous.label)} với ${escapeHtml(compare.current.label)} theo từng nguyên liệu. Dùng để nhìn nhanh mã nào tháng/quý/năm này hao nhiều hơn kỳ trước.</p></div><div class="inline-actions">${compareButtons}</div></div><div class="nvl-compare-chart">${chartHtml}</div></div><div class="panel"><div class="panel-head"><div><h3>Hao hụt / tiêu hao nguyên vật liệu</h3><p>Bảng này dành cho bếp trưởng: đối chiếu chứng từ kế toán, bếp nhập và lượng xuất/hao hụt giữa ${escapeHtml(compare.previous.label)} và ${escapeHtml(compare.current.label)}. Không cộng vào P&amp;L tổng.</p></div><span class="status-chip">${tableRows.length} mã NVL</span></div><div class="table-wrap">${tableRows.length ? table(["Mã","Nguyên liệu","SL chứng từ KT","Bếp nhập","Lệch nhập",`Xuất ${compare.shortPrevious}`,`Xuất ${compare.shortCurrent}`,"Tăng/giảm","% xuất/nhập"], tableRows) : '<div class="empty">Chưa có dữ liệu kho bếp để so sánh hao hụt.</div>'}</div></div>`;
  }

  function renderIngredients(){
    setHeader("Nguyên liệu", "KHO · GIÁ VỐN MÓN · ĐỊNH LƯỢNG BẾP");
    if (!["stock", "kitchen"].includes(materialTab)) materialTab = "stock";
    const tabs = `<div class="catalog-tabs"><button class="tab ${materialTab==='stock'?'active':''}" data-material-tab="stock">Kho</button><button class="tab ${materialTab==='kitchen'?'active':''}" data-material-tab="kitchen">Nhập liệu bếp</button></div>`;
    app.innerHTML = `${tabs}${materialTab === "stock" ? inventoryPanelHtml() : kitchenInventoryPanelHtml()}`;
    document.querySelectorAll("[data-material-tab]").forEach(button => button.addEventListener("click", () => { materialTab = button.dataset.materialTab; render(); }));
    const kitchenForm = document.querySelector("#kitchen-stock-form");
    if (kitchenForm) {
      const syncKitchenPreview = () => {
        const meta = ingredientStockMetaForCategory(kitchenForm.querySelector("[name='code']")?.value);
        const quantity = num(kitchenForm.querySelector("[name='quantity']")?.value);
        const unitInput = kitchenForm.querySelector("[name='unitPreview']");
        if (unitInput) unitInput.value = meta.stockUnit || "";
        const preview = kitchenForm.querySelector("#kitchen-stock-preview");
        if (preview) preview.textContent = formatQuantityWithUnit(quantity, meta.stockUnit || "");
      };
      kitchenForm.addEventListener("submit", handleKitchenStockSubmit);
      kitchenForm.addEventListener("input", syncKitchenPreview);
      kitchenForm.addEventListener("change", syncKitchenPreview);
      syncKitchenPreview();
    }
    document.querySelector("[data-recipe-add]")?.addEventListener("click", () => openRecipeEditor());
    document.querySelectorAll("[data-recipe-edit]").forEach(button => button.addEventListener("click", () => openRecipeEditor(button.dataset.recipeEdit)));
    document.querySelectorAll("[data-recipe-delete]").forEach(button => button.addEventListener("click", () => deleteRecipe(button.dataset.recipeDelete)));
    document.querySelectorAll("[data-inventory-movement-edit]").forEach(button => button.addEventListener("click", () => openKitchenMovementEditor(button.dataset.inventoryMovementEdit)));
    document.querySelectorAll(".ingredient-toggle").forEach(btn=>btn.addEventListener("click",()=>{const list=btn.nextElementSibling;list.classList.toggle("open");btn.textContent=list.classList.contains("open")?"Ẩn nguyên liệu ↑":"Xem định lượng nguyên liệu ↓";}));
  }

  function renderIngredientWaste(){
    setHeader("Hao hụt NVL", "KHO HÀNG · KIỂM SOÁT TIÊU HAO BẾP");
    app.innerHTML = inventoryWastePanelHtml();
    document.querySelectorAll("[data-waste-compare]").forEach(button => button.addEventListener("click", () => {
      ingredientWasteCompareMode = button.dataset.wasteCompare || "month";
      render({ preserveScroll: true });
    }));
  }

  function stockCategoryOptions(selectedCode = ""){
    const categories = sortCategories((state.categories || []).filter(item => (item.pnlGroupCode || legacyCategoryGroupCode(item)) === "COGS"));
    return categories.map(category => {
      const meta = ingredientStockMetaForCategory(category.code);
      const label = `${category.code} · ${category.name}${meta.stockUnit ? ` · tồn theo ${meta.stockUnit}` : ""}`;
      return `<option value="${escapeHtml(category.code)}" ${category.code===selectedCode?"selected":""}>${escapeHtml(label)}</option>`;
    }).join("");
  }

  function kitchenInventoryPanelHtml(){
    const movements = newestFirst((state.inventoryMovements || []).filter(item => inReportRange(item.date) && !item.expenseId), item => item.date || "");
    const movementRows = table(["Ngày","Nghiệp vụ","Mã","Nguyên liệu","SL kho","Ghi chú","Thao tác"], movements.slice(0,120).map(item => [
      dateVi(item.date),
      item.type === "out" ? '<span class="pill red">Xuất bếp</span>' : '<span class="pill green">Nhập/điều chỉnh</span>',
      `<strong>${escapeHtml(item.code || "—")}</strong>`,
      escapeHtml(item.itemName || "—"),
      `<strong class="${item.type === "out" ? "danger" : "good"}">${item.type === "out" ? "-" : "+"}${formatQuantityWithUnit(Math.abs(num(item.stockQuantity ?? item.quantity)), item.stockUnit || "")}</strong>`,
      escapeHtml(item.note || "—"),
      `<button class="small-button" type="button" data-inventory-movement-edit="${escapeHtml(item.id)}">Sửa</button>`,
    ]));
    const form = `<div class="panel form-panel"><div class="panel-head"><div><h3>Nhập liệu kho bếp</h3></div></div><form id="kitchen-stock-form"><div class="form-grid">${field("Ngày","date","date",localToday())}<div class="field"><label>Nghiệp vụ</label><select name="type"><option value="in">Bếp xác nhận nhập kho</option><option value="out">Xuất dùng / hao hụt / kiểm kê giảm</option></select></div><div class="field full"><label>Nguyên liệu / mã COGS</label><select name="code">${stockCategoryOptions()}</select></div><div class="field"><label>Số lượng theo ĐVT kho</label><input name="quantity" type="number" min="0" step="0.001" value="" placeholder="Ví dụ: 1000 nếu tồn theo g/ml"></div><div class="field"><label>ĐVT kho</label><input name="unitPreview" type="text" value="" placeholder="Tự theo quy chuẩn NVL" readonly></div>${field("Ghi chú","note","text","","Ví dụ: Nhận hàng theo phiếu / xuất làm sốt ca tối",true)}</div><div class="calc-box"><span>Số lượng sẽ ghi vào kho</span><strong id="kitchen-stock-preview">0</strong></div><div class="form-actions"><button class="primary-button" data-inventory-movement-add>Ghi vào kho</button></div></form></div>`;
    const content = `<div class="panel"><div class="panel-head"><div><h3>Lịch sử nhập/xuất bếp</h3><p>${movements.length} dòng bếp tự ghi trong kỳ. Dòng từ phiếu chi kế toán được xem tại tab Kho.</p></div></div><div class="table-wrap">${movementRows}</div></div>`;
    return sectionWithForm(form, content, "compact-form-layout");
  }

  function handleKitchenStockSubmit(event){
    event.preventDefault();
    if (!canManageKitchen()) { toast("Chỉ Kế toán hoặc Bếp được ghi/sửa nhập xuất kho"); return; }
    const form = event.currentTarget;
    const fd = new FormData(form);
    const code = String(fd.get("code") || "").trim().toUpperCase();
    const category = (state.categories || []).find(item => item.code === code);
    const quantity = num(fd.get("quantity"));
    if (!category) { toast("Vui lòng chọn nguyên liệu/mã COGS"); return; }
    if (quantity <= 0) { toast("Số lượng kho phải lớn hơn 0"); return; }
    const type = fd.get("type") === "out" ? "out" : "in";
    const meta = ingredientStockMetaForCategory(code);
    state.inventoryMovements.push({
      id: uid(type === "out" ? "stock-out" : "stock-adjust"),
      date: fd.get("date") || localToday(),
      type,
      code,
      itemName: category.name,
      supplier: "",
      purchaseQuantity: 0,
      purchaseUnit: "",
      stockQuantity: quantity,
      quantity,
      stockUnit: meta.stockUnit || "",
      conversionFactor: meta.conversionFactor || 1,
      ingredientId: meta.ingredientId || "",
      amount: 0,
      unitCost: 0,
      note: String(fd.get("note") || "").trim(),
      createdAt: Date.now(),
      source: "Bếp ghi kho",
    });
    persist();
    toast(type === "out" ? "Đã ghi xuất kho bếp" : "Đã ghi nhập/điều chỉnh kho bếp");
    render({ preserveScroll: true });
  }

  function openKitchenMovementEditor(movementId = ""){
    const movement = (state.inventoryMovements || []).find(item => item.id === movementId && !item.expenseId);
    if (!movement) { toast("Không tìm thấy dòng kho bếp cần sửa"); return; }
    const meta = ingredientStockMetaForCategory(movement.code);
    const quantity = Math.abs(num(movement.stockQuantity ?? movement.quantity));
    modalContent.innerHTML = `<h2>Sửa nhập liệu kho bếp</h2><p>Chỉ sửa ngày, số lượng và ghi chú của dòng bếp tự ghi. Dòng tự sinh từ phiếu chi kế toán phải sửa từ chứng từ chi phí.</p><form id="kitchen-movement-edit-form"><div class="form-grid"><div class="field"><label>Nghiệp vụ</label><input type="text" value="${movement.type === "out" ? "Xuất bếp / hao hụt" : "Nhập kho bếp / kiểm kê tăng"}" readonly></div><div class="field"><label>Mã nguyên liệu</label><input type="text" value="${escapeHtml(movement.code || "—")}" readonly></div><div class="field full"><label>Nguyên liệu</label><input type="text" value="${escapeHtml(movement.itemName || "—")}" readonly></div>${field("Ngày ghi kho","date","date",movement.date || localToday())}<div class="field"><label>Số lượng theo ĐVT kho</label><input name="quantity" type="number" min="0" step="0.001" value="${escapeHtml(quantity)}" placeholder="Ví dụ: 1000"></div><div class="field"><label>ĐVT kho</label><input type="text" value="${escapeHtml(movement.stockUnit || meta.stockUnit || "")}" readonly></div>${field("Ghi chú","note","text",movement.note || "","Ví dụ: Sửa ngày kiểm kê / sửa số lượng",true)}</div><div class="calc-box"><span>Số lượng sau sửa</span><strong id="kitchen-edit-preview">${formatQuantityWithUnit(quantity, movement.stockUnit || meta.stockUnit || "")}</strong></div><div class="form-actions"><button class="primary-button">Lưu chỉnh sửa</button></div></form>`;
    openModal();
    const form = document.querySelector("#kitchen-movement-edit-form");
    const syncPreview = () => {
      const nextQuantity = num(form.querySelector("[name='quantity']")?.value);
      const preview = form.querySelector("#kitchen-edit-preview");
      if (preview) preview.textContent = formatQuantityWithUnit(nextQuantity, movement.stockUnit || meta.stockUnit || "");
    };
    form.addEventListener("input", syncPreview);
    form.addEventListener("submit", event => {
      event.preventDefault();
      const fd = new FormData(form);
      const nextQuantity = num(fd.get("quantity"));
      if (nextQuantity <= 0) { toast("Số lượng kho phải lớn hơn 0"); return; }
      movement.date = fd.get("date") || localToday();
      movement.stockQuantity = nextQuantity;
      movement.quantity = nextQuantity;
      movement.note = String(fd.get("note") || "").trim();
      movement.updatedAt = Date.now();
      persist();
      closeModal();
      toast("Đã sửa dòng nhập liệu kho bếp");
      render({ preserveScroll: true });
    });
  }

  function recipeCost(recipe){
    if (Array.isArray(recipe.sizes) && recipe.sizes.length) {
      const selected = recipe.sizes[1] || recipe.sizes[0];
      return { total: num(selected.cost), price: num(selected.price), margin: num(selected.margin) };
    }
    const avgCost = averageStockCostByCode();
    const lines = recipe.lines || [];
    const total = sum(lines, line => num(line.quantity) * num(avgCost.get(String(line.code || "").toUpperCase())));
    const price = num(recipe.price);
    return { total, margin: price > 0 ? (price - total) / price : 0 };
  }

  function recipeCostPanelHtml(){
    const recipes = Array.isArray(state.menuRecipes) ? state.menuRecipes : [];
    const avgCost = averageStockCostByCode();
    const recipeCards = recipes.map(recipe => {
      const cost = recipeCost(recipe);
      const lineHtml = (recipe.lines || []).map(line => {
        if (line.qty4 !== undefined || line.cost4 !== undefined) {
          return `<div class="ingredient-line recipe-cost-line"><span>${escapeHtml(line.name || "—")}</span><b>${fmt.format(num(line.qty4))}/${fmt.format(num(line.qty6))}/${fmt.format(num(line.qty8))} ${escapeHtml(line.unit || "")}</b><small>${money(line.cost4)} · ${money(line.cost6)} · ${money(line.cost8)}</small></div>`;
        }
        const category = (state.categories || []).find(item => item.code === line.code);
        const unitCost = num(avgCost.get(String(line.code || "").toUpperCase()));
        return `<div class="ingredient-line"><span>${escapeHtml(category?.name || line.name || line.code)} · ${formatQuantityWithUnit(line.quantity, line.unit)}</span><b>${money(num(line.quantity) * unitCost)}</b></div>`;
      }).join("");
      const sizeHtml = Array.isArray(recipe.sizes) && recipe.sizes.length
        ? recipe.sizes.map(size => sizeBox(size.label, size.cost, size.price, size.margin)).join("")
        : sizeBox("Giá cost", cost.total, recipe.price, cost.margin);
      const editButton = Array.isArray(recipe.sizes) && recipe.sizes.length ? "" : `<button class="small-button" data-recipe-edit="${escapeHtml(recipe.id)}">Sửa công thức</button>`;
      return `<div class="menu-card"><div class="menu-card-head"><div><h3>${escapeHtml(recipe.name)}</h3><p>${(recipe.lines || []).length} nguyên liệu trong công thức${recipe.sourceFile ? ` · ${escapeHtml(recipe.sourceFile)}` : ""}</p></div><div class="margin-badge">${pct(cost.margin)}<span>BIÊN LN</span></div></div><div class="size-costs">${sizeHtml}</div><div class="ingredient-list open">${lineHtml || '<div class="empty">Chưa có định lượng.</div>'}</div><div class="inline-actions">${editButton}<button class="small-button danger-button" data-recipe-delete="${escapeHtml(recipe.id)}">Xóa</button></div></div>`;
    }).join("");
    const legacyCards = recipes.length ? "" : `<div class="welcome"><div><h2>Chưa có công thức cost tự động</h2><p>Bấm “Thêm công thức món”, chọn nguyên liệu và nhập định lượng. Hệ thống sẽ lấy đơn giá bình quân từ Kho để tính cost.</p></div></div>${(state.menuItems || []).length ? `<div class="cost-grid">${state.menuItems.map(menuCard).join("")}</div>` : ""}`;
    return `<div class="panel"><div class="panel-head"><div><h3>Công thức Cost món</h3><p>Công thức nhập tay lấy giá bình quân từ Kho; các món mẫu đang hiển thị theo bảng cost 4/6/8 bánh.</p></div><button class="primary-button" data-recipe-add>＋ Thêm công thức món</button></div></div>${legacyCards}<div class="cost-grid">${recipeCards}</div>`;
  }

  function openRecipeEditor(recipeId = ""){
    const recipe = (state.menuRecipes || []).find(item => item.id === recipeId);
    const value = recipe || { id: "", name: "", price: 0, lines: [{ code: "", quantity: 0 }] };
    const lineHtml = (value.lines || [{ code: "", quantity: 0 }]).map(line => recipeLineHtml(line)).join("");
    modalContent.innerHTML = `<h2>${recipe ? "Sửa công thức món" : "Thêm công thức món"}</h2><p>Chọn nguyên liệu/mã COGS và nhập định lượng theo ĐVT kho. Giá cost sẽ tự lấy từ đơn giá bình quân trong kho.</p><form id="recipe-form"><div class="form-grid">${field("Tên món","name","text",value.name,"Ví dụ: Takoyaki truyền thống",true)}${field("Giá bán tham chiếu","price","number",value.price || "0","0")}<div class="field full"><label>Định lượng nguyên liệu</label><div id="recipe-lines" class="recipe-lines">${lineHtml}</div><button type="button" class="outline-button" id="add-recipe-line">＋ Thêm nguyên liệu</button></div></div><div class="calc-box"><span>Cost món tạm tính</span><strong id="recipe-cost-preview">0 ₫</strong></div><div class="form-actions"><button class="primary-button">${recipe ? "Lưu công thức" : "Thêm công thức"}</button></div></form>`;
    if (!openModal({ kitchenAllowed: true })) return;
    const form = document.querySelector("#recipe-form");
    const lineContainer = form.querySelector("#recipe-lines");
    const update = () => {
      const avgCost = averageStockCostByCode();
      const total = [...lineContainer.querySelectorAll("[data-recipe-line]")].reduce((totalValue, line) => totalValue + num(line.querySelector("[name='lineQuantity']").value) * num(avgCost.get(line.querySelector("[name='lineCode']").value)), 0);
      form.querySelector("#recipe-cost-preview").textContent = money(total);
    };
    form.querySelector("#add-recipe-line").addEventListener("click", () => { lineContainer.insertAdjacentHTML("beforeend", recipeLineHtml()); update(); });
    lineContainer.addEventListener("click", event => { const button = event.target.closest("[data-remove-recipe-line]"); if (!button) return; if (lineContainer.querySelectorAll("[data-recipe-line]").length === 1) return; button.closest("[data-recipe-line]").remove(); update(); });
    const syncRecipeUnits = () => {
      lineContainer.querySelectorAll("[data-recipe-line]").forEach(line => {
        const meta = ingredientStockMetaForCategory(line.querySelector("[name='lineCode']")?.value);
        const unit = line.querySelector(".expense-line-unit");
        if (unit) unit.textContent = meta.stockUnit || "ĐVT";
      });
    };
    lineContainer.addEventListener("input", update);
    lineContainer.addEventListener("change", () => { syncRecipeUnits(); update(); });
    syncRecipeUnits();
    update();
    form.addEventListener("submit", event => {
      event.preventDefault();
      const fd = new FormData(form);
      const name = String(fd.get("name") || "").trim();
      const price = num(fd.get("price"));
      const lines = [...lineContainer.querySelectorAll("[data-recipe-line]")].map(line => {
        const code = String(line.querySelector("[name='lineCode']").value || "").trim().toUpperCase();
        const category = (state.categories || []).find(item => item.code === code);
        const meta = ingredientStockMetaForCategory(code);
        return { code, name: category?.name || "", quantity: num(line.querySelector("[name='lineQuantity']").value), unit: meta.stockUnit || "" };
      }).filter(line => line.code && line.quantity > 0);
      if (!name || !lines.length) { toast("Vui lòng nhập tên món và ít nhất một nguyên liệu có định lượng"); return; }
      const saved = recipe || { id: uid("recipe"), createdAt: Date.now() };
      Object.assign(saved, { name, price, lines, updatedAt: Date.now() });
      if (!recipe) state.menuRecipes.push(saved);
      persist(); closeModal(); toast("Đã lưu công thức cost món"); render({ preserveScroll: true });
    });
  }

  function recipeLineHtml(line = {}){
    const meta = ingredientStockMetaForCategory(line.code);
    return `<div class="expense-line recipe-line" data-recipe-line><select name="lineCode">${stockCategoryOptions(line.code || "")}</select><input name="lineQuantity" type="number" min="0" step="0.001" value="${escapeHtml(line.quantity || "")}" placeholder="SL"><span class="expense-line-unit">${escapeHtml(line.unit || meta.stockUnit || "ĐVT")}</span><button type="button" class="small-button danger-button" data-remove-recipe-line>×</button></div>`;
  }

  function findRecipeCategoryByCsvName(name){
    const target = normalizeCatalogText(name);
    if (!target) return null;
    const candidates = (state.categories || []).filter(category => (category.pnlGroupCode || legacyCategoryGroupCode(category)) === "COGS");
    return candidates.find(category => normalizeCatalogText(category.name).includes(target))
      || candidates.find(category => {
        const categoryMainName = normalizeCatalogText(String(category.name || "").split("·")[0]);
        return categoryMainName && (target.includes(categoryMainName) || categoryMainName.includes(target));
      })
      || null;
  }

  function deleteRecipe(recipeId){
    if (!canManageKitchen()) { toast("Chỉ Kế toán hoặc Bếp được sửa Cost món"); return; }
    const recipe = (state.menuRecipes || []).find(item => item.id === recipeId);
    if (!recipe) return;
    if (!window.confirm(`Xóa công thức “${recipe.name}”?`)) return;
    state.menuRecipes = (state.menuRecipes || []).filter(item => item.id !== recipeId);
    persist();
    toast("Đã xóa công thức món");
    render({ preserveScroll: true });
  }
  function renderCost(){
    setHeader("Cost món", "KHO HÀNG · ĐỊNH LƯỢNG & GIÁ VỐN MÓN");
    app.innerHTML = recipeCostPanelHtml();
    document.querySelector("[data-recipe-add]")?.addEventListener("click", () => openRecipeEditor());
    document.querySelectorAll("[data-recipe-edit]").forEach(button => button.addEventListener("click", () => openRecipeEditor(button.dataset.recipeEdit)));
    document.querySelectorAll("[data-recipe-delete]").forEach(button => button.addEventListener("click", () => deleteRecipe(button.dataset.recipeDelete)));
    document.querySelectorAll(".ingredient-toggle").forEach(btn=>btn.addEventListener("click",()=>{const list=btn.nextElementSibling;list.classList.toggle("open");btn.textContent=list.classList.contains("open")?"Ẩn nguyên liệu ↑":"Xem định lượng nguyên liệu ↓";}));
  }
  function menuCard(item){const best=Math.max(item.margin4,item.margin6,item.margin8);return `<div class="menu-card"><div class="menu-card-head"><div><h3>${escapeHtml(item.name)}</h3><p>${item.ingredients.length} thành phần</p></div><div class="margin-badge">${pct(best)}<span>BIÊN LN</span></div></div><div class="size-costs">${sizeBox("4 bánh",item.cost4,item.price4,item.margin4)}${sizeBox("6 bánh",item.cost6,item.price6,item.margin6)}${sizeBox("8 bánh",item.cost8,item.price8,item.margin8)}</div><button class="ingredient-toggle">Xem định lượng nguyên liệu ↓</button><div class="ingredient-list">${item.ingredients.map(x=>`<div class="ingredient-line"><span>${escapeHtml(x.name)}</span><b>${fmt.format(x.qty4)} / ${fmt.format(x.qty6)} / ${fmt.format(x.qty8)} ${escapeHtml(x.unit)}</b></div>`).join("")}</div></div>`;}
  const sizeBox=(label,cost,price,margin)=>`<div class="size-box"><span>${label}</span><strong>${money(cost)}</strong><small>Giá bán ${money(price)}</small><small class="good">LN ${pct(margin)}</small></div>`;

  const nextCategoryCode = (pnlGroupCode) => {
    const prefix = String(pnlGroupCode || "OTHER").toUpperCase();
    const suffixes = (state.categories || []).map(item => {
      const match = String(item.code || "").toUpperCase().match(new RegExp(`^${prefix}-(\\d{3,})$`));
      return match ? Number(match[1]) : 0;
    });
    return `${prefix}-${String(Math.max(0, ...suffixes) + 1).padStart(3, "0")}`;
  };
  const nextIngredientCode = () => nextCategoryCode("COGS");
  const UNIT_SUGGESTIONS = ["kg", "g", "l", "ml", "chai", "lon", "quả", "cái", "bó", "hộp", "túi", "thùng", "suất"];
  const unitDatalist = (id) => `<datalist id="${id}">${UNIT_SUGGESTIONS.map(unit => `<option value="${escapeHtml(unit)}"></option>`).join("")}</datalist>`;
  const ingredientDisplayName = (ingredient) => [ingredient?.name, ingredient?.specification].map(value => String(value || "").trim()).filter(Boolean).join(" · ");
  const nextIngredientSkuCode = () => {
    const used = new Set((state.ingredients || []).map(item => String(item.code || "").trim().toUpperCase()).filter(Boolean));
    let index = 1;
    while (used.has(`NVL-${String(index).padStart(3, "0")}`)) index += 1;
    return `NVL-${String(index).padStart(3, "0")}`;
  };
  const findIngredientById = (id) => (state.ingredients || []).find(item => item.id === id);
  const ingredientForCategory = (code) => {
    const category = (state.categories || []).find(item => item.code === code);
    if (!category) return null;
    const linked = findIngredientById(category.ingredientId);
    if (linked) return linked;
    const normalizedName = normalizeCatalogText(category.name);
    return (state.ingredients || []).find(item => normalizeCatalogText(ingredientDisplayName(item)) === normalizedName || normalizeCatalogText(item.name) === normalizedName) || null;
  };
  const ingredientStockMetaForCategory = (code) => {
    const ingredient = ingredientForCategory(code);
    const conversionFactor = Math.max(0, num(ingredient?.conversionFactor) || 1);
    return {
      ingredientId: ingredient?.id || "",
      ingredientCode: ingredient?.code || "",
      purchaseUnit: ingredient?.purchaseUnit || "",
      stockUnit: ingredient?.stockUnit || ingredient?.purchaseUnit || "",
      conversionFactor,
      trackStock: ingredient ? ingredient.trackStock !== false : true,
    };
  };
  const formatQuantityWithUnit = (quantity, unit) => `${fmt.format(num(quantity))}${unit ? ` ${escapeHtml(unit)}` : ""}`;
  const OBSERVER_HIDDEN_CATALOG_TABS = new Set(["assets", "employees"]);

  function catalogTabs() {
    const privateTabs = canManage()
      ? `<button class="tab ${catalogTab==='assets'?'active':''}" data-tab="assets">Tài sản & khấu hao</button><button class="tab ${catalogTab==='employees'?'active':''}" data-tab="employees">Nhân sự</button>`
      : "";
    return `<div class="catalog-tabs"><button class="tab ${catalogTab==='categories'?'active':''}" data-tab="categories">Mã chi</button><button class="tab ${catalogTab==='pnl-groups'?'active':''}" data-tab="pnl-groups">Nhóm P&L chuẩn</button><button class="tab ${catalogTab==='ingredients'?'active':''}" data-tab="ingredients">Quy chuẩn NVL</button><button class="tab ${catalogTab==='suppliers'?'active':''}" data-tab="suppliers">Nhà cung cấp</button>${privateTabs}</div>`;
  }

  const assetNameFromPurchase = (purchase) => String(purchase?.description || "")
    .replace(/^Đầu tư\s+/i, "").replace(/\s*\(CAPEX[^)]*\)\s*/ig, "").trim() || "Tài sản mới";
  const fixedAssets = () => Array.isArray(state.fixedAssets) ? state.fixedAssets : [];
  const depreciationRecordsForAsset = (asset) => (state.expenses || []).filter(item => item.depreciationAssetKey === fixedAssetKey(asset));

  function openFixedAssetEditor(assetId = "", purchaseId = ""){
    const asset = fixedAssets().find(item => item.id === assetId);
    const purchase = (state.expenses || []).find(item => item.id === (asset?.purchaseExpenseId || purchaseId));
    if (!asset && !purchase) { toast("Không tìm thấy chứng từ đầu tư tài sản"); return; }
    const name = asset?.name || assetNameFromPurchase(purchase);
    const depreciationCategories = (state.categories || []).filter(item => (item.pnlGroupCode || legacyCategoryGroupCode(item)) === "DEP");
    const selectedCategory = asset?.depreciationCategoryCode || "";
    const purchaseInfo = purchase ? `${dateVi(purchase.date)} · ${purchase.invoice || "Không có mã hóa đơn"} · ${money(purchase.amount)}` : "Chứng từ mua đã được lưu trước đó";
    modalContent.innerHTML=`<h2>${asset ? "Sửa thiết lập khấu hao" : "Thiết lập khấu hao tài sản"}</h2><p>Tiền mua tài sản chỉ được ghi nhận một lần ở CAPEX. Phần dưới chỉ tạo chi phí khấu hao P&amp;L hàng tháng, không tạo chi tiền hoặc công nợ NCC.</p><form id="fixed-asset-form"><div class="form-grid">${field("Tên tài sản","name","text",name)}${field("Ngày bắt đầu khấu hao","acquisitionDate","date",asset?.acquisitionDate || purchase?.date || localToday())}${field("Nguyên giá","cost","number",asset?.cost ?? purchase?.amount ?? "0","0")}<div class="field"><label>Số tháng khấu hao</label><input name="usefulLifeMonths" type="number" min="1" step="1" value="${escapeHtml(asset?.usefulLifeMonths || "24")}" placeholder="Ví dụ: 24"></div><div class="field"><label>Mã chi phí khấu hao</label><select name="depreciationCategoryCode"><option value="">Tự tạo mã DEP theo tên tài sản</option>${depreciationCategories.map(category=>`<option value="${escapeHtml(category.code)}" ${category.code===selectedCategory?"selected":""}>${escapeHtml(category.code)} · ${escapeHtml(category.name)}</option>`).join("")}</select></div>${field("Giá trị thu hồi","residualValue","number",asset?.residualValue ?? "0","0")}<div class="field full"><label>Chứng từ đầu tư đã liên kết</label><div class="calc-box"><span>${escapeHtml(purchase?.description || name)}</span><strong>${escapeHtml(purchaseInfo)}</strong></div></div></div><p class="form-hint">Ví dụ nguyên giá 20.000.000 ₫ và 24 tháng sẽ trích 833.333 ₫/tháng; phần chênh lẻ sẽ tự cộng vào tháng cuối để tổng khấu hao khớp nguyên giá.</p><div class="form-actions"><button class="primary-button">${asset ? "Lưu và cập nhật lịch khấu hao" : "Tạo lịch khấu hao"}</button></div></form>`;
    openModal();
    document.querySelector("#fixed-asset-form").addEventListener("submit", event => {
      event.preventDefault();
      const fd = new FormData(event.currentTarget);
      const assetName = String(fd.get("name") || "").trim();
      const cost = num(fd.get("cost")), usefulLifeMonths = Math.floor(num(fd.get("usefulLifeMonths"))), residualValue = num(fd.get("residualValue"));
      if (!assetName || !fd.get("acquisitionDate") || cost <= 0 || usefulLifeMonths <= 0 || residualValue < 0 || residualValue >= cost) { toast("Kiểm tra tên tài sản, ngày bắt đầu, nguyên giá, giá trị thu hồi và số tháng khấu hao"); return; }
      let category = (state.categories || []).find(item => item.code === fd.get("depreciationCategoryCode"));
      if (!category) category = ensureDepreciationCategory(assetName);
      if (category.pnl !== true) category.pnl = true;
      if (!Array.isArray(state.fixedAssets)) state.fixedAssets = [];
      const saved = asset || { id: uid("asset"), createdAt: Date.now(), key: uid("asset-key") };
      Object.assign(saved, { name: assetName, acquisitionDate: fd.get("acquisitionDate"), cost, usefulLifeMonths, residualValue, depreciationCategoryCode: category.code, categoryCode: category.code, purchaseExpenseId: purchase?.id || asset?.purchaseExpenseId || "", active: true });
      if (!asset) state.fixedAssets.push(saved);
      if (purchase) { purchase.fixedAssetId = saved.id; purchase.operation = "Đầu tư tài sản (CAPEX)"; purchase.pnl = false; }
      syncFixedAssetDepreciation(saved);
      persist(); closeModal(); toast("Đã lưu tài sản và tạo lịch khấu hao"); render({preserveScroll:true});
    });
  }

  function renderCatalog(){
    setHeader("Danh mục hệ thống", "CẤU HÌNH & DỮ LIỆU GỐC");
    if (!canManage() && OBSERVER_HIDDEN_CATALOG_TABS.has(catalogTab)) catalogTab = "categories";
    const tabs = catalogTabs();
    const sortedCategories = sortCategories(state.categories || []);
    const visibleCategories = catalogPnlFilter ? sortedCategories.filter(category => (category.pnlGroupCode || legacyCategoryGroupCode(category)) === catalogPnlFilter) : sortedCategories;
    const pnlFilterOptions = `<option value="">Tất cả nhóm P&L</option>${PNL_GROUPS.map(group=>`<option value="${escapeHtml(group.code)}" ${catalogPnlFilter===group.code?"selected":""}>${escapeHtml(group.code)} · ${escapeHtml(group.name)}</option>`).join("")}`;
    const manageCatalog = canManage();
    const readonlyAction = "—";
    const categoryBody = table(["Mã chi","Diễn giải","NCC hay dùng","Nhóm P&L","Nhập tại","Tính P&L","Thao tác"],visibleCategories.map(x=>[
      `<strong>${escapeHtml(x.code)}</strong>`,escapeHtml(x.name),escapeHtml(supplierForCategory(x.code) || "—"),escapeHtml(x.group),x.payrollOnly?'<span class="pill green">Chi trả lương</span>':'<span class="pill gray">Chi phí</span>',x.pnl?'<span class="pill green">Có</span>':'<span class="pill gray">Không</span>',
      manageCatalog ? `<div class="inline-actions"><button class="small-button" data-category-edit="${escapeHtml(x.code)}">Sửa</button><button class="small-button danger-button" data-category-delete="${escapeHtml(x.code)}">Xóa</button></div>` : readonlyAction
    ]));
    const ingredientBody = table(["Mã NVL","Tên NVL","Quy cách","ĐVT nhập","Quy đổi","ĐVT kho","Theo dõi kho","Thao tác"],(state.ingredients||[]).map((x,index)=>[
      `<strong>${escapeHtml(x.code || "—")}</strong>`,
      `<strong>${escapeHtml(x.name)}</strong>${x.supplier ? `<br><small>Gợi ý NCC: ${escapeHtml(x.supplier)}</small>` : ""}`,
      escapeHtml(x.specification || "—"),
      escapeHtml(x.purchaseUnit || "—"),
      x.conversionFactor ? fmt.format(num(x.conversionFactor)) : "—",
      escapeHtml(x.stockUnit || "—"),
      x.trackStock === false ? '<span class="pill neutral">Không</span>' : '<span class="pill green">Có</span>',
      manageCatalog ? `<div class="inline-actions"><button class="small-button" data-ingredient-code="${index}">Tạo mã chi</button><button class="small-button" data-ingredient-edit="${index}">Sửa</button><button class="small-button danger-button" data-ingredient-delete="${index}">Xóa</button></div>` : readonlyAction
    ]));
    const categoryPanel = `<div class="panel"><div class="panel-head"><div><h3>Danh mục mã chi</h3><p>${visibleCategories.length}/${sortedCategories.length} mã chi${catalogPnlFilter?` thuộc nhóm ${escapeHtml(pnlGroupLabel(catalogPnlFilter))}`:""} · ${manageCatalog ? "Thêm, sửa, xóa từng mã. Thay đổi chỉ áp dụng cho giao dịch nhập sau đó." : "Chế độ quan sát chỉ xem danh mục, không sửa dữ liệu."}</p></div><div class="panel-actions"><div class="catalog-pnl-filter"><select id="catalog-pnl-filter" aria-label="Lọc nhóm P&L">${pnlFilterOptions}</select></div>${manageCatalog ? '<button class="outline-button" data-category-from-ingredient>⇄ Tạo từ NVL</button><button class="primary-button" data-category-add>＋ Thêm mã chi</button>' : ""}</div></div><div class="table-wrap">${categoryBody}</div></div>`;
    const pnlGroupsBody = table(["Mã","Nhóm P&L","Loại","Vai trò hạch toán"], PNL_GROUPS.map(group => [
      `<strong>${escapeHtml(group.code)}</strong>`,
      escapeHtml(group.name),
      `<span class="pill gray">${escapeHtml(group.type)}</span>`,
      escapeHtml(group.usage),
    ]));
    const pnlGroupsPanel = `<div class="panel"><div class="panel-head"><div><h3>Nhóm P&L chuẩn</h3><p>Level 1 cố định theo mô hình F&B. Mã chi, nguyên vật liệu và nhà cung cấp là Level 2 để phân tích chi tiết.</p></div><span class="status-chip">${PNL_GROUPS.length} nhóm cố định</span></div><div class="table-wrap">${pnlGroupsBody}</div></div>`;
    const conversionGuide = `<div class="nvl-conversion-guide"><div><b>Ví dụ quy đổi</b><span>Pepsi chai 1L: ĐVT nhập chai · Quy đổi 1000 · ĐVT kho ml</span></div><div><b>Trứng</b><span>ĐVT nhập quả · Quy đổi 1 · ĐVT kho quả</span></div><div><b>Thịt lợn</b><span>ĐVT nhập kg · Quy đổi 1000 · ĐVT kho g</span></div></div>`;
    const ingredientPanel = `<div class="panel"><div class="panel-head"><div><h3>Bảng quy chuẩn đổi NVL</h3><p>Đây là bảng gốc để tạo mã chi COGS/NVL. Mỗi dòng quy định kế toán mua theo ĐVT nào và kho/bếp sẽ nhận theo ĐVT nào.</p></div>${manageCatalog ? '<button class="primary-button" data-ingredient-add>＋ Thêm quy chuẩn NVL</button>' : ""}</div>${conversionGuide}<div class="table-wrap">${ingredientBody}</div></div>`;
    const categoryByCode=new Map((state.categories||[]).map(item=>[item.code,item]));
    const inventoryEntries = (state.inventoryMovements || []).filter(item => String(item.type || "in") === "in");
    const inventoryMap = new Map();
    inventoryEntries.forEach(item => {
      const key = `${String(item.code || "").toUpperCase()}|${normalizeCatalogText(item.supplier || "")}`;
      const current = inventoryMap.get(key) || { code: String(item.code || "").toUpperCase(), itemName: item.itemName || "", supplier: item.supplier || "", quantity: 0, amount: 0, lastDate: "" };
      current.itemName = current.itemName || item.itemName || "";
      current.supplier = current.supplier || item.supplier || "";
      current.quantity += num(item.quantity);
      current.amount += num(item.amount);
      if (!current.lastDate || String(item.date || "") > current.lastDate) current.lastDate = item.date || "";
      inventoryMap.set(key, current);
    });
    const inventoryRows = [...inventoryMap.values()].sort((a,b)=>a.code.localeCompare(b.code,"vi") || a.supplier.localeCompare(b.supplier,"vi")).map(item => [
      `<strong>${escapeHtml(item.code)}</strong>`,
      escapeHtml(item.itemName || categoryByCode.get(item.code)?.name || "—"),
      escapeHtml(item.supplier || "Không gắn NCC"),
      item.quantity > 0 ? fmt.format(item.quantity) : "—",
      money(item.amount),
      item.quantity > 0 ? money(item.amount / item.quantity) : "—",
      item.lastDate ? dateVi(item.lastDate) : "—",
    ]);
    const inventoryPanel = `<div class="panel"><div class="panel-head"><div><h3>Kho COGS</h3><p>Sổ nhập kho tự tạo từ các dòng chi phí nhóm COGS. Hiện theo dõi nhập theo mã chi + NCC; xuất kho theo định lượng món sẽ nối ở bước quản trị tồn kho tiếp theo.</p></div><span class="status-chip">${inventoryRows.length} dòng tồn theo mã/NCC</span></div><div class="table-wrap">${inventoryRows.length ? table(["Mã COGS","Sản phẩm","Nhà cung cấp","SL nhập","Giá trị nhập","Đơn giá BQ","Nhập gần nhất"], inventoryRows, [4,5]) : '<div class="empty">Chưa có dòng nhập kho COGS nào. Khi lưu chi phí nhóm COGS, hệ thống sẽ tự ghi vào kho.</div>'}</div></div>`;
    const supplierProductsHtml=(name)=>{const links=supplierProductLinks().filter(link=>link.supplier===name);return links.length?`<div class="supplier-product-tags">${links.map(link=>{const category=categoryByCode.get(link.code);return `<span class="pill green">${escapeHtml(link.code)} · ${escapeHtml(category?.name||"Mã chi đã xóa")}</span>`;}).join("")}</div>`:'<span class="muted">Chưa liên kết</span>';};
    const supplierBody=table(["Nhà cung cấp","Mã số thuế","Mã chi thường mua","Số HĐ","Công nợ còn lại","Thao tác"],supplierNames().map(name=>{const rows=(state.expenses||[]).filter(x=>x.supplier===name);return [escapeHtml(name),escapeHtml(supplierTaxCode(name)||"—"),supplierProductsHtml(name),fmt.format(rows.length),money(sum(rows,expenseOutstanding)),manageCatalog ? `<div class="inline-actions"><button class="small-button" data-supplier-edit="${escapeHtml(name)}">Sửa</button><button class="small-button danger-button" data-supplier-delete="${escapeHtml(name)}">Xóa</button></div>` : readonlyAction];}),[4]).replace('class="data-table"', 'class="data-table supplier-catalog-table"');
    const supplierPanel=`<div class="panel"><div class="panel-head"><div><h3>Danh mục nhà cung cấp & sản phẩm</h3><p>NCC được chọn trên từng chứng từ. Các mã chi tại đây chỉ là lịch sử/gợi ý thường mua để nhập liệu nhanh hơn.</p></div>${manageCatalog ? '<button class="primary-button" data-supplier-add>＋ Thêm NCC</button>' : ""}</div><div class="table-wrap">${supplierBody}</div></div>`;
    const employeeBody=table(
      ["Mã nhân viên","Họ và tên","Chức danh","Tổng lương đã chi","Tiền mặt","Chuyển khoản","Trạng thái làm việc","Hồ sơ bồi thường còn mở","Thao tác"],
      employees(true).map(employee=>{
        const claims=employeeClaims().filter(claim=>claim.employeeId===employee.id);
        const outstanding=sum(claims,item=>employeeClaimOutstanding(item));
        const employeePayrolls=(state.payrolls||[]).filter(item=>item.employeeId===employee.id||(!item.employeeId&&String(item.employeeCode||"").toUpperCase()===String(employee.code||"").toUpperCase()));
        const paidTotal=sum(employeePayrolls,"netPaid");
        const paidCash=sum(employeePayrolls.filter(item=>findAccount(item.accountId)?.type==="cash"||(!item.accountId&&item.source===CASH_SOURCE)),"netPaid");
        const paidTransfer=sum(employeePayrolls.filter(item=>findAccount(item.accountId)?.type==="bank"||(!item.accountId&&item.source===TRANSFER_SOURCE)),"netPaid");
        const workStatus=employee.active===false?'<span class="pill gray">Đã nghỉ</span>':'<span class="pill green">Đang làm việc</span>';
        return [
          `<strong>${escapeHtml(employee.code)}</strong>`,
          escapeHtml(employee.name),
          escapeHtml(employee.role||"—"),
          `<strong>${money(paidTotal)}</strong>`,
          money(paidCash),
          money(paidTransfer),
          workStatus,
          `<strong class="${outstanding>0?"danger":"good"}">${money(outstanding)}</strong>`,
          manageCatalog ? `<div class="inline-actions"><button class="small-button" data-employee-edit="${escapeHtml(employee.id)}">Sửa</button><button class="small-button danger-button" data-employee-delete="${escapeHtml(employee.id)}">Xóa</button></div>` : readonlyAction
        ];
      }),
      [3,4,5,7]
    );
    const employeePanel=`<div class="panel"><div class="panel-head"><div><h3>Danh mục nhân sự</h3><p>Mỗi nhân viên có một mã cố định. Hồ sơ bồi thường và khấu trừ lương dùng đúng mã này để tránh nhầm người.</p></div>${manageCatalog ? '<button class="primary-button" data-employee-add>＋ Thêm nhân viên</button>' : ""}</div><div class="table-wrap">${employeeBody}</div></div>`;
    const assetRows = fixedAssets().sort((a,b)=>String(b.acquisitionDate||"").localeCompare(String(a.acquisitionDate||""))).map(asset => {
      const scheduled = depreciationRecordsForAsset(asset);
      const accrued = sum(scheduled.filter(item => item.date <= reportEnd()), "amount");
      const category = (state.categories || []).find(item => item.code === (asset.depreciationCategoryCode || asset.categoryCode));
      return [escapeHtml(asset.name), money(asset.cost), dateVi(asset.acquisitionDate), `${fmt.format(asset.usefulLifeMonths)} tháng`, money(fixedAssetMonthlyDepreciation(asset)), money(accrued), escapeHtml(category?.code || "DEP"), manageCatalog ? `<button class="small-button" data-asset-edit="${escapeHtml(asset.id)}">Sửa khấu hao</button>` : readonlyAction];
    });
    const pendingCapex = (state.expenses || []).filter(item => item.operation === "Đầu tư tài sản (CAPEX)" && !item.fixedAssetId);
    const pendingCapexBody = table(["Ngày mua","Tài sản đầu tư","Giá trị CAPEX","Nguồn","Thiết lập"], pendingCapex.map(item => [dateVi(item.date),escapeHtml(assetNameFromPurchase(item)),money(item.amount),escapeHtml(item.source || "—"),manageCatalog ? `<button class="small-button primary-button" data-asset-setup="${escapeHtml(item.id)}">Thiết lập khấu hao</button>` : readonlyAction]),[2]);
    const assetPanel=`<div class="panel"><div class="panel-head"><div><h3>Tài sản & khấu hao</h3><p>Thiết lập thời gian khấu hao sau khi đã ghi nhận khoản mua CAPEX. Các dòng trích khấu hao chỉ đi vào P&amp;L, không làm giảm tiền lần nữa.</p></div></div><div class="table-wrap">${table(["Tài sản","Nguyên giá","Bắt đầu","Thời gian","KH / tháng","Đã trích đến ngày chốt","Mã DEP","Thao tác"],assetRows,[1,4,5])}</div></div><div class="panel"><div class="panel-head"><div><h3>Khoản đầu tư chưa thiết lập khấu hao</h3><p>Chọn từng tài sản bên dưới để đặt ngày bắt đầu và số tháng khấu hao.</p></div><span class="status-chip">${pendingCapex.length} tài sản chờ thiết lập</span></div><div class="table-wrap">${pendingCapexBody}</div></div>`;
    if (catalogTab === "inventory") catalogTab = "ingredients";
    app.innerHTML = `${tabs}${catalogTab==='categories'?categoryPanel:catalogTab==='pnl-groups'?pnlGroupsPanel:catalogTab==='ingredients'?ingredientPanel:catalogTab==='suppliers'?supplierPanel:catalogTab==='assets'?assetPanel:employeePanel}`;
    document.querySelectorAll("[data-tab]").forEach(x=>x.addEventListener("click",()=>{catalogTab=x.dataset.tab;render();}));
    document.querySelector("#catalog-pnl-filter")?.addEventListener("change", event => { catalogPnlFilter = event.target.value; render({ preserveScroll: true }); });
    document.querySelector("[data-load-cost2-demo]")?.addEventListener("click",openCost2DemoLoader);
    document.querySelector("[data-clear-transactional-data]")?.addEventListener("click",openTransactionalDataReset);
    document.querySelector("[data-category-add]")?.addEventListener("click",()=>openCategoryEditor());
    document.querySelector("[data-category-from-ingredient]")?.addEventListener("click",openCategoryFromIngredient);
    document.querySelectorAll("[data-category-edit]").forEach(button=>button.addEventListener("click",()=>openCategoryEditor((state.categories||[]).find(x=>x.code===button.dataset.categoryEdit))));
    document.querySelectorAll("[data-category-delete]").forEach(button=>button.addEventListener("click",()=>deleteCategory(button.dataset.categoryDelete)));
    document.querySelector("[data-ingredient-add]")?.addEventListener("click",()=>openIngredientEditor());
    document.querySelectorAll("[data-ingredient-edit]").forEach(button=>button.addEventListener("click",()=>openIngredientEditor(Number(button.dataset.ingredientEdit))));
    document.querySelectorAll("[data-ingredient-delete]").forEach(button=>button.addEventListener("click",()=>deleteIngredient(Number(button.dataset.ingredientDelete))));
    document.querySelectorAll("[data-ingredient-code]").forEach(button=>button.addEventListener("click",()=>openCategoryEditor(null,(state.ingredients||[])[Number(button.dataset.ingredientCode)])));
    document.querySelector("[data-supplier-add]")?.addEventListener("click",()=>openSupplierEditor());
    document.querySelectorAll("[data-supplier-edit]").forEach(button=>button.addEventListener("click",()=>openSupplierEditor(button.dataset.supplierEdit)));
    document.querySelectorAll("[data-supplier-delete]").forEach(button=>button.addEventListener("click",()=>deleteSupplier(button.dataset.supplierDelete)));
    document.querySelectorAll("[data-asset-setup]").forEach(button=>button.addEventListener("click",()=>openFixedAssetEditor("",button.dataset.assetSetup)));
    document.querySelectorAll("[data-asset-edit]").forEach(button=>button.addEventListener("click",()=>openFixedAssetEditor(button.dataset.assetEdit)));
    document.querySelector("[data-employee-add]")?.addEventListener("click",()=>openEmployeeEditor());
    document.querySelectorAll("[data-employee-edit]").forEach(button=>button.addEventListener("click",()=>openEmployeeEditor(findEmployee(button.dataset.employeeEdit))));
    document.querySelectorAll("[data-employee-delete]").forEach(button=>button.addEventListener("click",()=>deleteEmployee(button.dataset.employeeDelete)));
  }

  function openTransactionalDataReset(){
    const counts = [
      ["Doanh thu quán", (state.revenues || []).length],
      ["Tiền App phải trả và đợt rút", (state.appSales || []).length + (state.appPayouts || []).length],
      ["Chi phí và công nợ NCC", (state.expenses || []).length],
      ["Chi trả lương", (state.payrolls || []).length],
      ["Hồ sơ bồi thường nhân viên", (state.employeeClaims || []).length],
      ["Tạm ứng nhà cung cấp", (state.supplierAdvances || []).length],
      ["Chuyển quỹ, điều chỉnh và đối soát", (state.fundTransactions || []).length + (state.reconciliations || []).length],
    ];
    const total = sum(counts, item => item[1]);
    modalContent.innerHTML=`<h2>Làm sạch dữ liệu chạy thử</h2><p>Thao tác này xóa <strong>${fmt.format(total)} chứng từ phát sinh</strong> để bắt đầu nhập dữ liệu mới. Danh mục mã chi, nguyên vật liệu, nhà cung cấp, nhân sự, quỹ/tài khoản và KPI vẫn được giữ lại.</p><div class="reset-summary">${counts.map(([label,count])=>`<div><span>${escapeHtml(label)}</span><b>${fmt.format(count)} dòng</b></div>`).join("")}</div><form id="transactional-data-reset-form"><div class="field"><label>Nhập <strong>XÓA SẠCH</strong> để xác nhận</label><input name="confirmation" type="text" autocomplete="off" placeholder="XÓA SẠCH" autofocus></div><p class="form-hint">Số dư đầu kỳ của quỹ/tài khoản không bị đổi. Tất cả chứng từ và lịch sử sổ quỹ phát sinh từ dữ liệu cũ sẽ bị xóa.</p><div class="form-actions"><button class="primary-button danger-action">Xóa dữ liệu phát sinh</button></div></form>`;
    openModal();
    document.querySelector("#transactional-data-reset-form").addEventListener("submit", event => {
      event.preventDefault();
      const confirmation = String(new FormData(event.currentTarget).get("confirmation") || "").trim().toUpperCase();
      if (confirmation !== "XÓA SẠCH") { toast("Nhập đúng XÓA SẠCH để xác nhận"); return; }
      localStorage.setItem(`${STORAGE_KEY}-backup-before-reset-${Date.now()}`, JSON.stringify(state));
      state.revenues = [];
      state.appSales = [];
      state.appPayouts = [];
      state.expenses = [];
      state.payrolls = [];
      state.employeeClaims = [];
      state.fixedAssets = [];
      state.supplierAdvances = [];
      state.fundTransactions = [];
      state.reconciliations = [];
      showVoidedRevenues = false;
      const cleanMonth = localToday().slice(0, 7);
      periodInput.value = cleanMonth;
      const bounds = monthBounds(cleanMonth);
      reportStartInput.value = bounds.start;
      reportEndInput.value = bounds.end;
      persist();
      closeModal();
      view = "dashboard";
      toast("Đã làm sạch toàn bộ dữ liệu phát sinh để chạy thử");
      render();
    });
  }

  const COST2_DEMO_BATCH = "cost-2-2026-07";
  const COST2_DEMO_NOTE = "Dữ liệu demo từ Cost_2 - DỤNG CỤ & NL.csv";
  const COST2_BEP_NUONG_NAME = "Bếp nướng chuyên dụng";
  const COST2_BEP_NUONG_AMOUNT = 3000000;
  const COST2_BEP_NUONG_MONTHS = 24;
  const COST2_BEP_NUONG_ASSET_KEY = "cost2-bep-nuong-24-thang";
  const DEPRECIATION_SOURCE = "Bút toán khấu hao";
  const normalizeDepreciationEntries = () => {
    let changed = false;
    for (const expense of state.expenses || []) {
      if (expense.operation !== "Trích khấu hao") continue;
      if (expense.source !== DEPRECIATION_SOURCE) { expense.source = DEPRECIATION_SOURCE; changed = true; }
      if (expense.supplier) { expense.supplier = ""; changed = true; }
      if (num(expense.paid) !== 0) { expense.paid = 0; changed = true; }
      if (Array.isArray(expense.payments) && expense.payments.length) { expense.payments = []; changed = true; }
    }
    return changed;
  };
  // Mã thuộc nhóm DEP luôn đại diện cho khoản mua tài sản. Tiền mua là CAPEX,
  // còn chi phí P&L chỉ phát sinh từ các bút toán trích khấu hao theo tháng.
  // Chuẩn hoá các dòng đã nhập trước khi áp dụng quy tắc này để chúng xuất hiện
  // trong danh sách "Khoản đầu tư chưa thiết lập khấu hao".
  const normalizeCapitalAssetPurchases = () => {
    let changed = false;
    for (const expense of state.expenses || []) {
      const category = (state.categories || []).find(item => item.code === expense.code);
      const pnlGroupCode = expense.pnlGroupCode || category?.pnlGroupCode || pnlGroupCodeFromValue(expense.group) || pnlGroupCodeFromValue(category?.group);
      if (pnlGroupCode !== "DEP" || expense.operation === "Trích khấu hao") continue;
      if (expense.pnlGroupCode !== "DEP") { expense.pnlGroupCode = "DEP"; changed = true; }
      if (expense.group !== pnlGroupLabel("DEP")) { expense.group = pnlGroupLabel("DEP"); changed = true; }
      if (expense.operation !== "Đầu tư tài sản (CAPEX)") { expense.operation = "Đầu tư tài sản (CAPEX)"; changed = true; }
      if (expense.pnl !== false) { expense.pnl = false; changed = true; }
    }
    return changed;
  };
  const COST2_DEMO_ITEMS = [
    ["COGS", "Râu bạch tuộc đông lạnh Túi 1Kg", "CHỢ ĐẦU MỐI", 225000],
    ["COGS", "Hành tây trắng (kg)", "CHỢ ĐẦU MỐI", 180000],
    ["COGS", "Ngô ngọt (kg)", "CHỢ ĐẦU MỐI", 100000],
    ["COGS", "Phô Mai Mozzarella Oldenburger - Khối 2,5Kg", "CHỢ ĐẦU MỐI", 940000],
    ["COGS", "Cá ngừ bào mỏng (Hanakatsuo) FUKUSHIMA KATSUO 500Gr", "CHỢ ĐẦU MỐI", 840000],
    ["COGS", "Vụn rong biển mix Tân Trúc 250Gr", "TÂN TRÚC", 220000],
    ["COGS", "Bột ớt nhật Tân Trúc gói 200Gr", "TÂN TRÚC", 120000],
    ["COGS", "Bột rong biển Tân Trúc 200Gr", "TÂN TRÚC", 575000],
    ["COGS", "Nước tương Takoyaki Tân Trúc túi 1000Ml", "TÂN TRÚC", 525000],
    ["COGS", "Dầu ăn 5L Meizan", "MEIZAN", 310000],
    ["COGS", "Đường mía lỏng Wonderfull 7Kg", "CHỢ ĐẦU MỐI", 245000],
    ["COGS", "Sốt Teri Tân Trúc túi 1000Ml", "TÂN TRÚC", 775000],
    ["COGS", "Sốt chua cay Tân Trúc túi 1000Ml", "TÂN TRÚC", 900000],
    ["COGS", "Sốt cay ngọt Tân Trúc túi 1000Ml", "TÂN TRÚC", 900000],
    ["COGS", "Sốt mù tạt xanh Tân Trúc túi 1000Ml", "TÂN TRÚC", 800000],
    ["COGS", "Sốt mù tạt vàng Tân Trúc túi 1000Ml", "TÂN TRÚC", 975000],
    ["COGS", "Sốt phomai Tân Trúc túi 1000Ml", "TÂN TRÚC", 850000],
    ["COGS", "Trứng cá chuồn Tobiko màu đỏ 500Gr", "CHỢ ĐẦU MỐI", 520000],
    ["COGS", "Rong biển tươi Hàn Quốc 1Kg", "CHỢ ĐẦU MỐI", 180000],
    ["COGS", "Sốt mè rang Tân Trúc túi 1000Ml", "TÂN TRÚC", 145000],
    ["COGS", "Chà bông xù Tân Trúc 1Kg", "TÂN TRÚC", 410000],
    ["COGS", "Sốt mayonaise Kewpie 3Kg", "KEWPIE", 735000],
    ["PACK", "Hộp giấy đựng bánh mang đi có Logo thương hiệu - 4 & 6 bánh", "BAO BÌ DEMO", 1800000],
    ["PACK", "Hộp giấy đựng bánh mang đi có Logo thương hiệu - 8 bánh", "BAO BÌ DEMO", 900000],
    ["COGS", "Bột bánh takoyaki Tân Trúc túi 1Kg", "TÂN TRÚC", 1200000],
    ["PACK", "Túi nilong 2kg - 1kg", "BAO BÌ DEMO", 225000],
    ["COGS", "Trứng gà", "CHỢ ĐẦU MỐI", 450000],
    ["DEP", COST2_BEP_NUONG_NAME, "DỤNG CỤ PHA CHẾ DEMO", COST2_BEP_NUONG_AMOUNT, false, COST2_BEP_NUONG_MONTHS],
    ["TOOL", "Ca nhựa có nắp 5L", "DỤNG CỤ PHA CHẾ DEMO", 240000],
    ["TOOL", "Phễu rót bột inox dung tích 1.4L", "DỤNG CỤ PHA CHẾ DEMO", 360000],
    ["TOOL", "Cây xiên lật bánh 20cm", "DỤNG CỤ PHA CHẾ DEMO", 100000],
    ["TOOL", "Ca đong 250Ml", "DỤNG CỤ PHA CHẾ DEMO", 40000],
    ["TOOL", "Khuôn nhựa silocon hình tròn - 20 ô - size 3,7cm", "DỤNG CỤ PHA CHẾ DEMO", 110000],
    ["TOOL", "Bình pump nhựa 1L (đựng đường) 100Ml", "DỤNG CỤ PHA CHẾ DEMO", 20000],
    ["TOOL", "Dụng cụ đánh trứng cầm tay (phới đánh trứng) 40cm", "DỤNG CỤ PHA CHẾ DEMO", 200000],
    ["TOOL", "Thìa muỗng cà phê inox 19cm", "DỤNG CỤ PHA CHẾ DEMO", 18000],
    ["TOOL", "Lọ rắc inox cao 15cm", "DỤNG CỤ PHA CHẾ DEMO", 440000],
    ["TOOL", "Lọ đựng sốt màu trắng 650ml", "DỤNG CỤ PHA CHẾ DEMO", 250000],
    ["TOOL", "Khuôn làm bánh 28 lỗ size 20x33", "DỤNG CỤ PHA CHẾ DEMO", 190000],
    ["TOOL", "Kẹp gắp inox size 15cm", "DỤNG CỤ PHA CHẾ DEMO", 125000],
    ["DEP", "Đầu tư xe bán hàng Takoyaki (CAPEX - ngoài P&L)", "TÀI SẢN DEMO", 20000000, false],
    ["DEP", "Đầu tư lò vi sóng 20L (CAPEX - ngoài P&L)", "TÀI SẢN DEMO", 1700000, false],
  ].map(([pnlGroupCode, name, supplier, amount, pnl = true, depreciationMonths = 0]) => ({ pnlGroupCode, name, supplier, amount, pnl, depreciationMonths }));

  const monthAfter = (monthValue, offset) => {
    const [year, month] = String(monthValue).split("-").map(Number);
    const next = new Date(Date.UTC(year, month - 1 + offset, 1));
    return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}`;
  };

  const fixedAssetKey = (asset) => String(asset?.key || asset?.id || "");
  const fixedAssetMonthlyDepreciation = (asset) => {
    const months = Math.max(1, Math.floor(num(asset?.usefulLifeMonths)));
    return Math.floor(Math.max(0, num(asset?.cost) - num(asset?.residualValue)) / months);
  };
  const ensureDepreciationCategory = (assetName) => {
    const name = `Khấu hao ${String(assetName || "tài sản").trim()}`;
    let category = (state.categories || []).find(item => (item.pnlGroupCode || legacyCategoryGroupCode(item)) === "DEP" && normalizeCatalogText(item.name) === normalizeCatalogText(name));
    if (category) return category;
    category = { code: nextCategoryCode("DEP"), name, supplier: "", group: pnlGroupLabel("DEP"), pnlGroupCode: "DEP", payrollOnly: false, pnl: true, note: "Chi phí khấu hao tài sản." };
    state.categories.push(category);
    return category;
  };
  function syncFixedAssetDepreciation(asset){
    const assetKey = fixedAssetKey(asset);
    const categoryCode = asset.depreciationCategoryCode || asset.categoryCode;
    const category = (state.categories || []).find(item => item.code === categoryCode);
    const months = Math.max(1, Math.floor(num(asset.usefulLifeMonths)));
    const cost = num(asset.cost), residualValue = Math.max(0, num(asset.residualValue));
    if (!assetKey || !category || cost <= residualValue || !asset.acquisitionDate) return false;
    let changed = false;
    const monthlyAmount = fixedAssetMonthlyDepreciation({ ...asset, usefulLifeMonths: months, cost, residualValue });
    const acquisitionMonth = String(asset.acquisitionDate).slice(0, 7);
    const validPeriods = new Set();
    for (let index = 0; index < months; index += 1) {
      const depreciationPeriod = monthAfter(acquisitionMonth, index);
      validPeriods.add(depreciationPeriod);
      const amount = index === months - 1 ? cost - residualValue - monthlyAmount * (months - 1) : monthlyAmount;
      const scheduleData = {
        invoice: `KH-${depreciationPeriod.replace("-", "")}-${category.code}`,
        invoiceGroupId: asset.id, invoiceLineNumber: index + 1, invoiceLineCount: months,
        date: monthBounds(depreciationPeriod).end, code: category.code, group: category.group, pnlGroupCode: "DEP", description: asset.name,
        source: DEPRECIATION_SOURCE, amount, paid: 0, payments: [], supplier: "", operation: "Trích khấu hao", pnl: true,
        note: `Khấu hao tháng ${index + 1}/${months} · tài sản ${asset.name}`,
        depreciationAssetKey: assetKey, depreciationPeriod, fixedAssetId: asset.id, demoBatch: asset.demoBatch || "",
      };
      const scheduled = (state.expenses || []).find(item => item.depreciationAssetKey === assetKey && item.depreciationPeriod === depreciationPeriod);
      if (!scheduled) { state.expenses.push({ id: uid("depreciation"), createdAt: Date.now() + index, ...scheduleData }); changed = true; }
      else for (const [key, value] of Object.entries(scheduleData)) if (scheduled[key] !== value) { scheduled[key] = value; changed = true; }
    }
    const staleIds = new Set((state.expenses || []).filter(item => item.depreciationAssetKey === assetKey && !validPeriods.has(item.depreciationPeriod)).map(item => item.id));
    if (staleIds.size) { state.expenses = state.expenses.filter(item => !staleIds.has(item.id)); changed = true; }
    return changed;
  }

  // Bếp nướng là tài sản: tiền mua là CAPEX, còn chi phí P&L được trích đều
  // trong 24 tháng. Các bút toán khấu hao không có thanh toán nên không tạo
  // công nợ NCC và cũng không làm dòng tiền bị giảm lần thứ hai.
  function ensureCost2BepNuongDepreciation(){
    const purchase = (state.expenses || []).find(item => item.demoBatch === COST2_DEMO_BATCH
      && normalizeCatalogText(item.description) === normalizeCatalogText(COST2_BEP_NUONG_NAME)
      && !item.depreciationAssetKey && num(item.amount) === COST2_BEP_NUONG_AMOUNT);
    if (!purchase) return false;
    let changed = false;
    let category = (state.categories || []).find(item => (item.pnlGroupCode || legacyCategoryGroupCode(item)) === "DEP"
      && normalizeCatalogText(item.name) === normalizeCatalogText(COST2_BEP_NUONG_NAME));
    if (!category) {
      category = {
        code: nextCategoryCode("DEP"), name: COST2_BEP_NUONG_NAME, supplier: purchase.supplier || "",
        group: pnlGroupLabel("DEP"), pnlGroupCode: "DEP", payrollOnly: false, pnl: true,
        note: "Tài sản khấu hao 24 tháng; tiền mua ghi CAPEX, chi phí trích hàng tháng.",
      };
      state.categories.push(category);
      changed = true;
    }
    if (category.pnl !== true) { category.pnl = true; changed = true; }
    const purchaseUpdates = {
      code: category.code, group: category.group, pnlGroupCode: "DEP", description: COST2_BEP_NUONG_NAME,
      operation: "Đầu tư tài sản (CAPEX)", pnl: false,
      note: "Tài sản bếp nướng · khấu hao 24 tháng",
    };
    for (const [key, value] of Object.entries(purchaseUpdates)) {
      if (purchase[key] !== value) { purchase[key] = value; changed = true; }
    }
    if (!Array.isArray(state.fixedAssets)) { state.fixedAssets = []; changed = true; }
    let asset = state.fixedAssets.find(item => item.key === COST2_BEP_NUONG_ASSET_KEY);
    const assetData = {
      key: COST2_BEP_NUONG_ASSET_KEY, name: COST2_BEP_NUONG_NAME, acquisitionDate: purchase.date,
      cost: COST2_BEP_NUONG_AMOUNT, categoryCode: category.code, depreciationCategoryCode: category.code,
      purchaseExpenseId: purchase.id, demoBatch: COST2_DEMO_BATCH, active: true,
    };
    if (!asset) { asset = { id: uid("asset"), createdAt: Date.now(), usefulLifeMonths: COST2_BEP_NUONG_MONTHS, residualValue: 0, ...assetData }; state.fixedAssets.push(asset); changed = true; }
    else {
      for (const [key, value] of Object.entries(assetData)) if (asset[key] !== value) { asset[key] = value; changed = true; }
      if (!num(asset.usefulLifeMonths)) { asset.usefulLifeMonths = COST2_BEP_NUONG_MONTHS; changed = true; }
      if (asset.residualValue === undefined || asset.residualValue === null) { asset.residualValue = 0; changed = true; }
    }
    if (purchase.fixedAssetId !== asset.id) { purchase.fixedAssetId = asset.id; changed = true; }
    return syncFixedAssetDepreciation(asset) || changed;
  }

  const fixedAssetDepreciationChanged = ensureCost2BepNuongDepreciation();
  const normalizedDepreciationEntries = normalizeDepreciationEntries();
  const normalizedCapitalAssetPurchases = normalizeCapitalAssetPurchases();
  if (fixedAssetDepreciationChanged || normalizedDepreciationEntries || normalizedCapitalAssetPurchases) persist();

  function openCost2DemoLoader(){
    if((state.expenses||[]).some(item=>item.demoBatch===COST2_DEMO_BATCH)|| (state.payrolls||[]).some(item=>item.demoBatch===COST2_DEMO_BATCH)){
      toast("Bộ dữ liệu Cost_2 demo đã được nạp rồi.");
      return;
    }
    const totalPurchase=sum(COST2_DEMO_ITEMS,"amount");
    const pnlPurchase=sum(COST2_DEMO_ITEMS.filter(item=>item.pnl),"amount");
    const capex=totalPurchase-pnlPurchase;
    const toolPurchase=sum(COST2_DEMO_ITEMS.filter(item=>item.pnlGroupCode==="TOOL"),"amount");
    const monthlyBepDepreciation=COST2_BEP_NUONG_AMOUNT/COST2_BEP_NUONG_MONTHS;
    modalContent.innerHTML=`<h2>Nạp dữ liệu demo Cost_2</h2><p>Hệ thống sẽ tạo dữ liệu chạy thử theo từng dòng từ file <strong>Cost_2 - DỤNG CỤ &amp; NL.csv</strong>, không thay đổi dữ liệu doanh thu.</p><div class="reset-summary"><div><span>Vốn góp đầu kỳ vào ngân hàng</span><b>${money(50000000)}</b></div><div><span>Nguyên liệu + bao bì</span><b>${money(16045000)}</b></div><div><span>Dụng cụ pha chế (TOOL)</span><b>${money(toolPurchase)}</b></div><div><span>Đầu tư tài sản ngoài P&amp;L</span><b>${money(capex)}</b></div><div><span>Khấu hao bếp mỗi tháng / 24 tháng</span><b>${money(monthlyBepDepreciation)}</b></div><div><span>Lương + KPI trích tháng</span><b>${money(9000000)}</b></div></div><p class="form-hint">Xe bán hàng, lò vi sóng và <strong>bếp nướng chuyên dụng</strong> được ghi là <strong>CAPEX ngoài P&amp;L</strong>. Riêng bếp nướng ${money(COST2_BEP_NUONG_AMOUNT)} sẽ tự trích <strong>${money(monthlyBepDepreciation)}/tháng trong ${COST2_BEP_NUONG_MONTHS} tháng</strong> vào mã DEP. Các dụng cụ còn lại vào TOOL. Lương cơ bản ${money(7000000)} và thưởng KPI ${money(2000000)} được trích cuối kỳ, chi thực tế vào ngày 10 tháng sau. Vốn góp đầu kỳ chỉ tăng tiền ngân hàng, không phải doanh thu và không đi vào P&amp;L.</p><div class="form-actions"><button class="primary-button" id="confirm-load-cost2-demo">Nạp ${COST2_DEMO_ITEMS.length} dòng chi phí demo</button></div>`;
    openModal();
    document.querySelector("#confirm-load-cost2-demo").addEventListener("click",loadCost2DemoData);
  }

  function loadCost2DemoData(){
    if((state.expenses||[]).some(item=>item.demoBatch===COST2_DEMO_BATCH)){toast("Bộ dữ liệu Cost_2 demo đã tồn tại");return;}
    const periodValue=/^\d{4}-\d{2}$/.test(String(periodInput.value||""))?periodInput.value:localToday().slice(0,7);
    const dateFor=(day)=>`${periodValue}-${String(day).padStart(2,"0")}`;
    const now=Date.now();
    const bankAccountId=defaultAccountId("bank");
    const bankAccount=findAccount(bankAccountId);
    // Bộ dữ liệu demo bắt đầu từ đầu kỳ. Nếu quỹ ngân hàng đang có ngày mở
    // muộn hơn (do dữ liệu thử trước đó), các dòng vốn góp và chi đầu kỳ sẽ
    // bị loại khỏi số dư. Chỉ điều chỉnh tài khoản đang có số dư đầu kỳ bằng 0.
    if(bankAccount&&(!bankAccount.openingDate||bankAccount.openingDate>dateFor(1))&&num(bankAccount.openingBalance)===0){
      bankAccount.openingDate=dateFor(1);
    }
    const ensureSupplier=(value)=>{
      const existing=(state.suppliers||[]).find(item=>normalizeCatalogText(item)===normalizeCatalogText(value));
      if(existing)return existing;
      state.suppliers.push(value);
      return value;
    };
    const ensureCategory=(item)=>{
      const matched=(state.categories||[]).find(category=>(category.pnlGroupCode||legacyCategoryGroupCode(category))===item.pnlGroupCode
        && normalizeCatalogText(category.name)===normalizeCatalogText(item.name));
      if(matched){ rememberSupplierProduct(item.supplier, matched.code, now); return matched; }
      const supplier=ensureSupplier(item.supplier);
      const category={
        code:nextCategoryCode(item.pnlGroupCode), name:item.name, supplier:"",
        group:pnlGroupLabel(item.pnlGroupCode), pnlGroupCode:item.pnlGroupCode,
        payrollOnly:false, pnl:item.depreciationMonths ? true : item.pnl, note:COST2_DEMO_NOTE,
      };
      state.categories.push(category);
      rememberSupplierProduct(supplier, category.code, now);
      if(item.pnlGroupCode==="COGS" && !(state.ingredients||[]).some(ingredient=>normalizeCatalogText(ingredient.name)===normalizeCatalogText(item.name)&&normalizeCatalogText(ingredient.supplier)===normalizeCatalogText(supplier))){
        state.ingredients.push({name:item.name,supplier});
      }
      return category;
    };
    const source=TRANSFER_SOURCE;
    const grouped=new Map();
    COST2_DEMO_ITEMS.forEach(item=>{
      const key=`${item.pnlGroupCode}|${item.supplier}`;
      if(!grouped.has(key))grouped.set(key,[]);
      grouped.get(key).push(item);
    });
    let invoiceIndex=0, lineClock=0;
    grouped.forEach((items,key)=>{
      invoiceIndex+=1;
      const [groupCode,supplier]=key.split("|");
      const invoice=`DEMO-C2-${groupCode}-${String(invoiceIndex).padStart(3,"0")}`;
      const invoiceGroupId=uid("demo-invoice");
      const date=dateFor(1+(invoiceIndex%4));
      items.forEach((item,index)=>{
        const category=ensureCategory(item);
        const createdAt=now+(lineClock+=1);
        state.expenses.push({
          id:uid("demo-exp"), invoice, invoiceGroupId, invoiceLineNumber:index+1, invoiceLineCount:items.length, createdAt,
          date, code:category.code, group:category.group, pnlGroupCode:category.pnlGroupCode, description:category.name,
          source, amount:item.amount, paid:item.amount,
          payments:[{id:uid("demo-pay"),date,source,accountId:bankAccountId,amount:item.amount}],
          supplier, operation:item.pnl?"Mua hàng / Chi phí":"Đầu tư tài sản (CAPEX)", pnl:item.pnl, note:COST2_DEMO_NOTE, demoBatch:COST2_DEMO_BATCH,
        });
      });
    });
    ensureCost2BepNuongDepreciation();
    const ensurePayrollCategory=(code,name)=>{
      const found=(state.categories||[]).find(category=>category.code===code);
      if(found)return found;
      const category={code,name,supplier:"",group:pnlGroupLabel("PAY"),pnlGroupCode:"PAY",payrollOnly:true,pnl:true,note:"Nhập tại Chi trả lương theo từng nhân viên."};
      state.categories.push(category);
      return category;
    };
    const baseCategory=ensurePayrollCategory("PAY-001","Lương cơ bản / lương ca");
    const bonusCategory=ensurePayrollCategory("PAY-002","Thưởng / KPI / lễ Tết");
    let employee=(state.employees||[]).find(item=>item.code==="NV-DEMO");
    if(!employee){employee={id:uid("employee"),createdAt:now,code:"NV-DEMO",name:"Nhân viên demo",role:"Pha chế",active:true};state.employees.push(employee);}
    const accrualDate=monthBounds(periodValue).end;
    const paymentDate=payrollPaymentDate(periodValue);
    const paymentBatchId=uid("demo-payroll");
    [{category:baseCategory,amount:7000000},{category:bonusCategory,amount:2000000}].forEach((allocation,index)=>{
      const payrollCode=nextPayrollCode(periodValue,employee.code);
      const payroll={
        id:uid("demo-payroll"),createdAt:now+(lineClock+=1),payrollCode,period:periodValue,accrualDate,date:paymentDate,
        employeeId:employee.id,employeeCode:employee.code,employee:employee.name,categoryCode:allocation.category.code,gross:allocation.amount,
        deductions:[],netPaid:allocation.amount,source,accountId:bankAccountId,paymentBatchId,note:COST2_DEMO_NOTE,demoBatch:COST2_DEMO_BATCH,
      };
      state.payrolls.push(payroll);
      state.expenses.push({
        id:uid("demo-payroll-exp"),invoice:payrollCode,invoiceGroupId:paymentBatchId,invoiceLineNumber:index+1,invoiceLineCount:2,createdAt:now+(lineClock+=1),
        date:accrualDate,code:allocation.category.code,group:allocation.category.group,pnlGroupCode:"PAY",description:`${allocation.category.name} ${periodValue} · ${employeeLabel(employee)}`,
        source,amount:allocation.amount,paid:allocation.amount,payments:[{id:uid("demo-pay"),date:paymentDate,source,accountId:bankAccountId,amount:allocation.amount,paymentBatchId}],
        supplier:"",operation:"Trích trước lương",payrollId:payroll.id,payrollAccrualDate:accrualDate,payrollDeduction:0,pnl:true,note:COST2_DEMO_NOTE,demoBatch:COST2_DEMO_BATCH,
      });
    });
    state.fundTransactions.push({
      id:uid("demo-capital"),createdAt:now,date:dateFor(1),type:"adjustment",direction:"in",accountId:bankAccountId,amount:50000000,
      note:"Vốn góp đầu kỳ để chạy dữ liệu demo Cost_2",demoBatch:COST2_DEMO_BATCH,
    });
    const bounds=monthBounds(periodValue);
    periodInput.value=periodValue;
    reportStartInput.value=bounds.start;
    reportEndInput.value=bounds.end;
    persist();
    closeModal();
    view="expenses";
    toast(`Đã nạp ${COST2_DEMO_ITEMS.length} dòng Cost_2 và lương ${money(9000000)} để chạy thử`);
    render();
  }

  function openCategoryEditor(item=null, ingredient=null){
    const isEdit = Boolean(item);
    if (!isEdit && ingredient?.id) {
      const existingByIngredient = (state.categories || []).find(category => category.ingredientId === ingredient.id);
      if (existingByIngredient) {
        toast(`Quy chuẩn ${ingredientDisplayName(ingredient)} đã có mã ${existingByIngredient.code}; không tạo trùng`);
        return;
      }
    }
    const value = item || {code:nextIngredientCode(),name:ingredient?ingredientDisplayName(ingredient):"",ingredientId:ingredient?.id||"",supplier:ingredient?.supplier||"",group:pnlGroupLabel("COGS"),pnlGroupCode:"COGS",payrollOnly:false,pnl:true,note:""};
    const groups = PNL_GROUPS.filter(group => !["REV", "DISC"].includes(group.code));
    const selectedGroup = pnlGroupLabel(pnlGroupCodeFromValue(value.pnlGroupCode) || pnlGroupCodeFromValue(value.group) || "OTHER");
    modalContent.innerHTML=`<h2>${isEdit?"Sửa mã chi":"Thêm mã chi"}</h2><p>${ingredient?`Tạo mã chi từ quy chuẩn NVL: <strong>${escapeHtml(ingredientDisplayName(ingredient))}</strong>. Mã chi này sẽ tự nhớ ĐVT nhập ${escapeHtml(ingredient.purchaseUnit || "SL")} → ĐVT kho ${escapeHtml(ingredient.stockUnit || "SL")}.`:"Mã chi được tự động sinh theo Nhóm P&L, ví dụ <strong>PAY-003</strong>, để báo cáo luôn nhất quán."}</p><form id="category-form"><div class="form-grid"><div class="field"><label>Mã chi</label><input id="category-code" name="code" type="text" value="${escapeHtml(value.code)}" readonly></div>${field("Diễn giải","name","text",value.name)}<div class="field full"><label>Nhóm P&L</label><select name="group" id="category-group">${groups.map(group=>{const label=pnlGroupLabel(group.code);return `<option value="${escapeHtml(label)}" ${label===selectedGroup?'selected':''}>${escapeHtml(label)} · ${escapeHtml(group.type)}</option>`;}).join("")}</select></div><div class="field"><label>Nơi ghi nhận</label><select name="inputPlace"><option value="expense" ${!value.payrollOnly?'selected':''}>Chi phí</option><option value="payroll" ${value.payrollOnly?'selected':''}>Chi trả lương</option></select></div><div class="field"><label>Tính P&L?</label><select name="pnl"><option value="true" ${value.pnl?'selected':''}>Có</option><option value="false" ${!value.pnl?'selected':''}>Không</option></select></div>${field("Ghi chú","note","text",value.note||"")}</div><p class="form-hint">Mã chi chỉ dùng để phân loại P&amp;L/kho. NCC vẫn chọn tự do trên hóa đơn; quy đổi tồn kho lấy từ bảng Quy chuẩn NVL.</p><div class="form-actions"><button class="primary-button">${isEdit?"Lưu thay đổi":"Thêm mã chi"}</button></div></form>`;
    openModal();
    const categoryForm=document.querySelector("#category-form"), categoryGroup=categoryForm.querySelector("#category-group"), categoryCode=categoryForm.querySelector("#category-code");
    categoryGroup.addEventListener("change",()=>{const groupCode=pnlGroupCodeFromValue(categoryGroup.value);if(!item || !String(item.code||"").startsWith(`${groupCode}-`))categoryCode.value=nextCategoryCode(groupCode);});
    categoryForm.addEventListener("submit",event=>{
      event.preventDefault();
      const fd=new FormData(event.currentTarget);
      const code=String(fd.get("code")||"").trim().toUpperCase();
      const name=String(fd.get("name")||"").trim();
      const group=String(fd.get("group")||"").trim();
      const pnlGroupCode=pnlGroupCodeFromValue(group);
      const payrollOnly=fd.get("inputPlace")==="payroll";
      if(!code||!name||!pnlGroupCode){toast("Vui lòng điền đủ mã chi, diễn giải và nhóm P&L chuẩn");return;}
      if(!code.startsWith(`${pnlGroupCode}-`)){toast("Mã chi phải dùng đúng tiền tố của Nhóm P&L");return;}
      if(payrollOnly&&pnlGroupCode!=="PAY"){toast("Mã chỉ có thể ghi nhận tại Chi trả lương khi thuộc nhóm Chi phí nhân sự");return;}
      if((state.categories||[]).some(x=>x.code===code&&x!==item)){toast(`Mã chi ${code} đã tồn tại`);return;}
      if(!item && ingredient?.id){
        const existingByIngredient=(state.categories||[]).find(category=>category.ingredientId===ingredient.id);
        if(existingByIngredient){toast(`Quy chuẩn NVL này đã có mã ${existingByIngredient.code}; không tạo thêm mã chi lần 2`);return;}
      }
      const sameProduct=(state.categories||[]).find(category=>category!==item
        && (category.pnlGroupCode||legacyCategoryGroupCode(category))===pnlGroupCode
        && normalizeCatalogText(category.name)===normalizeCatalogText(name));
      if(sameProduct){toast(`${name} đã có mã ${sameProduct.code} trong nhóm ${pnlGroupCode}; dùng mã đó và chọn NCC trên chứng từ`);return;}

      const oldCode=item?.code||"";
      const saved={code,name,supplier:"",ingredientId:item?.ingredientId || ingredient?.id || "",group:pnlGroupLabel(pnlGroupCode),pnlGroupCode,payrollOnly,pnl:fd.get("pnl")==="true",note:String(fd.get("note")||"").trim()};
      if(item)Object.assign(item,saved);else state.categories.push(saved);
      if(oldCode&&oldCode!==code){
        for(const expense of state.expenses||[]){if(expense.code===oldCode)expense.code=code;}
        for(const payroll of state.payrolls||[]){if(payroll.categoryCode===oldCode)payroll.categoryCode=code;}
      }
      state.supplierProducts = supplierProductLinks().filter(link => !oldCode || String(link.code||"").toUpperCase() !== oldCode);
      if (ingredient?.supplier) {
        const supplier = String(ingredient.supplier || "").trim();
        if (supplier && !supplierNames().some(existing=>normalizeCatalogText(existing)===normalizeCatalogText(supplier))) state.suppliers.push(supplier);
        if (supplier) rememberSupplierProduct(supplier, code);
      }
      persist();closeModal();toast(isEdit?"Đã cập nhật mã chi":"Đã thêm mã chi");render({preserveScroll:true});
    });
  }

  function openCategoryFromIngredient(){
    const ingredients = state.ingredients||[];
    if(!ingredients.length){toast("Chưa có nguyên vật liệu để tạo mã chi");return;}
    const existingByIngredientId = new Map((state.categories || []).filter(category => category.ingredientId).map(category => [category.ingredientId, category]));
    modalContent.innerHTML=`<h2>Tạo mã chi từ bảng quy chuẩn NVL</h2><p>Chọn đúng quy cách sản phẩm. Hệ thống sẽ tạo mã COGS và gắn quy đổi ĐVT nhập → ĐVT kho cho phiếu chi/kho. Dòng đã có mã sẽ không tạo lại.</p><form id="category-from-ingredient-form"><div class="field"><label>Quy chuẩn NVL</label><select name="ingredient">${ingredients.map((x,index)=>{const existing=existingByIngredientId.get(x.id);return `<option value="${index}" ${existing?"disabled":""}>${escapeHtml(x.code || "NVL")} · ${escapeHtml(ingredientDisplayName(x))}${x.purchaseUnit || x.stockUnit ? ` · ${escapeHtml(x.purchaseUnit || "")}→${escapeHtml(x.conversionFactor || 1)} ${escapeHtml(x.stockUnit || "")}` : ""}${existing ? ` · đã có ${escapeHtml(existing.code)}` : ""}${x.supplier ? ` · gợi ý NCC: ${escapeHtml(x.supplier)}` : ""}</option>`;}).join("")}</select></div><div class="form-actions"><button class="primary-button">Tiếp tục</button></div></form>`;
    openModal();
    document.querySelector("#category-from-ingredient-form").addEventListener("submit",event=>{event.preventDefault();const index=Number(new FormData(event.currentTarget).get("ingredient"));const ingredient=ingredients[index];if(!ingredient){toast("Vui lòng chọn quy chuẩn NVL chưa có mã chi");return;}const existing=existingByIngredientId.get(ingredient.id);if(existing){toast(`Quy chuẩn này đã có mã ${existing.code}; không tạo trùng`);return;}closeModal();openCategoryEditor(null,ingredient);});
  }

  function deleteCategory(code){
    const used=(state.expenses||[]).some(x=>x.code===code);
    if(!window.confirm(`Xóa mã chi ${code}?${used?" Lịch sử chi đã ghi nhận sẽ được giữ nguyên.":""}`))return;
    state.categories=state.categories.filter(x=>x.code!==code);persist();toast("Đã xóa mã chi khỏi Danh mục");render({preserveScroll:true});
  }

  function openIngredientEditor(index=null){
    const isEdit=Number.isInteger(index);
    const value=isEdit?(state.ingredients||[])[index]:{id:"",code:nextIngredientSkuCode(),name:"",specification:"",supplier:"",purchaseUnit:"",conversionFactor:1,stockUnit:"",trackStock:true};
    const supplierOptions=supplierNames().map(name=>`<option value="${escapeHtml(name)}"></option>`).join("");
    modalContent.innerHTML=`<h2>${isEdit?"Sửa quy chuẩn NVL":"Thêm quy chuẩn NVL"}</h2><p>Thiết lập quy đổi một lần: kế toán nhập theo đơn vị trên hóa đơn, kho/bếp nhận theo đơn vị tồn chuẩn.</p><form id="ingredient-form"><div class="form-grid"><div class="field"><label>Mã NVL</label><input name="code" type="text" value="${escapeHtml(value.code || nextIngredientSkuCode())}" readonly></div>${field("Tên NVL","name","text",value.name,"Ví dụ: Pepsi",false)}${field("Quy cách","specification","text",value.specification||"","Ví dụ: Chai 1L / 650ml / Túi 1kg",true)}<div class="field"><label>ĐVT nhập</label><input name="purchaseUnit" type="text" list="ingredient-purchase-units" value="${escapeHtml(value.purchaseUnit||"")}" placeholder="chai, kg, quả...">${unitDatalist("ingredient-purchase-units")}</div><div class="field"><label>1 ĐVT nhập =</label><input name="conversionFactor" type="number" min="0" step="0.001" value="${escapeHtml(value.conversionFactor ?? 1)}" placeholder="Ví dụ: 1000"></div><div class="field"><label>ĐVT kho</label><input name="stockUnit" type="text" list="ingredient-stock-units" value="${escapeHtml(value.stockUnit||value.purchaseUnit||"")}" placeholder="ml, g, quả...">${unitDatalist("ingredient-stock-units")}</div><div class="field"><label>Theo dõi tồn kho?</label><select name="trackStock"><option value="true" ${value.trackStock!==false?"selected":""}>Có</option><option value="false" ${value.trackStock===false?"selected":""}>Không</option></select></div><div class="field full"><label>Nhà cung cấp gợi ý <small>(không bắt buộc)</small></label><input name="supplier" type="text" list="ingredient-supplier-list" value="${escapeHtml(value.supplier||"")}" placeholder="Chọn NCC đã có hoặc nhập NCC mới"><datalist id="ingredient-supplier-list">${supplierOptions}</datalist><small class="form-hint">NCC chỉ là gợi ý. Khi lập chi phí, kế toán vẫn chọn NCC thực tế trên hóa đơn.</small></div></div><p class="form-hint">Quy tắc: cùng tên nhưng quy cách khác nhau tạo mã NVL khác nhau. Ví dụ Pepsi chai 1L khác Pepsi chai 650ml.</p><div class="form-actions"><button class="primary-button">${isEdit?"Lưu quy chuẩn":"Thêm quy chuẩn"}</button></div></form>`;
    openModal();
    const form=document.querySelector("#ingredient-form");
    form.addEventListener("submit",event=>{
      event.preventDefault();
      const fd=new FormData(event.currentTarget);
      const name=String(fd.get("name")||"").trim();
      const code=String(fd.get("code")||"").trim().toUpperCase();
      const specification=String(fd.get("specification")||"").trim();
      const purchaseUnit=String(fd.get("purchaseUnit")||"").trim();
      const stockUnit=String(fd.get("stockUnit")||"").trim();
      const conversionFactor=num(fd.get("conversionFactor"));
      const supplierInput=String(fd.get("supplier")||"").trim();
      if(!name){toast("Vui lòng điền tên nguyên vật liệu");return;}
      if(!purchaseUnit||!stockUnit||conversionFactor<=0){toast("Vui lòng nhập ĐVT nhập, hệ số quy đổi và ĐVT kho hợp lệ");return;}
      const existingSupplier=supplierNames().find(existing=>normalizeCatalogText(existing)===normalizeCatalogText(supplierInput));
      const supplier=existingSupplier||supplierInput;
      const sameIngredient=(state.ingredients||[]).find((ingredient,ingredientIndex)=>ingredientIndex!==index&&normalizeCatalogText(ingredient.name)===normalizeCatalogText(name)&&normalizeCatalogText(ingredient.specification)===normalizeCatalogText(specification));
      if(sameIngredient){
        toast(`${name}${specification?` · ${specification}`:""} đã có mã ${sameIngredient.code || "NVL"}; không tạo dòng trùng`);
        return;
      }
      if(supplier&&!existingSupplier)state.suppliers.push(supplier);
      const saved={id:value.id||uid("ingredient"),code,name,specification,supplier,purchaseUnit,conversionFactor,stockUnit,trackStock:fd.get("trackStock")==="true"};
      if(isEdit)state.ingredients[index]={...state.ingredients[index],...saved};else state.ingredients.push(saved);
      persist();closeModal();toast(isEdit?"Đã cập nhật nguyên vật liệu":"Đã thêm nguyên vật liệu");render({preserveScroll:true});
    });
  }

  function deleteIngredient(index){
    const item=(state.ingredients||[])[index];if(!item)return;
    if(!window.confirm(`Xóa nguyên vật liệu “${item.name}” khỏi Danh mục?`))return;
    state.ingredients.splice(index,1);persist();toast("Đã xóa nguyên vật liệu khỏi Danh mục");render({preserveScroll:true});
  }

  function openSupplierEditor(originalName=null,{onSaved=null,selectedCodes=[]}={}){
    const isEdit=originalName!==null;
    const profile=supplierProfile(originalName||"");
    modalContent.innerHTML=`<h2>${isEdit?"Sửa nhà cung cấp":"Thêm nhà cung cấp"}</h2><p>Nhà cung cấp là danh mục độc lập. MST dùng để đối chiếu hóa đơn, công nợ và báo cáo thuế sau này.</p><form id="supplier-form"><div class="form-grid"><div class="field full"><label>Nhà cung cấp</label><input name="supplier" type="text" value="${escapeHtml(originalName||"")}" placeholder="Ví dụ: Công ty ABC" autofocus></div><div class="field full"><label>Mã số thuế <small>(không bắt buộc)</small></label><input name="taxCode" type="text" value="${escapeHtml(profile.taxCode||"")}" placeholder="Ví dụ: 0101234567"></div></div><div class="form-actions"><button class="primary-button">${isEdit?"Lưu thay đổi":"Thêm nhà cung cấp"}</button></div></form>`;
    openModal();
    document.querySelector("#supplier-form").addEventListener("submit",event=>{event.preventDefault();const fd=new FormData(event.currentTarget);const value=String(fd.get("supplier")||"").trim();const taxCode=String(fd.get("taxCode")||"").trim();if(!value){toast("Vui lòng nhập tên nhà cung cấp");return;}const existing=supplierNames().find(name=>normalizeCatalogText(name)===normalizeCatalogText(value));if(!isEdit&&existing){toast("Nhà cung cấp này đã tồn tại");return;}const replacement=isEdit?(existing||value):value;if(isEdit){state.suppliers=[...new Set(state.suppliers.filter(name=>normalizeCatalogText(name)!==normalizeCatalogText(originalName)).concat(replacement))];(state.expenses||[]).forEach(expense=>{if(normalizeCatalogText(expense.supplier)===normalizeCatalogText(originalName))expense.supplier=replacement;});(state.supplierAdvances||[]).forEach(advance=>{if(normalizeCatalogText(advance.supplier)===normalizeCatalogText(originalName))advance.supplier=replacement;});(state.supplierProducts||[]).forEach(link=>{if(normalizeCatalogText(link.supplier)===normalizeCatalogText(originalName))link.supplier=replacement;});(state.ingredients||[]).forEach(ingredient=>{if(normalizeCatalogText(ingredient.supplier)===normalizeCatalogText(originalName))ingredient.supplier=replacement;});state.supplierProfiles=(state.supplierProfiles||[]).filter(profile=>normalizeCatalogText(profile.name)!==normalizeCatalogText(originalName));}else state.suppliers.push(replacement);upsertSupplierProfile(replacement,taxCode);persist();closeModal();toast(isEdit?"Đã cập nhật nhà cung cấp":"Đã thêm nhà cung cấp");if(onSaved)onSaved(replacement);else render();});
  }

  function deleteSupplier(name){
    if((state.expenses||[]).some(expense=>normalizeCatalogText(expense.supplier)===normalizeCatalogText(name))||(state.supplierAdvances||[]).some(advance=>normalizeCatalogText(advance.supplier)===normalizeCatalogText(name))){toast("Không thể xóa NCC đã có hóa đơn hoặc tạm ứng; hãy sửa tên để chuẩn hóa dữ liệu");return;}
    if(!window.confirm(`Xóa nhà cung cấp “${name}” khỏi Danh mục?`))return;
    state.suppliers=state.suppliers.filter(x=>x!==name);state.supplierProfiles=(state.supplierProfiles||[]).filter(profile=>normalizeCatalogText(profile.name)!==normalizeCatalogText(name));state.supplierProducts=supplierProductLinks().filter(link=>link.supplier!==name);persist();toast("Đã xóa nhà cung cấp");render();
  }

  function openEmployeeEditor(employee=null,{onSaved=null}={}){
    const isEdit=Boolean(employee);
    const value=employee||{code:nextEmployeeCode(),name:"",role:"",active:true};
    modalContent.innerHTML=`<h2>${isEdit?"Sửa nhân viên":"Thêm nhân viên"}</h2><p>Mã nhân viên là định danh cố định để gắn chính xác hồ sơ bồi thường, lịch sử lương và hình thức chi trả.</p><form id="employee-form"><div class="form-grid">${field("Mã nhân viên","code","text",value.code,"Ví dụ: NV001")}${field("Họ và tên","name","text",value.name,"Ví dụ: Đinh Tuấn Anh")}${field("Chức danh","role","text",value.role||"","Ví dụ: Thu ngân")}<div class="field"><label>Trạng thái làm việc</label><select name="active"><option value="true" ${value.active!==false?"selected":""}>Đang làm việc</option><option value="false" ${value.active===false?"selected":""}>Đã nghỉ</option></select></div></div><div class="form-actions"><button class="primary-button">${isEdit?"Lưu thay đổi":"Thêm nhân viên"}</button></div></form>`;
    openModal();
    document.querySelector("#employee-form").addEventListener("submit",event=>{event.preventDefault();const fd=new FormData(event.currentTarget);const code=String(fd.get("code")||"").trim().toUpperCase(),name=String(fd.get("name")||"").trim(),role=String(fd.get("role")||"").trim(),active=fd.get("active")==="true";if(!code||!name){toast("Vui lòng nhập mã nhân viên và họ tên");return;}if((state.employees||[]).some(item=>item.code===code&&item!==employee)){toast(`Mã nhân viên ${code} đã tồn tại`);return;}const saved={code,name,role,active};let result=employee;if(employee){Object.assign(employee,saved);employeeClaims().filter(claim=>claim.employeeId===employee.id).forEach(claim=>{claim.employeeCode=employee.code;claim.employee=employee.name;});}else{result={id:uid("employee"),createdAt:Date.now(),...saved};state.employees.push(result);}persist();closeModal();toast(isEdit?"Đã cập nhật nhân viên":"Đã thêm nhân viên");if(onSaved)onSaved(result);else render();});
  }

  function deleteEmployee(employeeId){
    const employee=findEmployee(employeeId);if(!employee)return;
    if(employeeClaims().some(claim=>claim.employeeId===employee.id)){toast("Không thể xóa nhân viên đã có hồ sơ bồi thường; hãy giữ mã để tra cứu và khấu trừ chính xác");return;}
    if(!window.confirm(`Xóa nhân viên ${employeeLabel(employee)} khỏi Danh mục?`))return;
    state.employees=state.employees.filter(item=>item.id!==employee.id);persist();toast("Đã xóa nhân viên khỏi Danh mục");render();
  }

  function field(label,name,type,value="",placeholder="",full=false){return `<div class="field ${full?'full':''}"><label>${label}</label><input name="${name}" type="${type}" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}" ${type==='number'?'min="0" step="1"':''} ${name==='date'?'required':''}></div>`;}
  const sectionWithForm=(form,content,layoutClass="")=>`<div class="section-grid ${layoutClass}">${form}${content}</div>`;
  const tablePanel=(title,subtitle,body)=>`<div class="panel"><div class="panel-head"><div><h3>${title}</h3><p>${subtitle}</p></div></div><div class="table-wrap">${body}</div><div class="pagination-note">Hiển thị tối đa các dòng gần nhất trong kỳ đang chọn.</div></div>`;
  function table(headers,rows,moneyCols=[]){if(!rows.length)return '<div class="empty">Chưa có dữ liệu trong kỳ này.</div>';return `<table class="data-table"><thead><tr>${headers.map(x=>`<th>${x}</th>`).join("")}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map((cell,index)=>`<td data-label="${escapeHtml(headers[index] || "")}" class="${moneyCols.includes(index)?'money':''}">${cell??'—'}</td>`).join("")}</tr>`).join("")}</tbody></table>`;}

  function render({preserveScroll=false}={}){
    if (activeRole === OBSERVER_ROLE && OBSERVER_HIDDEN_VIEWS.has(view)) view = "dashboard";
    if (activeRole === KITCHEN_ROLE && !KITCHEN_ALLOWED_VIEWS.has(view)) view = "ingredients";
    repairAdvanceInvoiceSettlements();
    const previousScrollY=preserveScroll?window.scrollY:0;
    document.querySelectorAll("#nav button[data-view]").forEach(button=>button.classList.toggle("active",button.dataset.view===view));
    ({dashboard:renderDashboard,revenue:renderRevenue,apps:renderApps,expenses:renderExpenses,payroll:renderPayroll,debts:renderDebts,"supplier-advances":renderSupplierAdvances,"employee-claims":renderEmployeeClaims,funds:renderFunds,daily:renderDaily,pnl:renderPnl,ingredients:renderIngredients,"ingredient-waste":renderIngredientWaste,cost:renderCost,catalog:renderCatalog}[view]||renderDashboard)();
    updateDebtCount();updateEmployeeClaimCount();updateAppPendingCount();
    applyAccessControl();
    if(preserveScroll)requestAnimationFrame(()=>window.scrollTo({top:previousScrollY,behavior:"auto"}));
    else window.scrollTo({top:0,behavior:"smooth"});
  }
  function openModal({ kitchenAllowed = false } = {}){if(!canManage() && !(kitchenAllowed && activeRole === KITCHEN_ROLE)){toast(activeRole === KITCHEN_ROLE ? "Quyền Bếp chỉ được thao tác trong Kho hàng" : "Chế độ Nhân viên quan sát không thể mở chức năng chỉnh sửa");return false;}modal.classList.add("open");return true;} function closeModal(){modal.classList.remove("open");}
  function openQuick(){modalContent.innerHTML=`<h2>Nhập nhanh</h2><p>Chọn loại dữ liệu muốn ghi nhận.</p><div class="quick-grid"><button class="quick-choice" data-quick="revenue"><span>↗</span>Doanh thu quán</button><button class="quick-choice" data-quick="apps"><span>▣</span>Tiền App phải trả</button><button class="quick-choice" data-quick="expenses"><span>↘</span>Chi phí</button><button class="quick-choice" data-quick="funds"><span>⇄</span>Chuyển quỹ</button></div>`;openModal();document.querySelectorAll("[data-quick]").forEach(btn=>btn.addEventListener("click",()=>{view=btn.dataset.quick;closeModal();render();}));}
  async function exportData(){
    const button=document.querySelector("#export-button");
    const oldText=button.textContent;
    button.disabled=true; button.textContent="Đang tạo gói hồ sơ…";
    try {
      const response=await fetch("/api/export-package",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(exportStateForActiveRole())});
      if(!response.ok){const detail=await response.json().catch(()=>({}));throw new Error(detail.error||"Không thể tạo gói hồ sơ");}
      const blob=await response.blob();const url=URL.createObjectURL(blob);const a=document.createElement("a");
      a.href=url;a.download=`TAKO_HAIDUONG_${today}.zip`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
      toast(activeRole === KITCHEN_ROLE ? "Đã xuất gói hồ sơ phạm vi Kho hàng" : activeRole === OBSERVER_ROLE ? "Đã xuất gói hồ sơ theo quyền quan sát" : "Đã xuất gói hồ sơ gồm Excel và chứng từ");
    }catch(error){toast(`Lỗi xuất hồ sơ: ${error.message}`);}
    finally{button.disabled=false;button.textContent=oldText;}
  }

  async function syncOnlineSnapshot(){
    if (!canManage()) { toast("Chỉ Kế toán được đẩy dữ liệu online"); return; }
    const button=document.querySelector("#sync-online-button");
    const oldText=button?.textContent || "";
    if (button) { button.disabled=true; button.textContent="Đang đẩy online…"; }
    try {
      await saveServerState();
      const response=await fetch("/api/sync-online",{method:"POST"});
      const payload=await response.json().catch(()=>({}));
      if(!response.ok||payload.ok===false)throw new Error(payload.error||`HTTP ${response.status}`);
      toast("Đã đẩy dữ liệu local lên Supabase cho Nhân viên quan sát");
    } catch(error) {
      toast(`Lỗi đẩy online: ${error.message}`);
    } finally {
      if (button) { button.disabled=false; button.textContent=oldText; }
    }
  }

  function exportPdf(){
    const reportWindow = window.open("", "_blank");
    if (!reportWindow) { toast("Trình duyệt đang chặn cửa sổ báo cáo PDF. Hãy cho phép mở cửa sổ bật lên rồi thử lại."); return; }

    const d = periodData();
    const range = reportRangeLabel();
    const foodCost = d.groupMap.get(pnlGroupLabel("COGS")) || 0;
    const grossProfit = d.totalRevenue - foodCost;
    const cashAccounts = accounts(["cash", "bank"]);
    const paymentLedger = ledgerEntries().filter(item => inReportRange(item.date));
    const internalKinds = ["Chuyển quỹ", "Bàn giao", "Đổi tiền khách"];
    const actualFlow = paymentLedger.filter(item => cashAccounts.some(account => account.id === item.accountId) && !internalKinds.includes(item.kind));
    const cashIn = sum(actualFlow.filter(item => item.amount > 0), "amount");
    const cashOut = Math.abs(sum(actualFlow.filter(item => item.amount < 0), "amount"));
    const pendingApp = sum(appSalesWaitingForWithdrawal(reportEnd()), "net") + sum(appPayoutsWaitingForPayment(reportEnd()), payoutNet);
    const openMisreceived = sum(misreceivedCases().filter(item => item.date <= reportEnd()), item => Math.max(0, num(item.amount) - refundedForMisreceivedCase(item.id)));
    const reconciled = cashAccounts.map(account => ({ account, item: newestFirst((state.reconciliations || []).filter(record => record.accountId === account.id && record.date <= reportEnd()))[0] })).filter(item => item.item);
    const reconciliationVariance = sum(reconciled, item => Math.abs(num(item.item.actual) - accountBalance(item.account.id, item.item.date)));
    const expenseGroups = [...d.groupMap.entries()].filter(([, amount]) => amount > 0).sort((a,b) => b[1] - a[1]);
    const expenseRows = newestFirst(d.pnlExpenses).slice(0, 12);
    const balanceCards = cashAccounts.map(account => `<article class="balance-card"><span>${escapeHtml(account.name)}</span><strong>${money(accountBalance(account.id, reportEnd()))}</strong></article>`).join("");
    const groupRows = expenseGroups.length ? expenseGroups.map(([group, amount]) => `<tr><td>${escapeHtml(group)}</td><td>${money(amount)}</td><td>${pct(d.totalRevenue ? amount / d.totalRevenue : 0)}</td><td>${pct(d.totalExpenses ? amount / d.totalExpenses : 0)}</td></tr>`).join("") : '<tr><td colspan="4" class="empty-cell">Chưa có chi phí P&L trong phạm vi báo cáo.</td></tr>';
    const expenseDetailRows = expenseRows.length ? expenseRows.map(item => `<tr><td>${dateVi(item.date)}</td><td>${escapeHtml(item.code || "—")}</td><td>${escapeHtml(item.description || "—")}</td><td>${escapeHtml(item.supplier || "Không gắn NCC")}</td><td>${money(item.amount)}</td></tr>`).join("") : '<tr><td colspan="5" class="empty-cell">Chưa có khoản chi P&L trong phạm vi báo cáo.</td></tr>';
    const alerts = [
      ["Tiền App chờ về", pendingApp, pendingApp ? "Cần theo dõi các dòng chưa yêu cầu rút hoặc đợt chờ App thanh toán." : "Không còn tiền chờ App."],
      ["Công nợ NCC còn mở", d.debt, d.debt ? "Hóa đơn NCC chưa thanh toán hết." : "Không còn công nợ NCC."],
      ["Chênh lệch quỹ / ngân hàng", reconciliationVariance, reconciled.length ? `${reconciled.length}/${cashAccounts.length} quỹ / tài khoản đã có đối soát.` : "Chưa có quỹ / tài khoản nào được đối soát trong phạm vi."],
      ["Tiền nhận nhầm chờ hoàn", openMisreceived, openMisreceived ? "Cần hoàn khi đủ chứng từ giao dịch gốc." : "Không có hồ sơ nhận nhầm chờ hoàn."],
    ].map(([label, amount, description]) => `<article class="alert ${amount ? "warning" : "ok"}"><div><strong>${escapeHtml(label)}</strong><small>${escapeHtml(description)}</small></div><b>${money(amount)}</b></article>`).join("");
    const generatedAt = new Intl.DateTimeFormat("vi-VN", { dateStyle:"medium", timeStyle:"short" }).format(new Date());
    const html = `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>TAKO_HAIDUONG - Báo cáo ${escapeHtml(range)}</title><style>
      @page { size: A4; margin: 11mm; }
      * { box-sizing:border-box; } body { margin:0; color:#17241d; font-family:Arial,"Segoe UI",sans-serif; font-size:10px; line-height:1.4; } h1,h2,h3,p { margin:0; } .report-header { padding-bottom:13px; margin-bottom:14px; border-bottom:2px solid #111111; } .brand { color:#e60012; font-size:9px; font-weight:700; letter-spacing:.11em; } h1 { margin-top:3px; font-size:22px; letter-spacing:-.03em; } .meta { margin-top:5px; color:#6d7e74; font-size:10px; } .kpis { display:grid; grid-template-columns:repeat(4,1fr); gap:8px; margin-bottom:12px; } .kpi { min-height:75px; padding:10px; border:1px solid #d9ddd7; border-radius:8px; background:#fbfcfa; } .kpi span { display:block; color:#6d7e74; font-size:8px; font-weight:700; text-transform:uppercase; letter-spacing:.04em; } .kpi strong { display:block; margin-top:7px; color:#111111; font-size:15px; letter-spacing:-.02em; } .kpi.cost strong { color:#e60012; } .kpi small { display:block; margin-top:3px; color:#6d7e74; } .section { margin-top:12px; padding:12px; border:1px solid #d9ddd7; border-radius:9px; break-inside:avoid; } .section h2 { font-size:14px; } .section > p { margin-top:2px; color:#6d7e74; } .grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; } .summary-row { display:grid; grid-template-columns:1fr auto auto; gap:10px; align-items:center; padding:7px 0; border-bottom:1px solid #edf0eb; } .summary-row:last-child { border-bottom:0; } .summary-row strong { font-size:11px; text-align:right; } .summary-row span:last-child { width:48px; text-align:right; color:#6d7e74; } .summary-row.highlight { padding:8px; margin:3px -3px; border:1px solid #b8d2be; border-radius:6px; background:#edf5ee; color:#111111; } .summary-row.cost strong { color:#e60012; } .balance-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:7px; margin-top:9px; } .balance-card { padding:9px; border-radius:7px; background:#f5f7f3; border:1px solid #d9ddd7; } .balance-card span { display:block; color:#6d7e74; } .balance-card strong { display:block; margin-top:4px; color:#111111; font-size:12px; } .alerts { display:grid; grid-template-columns:1fr 1fr; gap:7px; margin-top:9px; } .alert { min-height:54px; display:flex; justify-content:space-between; gap:8px; padding:8px; border:1px solid #d9ddd7; border-radius:7px; } .alert small { display:block; margin-top:2px; color:#6d7e74; } .alert b { white-space:nowrap; color:#111111; align-self:center; } .alert.warning { border-color:#efc5b1; background:#fff8f4; } .alert.warning b { color:#e60012; } table { width:100%; border-collapse:collapse; margin-top:9px; } th { text-align:left; color:#6d7e74; font-size:8px; text-transform:uppercase; letter-spacing:.03em; } th,td { padding:6px 5px; border-bottom:1px solid #d9ddd7; } td:nth-child(n+2), th:nth-child(n+2) { text-align:right; } .detail-table td:nth-child(3), .detail-table th:nth-child(3), .detail-table td:nth-child(4), .detail-table th:nth-child(4) { text-align:left; } .empty-cell { text-align:center !important; color:#6d7e74; padding:12px; } .footer { display:flex; justify-content:space-between; gap:12px; margin-top:13px; color:#6d7e74; font-size:8px; } @media print { .no-print { display:none; } }
    </style></head><body><header class="report-header"><div class="brand">TAKO HẢI DƯƠNG · BÁO CÁO QUẢN TRỊ</div><h1>Báo cáo tình trạng tháng</h1><div class="meta">Phạm vi: <strong>${escapeHtml(range)}</strong> · Lập lúc ${escapeHtml(generatedAt)}</div></header>
    <section class="kpis"><article class="kpi"><span>Tổng doanh thu</span><strong>${money(d.totalRevenue)}</strong><small>Tại quán ${money(d.storeRevenue)} · App ${money(d.appGross)}</small></article><article class="kpi cost"><span>Chi phí P&L</span><strong>${money(d.totalExpenses)}</strong><small>${d.pnlExpenses.length} khoản chi trong kỳ</small></article><article class="kpi"><span>Lợi nhuận thuần</span><strong>${money(d.profit)}</strong><small>Biên lợi nhuận ${pct(d.totalRevenue ? d.profit / d.totalRevenue : 0)}</small></article><article class="kpi"><span>Dòng tiền thuần</span><strong>${money(cashIn - cashOut)}</strong><small>Vào ${money(cashIn)} · Ra ${money(cashOut)}</small></article></section>
    <div class="grid"><section class="section"><h2>Kết quả kinh doanh P&L</h2><p>Ghi nhận theo kỳ phát sinh.</p><div class="summary-row"><span>Doanh thu tại quán</span><strong>${money(d.storeRevenue)}</strong><span>${pct(d.totalRevenue ? d.storeRevenue/d.totalRevenue : 0)}</span></div><div class="summary-row"><span>Doanh thu App</span><strong>${money(d.appGross)}</strong><span>${pct(d.totalRevenue ? d.appGross/d.totalRevenue : 0)}</span></div><div class="summary-row highlight"><span>Tổng doanh thu</span><strong>${money(d.totalRevenue)}</strong><span>100%</span></div><div class="summary-row cost"><span>Giá vốn TP/NL</span><strong>${money(foodCost)}</strong><span>${pct(d.totalRevenue ? foodCost/d.totalRevenue : 0)}</span></div><div class="summary-row highlight"><span>Lợi nhuận gộp</span><strong>${money(grossProfit)}</strong><span>${pct(d.totalRevenue ? grossProfit/d.totalRevenue : 0)}</span></div><div class="summary-row cost"><span>Tổng chi phí P&L</span><strong>${money(d.totalExpenses)}</strong><span>${pct(d.totalRevenue ? d.totalExpenses/d.totalRevenue : 0)}</span></div><div class="summary-row highlight"><span>Lợi nhuận thuần</span><strong>${money(d.profit)}</strong><span>${pct(d.totalRevenue ? d.profit/d.totalRevenue : 0)}</span></div></section><section class="section"><h2>Dòng tiền & số dư cuối kỳ</h2><p>Tiền thực nhận và thực chi trong phạm vi.</p><div class="summary-row"><span>Tiền vào thực</span><strong>${money(cashIn)}</strong><span>—</span></div><div class="summary-row cost"><span>Tiền ra thực</span><strong>${money(cashOut)}</strong><span>—</span></div><div class="summary-row highlight"><span>Dòng tiền thuần</span><strong>${money(cashIn-cashOut)}</strong><span>—</span></div><div class="balance-grid">${balanceCards}</div></section></div>
    <section class="section"><h2>Cảnh báo vận hành</h2><p>Các khoản cần xử lý hoặc đối chiếu.</p><div class="alerts">${alerts}</div></section>
    <section class="section"><h2>Chi phí theo nhóm P&L</h2><p>Tỷ trọng tính trên doanh thu và tổng chi phí P&L của phạm vi báo cáo.</p><table><thead><tr><th>Nhóm P&L</th><th>Giá trị</th><th>% DT</th><th>% CP</th></tr></thead><tbody>${groupRows}</tbody></table></section>
    <section class="section"><h2>12 khoản chi P&L gần nhất</h2><p>Dùng để rà soát giao dịch chi tiêu phát sinh trong tháng.</p><table class="detail-table"><thead><tr><th>Ngày</th><th>Mã chi</th><th>Diễn giải</th><th>Nhà cung cấp</th><th>Giá trị</th></tr></thead><tbody>${expenseDetailRows}</tbody></table></section>
    <footer class="footer"><span>Báo cáo nội bộ - TAKO HẢI DƯƠNG</span><span>Chọn Save as PDF trong hộp thoại in để lưu file.</span></footer><script>window.addEventListener('load',()=>setTimeout(()=>window.print(),300));<\/script></body></html>`;
    reportWindow.document.open();
    reportWindow.document.write(html);
    reportWindow.document.close();
  }

  document.querySelector("#nav").addEventListener("click",event=>{const button=event.target.closest("button[data-view]");if(!button)return;view=button.dataset.view;document.querySelector("#sidebar").classList.remove("open");render();});
  document.addEventListener("click",event=>{const input=event.target.closest('input[type="date"], input[type="month"]');if(!input||typeof input.showPicker!=="function")return;try{input.showPicker();}catch(_error){/* Trình duyệt sẽ dùng bộ chọn mặc định nếu không hỗ trợ. */}});
  periodInput.addEventListener("change",()=>{const bounds=monthBounds(periodInput.value);reportStartInput.value=bounds.start;reportEndInput.value=bounds.end;render();});
  reportStartInput.addEventListener("change",()=>{if(!reportStartInput.value)return;if(reportEndInput.value&&reportStartInput.value>reportEndInput.value)reportEndInput.value=reportStartInput.value;periodInput.value=reportStartInput.value.slice(0,7);render();});
  reportEndInput.addEventListener("change",()=>{if(!reportEndInput.value)return;if(reportStartInput.value&&reportEndInput.value<reportStartInput.value)reportStartInput.value=reportEndInput.value;periodInput.value=reportStartInput.value.slice(0,7);render();});
  const actionDropdown = document.querySelector("#top-action-dropdown");
  const actionMenuButton = document.querySelector("#action-menu-button");
  const closeActionMenu = () => {
    actionDropdown?.classList.remove("open");
    actionMenuButton?.setAttribute("aria-expanded", "false");
  };
  actionMenuButton?.addEventListener("click", event => {
    event.stopPropagation();
    const isOpen = actionDropdown?.classList.toggle("open");
    actionMenuButton.setAttribute("aria-expanded", String(Boolean(isOpen)));
  });
  document.addEventListener("click", event => {
    if (!event.target.closest("#top-action-dropdown")) closeActionMenu();
  });
  document.querySelector("#quick-add").addEventListener("click",()=>{closeActionMenu();openQuick();});
  document.querySelector("#sync-online-button")?.addEventListener("click",()=>{closeActionMenu();syncOnlineSnapshot();});
  document.querySelector("#export-button").addEventListener("click",()=>{closeActionMenu();exportData();});
  document.querySelector("#export-pdf-button").addEventListener("click",()=>{closeActionMenu();exportPdf();});
  accessRoleButton.addEventListener("click", showCurrentRoleMenu);
  lockSessionButton.addEventListener("click", lockSession);
  document.addEventListener("click", blockObserverMutation, true);
  document.addEventListener("submit", blockObserverMutation, true);
  document.querySelector("#modal-close").addEventListener("click",closeModal);
  modal.addEventListener("click",event=>{if(event.target===modal)closeModal();});
  document.querySelector("#menu-button").addEventListener("click",()=>document.querySelector("#sidebar").classList.toggle("open"));
  const mobileTopbar = document.querySelector(".topbar");
  let mobileTopbarFrame = 0;
  const syncMobileTopbar = () => {
    mobileTopbarFrame = 0;
    const compact = window.innerWidth <= 720 && window.scrollY > 72;
    mobileTopbar?.classList.toggle("mobile-compact", compact);
  };
  const requestMobileTopbarSync = () => {
    if (mobileTopbarFrame) return;
    mobileTopbarFrame = requestAnimationFrame(syncMobileTopbar);
  };
  window.addEventListener("scroll", requestMobileTopbarSync, { passive: true });
  window.addEventListener("resize", requestMobileTopbarSync, { passive: true });
  syncMobileTopbar();
  syncRoleUi();
  render();
  if (!activeRole) {
    accessGate.classList.add("open");
    accessGateContent.innerHTML = `<div class="access-gate-brand">TAKO HẢI DƯƠNG</div><h2 id="access-gate-title">Đang kiểm tra quyền truy cập</h2><p>Đang tải cấu hình PIN theo vai trò từ server…</p>`;
  }
  loadServerState().finally(() => {
    if (!activeRole) {
      accessGate.classList.add("open");
      showRoleChoice();
    }
  });
})();
