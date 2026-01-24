
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { studentId, dormId, action } = body;

        if (!studentId || !action) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        if (action === 'remove') {
            await prisma.student.update({
                where: { id: studentId },
                data: { assignedDormId: null }
            });
            return NextResponse.json({ success: true });
        }

        if (action === 'assign') {
            if (!dormId) {
                return NextResponse.json({ error: "Dorm ID required for assignment" }, { status: 400 });
            }

            // Check capacity
            const dorm = await prisma.dorm.findUnique({
                where: { id: dormId },
                include: { students: true }
            });

            if (!dorm) {
                return NextResponse.json({ error: "Dorm not found" }, { status: 404 });
            }

            if (dorm.students.length >= dorm.capacity) {
                return NextResponse.json({ error: "Dorm is full" }, { status: 400 });
            }

            await prisma.student.update({
                where: { id: studentId },
                data: { assignedDormId: dormId }
            });

            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ error: "Invalid action" }, { status: 400 });

    } catch (error) {
        console.error("Manual allocation error:", error);
        return NextResponse.json({ error: "Operation failed" }, { status: 500 });
    }
}
