import assert from 'node:assert/strict';
import { before, after, beforeEach, test } from 'node:test';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import vm from 'node:vm';
import ts from 'typescript';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const require = createRequire(import.meta.url);
// These tests call the actual route handlers and Prisma queries, but only against
// a new disposable SQLite database, never the application database or a running app.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const directory = mkdtempSync(path.join(tmpdir(), 'dorm-response-security-'));
const databaseUrl = `file:${path.join(directory, 'test.db')}`;
const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
const modules = new Map();

// Compile the application's TypeScript in memory, resolving its @/ alias and
// injecting only the isolated database client. NextResponse, Zod and bcrypt are real.
function loadApplicationModule(relativePath) {
    const filename = path.join(root, relativePath);
    if (modules.has(filename)) return modules.get(filename).exports;
    const loaded = { exports: {} };
    modules.set(filename, loaded);
    const output = ts.transpileModule(readFileSync(filename, 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
        fileName: filename,
    }).outputText;
    const localRequire = createRequire(filename);
    const resolve = (specifier) => {
        if (specifier === '@/lib/prisma') return { prisma };
        if (specifier.startsWith('@/')) return loadApplicationModule(`${specifier.slice(2)}.ts`);
        return localRequire(specifier);
    };
    const compiled = vm.runInThisContext(`(function(require, module, exports) {\n${output}\n})`, { filename });
    compiled(resolve, loaded, loaded.exports);
    return loaded.exports;
}

const studentRoute = loadApplicationModule('app/api/students/[id]/route.ts');
const adminRoute = loadApplicationModule('app/api/admin/data/route.ts');
const registrationRoute = loadApplicationModule('app/api/students/route.ts');
const loginRoute = loadApplicationModule('app/api/auth/login/route.ts');
const { studentResponseSelect } = loadApplicationModule('lib/student-response.ts');
const safeFields = [
    'id', 'studentId', 'name', 'gender', 'major', 'bedTime', 'wakeTime',
    'isSmoker', 'hobbies', 'personality', 'assignedDormId', 'createdAt', 'updatedAt',
];
const plainPassword = 'synthetic-test-password';
let hash;

