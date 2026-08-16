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
} from "lucide-react";
import { getTrackDetail, enrichTrack } from "../services/metadata";
import "../styles/metadata.css";

const TrackDetail = () => {
    const { id } = useParams();
    const [detail, setDetail] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [enriching, setEnriching] = useState(false);

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
    const newMeta = latestHistory?.new_metadata || {
        artist: track.artist,
        title: track.title,
        album: track.album,
        album_artist: track.album_artist,
        genre: track.genre,
        release_year: track.release_year,
        track_number: track.track_number,
    };

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
