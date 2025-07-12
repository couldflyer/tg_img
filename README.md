# TG Image Host - Cloudflare Pages

一个简洁、快速、免费的图片托管服务，使用Telegram频道作为存储后端，部署在Cloudflare Pages。

## ✨ 特性

- 🖼️ 支持多种图片格式（JPG, PNG, GIF, WebP）
- 📏 文件大小限制：5MB
- 🚀 快速上传，即时获取链接
- 🛡️ IP速率限制：每小时100次上传
- 📱 响应式设计，支持移动端
- 🎨 简洁美观的界面
- ☁️ 基于Cloudflare Pages，全球CDN加速
- 🆓 完全免费部署和使用

## 📁 项目结构

```
/
├── public/
│   └── index.html          # 前端界面
├── functions/
│   └── api/
│       ├── upload.js       # 上传API (Cloudflare Function)
│       └── health.js       # 健康检查API
├── .env.example           # 环境变量模板
├── .env.cloudflare        # Cloudflare部署环境变量说明
├── wrangler.toml          # Cloudflare配置
└── README.md              # 项目文档
```

## 🚀 快速部署

### 方式一：通过Git连接部署

1. **Fork此项目到你的GitHub**

2. **登录Cloudflare Dashboard**
   - 访问 [Cloudflare Pages](https://pages.cloudflare.com/)
   - 点击 "Create a project"

3. **连接Git仓库**
   - 选择你Fork的仓库
   - 选择分支（通常是main）

4. **配置构建设置**
   - 构建命令：留空
   - 构建输出目录：`public`
   - Root目录：`/`

5. **设置环境变量**
   在 Settings → Environment variables 中添加：
   ```
   TELEGRAM_BOT_TOKEN=your_bot_token_here
   TELEGRAM_GROUP_ID=-1001234567890  # 私有频道
   # 或者
   TELEGRAM_CHANNEL_ID=@your_channel  # 公开频道
   MAX_FILE_SIZE=5242880
   ```

6. **部署完成**
   - Cloudflare会自动构建和部署
   - 获得一个 `*.pages.dev` 域名

### 方式二：使用Wrangler CLI

1. **安装Wrangler**
   ```bash
   npm install -g wrangler
   ```

2. **登录Cloudflare**
   ```bash
   wrangler login
   ```

3. **部署项目**
   ```bash
   wrangler pages deploy public --project-name tg-image-host
   ```

4. **设置环境变量**
   ```bash
   wrangler pages secret put TELEGRAM_BOT_TOKEN
   # 私有频道使用群组ID
   wrangler pages secret put TELEGRAM_GROUP_ID
   # 或者公开频道使用频道用户名
   wrangler pages secret put TELEGRAM_CHANNEL_ID
   wrangler pages secret put MAX_FILE_SIZE
   ```

## ⚙️ 环境变量配置

| 变量名 | 说明 | 示例值 |
|--------|------|--------|
| `TELEGRAM_BOT_TOKEN` | Telegram Bot Token | `123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11` |
| `TELEGRAM_GROUP_ID` | Telegram群组ID（私有频道） | `-1001234567890` |
| `TELEGRAM_CHANNEL_ID` | Telegram频道ID（公开频道） | `@your_channel` |
| `MAX_FILE_SIZE` | 最大文件大小（字节） | `5242880` (5MB) |

**注意：** `TELEGRAM_GROUP_ID` 和 `TELEGRAM_CHANNEL_ID` 只需要配置其中一个：
- 私有频道：使用 `TELEGRAM_GROUP_ID`，格式为负数ID（如：-1001234567890）
- 公开频道：使用 `TELEGRAM_CHANNEL_ID`，格式为@用户名（如：@your_channel）

## 🤖 创建Telegram Bot

1. **与BotFather对话**
   - 打开Telegram，搜索 [@BotFather](https://t.me/BotFather)
   - 发送 `/newbot` 创建新机器人

2. **设置机器人信息**
   - 输入机器人名称（如：My Image Host Bot）
   - 输入机器人用户名（如：myimagehost_bot）
   - 获取Bot Token

3. **创建频道（公开或私有）**
   - 创建一个新的Telegram频道
   - 将Bot添加为频道管理员
   - 公开频道：确保频道是公开的，获取频道用户名（如：@myimagechannel）
   - 私有频道：获取频道的群组ID（负数格式，如：-1001234567890）
   
4. **获取群组ID（仅私有频道需要）**
   - 将Bot添加到私有频道后
   - 向频道发送任意消息
   - 使用 Telegram Bot API 获取更新：`https://api.telegram.org/bot<your_bot_token>/getUpdates`
   - 在返回的JSON中找到 `chat.id` 字段（负数值）

## 📋 API文档

### 上传图片

**POST** `/api/upload`

**请求格式：** multipart/form-data

**参数：**
- `image`: 图片文件（必填）

**响应示例：**

成功：
```json
{
  "success": true,
  "url": "https://api.telegram.org/file/bot<token>/<file_path>",
  "filename": "image.jpg",
  "size": 1024000
}
```

失败：
```json
{
  "success": false,
  "error": "错误信息"
}
```

### 健康检查

**GET** `/api/health`

**响应：**
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "service": "TG Image Host - Cloudflare Pages"
}
```

## 🔧 技术栈

- **前端：** 原生HTML/CSS/JavaScript
- **后端：** Cloudflare Pages Functions
- **图片存储：** Telegram Bot API
- **CDN：** Cloudflare全球网络
- **部署：** Cloudflare Pages

## 🌟 优势

1. **完全免费**
   - Cloudflare Pages免费套餐足够使用
   - Telegram存储无限制

2. **全球加速**
   - Cloudflare全球CDN
   - 边缘计算处理

3. **高可用性**
   - 99.9%+ SLA保证
   - 自动故障转移

4. **简单部署**
   - Git集成自动部署
   - 零配置启动

## 📝 注意事项

1. **Telegram频道设置**
   - Bot必须有发送消息权限
   - 私有频道：确保Bot被添加为管理员，使用群组ID格式（负数）
   - 公开频道：确保频道是公开的，使用频道用户名格式（@channel_name）

2. **文件限制**
   - 支持的格式：JPEG, JPG, PNG, GIF, WebP
   - 最大文件大小：5MB（可在环境变量中调整）

3. **Cloudflare限制**
   - 单个请求最大25MB（足够图片上传）
   - CPU时间限制：10ms（免费版）/50ms（付费版）
   - 每日请求限制：100,000次（免费版）

4. **速率限制**
   - 基于IP地址的简单限制
   - 如需更复杂限制，可使用Cloudflare KV存储

## 🔒 安全考虑

- 环境变量存储在Cloudflare中，安全可靠
- 支持HTTPS，所有传输加密
- 可配置自定义域名和SSL证书
- 建议定期轮换Bot Token

## 🌐 自定义域名

1. 在Cloudflare Pages项目中点击 "Custom domains"
2. 添加你的域名
3. 按照提示更新DNS记录
4. 等待SSL证书自动配置

## 🤝 贡献

欢迎提交Issue和Pull Request！

## 📄 许可证

MIT License

## 🔗 相关链接

- [Cloudflare Pages 文档](https://developers.cloudflare.com/pages/)
- [Cloudflare Functions 文档](https://developers.cloudflare.com/pages/platform/functions/)
- [Telegram Bot API文档](https://core.telegram.org/bots/api)
- [Wrangler CLI 文档](https://developers.cloudflare.com/workers/wrangler/)