# 达人诊断工具（MVP）

这是一个给运营团队内部使用的本地网页工具，用于**人工录入**小红书达人信息并快速输出合作建议。

> 第一版不做自动抓取，避免平台抓取风险。截图内容先人工看图填写，后续可再接 OCR/AI。

## 你能做什么

- 录入达人核心字段（链接、粉丝、近10篇数据、报价、调性、风险等）
- 自动计算：平均互动量、互动率、CPM、CPE
- 自动评分（总分100）：
  - 品牌匹配度 40
  - 数据健康度 25
  - 商业风险 20
  - 合作价值 15
- 自动给出中文建议：
  - 达人类型
  - 匹配/数据/风险判断
  - 报价合理性
  - 合作形式建议
  - 建议报价区间
  - 是否进入合作池
  - 风险提醒与谈价建议
- 支持复制结果、导出 Markdown
- 支持浏览器本地历史记录（localStorage）

## 项目结构

```bash
.
├── .github/workflows/deploy-pages.yml # GitHub Pages 自动部署工作流
├── .nojekyll                           # 关闭 Jekyll 处理，按原样发布静态资源
├── index.html                          # 页面结构：左侧录入，右侧结果
├── styles.css                          # 简洁运营风格样式
├── app.js                              # 计算逻辑、评分逻辑、建议生成、导出与本地历史
└── README.md
```

## 快速运行（本地）

### 方式一：直接打开
双击 `index.html`，使用浏览器打开即可。

### 方式二：本地静态服务（推荐）
在项目目录运行：

```bash
python3 -m http.server 8080
```

然后访问：

```text
http://localhost:8080
```

## 部署到 GitHub Pages（推荐）

仓库已经包含可直接使用的 Pages 工作流：`.github/workflows/deploy-pages.yml`。

### 1）在 GitHub 仓库里开启 Pages
1. 打开仓库页面，进入 **Settings → Pages**。
2. 在 **Build and deployment** 里，`Source` 选择 **GitHub Actions**。
3. 保存即可。

### 2）触发部署
- 合并/推送到 `main` 分支会自动触发部署；
- 也可以去 **Actions** 页面手动运行 `Deploy static site to GitHub Pages`（workflow_dispatch）。

### 3）查看最终访问链接
部署成功后可在以下位置看到网址：
- **Actions** → 最新一次 `Deploy static site to GitHub Pages` 任务详情中的 `page_url`；
- 或 **Settings → Pages** 顶部的站点地址。

通常链接格式是：

```text
https://<你的GitHub用户名>.github.io/<仓库名>/
```

> 例如仓库名是 `influencer-diagnosis-tool`，则通常为：
> `https://<你的GitHub用户名>.github.io/influencer-diagnosis-tool/`

## 示例数据

页面里点击“**填充示例数据**”即可自动填入一条示例，用来演示完整结果。

## 规则说明（MVP可改）

- 高匹配 + 数据好 + 报价合理 → 建议重点合作
- 高匹配 + 数据一般 + 内容好 → 建议寄样+低服务费测试
- 数据好 + 品牌不匹配 → 谨慎测试，不做主推
- 报价高 + 数据撑不住 → 建议压价/换方式/暂不合作
- 广告密度高或执行风险高 → 不建议进入本期合作池

报价建议：
- 高匹配+数据好：当前报价 80%-100%
- 高匹配+数据一般：当前报价 50%-70%
- 数据好+调性一般：当前报价 50%-70%
- 数据一般+调性一般：置换或低预算
- 执行风险高：不建议合作

## 下一步建议（第二版）

- 接入截图 OCR（自动提取点赞/收藏/评论/报价）
- 接入 AI 识别（内容调性、画面质感、广告密度辅助判断）
- 增加可配置打分规则（让不同品牌有自己的权重模板）
