import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

// Default Data to seed if empty
const DEFAULT_MAJORS = ["计算机科学", "电子工程", "艺术设计", "经济学", "法学", "医学", "物理学", "化学"];
const DEFAULT_HOBBIES = ["阅读", "游戏", "运动", "音乐", "编程", "旅游", "摄影", "烹饪"];

export async function GET() {
    try {
        let majors = await prisma.systemOption.findMany({ where: { type: 'major' } });
        let hobbies = await prisma.systemOption.findMany({ where: { type: 'hobby' } });

        // Seed if empty (Auto-init)
        if (majors.length === 0) {
            await prisma.systemOption.createMany({
                data: DEFAULT_MAJORS.map(v => ({ type: 'major', value: v }))
            });
            majors = await prisma.systemOption.findMany({ where: { type: 'major' } });
        }

        if (hobbies.length === 0) {
            await prisma.systemOption.createMany({
                data: DEFAULT_HOBBIES.map(v => ({ type: 'hobby', value: v }))
            });
            hobbies = await prisma.systemOption.findMany({ where: { type: 'hobby' } });
        }

        return NextResponse.json({
            majors: majors.map(m => m.value),
            hobbies: hobbies.map(h => h.value)
        });
    } catch (error) {
        console.error("Config fetch error:", error);
        return NextResponse.json({ error: "Failed to fetch config" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { type, value, action } = body;

        if (!type || !value) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

        if (action === 'add') {
            await prisma.systemOption.create({
                data: { type, value }
            });
        } else if (action === 'delete') {
            await prisma.systemOption.deleteMany({
                where: { type, value }
            });
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("Config Update Error:", error);
        return NextResponse.json({ error: error.message || "Update failed" }, { status: 500 });
    }
}
