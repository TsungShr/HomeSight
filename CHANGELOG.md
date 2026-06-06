# Changelog

All notable changes to this project are documented here.

## [Unreleased]

## [v0.3.0] - 2026-06-06

### Security
- `UserController`: 微信 AppID/Secret 从硬编码迁移至 `application.yml` + `WechatProperties` 配置类
- `application.yml`: 新增 `wechat.app-id` / `wechat.app-secret` 配置项

### Bug Fixes

**后端 (Java)**
- `UserController`: 移除硬编码的微信密钥，改为配置文件注入
- `AdviceController`: 修复端点地址和字段名（`bilibili_url` → `url`），正确调用 Agent 端口 8081
- `LayoutAgentService`: Agent URL 从硬编码迁移至 `AgentProperties` 配置
- `application.yml`: 新增 `agent.base-url` 配置

**小程序 (Miniprogram)**
- `analyze.js`: `getDecorationAdvice()` 调用了不存在的 `/decoration-advice/{id}` 接口，改为正确的 `/advice` GET 接口
- `edit.js`: 补全 WXML 引用但 JS 中缺失的 `selectFurniture` 函数
- `edit.js`: 修正表单绑定函数名 `onRoomNameInput` → `onEditRoomNameInput`（WXML 与 JS 一致）
- `layout.js`: `drawWaterLines` / `drawElectricalRoutes` 传 `null` 时崩溃，加 `(lines || [])` 保护
- `layout.js`: 有 layoutData 时仍显示占位文字，且 `22rpx` 为无效单位，改为 `showPlaceholder` 参数 + `14px`
- `layout.js`: `setReq` 在部分场景下 `val` 取值异常，改为从 dataset 单独取值

**3D 渲染 (three-helper.js)**
- 地板多边形三角剖分索引 `i + 2` 越界，导致 WebGL 渲染错误
- `_dot` 函数缺失，`_lookAt` 调用时崩溃

**Python 服务**
- `rag_service.py`: `allow_origins` 为 FastAPI 无效参数，改为 `allow_origin_regex=".*"`
- `renovation-agent/main.py`: 同上

### Code Quality
- `app.wxss`: 抽取底部弹层/表单共享样式为全局定义，消除跨文件重复
- `edit.wxss`: 删除大段重复弹层样式，只保留必要 overrides
- `analyze.wxss`: 删除重复 spinner 动画，使用全局定义

### Features

**装修知识 Agent 增强**
- `renovation-agent/rag.py`: 引入 **DuckDuckGo 实时搜索**，每次问答时联网搜索权威资料（国家标准、品牌评测、行业文章）
- `renovation-agent/rag.py`: Agent 回答综合 **知识库检索** + **网络搜索** + **LLM 生成**，即使知识库为空也能给出有依据的建议
- `renovation-agent/rag.py`: 更新 system prompt，引导模型引用参考资料来源
- `renovation-agent/rag.py`: 返回结构新增 `web_results_count` 和 `type: 'web_search'` 标记
- `renovation-agent/requirements.txt`: 新增 `duckduckgo-search>=8.1.0`
- `renovation-agent/README.md`: 更新文档说明混合模式架构
- `renovation-agent/.env.example`: 新增配置模板
