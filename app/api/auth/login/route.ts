import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const loginSchema = z.object({
    studentId: z.string().min(1, "请输入学号"),
    password: z.string().min(1, "请输入密码"),
});

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const validation = loginSchema.safeParse(body);

        if (!validation.success) {
            return NextResponse.json({ error: "输入无效" }, { status: 400 });
        }

        const { studentId, password } = validation.data;

        const student = await prisma.student.findUnique({
            where: { studentId },
        });

        if (!student || student.password !== password) {
            return NextResponse.json({ error: "学号或密码错误" }, { status: 401 });
        }

        // In a real app, we would set a session cookie here.
        // For this prototype, we return the student data and handle state on frontend.
        return NextResponse.json({ success: true, student });

    } catch (error) {
        console.error("Login error:", error);
        return NextResponse.json({ error: "登录失败" }, { status: 500 });
    }
}
