# 摄影工具集合站 MVP

基于 `Node.js + Express + 原生 HTML/CSS/JS` 的摄影灵感工具站 MVP。

当前版本已实现：
- 姿势库多维筛选与分页
- 全局随机/条件随机抽取
- 姿势详情弹窗（要领 + 引导详解）
- 摄影名言随机展示
- 本地收藏（`localStorage`）
- 分享（Web Share API，降级复制链接）

## 1. 环境要求

- Node.js `>= 18`
- npm `>= 10`

## 2. 安装与启动

```bash
npm install
npm run start
```

启动后访问：
- [http://localhost:3000](http://localhost:3000)

开发模式（当前与 start 相同）：

```bash
npm run dev
```

## 3. 项目结构

```text
photograph2/
├─ public/
│  └─ index.html          # 前端页面与交互逻辑
├─ server/
│  └─ index.js            # Express 服务与 API
├─ data/
│  ├─ poses.json          # 姿势数据
│  └─ quotes.json         # 名言数据
├─ package.json
└─ README.md
```

## 4. API 说明

统一响应格式：

```json
{
  "success": true,
  "data": {},
  "message": "ok"
}
```

错误格式：

```json
{
  "success": false,
  "data": null,
  "message": "错误描述"
}
```

### 4.1 获取姿势列表（支持筛选 + 分页）

`GET /api/poses`

Query 参数：
- `type`
- `emotion`
- `scene`
- `clothing`
- `props`
- `people_count`
- `page`（默认 1）
- `pageSize`（默认 9，最大 50）

示例：

```http
GET /api/poses?scene=海边&people_count=单人&page=1&pageSize=6
```

### 4.2 随机姿势（支持按条件随机）

`GET /api/poses/random`

可传同上筛选参数。

示例：

```http
GET /api/poses/random?scene=海边&emotion=欢快明朗
```

### 4.3 获取姿势详情

`GET /api/poses/:id`

示例：

```http
GET /api/poses/p001
```

### 4.4 获取随机名言

`GET /api/quotes/random`

示例：

```http
GET /api/quotes/random
```

## 5. 数据结构

### 5.1 poses.json

```json
{
  "id": "p001",
  "title": "回眸一笑",
  "image_url": "https://...",
  "icon": "💃",
  "tags": {
    "type": ["通用"],
    "emotion": ["欢快明朗", "故事氛围"],
    "scene": ["扫街", "海边"],
    "clothing": ["连衣裙"],
    "props": ["无道具"],
    "people_count": ["单人"]
  },
  "key_points": ["要点1", "要点2"],
  "guide_details": "引导话术"
}
```

### 5.2 quotes.json

```json
{
  "id": "q001",
  "content": "如果你拍得不够好，是因为你靠得不够近。",
  "author": "罗伯特·卡帕 (Robert Capa)"
}
```

## 6. 已实现的前端行为

- 首页“全局随机灵感盲盒”会调用 `/api/poses/random`
- 姿势页筛选会调用 `/api/poses`
- 姿势卡片点击会调用 `/api/poses/:id`
- 摄影圣经“再来一句”会调用 `/api/quotes/random`
- 收藏状态保存在浏览器 `localStorage`（键名：`pose_favorites_v1`）

## 7. 常见问题

### 7.1 端口被占用

可在启动前设置环境变量 `PORT`，例如：

```bash
# PowerShell
$env:PORT=3001; npm run start
```

### 7.2 图片加载失败

当前 `image_url` 使用外部链接，若网络不可达会自动回退为图标占位。

## 8. 后续可扩展方向

- 用户系统与云端收藏同步
- 数据库替换（PostgreSQL / MongoDB）
- 管理后台（姿势/名言维护）
- 图片云存储与 CDN 优化
- 收藏页与“仅看收藏”筛选
