import { PrismaClient } from "@/generated/prisma";
import { PrismaD1 } from "@prisma/adapter-d1";
import { getCloudflareContext } from "@opennextjs/cloudflare";

export async function getPrismaClient(): Promise<PrismaClient> {
  const { env } = await getCloudflareContext();
  const adapter = new PrismaD1(env.DB);
  return new PrismaClient({ adapter });
}
