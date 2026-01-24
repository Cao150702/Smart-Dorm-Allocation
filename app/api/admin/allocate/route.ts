import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Student } from '@prisma/client';

const DORM_CAPACITY = 4;

export async function POST() {
    try {
        // 1. Fetch unallocated students
        const unallocatedStudents = await prisma.student.findMany({
            where: { assignedDormId: null },
        });

        if (unallocatedStudents.length === 0) {
            return NextResponse.json({ message: "No students to allocate", allocatedCount: 0 });
        }

        let allocatedCount = 0;

        // 2. Separate by Gender
        const studentsByGender: Record<string, Student[]> = {
            male: unallocatedStudents.filter(s => s.gender === 'male'),
            female: unallocatedStudents.filter(s => s.gender === 'female'),
        };

        for (const gender of ['male', 'female']) {
            const students = studentsByGender[gender];
            if (students.length === 0) continue;

            // 3. Group by Major
            const studentsByMajor: Record<string, Student[]> = {};
            const leftovers: Student[] = [];

            students.forEach(s => {
                if (!studentsByMajor[s.major]) studentsByMajor[s.major] = [];
                studentsByMajor[s.major].push(s);
            });

            // 4. Process each major
            for (const major in studentsByMajor) {
                let majorStudents = studentsByMajor[major];

                // Sort by BedTime to group similar sleep schedules
                majorStudents.sort((a, b) => a.bedTime - b.bedTime);

                while (majorStudents.length >= DORM_CAPACITY) {
                    const roomStudents = majorStudents.splice(0, DORM_CAPACITY);
                    await createDormAndAssign(roomStudents, gender, major);
                    allocatedCount += roomStudents.length;
                }

                // Remaining students (< 4) go to leftovers
                leftovers.push(...majorStudents);
            }

            // 5. Process leftovers (Mixed majors)
            // Sort by BedTime again
            leftovers.sort((a, b) => a.bedTime - b.bedTime);

            while (leftovers.length > 0) {
                // Take up to DORM_CAPACITY
                const roomStudents = leftovers.splice(0, DORM_CAPACITY);
                // If we have very few students left (e.g. 1), we still give them a room in this MVP
                await createDormAndAssign(roomStudents, gender, 'Mixed');
                allocatedCount += roomStudents.length;
            }
        }

        return NextResponse.json({ success: true, allocatedCount });

    } catch (error) {
        console.error("Allocation error:", error);
        return NextResponse.json({ error: "Details allocation failed" }, { status: 500 });
    }
}

async function createDormAndAssign(students: Student[], gender: string, majorPreference: string) {
    // Create a new Dorm
    // We can generate a generic name e.g. "Auto-X"
    // For better naming, we'd need to query existing count or use UUID
    const dormName = `Room-${Math.floor(Math.random() * 10000)}`;

    const dorm = await prisma.dorm.create({
        data: {
            name: dormName,
            capacity: DORM_CAPACITY,
            gender: gender,
            majorPreference: majorPreference,
        },
    });

    // Update students
    await prisma.student.updateMany({
        where: { id: { in: students.map(s => s.id) } },
        data: { assignedDormId: dorm.id },
    });
}
