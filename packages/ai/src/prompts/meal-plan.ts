import { openai } from "../clients/llm";

export async function generateMealPlan(params: {
  caloriesTarget: number;
  diet: string;
  allergies: string[];
}) {
  // TODO: implement meal plan generation
  return { plan: "placeholder" };
}
