"use client";

import { useState, useRef, useEffect } from "react";
import { Camera, Loader2, Trash2, Check } from "lucide-react";
import { useAuthStore } from "@/lib/store/auth-store";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";

const ACCEPT = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

// Downscale + compress an image to a square 320px webp/jpeg before upload.
async function compressToSquare(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const size = 320;
  const canvas = document.createElement("canvas");
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const min = Math.min(bitmap.width, bitmap.height);
  const sx = (bitmap.width - min) / 2, sy = (bitmap.height - min) / 2;
  ctx.drawImage(bitmap, sx, sy, min, min, 0, 0, size, size);
  const type = "image/webp";
  return await new Promise((res) => canvas.toBlob((b) => res(b!), type, 0.85));
}

const isValidPhone = (p: string) => p === "" || /^\+?[0-9\s\-().]{6,20}$/.test(p.trim());
const isValidName = (n: string) => n.trim().length >= 2 && n.trim().length <= 60;

export function ProfileInformation() {
  const user = useAuthStore((s) => s.user);
  const profile = useAuthStore((s) => s.profile);
  const updateProfile = useAuthStore((s) => s.updateProfile);

  const initialName = profile?.full_name || user?.user_metadata?.full_name || "";
  const initialPhone = (profile as any)?.phone || "";
  const email = user?.email || "";
  const avatarUrl = profile?.avatar_url || null;

  const [fullName, setFullName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone);
  const [newEmail, setNewEmail] = useState(email);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setFullName(profile?.full_name || user?.user_metadata?.full_name || ""); setPhone((profile as any)?.phone || ""); }, [profile, user]);
  useEffect(() => { setNewEmail(email); }, [email]);

  const memberSince = profile?.created_at ? new Date(profile.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" }) : "";
  const initial = (fullName || email || "?").charAt(0).toUpperCase();

  // Dirty detection — Save disabled until something actually changed & valid.
  const dirty = fullName.trim() !== initialName.trim() || (phone || "").trim() !== (initialPhone || "").trim();
  const canSave = dirty && isValidName(fullName) && isValidPhone(phone) && !saving;

  const pickFile = () => fileRef.current?.click();

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user) return;
    if (!ACCEPT.includes(file.type)) { toast("warn", "Use a JPG, PNG or WEBP image."); return; }
    if (file.size > 8 * 1024 * 1024) { toast("warn", "Image is too large (max 8MB)."); return; }
    setUploading(true);
    try {
      const blob = await compressToSquare(file);
      const supabase = createClient();
      const path = `${user.id}/avatar-${Date.now()}.webp`;
      const { error } = await supabase.storage.from("avatars").upload(path, blob, { contentType: "image/webp", upsert: true });
      if (error) throw error;
      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      await updateProfile({ avatar_url: pub.publicUrl });
      toast("success", "Profile photo updated.");
    } catch (err: any) {
      toast("warn", err.message || "Upload failed.");
    } finally { setUploading(false); }
  };

  const removePhoto = async () => {
    if (!avatarUrl) return;
    setUploading(true);
    try { await updateProfile({ avatar_url: null }); toast("success", "Photo removed."); }
    catch (err: any) { toast("warn", err.message || "Failed."); }
    finally { setUploading(false); }
  };

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      await updateProfile({ full_name: fullName.trim(), phone: phone.trim() || null } as any);
      toast("success", "Profile saved.");
    } catch (err: any) { toast("warn", err.message || "Save failed."); }
    finally { setSaving(false); }
  };

  const changeEmail = async () => {
    const e = newEmail.trim().toLowerCase();
    if (e === email.toLowerCase()) return;
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) { toast("warn", "Enter a valid email."); return; }
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ email: e });
      if (error) throw error;
      toast("success", "Confirmation sent to your new email. Click the link to finish.");
    } catch (err: any) { toast("warn", err.message || "Could not change email."); }
  };

  const inputCls = "w-full h-[46px] rounded-[12px] border-[1.5px] border-[#e4e7eb] bg-[#fbfbfc] px-4 text-[14px] font-medium text-[#16181d] placeholder:text-[#9aa3ad] outline-none focus:border-[#2563eb]";
  const labelCls = "text-[13px] font-semibold text-[#16181d] mb-1.5 block";

  return (
    <>
      <h2 className="text-[18px] font-extrabold text-[#16181d] mb-5">Profile Information</h2>

      {/* Avatar */}
      <div className="flex items-center gap-4 mb-6">
        <div className="relative">
          <div className="w-[80px] h-[80px] rounded-full overflow-hidden bg-[#2563eb] text-white flex items-center justify-center text-[30px] font-bold ring-2 ring-white shadow">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
            ) : initial}
          </div>
          <button type="button" onClick={pickFile} disabled={uploading} aria-label="Change photo"
            className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-[#2563eb] text-white flex items-center justify-center shadow ring-2 ring-white hover:bg-[#1d4ed8] disabled:opacity-60">
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
          </button>
        </div>
        <div className="min-w-0">
          <p className="text-[16px] font-bold text-[#16181d]">{fullName || "User"}</p>
          {memberSince && <p className="text-[13px] text-[#5b6472]">Member since {memberSince}</p>}
          <div className="flex gap-3 mt-1.5">
            <button type="button" onClick={pickFile} className="text-[12px] font-bold text-[#2563eb] hover:underline">{avatarUrl ? "Replace photo" : "Add photo"}</button>
            {avatarUrl && <button type="button" onClick={removePhoto} className="text-[12px] font-bold text-[#ef4444] hover:underline inline-flex items-center gap-1"><Trash2 className="w-3 h-3" /> Remove</button>}
          </div>
        </div>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={onFile} />
      </div>

      {/* Fields */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Full Name</label>
          <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputCls} maxLength={60} />
          {!isValidName(fullName) && fullName.length > 0 && <p className="text-[11px] text-[#ef4444] mt-1">Name must be 2–60 characters.</p>}
        </div>
        <div>
          <label className={labelCls}>Phone</label>
          <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 555 123 4567" className={inputCls} />
          {!isValidPhone(phone) && <p className="text-[11px] text-[#ef4444] mt-1">Enter a valid phone number.</p>}
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls}>Email</label>
          <div className="flex gap-2">
            <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className={inputCls} />
            <button type="button" onClick={changeEmail} disabled={newEmail.trim().toLowerCase() === email.toLowerCase()}
              className="shrink-0 h-[46px] px-4 rounded-[12px] border-[1.5px] border-[#e4e7eb] text-[13px] font-bold text-[#2563eb] hover:border-[#2563eb] disabled:opacity-50 disabled:hover:border-[#e4e7eb]">
              Update
            </button>
          </div>
          <p className="text-[11px] text-[#9aa3ad] mt-1">Changing your email sends a confirmation link to the new address.</p>
        </div>
      </div>

      <Button size="md" className="mt-5" onClick={save} disabled={!canSave}>
        {saving ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Saving…</> : <><Check className="w-4 h-4 mr-2" /> Save Changes</>}
      </Button>
      {!dirty && <p className="text-[11px] text-[#9aa3ad] mt-2">No changes to save.</p>}
    </>
  );
}
