// @ts-nocheck
import { createClient } from "@/lib/supabase/server";
import { NextRequest } from "next/server";

async function safeQuery<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try { return await fn(); } catch { return fallback; }
}

async function checkAdmin(supabase) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized", status: 401 };
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || profile.role !== "admin") return { error: "Forbidden", status: 403 };
  return { user };
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const auth = await checkAdmin(supabase);
  if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });

  const { searchParams } = request.nextUrl;
  const section = searchParams.get("section") || "list";

  if (section === "kpis") {
    const { data: files } = await safeQuery(async () => await supabase.from("media_files").select("*"), { data: null } as any);
    const rows = files || [];
    const images = rows.filter(f => f.type === "image");
    const videos = rows.filter(f => f.type === "video");
    const pdfs = rows.filter(f => f.type === "pdf");
    const svgs = rows.filter(f => f.extension === "svg");
    const icons = rows.filter(f => f.type === "icon");
    const docs = rows.filter(f => f.type === "document");
    const totalSize = rows.reduce((s, f) => s + (f.size || 0), 0);

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString();
    const recent = rows.filter(f => f.created_at && f.created_at >= weekAgo);
    const unused = rows.filter(f => !f.linked_modules || f.linked_modules.length === 0);

    const nameMap = new Map();
    const dupes: string[] = [];
    rows.forEach(f => {
      const k = `${f.filename}_${f.size}`;
      if (nameMap.has(k)) dupes.push(f.id);
      else nameMap.set(k, true);
    });

    const mostUsed = [...rows].sort((a, b) => (b.usage_count || 0) - (a.usage_count || 0)).slice(0, 5);

    return Response.json({
      totalFiles: rows.length, images: images.length, videos: videos.length,
      pdfs: pdfs.length, svgs: svgs.length, icons: icons.length, documents: docs.length,
      storageUsed: totalSize, storageRemaining: 10 * 1024 * 1024 * 1024 - totalSize,
      recentlyUploaded: recent.length, mostUsedAssets: mostUsed.length,
      unusedAssets: unused.length, duplicateFiles: dupes.length,
    });
  }

  if (section === "list") {
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "40");
    const search = searchParams.get("search") || "";
    const type = searchParams.get("type") || "";
    const extension = searchParams.get("extension") || "";
    const folder = searchParams.get("folder") || "";
    const tag = searchParams.get("tag") || "";
    const linked = searchParams.get("linked") || "";
    const sortBy = searchParams.get("sortBy") || "created_at";
    const sortDir = searchParams.get("sortDir") || "desc";
    const offset = (page - 1) * limit;

    let query = supabase.from("media_files").select("*", { count: "exact" });
    if (search) query = query.or(`filename.ilike.%${search}%,title.ilike.%${search}%,alt_text.ilike.%${search}%`);
    if (type) query = query.eq("type", type);
    if (extension) query = query.eq("extension", extension);
    if (folder) query = query.eq("folder_id", folder);
    if (tag) query = query.contains("tags", [tag]);
    if (linked) query = query.contains("linked_modules", [linked]);
    query = query.order(sortBy, { ascending: sortDir === "asc" });
    query = query.range(offset, offset + limit - 1);

    const { data, count } = await safeQuery(async () => await query, { data: null, count: 0 } as any);
    return Response.json({ rows: data || [], total: count || 0, page, limit });
  }

  if (section === "detail") {
    const id = searchParams.get("id");
    if (!id) return Response.json({ error: "Missing id" }, { status: 400 });
    const { data } = await safeQuery(async () => await supabase.from("media_files").select("*").eq("id", id).single(), { data: null } as any);
    if (!data) return Response.json({ error: "Not found" }, { status: 404 });

    let author = null;
    if (data.created_by) {
      const { data: p } = await safeQuery(async () => await supabase.from("profiles").select("id, full_name, avatar_url, email").eq("id", data.created_by).single(), { data: null } as any);
      author = p;
    }

    const { data: versions } = await safeQuery(async () => await supabase.from("media_versions").select("*").eq("media_id", id).order("created_at", { ascending: false }), { data: null } as any);

    return Response.json({ ...data, author, versions: versions || [] });
  }

  if (section === "folders") {
    const parent = searchParams.get("parent") || null;
    let query = supabase.from("media_folders").select("*");
    if (parent) query = query.eq("parent_id", parent);
    else query = query.is("parent_id", null);
    query = query.order("name", { ascending: true });
    const { data } = await safeQuery(async () => await query, { data: null } as any);
    return Response.json({ folders: data || [] });
  }

  if (section === "all_folders") {
    const { data } = await safeQuery(async () => await supabase.from("media_folders").select("*").order("name", { ascending: true }), { data: null } as any);
    return Response.json({ folders: data || [] });
  }

  if (section === "tags") {
    const { data } = await safeQuery(async () => await supabase.from("media_tags").select("*").order("name", { ascending: true }), { data: null } as any);
    return Response.json({ tags: data || [] });
  }

  if (section === "usage") {
    const id = searchParams.get("id");
    if (!id) return Response.json({ error: "Missing id" }, { status: 400 });
    const { data } = await safeQuery(async () => await supabase.from("media_usage").select("*").eq("media_id", id).order("created_at", { ascending: false }), { data: null } as any);
    return Response.json({ usage: data || [] });
  }

  if (section === "analytics") {
    const { data: files } = await safeQuery(async () => await supabase.from("media_files").select("id, type, size, usage_count, downloads, views, created_at"), { data: null } as any);
    const rows = files || [];
    const totalDownloads = rows.reduce((s, f) => s + (f.downloads || 0), 0);
    const totalViews = rows.reduce((s, f) => s + (f.views || 0), 0);
    const totalUsage = rows.reduce((s, f) => s + (f.usage_count || 0), 0);
    const mostUsed = [...rows].sort((a, b) => (b.usage_count || 0) - (a.usage_count || 0)).slice(0, 10);
    const unused = rows.filter(f => (f.usage_count || 0) === 0);

    const byType: Record<string, number> = {};
    rows.forEach(f => { byType[f.type || "other"] = (byType[f.type || "other"] || 0) + 1; });

    const byMonth: Record<string, number> = {};
    rows.forEach(f => {
      if (f.created_at) {
        const m = f.created_at.slice(0, 7);
        byMonth[m] = (byMonth[m] || 0) + (f.size || 0);
      }
    });

    return Response.json({
      totalDownloads, totalViews, totalUsage,
      mostUsed, unusedCount: unused.length,
      byType, storageGrowth: byMonth,
    });
  }

  if (section === "export") {
    const { data } = await safeQuery(async () => await supabase.from("media_files").select("*").order("created_at", { ascending: false }), { data: null } as any);
    return Response.json({ rows: data || [] });
  }

  return Response.json({ error: "Unknown section" }, { status: 400 });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const auth = await checkAdmin(supabase);
  if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });

  const body = await request.json();
  const { action } = body;

  if (action === "upload" || action === "create") {
    const { filename, title, alt_text, description, type, extension, size,
      width, height, url, thumbnail_url, folder_id, tags, linked_modules,
      storage_provider, storage_path, mime_type } = body;

    if (!filename || !url) return Response.json({ error: "Filename and URL required" }, { status: 400 });

    const { data, error } = await safeQuery(async () => await supabase.from("media_files").insert({
      filename, title: title || filename, alt_text: alt_text || null,
      description: description || null, type: type || "image",
      extension: extension || filename.split(".").pop() || "unknown",
      size: size || 0, width: width || null, height: height || null,
      url, thumbnail_url: thumbnail_url || url,
      folder_id: folder_id || null, tags: tags || [],
      linked_modules: linked_modules || [], usage_count: 0,
      downloads: 0, views: 0, storage_provider: storage_provider || "supabase",
      storage_path: storage_path || null, mime_type: mime_type || null,
      created_by: auth.user.id, is_archived: false,
    }).select().single(), { data: null, error: "Failed" } as any);

    if (!data) return Response.json({ error: "Upload failed" }, { status: 500 });
    return Response.json({ success: true, file: data });
  }

  if (action === "create_folder") {
    const { name, parent_id, color, is_private } = body;
    if (!name) return Response.json({ error: "Name required" }, { status: 400 });
    const { data } = await safeQuery(async () => await supabase.from("media_folders").insert({
      name, parent_id: parent_id || null, color: color || null,
      is_private: is_private || false, created_by: auth.user.id,
    }).select().single(), { data: null } as any);
    return Response.json({ success: true, folder: data });
  }

  if (action === "create_tag") {
    const { name, color } = body;
    if (!name) return Response.json({ error: "Name required" }, { status: 400 });
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const { data } = await safeQuery(async () => await supabase.from("media_tags").insert({ name, slug, color: color || null }).select().single(), { data: null } as any);
    return Response.json({ success: true, tag: data });
  }

  if (action === "replace") {
    const { id, url, filename, size, width, height } = body;
    if (!id || !url) return Response.json({ error: "Missing fields" }, { status: 400 });

    const { data: current } = await safeQuery(async () => await supabase.from("media_files").select("*").eq("id", id).single(), { data: null } as any);
    if (current) {
      await safeQuery(async () => await supabase.from("media_versions").insert({
        media_id: id, url: current.url, filename: current.filename,
        size: current.size, replaced_by: auth.user.id,
      }), null);
    }

    await supabase.from("media_files").update({
      url, filename: filename || current?.filename, size: size || current?.size,
      width: width || null, height: height || null, updated_at: new Date().toISOString(),
    }).eq("id", id);

    return Response.json({ success: true });
  }

  if (action === "rollback") {
    const { version_id } = body;
    if (!version_id) return Response.json({ error: "Missing version_id" }, { status: 400 });
    const { data: version } = await safeQuery(async () => await supabase.from("media_versions").select("*").eq("id", version_id).single(), { data: null } as any);
    if (!version) return Response.json({ error: "Version not found" }, { status: 404 });

    const { data: current } = await safeQuery(async () => await supabase.from("media_files").select("*").eq("id", version.media_id).single(), { data: null } as any);
    if (current) {
      await safeQuery(async () => await supabase.from("media_versions").insert({
        media_id: version.media_id, url: current.url, filename: current.filename,
        size: current.size, replaced_by: auth.user.id,
      }), null);
    }

    await supabase.from("media_files").update({
      url: version.url, filename: version.filename, size: version.size,
      updated_at: new Date().toISOString(),
    }).eq("id", version.media_id);

    return Response.json({ success: true });
  }

  return Response.json({ error: "Unknown action" }, { status: 400 });
}

