import { useEffect, useState } from "react";
import {
    Activity,
    AlertTriangle,
    CheckCircle2,
    Cpu,
    Database,
    DownloadCloud,
    FileText,
    Play,
    RefreshCw,
    Server,
    ShieldCheck,
    Sparkles,
} from "lucide-react";
import api from "../services/api";
import "../styles/systemHealth.css";

export default function SystemHealth() {
    const [health, setHealth] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [scanning, setScanning] = useState(false);
    const [scanMessage, setScanMessage] = useState(null);

    const fetchHealth = async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await api.get("/health");
            setHealth(response.data);
        } catch (err) {
            console.error("Failed to fetch health:", err);
            setError("Unable to connect to backend infrastructure.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchHealth();
        const timer = setInterval(fetchHealth, 10000);
        return () => clearInterval(timer);
    }, []);

    const handleTriggerScan = async () => {
        try {
            setScanning(true);
            setScanMessage(null);
            await api.post("/api/metadata/scan", { force_reprocess: false });
            setScanMessage({ type: "success", text: "Metadata scan & autotag enrichment started." });
            await fetchHealth();
        } catch (err) {
            setScanMessage({
                type: "error",
                text: err.response?.data?.detail || "Failed to trigger metadata scan.",
            });
        } finally {
            setScanning(false);
        }
    };

    if (loading && !health) {
        return (
            <div className="health-page-container">
                <div className="health-loading">
                    <RefreshCw className="spin-icon" size={32} />
                    <p>Checking system infrastructure & metadata health...</p>
                </div>
            </div>
        );
    }

    if (error && !health) {
        return (
            <div className="health-page-container">
                <div className="health-error-card">
                    <AlertTriangle size={44} style={{ color: "#ef4444" }} />
                    <h3>System Unavailable</h3>
                    <p>{error}</p>
                    <button className="btn btn-primary" onClick={fetchHealth}>
                        <RefreshCw size={16} /> Try Again
                    </button>
                </div>
            </div>
        );
    }

    const metadataStats = health?.metadata_service?.stats || {};
    const totalTracks = metadataStats.total_tracks || 0;
    const enrichedTracks = metadataStats.enriched_tracks || 0;
    const rawTracks = metadataStats.raw_tracks || 0;
    const editedTracks = metadataStats.edited_tracks || 0;
    const enrichedPct = totalTracks > 0 ? Math.round((enrichedTracks / totalTracks) * 100) : 0;
    const rawPct = totalTracks > 0 ? 100 - enrichedPct : 0;

    const isOperational = health?.status === "ok";

    return (
        <div className="health-page-container">
            {/* Header */}
            <header className="health-header">
                <div>
                    <h1>System Health & Infrastructure Status</h1>
                    <p className="subtitle">
                        Real-time monitoring metrics for FastAPI backend, PostgreSQL database, Beets Metadata Engine, and background workers.
                    </p>
                </div>

                <div className="health-header-actions">
                    <span className="live-pulse-badge">
                        <span className="pulse-dot" /> Auto-Refreshing (10s)
                    </span>
                    <button
                        className="btn btn-secondary"
                        onClick={handleTriggerScan}
                        disabled={scanning}
                    >
                        <Sparkles size={15} /> {scanning ? "Scanning..." : "Trigger Metadata Scan"}
                    </button>
                    <button className="btn btn-primary" onClick={fetchHealth}>
                        <RefreshCw size={15} /> Refresh
                    </button>
                </div>
            </header>

            {scanMessage && (
                <div className={`playlist-alert-banner alert-${scanMessage.type}`}>
                    {scanMessage.type === "error" ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
                    <span>{scanMessage.text}</span>
                </div>
            )}

            {/* Overall System Banner */}
            <div className={`system-status-banner ${isOperational ? "status-ok" : "status-degraded"}`}>
                <div className="banner-left">
                    <div className={`status-icon-circle ${isOperational ? "ok" : "degraded"}`}>
                        {isOperational ? <CheckCircle2 size={28} /> : <AlertTriangle size={28} />}
                    </div>
                    <div className="banner-title-block">
                        <h2>{isOperational ? "All Systems Operational" : "System Running in Degraded Mode"}</h2>
                        <p>
                            {isOperational
                                ? "Backend services, database connections, workers, and metadata components are healthy."
                                : "One or more infrastructure services are reporting degraded performance or errors."}
                        </p>
                    </div>
                </div>

                <div className="banner-right">
                    <span className={`service-badge ${isOperational ? "online" : "degraded"}`}>
                        {isOperational ? "SYSTEM OK" : "DEGRADED"}
                    </span>
                </div>
            </div>

            {/* Metadata & Beets Enrichment Breakdown Card */}
            <div className="metadata-enrichment-card">
                <div className="card-heading-row">
                    <h3>Metadata Enrichment & Beets Coverage</h3>
                    <span className="service-badge online">
                        {health?.metadata_service?.status === "ok" ? "SERVICE ONLINE" : "DEGRADED"}
                    </span>
                </div>

                <div className="enrichment-bar-wrap">
                    <div className="bar-track">
                        <div className="bar-fill-enriched" style={{ width: `${enrichedPct}%` }} />
                        <div className="bar-fill-raw" style={{ width: `${rawPct}%` }} />
                    </div>
                    <div className="bar-labels-row">
                        <span className="label-enriched">
                            {enrichedPct}% Enriched Metadata ({enrichedTracks} tracks)
                        </span>
                        <span className="label-raw">
                            {rawPct}% Raw YouTube Metadata ({rawTracks} tracks)
                        </span>
                    </div>
                </div>

                <div className="enrichment-stats-grid">
                    <div className="stat-box">
                        <span className="stat-box-label">Total Track Records</span>
                        <span className="stat-box-val purple">{totalTracks}</span>
                    </div>

                    <div className="stat-box">
                        <span className="stat-box-label">Enriched by Beets</span>
                        <span className="stat-box-val green">{enrichedTracks}</span>
                    </div>

                    <div className="stat-box">
                        <span className="stat-box-label">Raw YouTube Metadata</span>
                        <span className="stat-box-val amber">{rawTracks}</span>
                    </div>

                    <div className="stat-box">
                        <span className="stat-box-label">Manually Edited Tags</span>
                        <span className="stat-box-val blue">{editedTracks}</span>
                    </div>
                </div>
            </div>

            {/* Infrastructure Services Cards Grid */}
            <div className="services-health-grid">
                {/* FastAPI Backend */}
                <div className="service-card">
                    <div className="service-card-header">
                        <div className="service-title-row">
                            <div className="service-icon-wrap blue">
                                <Server size={18} />
                            </div>
                            <h3>FastAPI Core</h3>
                        </div>
                        <span className={`service-badge ${health?.status === "ok" ? "online" : "error"}`}>
                            {health?.status === "ok" ? "ONLINE" : "ERROR"}
                        </span>
                    </div>

                    <div className="service-card-body">
                        <div className="metric-hero-val">{health?.service || "music-sync"}</div>
                        <div className="service-info-rows">
                            <div className="info-row">
                                <span className="info-label">Environment</span>
                                <span className="info-val">{health?.environment || "production"}</span>
                            </div>
                            <div className="info-row">
                                <span className="info-label">Framework</span>
                                <span className="info-val">FastAPI (Python 3.14)</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* PostgreSQL Database */}
                <div className="service-card">
                    <div className="service-card-header">
                        <div className="service-title-row">
                            <div className="service-icon-wrap green">
                                <Database size={18} />
                            </div>
                            <h3>PostgreSQL DB</h3>
                        </div>
                        <span className={`service-badge ${health?.database === "ok" ? "connected" : "disconnected"}`}>
                            {health?.database === "ok" ? "CONNECTED" : "ERROR"}
                        </span>
                    </div>

                    <div className="service-card-body">
                        <div className="metric-hero-val">{health?.database === "ok" ? "Healthy" : "Disconnected"}</div>
                        <div className="service-info-rows">
                            <div className="info-row">
                                <span className="info-label">Database Engine</span>
                                <span className="info-val">PostgreSQL 17</span>
                            </div>
                            <div className="info-row">
                                <span className="info-label">Port</span>
                                <span className="info-val">5432</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Beets Metadata Microservice */}
                <div className="service-card">
                    <div className="service-card-header">
                        <div className="service-title-row">
                            <div className="service-icon-wrap purple">
                                <Sparkles size={18} />
                            </div>
                            <h3>Metadata Service</h3>
                        </div>
                        <span className={`service-badge ${health?.metadata_service?.status === "ok" ? "online" : "degraded"}`}>
                            {health?.metadata_service?.status === "ok" ? "ONLINE" : "DEGRADED"}
                        </span>
                    </div>

                    <div className="service-card-body">
                        <div className="metric-hero-val">{enrichedTracks} Enriched</div>
                        <div className="service-info-rows">
                            <div className="info-row">
                                <span className="info-label">Autotag Engine</span>
                                <span className="info-val">Beets + MusicBrainz</span>
                            </div>
                            <div className="info-row">
                                <span className="info-label">Service Port</span>
                                <span className="info-val">8001</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Downloader Worker */}
                <div className="service-card">
                    <div className="service-card-header">
                        <div className="service-title-row">
                            <div className="service-icon-wrap amber">
                                <DownloadCloud size={18} />
                            </div>
                            <h3>Downloader Worker</h3>
                        </div>
                        <span className="service-badge running">RUNNING</span>
                    </div>

                    <div className="service-card-body">
                        <div className="metric-hero-val">yt-dlp Active</div>
                        <div className="service-info-rows">
                            <div className="info-row">
                                <span className="info-label">JS Engine</span>
                                <span className="info-val">Deno Runtime</span>
                            </div>
                            <div className="info-row">
                                <span className="info-label">Status</span>
                                <span className="info-val">{health?.downloader_worker?.status || "polling"}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Lyrics Worker */}
                <div className="service-card">
                    <div className="service-card-header">
                        <div className="service-title-row">
                            <div className="service-icon-wrap indigo">
                                <FileText size={18} />
                            </div>
                            <h3>Lyrics Worker</h3>
                        </div>
                        <span className="service-badge running">RUNNING</span>
                    </div>

                    <div className="service-card-body">
                        <div className="metric-hero-val">LRCLIB Synced</div>
                        <div className="service-info-rows">
                            <div className="info-row">
                                <span className="info-label">Provider</span>
                                <span className="info-val">LRCLIB API</span>
                            </div>
                            <div className="info-row">
                                <span className="info-label">Status</span>
                                <span className="info-val">{health?.lyrics_worker?.status || "polling"}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Security & Environment */}
                <div className="service-card">
                    <div className="service-card-header">
                        <div className="service-title-row">
                            <div className="service-icon-wrap blue">
                                <ShieldCheck size={18} />
                            </div>
                            <h3>Security & Env</h3>
                        </div>
                        <span className="service-badge active">ACTIVE</span>
                    </div>

                    <div className="service-card-body">
                        <div className="metric-hero-val">Protected</div>
                        <div className="service-info-rows">
                            <div className="info-row">
                                <span className="info-label">Environment</span>
                                <span className="info-val">{health?.environment || "production"}</span>
                            </div>
                            <div className="info-row">
                                <span className="info-label">CORS</span>
                                <span className="info-val">Enabled</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}