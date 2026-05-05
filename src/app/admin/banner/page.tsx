"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";

// ─── Supabase Client ─────────────────────────────────────────────────────────
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const MAX_BANNERS = 4;

// ─── Types ────────────────────────────────────────────────────────────────────
interface Banner {
  id: string;
  title: string;
  description: string | null;
  image_url: string;
  link_url: string | null;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

interface EditForm {
  title: string;
  description: string;
  link_url: string;
  is_active: boolean;
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function BannersPage() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Per-slot upload state
  const [uploading, setUploading] = useState<Record<number, boolean>>({});
  const [uploadProgress, setUploadProgress] = useState<Record<number, number>>({});

  // Delete state
  const [deleting, setDeleting] = useState<string | null>(null);

  // Edit modal
  const [editBanner, setEditBanner] = useState<Banner | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({
    title: "", description: "", link_url: "", is_active: true,
  });
  const [editSaving, setEditSaving] = useState(false);

  // Bulk upload modal
  const [bulkFiles, setBulkFiles] = useState<File[]>([]);
  const [bulkPreviews, setBulkPreviews] = useState<string[]>([]);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(0);

  const bulkInputRef = useRef<HTMLInputElement>(null);
  const slotInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchBanners = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("banners")
      .select("*")
      .order("display_order", { ascending: true });
    if (error) setError(error.message);
    else setBanners(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchBanners(); }, []);

  // Auto-clear toasts
  useEffect(() => {
    if (success || error) {
      const t = setTimeout(() => { setSuccess(null); setError(null); }, 3500);
      return () => clearTimeout(t);
    }
  }, [success, error]);

  // ── Upload single image to Supabase Storage ────────────────────────────────
  const uploadImageFile = async (file: File, slot: number): Promise<string> => {
    const ext = file.name.split(".").pop();
    const filePath = `banners/slot-${slot}-${Date.now()}.${ext}`;
    setUploadProgress((p) => ({ ...p, [slot]: 40 }));
    const { error } = await supabase.storage
      .from("banners")
      .upload(filePath, file, { contentType: file.type, upsert: false });
    if (error) throw new Error(error.message);
    setUploadProgress((p) => ({ ...p, [slot]: 90 }));
    const { data } = supabase.storage.from("banners").getPublicUrl(filePath);
    return data.publicUrl;
  };

  const deleteStorageImage = async (imageUrl: string) => {
    try {
      const pathParts = new URL(imageUrl).pathname.split("/storage/v1/object/public/banners/");
      if (pathParts[1]) await supabase.storage.from("banners").remove([pathParts[1]]);
    } catch { /* ignore */ }
  };

  // ── Slot click → single image replace / add ────────────────────────────────
  const handleSlotImageChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
    slotIndex: number,
    existingBanner: Banner | null
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Only image files are allowed."); return; }
    if (file.size > 5 * 1024 * 1024) { setError("Image size should not be greater than 5MB."); return; }

    setUploading((u) => ({ ...u, [slotIndex]: true }));
    setUploadProgress((p) => ({ ...p, [slotIndex]: 10 }));