function request(body, method = 'POST') {
    return new Request('http://example.invalid/api/test', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
}

function params(id) { return { params: Promise.resolve({ id }) }; }

async function makeStudent(overrides = {}) {
    return prisma.student.create({
        data: {
            id: 'synthetic-internal-id', studentId: 'SYNTHETIC-001', password: hash,
            name: 'Synthetic Student', gender: 'female', major: 'Synthetic Major',
            bedTime: 22, wakeTime: 7, isSmoker: false,
            hobbies: '["synthetic-hobby"]', personality: 'INTJ',
            ...overrides,
        },
    });
}

function assertNoCredentials(value) {
    if (Array.isArray(value)) return value.forEach(assertNoCredentials);
    if (value && typeof value === 'object') {
        for (const [key, child] of Object.entries(value)) {
            assert.notEqual(key, 'password');
            assertNoCredentials(child);
        }
    } else if (typeof value === 'string') {
        assert.notEqual(value, hash);
        assert.notEqual(value, plainPassword);
    }
}

function assertSafeStudent(actual, stored, extraFields = []) {
    assert.deepEqual(Object.keys(actual).sort(), [...safeFields, ...extraFields].sort());
    for (const field of safeFields) {
        const expected = stored[field] instanceof Date ? stored[field].toISOString() : stored[field];
        assert.deepEqual(actual[field], expected, field);
    }
    assertNoCredentials(actual);
}

before(async () => {
    const push = spawnSync(process.execPath, [require.resolve('prisma/build/index.js'),
        'db', 'push', '--skip-generate', '--schema', path.join(root, 'prisma/schema.prisma')], {
        cwd: directory,
        env: { ...process.env, DATABASE_URL: databaseUrl, PRISMA_HIDE_UPDATE_MESSAGE: 'true' },
        encoding: 'utf8',
    });
    assert.equal(push.status, 0, `${push.stdout}\n${push.stderr}`);
    hash = await bcrypt.hash(plainPassword, 4);
});

beforeEach(async () => {
    await prisma.student.deleteMany();
    await prisma.dorm.deleteMany();
});

after(async () => {
    await prisma.$disconnect();
    rmSync(directory, { recursive: true, force: true });
});

test('student response allowlist contains only reviewed public fields', () => {
    assert.deepEqual(Object.keys(studentResponseSelect).sort(), [...safeFields].sort());
    assert.ok(Object.values(studentResponseSelect).every((selected) => selected === true));
});

for (const identifier of ['id', 'studentId']) {
    test(`student GET by ${identifier} preserves every safe field without credentials`, async () => {
        const student = await makeStudent();
        const response = await studentRoute.GET(new Request('http://example.invalid'), params(student[identifier]));
        assert.equal(response.status, 200);
        assertSafeStudent(await response.json(), student);
    });

    test(`student PATCH by ${identifier} preserves updates without returning or changing credentials`, async () => {
        const student = await makeStudent();
        const updates = {
            gender: 'male', major: 'Updated Synthetic Major', bedTime: 23, wakeTime: 8,
            isSmoker: true, hobbies: ['synthetic-hobby', 'second-hobby'], personality: 'ENFP',
            password: 'must-not-be-written', id: 'replacement', studentId: 'replacement', name: 'replacement',
        };
        const response = await studentRoute.PATCH(request(updates, 'PATCH'), params(student[identifier]));
        assert.equal(response.status, 200);
        const stored = await prisma.student.findUniqueOrThrow({ where: { id: student.id } });
        assertSafeStudent(await response.json(), stored);
        for (const field of ['gender', 'major', 'bedTime', 'wakeTime', 'isSmoker', 'personality']) {
            assert.equal(stored[field], updates[field]);
        }
        assert.equal(stored.hobbies, JSON.stringify(updates.hobbies));
        for (const field of ['id', 'studentId', 'name', 'password']) assert.equal(stored[field], student[field]);
    });
}

test('student GET still prioritizes the internal ID when identifiers collide', async () => {
    const student = await makeStudent();
    await makeStudent({ id: 'other-id', studentId: student.id });
    const response = await studentRoute.GET(new Request('http://example.invalid'), params(student.id));
    assertSafeStudent(await response.json(), student);
});

for (const method of ['GET', 'PATCH']) {
    test(`student ${method} returns the existing 404 for an unknown ID`, async () => {
        const response = await studentRoute[method](request({}, 'PATCH'), params('missing-id'));
        assert.equal(response.status, 404);
        assert.deepEqual(await response.json(), { error: 'Student not found' });
    });
}

test('admin response keeps statistics, ordering and relations but no nested credentials', async () => {
    const dorm = await prisma.dorm.create({ data: { id: 'synthetic-dorm', name: 'Synthetic Room', gender: 'female' } });
    const emptyDorm = await prisma.dorm.create({ data: { id: 'empty-dorm', name: 'Empty Room', gender: 'male' } });
    const allocated = await makeStudent({ assignedDormId: dorm.id, createdAt: new Date('2026-01-01T00:00:00Z') });
    const unallocated = await makeStudent({ id: 'unallocated-id', studentId: 'SYNTHETIC-002', createdAt: new Date('2026-02-01T00:00:00Z') });
    const response = await adminRoute.GET();
    assert.equal(response.status, 200);
    const body = await response.json();
    assertNoCredentials(body);
    assert.deepEqual(body.stats, { totalStudents: 2, allocatedStudents: 1, unallocatedStudents: 1, totalDorms: 2 });
    assertSafeStudent(body.students[0], unallocated, ['assignedDorm']);
    assertSafeStudent(body.students[1], allocated, ['assignedDorm']);
    assert.equal(body.students[0].assignedDorm, null);
    assert.deepEqual(body.students[1].assignedDorm, JSON.parse(JSON.stringify(dorm)));
    const occupied = body.dorms.find((item) => item.id === dorm.id);
    assert.equal(occupied.students.length, 1);
    assertSafeStudent(occupied.students[0], allocated);
    assert.deepEqual(body.dorms.find((item) => item.id === emptyDorm.id).students, []);
    const { students, ...returnedDorm } = occupied;
    assert.equal(students.length, 1);
    assert.deepEqual(returnedDorm, JSON.parse(JSON.stringify(dorm)));
});

test('admin response handles an empty database', async () => {
    const response = await adminRoute.GET();
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
        stats: { totalStudents: 0, allocatedStudents: 0, unallocatedStudents: 0, totalDorms: 0 },
        students: [], dorms: [],
    });
});

