# DropStation

DropStation 是一个基于 Next.js 的轻量文件中转站。

## 功能

- 无需登录即可上传文件
- 单文件最大 1GB
- 支持分钟、小时、天、周、月快捷过期时间
- 支持 Date Picker 手动指定过期日期，默认当天 23:59
- 上传后生成短随机 token 下载链接，不暴露文件名
- 相同文件自动去重并复用未过期链接
- 文件保存到 `data/uploads`
- SQLite 数据库保存到 `data/dropstation.sqlite`
- 支持亮色和暗色切换，默认亮色

## 开发

```bash
pnpm install
pnpm dev
```

打开 `http://localhost:3000`。

## 构建

```bash
pnpm build
pnpm start
```
