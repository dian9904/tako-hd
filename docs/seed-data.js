window.TAKO_SEED = {
  "version": 2,
  "transactionCleanupVersion": 1,
  "supplierAdvanceCleanupVersion": 1,
  "fundAccountCleanupVersion": 1,
  "categories": [],
  "ingredients": [],
  "supplierProducts": [],
  "suppliers": [],
  "employees": [],
  "menuItems": [],
  "sources": [
    "Tiền mặt",
    "Chuyển khoản"
  ],
  "apps": [
    "Grab",
    "Shopee",
    "Xanh",
    "Bee",
    "Capichi",
    "Khác"
  ],
  "revenues": [],
  "appSales": [],
  "appPayouts": [],
  "expenses": [],
  "payrolls": [],
  "employeeClaims": [],
  "supplierAdvances": [],
  "fixedAssets": [],
  "inventoryMovements": [],
  "fundTransactions": [],
  "reconciliations": [],
  "accounts": [
    {
      "id": "cash-operating",
      "name": "Tiền mặt vận hành",
      "type": "cash",
      "openingBalance": 0,
      "active": true,
      "system": true
    },
    {
      "id": "cash-management",
      "name": "Két tổng / Quản lý",
      "type": "cash",
      "openingBalance": 0,
      "active": true,
      "system": true
    },
    {
      "id": "bank-restaurant",
      "name": "Tài khoản ngân hàng",
      "type": "bank",
      "openingBalance": 0,
      "active": true,
      "system": true
    },
    {
      "id": "app-clearing",
      "name": "App chờ đối soát",
      "type": "app",
      "openingBalance": 0,
      "active": true,
      "system": true
    }
  ],
  "accountDefaults": {
    "cash": "cash-operating",
    "handover": "cash-management",
    "bank": "bank-restaurant",
    "app": "app-clearing"
  }
};
