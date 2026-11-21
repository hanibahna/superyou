import { put } from "@vercel/blob";
import { NextResponse, type NextRequest } from "next/server";
import { adminGuard } from "@/lib/admin-auth";

// Product photo upload → Vercel Blob (Storage → Create → Blob in the Vercel dashboard).
export async function POST(req: NextRequest) {
  const denied = await adminGuard();
  if (denied) return denied;
  if (!process.env.BLOB_READ_WRITE_TOKEN)
    return NextResponse.json({ error: "Photo uploads need Vercel Blob. Add a Blob store to this project, or paste image URLs instead." }, { status: 501 });
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file" }, { status: 400 });
  if (!/^image\/(jpeg|png|webp|avif|gif)$/.test(file.type)) return NextResponse.json({ error: "Use a JPG, PNG, WebP or AVIF image" }, { status: 400 });
  if (file.size > 8 * 1024 * 1024) return NextResponse.json({ error: "Image must be under 8 MB" }, { status: 400 });
  const safe = file.name.toLowerCase().replace(/[^a-z0-9.]+/g, "-");
  const blob = await put(`products/${safe}`, file, { access: "public", addRandomSuffix: true, contentType: file.type });
  return NextResponse.json({ url: blob.url });
}
