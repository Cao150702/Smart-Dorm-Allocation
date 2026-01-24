# 智慧寝室分配系统 (Smart Dorm Allocation)

这是一个基于 Next.js 开发的智慧寝室分配系统，旨在通过分析学生的性格、作息习惯和兴趣爱好，自动为学生分配最合适的室友。

## 功能特点

- **学生端**
  - **学号登录**：安全便捷的身份验证。
  - **个人画像录入**：包含作息时间、MBTI 性格、吸烟习惯、兴趣爱好等。
  - **移动端适配**：精美的 UI 设计，支持手机端访问。

- **管理员后台**
  - **数据概览**：实时查看已分配/未分配学生人数及寝室资源。
  - **学生管理**：手动录入新生信息（学号/密码）。
  - **智能分配**：一键运行分配算法，按性别、专业、作息聚类分配寝室。
  - **寝室可视化**：直观展示每个寝室的入住情况。

## 技术栈

- **前端框架**: Next.js 14+ (App Router)
- **样式库**: Tailwind CSS, Shadcn UI (Radix UI)
- **数据库**: SQLite (通过 Prisma ORM 管理)
- **表单验证**: Zod + React Hook Form

## 快速开始

1. **安装依赖**
   ```bash
   npm install
   ```

2. **初始化数据库**
   ```bash
   npx prisma db push
   ```

3. **启动开发服务器**
   ```bash
   npm run dev
   ```
   访问 [http://localhost:3000](http://localhost:3000)

## 使用指南

### 学生
1. 访问首页，使用管理员分配的**学号**和**密码**登录。
2. 填写个人习惯调查问卷并保存。

### 管理员
1. 访问 `/admin` 页面（[http://localhost:3000/admin](http://localhost:3000/admin)）。
2. 点击右上角 **"录入学生"**，添加新学生的学号、姓名和初始密码。
3. 待学生填写完问卷后，点击 **"一键智能分配"** 进行寝室安排。

## ☁️ 云服务器部署教程 (Linux 保姆级)

本教程以 **Ubuntu 20.04/22.04** 为例，手把手教你在阿里云/腾讯云上部署本项目。

### 1. 环境准备
连接到你的服务器终端，按顺序执行以下命令安装 Node.js (v18+) 和 Git。

```bash
# 更新软件源
sudo apt update

# 安装 Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 验证安装 (出现版本号即成功)
node -v
npm -v
```

### 2. 获取代码与安装依赖
你可以通过 git clone 拉取代码，或者本地打包上传。这里演示 git 方式。

```bash
# 拉取代码 (请替换为你自己的 GitHub 仓库地址)
git clone https://github.com/your-username/smart-dorm.git
cd smart-dorm

# 安装依赖
npm install

# 初始化数据库
npx prisma generate
npx prisma db push
```

### 3. 构建项目
在上线前需要编译 Next.js 项目。

```bash
npm run build
```
*如果服务器配置较低（如 1核2G），构建可能会卡住，建议在本地执行 `npm run build` 后上传 `.next` 文件夹。*

### 4. 使用 PM2 启动服务
PM2 可以让你的服务在后台运行，并在崩溃后自动重启。

```bash
# 全局安装 PM2
sudo npm install -g pm2

# 启动服务 (端口默认为 3000)
# --name 指定服务名称
pm2 start npm --name "smart-dorm" -- start

# 查看运行状态
pm2 list

# 设置开机自启
pm2 startup
pm2 save
```
此时，访问 `http://服务器IP:3000` 即可看到项目。

### 5. (可选) 配置 Nginx 反向代理
如果你想通过域名访问（即去掉 :3000 端口），需要配置 Nginx。

```bash
# 安装 Nginx
sudo apt install nginx -y

# 编辑配置文件
sudo nano /etc/nginx/sites-available/default
```

将文件内容替换为（保留原有 server_name 等配置，主要修改 location）：

```nginx
server {
    listen 80;
    server_name your-domain.com; # 替换为你的域名或 IP

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

保存并退出 (`Ctrl+O`, `Enter`, `Ctrl+X`)，然后重启 Nginx：

```bash
sudo systemctl restart nginx
```

现在直接访问 `http://你的IP` 即可！
