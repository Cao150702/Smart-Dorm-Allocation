import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { buildRooms, scoreRoom, DORM_CAPACITY } from '@/lib/matching';

// 确定性房号：男 M101、M102…；女 F101、F102…（从库中现有同性别房号继续递增）
async function nextRoomName(gender: string): Promise<string> {
    const prefix = gender === 'male' ? 'M1' : 'F1';
    const existing = await prisma.dorm.findMany({
        where: { gender },
        select: { name: true },
    });

    let max = 0;
    for (const d of existing) {
        const m = d.name.match(/^[MF]1(\d+)$/);
        if (m) {
            const n = parseInt(m[1], 10);
            if (n > max) max = n;
        }
    }
    return `${prefix}${String(max + 1).padStart(2, '0')}`;
}

export async function POST() {
    try {
        // 1. 取出所有未分配学生
        const unallocatedStudents = await prisma.student.findMany({
            where: { assignedDormId: null },
        });

        if (unallocatedStudents.length === 0) {
            return NextResponse.json({ message: "No students to allocate", allocatedCount: 0 });
        }

        let allocatedCount = 0;
        const dormSummaries: Array<{
            name: string;
            gender: string;
            size: number;
            matchScore: number;
            matchReasons: string[];
        }> = [];

        // 2. 按性别分组（硬约束：同性同房）
        const byGender: Record<'male' | 'female', typeof unallocatedStudents> = {
            male: unallocatedStudents.filter(s => s.gender === 'male'),
            female: unallocatedStudents.filter(s => s.gender === 'female'),
        };

        for (const gender of ['male', 'female'] as const) {
            const students = byGender[gender];
            if (students.length === 0) continue;

            // 3. 组队：吸烟者优先同房 + 最相似配对扩到 4 人 + 尾数兜底
            const rooms = buildRooms(students);

            for (const room of rooms) {
                const { matchScore, matchReasons } = scoreRoom(room.members);
                const majors = new Set(room.members.map(s => s.major));
                const majorPreference = majors.size === 1 ? room.members[0].major : 'Mixed';

                const dormName = await nextRoomName(gender);

                const dorm = await prisma.dorm.create({
                    data: {
                        name: dormName,
                        capacity: DORM_CAPACITY,
                        gender,
                        majorPreference,
                        matchScore,
                        matchReasons: JSON.stringify(matchReasons),
                    },
                });

                await prisma.student.updateMany({
                    where: { id: { in: room.members.map(s => s.id) } },
                    data: { assignedDormId: dorm.id },
                });

                allocatedCount += room.members.length;
                dormSummaries.push({
                    name: dormName,
                    gender,
                    size: room.members.length,
                    matchScore,
                    matchReasons,
                });
            }
        }

        const averageScore = dormSummaries.length
            ? Math.round(dormSummaries.reduce((acc, d) => acc + d.matchScore, 0) / dormSummaries.length)
            : 0;

        return NextResponse.json({
            success: true,
            allocatedCount,
            averageScore,
            dorms: dormSummaries,
        });

    } catch (error) {
        console.error("Allocation error:", error);
        return NextResponse.json({ error: "Dorm allocation failed" }, { status: 500 });
    }
}
