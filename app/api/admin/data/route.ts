import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
    try {
        const totalStudents = await prisma.student.count();
        const unallocatedStudents = await prisma.student.count({
            where: { assignedDormId: null },
        });
        const allocatedStudents = totalStudents - unallocatedStudents;
        const totalDorms = await prisma.dorm.count();

        const students = await prisma.student.findMany({
            include: { assignedDorm: true },
            orderBy: { createdAt: 'desc' },
        });

        const dorms = await prisma.dorm.findMany({
            include: { students: true },
        });

        return NextResponse.json({
            stats: {
                totalStudents,
                allocatedStudents,
                unallocatedStudents,
                totalDorms,
            },
            students,
            dorms,
        });
    } catch (error) {
        console.error("Error fetching admin data:", error);
        return NextResponse.json({ error: "Failed to fetch data" }, { status: 500 });
    }
}
