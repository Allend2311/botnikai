import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ imageId: string }> },
): Promise<Response> {
  const { imageId } = await params;
  if (!/^[a-zA-Z0-9_-]{8,64}$/.test(imageId)) {
    return new Response("Not found", { status: 404 });
  }

  const image = await prisma.welcomeImage.findUnique({
    where: { id: imageId },
    select: { mimeType: true, data: true },
  });

  if (!image) {
    return new Response("Not found", { status: 404 });
  }

  return new Response(image.data, {
    headers: {
      "Content-Type": image.mimeType,
      "Content-Length": String(image.data.byteLength),
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
