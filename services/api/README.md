# C-teacher API

Go 后端目前作为轻量 AI Gateway。默认使用 mock 分析器，配置 OpenAI 环境变量后可切换到 Responses API。

## 启动

```bash
go run ./services/api/cmd/server
```

默认地址:

```text
http://127.0.0.1:18080
```

## 接口

- `GET /health`
- `POST /v1/ai/mistakes/analyze`

`/v1/ai/mistakes/analyze` 保持固定响应结构，前端无需关心底层模型。

请求体支持:

```json
{
  "studentId": "chen",
  "subject": "数学",
  "questionText": "函数图像平移",
  "studentAnswer": "向左",
  "imagePath": "/path/to/mistake.jpg"
}
```

`imagePath` 可选，用于桌面端拍照/选图改题时把本机图片来源传入分析上下文；模型输出仍需教师确认。

## AI Provider

默认离线 mock:

```bash
go run ./services/api/cmd/server
```

启用 OpenAI Responses API:

```bash
export C_TEACHER_AI_PROVIDER=openai
export OPENAI_API_KEY=sk-...
export C_TEACHER_OPENAI_MODEL=gpt-5.2
go run ./services/api/cmd/server
```

可选:

```bash
export C_TEACHER_OPENAI_BASE_URL=https://api.openai.com/v1
```

OpenAI 返回结果会被解析为结构化 JSON，且 `teacherReviewRequired` 始终强制为 `true`。
