import type { Prisma } from '@prisma/client';

// Explicit allowlist for student data returned to clients. Never select password,
// even when the stored value is hashed. New model fields must be reviewed before
// being added here rather than becoming public automatically.
export const studentResponseSelect = {
    id: true,
    studentId: true,
    name: true,
    gender: true,
    major: true,
    bedTime: true,
    wakeTime: true,
    isSmoker: true,
    hobbies: true,
    personality: true,
    assignedDormId: true,
    createdAt: true,
    updatedAt: true,
} as const satisfies Prisma.StudentSelect;
