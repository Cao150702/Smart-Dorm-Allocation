#!/usr/bin/env node
// 演示数据脚本：重置数据库，生成 32 名演示学生（16男16女、5 个专业、作息/兴趣/MBTI/吸烟多样）。
// 用法：npm run seed:demo
import { PrismaClient } from '@prisma/client';
import { existsSync } from 'node:fs';

// 普通 node 脚本不会像 Prisma CLI 那样自动加载 .env，手动补上
if (!process.env.DATABASE_URL && existsSync('.env')) {
  process.loadEnvFile('.env');
}

const prisma = new PrismaClient();

const MAJORS = ['通信工程', '计算机科学', '机械设计', '经济学', '法学'];
const HOBBIES = ['篮球', '音乐', '编程', '游戏', '跑步', '摄影', '阅读', '健身'];

// [学号, 姓名, 性别, 专业, bedTime, wakeTime, isSmoker, hobbies, MBTI]
const STUDENTS = [
  // ---- 男生 16 人 ----
  ['20250001', '张伟', 'male', '通信工程', 23, 7, false, ['篮球', '音乐'], 'INTJ'],
  ['20250002', '王强', 'male', '通信工程', 23, 7, false, ['篮球', '音乐', '跑步'], 'ISTJ'],
  ['20250003', '李杰', 'male', '通信工程', 23, 8, false, ['编程', '音乐'], 'INTP'],
  ['20250004', '刘洋', 'male', '通信工程', 22, 7, false, ['编程', '游戏', '音乐'], 'ENTJ'],
  ['20250005', '陈浩', 'male', '计算机科学', 0, 8, false, ['编程', '游戏'], 'INTP'],
  ['20250006', '杨帆', 'male', '计算机科学', 0, 8, false, ['编程', '游戏', '音乐'], 'INTJ'],
  ['20250007', '赵磊', 'male', '计算机科学', 0, 9, false, ['编程', '游戏', '摄影'], 'ISTP'],
  ['20250008', '孙鹏', 'male', '计算机科学', 23, 8, true, ['编程', '游戏'], 'ENTP'],
  ['20250009', '周涛', 'male', '机械设计', 22, 6, false, ['篮球', '健身', '跑步'], 'ESTJ'],
  ['20250010', '吴斌', 'male', '机械设计', 22, 6, false, ['篮球', '健身'], 'ESFJ'],
  ['20250011', '郑强', 'male', '机械设计', 22, 7, false, ['篮球', '音乐', '健身'], 'ISTJ'],
  ['20250012', '冯军', 'male', '经济学', 23, 8, true, ['阅读', '音乐', '篮球'], 'INFJ'],
  ['20250013', '褚明', 'male', '经济学', 23, 8, true, ['阅读', '音乐'], 'ENFJ'],
  ['20250014', '卫东', 'male', '法学', 22, 7, true, ['阅读', '跑步'], 'INTJ'],
  ['20250015', '蒋涛', 'male', '法学', 22, 7, true, ['阅读', '跑步', '音乐'], 'INFP'],
  ['20250016', '沈磊', 'male', '通信工程', 23, 7, false, ['篮球', '摄影'], 'ISFP'],
  // ---- 女生 16 人 ----
  ['20250101', '王芳', 'female', '通信工程', 23, 7, false, ['音乐', '摄影'], 'INFJ'],
  ['20250102', '李娜', 'female', '通信工程', 23, 7, false, ['音乐', '摄影', '阅读'], 'ENFJ'],
  ['20250103', '刘婷', 'female', '通信工程', 23, 8, false, ['音乐', '阅读'], 'INFP'],
  ['20250104', '陈静', 'female', '通信工程', 22, 7, false, ['音乐', '编程'], 'INTJ'],
  ['20250105', '杨丽', 'female', '计算机科学', 0, 8, false, ['编程', '游戏'], 'INTJ'],
  ['20250106', '赵敏', 'female', '计算机科学', 0, 8, false, ['编程', '游戏', '音乐'], 'INTP'],
  ['20250107', '孙悦', 'female', '计算机科学', 0, 9, false, ['编程', '游戏', '摄影'], 'ISTP'],
  ['20250108', '周雪', 'female', '计算机科学', 23, 8, true, ['编程', '游戏'], 'ENTJ'],
  ['20250109', '吴丽', 'female', '机械设计', 22, 6, false, ['健身', '跑步'], 'ESFJ'],
  ['20250110', '郑爽', 'female', '机械设计', 22, 6, false, ['健身', '跑步', '篮球'], 'ESTJ'],
  ['20250111', '冯雪', 'female', '机械设计', 22, 7, false, ['健身', '音乐'], 'ISFJ'],
  ['20250112', '褚婷', 'female', '经济学', 23, 8, true, ['阅读', '音乐'], 'ENFJ'],
  ['20250113', '卫兰', 'female', '经济学', 23, 8, true, ['阅读', '音乐', '摄影'], 'INFJ'],
  ['20250114', '蒋欣', 'female', '法学', 22, 7, true, ['阅读', '跑步'], 'INFP'],
  ['20250115', '沈梅', 'female', '法学', 22, 7, true, ['阅读', '跑步', '音乐'], 'INTJ'],
  ['20250116', '韩雪', 'female', '通信工程', 23, 7, false, ['音乐', '篮球'], 'ESFP'],
];

async function main() {
  console.log('开始重置数据库...');
  // 先清学生（有外键关系），再清寝室与配置项
  await prisma.student.deleteMany();
  await prisma.dorm.deleteMany();
  await prisma.systemOption.deleteMany();

  console.log('写入专业与兴趣配置...');
  await prisma.systemOption.createMany({
    data: [
      ...MAJORS.map(v => ({ type: 'major', value: v })),
      ...HOBBIES.map(v => ({ type: 'hobby', value: v })),
    ],
  });

  console.log('生成 32 名演示学生...');
  await prisma.student.createMany({
    data: STUDENTS.map(([studentId, name, gender, major, bedTime, wakeTime, isSmoker, hobbies, personality]) => ({
      studentId,
      password: '123',
      name,
      gender,
      major,
      bedTime,
      wakeTime,
      isSmoker,
      hobbies: JSON.stringify(hobbies),
      personality,
    })),
  });

  const maleCount = STUDENTS.filter(s => s[2] === 'male').length;
  const femaleCount = STUDENTS.filter(s => s[2] === 'female').length;
  const smokerCount = STUDENTS.filter(s => s[6]).length;
  console.log(`✓ 完成：男生 ${maleCount} 人，女生 ${femaleCount} 人，吸烟 ${smokerCount} 人，共 ${STUDENTS.length} 人`);
  console.log('下一步：启动 dev 后 POST /api/admin/allocate 即可一键分配。');
}

main()
  .catch((e) => {
    console.error('seed 失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
