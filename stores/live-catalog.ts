import type { Product } from "../lib/domain";
// Only identity and package facts belong here. Prices/stock always come from HTTP.
export const liveProducts: Product[] = [
  [
    "live-esp32-30",
    "ESP32 30 Pin CP2102 Geliştirme Kartı",
    "Geliştirme kartları",
    "Robotistan",
    "ESP32-30PIN-CP2102",
  ],
  [
    "live-esp32-direnc",
    "ESP32-WROOM-32D Geliştirme Board (Direnc.net)",
    "Geliştirme kartları",
    "Espressif",
    "",
  ],
  [
    "live-ne555-hxy",
    "NE555P DIP8 Zamanlayıcı (Hxy)",
    "Entegreler",
    "Hxy",
    "NE555P",
  ],
  [
    "live-ams1117",
    "AMS1117 3.3V SOT223 · marka tercihsiz",
    "Güç & regülatör",
    "",
    "AMS1117-3.3",
  ],
  [
    "live-res1k",
    "1KΩ 1/4W THT Direnç · tolerans belirtilmemiş",
    "Pasif komponentler",
    "",
    "",
  ],
  [
    "live-cap100n",
    "100nF 50V 2.5mm Multilayer Kondansatör",
    "Pasif komponentler",
    "",
    "",
  ],
].map(([id, name, category, manufacturer, mpn]) => ({
  id,
  name,
  category,
  manufacturer,
  mpn,
  model: mpn,
  description:
    "Mağaza sayfasıyla doğrulanan ürün. Özellikle üretici, pin dizilimi ve tolerans gereksinimlerinizi kontrol edin.",
  image: null,
  specifications: "{}",
  unit_type: "adet",
  package_quantity: 1,
  created_at: "2026-09-29T00:00:00.000Z",
}));
export type LiveSource = {
  productId: string;
  storeId: string;
  path: string;
  title: RegExp;
  packageQuantity: number;
};
export const liveSources: LiveSource[] = [
  {
    productId: "hcsr04",
    storeId: "direnc",
    path: "/arduino-ultrasonic-sensor-hc-sr04",
    title: /HC.?SR04.*Sensör/i,
    packageQuantity: 1,
  },
  {
    productId: "hcsr04",
    storeId: "robotistan",
    path: "/hc-sr04-ultrasonik-mesafe-sensoru",
    title: /HC.?SR04.*Sensör/i,
    packageQuantity: 1,
  },
  {
    productId: "sg90",
    storeId: "direnc",
    path: "/sg90-9g-servo-motor-1",
    title: /SG90.*Servo/i,
    packageQuantity: 1,
  },
  {
    productId: "sg90",
    storeId: "robotistan",
    path: "/tower-pro-sg90-rc-mini-servo-motor",
    title: /SG90.*Servo/i,
    packageQuantity: 1,
  },
  {
    productId: "mpu6050",
    storeId: "direnc",
    path: "/mpu6050-3-axis-gyro-ve-egim-sensoru",
    title: /MPU.?6050.*Sensör/i,
    packageQuantity: 1,
  },
  {
    productId: "mpu6050",
    storeId: "robotistan",
    path: "/mpu6050-6-eksen-ivme-ve-gyro-sensoru-6-dof-3-axis-accelerometer-and-gyros",
    title: /MPU.?6050.*Sensör/i,
    packageQuantity: 1,
  },
  {
    productId: "live-esp32-30",
    storeId: "robotistan",
    path: "/esp32-esp-32s-wifi-bluetooth-dual-mode-gelistirme-karti",
    title: /ESP32.*30\s*Pin/i,
    packageQuantity: 1,
  },
  {
    productId: "live-esp32-direnc",
    storeId: "direnc",
    path: "/esp32-wroom-32d-wifi-bluetooth-gelistirme-board",
    title: /ESP32.WROOM.32D/i,
    packageQuantity: 1,
  },
  {
    productId: "live-ne555-hxy",
    storeId: "robotistan",
    path: "/ne555-dip8",
    title: /NE555P.*DIP.?8/i,
    packageQuantity: 1,
  },
  {
    productId: "live-ams1117",
    storeId: "direnc",
    path: "/ams1117-smd-3v3-dogrusal-voltaj-regulatoru",
    title: /AMS1117.*3[.,]3V.*SOT.?223/i,
    packageQuantity: 1,
  },
  {
    productId: "live-ams1117",
    storeId: "robotistan",
    path: "/ams1117-33-sot23",
    title: /AMS1117.*3[.,]3V.*SOT.?223/i,
    packageQuantity: 1,
  },
  {
    productId: "live-res1k",
    storeId: "direnc",
    path: "/1k-14w-direnc",
    title: /1K.*1\/4W.*Direnç/i,
    packageQuantity: 1,
  },
  {
    productId: "live-res1k",
    storeId: "robotistan",
    path: "/14w-1k-direnc-paketi-10-adet",
    title: /1\/4\s*W.*1K.*Direnç/i,
    packageQuantity: 1,
  },
  {
    productId: "live-cap100n",
    storeId: "direnc",
    path: "/100nf-63v-25mm-multilayer",
    title: /100nF.*50V.*2[.,]5mm/i,
    packageQuantity: 1,
  },
];
export const liveStarter = [
  ["hcsr04", 3],
  ["sg90", 2],
  ["mpu6050", 1],
  ["live-ams1117", 5],
  ["live-res1k", 100],
] as const;
