import bcrypt from 'bcryptjs';

const ROUNDS = 10;

/** 把明文密码转成哈希。 */
export async function hashPassword(plain: string): Promise<string> {
    return bcrypt.hash(plain, ROUNDS);
}

/**
 * 校验密码。
 *
 * 兼容历史数据：早期版本把密码明文存在库里，这里遇到非 bcrypt 格式的
 * 记录就按明文比较，由调用方决定是否顺手升级成哈希（shouldUpgrade）。
 */
export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
    if (!stored) return false;
    if (isHashed(stored)) {
        return bcrypt.compare(plain, stored);
    }
    return plain === stored;
}

/** 这条记录是不是已经是哈希（bcrypt 的哈希以 $2a$/$2b$/$2y$ 开头）。 */
export function isHashed(stored: string): boolean {
    return /^\$2[aby]\$/.test(stored);
}
