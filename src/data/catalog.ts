import type { Category, Product, ProductVariant, Review } from "../types";

export const categories: Category[] = [
  { id: "digital", name: "数码配件", slug: "digital", description: "耳机、音箱、影像与智能设备", icon: "Headphones", accent: "#6c5ce7" },
  { id: "computing", name: "电脑办公", slug: "computing", description: "效率设备与桌面生产力", icon: "Laptop", accent: "#0984e3" },
  { id: "home", name: "家居厨房", slug: "home", description: "让日常空间更舒适", icon: "House", accent: "#00b894" },
  { id: "wellness", name: "个护健康", slug: "wellness", description: "日常护理与健康生活", icon: "HeartPulse", accent: "#e84393" },
  { id: "outdoor", name: "运动户外", slug: "outdoor", description: "训练、旅行与户外探索", icon: "Bike", accent: "#e17055" },
  { id: "fashion", name: "服饰箱包", slug: "fashion", description: "通勤、旅行与日常穿搭", icon: "Shirt", accent: "#fd79a8" },
  { id: "grocery", name: "食品饮品", slug: "grocery", description: "咖啡、零食与品质食品", icon: "Coffee", accent: "#b7791f" },
  { id: "books", name: "图书创意", slug: "books", description: "阅读、文具与灵感好物", icon: "BookOpen", accent: "#2d3436" },
];

type Seed = {
  title: string;
  brand: string;
  categoryId: string;
  price: number;
  image: string;
  subtitle: string;
  specs: Record<string, string>;
};

