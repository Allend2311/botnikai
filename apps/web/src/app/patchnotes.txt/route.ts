import { readFile } from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-static";

export async function GET(): Promise<Response> {
  const patchnotes = await readFile(
    path.join(process.cwd(), "public", "patchnotes.txt"),
    "utf8",
  );

  return new Response(patchnotes, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
    },
  });
}