function registration() {
    return { studentId: 'NEW-SYNTHETIC', password: plainPassword, name: 'New Synthetic',
        gender: 'female', major: 'Synthetic Major', bedTime: 22, wakeTime: 7,
        isSmoker: false, hobbies: ['synthetic-hobby'], personality: 'INTJ' };
}

test('registration stores a verified hash and returns the same safe student shape', async () => {
    const response = await registrationRoute.POST(request(registration()));
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.success, true);
    const stored = await prisma.student.findUniqueOrThrow({ where: { studentId: 'NEW-SYNTHETIC' } });
    assertSafeStudent(body.student, stored);
    assert.notEqual(stored.password, plainPassword);
    assert.equal(await bcrypt.compare(plainPassword, stored.password), true);
});

test('registration retains duplicate and invalid-input checks', async () => {
    await makeStudent({ studentId: 'NEW-SYNTHETIC' });
    const duplicate = await registrationRoute.POST(request(registration()));
    assert.equal(duplicate.status, 400);
    assertNoCredentials(await duplicate.json());
    const invalid = await registrationRoute.POST(request({ studentId: '' }));
    assert.equal(invalid.status, 400);
    assert.equal(await prisma.student.count(), 1);
});

for (const legacy of [false, true]) {
    test(`login ${legacy ? 'upgrades legacy plaintext' : 'verifies a hash'} without returning credentials`, async () => {
        const student = await makeStudent({ password: legacy ? plainPassword : hash });
        const response = await loginRoute.POST(request({ studentId: student.studentId, password: plainPassword }));
        assert.equal(response.status, 200);
        const body = await response.json();
        assert.equal(body.success, true);
        assertSafeStudent(body.student, student);
        const stored = await prisma.student.findUniqueOrThrow({ where: { id: student.id } });
        assert.equal(await bcrypt.compare(plainPassword, stored.password), true);
    });
}

test('login still rejects an incorrect password and unknown student', async () => {
    const student = await makeStudent();
    for (const studentId of [student.studentId, 'missing-student']) {
        const response = await loginRoute.POST(request({ studentId, password: 'wrong-synthetic-password' }));
        assert.equal(response.status, 401);
        assertNoCredentials(await response.json());
    }
});

for (const method of ['GET', 'PATCH']) {
    test(`student ${method} also excludes an unmigrated plaintext password`, async () => {
        const student = await makeStudent({ password: plainPassword });
        const response = await studentRoute[method](request({ hobbies: [] }, 'PATCH'), params(student.studentId));
        assert.equal(response.status, 200);
        const stored = await prisma.student.findUniqueOrThrow({ where: { id: student.id } });
        assertSafeStudent(await response.json(), stored);
        assert.equal(stored.password, plainPassword);
    });
}

test('admin data excludes unmigrated plaintext from top-level and nested students', async () => {
    const dorm = await prisma.dorm.create({ data: { name: 'Synthetic Legacy Room', gender: 'female' } });
    const student = await makeStudent({ password: plainPassword, assignedDormId: dorm.id });
    const response = await adminRoute.GET();
    assert.equal(response.status, 200);
    const body = await response.json();
    assertNoCredentials(body);
    assertSafeStudent(body.students[0], student, ['assignedDorm']);
    assertSafeStudent(body.dorms[0].students[0], student);
});
