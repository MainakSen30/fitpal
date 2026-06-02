import { openai } from "../clients/llm";

export async function generateWorkoutPlan(params: {
  goal: string;
  experience: string;
  daysPerWeek: number;
}) {
  // TODO: implement workout plan generation
  return { plan: "placeholder" };
}
