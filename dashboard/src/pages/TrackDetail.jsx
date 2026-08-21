import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import {
    ArrowLeft,
    Sparkles,
    RefreshCw,
    FileText,
    CheckCircle2,
    AlertCircle,
    Music,
    Clock,
    Tag,
    Layers,
    ArrowRight,
    Fingerprint,
    ExternalLink,
    Copy,
    Check,
    Image,
    Link2,
    Disc,
    Radio,
} from "lucide-react";
import {
    getTrackDetail,
    enrichTrack,
    embedArtworkUrl,
    fetchBeetsArtwork,
} from "../services/metadata";
import "../styles/metadata.css";

const TrackDetail = () => {
    const { id } = useParams();
    // ALL useState hooks declared unconditionally at top of component
    const [detail, setDetail] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [enriching, setEnriching] = useState(false);
    const [copied, setCopied] = useState(false);
    const [artworkUrl, setArtworkUrl] = useState("");
    const [updatingArt, setUpdatingArt] = useState(false);
    const [artMessage, setArtMessage] = useState("");

    const fetchDetail = async () => {
        setLoading(true);
        setError("");
        try {
            const data = await getTrackDetail(id);
            setDetail(data);
        } catch (err) {
            console.error("Failed to load track detail:", err);
            setError("Could not load track detail. Track may not exist.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDetail();
    }, [id]);

    const handleReEnrich = async () => {
        setEnriching(true);
        try {
            await enrichTrack(id);
            await fetchDetail();
        } catch (err) {
            console.error("Failed to enrich track:", err);
        } finally {
            setEnriching(false);
        }
    };

    const handleCopyFingerprint = () => {
        if (detail?.track?.fingerprint) {
            navigator.clipboard.writeText(detail.track.fingerprint);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const handleFetchBeetsArt = async () => {
        setUpdatingArt(true);
        setArtMessage("");
        try {
            const res = await fetchBeetsArtwork(id);
            setArtMessage(res.message);
            await fetchDetail();
        } catch (err) {
            console.error("Failed to fetch artwork via Beets/Spotify:", err);
            setArtMessage("Error fetching artwork from Beets/Spotify engine.");
        } finally {
            setUpdatingArt(false);
        }
    };

    const handleEmbedUrlArt = async () => {
        if (!artworkUrl.trim()) return;
        setUpdatingArt(true);
        setArtMessage("");
        try {
            const res = await embedArtworkUrl(id, artworkUrl.trim());
            setArtMessage(res.message);
            setArtworkUrl("");
            await fetchDetail();
        } catch (err) {
            console.error("Failed to embed artwork from URL:", err);
            setArtMessage("Error embedding artwork from specified URL.");
        } finally {
            setUpdatingArt(false);
        }
    };

    if (loading) {
        return (
            <div className="metadata-container" style={{ padding: "60px", textAlign: "center" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "12px", fontSize: "16px", color: "var(--text-secondary)" }}>
                    <RefreshCw size={22} className="spin" style={{ color: "#3b82f6" }} />
                    <span>Loading track details & metadata history...</span>
                </div>
            </div>
        );
    }

    if (error || !detail) {
        return (
            <div className="metadata-container">
                <Link to="/metadata" className="btn-back">
                    <ArrowLeft size={16} /> Back to Metadata
                </Link>
                <div className="metadata-table-card" style={{ padding: "40px", textAlign: "center" }}>
                    <AlertCircle size={36} style={{ color: "#ef4444", marginBottom: "12px" }} />
                    <p style={{ color: "var(--text-secondary)" }}>{error || "Track not found."}</p>
                </div>
            </div>
        );
    }

    const { track, lyrics_path, history } = detail;
    const latestHistory = history && history.length > 0 ? history[0] : null;
    const prevMeta = latestHistory?.previous_metadata || {};

    const getFilenameOnly = (fullPath) => {
        if (!fullPath) return "—";
        return fullPath.split("/").pop();
    };

    const currentFilename = getFilenameOnly(track.file_path);
    const prevFilename = getFilenameOnly(latestHistory?.previous_filename || track.file_path);
    const lyricsFilename = getFilenameOnly(lyrics_path || latestHistory?.new_lyrics_filename);
    const prevLyricsFilename = getFilenameOnly(latestHistory?.previous_lyrics_filename);

    return (
        <div className="metadata-container">
            {/* Top Navigation */}
            <div>
                <Link to="/metadata" className="btn-back">
                    <ArrowLeft size={16} /> Back to Metadata Management
                </Link>
            </div>

            {/* Hero Track Header */}
            <div className="track-detail-hero">
                <div className="track-detail-art-box">
                    {track.thumbnail_url ? (
                        <img src={track.thumbnail_url} alt={track.title || "Track Artwork"} />
                    ) : (
                        <Disc size={56} style={{ color: "var(--text-muted)", opacity: 0.5 }} />
                    )}
                </div>

                <div className="track-detail-header-info">
                    <h1>{track.title || `Track #${track.id}`}</h1>
                    <div className="meta-sub">
                        {track.artist || "Unknown Artist"} {track.album ? `• ${track.album}` : ""}
                    </div>

                    <div className="meta-tags-row">
                        <span className={`status-state-pill ${track.metadata_state}`}>
                            State: {track.metadata_state}
                        </span>

                        {track.beets_metadata_edited ? (
                            <span className="badge-beets">
                                <Sparkles size={13} /> Beets Enriched
                            </span>
                        ) : (
                            <span className="engine-pill">Raw YouTube Metadata</span>
                        )}

                        {track.release_year && (
                            <span className="engine-pill">Year: {track.release_year}</span>
                        )}

                        {latestHistory?.match_source && (
                            <span className="engine-pill">
                                Source: <strong>{latestHistory.match_source}</strong> ({latestHistory.match_confidence || "High"} Confidence)
                            </span>
                        )}
                    </div>
                </div>

                <div style={{ marginLeft: "auto" }}>
                    <button
                        type="button"
                        className="btn-scan"
                        onClick={handleReEnrich}
                        disabled={enriching}
                    >
                        <RefreshCw size={16} className={enriching ? "spin" : ""} />
                        {enriching ? "Enriching..." : "Re-Enrich Track"}
                    </button>
                </div>
            </div>

            {/* File & Path Metric Cards */}
            <div className="metadata-metrics-grid">
                <div className="metric-card" style={{ flexDirection: "column", alignItems: "flex-start", gap: "8px" }}>
                    <div style={{ fontSize: "12px", textTransform: "uppercase", fontWeight: "700", color: "var(--text-secondary)" }}>Current File</div>
                    <div style={{ fontSize: "14px", fontWeight: "700", color: "var(--text-primary)", wordBreak: "break-all" }}>
                        {currentFilename}
                    </div>
                </div>

                <div className="metric-card" style={{ flexDirection: "column", alignItems: "flex-start", gap: "8px" }}>
                    <div style={{ fontSize: "12px", textTransform: "uppercase", fontWeight: "700", color: "var(--text-secondary)" }}>Previous Filename</div>
                    <div style={{ fontSize: "14px", fontWeight: "600", color: "var(--text-secondary)", wordBreak: "break-all" }}>
                        {prevFilename}
                    </div>
                </div>

                <div className="metric-card" style={{ flexDirection: "column", alignItems: "flex-start", gap: "8px" }}>
                    <div style={{ fontSize: "12px", textTransform: "uppercase", fontWeight: "700", color: "var(--text-secondary)" }}>Lyrics File (.lrc)</div>
                    <div style={{ fontSize: "14px", fontWeight: "600", color: "var(--text-primary)", wordBreak: "break-all" }}>
                        {lyricsFilename !== "—" ? lyricsFilename : "No LRC file"}
                    </div>
                </div>
            </div>

            {/* Album Cover Art Management Card (Beets / Spotify / Custom URL) */}
            <div className="metadata-table-card" style={{ padding: "28px" }}>
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "16px", marginBottom: "20px" }}>
                    <h2 style={{ fontSize: "19px", fontWeight: "700", display: "flex", alignItems: "center", gap: "10px" }}>
                        <Image size={22} style={{ color: "#3b82f6" }} />
                        Cover Art & Album Artwork (Beets / Spotify)
                    </h2>
                    <span className={`status-state-pill ${track.artwork_embedded ? "enriched" : "raw"}`} style={{ fontSize: "12px", padding: "4px 12px" }}>
                        {track.artwork_embedded ? "Cover Art Embedded: YES" : "Cover Art Embedded: NO"}
                    </span>
                </div>

                {artMessage && (
                    <div style={{ padding: "12px 16px", borderRadius: "10px", marginBottom: "20px", fontSize: "13px", fontWeight: "600", background: artMessage.includes("Error") || artMessage.includes("Failed") ? "rgba(239, 68, 68, 0.12)" : "rgba(16, 185, 129, 0.12)", color: artMessage.includes("Error") || artMessage.includes("Failed") ? "#ef4444" : "#10b981", border: "1px solid currentColor" }}>
                        {artMessage}
                    </div>
                )}

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "24px", alignItems: "center" }}>
                    {/* Artwork Preview */}
                    <div style={{ display: "flex", alignItems: "center", gap: "18px" }}>
                        <div style={{ width: "115px", height: "115px", borderRadius: "14px", background: "var(--bg-sidebar)", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--border-color)", boxShadow: "0 8px 20px -4px rgba(0,0,0,0.15)" }}>
                            {track.thumbnail_url ? (
                                <img src={track.thumbnail_url} alt="Cover Art" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            ) : (
                                <Disc size={48} style={{ color: "var(--text-muted)", opacity: 0.5 }} />
                            )}
                        </div>
                        <div>
                            <div style={{ fontSize: "16px", fontWeight: "700", color: "var(--text-primary)" }}>
                                {track.album || track.title || "Track Cover Art"}
                            </div>
                            <div style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "3px" }}>
                                {track.artist || "Unknown Artist"}
                            </div>
                            <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "8px" }}>
                                {track.artwork_embedded ? "Embedded into audio file ID3/FLAC tags" : "No cover art embedded in file"}
                            </div>
                        </div>
                    </div>

                    {/* Action Controls */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                        <button
                            type="button"
                            className="btn-scan"
                            onClick={handleFetchBeetsArt}
                            disabled={updatingArt}
                            style={{ justifyContent: "center", width: "100%" }}
                        >
                            <Sparkles size={16} className={updatingArt ? "spin" : ""} />
                            {updatingArt ? "Fetching Cover Art..." : "Fetch & Embed via Beets / Spotify"}
                        </button>

                        <div style={{ display: "flex", gap: "10px" }}>
                            <input
                                type="url"
                                placeholder="Paste image URL (https://...)"
                                value={artworkUrl}
                                onChange={(e) => setArtworkUrl(e.target.value)}
                                style={{ flex: 1, padding: "10px 14px", borderRadius: "10px", border: "1px solid var(--border-color)", background: "var(--bg-card-subtle)", color: "var(--text-primary)", fontSize: "13px" }}
                            />
                            <button
                                type="button"
                                className="btn-scan"
                                onClick={handleEmbedUrlArt}
                                disabled={updatingArt || !artworkUrl.trim()}
                                style={{ whiteSpace: "nowrap" }}
                            >
                                <Link2 size={15} /> Embed URL
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Audio Fingerprint & Identifiers Card */}
            <div className="metadata-table-card" style={{ padding: "28px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
                    <h2 style={{ fontSize: "19px", fontWeight: "700", display: "flex", alignItems: "center", gap: "10px" }}>
                        <Fingerprint size={22} style={{ color: "#3b82f6" }} />
                        Audio Fingerprint & MusicBrainz Identifiers
                    </h2>
                    {track.acoustid_id && (
                        <a
                            href={`https://acoustid.org/track/${track.acoustid_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "13px", color: "#3b82f6", fontWeight: "600", textDecoration: "none" }}
                        >
                            View on AcoustID <ExternalLink size={14} />
                        </a>
                    )}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "18px", marginBottom: "20px" }}>
                    <div style={{ background: "var(--bg-card-subtle)", padding: "14px 18px", borderRadius: "12px", border: "1px solid var(--border-color)" }}>
                        <div style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: "700", textTransform: "uppercase", marginBottom: "6px" }}>AcoustID Track ID</div>
                        <div style={{ fontSize: "14px", fontWeight: "600", color: "var(--text-primary)", wordBreak: "break-all" }}>
                            {track.acoustid_id ? (
                                <a href={`https://acoustid.org/track/${track.acoustid_id}`} target="_blank" rel="noopener noreferrer" style={{ color: "#3b82f6" }}>
                                    {track.acoustid_id}
                                </a>
                            ) : "Not identified via AcoustID"}
                        </div>
                    </div>

                    <div style={{ background: "var(--bg-card-subtle)", padding: "14px 18px", borderRadius: "12px", border: "1px solid var(--border-color)" }}>
                        <div style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: "700", textTransform: "uppercase", marginBottom: "6px" }}>MusicBrainz Recording ID</div>
                        <div style={{ fontSize: "14px", fontWeight: "600", color: "var(--text-primary)", wordBreak: "break-all" }}>
                            {track.musicbrainz_recording_id ? (
                                <a href={`https://musicbrainz.org/recording/${track.musicbrainz_recording_id}`} target="_blank" rel="noopener noreferrer" style={{ color: "#3b82f6" }}>
                                    {track.musicbrainz_recording_id}
                                </a>
                            ) : "No MusicBrainz Recording ID"}
                        </div>
                    </div>

                    <div style={{ background: "var(--bg-card-subtle)", padding: "14px 18px", borderRadius: "12px", border: "1px solid var(--border-color)" }}>
                        <div style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: "700", textTransform: "uppercase", marginBottom: "6px" }}>Spotify Track ID</div>
                        <div style={{ fontSize: "14px", fontWeight: "600", color: "var(--text-primary)", wordBreak: "break-all" }}>
                            {track.spotify_track_id ? (
                                <a href={`https://open.spotify.com/track/${track.spotify_track_id}`} target="_blank" rel="noopener noreferrer" style={{ color: "#1db954" }}>
                                    {track.spotify_track_id}
                                </a>
                            ) : "No Spotify Track ID"}
                        </div>
                    </div>
                </div>

                {/* Fingerprint Hash Code Block */}
                <div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                        <span style={{ fontSize: "12px", color: "var(--text-secondary)", fontWeight: "700", textTransform: "uppercase" }}>Chromaprint Fingerprint Hash</span>
                        {track.fingerprint && (
                            <button
                                type="button"
                                onClick={handleCopyFingerprint}
                                style={{ background: "none", border: "none", color: "#3b82f6", cursor: "pointer", fontSize: "13px", display: "inline-flex", alignItems: "center", gap: "6px", fontWeight: "600" }}
                            >
                                {copied ? <Check size={15} color="#10b981" /> : <Copy size={15} />}
                                {copied ? "Copied!" : "Copy Fingerprint"}
                            </button>
                        )}
                    </div>
                    <div style={{ background: "var(--bg-sidebar)", padding: "14px", borderRadius: "10px", fontFamily: "monospace", fontSize: "12px", color: "var(--text-secondary)", wordBreak: "break-all", maxHeight: "110px", overflowY: "auto", border: "1px solid var(--border-color)" }}>
                        {track.fingerprint || "No audio fingerprint generated for this track."}
                    </div>
                </div>
            </div>

            {/* Metadata Comparison Side-by-Side Table */}
            <div className="metadata-table-card">
                <div className="metadata-table-header">
                    <h2>Metadata Comparison (Previous vs Corrected)</h2>
                </div>

                <div style={{ overflowX: "auto" }}>
                    <table className="metadata-table">
                        <thead>
                            <tr>
                                <th style={{ width: "20%" }}>Field</th>
                                <th style={{ width: "40%" }}>Previous Metadata (YouTube)</th>
                                <th style={{ width: "40%" }}>Beets / Corrected Metadata</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td><strong>Artist</strong></td>
                                <td style={{ color: prevMeta.artist !== track.artist ? "#ef4444" : "inherit" }}>
                                    {prevMeta.artist || "—"}
                                </td>
                                <td style={{ fontWeight: 700, color: "#10b981" }}>
                                    {track.artist || "—"}
                                </td>
                            </tr>
                            <tr>
                                <td><strong>Title</strong></td>
                                <td style={{ color: prevMeta.title !== track.title ? "#ef4444" : "inherit" }}>
                                    {prevMeta.title || "—"}
                                </td>
                                <td style={{ fontWeight: 700, color: "#10b981" }}>
                                    {track.title || "—"}
                                </td>
                            </tr>
                            <tr>
                                <td><strong>Album</strong></td>
                                <td>{prevMeta.album || "—"}</td>
                                <td style={{ fontWeight: 600 }}>{track.album || "—"}</td>
                            </tr>
                            <tr>
                                <td><strong>Album Artist</strong></td>
                                <td>{prevMeta.album_artist || "—"}</td>
                                <td style={{ fontWeight: 600 }}>{track.album_artist || "—"}</td>
                            </tr>
                            <tr>
                                <td><strong>Genre</strong></td>
                                <td>{prevMeta.genre || "—"}</td>
                                <td>{track.genre || "—"}</td>
                            </tr>
                            <tr>
                                <td><strong>Release Year</strong></td>
                                <td>{prevMeta.release_year || "—"}</td>
                                <td>{track.release_year || "—"}</td>
                            </tr>
                            <tr>
                                <td><strong>Album Cover Art</strong></td>
                                <td>
                                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                                        <div style={{ width: "64px", height: "64px", borderRadius: "10px", background: "var(--bg-sidebar)", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--border-color)" }}>
                                            {prevMeta.thumbnail_url || track.thumbnail_url ? (
                                                <img src={prevMeta.thumbnail_url || track.thumbnail_url} alt="Previous Art" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                            ) : (
                                                <Disc size={24} style={{ opacity: 0.4 }} />
                                            )}
                                        </div>
                                        <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                                            <div style={{ fontWeight: "600" }}>Original YouTube Artwork</div>
                                            <div style={{ color: "var(--text-muted)", fontSize: "11px" }}>
                                                {prevMeta.artwork_embedded ? "Embedded: YES" : "Embedded: NO"}
                                            </div>
                                        </div>
                                    </div>
                                </td>
                                <td>
                                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                                        <div style={{ width: "64px", height: "64px", borderRadius: "10px", background: "var(--bg-sidebar)", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--border-color)", boxShadow: "0 2px 10px rgba(0,0,0,0.15)" }}>
                                            {track.thumbnail_url ? (
                                                <img src={track.thumbnail_url} alt="Enriched Art" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                            ) : (
                                                <Disc size={24} style={{ opacity: 0.4 }} />
                                            )}
                                        </div>
                                        <div style={{ fontSize: "12px" }}>
                                            <div style={{ fontWeight: "700", color: "#10b981" }}>Enriched Beets/Spotify Cover Art</div>
                                            <span className={`status-state-pill ${track.artwork_embedded ? "enriched" : "raw"}`} style={{ fontSize: "11px", padding: "2px 8px", marginTop: "4px", display: "inline-block" }}>
                                                {track.artwork_embedded ? "Embedded in File: YES" : "Embedded in File: NO"}
                                            </span>
                                        </div>
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Changes Made Audit Box */}
            {latestHistory && (
                <div className="metadata-table-card" style={{ padding: "28px" }}>
                    <h2 style={{ fontSize: "19px", fontWeight: "700", marginBottom: "18px" }}>Changes Made</h2>
                    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                        {prevMeta.artist && prevMeta.artist !== track.artist && (
                            <div style={{ display: "flex", alignItems: "center", gap: "12px", fontSize: "14px" }}>
                                <span style={{ fontWeight: "700", width: "140px" }}>Artist:</span>
                                <span style={{ color: "#ef4444", textDecoration: "line-through" }}>{prevMeta.artist}</span>
                                <ArrowRight size={16} />
                                <span style={{ color: "#10b981", fontWeight: "700" }}>{track.artist}</span>
                            </div>
                        )}

                        {prevMeta.thumbnail_url && prevMeta.thumbnail_url !== track.thumbnail_url && (
                            <div style={{ display: "flex", alignItems: "center", gap: "12px", fontSize: "14px" }}>
                                <span style={{ fontWeight: "700", width: "140px" }}>Cover Art:</span>
                                <span style={{ color: "#ef4444" }}>YouTube Video Thumbnail</span>
                                <ArrowRight size={16} />
                                <span style={{ color: "#10b981", fontWeight: "700" }}>Beets/Spotify Album Cover (Auto-Replaced & Embedded)</span>
                            </div>
                        )}

                        {prevFilename !== currentFilename && (
                            <div style={{ display: "flex", alignItems: "center", gap: "12px", fontSize: "14px" }}>
                                <span style={{ fontWeight: "700", width: "140px" }}>Audio Filename:</span>
                                <span style={{ color: "#ef4444", wordBreak: "break-all" }}>{prevFilename}</span>
                                <ArrowRight size={16} />
                                <span style={{ color: "#10b981", fontWeight: "700", wordBreak: "break-all" }}>{currentFilename}</span>
                            </div>
                        )}

                        {prevLyricsFilename && lyricsFilename && prevLyricsFilename !== lyricsFilename && (
                            <div style={{ display: "flex", alignItems: "center", gap: "12px", fontSize: "14px" }}>
                                <span style={{ fontWeight: "700", width: "140px" }}>Lyrics Filename:</span>
                                <span style={{ color: "#ef4444", wordBreak: "break-all" }}>{prevLyricsFilename}</span>
                                <ArrowRight size={16} />
                                <span style={{ color: "#10b981", fontWeight: "700", wordBreak: "break-all" }}>{lyricsFilename}</span>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* History Audit Log */}
            <div className="metadata-table-card" style={{ padding: "28px" }}>
                <h2 style={{ fontSize: "19px", fontWeight: "700", marginBottom: "20px" }}>Metadata Change Audit Log</h2>
                {history.length === 0 ? (
                    <p style={{ color: "var(--text-secondary)" }}>No history recorded yet for this track.</p>
                ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                        {history.map((h, idx) => (
                            <div key={h.id || idx} style={{ borderLeft: "3px solid #3b82f6", paddingLeft: "18px", paddingY: "6px" }}>
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
                                    <strong style={{ fontSize: "15px", textTransform: "capitalize" }}>
                                        {h.action.replace(/_/g, " ")}
                                    </strong>
                                    <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                                        {new Date(h.created_at).toLocaleString()}
                                    </span>
                                </div>
                                <div style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "6px" }}>
                                    Status: <span className={`status-state-pill ${h.status}`} style={{ fontSize: "11px", padding: "2px 8px" }}>{h.status}</span>
                                    {h.match_source && ` • Source: ${h.match_source}`}
                                </div>
                                {h.error_message && (
                                    <div style={{ fontSize: "13px", color: "#ef4444", marginTop: "6px" }}>
                                        Error: {h.error_message}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default TrackDetail;
