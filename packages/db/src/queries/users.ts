import { asc, eq } from "drizzle-orm";
import { db } from "../client";
import { users, type User } from "../schema";

export async function findUserByEmail(email: string): Promise<User | undefined> {
  const [row] = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase().trim()))
    .limit(1);
  return row;
}

export async function listUsers(): Promise<User[]> {
  return db
    .select()
    .from(users)
    .orderBy(asc(users.role), asc(users.name));
}

export async function upsertUser(values: {
  email: string;
  name: string;
  role: "regulador" | "admin";
  passwordHash: string;
}): Promise<User> {
  const normalized = values.email.toLowerCase().trim();
  const [row] = await db
    .insert(users)
    .values({
      email: normalized,
      name: values.name,
      role: values.role,
      passwordHash: values.passwordHash,
    })
    .onConflictDoUpdate({
      target: users.email,
      set: {
        name: values.name,
        role: values.role,
        passwordHash: values.passwordHash,
        isActive: true,
      },
    })
    .returning();
  if (!row) throw new Error("upsertUser returned no row");
  return row;
}

export async function rotateUserPassword(
  userId: number,
  passwordHash: string,
): Promise<void> {
  await db
    .update(users)
    .set({ passwordHash })
    .where(eq(users.id, userId));
}

export async function findUserById(id: number): Promise<User | undefined> {
  const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return row;
}
