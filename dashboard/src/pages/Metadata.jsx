import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
    Sparkles,
    RefreshCw,
    Layers,
    CheckCircle2,
    AlertCircle,
    FileText,
    Search,
    ChevronLeft,
    ChevronRight,
    Disc,
    Radio,
    XCircle,
    ArrowUpRight,
} from "lucide-react";
import { getMetadataStatus, getMetadataResults, triggerScan, enrichTrack } from "../services/metadata";
import "../styles/metadata.css";

const Metadata = () => {
    const [status, setStatus] = useState(null);
    const [loadingStatus, setLoadingStatus] = useState(true);
    const [results, setResults] = useState([]);
    const [totalResults, setTotalResults] = useState(0);
    const [page, setPage] = useState(1);
    const [filterState, setFilterState] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const [loadingResults, setLoadingResults] = useState(false);
    const [isScanning, setIsScanning] = useState(false);
    const [enrichingTrackId, setEnrichingTrackId] = useState(null);

    const limit = 50;

    const fetchStatus = async () => {
        try {
            const data = await getMetadataStatus();
            setStatus(data);
            setIsScanning(data.is_scanning);
        } catch (err) {
            console.error("Failed to fetch metadata status:", err);
        } finally {
            setLoadingStatus(false);
        }
    };

    const fetchResults = async () => {
        setLoadingResults(true);
        try {
            const params = { page, limit };
            if (filterState) {
                params.state = filterState;
            }
            const data = await getMetadataResults(params);
            setResults(data.items || []);
            setTotalResults(data.total || 0);
        } catch (err) {
            console.error("Failed to fetch metadata results:", err);
        } finally {
            setLoadingResults(false);
        }
    };

    useEffect(() => {
        fetchStatus();
        fetchResults();
    }, [page, filterState]);

    // Poll status while scanning
    useEffect(() => {
        let interval;
        if (isScanning) {
            interval = setInterval(() => {
                fetchStatus();
                fetchResults();
            }, 3000);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [isScanning]);

    const handleScan = async (forceReprocess = false) => {
        try {
            setIsScanning(true);
            await triggerScan(forceReprocess);
            await fetchStatus();
            await fetchResults();
        } catch (err) {
            console.error("Failed to trigger scan:", err);
            setIsScanning(false);
        }
    };

    const handleSingleEnrich = async (trackId) => {
        setEnrichingTrackId(trackId);
        try {
            await enrichTrack(trackId);
            await fetchStatus();
            await fetchResults();
        } catch (err) {
            console.error(`Failed to enrich track ${trackId}:`, err);
        } finally {
            setEnrichingTrackId(null);
        }
    };

    const metrics = status?.metrics || {
        total_files: 0,
        raw_files: 0,
        enriched_files: 0,
        failed_files: 0,
        low_confidence_files: 0,
        beets_edited_count: 0,
    };

    const enrichedCount = metrics.enriched_files || metrics.beets_edited_count || 0;
    const enrichedPercentage = metrics.total_files > 0 ? Math.round((enrichedCount / metrics.total_files) * 100) : 0;

    // Filter results locally by search query
    const filteredResults = results.filter((track) => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        const title = (track.title || "").toLowerCase();
        const artist = (track.artist || "").toLowerCase();
        const album = (track.album || "").toLowerCase();
        const videoId = (track.youtube_video_id || "").toLowerCase();
        return title.includes(q) || artist.includes(q) || album.includes(q) || videoId.includes(q);
    });

    const totalPages = Math.ceil(totalResults / limit) || 1;
    const currentJob = status?.current_job;

    return (
        <div className="metadata-container">
            {/* Hero Header Section */}
            <div className="metadata-hero-banner">
                <div className="hero-title-group">
                    <h1>
                        <Sparkles size={32} style={{ color: "#3b82f6" }} />
                        Metadata Management
                    </h1>
                    <p className="subtitle">
                        Inspect, autotag, and enrich your audio library using Beets, MusicBrainz, AcoustID & Spotify.
                    </p>

                    <div className="hero-badge-strip">
                        <span className="engine-pill">
                            <Radio size={14} style={{ color: "#10b981" }} /> Beets 2.0 Engine
                        </span>
                        <span className="engine-pill">
                            <Sparkles size={14} style={{ color: "#3b82f6" }} /> MusicBrainz Release Selector
                        </span>
                        <span className="engine-pill">
                            <CheckCircle2 size={14} style={{ color: "#8b5cf6" }} /> AcoustID Fingerprinting
                        </span>
                    </div>
                </div>

                <div className="metadata-actions">
                    <button
                        type="button"
                        className="btn-scan"
                        onClick={() => handleScan(false)}
                        disabled={isScanning}
                    >
                        <RefreshCw size={18} className={isScanning ? "spin" : ""} />
                        {isScanning ? "Scanning Library..." : "Scan & Tag Library"}
                    </button>
                    <button
                        type="button"
                        className="btn-force-scan"
                        onClick={() => handleScan(true)}
                        disabled={isScanning}
                    >
                        Force Reprocess
                    </button>
                </div>
            </div>

            {/* Scan Job Running Progress Indicator */}
            {isScanning && currentJob && (
                <div className="scan-progress-banner">
                    <div className="progress-header">
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <RefreshCw size={18} className="spin" style={{ color: "#3b82f6" }} />
                            <span>Scan Job in Progress ({currentJob.status})</span>
                        </div>
                        <span>
                            {currentJob.processed_tracks} / {currentJob.total_tracks || "?"} tracks processed
                        </span>
                    </div>
                    {currentJob.total_tracks > 0 && (
                        <div className="progress-bar-track">
                            <div
                                className="progress-bar-fill"
                                style={{
                                    width: `${Math.min(100, Math.round((currentJob.processed_tracks / currentJob.total_tracks) * 100))}%`,
                                }}
                            />
                        </div>
                    )}
                </div>
            )}

            {/* Metrics Grid */}
            <div className="metadata-metrics-grid">
                <div className="metric-card">
                    <div className="metric-icon-box total">
                        <Layers size={24} />
                    </div>
                    <div className="metric-info">
                        <span className="metric-value">{metrics.total_files}</span>
                        <span className="metric-label">Total Audio Files</span>
                    </div>
                </div>

                <div className="metric-card">
                    <div className="metric-icon-box raw">
                        <FileText size={24} />
                    </div>
                    <div className="metric-info">
                        <span className="metric-value">{metrics.raw_files}</span>
                        <span className="metric-label">Raw / Pending</span>
                    </div>
                </div>

                <div className="metric-card">
                    <div className="metric-icon-box beets">
                        <Sparkles size={24} />
                    </div>
                    <div className="metric-info">
                        <span className="metric-value">
                            {enrichedCount} <span style={{ fontSize: "14px", fontWeight: "600", color: "#10b981" }}>({enrichedPercentage}%)</span>
                        </span>
                        <span className="metric-label">Enriched (High Confidence)</span>
                    </div>
                </div>

                <div className="metric-card">
                    <div className="metric-icon-box low-confidence">
                        <AlertCircle size={24} />
                    </div>
                    <div className="metric-info">
                        <span className="metric-value">{metrics.low_confidence_files ?? metrics.skipped_files ?? 0}</span>
                        <span className="metric-label">Low Confidence</span>
                    </div>
                </div>

                <div className="metric-card">
                    <div className="metric-icon-box failed">
                        <XCircle size={24} />
                    </div>
                    <div className="metric-info">
                        <span className="metric-value">{metrics.failed_files}</span>
                        <span className="metric-label">Failed Matches</span>
                    </div>
                </div>
            </div>

            {/* Results Table Card */}
            <div className="metadata-table-card">
                <div className="metadata-table-header">
                    <div>
                        <h2>Track Metadata Status ({totalResults})</h2>
                    </div>

                    <div className="metadata-toolbar">
                        <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                            <Search size={16} style={{ position: "absolute", left: "12px", color: "var(--text-muted)" }} />
                            <input
                                type="text"
                                className="metadata-search-input"
                                placeholder="Search title, artist, album..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                style={{ paddingLeft: "36px" }}
                            />
                        </div>

                        <label htmlFor="state-filter" className="sr-only">Filter State</label>
                        <select
                            id="state-filter"
                            className="metadata-select"
                            value={filterState}
                            onChange={(e) => {
                                setFilterState(e.target.value);
                                setPage(1);
                            }}
                        >
                            <option value="">All States</option>
                            <option value="raw">Raw / Pending</option>
                            <option value="enriched">Enriched (High Confidence)</option>
                            <option value="low_confidence">Low Confidence</option>
                            <option value="skipped">Skipped</option>
                            <option value="failed">Failed</option>
                        </select>
                    </div>
                </div>

                <div style={{ overflowX: "auto" }}>
                    <table className="metadata-table">
                        <thead>
                            <tr>
                                <th style={{ width: "60px" }}>Cover</th>
                                <th>Track Title</th>
                                <th>Artist</th>
                                <th>Album</th>
                                <th>State</th>
                                <th>Provenance</th>
                                <th style={{ textAlign: "right" }}>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loadingResults ? (
                                <tr>
                                    <td colSpan={7} style={{ textAlign: "center", padding: "40px" }}>
                                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px" }}>
                                            <RefreshCw size={20} className="spin" style={{ color: "#3b82f6" }} />
                                            <span>Loading track results...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredResults.length === 0 ? (
                                <tr>
                                    <td colSpan={7} style={{ textAlign: "center", padding: "40px", color: "var(--text-secondary)" }}>
                                        No tracks found. Click "Scan & Tag Library" to start metadata autotagging.
                                    </td>
                                </tr>
                            ) : (
                                filteredResults.map((track) => (
                                    <tr key={track.id}>
                                        <td>
                                            {track.thumbnail_url ? (
                                                <img
                                                    src={track.thumbnail_url}
                                                    alt={track.title || "Track Cover"}
                                                    className="track-cell-art"
                                                />
                                            ) : (
                                                <div className="track-cell-fallback">
                                                    <Disc size={20} />
                                                </div>
                                            )}
                                        </td>
                                        <td>
                                            <div style={{ display: "flex", flexDirection: "column" }}>
                                                <Link
                                                    to={`/metadata/tracks/${track.id}`}
                                                    style={{ fontWeight: 700, color: "var(--text-primary)", textDecoration: "none" }}
                                                    className="track-title-link"
                                                >
                                                    {track.title || `Track #${track.song_id}`}
                                                    <ArrowUpRight size={14} style={{ display: "inline", marginLeft: "4px", opacity: 0.7 }} />
                                                </Link>
                                                <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                                                    ID: #{track.id} • YT: {track.youtube_video_id}
                                                </span>
                                            </div>
                                        </td>
                                        <td>
                                            <span style={{ fontWeight: 600 }}>{track.artist || "—"}</span>
                                        </td>
                                        <td>
                                            <span style={{ color: "var(--text-secondary)" }}>{track.album || "—"}</span>
                                        </td>
                                        <td>
                                            <span className={`status-state-pill ${track.metadata_state}`}>
                                                {track.metadata_state === "enriched"
                                                    ? "Enriched"
                                                    : track.metadata_state === "low_confidence"
                                                    ? "Low Confidence"
                                                    : track.metadata_state}
                                            </span>
                                        </td>
                                        <td>
                                            {track.beets_metadata_edited ? (
                                                <span className="badge-beets">
                                                    <Sparkles size={12} /> Beets
                                                </span>
                                            ) : (
                                                <span style={{ color: "var(--text-muted)", fontSize: "12px" }}>—</span>
                                            )}
                                        </td>
                                        <td style={{ textAlign: "right" }}>
                                            <button
                                                type="button"
                                                className="btn-enrich-action"
                                                onClick={() => handleSingleEnrich(track.id)}
                                                disabled={enrichingTrackId === track.id || isScanning}
                                            >
                                                <RefreshCw
                                                    size={13}
                                                    className={enrichingTrackId === track.id ? "spin" : ""}
                                                />
                                                {enrichingTrackId === track.id ? "Enriching..." : "Enrich"}
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Controls */}
                <div className="metadata-pagination-bar">
                    <span style={{ fontSize: "13px", color: "var(--text-secondary)", fontWeight: "500" }}>
                        Showing page {page} of {totalPages} ({totalResults} total tracks)
                    </span>

                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <button
                            type="button"
                            className="page-btn"
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            disabled={page <= 1}
                        >
                            <ChevronLeft size={16} /> Previous
                        </button>
                        <button
                            type="button"
                            className="page-btn"
                            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                            disabled={page >= totalPages}
                        >
                            Next <ChevronRight size={16} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Metadata;