export async function PUT(request: NextRequest) {
  const supabase = await createClient();
  const auth = await checkAdmin(supabase);
  if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });

  const body = await request.json();
  const { id, ...updates } = body;
  if (!id) return Response.json({ error: "Missing id" }, { status: 400 });
  updates.updated_at = new Date().toISOString();

  const { error } = await supabase.from("media_files").update(updates).eq("id", id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ success: true });
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const auth = await checkAdmin(supabase);
  if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });

  const body = await request.json();
  const { action, ids } = body;
  if (!ids?.length) return Response.json({ error: "No ids" }, { status: 400 });

  if (action === "delete") await supabase.from("media_files").delete().in("id", ids);
  else if (action === "archive") await supabase.from("media_files").update({ is_archived: true }).in("id", ids);
  else if (action === "restore") await supabase.from("media_files").update({ is_archived: false }).in("id", ids);
  else if (action === "move") {
    const { folder_id } = body;
    await supabase.from("media_files").update({ folder_id: folder_id || null }).in("id", ids);
  } else if (action === "tag") {
    const { tag } = body;
    for (const id of ids) {
      const { data } = await supabase.from("media_files").select("tags").eq("id", id).single();
      const existing = data?.tags || [];
      if (!existing.includes(tag)) {
        await supabase.from("media_files").update({ tags: [...existing, tag] }).eq("id", id);
      }
    }
  } else if (action === "duplicate") {
    for (const id of ids) {
      const { data: orig } = await supabase.from("media_files").select("*").eq("id", id).single();
      if (!orig) continue;
      const { id: _id, created_at: _ca, ...rest } = orig;
      await supabase.from("media_files").insert({
        ...rest, filename: `${rest.filename.replace(/\.[^.]+$/, "")}-copy.${rest.extension}`,
        title: `${rest.title || rest.filename} (Copy)`, usage_count: 0, downloads: 0, views: 0,
        created_by: auth.user.id,
      });
    }
  } else return Response.json({ error: "Unknown action" }, { status: 400 });

  return Response.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const auth = await checkAdmin(supabase);
  if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });

  const id = request.nextUrl.searchParams.get("id");
  const type = request.nextUrl.searchParams.get("type") || "file";

  if (!id) return Response.json({ error: "Missing id" }, { status: 400 });

  if (type === "folder") {
    await safeQuery(async () => await supabase.from("media_folders").delete().eq("id", id), null);
  } else {
    await safeQuery(async () => await supabase.from("media_files").delete().eq("id", id), null);
  }
  return Response.json({ success: true });
}
