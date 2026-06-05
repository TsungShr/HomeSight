# HomeSight 智能户型方案小程序

<div align="center">

![Platform](https://img.shields.io/badge/Platform-WeChat%20Mini%20Program-07C160?style=flat-square)
![Java](https://img.shields.io/badge/Java-17+-orange?style=flat-square)
![Spring Boot](https://img.shields.io/badge/Spring%20Boot-3.x-green?style=flat-square)
![License](https://img.shields.io/badge/License-MIT-blue?style=flat-square)

**集户型图 AI 解析、3D 可视化、家具编辑、AI 水电布局于一体的微信小程序完整解决方案。**

</div>

---

##  功能概览

| 模块 | 页面 | 核心能力 |
|------|------|----------|
| 户型上传 | `pages/index` | 拍照/相册选图、预览、上传至阿里云 OSS |
| AI 分析 | `pages/analyze` | 通义千问 VL 识别户型结构，输出房间/优势/注意事项 |
| 3D 预览 | `pages/view3d` | 手写 WebGL 渲染 3D 户型，支持旋转/缩放 |
| 家具编辑 | `pages/edit` | movable-area 拖拽家具、家电、智能设备 |
| 水电布局 | `pages/layout` | AI 生成电源/网口/水管/电路点位，支持导出图片 |

---

##  技术架构

```
┌─────────────────────────────────────┐
│         微信原生小程序               │
│  pages/ · components/ · utils/     │
└────────────────┬────────────────────┘
                 │ HTTP REST
                 ▼
┌─────────────────────────────────────┐
│   Java Spring Boot 后端（阿里云）    │
│  Controller · Service · Repository  │
└────────────────┬────────────────────┘
                 │
     ┌───────────┼───────────────┐
     ▼           ▼               ▼
┌─────────┐ ┌──────────┐ ┌────────────┐
│ MySQL   │ │ 阿里云   │ │  通义千问  │
│ 数据库   │ │  OSS    │ │   VL API   │
└─────────┘ └──────────┘ └────────────┘
```

**技术栈：**
- 前端：微信小程序原生框架（WXML/WXSS/JS），无第三方 UI 库
- 后端：Spring Boot 3.x + JPA + MySQL
- AI：通义千问 VL Plus（视觉理解）
- 存储：阿里云 OSS
- 3D 渲染：手写 WebGL，约 300 行，不依赖 three.js

---

##  快速开始

### 1. 小程序端配置

编辑 `miniprogram/utils/config.js`，修改 API 地址：

```javascript
API_BASE: 'http://YOUR_SERVER_IP:8080/api',
```

在微信开发者工具中导入 `miniprogram/` 目录即可运行。

### 2. 后端配置

编辑 `backend/src/main/resources/application.yml`：

```yaml
spring:
  datasource:
    url: jdbc:mysql://localhost:3306/homesight
    username: root
    ***REMOVED***

aliyun:
  oss:
    access-key-id: YOUR_OSS_KEY
    access-key-secret: YOUR_OSS_SECRET
    bucket-name: homesight
    url-prefix: https://homesight.oss-cn-hangzhou.aliyuncs.com/

qwen:
  api-key: YOUR_QWEN_API_KEY
```

### 3. 初始化数据库

```sql
CREATE DATABASE homesight DEFAULT CHARSET utf8mb4;
```

JPA 将自动建表（`ddl-auto: update`）。

### 4. 启动后端

```bash
cd backend
mvn spring-boot:run
```

后端端口：`8080`，接口前缀：`/api`

### 5. 部署到阿里云 ECS

```bash
# 打包
mvn clean package -DskipTests

# 上传到 ECS
scp target/homesight-server-1.0.0.jar root@YOUR_IP:/opt/homesight/

# 在 ECS 上运行
java -jar /opt/homesight/homesight-server-1.0.0.jar
```

建议使用 `systemd` 或 `supervisor` 管理进程。

---

##  API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/upload` | 上传户型图 |
| POST | `/api/analyze/{floorPlanId}` | AI 分析户型 |
| GET | `/api/floorplan/{floorPlanId}` | 获取户型详情 |
| GET | `/api/floorplans?openId=` | 列出用户户型 |
| POST | `/api/layout/{floorPlanId}` | AI 生成水电布局 |
| POST | `/api/roomlayout/{floorPlanId}` | 保存房间布局 |
| DELETE | `/api/floorplan/{floorPlanId}` | 删除户型 |

---

##  第三方服务申请

| 服务 | 申请地址 | 用途 |
|------|----------|------|
| 通义千问 VL | https://dashscope.console.aliyun.com/ | 户型图视觉理解 |
| 阿里云 OSS | https://oss.console.aliyun.com/ | 户型图文件存储 |
| MySQL | 阿里云 RDS / 自建 | 数据持久化 |

---

##  目录结构

```
HomeSight/
├── miniprogram/          # 微信小程序前端
│   ├── app.js / app.json / app.wxss
│   ├── pages/
│   │   ├── index/       # 首页：户型图上传
│   │   ├── analyze/     # AI 分析页
│   │   ├── view3d/      # 3D 户型预览（手写 WebGL）
│   │   ├── edit/        # 家具编辑（拖拽）
│   │   └── layout/      # AI 水电布局
│   ├── utils/
│   │   ├── config.js        # 全局配置
│   │   ├── request.js       # HTTP 请求封装
│   │   ├── floorplan.js     # 户型数据结构化
│   │   ├── three-helper.js  # 精简 WebGL 3D 引擎
│   │   └── shape-renderer.js # 水电图画布渲染
│   └── assets/           # 图标资源
│
├── backend/              # Java Spring Boot 后端
│   ├── src/main/java/com/homesight/
│   │   ├── HomeSightApplication.java
│   │   ├── config/       # OSS · Qwen · CORS 配置
│   │   ├── controller/   # REST API
│   │   ├── service/      # OSS · AI 服务
│   │   ├── repository/   # JPA 数据访问
│   │   ├── entity/       # 实体类
│   │   └── dto/          # 数据传输对象
│   └── src/main/resources/
│       └── application.yml
│
└── README.md
```

---

##  更新日志

### v0.2.0 — 家具编辑 + 装修知识问答 (2026-06-04)

**家具编辑页面 (`pages/edit`)**
- 重构家具拖拽交互，从 movable-area 改为 touch 事件方案，支持任意位置放置
- 新增家具目录拖放入布局区：单指按住卡片移动，松手放置到画布
- 新增双指捏合缩放：选中家具后双指捏合可放大/缩小，范围 20–300px
- 新增家具操作栏：选中家具后出现旋转/调整尺寸/复制/删除操作按钮
- 新增尺寸调整弹窗：支持手动输入家具宽高（像素）
- 新增多房间管理：添加/删除/切换房间，房间数据持久化到本地存储
- 新增简化模式：无户型数据时显示按面积比例绘制的矩形房间

**装修知识问答 Agent (`renovation-agent/`)**
- 新增 Python 服务，基于 Ollama + Milvus 实现装修知识 RAG 问答
- 支持从 B 站视频摄入字幕，自动切片向量化存储
- 对话时结合知识库上下文 + LLM 生成回答
- 提供 `/health`、`/ingest`、`/chat`、`/knowledge/stats` 等 API
- 附赠视频批量摄入脚本

**后端增强**
- 新增 `AdviceController`：对接装修问答 Agent 接口
- 新增 `UserController`：微信 OpenId 登录
- 新增 `DoubaoProperties`/`RagProperties`：配置化 Bean
- `AiService`/`OssService` 重构，配置集中管理
- `FloorPlanController` 新增部分 API

**目录结构变更**
- 新增 `rag/`：B站视频知识摄入脚本
- 新增 `vector_store/`：Milvus 向量存储目录
- 新增 `renovation-agent/`：装修知识问答服务
- 新增 `milvus-docker-compose.yml`：Milvus 快速启动配置
- 新增 `AGENTS.md` / `RULES.md`：Cursor Agent 指南与编码规范
- 删除 `QwenProperties.java`（合并到 `DoubaoProperties`）

---

##  开发说明

- 小程序无需 npm install，直接引用原生组件
- 3D 渲染使用手写 WebGL，约 300 行，不依赖 three.js
- AI 服务调用在云函数侧处理，不暴露 API Key
- 生产环境务必将 HTTP 替换为 HTTPS
