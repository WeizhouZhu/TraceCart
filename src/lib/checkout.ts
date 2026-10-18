import type { CheckoutDraft } from "../types";

export const checkoutRegions = [
  {
    province: "广东省",
    cities: [
      { name: "广州市", districts: ["天河区", "越秀区", "海珠区", "荔湾区", "白云区", "黄埔区", "番禺区", "花都区", "南沙区", "从化区", "增城区"] },
      { name: "深圳市", districts: ["福田区", "罗湖区", "南山区", "盐田区", "宝安区", "龙岗区", "龙华区", "坪山区", "光明区"] },
      { name: "佛山市", districts: ["禅城区", "南海区", "顺德区", "三水区", "高明区"] },
      { name: "珠海市", districts: ["香洲区", "斗门区", "金湾区"] },
    ],
  },
  {
    province: "浙江省",
    cities: [
      { name: "杭州市", districts: ["上城区", "拱墅区", "西湖区", "滨江区", "萧山区", "余杭区", "临平区", "钱塘区", "富阳区", "临安区", "桐庐县", "淳安县", "建德市"] },
      { name: "宁波市", districts: ["海曙区", "江北区", "北仑区", "镇海区", "鄞州区", "奉化区", "象山县", "宁海县", "余姚市", "慈溪市"] },
      { name: "温州市", districts: ["鹿城区", "龙湾区", "瓯海区", "洞头区", "永嘉县", "平阳县", "苍南县", "文成县", "泰顺县", "瑞安市", "乐清市", "龙港市"] },
      { name: "嘉兴市", districts: ["南湖区", "秀洲区", "嘉善县", "海盐县", "海宁市", "平湖市", "桐乡市"] },
    ],
  },
  {
    province: "上海市",
    cities: [
      { name: "上海市", districts: ["黄浦区", "徐汇区", "长宁区", "静安区", "普陀区", "虹口区", "杨浦区", "闵行区", "宝山区", "嘉定区", "浦东新区", "金山区", "松江区", "青浦区", "奉贤区", "崇明区"] },
    ],
  },
  {
    province: "北京市",
    cities: [
      { name: "北京市", districts: ["东城区", "西城区", "朝阳区", "丰台区", "石景山区", "海淀区", "门头沟区", "房山区", "通州区", "顺义区", "昌平区", "大兴区", "怀柔区", "平谷区", "密云区", "延庆区"] },
    ],
  },
] as const;

export type CheckoutAddressField = keyof CheckoutDraft["address"];
export type CheckoutAddressErrors = Partial<Record<CheckoutAddressField, string>>;

export function getCitiesForProvince(province: string): string[] {
  const region = checkoutRegions.find((item) => item.province === province);
  return region?.cities.map((city) => city.name) ?? [];
}

export function getDistrictsForCity(province: string, city: string): string[] {
  const region = checkoutRegions.find((item) => item.province === province);
  const cityRegion = region?.cities.find((item) => item.name === city);
  return cityRegion ? [...cityRegion.districts] : [];
}

export function getCheckoutAddressErrors(address: CheckoutDraft["address"]): CheckoutAddressErrors {
  const errors: CheckoutAddressErrors = {};
  const recipient = address.recipient.trim();
  const phone = address.phone.trim();
  const detail = address.detail.trim();
  const postalCode = address.postalCode?.trim() ?? "";
  const province = checkoutRegions.find((item) => item.province === address.province);
  const city = province?.cities.find((item) => item.name === address.city);

  if (recipient.length < 2) errors.recipient = "请输入至少 2 个字符的收货人姓名";
  else if (recipient.length > 30) errors.recipient = "收货人姓名不能超过 30 个字符";

  if (!phone) errors.phone = "请输入收货手机号";
  else if (!/^1[3-9]\d{9}$/.test(phone)) errors.phone = "请输入正确的 11 位中国大陆手机号";

  if (!address.province) errors.province = "请选择省份";
  else if (!province) errors.province = "当前省份不在配送范围内，请重新选择";

  if (!address.city) errors.city = address.province ? "请选择城市" : "请先选择省份";
  else if (!city) errors.city = "所选城市与省份不匹配，请重新选择";

  if (!address.district) errors.district = address.city ? "请选择区县" : "请先选择城市";
  else if (!city || !(city.districts as readonly string[]).includes(address.district)) errors.district = "所选区县与城市不匹配，请重新选择";

  if (detail.length < 5) errors.detail = "详细地址至少需要 5 个字符";
  if (postalCode && !/^\d{6}$/.test(postalCode)) errors.postalCode = "邮政编码应为 6 位数字";

  return errors;
}

export function isCheckoutAddressValid(address: CheckoutDraft["address"]) {
  return Object.keys(getCheckoutAddressErrors(address)).length === 0;
}
