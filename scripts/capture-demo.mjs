#!/usr/bin/env node
// 参赛演示素材采集脚本（Playwright）
// 用法：
//   node scripts/capture-demo.mjs screenshots   # 桌面 1280x800 截屏 01-07 + 手机 390x844 截屏 08
//   node scripts/capture-demo.mjs video         # 1280x720 操作走查录像（walkthrough.webm，可用 ffmpeg 转 mp4）
//   node scripts/capture-demo.mjs all           # 依次执行上面两阶段
// 前置：
//   1) dev server 运行在 127.0.0.1:3187（npm run dev -- -p 3187）
//   2) 数据库为 seed:demo 状态；screenshots 阶段需在「分配前」运行，
//      video 阶段请先重新 npm run seed:demo，以便录到一键分配动作。
// 安装（不要写进 package.json）：
//   npm i --no-save playwright && npx playwright install chromium
import { chromium } from 'playwright';
import { mkdirSync, renameSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.SDA_BASE_URL || 'http://127.0.0.1:3187';
const OUT = path.resolve(__dirname, '../screenshots');
mkdirSync(OUT, { recursive: true });

const STUDENT_ID = '20250001'; // 张伟，INTJ，篮球/音乐
const PASSWORD = '123';        // seed-demo.mjs 统一初始密码

const phase = process.argv[2] || 'screenshots';

// 全局吞掉原生 alert/confirm（登录保存、一键分配都会弹 alert；
// headless 下原生弹窗会阻塞渲染主线程，必须立刻接受，否则后续动作全部卡死）
function swallowDialogs(page) {
  page.on('dialog', async (d) => {
    console.log('  [dialog]', d.type(), d.message());
    await d.accept();
  });
}

// 原生 DOM click：绕开 Playwright 对元素可点性的等待。
// 分配按钮点击后立刻变 disabled + 弹出 alert，Playwright 的 click 动作会被卡住，
// 用 el.click() 直接触发 React onClick 即可。
async function domClick(page, text, selector = 'button') {
  const ok = await page.evaluate(({ text, selector }) => {
    const els = [...document.querySelectorAll(selector)];
    const el = els.find(e => e.textContent.includes(text) && e.offsetParent !== null && !e.disabled);
    if (!el) return false;
    el.click();
    return true;
  }, { text, selector });
  if (!ok) throw new Error('未找到可点击元素: ' + text + ' (' + selector + ')');
}

async function login(page, { holdMs = 500 } = {}) {
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.getByPlaceholder('请输入学号').waitFor({ timeout: 60000 });
  await page.getByPlaceholder('请输入学号').pressSequentially(STUDENT_ID, { delay: 90 });
  await page.getByPlaceholder('系统初始密码').pressSequentially(PASSWORD, { delay: 90 });
  await page.getByRole('button', { name: '进入系统' }).click();
  await page.waitForURL('**/student/profile', { timeout: 60000 });
  await page.getByText('个人信息录入').waitFor({ timeout: 60000 });
  await page.getByRole('button', { name: '保存资料' }).waitFor({ timeout: 60000 });
  if (holdMs) await page.waitForTimeout(holdMs);
}

// 保存画像：点“保存资料”，等 PATCH 返回（alert 由 swallowDialogs 自动接受）
async function saveProfile(page) {
  const respP = page.waitForResponse(
    r => r.url().includes('/api/students/') && r.request().method() === 'PATCH',
    { timeout: 30000 }
  );
  await domClick(page, '保存资料');
  await respP;
  await page.waitForTimeout(600); // 等 alert 被自动接受、state 更新
}

async function desktopScreenshots() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  swallowDialogs(page);
  const shot = (name, full = false) =>
    page.screenshot({ path: path.join(OUT, name), fullPage: full });

  // 01 首页/登录页
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.getByText('智慧寝室').first().waitFor({ timeout: 60000 });
  await page.getByPlaceholder('请输入学号').waitFor({ timeout: 60000 });
  await page.waitForTimeout(700);
  await shot('01-home-login.png');
  console.log('[01] 首页/登录页 OK');

  // 02 学生登录 → 画像问卷（部分填写：勾选「摄影」爱好）
  await login(page, { holdMs: 300 });
  await page.getByRole('button', { name: '摄影' }).click(); // 已有 篮球/音乐，再补选 摄影
  await page.waitForTimeout(700);
  await shot('02-student-profile.png');
  console.log('[02] 画像问卷（部分填写）OK');

  // 03 保存成功后的状态（刷新后回读，验证已持久化）
  await saveProfile(page);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByText('个人信息录入').waitFor({ timeout: 60000 });
  await page.getByRole('button', { name: '保存资料' }).waitFor({ timeout: 60000 });
  await page.waitForTimeout(800);
  await shot('03-profile-saved.png');
  console.log('[03] 保存成功状态（刷新回读）OK');

  // 04 管理端数据概览（分配前）
  await page.goto(BASE + '/admin', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.getByText('智慧寝室管理后台').waitFor({ timeout: 60000 });
  await page.getByText('待分配列表').waitFor({ timeout: 60000 });
  await page.waitForTimeout(900);
  await shot('04-admin-before.png', true);
  console.log('[04] 管理端概览（分配前）OK');

  // 05 一键分配 → 结果
  const respP = page.waitForResponse(
    r => r.url().includes('/api/admin/allocate') && r.request().method() === 'POST',
    { timeout: 60000 }
  );
  await domClick(page, '一键分配');
  const alloc = await (await respP).json();
  console.log('  [allocate]', JSON.stringify(alloc).slice(0, 220));
  // 等刷新完成：一键分配按钮重新禁用 + 出现寝室卡片
  await page.waitForFunction(() => {
    const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('一键分配'));
    return b ? b.disabled : true;
  }, null, { timeout: 30000 });
  await page.getByText('M101').waitFor({ timeout: 30000 });
  await page.waitForTimeout(900);
  await shot('05-admin-after-allocate.png', true);
  console.log('[05] 一键分配结果 OK');

  // 06 寝室卡片：匹配分 + 匹配理由
  const data = await (await page.request.get(BASE + '/api/admin/data')).json();
  const dorms = data.dorms || [];
  const best = [...dorms].sort((a, b) => (b.matchScore ?? -1) - (a.matchScore ?? -1))[0];
  console.log('  [dorms]', dorms.map(d => `${d.name}=${d.matchScore}分(${d.students.length}人)`).join(', '));
  // 06a 寝室概览区域（多张卡片）
  await page.getByRole('heading', { name: '寝室分配概览' }).scrollIntoViewIfNeeded();
  await page.waitForTimeout(600);
  await shot('06a-rooms-overview.png');
  console.log('[06a] 寝室可视化概览 OK');
  // 06b 最高分房间卡片特写（含匹配理由）
  const cardRoot = page.getByText(best.name).first()
    .locator('xpath=ancestor::*[contains(@class,"rounded-lg") and contains(@class,"border-gray-800")][1]');
  await cardRoot.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await cardRoot.screenshot({ path: path.join(OUT, '06b-best-room-card.png') });
  console.log(`[06b] 最高分卡片特写：${best.name}（${best.matchScore} 分）OK`);

  // 07 学生详细信息弹窗
  const firstStudentName = best.students?.[0]?.name || '张伟';
  await cardRoot.getByText(firstStudentName).first().click();
  await page.getByText('详细信息').waitFor({ timeout: 15000 });
  await page.waitForTimeout(600);
  await shot('07-student-detail-dialog.png');
  console.log('[07] 学生详情弹窗 OK');
  await page.keyboard.press('Escape');

  // 08 手机视口：画像页
  await ctx.close();
  const mctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const mpage = await mctx.newPage();
  swallowDialogs(mpage);
  await login(mpage, { holdMs: 300 });
  await mpage.waitForTimeout(800);
  await mpage.screenshot({ path: path.join(OUT, '08-mobile-profile.png'), fullPage: true });
  console.log('[08] 手机视口画像页 OK');
  await mctx.close();
  await browser.close();
  console.log('截屏阶段完成，文件在', OUT);
}

