import { requireGuildManager } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const MAX_FILE_SIZE = 8 * 1024 * 1024;
const IMAGE_TYPES = new Set(["image/gif", "image/jpeg", "image/png", "image/webp"]);

function jsonError(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}

export async function POST(request: Request): Promise<Response> {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_FILE_SIZE + 64 * 1024) {
    return jsonError("Images must be smaller than 8 MB.", 413);
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return jsonError("Could not read the upload. Please try again.", 400);
  }

  const guildId = formData.get("guildId");
  const imageType = formData.get("imageType");
  const file = formData.get("file");

  if (
    typeof guildId !== "string" ||
    !/^\d{17,20}$/.test(guildId) ||
    (imageType !== "welcome" && imageType !== "goodbye") ||
    !(file instanceof File)
  ) {
    return jsonError("Choose an image and try again.", 400);
  }

  if (!IMAGE_TYPES.has(file.type)) {
    return jsonError("Choose a PNG, JPEG, WebP, or GIF image.", 415);
  }

  if (file.size === 0 || file.size > MAX_FILE_SIZE) {
    return jsonError("Images must be smaller than 8 MB.", 413);
  }

  try {
    await requireGuildManager(guildId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not verify your server permissions.";
    const status = /Manage Server|not a member/i.test(message) ? 403 : 401;
    return jsonError(message, status);
  }

  try {
    const image = await prisma.welcomeImage.create({
      data: {
        guildId,
        imageType,
        mimeType: file.type,
        data: Buffer.from(await file.arrayBuffer()),
      },
      select: { id: true },
    });
    const publicUrl = new URL(process.env.APP_URL ?? request.url);
    publicUrl.pathname = `/api/welcome-images/${encodeURIComponent(image.id)}`;
    publicUrl.search = "";
    publicUrl.hash = "";
    return Response.json({ url: publicUrl.toString() });
  } catch (error) {
    console.error("[image-upload] Could not save image to database:", error);
    return jsonError("Could not save the image to the database. Please try again.", 500);
  }
}
