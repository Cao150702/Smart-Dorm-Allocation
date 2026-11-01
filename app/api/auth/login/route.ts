import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword, isHashed, verifyPassword } from '@/lib/password';
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

        if (!student || !(await verifyPassword(password, student.password))) {
            return NextResponse.json({ error: "学号或密码错误" }, { status: 401 });
        }

        // 老数据存的是明文，登录成功时顺手升级成哈希。
        if (!isHashed(student.password)) {
            await prisma.student.update({
                where: { id: student.id },
                data: { password: await hashPassword(password) },
            });
        }

        // 返回给前端的内容里不能带密码（哪怕是哈希）。
        const { password: _password, ...safeStudent } = student;

        // In a real app, we would set a session cookie here.
        // For this prototype, we return the student data and handle state on frontend.
        return NextResponse.json({ success: true, student: safeStudent });

    } catch (error) {
        console.error("Login error:", error);
        return NextResponse.json({ error: "登录失败" }, { status: 500 });
    }
}
