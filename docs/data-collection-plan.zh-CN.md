# TraceCart：PC 轨迹与请求数据采集系统

## 1. 系统核心

TraceCart 是一个面向后续 Python 数据预处理和 AI 模型训练的数据采集系统。

系统只负责：

- 提供复杂、真实的 PC Mock 电商前端，产生完整访问行为。
- 按会话采集 HTTP 请求特征、鼠标轨迹和页面交互。
- 在有标签采集任务中，将操作者提供的标签记录到对应会话。
- 其他所有访问作为无标签会话保存。
- 将数据导出为可直接被 Python 读取的 Parquet 文件。

系统不负责：

- 根据轨迹判断访问者是人类、普通脚本还是 AI。
- 预测、修正、质疑或重新解释操作者提供的标签。
- 建设生产级电商、库存、订单或支付后端。

第一阶段只完整实现 PC 端。移动商城和触摸轨迹以后再扩展；扫码支付使用一个轻量手机确认页即可。

## 2. 标签原则

每个会话只有一个 label 字段：

~~~text
human
script
ai
null
~~~

- human、script、ai：由操作者在创建采集任务时明确提供。
- null：该会话没有匹配到有标签采集任务。

系统不再使用 ground_truth_label、predicted_label、confidence 等字段，也不运行身份分类模型。

需要明确的是：仅从访问轨迹或 IP 无法可靠识别控制者类型。AI Agent 和普通脚本可能使用同一个浏览器自动化框架，人类与自动化也可能共享 IP。因此本系统不是“识别身份”，而是“把操作者声明的标签可靠绑定到相应会话”。

## 3. 两种采集模式

### 3.1 无标签采集

默认模式：

- 任何普通访问都会创建 session。
- session.label 保存为 null。
- 请求和轨迹正常采集。
- 不尝试判断访问者类型。

### 3.2 有标签采集

操作者在管理页创建采集任务，并填写：

- label：human、script 或 ai。
- 预计客户端 IP 或 CIDR。
- 生效开始时间和过期时间。
- 预计会话数，默认 1。
- 可选 User-Agent、平台、浏览器、视口或其他特征。
- 可选任务名称和备注。

任务创建后进入 waiting 状态。下一次满足匹配条件的访问会被绑定到该任务，其 session.label 原样写入操作者提供的值。

达到预计会话数或超过有效期后，任务停止匹配。未命中该任务的流量仍保存为无标签会话。

## 4. 会话标签绑定

### 4.1 推荐方式：任务链接

管理页为任务生成一次性链接：

~~~text
http://42.193.237.190/collect/start/<task-token>
~~~

客户端首先访问该链接。服务器验证任务后：

1. 创建或取得当前 session。
2. 将任务的 label 写入 session。
3. 记录 collection_task_id。
4. 写入签名 HttpOnly 会话 Cookie。
5. 跳转到 PC 商城首页。
6. 后续请求和轨迹都使用同一个 session_id。

token 只用于绑定，不作为训练数据导出。

### 4.2 自动化请求头

AI Agent 或普通脚本能够设置请求头时，可以携带：

~~~text
X-TraceCart-Task: <task-token>
~~~

服务器执行与任务链接相同的会话绑定。标签仍然来自任务配置，不根据请求头内容推断。

### 4.3 IP 与特征匹配

如果不使用 token，系统根据操作者提供的特征匹配首次访问：

- 来源 IP 或 CIDR。
- 有效时间窗。
- User-Agent。
- Client Hints 和平台。
- 客户端首次上报的视口、屏幕尺寸或时区。
- 任务剩余可绑定会话数。

匹配规则：

- 配置为必需的特征必须全部相符。
- 只有一个任务匹配时，才把其 label 写入 session。
- 多个任务同时匹配时不分配标签，并在管理页提示冲突。
- 任务绑定达到上限后立即停止匹配。
- 已绑定 session 的 label 在本次会话中保持不变。
- 其他会话始终为 null。

IP 只能是匹配条件之一。同一出口 IP 后可能有多个客户端，因此更推荐任务链接或请求头。

## 5. 最小数据模型

### 5.1 采集任务

~~~text
collection_task
- task_id
- label
- expected_ip_or_cidr
- expected_user_agent
- expected_client_features
- active_from
- expires_at
- max_sessions
- bound_sessions
- status
- note
~~~

### 5.2 会话

~~~text
session
- session_id
- label                  # human | script | ai | null
- collection_task_id     # 无标签会话为 null
- started_at
- ended_at
- source_ip
- user_agent
- client_features
~~~

label 只在 session 中保存一次。请求和轨迹通过 session_id 关联，不在系统内部建立其他标签体系。

### 5.3 关联关系

~~~text
session_id
  +-- page_view_id
  |    +-- request_id
  |    +-- trajectory_event_id
  |    +-- action_event_id
  +-- collection_task_id（可为空）
~~~

所有数据必须通过 ID 关联，不能仅依赖时间戳拼接。

## 6. 请求数据

每个请求至少记录：

- session_id、request_id、page_view_id。
- server_received_at。
- HTTP method 和规范化 path。
- status_code、response_bytes、duration_ms。
- 请求到达间隔和当前会话内序号。
- User-Agent。
- Sec-CH-UA、Sec-CH-UA-Platform、Sec-CH-UA-Mobile。
- Accept、Accept-Language、Accept-Encoding。
- 站内 Referer 和 Origin。
- source_ip。
- 前端 fetch/XHR 观测到的时长、缓存及错误类型。

不记录 Cookie 内容、Authorization、表单输入内容或敏感查询参数。

## 7. PC 轨迹数据

采集事件：