const image = (id: string) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1200&q=82`;

const seeds: Seed[] = [
  { title: "Aurora X1 降噪头戴耳机", brand: "Aurora", categoryId: "digital", price: 129900, image: image("photo-1505740420928-5e560c06d30e"), subtitle: "40 小时续航 · 自适应降噪", specs: { 连接: "蓝牙 5.3", 续航: "40 小时", 重量: "245g" } },
  { title: "Sonic Mini 桌面蓝牙音箱", brand: "Sonic", categoryId: "digital", price: 39900, image: image("photo-1608043152269-423dbba4e7e1"), subtitle: "小体积立体声 · USB-C", specs: { 功率: "20W", 防水: "IPX5", 连接: "蓝牙 5.2" } },
  { title: "Lumina 便携数码相机", brand: "Lumina", categoryId: "digital", price: 329900, image: image("photo-1516035069371-29a1b244cc32"), subtitle: "轻巧机身 · 4K 视频", specs: { 传感器: "2400 万像素", 视频: "4K 30fps", 重量: "388g" } },
  { title: "Halo S 智能运动手表", brand: "Halo", categoryId: "digital", price: 89900, image: image("photo-1523275335684-37898b6baf30"), subtitle: "全天候健康监测 · 双频定位", specs: { 屏幕: "1.9 英寸", 防水: "5ATM", 续航: "12 天" } },
  { title: "Orbit Mag 三合一充电座", brand: "Orbit", categoryId: "digital", price: 32900, image: image("photo-1587033411391-5d9e51cce126"), subtitle: "手机、耳机、手表同时充", specs: { 输出: "15W", 接口: "USB-C", 材质: "铝合金" } },

  { title: "Atlas Pro 14 轻薄笔记本", brand: "Atlas", categoryId: "computing", price: 699900, image: image("photo-1496181133206-80ce9b88a853"), subtitle: "高性能轻薄本 · 2.8K 高刷屏", specs: { 屏幕: "14 英寸 120Hz", 内存: "32GB", 存储: "1TB SSD" } },
  { title: "Keycraft 75 机械键盘", brand: "Keycraft", categoryId: "computing", price: 59900, image: image("photo-1587829741301-dc798b83add3"), subtitle: "三模连接 · 热插拔轴体", specs: { 配列: "75%", 连接: "有线/蓝牙/2.4G", 背光: "RGB" } },
  { title: "Glide X 人体工学鼠标", brand: "Glide", categoryId: "computing", price: 29900, image: image("photo-1527814050087-3793815479db"), subtitle: "静音微动 · 多设备切换", specs: { DPI: "8000", 重量: "82g", 连接: "蓝牙/2.4G" } },
  { title: "Canvas 27 4K 显示器", brand: "Canvas", categoryId: "computing", price: 239900, image: image("photo-1527443224154-c4a3942d3acf"), subtitle: "专业色彩 · USB-C 反向充电", specs: { 尺寸: "27 英寸", 分辨率: "3840×2160", 色域: "98% DCI-P3" } },
  { title: "Dockline 12 合 1 扩展坞", brand: "Dockline", categoryId: "computing", price: 46900, image: image("photo-1625842268584-8f3296236761"), subtitle: "双屏扩展 · 千兆网口", specs: { 接口: "12 个", 视频: "双 4K", 供电: "100W PD" } },

  { title: "Nest Lounge 休闲单椅", brand: "Nest", categoryId: "home", price: 159900, image: image("photo-1503602642458-232111445657"), subtitle: "高回弹坐感 · 可拆洗面料", specs: { 材质: "白蜡木/织物", 承重: "150kg", 安装: "简易组装" } },
  { title: "Aster 极简桌面台灯", brand: "Aster", categoryId: "home", price: 26900, image: image("photo-1507473885765-e6ed057f782c"), subtitle: "无频闪调光 · 自动感光", specs: { 色温: "2700–5000K", 功率: "12W", 控制: "触控" } },
  { title: "Mori 恒温手冲壶", brand: "Mori", categoryId: "home", price: 49900, image: image("photo-1517668808822-9ebb02f2a0e6"), subtitle: "精准控温 · 细口稳定水流", specs: { 容量: "0.8L", 温控: "40–100℃", 功率: "1200W" } },
  { title: "PureMist 静音加湿器", brand: "PureMist", categoryId: "home", price: 35900, image: image("photo-1585771724684-38269d6639fd"), subtitle: "上加水 · 恒湿模式", specs: { 容量: "4.5L", 噪音: "28dB", 适用: "25㎡" } },
  { title: "Folden 模块收纳边柜", brand: "Folden", categoryId: "home", price: 89900, image: image("photo-1555041469-a586c61ea9bc"), subtitle: "灵活分区 · 环保板材", specs: { 宽度: "120cm", 材质: "实木贴皮", 层数: "3 层" } },

  { title: "Silva 声波洁面仪", brand: "Silva", categoryId: "wellness", price: 39900, image: image("photo-1596462502278-27bfdc403348"), subtitle: "柔和清洁 · 低敏硅胶", specs: { 档位: "8 档", 防水: "IPX7", 续航: "90 天" } },
  { title: "Breeze 负离子吹风机", brand: "Breeze", categoryId: "wellness", price: 69900, image: image("photo-1522338242992-e1a54906a8da"), subtitle: "高速干发 · 智能温控", specs: { 转速: "11 万转", 功率: "1600W", 重量: "390g" } },
  { title: "CalmWave 肩颈按摩仪", brand: "CalmWave", categoryId: "wellness", price: 45900, image: image("photo-1571019613454-1cb2f99b2d8b"), subtitle: "热敷揉捏 · 无线使用", specs: { 模式: "3 种", 温度: "42℃", 续航: "120 分钟" } },
  { title: "AquaPulse 便携冲牙器", brand: "AquaPulse", categoryId: "wellness", price: 32900, image: image("photo-1609840114035-3c981b782dfe"), subtitle: "四档水压 · 旅行收纳", specs: { 水箱: "220ml", 档位: "4 档", 防水: "IPX7" } },
  { title: "RestLab 助眠香氛机", brand: "RestLab", categoryId: "wellness", price: 23900, image: image("photo-1608571423902-eed4a5ad8108"), subtitle: "低噪扩香 · 暖光夜灯", specs: { 容量: "300ml", 定时: "1/3/6h", 噪音: "25dB" } },

  { title: "TerraFlow 缓震跑鞋", brand: "TerraFlow", categoryId: "outdoor", price: 69900, image: image("photo-1542291026-7eec264c27ff"), subtitle: "轻量回弹 · 日常训练", specs: { 鞋面: "工程网布", 中底: "复合泡棉", 落差: "8mm" } },
  { title: "Trailmark 28L 徒步背包", brand: "Trailmark", categoryId: "outdoor", price: 52900, image: image("photo-1553062407-98eeb64c6a62"), subtitle: "透气背负 · 防泼水", specs: { 容量: "28L", 重量: "980g", 面料: "尼龙" } },
  { title: "PeakLite 碳纤维登山杖", brand: "PeakLite", categoryId: "outdoor", price: 36900, image: image("photo-1551632811-561732d1e306"), subtitle: "快速锁定 · 双杖套装", specs: { 材质: "碳纤维", 长度: "65–135cm", 重量: "210g/支" } },
  { title: "Motion Pro 瑜伽垫", brand: "Motion", categoryId: "outdoor", price: 25900, image: image("photo-1592432678016-e910b452f9a2"), subtitle: "天然橡胶 · 防滑回弹", specs: { 厚度: "5mm", 尺寸: "183×68cm", 重量: "2.8kg" } },
  { title: "Nomad 保温运动水壶", brand: "Nomad", categoryId: "outdoor", price: 19900, image: image("photo-1602143407151-7111542de6e8"), subtitle: "24 小时保冷 · 单手开盖", specs: { 容量: "750ml", 材质: "316 不锈钢", 保温: "12 小时" } },

  { title: "Urban Day 通勤双肩包", brand: "Urban Day", categoryId: "fashion", price: 42900, image: image("photo-1553062407-98eeb64c6a62"), subtitle: "独立电脑仓 · 防泼水", specs: { 容量: "20L", 电脑仓: "16 英寸", 面料: "再生尼龙" } },
  { title: "Loom 羊毛混纺围巾", brand: "Loom", categoryId: "fashion", price: 23900, image: image("photo-1520903920243-00d872a2d1c9"), subtitle: "细腻亲肤 · 双面配色", specs: { 材质: "羊毛混纺", 尺寸: "190×35cm", 工艺: "精纺" } },
  { title: "Avenue 轻量通勤鞋", brand: "Avenue", categoryId: "fashion", price: 59900, image: image("photo-1543163521-1bf539c55dd2"), subtitle: "柔软皮面 · 全天舒适", specs: { 鞋面: "头层牛皮", 鞋底: "橡胶", 跟高: "3cm" } },
  { title: "Frame 偏光太阳镜", brand: "Frame", categoryId: "fashion", price: 32900, image: image("photo-1511499767150-a48a237f0083"), subtitle: "UV400 · 轻量镜架", specs: { 镜片: "偏光", 镜架: "TR90", 重量: "22g" } },
  { title: "Canvas Utility 工装外套", brand: "Canvas Wear", categoryId: "fashion", price: 72900, image: image("photo-1551028719-00167b16eac5"), subtitle: "立体剪裁 · 多口袋", specs: { 面料: "棉质帆布", 版型: "宽松", 厚度: "中等" } },

  { title: "RoastLab 精品咖啡豆", brand: "RoastLab", categoryId: "grocery", price: 12800, image: image("photo-1495474472287-4d71bcdd2085"), subtitle: "埃塞俄比亚水洗 · 花果香", specs: { 净含量: "250g", 烘焙度: "浅中烘", 处理法: "水洗" } },
  { title: "Cocoa Field 黑巧礼盒", brand: "Cocoa Field", categoryId: "grocery", price: 9900, image: image("photo-1575377427642-087cf684f29d"), subtitle: "四种产地 · 低糖配方", specs: { 净含量: "180g", 可可: "70%–85%", 数量: "18 片" } },
  { title: "Orchard 每日坚果组合", brand: "Orchard", categoryId: "grocery", price: 15900, image: image("photo-1599599810694-b5b37304c041"), subtitle: "30 日独立包装 · 轻烘焙", specs: { 净含量: "750g", 包装: "25g×30", 配料: "6 种坚果果干" } },
  { title: "Leaf & Dew 冷泡茶包", brand: "Leaf & Dew", categoryId: "grocery", price: 7900, image: image("photo-1597481499750-3e6b22637e12"), subtitle: "三种风味 · 无糖茶", specs: { 数量: "20 袋", 冲泡: "冷泡/热泡", 保质期: "12 个月" } },
  { title: "Morning 燕麦脆早餐", brand: "Morning", categoryId: "grocery", price: 6900, image: image("photo-1517673400267-0251440c45dc"), subtitle: "坚果果干 · 高膳食纤维", specs: { 净含量: "500g", 糖分: "低糖", 食用: "即食" } },

  { title: "设计中的设计", brand: "知行出版", categoryId: "books", price: 6800, image: image("photo-1544947950-fa07a98d237f"), subtitle: "重新发现日常事物的价值", specs: { 装帧: "精装", 页数: "288", 语言: "简体中文" } },
  { title: "Focus Grid 效率手账", brand: "Paperworks", categoryId: "books", price: 8900, image: image("photo-1456324504439-367cee3b3c32"), subtitle: "目标、计划与复盘系统", specs: { 尺寸: "A5", 页数: "240", 纸张: "100g 米白纸" } },
  { title: "Studio Pro 彩铅套装", brand: "Chromatic", categoryId: "books", price: 21900, image: image("photo-1513364776144-60967b0f800f"), subtitle: "72 色油性彩铅 · 专业级", specs: { 色数: "72", 笔芯: "3.8mm", 包装: "金属盒" } },
  { title: "Ideas 桌面灵感卡片", brand: "Noted", categoryId: "books", price: 5900, image: image("photo-1455390582262-044cdead277a"), subtitle: "100 个创意练习", specs: { 数量: "100 张", 尺寸: "90×55mm", 语言: "中英双语" } },
  { title: "Arc 黄铜书签礼盒", brand: "Arc Studio", categoryId: "books", price: 7600, image: image("photo-1512820790803-83ca734da794"), subtitle: "手工拉丝 · 三枚套装", specs: { 材质: "黄铜", 数量: "3 枚", 包装: "礼盒" } },
];

const colors = ["曜石黑", "雾银", "海盐白", "松石绿", "暮光蓝"];
const optionNames = ["标准版", "进阶版", "旗舰版"];

function seededNumber(input: string) {
  return [...input].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) >>> 0, 2166136261);
}

function makeReviews(seed: Seed, index: number): Review[] {
  const comments = [
    ["质感比预期更好", "包装仔细，实际使用一周后体验稳定，细节处理很到位。"],
    ["适合日常使用", "功能设计清晰，上手没有学习成本，整体符合页面描述。"],
    ["配送和产品都满意", "到货速度快，颜色与图片接近，会继续关注这个品牌。"],
    ["综合表现均衡", "同价位里比较有竞争力，希望后续增加更多配色。"],
  ];
  return comments.map(([title, content], reviewIndex) => ({
    id: `review-${index}-${reviewIndex}`,
    author: ["林**", "周**", "陈**", "顾**"][reviewIndex],
    rating: reviewIndex === 3 ? 4 : 5,
    title,
    content,
    date: new Date(Date.UTC(2026, 7, 12 - reviewIndex * 8)).toISOString(),
    tags: reviewIndex % 2 ? ["使用方便", "符合描述"] : ["质感很好", "包装可靠"],
  }));
}

function makeVariants(seed: Seed, index: number): ProductVariant[] {
  const count = index % 3 === 0 ? 4 : 3;
  return Array.from({ length: count }, (_, variantIndex) => {
    const uplift = Math.round(seed.price * variantIndex * 0.12);
    return {
      id: `sku-${index + 1}-${variantIndex + 1}`,
      skuCode: `TC-${String(index + 1).padStart(3, "0")}-${variantIndex + 1}`,
      attributes: {
        颜色: colors[(index + variantIndex) % colors.length],
        版本: optionNames[Math.min(variantIndex, optionNames.length - 1)],
      },
      price: seed.price + uplift,
      compareAtPrice: Math.round((seed.price + uplift) * 1.18),
      stock: 5 + ((seededNumber(seed.title) + variantIndex * 17) % 94),
      image: seed.image,
    };
  });
}

export const products: Product[] = seeds.map((seed, index) => {
  const rating = 4.3 + (seededNumber(seed.title) % 7) / 10;
  return {
    id: `product-${index + 1}`,
    slug: seed.title
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9\u4e00-\u9fa5-]/g, ""),
    title: seed.title,
    subtitle: seed.subtitle,
    brand: seed.brand,
    categoryId: seed.categoryId,
    description: `${seed.title} 将可靠功能、克制设计与日常使用体验结合，适合希望在性能和质感之间取得平衡的用户。`,
    highlights: [seed.subtitle, "两年模拟质保", "支持 7 天无理由退货演示"],
    images: [seed.image, seed.image.replace("w=1200", "w=1000"), seed.image.replace("q=82", "q=72")],
    variants: makeVariants(seed, index),
    rating: Math.min(5, Number(rating.toFixed(1))),
    reviewCount: 86 + (seededNumber(seed.brand) % 2400),
    soldCount: 320 + (seededNumber(seed.title) % 18000),
    badges: [index % 4 === 0 ? "限时优惠" : "口碑精选", index % 5 === 0 ? "新品" : "极速达"],
    keywords: [seed.title, seed.brand, seed.categoryId, ...Object.values(seed.specs)],
    specifications: seed.specs,
    reviews: makeReviews(seed, index),
    featured: index % 3 === 0,
    isNew: index % 5 === 0,
  };
});

export const brands = [...new Set(products.map((product) => product.brand))].sort();

export function getProductById(id: string) {
  return products.find((product) => product.id === id);
}

export function getProductBySlug(slug: string) {
  return products.find((product) => product.slug === slug);
}

export function getVariant(product: Product, variantId: string) {
  return product.variants.find((variant) => variant.id === variantId) ?? product.variants[0];
}
