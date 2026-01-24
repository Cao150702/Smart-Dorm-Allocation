
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    const id = params.id;
    try {
        // Try finding by internal ID first, then studentId
        let student = await prisma.student.findUnique({ where: { id } });
        if (!student) {
            student = await prisma.student.findFirst({ where: { studentId: id } });
        }

        if (!student) {
            return NextResponse.json({ error: "Student not found" }, { status: 404 });
        }
        return NextResponse.json(student);
    } catch (error) {
        return NextResponse.json({ error: "Failed to fetch student" }, { status: 500 });
    }
}

export async function PATCH(request: Request, props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    const id = params.id;
    try {
        const body = await request.json();

        // Allowed fields to update
        const { gender, major, bedTime, wakeTime, isSmoker, hobbies, personality } = body;

        let student = await prisma.student.findUnique({ where: { id } });
        if (!student) {
            student = await prisma.student.findFirst({ where: { studentId: id } });
        }

        if (!student) {
            return NextResponse.json({ error: "Student not found" }, { status: 404 });
        }

        const updated = await prisma.student.update({
            where: { id: student.id }, // Use the resolved internal ID
            data: {
                gender,
                major,
                bedTime,
                wakeTime,
                isSmoker,
                hobbies: JSON.stringify(hobbies), // Store as JSON string
                personality
            }
        });

        return NextResponse.json(updated);
    } catch (error) {
        console.error("Update error:", error);
        return NextResponse.json({ error: "Update failed" }, { status: 500 });
    }
}