- pointermove、pointerdown、pointerup。
- click、dblclick、contextmenu。
- wheel、scroll。
- drag_start、drag_move、drag_end。
- focus、blur。
- 页面进入、离开、可见性和窗口尺寸变化。
- 搜索、筛选、查看商品、选择 SKU、加购、结算和支付等业务事件。

每个轨迹事件至少记录：

- session_id、page_view_id、trajectory_event_id。
- event_sequence 和 event_type。
- client_timestamp 和 server_received_at。
- route 和页面标题。
- client_x、client_y。
- page_x、page_y。
- x_ratio、y_ratio。
- scroll_x、scroll_y。
- viewport_width、viewport_height。
- document_width、document_height。
- device_pixel_ratio。
- data-track-id、元素标签和 ARIA role。
- 按键、指针或滚动等事件特有字段。
- frontend_build_id。

pointermove 通过 requestAnimationFrame 节流到每秒 15–20 个点；scroll 最多每秒 10 个事件。点击和业务动作全部保留。

键盘事件只记录导航键和快捷键类别，不记录输入文本。地址、电话、备注和支付区域全部屏蔽。

## 8. 导出格式

系统统一导出一个目录中的三个 Parquet 文件：

~~~text
tracecart-export-<timestamp>/
+-- sessions.parquet
+-- requests.parquet
+-- trajectories.parquet
~~~

### sessions.parquet

一行对应一个会话，包含：

- session_id。
- label。
- collection_task_id。
- 开始和结束时间。
- IP、User-Agent 和客户端特征。
- 页面数、请求数和轨迹事件数。

### requests.parquet

一行对应一个请求，包含 request_id、session_id 及全部请求特征。为了 Python 使用方便，导出时同时带上该会话的 label。

### trajectories.parquet

一行对应一个轨迹或业务事件，包含 trajectory_event_id、session_id、事件字段及该会话的 label。

Parquet 自带列名和类型信息，体积通常小于 CSV，并可直接使用 pandas、Polars、PyArrow 或 DuckDB。系统不再额外生成 JSONL、Manifest、Schema 文件或校验和。

Python 示例：

~~~python
import pandas as pd

sessions = pd.read_parquet("sessions.parquet")
requests = pd.read_parquet("requests.parquet")
trajectories = pd.read_parquet("trajectories.parquet")

labeled = trajectories[trajectories["label"].notna()]
ai_sessions = sessions[sessions["label"] == "ai"]
~~~

如果以后确实需要 CSV，可在 Python 中使用 DataFrame.to_csv 转换，不增加采集系统本身的复杂度。

## 9. 电商前端的职责

电商前端只是为了产生复杂、自然、可重复的轨迹和请求序列：

- 首页、分类、搜索建议、筛选、排序和分页。
- 商品列表、商品详情、多图、SKU、库存和评价。
- 购物车、优惠码、凑单、运费和游客结算。
- 骨架屏、空状态、局部错误、价格变化和库存不足。
- 二维码支付、跳转支付、成功、失败、取消、超时和重试。

商品、库存、优惠和订单使用 Fixtures、MSW 和轻量 Mock API，不建设生产后端。

每个支付会话创建时只随机一次：

- 75% 支付成功。
- 10% 余额不足。
- 6% 风控拒绝。
- 5% 网络错误。
- 4% 支付过期。

二维码支付允许手机轻量确认页改变 PC 的支付状态。跳转支付进入原创模拟收银台再返回。实验控制台可以固定某个支付结果，方便重复采集同一场景。

## 10. 系统结构

~~~text
PC Browser
   |
   v
Nginx
   +-- PC Mock 电商前端
   +-- request_id 与请求特征
   |
   v
Collector / Mock Server
   +-- Session 管理
   +-- 采集任务匹配与标签写入
   +-- 轨迹批量接收
   +-- Mock 支付状态
   +-- Parquet 导出
   |
   +-- SQLite
   +-- 轨迹原始数据文件
~~~

建议技术栈：

- React、TypeScript、Vite、React Router。
- Tailwind CSS、Zustand、TanStack Query、MSW。
- Fastify 轻量 Node.js 服务。
- SQLite 保存任务、会话和支付状态。
- DuckDB 或 Polars 生成 Parquet。
- Nginx、systemd、Vitest 和 Playwright。

## 11. 管理界面

管理页只承担必要操作：

- 查看当前无标签会话。
- 创建有标签采集任务。
- 选择 human、script 或 ai。
- 填写 IP、时间窗、会话数和客户端特征。
- 获取任务链接或请求头 token。
- 查看任务等待、已绑定、完成、过期或冲突状态。
- 查看某个会话的请求和轨迹数量。
- 按时间、标签和任务筛选。
- 选择时间范围并导出三个 Parquet 文件。

系统不展示模型预测，也不提供自动身份分类结果。

## 12. PC 优先实施顺序

1. 定义 session、request、trajectory 和 collection_task 数据结构。
2. 实现无标签默认采集。
3. 实现任务链接、请求头和 IP 加特征的会话绑定。
4. 建设完整 PC Mock 电商环境。
5. 接入请求、鼠标、滚动和业务事件采集。
6. 实现 75% 成功率的二维码及跳转支付。
7. 建设最小管理页和 Parquet 导出。
8. 完成后再扩展移动商城和触摸、滑动数据。

## 13. MVP 完成定义

- PC 端提供完整、复杂、可信的 Mock 电商环境。
- 普通访问的 session.label 为 null。
- 操作者可创建 human、script 或 ai 采集任务。
- 匹配任务的会话忠实保存操作者提供的 label。
- 系统不预测、不判断、不修改标签。
- 请求和轨迹通过 session_id 与标签关联。
- 支持二维码和跳转支付，默认成功率为 75%。
- 可导出 sessions、requests、trajectories 三个 Parquet 文件。
- 三个文件可以被 pandas 直接加载和关联。