async function recordVideo() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: { dir: OUT, size: { width: 1280, height: 720 } },
  });
  const page = await ctx.newPage();
  swallowDialogs(page);
  const t = (ms) => page.waitForTimeout(ms);

  // 登录
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.getByPlaceholder('请输入学号').waitFor({ timeout: 60000 });
  await t(2600);
  await page.getByPlaceholder('请输入学号').pressSequentially(STUDENT_ID, { delay: 160 });
  await page.getByPlaceholder('系统初始密码').pressSequentially(PASSWORD, { delay: 160 });
  await t(700);
  await page.getByRole('button', { name: '进入系统' }).click();
  await page.waitForURL('**/student/profile', { timeout: 60000 });
  await page.getByRole('button', { name: '保存资料' }).waitFor({ timeout: 60000 });
  await t(3000);

  // 填写问卷
  await page.getByRole('button', { name: '摄影' }).click();
  await t(1200);
  await page.getByText('MBTI 性格类型').locator('xpath=following::button[1]').first().click();
  await t(900);
  await page.getByRole('option', { name: 'ENFJ' }).click();
  await t(2000);
  await domClick(page, '保存资料');
  await t(3200);

  // 管理端：分配前 → 一键分配
  await page.goto(BASE + '/admin', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.getByText('待分配列表').waitFor({ timeout: 60000 });
  await t(4600);
  await domClick(page, '一键分配');
  await page.waitForFunction(() => {
    const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('一键分配'));
    return b ? b.disabled : true;
  }, null, { timeout: 30000 });
  await page.getByText('M101').waitFor({ timeout: 30000 });
  await t(4600);

  // 滚动查看寝室卡片（匹配分+理由）
  await page.getByRole('heading', { name: '寝室分配概览' }).scrollIntoViewIfNeeded();
  await t(2000);
  await page.mouse.wheel(0, 220); await t(1300);
  await page.mouse.wheel(0, 220); await t(1600);
  await page.mouse.wheel(0, 180); await t(2800);
  await page.mouse.wheel(0, -400); await t(2000);

  // 打开学生详情弹窗
  const data = await (await page.request.get(BASE + '/api/admin/data')).json();
  const best = [...(data.dorms || [])].sort((a, b) => (b.matchScore ?? -1) - (a.matchScore ?? -1))[0];
  const firstStudentName = best?.students?.[0]?.name;
  if (firstStudentName) {
    await page.getByText(firstStudentName).first().click();
    await page.getByText('详细信息').waitFor({ timeout: 15000 });
    await t(3600);
    await page.keyboard.press('Escape');
    await t(2200);
  }

  await ctx.close();
  const video = page.video();
  if (video) {
    const final = path.join(OUT, 'walkthrough.webm');
    renameSync(await video.path(), final);
    console.log('视频完成:', final);
  }
  await browser.close();
}

if (phase === 'video') {
  await recordVideo();
} else if (phase === 'all') {
  await desktopScreenshots();
  await recordVideo();
} else {
  await desktopScreenshots();
}

