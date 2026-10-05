# TraceCart

TraceCart 是一个 PC 优先的高保真 Mock 电商与轨迹/请求数据采集系统。它提供完整的搜索、商品详情、购物车、游客结算、二维码与跳转支付流程，并按匿名会话记录 HTTP 请求和浏览器交互轨迹。

## 已实现

- 8 个分类、40 个 SPU、约 120 个 SKU 的稳定商品 Fixture。
- 关键词、品牌、分类、价格、评分、库存和排序检索。
- 商品详情、规格选择、收藏、对比和最近浏览结构。
- 加入购物车、数量修改、选择、删除和撤销。
- 四步游客结算、虚构测试地址、优惠码 TRACE30。
- 二维码支付、跳转收银台及 75% 默认成功率。
- 人类、普通脚本和 AI 的会话级标签任务。
- 鼠标、点击、滚动、页面和业务事件批量采集。
- 请求和轨迹 NDJSON 原始存储。
- sessions.parquet、requests.parquet、trajectories.parquet 导出。
- 可固定网络、库存和支付结果的实验场景控制台。

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
- /collector：标签任务与 Parquet 导出
- /lab/scenarios：异常场景设置
- /api/health：服务健康检查

## 有标签采集

在 /collector 创建任务后，使用系统生成的链接作为目标客户端的第一个访问地址：

~~~text
http://SERVER_IP/collect/start/<task-token>
~~~

也可以让自动化客户端携带：

~~~text
X-TraceCart-Task: <task-token>
~~~

未匹配任务的会话标签为 null。系统只记录操作者提供的标签，不执行身份分类。

## 数据目录

通过 TRACECART_DATA_DIR 设置数据目录。默认使用项目中的 data/：

~~~text
data/
├── sessions.json
├── tasks.json
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

脚本会在服务器上安装依赖、执行类型检查、测试和构建；只有全部通过后才创建新发布目录并切换 `/srv/tracecart/current`。

所有商品、库存、订单和支付均为模拟，不会连接真实支付渠道。
