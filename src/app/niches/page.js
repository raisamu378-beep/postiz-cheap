"use client";

import { Suspense, useState, useEffect, useMemo, useRef } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { FaYoutube, FaFacebook, FaInstagram } from "react-icons/fa";
import { SiTiktok } from "react-icons/si";
import {
  FiPlus,
  FiTrash2,
  FiUploadCloud,
  FiLink,
  FiCheck,
  FiAlertTriangle,
  FiX,
  FiEdit2,
  FiClock,
} from "react-icons/fi";

const PLATFORMS = [
  { key: "youtube", name: "YouTube", Icon: FaYoutube, color: "text-red-500" },
  { key: "facebook", name: "Facebook", Icon: FaFacebook, color: "text-blue-500" },
  { key: "instagram", name: "Instagram", Icon: FaInstagram, color: "text-pink-500" },
  { key: "tiktok", name: "TikTok", Icon: SiTiktok, color: "text-primary-text" },
];

const STATUS_STYLES = {
  scheduled: "bg-primary/10 text-primary border-primary/30",
  processing: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  completed: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  failed: "bg-red-500/10 text-red-400 border-red-500/30",
};

function platformMeta(key) {
  return PLATFORMS.find((p) => p.key === key) || PLATFORMS[0];
}

function toLocalInput(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function NichesInner() {
  const { status } = useSession();
  const searchParams = useSearchParams();

  const [niches, setNiches] = useState([]);
  const [socialAccounts, setSocialAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [newNiche, setNewNiche] = useState({ name: "", emoji: "📁" });

  const [attachTarget, setAttachTarget] = useState(null); // { niche, platform }

  const [selectedNicheId, setSelectedNicheId] = useState("");
  const [file, setFile] = useState(null);
  const [mediaUrl, setMediaUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    tags: "",
    scheduledAt: toLocalInput(new Date(Date.now() + 60 * 60 * 1000)),
  });
  const [selectedPlatforms, setSelectedPlatforms] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [batch, setBatch] = useState(null);
  const fileInput = useRef(null);

  const loadNiches = async () => {
    const res = await fetch("/api/niches", { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      setNiches(Array.isArray(data) ? data : []);
    }
  };

  const loadSocialAccounts = async () => {
    const res = await fetch("/api/social/accounts", { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      setSocialAccounts(Array.isArray(data) ? data : []);
    }
  };

  useEffect(() => {
    if (status !== "authenticated") return;
    (async () => {
      setLoading(true);
      try {
        await Promise.all([loadNiches(), loadSocialAccounts()]);
      } catch (e) {
        setError(e.message || "Failed to load niches");
      } finally {
        setLoading(false);
      }
    })();
  }, [status]);

  // After returning from a MuAPI OAuth connect flow
  useEffect(() => {
    const connected = searchParams.get("connected");
    const nicheId = searchParams.get("niche");
    if (!connected || !nicheId || !niches.length) return;
    const niche = niches.find((n) => n.id === nicheId);
    if (niche) setAttachTarget({ niche, platform: connected });
  }, [searchParams, niches]);

  const selectedNiche = useMemo(
    () => niches.find((n) => n.id === selectedNicheId) || null,
    [niches, selectedNicheId]
  );

  useEffect(() => {
    if (!selectedNiche) {
      setSelectedPlatforms([]);
      return;
    }
    setSelectedPlatforms(selectedNiche.accounts.map((a) => a.platform));
  }, [selectedNicheId]); // eslint-disable-line react-hooks/exhaustive-deps

  const createNiche = async () => {
    if (!newNiche.name.trim()) return;
    setError("");
    const res = await fetch("/api/niches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newNiche),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Could not create niche");
      return;
    }
    setShowCreate(false);
    setNewNiche({ name: "", emoji: "📁" });
    await loadNiches();
    setNotice(`Niche "${data.name}" created`);
  };

  const deleteNiche = async (niche) => {
    if (!confirm(`Delete niche "${niche.name}"? Its ${niche.accounts.length} connected account(s) will be detached.`)) return;
    const res = await fetch(`/api/niches/${niche.id}`, { method: "DELETE" });
    if (res.ok) {
      if (selectedNicheId === niche.id) setSelectedNicheId("");
      await loadNiches();
    }
  };

  const startConnect = async (niche, platform) => {
    setError("");
    const res = await fetch("/api/social/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        platform,
        accountName: `${niche.name} ${platform}`,
        redirectUrl: `${window.location.origin}/niches?connected=${platform}&niche=${niche.id}`,
      }),
    });
    const data = await res.json();
    if (data.url) {
      window.location.href = data.url;
    } else {
      setError(data.error || `Could not start ${platform} connection`);
    }
  };

  const availableAccounts = (platform) =>
    socialAccounts.filter((a) => String(a.platform_name || "").toLowerCase() === platform);

  const attachAccount = async (niche, platform, account) => {
    const res = await fetch(`/api/niches/${niche.id}/accounts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        platform,
        accountId: account.id,
        accountName: account.account_name,
      }),
    });
    if (res.ok) {
      setAttachTarget(null);
      await loadNiches();
      setNotice(`${platform} account linked to ${niche.name}`);
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Could not attach account");
    }
  };

  const detachAccount = async (niche, platform) => {
    const res = await fetch(`/api/niches/${niche.id}/accounts?platform=${platform}`, { method: "DELETE" });
    if (res.ok) {
      await loadNiches();
    }
  };

  const handleFile = async (picked) => {
    if (!picked) return;
    setFile(picked);
    setMediaUrl("");
    setUploading(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", picked);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setMediaUrl(data.url);
      if (!form.title) setForm((f) => ({ ...f, title: picked.name.replace(/\.[^.]+$/, "") }));
    } catch (e) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  };

  const schedule = async () => {
    if (!selectedNiche || !mediaUrl || selectedPlatforms.length === 0) {
      setError("Niche, video ra at least one platform chahincha.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nicheId: selectedNiche.id,
          platforms: selectedPlatforms,
          mediaUrl,
          title: form.title,
          description: form.description,
          tags: form.tags,
          scheduledAt: new Date(form.scheduledAt).toISOString(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not schedule");
      setBatch({ id: data.batchId, posts: data.posts || [] });
      setNotice(`${(data.posts || []).length} post(s) scheduled for ${selectedNiche.name}`);
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="p-8 flex items-center gap-3 text-secondary-text">
        <span className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        Loading niches…
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-8 text-primary-text">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black uppercase tracking-tight">Niches</h1>
          <p className="text-xs text-secondary-text mt-1">
            Euta niche = 4 platform (YouTube, Facebook, Instagram, TikTok). Euta video → niche chhannus → sabai platform ma schedule.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-white text-xs font-bold hover:opacity-90 transition"
        >
          <FiPlus /> New Niche
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 text-xs bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg px-4 py-3">
          <FiAlertTriangle className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {notice && (
        <div className="flex items-start gap-2 text-xs bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-lg px-4 py-3">
          <FiCheck className="mt-0.5 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {/* Niche grid */}
      {niches.length === 0 ? (
        <div className="bg-bg-card border border-divider rounded-xl p-10 text-center space-y-3">
          <div className="text-3xl">📁</div>
          <h2 className="text-sm font-bold">No niches yet</h2>
          <p className="text-xs text-secondary-text max-w-md mx-auto">
            Pahilo niche banaunus (jastai “Survival Stories”), ani tyo niche ma YouTube / Facebook / Instagram / TikTok account jodnus.
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-white text-xs font-bold"
          >
            <FiPlus /> Create first niche
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {niches.map((niche) => {
            const linked = niche.accounts || [];
            const complete = linked.length >= 4;
            return (
              <div key={niche.id} className="bg-bg-card border border-divider rounded-xl p-5 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-lg">{niche.emoji || "📁"}</span>
                    <h3 className="text-sm font-bold truncate">{niche.name}</h3>
                  </div>
                  <button
                    onClick={() => deleteNiche(niche)}
                    className="text-secondary-text hover:text-red-400 transition"
                    title="Delete niche"
                  >
                    <FiTrash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center gap-3">
                  {PLATFORMS.map(({ key, Icon, color }) => {
                    const acc = linked.find((a) => a.platform === key);
                    return (
                      <div key={key} className="relative">
                        <button
                          onClick={() => (acc ? detachAccount(niche, key) : setAttachTarget({ niche, platform: key }))}
                          title={acc ? `${acc.accountName} — click to detach` : `Connect ${key}`}
                          className={`w-8 h-8 rounded-lg border flex items-center justify-center transition ${
                            acc
                              ? "border-emerald-500/40 bg-emerald-500/10"
                              : "border-divider bg-bg-page hover:border-primary/50"
                          }`}
                        >
                          <Icon className={`w-4 h-4 ${acc ? color : "text-secondary-text opacity-60"}`} />
                        </button>
                        {acc && (
                          <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-500 border-2 border-bg-card" />
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between text-[11px]">
                  <span className={complete ? "text-secondary-text" : "text-amber-400"}>
                    {linked.length} connected account{linked.length === 1 ? "" : "s"}
                    {!complete && " · " + (4 - linked.length) + " baki"}
                  </span>
                  <button
                    onClick={() => setSelectedNicheId(niche.id)}
                    className="text-primary font-bold hover:underline"
                  >
                    Select →
                  </button>
                </div>

                {linked.length > 0 && (
                  <div className="pt-3 border-t border-divider space-y-1.5">
                    {linked.map((a) => {
                      const meta = platformMeta(a.platform);
                      return (
                        <div key={a.platform} className="flex items-center gap-2 text-[11px] text-secondary-text">
                          <meta.Icon className={`w-3 h-3 ${meta.color}`} />
                          <span className="truncate">{a.accountName}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Upload + schedule */}
      <section className="bg-bg-card border border-divider rounded-xl p-6 space-y-5">
        <div>
          <h2 className="text-sm font-black uppercase tracking-tight">Upload Video</h2>
          <p className="text-[11px] text-secondary-text mt-1">Choose Niche → Select platforms → Schedule</p>
        </div>

        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            handleFile(e.dataTransfer.files?.[0]);
          }}
          onClick={() => fileInput.current?.click()}
          className="border border-dashed border-divider rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 transition"
        >
          <input
            ref={fileInput}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
          <FiUploadCloud className="w-6 h-6 mx-auto text-secondary-text" />
          <p className="text-sm font-bold mt-2">{uploading ? "Uploading…" : file ? file.name : "Select video.mp4"}</p>
          <p className="text-[11px] text-secondary-text mt-1">
            {mediaUrl ? "Uploaded ✓ ready to schedule" : "MP4 / MOV · drag & drop or click"}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wide text-secondary-text">Niche</label>
            <select
              value={selectedNicheId}
              onChange={(e) => setSelectedNicheId(e.target.value)}
              className="w-full bg-bg-page border border-divider rounded-lg px-3 py-2.5 text-xs outline-none focus:border-primary"
            >
              <option value="">— Choose niche —</option>
              {niches.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.emoji || "📁"} {n.name} ({(n.accounts || []).length}/4)
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wide text-secondary-text">Schedule at</label>
            <input
              type="datetime-local"
              value={form.scheduledAt}
              onChange={(e) => setForm((f) => ({ ...f, scheduledAt: e.target.value }))}
              className="w-full bg-bg-page border border-divider rounded-lg px-3 py-2.5 text-xs outline-none focus:border-primary"
            />
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <label className="text-[11px] font-bold uppercase tracking-wide text-secondary-text">Title</label>
            <input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Video title / caption"
              className="w-full bg-bg-page border border-divider rounded-lg px-3 py-2.5 text-xs outline-none focus:border-primary"
            />
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <label className="text-[11px] font-bold uppercase tracking-wide text-secondary-text">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={2}
              placeholder="Description / hashtags (optional)"
              className="w-full bg-bg-page border border-divider rounded-lg px-3 py-2.5 text-xs outline-none focus:border-primary resize-none"
            />
          </div>
        </div>

        {selectedNiche && (
          <div className="flex flex-wrap items-center gap-2">
            {PLATFORMS.map(({ key, name, Icon, color }) => {
              const linked = selectedNiche.accounts.find((a) => a.platform === key);
              const checked = selectedPlatforms.includes(key);
              return (
                <button
                  key={key}
                  onClick={() =>
                    setSelectedPlatforms((prev) =>
                      prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key]
                    )
                  }
                  className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-[11px] font-bold transition ${
                    checked ? "border-primary/50 bg-primary/10" : "border-divider bg-bg-page opacity-70"
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${color}`} />
                  {name}
                  {linked ? <FiCheck className="w-3 h-3 text-emerald-400" /> : <span className="text-amber-400">!</span>}
                </button>
              );
            })}
          </div>
        )}

        <button
          onClick={schedule}
          disabled={submitting || !selectedNiche || !mediaUrl || selectedPlatforms.length === 0}
          className="w-full md:w-auto px-6 py-3 rounded-lg bg-primary text-white text-xs font-bold disabled:opacity-40 transition"
        >
          {submitting ? "Scheduling…" : `Schedule to ${selectedPlatforms.length || 0} platform(s)`}
        </button>
      </section>

      {/* Publishing status */}
      {batch && (
        <section className="bg-bg-card border border-divider rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black uppercase tracking-tight">Publishing status</h2>
            <span className="text-[11px] font-bold text-emerald-400">{batch.posts.length} Platforms</span>
          </div>
          <div className="divide-y divide-divider">
            {batch.posts.map((p) => {
              const meta = platformMeta(p.platform);
              return (
                <div key={p.id} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <meta.Icon className={`w-4 h-4 ${meta.color}`} />
                    <div className="min-w-0">
                      <p className="text-xs font-bold truncate">{meta.name}</p>
                      <p className="text-[10px] text-secondary-text truncate">{p.accountName}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-secondary-text flex items-center gap-1">
                      <FiClock className="w-3 h-3" />
                      {new Date(p.scheduledAt).toLocaleString()}
                    </span>
                    <span
                      className={`px-2.5 py-1 rounded-full border text-[10px] font-bold capitalize ${
                        STATUS_STYLES[p.status] || STATUS_STYLES.scheduled
                      }`}
                    >
                      {p.status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Create niche modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-bg-card border border-divider rounded-xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black uppercase tracking-tight">New Niche</h3>
              <button onClick={() => setShowCreate(false)} className="text-secondary-text hover:text-primary-text">
                <FiX />
              </button>
            </div>
            <div className="flex gap-2">
              <input
                value={newNiche.emoji}
                onChange={(e) => setNewNiche((n) => ({ ...n, emoji: e.target.value }))}
                className="w-14 bg-bg-page border border-divider rounded-lg px-3 py-2.5 text-center text-xs outline-none focus:border-primary"
                maxLength={4}
              />
              <input
                autoFocus
                value={newNiche.name}
                onChange={(e) => setNewNiche((n) => ({ ...n, name: e.target.value }))}
                placeholder="e.g. Survival Stories"
                className="flex-1 bg-bg-page border border-divider rounded-lg px-3 py-2.5 text-xs outline-none focus:border-primary"
              />
            </div>
            <p className="text-[10px] text-secondary-text">
              Niche banae pachi card ma 4 wata platform icon ma click garera account jodnus.
            </p>
            <button
              onClick={createNiche}
              className="w-full py-2.5 rounded-lg bg-primary text-white text-xs font-bold"
            >
              Create niche
            </button>
          </div>
        </div>
      )}

      {/* Attach account modal */}
      {attachTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-bg-card border border-divider rounded-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black uppercase tracking-tight">
                {attachTarget.niche.name} · {attachTarget.platform}
              </h3>
              <button onClick={() => setAttachTarget(null)} className="text-secondary-text hover:text-primary-text">
                <FiX />
              </button>
            </div>

            {availableAccounts(attachTarget.platform).length === 0 ? (
              <div className="space-y-3">
                <p className="text-xs text-secondary-text">
                  Yo platform ma kunai account connected chhaina. Pahila connect garnus — MuAPI OAuth kholinchha.
                </p>
                <button
                  onClick={() => startConnect(attachTarget.niche, attachTarget.platform)}
                  className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-lg bg-primary text-white text-xs font-bold"
                >
                  <FiLink /> Connect {attachTarget.platform}
                </button>
              </div>
            ) : (
              <div className="space-y-2 max-h-72 overflow-auto">
                <p className="text-[11px] text-secondary-text">Kun account yo niche ma use garne?</p>
                {availableAccounts(attachTarget.platform).map((acc) => (
                  <button
                    key={acc.id}
                    onClick={() => attachAccount(attachTarget.niche, attachTarget.platform, acc)}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg border border-divider hover:border-primary/50 text-left transition"
                  >
                    <span className="text-xs font-bold truncate">{acc.account_name}</span>
                    <span className="text-[10px] text-secondary-text">#{acc.id}</span>
                  </button>
                ))}
                <button
                  onClick={() => startConnect(attachTarget.niche, attachTarget.platform)}
                  className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-lg border border-divider text-xs font-bold hover:border-primary/50"
                >
                  <FiPlus /> Connect another account
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function NichesPage() {
  return (
    <Suspense fallback={<div className="p-8 text-xs text-secondary-text">Loading niches…</div>}>
      <NichesInner />
    </Suspense>
  );
}