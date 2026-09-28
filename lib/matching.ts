// 可解释的多维寝室匹配算法
// 硬约束：同性别同房、每间最多 4 人、吸烟者优先与吸烟者同房。
// 评分（0-100）：作息接近度 40 + 兴趣重合度（Jaccard）25 + MBTI 契合 20 + 同专业加成 15。
// 组队：同性别内「最相似配对 → 扩到 4 人」迭代成房；不足 4 人的尾数兜底成混合房。

import type { Student } from '@prisma/client'

export const DORM_CAPACITY = 4

// 各维度权重（合计 100）
export const WEIGHTS = {
  schedule: 40, // 作息接近度（bedTime/wakeTime 差值）
  hobbies: 25,  // 兴趣重合度（Jaccard）
  mbti: 20,     // MBTI 契合（同位字母重合数）
  major: 15,    // 同专业加成
} as const

// 一天中作息差值的最大可能（23+23）
const MAX_SCHEDULE_DIFF = 46

export interface PairScore {
  score: number      // 0-100 综合分
  schedule: number   // 0-40
  hobbies: number    // 0-25
  mbti: number       // 0-20
  major: number      // 0-15
  reasons: string[]  // 可解释理由
}

export interface RoomScore {
  matchScore: number       // 房内所有两两配对分的均值（四舍五入）
  matchReasons: string[]   // 去重后的理由（按配对分从高到低收集，最多 4 条）
  detail: {
    schedule: number
    hobbies: number
    mbti: number
    major: number
  }
}

export interface RoomPlan {
  members: Student[]
}

function fmtHour(h: number): string {
  return `${String(h).padStart(2, '0')}:00`
}

/** 解析学生的 hobbies（JSON 字符串数组），失败返回空数组 */
export function parseHobbies(student: Pick<Student, 'hobbies'>): string[] {
  try {
    const parsed = JSON.parse(student.hobbies)
    return Array.isArray(parsed) ? parsed.map(String) : []
  } catch {
    return []
  }
}

/** 两名学生的两两匹配评分与理由 */
export function pairScore(a: Student, b: Student): PairScore {
  // 1. 作息接近度：入睡差 + 起床差，越小越好
  const bedDiff = Math.abs(a.bedTime - b.bedTime)
  const wakeDiff = Math.abs(a.wakeTime - b.wakeTime)
  const schedule = Math.round(WEIGHTS.schedule * (1 - (bedDiff + wakeDiff) / MAX_SCHEDULE_DIFF))

  // 2. 兴趣重合度：Jaccard 系数 = |A∩B| / |A∪B|
  const ha = parseHobbies(a)
  const hb = parseHobbies(b)
  const intersection = ha.filter((h) => hb.includes(h))
  const union = new Set([...ha, ...hb]).size
  const jaccard = union === 0 ? 0 : intersection.length / union
  const hobbies = Math.round(WEIGHTS.hobbies * jaccard)

  // 3. MBTI 契合：同位字母重合数（0-4）
  const pa = a.personality ?? ''
  const pb = b.personality ?? ''
  let letterMatches = 0
  for (let i = 0; i < 4; i++) {
    if (pa[i] && pa[i] === pb[i]) letterMatches++
  }
  const mbti = Math.round(WEIGHTS.mbti * (letterMatches / 4))

  // 4. 同专业加成
  const major = a.major === b.major ? WEIGHTS.major : 0

  const score = schedule + hobbies + mbti + major

  // 可解释理由
  const reasons: string[] = []
  if (bedDiff <= 1 && wakeDiff <= 1) {
    reasons.push(`作息相近（${fmtHour(a.bedTime)}/${fmtHour(b.bedTime)} 睡，${fmtHour(a.wakeTime)}/${fmtHour(b.wakeTime)} 起）`)
  } else if (bedDiff <= 1) {
    reasons.push(`入睡时间相近（${fmtHour(a.bedTime)}/${fmtHour(b.bedTime)}）`)
  }
  if (intersection.length > 0) {
    reasons.push(`兴趣重合：${intersection.join('、')}`)
  }
  if (letterMatches >= 3) {
    reasons.push(`MBTI 契合：${pa} / ${pb}`)
  }
  if (a.major === b.major) {
    reasons.push(`同专业：${a.major}`)
  }

  return { score, schedule, hobbies, mbti, major, reasons }
}

