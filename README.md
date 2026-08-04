# ROV 皮肤数据库

泰国服 Arena of Valor（ROV）英雄皮肤的静态数据站，数据每日自动从飞书表格同步。

在线地址：https://dxawdc.github.io/rov-skins/

## 功能

- **皮肤明细**：全量皮肤列表，支持按英雄、职业、品质、皮肤标签、获取方式、年份筛选，以及关键词搜索、分页。
- **英雄皮肤**：按英雄聚合查看该英雄的全部皮肤。
- **统计分析**：按年份/月份的品质分布堆叠图、品质占比饼图，图例可点击隐藏/显示某个品质。
- 每个皮肤支持查看详情（海报、品质标签、上线日期、获取方式、本地化元素、IP/名人联动、小王移植情况等）。

## 技术栈

- React + TypeScript + Vite
- Tailwind CSS
- ECharts（`echarts-for-react`）做统计图表
- 数据同步脚本用 `tsx` 直接跑 TypeScript，不需要额外编译步骤

## 项目结构

```
src/
  pages/            皮肤明细 / 英雄皮肤 / 统计分析 三个页面
  components/        皮肤表格、详情抽屉等复用组件
  data/loadSkins.ts  从 public/data/*.json 加载数据集
  types/skin.ts       核心数据类型定义
scripts/
  sync-feishu.ts      同步入口：读飞书表格 -> 清洗 -> 下载图片 -> 写 JSON
  clean-skins.ts       数据清洗/字段解析逻辑
  download-images.ts   皮肤海报 + 品质标签图片下载
  validate-data.ts     同步后的数据校验（zod schema）
public/data/          同步产物：skins.json / heroes.json / quality-tags.json / sync-meta.json
public/images/        同步产物：海报与品质标签图片
```

## 数据来源与同步机制

数据来自一份飞书电子表格（皮肤明细、英雄列表、英雄职业详情、品质参考表等多个子表），通过飞书自建应用的 tenant token 读取。

同步流程（`npm run sync`）：

1. 并行读取皮肤表、英雄表、品质参考表、英雄详情表、职业翻译表。
2. 清洗字段：统一职业/品质文案、解析日期、识别皮肤海报和品质标签图片的内嵌图片 token、跨表解析英雄职业（原表用跨表 VLOOKUP，飞书只读接口不会计算跨表公式，因此在代码里手动做了两级查表还原）。
3. 下载皮肤海报和每个皮肤自带的品质标签图片，转成 WebP 并保存到 `public/images/`。
4. 写出 `public/data/skins.json` 等产物文件。
5. `npm run validate:data` 用 zod schema 校验输出，防止字段缺失或类型错误。

GitHub Actions 每天定时跑一次同步（`.github/workflows/sync-data.yml`），跑完后自动提交变更、触发重新部署（`.github/workflows/deploy.yml`）。也可以在 Actions 页面手动触发 `Sync ROV Skin Data` 工作流立即同步一次。

## 本地开发

```bash
npm install
npm run dev          # 启动本地开发服务器
npm run build         # 构建产物到 dist/
npm run typecheck     # 仅类型检查
```

首次开发如果没有跑过同步、`public/data/*.json` 里没有真实数据，页面会显示空数据集，不影响页面本身的调试。

## 让同事自助触发同步（数据同步页）

站点内置「🔄 数据同步」页面，同事打开网址、粘贴一次令牌，就能自己把飞书最新数据同步到网站，并看到运行进度，不需要接触 GitHub。

给同事创建令牌的步骤（由仓库管理员操作）：

1. 打开 GitHub → Settings → Developer settings → Personal access tokens → **Fine-grained tokens** → Generate new token。
2. **Repository access** 选 Only select repositories，只勾选 `rov-skins`。
3. **Permissions** → Repository permissions → 只把 **Actions** 设为 `Read and write`，其余全部保持 No access。
4. 设置一个合理的有效期（例如 90 天），生成后复制令牌。
5. 通过私聊单独发给同事，让其粘贴到「数据同步」页。**不要**把令牌写进代码、文档或聊天群。

关于这个令牌的权限边界：它只能触发和查看本仓库的同步流程，**不能**修改代码，也**读不到** Actions Secrets 里的飞书应用凭证。令牌只保存在同事自己浏览器的 localStorage 里；页面提供「清除令牌」按钮，在公共电脑上用完请点一下。如需回收权限，在 GitHub 上删除该令牌即可，站点无需改动。

同事使用说明：平时直接点「开始同步」即可（约 1 分钟）。只有在飞书里换过图、但网站仍显示旧图时，才勾选「强制重新校验全部图片」（约 15 分钟）。

## 重新同步数据（需要飞书应用凭证）

复制 `.env.example` 为 `.env`，填入自己的飞书自建应用 `FEISHU_APP_ID` / `FEISHU_APP_SECRET`（该应用需要有对应电子表格的读取权限），然后：

```bash
npm run sync            # 同步数据 + 下载图片
npm run sync:data       # 只同步数据，不下载图片（更快）
npm run sync:images     # 只补下载缺失/失败的图片
```

线上环境的凭证以 GitHub Actions Secrets 的形式配置（`FEISHU_APP_ID`、`FEISHU_APP_SECRET`），不会出现在代码或提交记录里。

## 部署

站点部署在 GitHub Pages，`main` 分支有新提交（无论是手动改代码，还是每日同步机器人的自动提交）都会触发重新构建部署，无需手动操作。
