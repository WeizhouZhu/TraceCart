# TraceCart 商城服务端化与部分 SSR 架构

## 状态

本方案已经实现。商城不再从浏览器打包的 Fixture 读取商品和购物车数据；商品目录的权威副本位于服务端，浏览器通过同源 API 获取。

## 渲染边界

公开且适合被普通 HTTP 客户端直接理解的信息由服务端输出到初始 HTML：

- 首页的商城说明、分类和精选商品；
- 搜索页的查询说明和首屏公开结果；
- 商品页的标题、品牌、图片、公开起售价、描述和卖点；
- 客户服务说明。

服务端在 #ssr-content 中输出上述内容，并标记 data-render-mode="partial-ssr"。浏览器完成商品目录 API 请求后，由 React 应用接管并移除 SSR 占位内容。账户态或交易态页面不会把私人信息写入 SSR HTML。

## 动态加载边界

以下信息和动作通过接口在页面运行时获取或提交：

- 完整商品目录、搜索筛选和搜索建议；
- 商品详情、SKU、实时价格、库存和推荐；
- 当前匿名会话的购物车；
- 配送方式、优惠码与礼品包装对应的服务端报价；
- 订单创建、订单状态与支付流程。

这样普通脚本读取 HTML 时能识别平台和公开商品，人类浏览器及具备网络能力的 Agent 则会继续经历常见电商的异步接口调用。

## 商城 API

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| GET | /api/store/catalog | 分类、品牌和商品目录 |
| GET | /api/store/search | 搜索、筛选与排序 |
| GET | /api/store/search/suggestions | 搜索建议 |
| GET | /api/store/products/:slug | 商品详情 |
| GET | /api/store/products/:slug/variants | SKU、价格与库存 |
| GET | /api/store/products/:slug/recommendations | 相关推荐 |
| GET | /api/store/cart | 当前匿名会话购物车 |
| POST | /api/store/cart/items | 加入购物车 |
| PATCH | /api/store/cart/items/:itemId | 改数量或选中状态 |
| DELETE | /api/store/cart/items/:itemId | 删除购物车商品 |
| DELETE | /api/store/cart | 清空购物车 |
| POST | /api/store/checkout/quote | 校验库存并计算报价 |
| POST | /api/orders | 服务端复核商品并创建订单 |

购物车以签名的 tc_session Cookie 关联匿名会话，保存到 carts.json。创建订单时服务端重新校验商品和 SKU 库存，并根据服务端商品价格、配送、优惠码和包装选项重算总额；客户端提交的报价不作为权威金额。

## 不实施风控

商城接口没有新增验证码、设备指纹、自动化识别、User-Agent 封禁、行为评分或针对脚本的差异化响应。三类访问者看到同一套公开 HTML 和业务 API。

管理员认证、采集链接鉴权、请求体大小限制等基础安全边界继续保留；它们用于保护管理面和数据完整性，不参与商城访问者分类，也不改变采集样本的业务分布。

## 代码位置

- server/catalog.ts：服务端商品权威数据；
- server/storefront.ts：搜索、建议、计价、校验和 SSR HTML；
- server/app.ts：商城 API、会话购物车和 HTML 返回；
- src/store/CatalogStore.tsx：客户端目录加载与 SSR 接管；
- src/store/AppStore.tsx：服务端购物车同步；
- src/lib/api.ts：同源商城 API 客户端。