/** 从候选池中挑出最相似的一对，再逐个吸纳与现有成员平均分最高的学生，扩到 4 人 */
function growRoom(pool: Student[]): Student[] {
  // 1. 最相似配对
  let bestI = 0
  let bestJ = 1
  let bestScore = -1
  for (let i = 0; i < pool.length; i++) {
    for (let j = i + 1; j < pool.length; j++) {
      const s = pairScore(pool[i], pool[j]).score
      if (s > bestScore) {
        bestScore = s
        bestI = i
        bestJ = j
      }
    }
  }

  const room = [pool[bestI], pool[bestJ]]
  const taken = new Set(room.map((s) => s.id))

  // 2. 扩到 4 人：每次加入与现有成员平均配对分最高的学生
  while (room.length < DORM_CAPACITY) {
    let best: Student | null = null
    let bestAvg = -1
    for (const s of pool) {
      if (taken.has(s.id)) continue
      const avg = room.reduce((acc, m) => acc + pairScore(s, m).score, 0) / room.length
      if (avg > bestAvg) {
        bestAvg = avg
        best = s
      }
    }
    if (!best) break
    room.push(best)
    taken.add(best.id)
  }

  return room
}

/**
 * 同性别内组队：
 * 1. 吸烟者池 / 不吸烟者池分别贪心成 4 人房（吸烟者尽量同房）；
 * 2. 尾数兜底：剩余吸烟者集中到一起（不足 4 人则用不吸烟者补齐），
 *    其余尾数继续贪心成房，最终不足 4 人的组成混合房。
 */
export function buildRooms(students: Student[]): RoomPlan[] {
  const smokers = students.filter((s) => s.isSmoker)
  const nonSmokers = students.filter((s) => !s.isSmoker)
  const rooms: RoomPlan[] = []

  const greedyPack = (pool: Student[]): Student[] => {
    const remaining = [...pool]
    while (remaining.length >= DORM_CAPACITY) {
      const room = growRoom(remaining)
      const ids = new Set(room.map((s) => s.id))
      const rest = remaining.filter((s) => !ids.has(s.id))
      remaining.length = 0
      remaining.push(...rest)
      rooms.push({ members: room })
    }
    return remaining
  }

  const smokerLeft = greedyPack(smokers)
  const nonLeft = greedyPack(nonSmokers)

  // 尾数：剩余吸烟者保持在一起，不足 4 人用不吸烟者补齐
  if (smokerLeft.length > 0) {
    const room = [...smokerLeft]
    while (room.length < DORM_CAPACITY && nonLeft.length > 0) {
      room.push(nonLeft.shift()!)
    }
    rooms.push({ members: room })
  }

  // 剩余尾数继续成房
  const finalLeft = [...nonLeft]
  while (finalLeft.length >= DORM_CAPACITY) {
    const room = growRoom(finalLeft)
    const ids = new Set(room.map((s) => s.id))
    const rest = finalLeft.filter((s) => !ids.has(s.id))
    finalLeft.length = 0
    finalLeft.push(...rest)
    rooms.push({ members: room })
  }
  if (finalLeft.length > 0) {
    rooms.push({ members: finalLeft })
  }

  return rooms
}

/** 计算整间房的匹配分与理由：所有两两配对分的均值，理由按配对分从高到低收集去重 */
export function scoreRoom(members: Student[]): RoomScore {
  if (members.length < 2) {
    return {
      matchScore: 0,
      matchReasons: ['尾数不足，单人入住'],
      detail: { schedule: 0, hobbies: 0, mbti: 0, major: 0 },
    }
  }

  const pairs: PairScore[] = []
  for (let i = 0; i < members.length; i++) {
    for (let j = i + 1; j < members.length; j++) {
      pairs.push(pairScore(members[i], members[j]))
    }
  }

  const avg = (field: 'score' | 'schedule' | 'hobbies' | 'mbti' | 'major') =>
    Math.round(pairs.reduce((acc, p) => acc + p[field], 0) / pairs.length)

  const sorted = [...pairs].sort((x, y) => y.score - x.score)
  const reasons: string[] = []
  for (const p of sorted) {
    for (const r of p.reasons) {
      if (!reasons.includes(r)) reasons.push(r)
      if (reasons.length >= 4) break
    }
    if (reasons.length >= 4) break
  }

  return {
    matchScore: avg('score'),
    matchReasons: reasons,
    detail: {
      schedule: avg('schedule'),
      hobbies: avg('hobbies'),
      mbti: avg('mbti'),
      major: avg('major'),
    },
  }
}
