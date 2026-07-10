// @ts-nocheck
import { createClient } from "@/lib/supabase/server";
import { NextRequest } from "next/server";

const DEFAULT_BUCKET = "product-images";
const ALLOWED_BUCKETS = new Set(["product-images", "banner-images"]);
const MAX_SIZE = 8 * 1024 * 1024; // 8MB
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
  "image/svg+xml",
]);

const EXT_MAP: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
  "image/svg+xml": "svg",
};

async function checkAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized", status: 401 };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    return { error: "Forbidden", status: 403 };
  }

  return { user };
}

function sanitizeName(name: string) {
  return name
    .toLowerCase()
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || "image";
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const auth = await checkAdmin(supabase);
    if ("error" in auth) {
      return Response.json({ error: auth.error }, { status: auth.status });
    }

    const formData = await request.formData();
    const files = formData.getAll("files") as File[];
    const folder = (formData.get("folder") as string) || "products";
    const bucketParam = (formData.get("bucket") as string) || DEFAULT_BUCKET;
    const BUCKET = ALLOWED_BUCKETS.has(bucketParam) ? bucketParam : DEFAULT_BUCKET;

    if (!files || files.length === 0) {
      return Response.json({ error: "No files provided" }, { status: 400 });
    }
    if (files.length > 12) {
      return Response.json({ error: "Maximum 12 files per upload" }, { status: 400 });
    }

    const uploaded: { url: string; path: string; name: string; size: number }[] = [];
    const errors: { name: string; error: string }[] = [];

    for (const file of files) {
      if (!(file instanceof File)) continue;
      if (!ALLOWED_TYPES.has(file.type)) {
        errors.push({ name: file.name, error: "Unsupported file type" });
        continue;
      }
      if (file.size > MAX_SIZE) {
        errors.push({ name: file.name, error: "File exceeds 8MB limit" });
        continue;
      }

      const ext = EXT_MAP[file.type] || "bin";
      const safeFolder = folder.replace(/[^a-z0-9/-]/gi, "").slice(0, 40) || "products";
      const path = `${safeFolder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${sanitizeName(file.name)}.${ext}`;
      const buffer = Buffer.from(await file.arrayBuffer());

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, buffer, { contentType: file.type, upsert: false });

      if (uploadError) {
        errors.push({ name: file.name, error: uploadError.message });
        continue;
      }

      const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
      uploaded.push({ url: pub.publicUrl, path, name: file.name, size: file.size });
    }

    if (uploaded.length === 0) {
      return Response.json(
        { error: errors[0]?.error || "Upload failed", errors },
        { status: 400 }
      );
    }

    return Response.json({ files: uploaded, errors }, { status: 201 });
  } catch (error) {
    console.error("Upload API error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const auth = await checkAdmin(supabase);
    if ("error" in auth) {
      return Response.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    const { url, path } = body;
    let bucket = ALLOWED_BUCKETS.has(body.bucket) ? body.bucket : DEFAULT_BUCKET;

    let targetPath = path;
    if (!targetPath && url) {
      // Derive both bucket and path from a public URL of any allowed bucket
      for (const b of ALLOWED_BUCKETS) {
        const marker = `/object/public/${b}/`;
        const idx = url.indexOf(marker);
        if (idx >= 0) { bucket = b; targetPath = decodeURIComponent(url.slice(idx + marker.length)); break; }
      }
    }

    if (!targetPath) {
      return Response.json({ error: "path or url required" }, { status: 400 });
    }

    const { error } = await supabase.storage.from(bucket).remove([targetPath]);
    if (error) {
      return Response.json({ error: error.message }, { status: 400 });
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("Upload API DELETE error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