    try {
      const imageUrl = await uploadImageFile(file, slotIndex);

      if (existingBanner) {
        await deleteStorageImage(existingBanner.image_url);
        const { error } = await supabase
          .from("banners")
          .update({ image_url: imageUrl })
          .eq("id", existingBanner.id);
        if (error) throw new Error(error.message);
        setSuccess(`Slot ${slotIndex + 1} banner replaced successfully! ✅`);
      } else {
        const { error } = await supabase.from("banners").insert({
          title: `Banner ${slotIndex + 1}`,
          image_url: imageUrl,
          is_active: true,
          display_order: slotIndex,
        });
        if (error) throw new Error(error.message);
        setSuccess(`Slot ${slotIndex + 1} banner added successfully! ✅`);
      }

      await fetchBanners();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploading((u) => ({ ...u, [slotIndex]: false }));
      setUploadProgress((p) => ({ ...p, [slotIndex]: 0 }));
      if (slotInputRefs.current[slotIndex]) slotInputRefs.current[slotIndex]!.value = "";
    }
  };

  // ── Bulk upload: select multiple images for empty slots ────────────────────
  const handleBulkFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const emptySlots = MAX_BANNERS - banners.length;
    if (files.length === 0) return;

    const valid = files.filter((f) => f.type.startsWith("image/") && f.size <= 5 * 1024 * 1024);
    const toUpload = valid.slice(0, emptySlots);

    if (toUpload.length < files.length)
      setError(`Only ${emptySlots} slot(s) are empty. ${toUpload.length} image(s) will be uploaded.`);

    setBulkFiles(toUpload);
    setBulkPreviews(toUpload.map((f) => URL.createObjectURL(f)));
    setShowBulkModal(true);
  };

  const handleBulkUpload = async () => {
    if (bulkFiles.length === 0) return;
    setBulkUploading(true);
    setBulkProgress(0);

    try {
      // Find empty slot indices
      const filledSlots = new Set(banners.map((b) => b.display_order));
      const emptySlotIndices: number[] = [];
      for (let i = 0; i < MAX_BANNERS && emptySlotIndices.length < bulkFiles.length; i++) {
        if (!filledSlots.has(i)) emptySlotIndices.push(i);
      }

      for (let i = 0; i < bulkFiles.length; i++) {
        const file = bulkFiles[i];
        const slot = emptySlotIndices[i];
        const ext = file.name.split(".").pop();
        const filePath = `banners/slot-${slot}-${Date.now()}.${ext}`;

        const { error: uploadErr } = await supabase.storage
          .from("banners")
          .upload(filePath, file, { contentType: file.type, upsert: false });
        if (uploadErr) throw new Error(uploadErr.message);

        const { data } = supabase.storage.from("banners").getPublicUrl(filePath);

        const { error: insertErr } = await supabase.from("banners").insert({
          title: `Banner ${slot + 1}`,
          image_url: data.publicUrl,
          is_active: true,
          display_order: slot,
        });
        if (insertErr) throw new Error(insertErr.message);

        setBulkProgress(Math.round(((i + 1) / bulkFiles.length) * 100));
      }

      setSuccess(`${bulkFiles.length} banner(s) added successfully! ✅`);
      setShowBulkModal(false);
      setBulkFiles([]);
      setBulkPreviews([]);
      await fetchBanners();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Bulk upload failed.");
    } finally {
      setBulkUploading(false);
      setBulkProgress(0);
      if (bulkInputRef.current) bulkInputRef.current.value = "";
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = async (banner: Banner) => {
    // if (!confirm(`"${banner.title}" Are you sure you want to delete this banner?`)) return;
    setDeleting(banner.id);
    try {
      await deleteStorageImage(banner.image_url);
      const { error } = await supabase.from("banners").delete().eq("id", banner.id);
      if (error) throw new Error(error.message);
      setSuccess("Banner deleted successfully! 🗑️");
      await fetchBanners();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Delete failed.");
    } finally {
      setDeleting(null);
    }
  };

  // ── Toggle active ─────────────────────────────────────────────────────────
  const toggleActive = async (banner: Banner) => {
    const { error } = await supabase
      .from("banners")
      .update({ is_active: !banner.is_active })
      .eq("id", banner.id);
    if (!error) {
      setSuccess(`Banner ${!banner.is_active ? "active" : "inactive"} ho gaya!`);
      await fetchBanners();
    }
  };

  // ── Edit modal ────────────────────────────────────────────────────────────
  const openEdit = (banner: Banner) => {
    setEditBanner(banner);
    setEditForm({
      title: banner.title,
      description: banner.description || "",
      link_url: banner.link_url || "",
      is_active: banner.is_active,
    });
  };

  const saveEdit = async () => {
    if (!editBanner) return;
    if (!editForm.title.trim()) { setError("Title is required."); return; }
    setEditSaving(true);
    const { error } = await supabase
      .from("banners")
      .update({
        title: editForm.title.trim(),
        description: editForm.description.trim() || null,
        link_url: editForm.link_url.trim() || null,
        is_active: editForm.is_active,
      })
      .eq("id", editBanner.id);
    if (error) setError(error.message);
    else {
      setSuccess("Banner updated successfully! ✅");
      setEditBanner(null);
      await fetchBanners();
    }
    setEditSaving(false);
  };

  // ── Build 4 fixed slots ────────────────────────────────────────────────────
  const slots = Array.from({ length: MAX_BANNERS }, (_, i) => ({
    index: i,
    banner: banners.find((b) => b.display_order === i) ?? null,
  }));

  const emptySlots = MAX_BANNERS - banners.length;

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen ">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className=" border-b border-gray-800 px-6 py-4 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold  tracking-tight text-gray-800">Banner Management</h1>
          <p className="text-sm   mt-0.5">
            <span className={banners.length >= MAX_BANNERS ? "text-amber-400" : "text-emerald-400"}>
              {banners.length}/{MAX_BANNERS}
            </span>{" "}
            slots used
          </p>
        </div>

        {/* Multiple upload button — only when slots are empty */}
        {emptySlots > 0 && (
          <>
            <input
              ref={bulkInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleBulkFileSelect}
              className="hidden"
            />
            <button
              onClick={() => bulkInputRef.current?.click()}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg font-medium transition-colors text-sm"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Multiple Upload ({emptySlots} slot{emptySlots > 1 ? "s" : ""} available)
            </button>
          </>
        )}
      </div>

      {/* ── Toasts ──────────────────────────────────────────────────────── */}
      {(success || error) && (
        <div className={`mx-6 mt-4 px-4 py-3 rounded-lg text-sm font-medium ${
          success
            ? "bg-emerald-900/60 border border-emerald-700 text-emerald-300"
            : "bg-red-900/60 border border-red-700 text-red-300"
        }`}>
          {success || error}
        </div>
      )}

      {/* ── 4 Fixed Slots ───────────────────────────────────────────────── */}
      <div className="p-6">
        {loading ? (
          <div className="flex items-center justify-center h-64 text-gray-500">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              <span>Loading...</span>
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
              {slots.map(({ index, banner }) => (
                <div
                  key={index}
                  className={`rounded-xl overflow-hidden border transition-all ${
                    banner
                      ? banner.is_active
                        ? "bg-blue-100 border-gray-700 hover:border-indigo-600"
                        : "bg-blue-100 border-gray-800 opacity-60"
                      : "bg-blue-100 border-gray-800 border-dashed"
                  }`}
                >
                  {/* Slot label */}
                  <div className="px-3 pt-3 flex items-center justify-between">
                    <span className="text-xs text-gray-500  ">SLOT {index + 1}</span>
                    {banner && (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        banner.is_active
                          ? "bg-emerald-500/20 text-emerald-500"
                          : "bg-gray-700 text-gray-500"
                      }`}>
                        {banner.is_active ? "Active" : "Inactive"}
                      </span>
                    )}
                  </div>

                  {/* Image area */}
                  <div className="relative mx-3 mt-2 rounded-lg overflow-hidden h-40 bg-gray-800">
                    {banner ? (
                      <>
                        <img
                          src={banner.image_url}
                          alt={banner.title}
                          className="w-full h-full object-cover"
                        />
                        {/* Hover to replace */}
                        <div
                          onClick={() => slotInputRefs.current[index]?.click()}
                          className="absolute inset-0 bg-black/55 flex flex-col items-center justify-center gap-1.5 opacity-0 hover:opacity-100 transition-opacity cursor-pointer"
                        >
                          <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                          </svg>
                          <span className="text-white text-xs font-medium">Replace Image</span>
                        </div>
                      </>
                    ) : (
                      // Empty slot
                      <div
                        onClick={() => slotInputRefs.current[index]?.click()}
                        className="w-full h-full flex flex-col items-center justify-center gap-2 text-gray-600 cursor-pointer hover:text-indigo-400 hover:bg-indigo-950/30 transition-all"
                      >
                        <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                        </svg>
                        <span className="text-sm">Click to add</span>
                      </div>
                    )}

                    {/* Per-slot upload overlay */}
                    {uploading[index] && (
                      <div className="absolute inset-0 bg-black/65 flex flex-col items-center justify-center gap-2">
                        <div className="w-8 h-8 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                        <span className="text-white text-xs font-medium">{uploadProgress[index] || 0}%</span>
                      </div>
                    )}
                  </div>

                  {/* Hidden file input per slot */}
                  <input
                    ref={(el) => { slotInputRefs.current[index] = el; }}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleSlotImageChange(e, index, banner)}
                  />

                  {/* Info & action row */}
                  <div className="p-3">
                    {banner ? (
                      <>
                        <p className="text-sm font-medium  truncate">{banner.title}</p>
                        {banner.link_url && (
                          <a
                            href={banner.link_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-indigo-400 truncate block mt-0.5 hover:text-indigo-300"
                          >
                            🔗 {banner.link_url}
                          </a>
                        )}
                        <div className="flex gap-1.5 mt-3">
                          {/* <button
                            onClick={() => toggleActive(banner)}
                            className={`flex-1 text-xs py-1.5 rounded-lg font-medium transition-colors ${
                              banner.is_active
                                ? "bg-gray-700 hover:bg-gray-600 text-gray-300"
                                : "bg-emerald-800 hover:bg-emerald-700 text-emerald-300"
                            }`}
                          >
                            {banner.is_active ? "Deactivate" : "Activate"}
                          </button> */}
                          <button
                            onClick={() => openEdit(banner)}
                            className="flex-1 text-xs py-1.5 rounded-lg font-medium bg-indigo-800 hover:bg-indigo-700 text-indigo-300 transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(banner)}
                            disabled={deleting === banner.id}
                            className="px-2.5 py-1.5 rounded-lg bg-red-100 hover:bg-red-700 text-red-700 hover:text-white text-xs transition-colors disabled:opacity-50 flex items-center"
                          >
                            {deleting === banner.id
                              ? <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                              : "Delete"}
                          </button>
                        </div>
                      </>
                    ) : (
                      <p className="text-xs text-gray-600 text-center py-1">Empty slot</p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Full limit warning */}
            {banners.length >= MAX_BANNERS && (
              <div className="mt-5 flex items-center gap-2 text-amber-600 text-sm bg-amber-900/20 border border-amber-800/50 rounded-lg px-4 py-3">
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                All 4 slots are filled. To add a new banner, first delete one slot, or hover over an existing slot’s image and replace it.
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Bulk Upload Preview Modal ────────────────────────────────────── */}
      {showBulkModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
              <h2 className="text-base font-bold text-white">
                {bulkFiles.length} Image(s) Upload
              </h2>
              <button
                onClick={() => { setShowBulkModal(false); setBulkFiles([]); setBulkPreviews([]); }}
                className="text-gray-400 hover:text-white text-2xl leading-none"
              >×</button>
            </div>
            <div className="p-5">
              <div className="grid grid-cols-2 gap-3 mb-4">
                {bulkPreviews.map((src, i) => (
                  <div key={i} className="relative rounded-lg overflow-hidden h-28 bg-gray-800">
                    <img src={src} alt={`preview-${i}`} className="w-full h-full object-cover" />
                    <span className="absolute top-1 left-1 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded">
                      Slot {banners.length + i + 1}
                    </span>
                  </div>
                ))}
              </div>

              {bulkUploading && (
                <div className="mb-4">
                  <div className="flex justify-between text-xs text-gray-400 mb-1.5">
                    <span>Uploading...</span>
                    <span>{bulkProgress}%</span>
                  </div>
                  <div className="bg-gray-800 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-indigo-500 h-full transition-all duration-300"
                      style={{ width: `${bulkProgress}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => { setShowBulkModal(false); setBulkFiles([]); setBulkPreviews([]); }}
                  disabled={bulkUploading}
                  className="flex-1 py-2.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium transition-colors text-sm disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleBulkUpload}
                  disabled={bulkUploading}
                  className="flex-1 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-medium transition-colors text-sm flex items-center justify-center gap-2"
                >
                  {bulkUploading ? (
                    <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Uploading...</>
                  ) : (
                    `Upload  (${bulkFiles.length})`
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Details Modal ───────────────────────────────────────────── */}
      {editBanner && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
              <h2 className="text-base font-bold text-white">Edit Banner Details</h2>
              <button
                onClick={() => setEditBanner(null)}
                className="text-gray-400 hover:text-white text-2xl leading-none"
              >×</button>
            </div>

            <div className="px-5 py-4 space-y-4">
              <div className="h-32 rounded-lg overflow-hidden bg-gray-800">
                <img src={editBanner.image_url} alt="current" className="w-full h-full object-cover" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Title *</label>
                <input
                  type="text"
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Description</label>
                <textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  rows={2}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500 resize-none"
                />
              </div>
              {/* <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Link URL</label>
                <input
                  type="url"
                  value={editForm.link_url}
                  onChange={(e) => setEditForm({ ...editForm, link_url: e.target.value })}
                  placeholder="https://example.com"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-indigo-500"
                />
              </div> */}
              {/* <label className="flex items-center gap-3 cursor-pointer select-none">
                <div
                  onClick={() => setEditForm({ ...editForm, is_active: !editForm.is_active })}
                  className={`relative w-10 h-5 rounded-full transition-colors ${
                    editForm.is_active ? "bg-indigo-600" : "bg-gray-700"
                  }`}
                >
                  <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                    editForm.is_active ? "translate-x-5" : ""
                  }`} />
                </div>
                <span className="text-sm text-gray-300">Active</span>
              </label> */}
            </div>

            <div className="px-5 pb-5 flex gap-3">
              <button
                onClick={() => setEditBanner(null)}
                className="flex-1 py-2.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium transition-colors text-sm"
              >
                Cancel
              </button>
              <button
                onClick={saveEdit}
                disabled={editSaving}
                className="flex-1 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-medium transition-colors text-sm flex items-center justify-center gap-2"
              >
                {editSaving
                  ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Saving...</>
                  : "Save"
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
