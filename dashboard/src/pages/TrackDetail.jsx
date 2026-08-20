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
            <div className="metadata-container" style={{ padding: "40px", textAlign: "center" }}>
                Loading track detail...
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
                    <AlertCircle size={36} color="var(--danger-soft)" style={{ marginBottom: "12px" }} />
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
            <div>
                <Link to="/metadata" className="btn-back" style={{ display: "inline-flex", alignItems: "center", gap: "6px", marginBottom: "16px", color: "var(--text-secondary)", textDecoration: "none", fontSize: "14px", fontWeight: "600" }}>
                    <ArrowLeft size={16} /> Back to Metadata Management
                </Link>

                <div className="metadata-header">
                    <div>
                        <h1>
                            <Music size={28} className="text-primary" />
                            {track.title || `Track #${track.id}`}
                        </h1>
                        <p className="subtitle">
                            Track #{track.id} • YouTube Video ID: {track.youtube_video_id}
                        </p>
                    </div>

                    <div className="metadata-actions">
                        <button
                            className="btn-scan"
                            onClick={handleReEnrich}
                            disabled={enriching}
                        >
                            <RefreshCw size={16} className={enriching ? "spin" : ""} />
                            {enriching ? "Enriching..." : "Re-Enrich Track"}
                        </button>
                    </div>
                </div>
            </div>

            {/* Status Summary Banner */}
            <div className="metadata-table-card" style={{ padding: "20px 24px" }}>
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <span className={`status-state-pill ${track.metadata_state}`} style={{ fontSize: "13px", padding: "6px 14px" }}>
                            State: {track.metadata_state}
                        </span>

                        {track.beets_metadata_edited ? (
                            <span className="badge-beets" style={{ fontSize: "13px", padding: "6px 14px" }}>
                                <Sparkles size={14} /> Metadata edited by Beets: YES
                            </span>
                        ) : (
                            <span style={{ fontSize: "13px", color: "var(--text-muted)", fontWeight: "600" }}>
                                Metadata edited by Beets: NO
                            </span>
                        )}
                    </div>

                    {latestHistory?.match_source && (
                        <div style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
                            Source: <strong>{latestHistory.match_source}</strong> ({latestHistory.match_confidence || "High"} Confidence)
                        </div>
                    )}
                </div>
            </div>

            {/* File & Lyrics Names */}
            <div className="metadata-metrics-grid">
                <div className="metric-card" style={{ flexDirection: "column", alignItems: "flex-start", gap: "8px" }}>
                    <div style={{ fontSize: "12px", textTransform: "uppercase", fontWeight: "700", color: "var(--text-secondary)" }}>Current File</div>
                    <div style={{ fontSize: "15px", fontWeight: "700", color: "var(--text-primary)", wordBreak: "break-all" }}>
                        {currentFilename}
                    </div>
                </div>

                <div className="metric-card" style={{ flexDirection: "column", alignItems: "flex-start", gap: "8px" }}>
                    <div style={{ fontSize: "12px", textTransform: "uppercase", fontWeight: "700", color: "var(--text-secondary)" }}>Previous Filename</div>
                    <div style={{ fontSize: "15px", fontWeight: "600", color: "var(--text-secondary)", wordBreak: "break-all" }}>
                        {prevFilename}
                    </div>
                </div>

                <div className="metric-card" style={{ flexDirection: "column", alignItems: "flex-start", gap: "8px" }}>
                    <div style={{ fontSize: "12px", textTransform: "uppercase", fontWeight: "700", color: "var(--text-secondary)" }}>Lyrics File (.lrc)</div>
                    <div style={{ fontSize: "15px", fontWeight: "600", color: "var(--text-primary)", wordBreak: "break-all" }}>
                        {lyricsFilename !== "—" ? lyricsFilename : "No LRC file"}
                    </div>
                </div>
            </div>

            {/* Album Cover Art Management Card (Beets / Spotify / Custom URL) */}
            <div className="metadata-table-card" style={{ padding: "24px" }}>
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "16px", marginBottom: "16px" }}>
                    <h2 style={{ fontSize: "18px", fontWeight: "700", display: "flex", alignItems: "center", gap: "8px" }}>
                        <Image size={20} className="text-primary" />
                        Cover Art & Album Artwork (Beets / Spotify)
                    </h2>
                    <span className={`status-state-pill ${track.artwork_embedded ? "enriched" : "raw"}`} style={{ fontSize: "12px", padding: "4px 12px" }}>
                        {track.artwork_embedded ? "Cover Art Embedded: YES" : "Cover Art Embedded: NO"}
                    </span>
                </div>

                {artMessage && (
                    <div style={{ padding: "10px 14px", borderRadius: "6px", marginBottom: "16px", fontSize: "13px", fontWeight: "600", background: artMessage.includes("Error") || artMessage.includes("Failed") ? "#fef2f2" : "#f0fdf4", color: artMessage.includes("Error") || artMessage.includes("Failed") ? "#b91c1c" : "#15803d", border: "1px solid currentColor" }}>
                        {artMessage}
                    </div>
                )}

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "20px", alignItems: "center" }}>
                    {/* Artwork Preview */}
                    <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                        <div style={{ width: "110px", height: "110px", borderRadius: "10px", background: "var(--bg-sidebar)", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--border-color)", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}>
                            {track.thumbnail_url ? (
                                <img src={track.thumbnail_url} alt="Cover Art" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            ) : (
                                <Disc size={44} style={{ color: "var(--text-muted)", opacity: 0.5 }} />
                            )}
                        </div>
                        <div>
                            <div style={{ fontSize: "15px", fontWeight: "700", color: "var(--text-primary)" }}>
                                {track.album || track.title || "Track Cover Art"}
                            </div>
                            <div style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "2px" }}>
                                {track.artist || "Unknown Artist"}
                            </div>
                            <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "6px" }}>
                                {track.artwork_embedded ? "Embedded into audio file tags" : "No cover art embedded"}
                            </div>
                        </div>
                    </div>

                    {/* Action Controls */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                        <button
                            className="btn-scan"
                            onClick={handleFetchBeetsArt}
                            disabled={updatingArt}
                            style={{ justifyContent: "center", width: "100%" }}
                        >
                            <Sparkles size={16} className={updatingArt ? "spin" : ""} />
                            {updatingArt ? "Fetching Cover Art..." : "Fetch & Embed via Beets / Spotify"}
                        </button>

                        <div style={{ display: "flex", gap: "8px" }}>
                            <input
                                type="url"
                                placeholder="Paste image URL (https://...)"
                                value={artworkUrl}
                                onChange={(e) => setArtworkUrl(e.target.value)}
                                style={{ flex: 1, padding: "8px 12px", borderRadius: "6px", border: "1px solid var(--border-color)", background: "var(--bg-card-subtle)", color: "var(--text-primary)", fontSize: "13px" }}
                            />
                            <button
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
            <div className="metadata-table-card" style={{ padding: "24px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
                    <h2 style={{ fontSize: "18px", fontWeight: "700", display: "flex", alignItems: "center", gap: "8px" }}>
                        <Fingerprint size={20} className="text-primary" />
                        Audio Fingerprint & Identification
                    </h2>
                    {track.acoustid_id && (
                        <a
                            href={`https://acoustid.org/track/${track.acoustid_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "13px", color: "var(--primary-blue)", fontWeight: "600", textDecoration: "none" }}
                        >
                            View on AcoustID <ExternalLink size={14} />
                        </a>
                    )}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "16px", marginBottom: "16px" }}>
                    <div style={{ background: "var(--bg-card-subtle)", padding: "12px 16px", borderRadius: "8px", border: "1px solid var(--border-color)" }}>
                        <div style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: "700", textTransform: "uppercase", marginBottom: "4px" }}>AcoustID Track ID</div>
                        <div style={{ fontSize: "14px", fontWeight: "600", color: "var(--text-primary)", wordBreak: "break-all" }}>
                            {track.acoustid_id ? (
                                <a href={`https://acoustid.org/track/${track.acoustid_id}`} target="_blank" rel="noopener noreferrer" style={{ color: "var(--primary-blue)" }}>
                                    {track.acoustid_id}
                                </a>
                            ) : "Not identified via AcoustID"}
                        </div>
                    </div>

                    <div style={{ background: "var(--bg-card-subtle)", padding: "12px 16px", borderRadius: "8px", border: "1px solid var(--border-color)" }}>
                        <div style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: "700", textTransform: "uppercase", marginBottom: "4px" }}>MusicBrainz Recording ID</div>
                        <div style={{ fontSize: "14px", fontWeight: "600", color: "var(--text-primary)", wordBreak: "break-all" }}>
                            {track.musicbrainz_recording_id ? (
                                <a href={`https://musicbrainz.org/recording/${track.musicbrainz_recording_id}`} target="_blank" rel="noopener noreferrer" style={{ color: "var(--primary-blue)" }}>
                                    {track.musicbrainz_recording_id}
                                </a>
                            ) : "No MusicBrainz Recording ID"}
                        </div>
                    </div>

                    <div style={{ background: "var(--bg-card-subtle)", padding: "12px 16px", borderRadius: "8px", border: "1px solid var(--border-color)" }}>
                        <div style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: "700", textTransform: "uppercase", marginBottom: "4px" }}>Spotify Track ID</div>
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
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
                        <span style={{ fontSize: "12px", color: "var(--text-secondary)", fontWeight: "700", textTransform: "uppercase" }}>Chromaprint Fingerprint Hash</span>
                        {track.fingerprint && (
                            <button
                                onClick={handleCopyFingerprint}
                                style={{ background: "none", border: "none", color: "var(--primary-blue)", cursor: "pointer", fontSize: "12px", display: "inline-flex", alignItems: "center", gap: "4px", fontWeight: "600" }}
                            >
                                {copied ? <Check size={14} color="#15803d" /> : <Copy size={14} />}
                                {copied ? "Copied!" : "Copy Fingerprint"}
                            </button>
                        )}
                    </div>
                    <div style={{ background: "var(--bg-sidebar)", padding: "12px", borderRadius: "6px", fontFamily: "monospace", fontSize: "12px", color: "var(--text-secondary)", wordBreak: "break-all", maxHeight: "100px", overflowY: "auto", border: "1px solid var(--border-color)" }}>
                        {track.fingerprint || "No audio fingerprint generated for this track."}
                    </div>
                </div>
            </div>

            {/* Metadata Comparison Side-by-Side */}
            <div className="metadata-table-card">
                <div className="metadata-table-header">
                    <h2>Metadata Comparison (Previous vs Corrected)</h2>
                </div>

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
                            <td style={{ color: prevMeta.artist !== track.artist ? "#c2410c" : "inherit" }}>
                                {prevMeta.artist || "—"}
                            </td>
                            <td style={{ fontWeight: 700, color: "#15803d" }}>
                                {track.artist || "—"}
                            </td>
                        </tr>
                        <tr>
                            <td><strong>Title</strong></td>
                            <td style={{ color: prevMeta.title !== track.title ? "#c2410c" : "inherit" }}>
                                {prevMeta.title || "—"}
                            </td>
                            <td style={{ fontWeight: 700, color: "#15803d" }}>
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
                    </tbody>
                </table>
            </div>

            {/* Changes Made Card */}
            {latestHistory && (
                <div className="metadata-table-card" style={{ padding: "24px" }}>
                    <h2 style={{ fontSize: "18px", fontWeight: "700", marginBottom: "16px" }}>Changes Made</h2>
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                        {prevMeta.artist && prevMeta.artist !== track.artist && (
                            <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "14px" }}>
                                <span style={{ fontWeight: "600", width: "120px" }}>Artist:</span>
                                <span style={{ color: "#c2410c", textDecoration: "line-through" }}>{prevMeta.artist}</span>
                                <ArrowRight size={14} />
                                <span style={{ color: "#15803d", fontWeight: "700" }}>{track.artist}</span>
                            </div>
                        )}

                        {prevFilename !== currentFilename && (
                            <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "14px" }}>
                                <span style={{ fontWeight: "600", width: "120px" }}>Audio Filename:</span>
                                <span style={{ color: "#c2410c", wordBreak: "break-all" }}>{prevFilename}</span>
                                <ArrowRight size={14} />
                                <span style={{ color: "#15803d", fontWeight: "700", wordBreak: "break-all" }}>{currentFilename}</span>
                            </div>
                        )}

                        {prevLyricsFilename && lyricsFilename && prevLyricsFilename !== lyricsFilename && (
                            <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "14px" }}>
                                <span style={{ fontWeight: "600", width: "120px" }}>Lyrics Filename:</span>
                                <span style={{ color: "#c2410c", wordBreak: "break-all" }}>{prevLyricsFilename}</span>
                                <ArrowRight size={14} />
                                <span style={{ color: "#15803d", fontWeight: "700", wordBreak: "break-all" }}>{lyricsFilename}</span>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* History Timeline */}
            <div className="metadata-table-card" style={{ padding: "24px" }}>
                <h2 style={{ fontSize: "18px", fontWeight: "700", marginBottom: "16px" }}>Metadata Change History</h2>
                {history.length === 0 ? (
                    <p style={{ color: "var(--text-secondary)" }}>No history recorded yet for this track.</p>
                ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                        {history.map((h, idx) => (
                            <div key={h.id || idx} style={{ borderLeft: "3px solid var(--primary-blue)", paddingLeft: "16px", paddingY: "4px" }}>
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
                                    <strong style={{ fontSize: "14px", textTransform: "capitalize" }}>
                                        {h.action.replace(/_/g, " ")}
                                    </strong>
                                    <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                                        {new Date(h.created_at).toLocaleString()}
                                    </span>
                                </div>
                                <div style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "4px" }}>
                                    Status: <span className={`status-state-pill ${h.status}`} style={{ fontSize: "11px", padding: "2px 8px" }}>{h.status}</span>
                                    {h.match_source && ` • Source: ${h.match_source}`}
                                </div>
                                {h.error_message && (
                                    <div style={{ fontSize: "13px", color: "#b91c1c", marginTop: "4px" }}>
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
