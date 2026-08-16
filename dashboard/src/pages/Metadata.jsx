import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Sparkles, RefreshCw, Layers, CheckCircle2, AlertCircle, FileText, Play } from "lucide-react";
import { getMetadataStatus, getMetadataResults, triggerScan, enrichTrack } from "../services/metadata";
import "../styles/metadata.css";

const Metadata = () => {
    const [status, setStatus] = useState(null);
    const [loadingStatus, setLoadingStatus] = useState(true);
    const [results, setResults] = useState([]);
    const [totalResults, setTotalResults] = useState(0);
    const [page, setPage] = useState(1);
    const [filterState, setFilterState] = useState("");
    const [loadingResults, setLoadingResults] = useState(false);
    const [isScanning, setIsScanning] = useState(false);
    const [enrichingTrackId, setEnrichingTrackId] = useState(null);

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
            const params = { page, limit: 50 };
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
        beets_edited_count: 0,
    };

    return (
        <div className="metadata-container">
            <div className="metadata-header">
                <div>
                    <h1>
                        <Sparkles size={28} className="text-primary" />
                        Metadata Management
                    </h1>
                    <p className="subtitle">
                        Inspect, enrich, and tag downloaded tracks using Beets & MusicBrainz.
                    </p>
                </div>
                <div className="metadata-actions">
                    <button
                        className="btn-scan"
                        onClick={() => handleScan(false)}
                        disabled={isScanning}
                    >
                        <RefreshCw size={16} className={isScanning ? "spin" : ""} />
                        {isScanning ? "Scanning Library..." : "Scan Library"}
                    </button>
                    <button
                        className="btn-force-scan"
                        onClick={() => handleScan(true)}
                        disabled={isScanning}
                    >
                        Force Reprocess
                    </button>
                </div>
            </div>

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
                        <CheckCircle2 size={24} />
                    </div>
                    <div className="metric-info">
                        <span className="metric-value">{metrics.enriched_files || metrics.beets_edited_count}</span>
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
                        <AlertCircle size={24} />
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
                    <h2>Track Metadata Status</h2>
                    <div className="metadata-filters">
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
                            <option value="raw">Raw</option>
                            <option value="enriched">Enriched (High Confidence)</option>
                            <option value="low_confidence">Low Confidence</option>
                            <option value="skipped">Skipped</option>
                            <option value="failed">Failed</option>
                        </select>
                    </div>
                </div>

                <table className="metadata-table">
                    <thead>
                        <tr>
                            <th>Track Title</th>
                            <th>Artist</th>
                            <th>Album</th>
                            <th>State</th>
                            <th>Provenance</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loadingResults ? (
                            <tr>
                                <td colSpan={6} style={{ textAlign: "center", padding: "30px" }}>
                                    Loading track results...
                                </td>
                            </tr>
                        ) : results.length === 0 ? (
                            <tr>
                                <td colSpan={6} style={{ textAlign: "center", padding: "30px", color: "var(--text-secondary)" }}>
                                    No tracks found. Click "Scan Library" to start metadata autotagging.
                                </td>
                            </tr>
                        ) : (
                            results.map((track) => (
                                <tr key={track.id}>
                                    <td>
                                        <Link
                                            to={`/metadata/tracks/${track.id}`}
                                            style={{ fontWeight: 600, color: "#2563eb", textDecoration: "none" }}
                                            className="track-title-link"
                                        >
                                            {track.title || `Track #${track.song_id}`}
                                        </Link>
                                    </td>
                                    <td>{track.artist || "—"}</td>
                                    <td>{track.album || "—"}</td>
                                    <td>
                                        <span className={`status-state-pill ${track.metadata_state}`}>
                                            {track.metadata_state === "enriched"
                                                ? "Enriched (High Confidence)"
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
                                    <td>
                                        <button
                                            className="btn-enrich-action"
                                            onClick={() => handleSingleEnrich(track.id)}
                                            disabled={enrichingTrackId === track.id || isScanning}
                                        >
                                            <RefreshCw
                                                size={12}
                                                className={enrichingTrackId === track.id ? "spin" : ""}
                                            />
                                            Enrich
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default Metadata;
