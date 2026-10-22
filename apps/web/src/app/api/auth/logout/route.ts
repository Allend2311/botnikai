import { redirect } from "next/navigation";
import { destroySession } from "@/lib/session";

export async function POST(): Promise<never> {
  await destroySession();
  redirect("/");
}

export async function GET(): Promise<never> {
  await destroySession();
  redirect("/");
}
