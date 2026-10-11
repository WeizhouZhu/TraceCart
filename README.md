# TraceCart

TraceCart 是一个 PC 优先的高保真 Mock 电商与轨迹/请求数据采集系统。它提供完整的搜索、商品详情、购物车、游客结算、二维码与跳转支付流程，并按匿名会话记录 HTTP 请求和浏览器交互轨迹。

## 已实现

- 8 个分类、40 个 SPU、约 120 个 SKU 的稳定商品 Fixture。
- 关键词、品牌、分类、价格、评分、库存和排序检索。
- 商品详情、规格选择、收藏、对比和最近浏览结构。
- 加入购物车、数量修改、选择、删除和撤销。
- 四步游客结算、虚构测试地址、优惠码 TRACE30。
- 二维码支付、跳转收银台及 75% 默认成功率。
- Human、普通 Script 和 LLM Agent 的鉴权式一次性采集链接。
- 鼠标、点击、滚动、页面和业务事件批量采集。
- 请求和轨迹 NDJSON 原始存储。
- sessions.parquet、requests.parquet、trajectories.parquet 导出。
- 独立、零采集的统计与接入管理后台。
- 公网 IP HTTPS、签名 Cookie、Argon2id 密码哈希和 API Key 摘要存储。

## 本地运行

要求 Node.js 22+ 与 pnpm。

~~~bash
pnpm install
pnpm run build
pnpm start
~~~

默认地址：http://127.0.0.1:3100

开发时分别运行：

~~~bash
pnpm run dev
pnpm run dev:server
~~~

## 验证

~~~bash
pnpm run typecheck
pnpm run test
pnpm run build
~~~

## 页面

- /：商城首页
- /search：搜索、筛选与排序
- /product/:slug：商品详情
- /cart：购物车
- /checkout：游客结算
- /admin：统计、导出、接入说明和密钥管理；不进入数据集
- /human：人工参与者验证和专属链接领取；不进入数据集
- /c#token：统一的一次性链接入口；领取动作不进入数据集
- /api/collect：Script 和 Agent 的机器可读接入与链接签发 API
- /api/health：服务健康检查

## 有标签采集

普通访问 / 只创建 label=null 会话。有标签访问只能通过三类鉴权流程：

~~~text
Script API Key -> POST /api/collect -> /c#token -> label=script
Agent API Key  -> POST /api/collect -> /c#token -> label=ai
/human + Human 密码 + nickname -> /c#token -> label=human
~~~

Script 与 Agent 可先读取自己的机器可读说明：

~~~bash
curl https://42.193.237.190/api/collect \
  -H "Authorization: Bearer <API_KEY>"
~~~

所有专属链接只可使用一次、30 分钟有效，标签由服务端根据鉴权凭据写入且不可修改。Token 和 API Key 只保存摘要。

管理页、人工验证、令牌领取、接入 API、健康检查、静态资源和 Nginx 日志均不进入训练数据。只有商城页面、商城业务 API 和已启用采集的会话可以写入 sessions、requests 与 trajectories。

## 数据目录

通过 TRACECART_DATA_DIR 设置数据目录。默认使用项目中的 data/：

~~~text
data/
├── sessions.json
├── access-links.json
├── api-keys.json
├── orders.json
├── payments.json
├── requests.ndjson
├── trajectories.ndjson
└── exports/
~~~

## 生产配置

- [systemd 服务](deploy/tracecart.service)
- [Nginx 配置](deploy/nginx.conf)
- [服务器端构建与原子发布脚本](deploy/remote-deploy.sh)
- [数据采集方案](docs/data-collection-plan.zh-CN.md)
- [电商前端设计](docs/commerce-frontend-design.zh-CN.md)

生产服务器的唯一源码工作副本位于 `/srv/tracecart/source`。服务器端更新流程：

~~~bash
cd /srv/tracecart/source
git pull --ff-only origin main
./deploy/remote-deploy.sh
~~~


生产入口为 https://42.193.237.190。80 端口只保留 ACME 验证并强制跳转 HTTPS；IP 证书由 Certbot 自动续期。
脚本会在服务器上安装依赖、执行类型检查、测试和构建；只有全部通过后才创建新发布目录并切换 `/srv/tracecart/current`。

所有商品、库存、订单和支付均为模拟，不会连接真实支付渠道。
