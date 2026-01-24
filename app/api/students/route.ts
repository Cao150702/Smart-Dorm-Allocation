import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const studentSchema = z.object({
    studentId: z.string().min(1, "学号不能为空"),
    password: z.string().min(1, "密码不能为空"),
    name: z.string().min(1, "姓名不能为空"),
    gender: z.enum(["male", "female"]),
    major: z.string().min(1, "专业不能为空"),
    bedTime: z.number().min(0).max(23),
    wakeTime: z.number().min(0).max(23),
    isSmoker: z.boolean(),
    hobbies: z.array(z.string()),
    personality: z.string().min(1),
});

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const validation = studentSchema.safeParse(body);

        if (!validation.success) {
            return NextResponse.json({ error: validation.error.format() }, { status: 400 });
        }

        const { data } = validation;

        // Check if studentId exists
        const existing = await prisma.student.findUnique({
            where: { studentId: data.studentId }
        });

        if (existing) {
            return NextResponse.json({ error: "该学号已存在" }, { status: 400 });
        }

        const student = await prisma.student.create({
            data: {
                ...data,
                hobbies: JSON.stringify(data.hobbies),
            },
        });

        return NextResponse.json({ success: true, student });
    } catch (error) {
        console.error("Error creating student:", error);
        return NextResponse.json({ error: "注册失败" }, { status: 500 });
    }
}
