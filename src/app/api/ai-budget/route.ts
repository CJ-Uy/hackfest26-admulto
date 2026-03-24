import { getNeuronBudget } from "@/lib/ai-provider";

export async function GET() {
  return Response.json(getNeuronBudget());
}
