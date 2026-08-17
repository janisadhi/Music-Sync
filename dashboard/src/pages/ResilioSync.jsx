import { useEffect, useState } from "react";
import {
    AlertCircle,
    ArrowDown,
    ArrowUp,
    CheckCircle2,
    Clock,
    Download,
    Folder,
    HardDrive,
    Laptop,
    RefreshCw,
    ShieldCheck,
    Smartphone,
    Wifi,
    Zap,
} from "lucide-react";
import { getResilioOverview } from "../services/rslsync";
import "../styles/resilioSync.css";

function formatBytes(bytes, decimals = 1) {
    if (!bytes || bytes === 0) return "0 B";
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

function formatSpeed(bytesPerSec) {
    if (!bytesPerSec || bytesPerSec === 0) return "0 KB/s";
    return `${formatBytes(bytesPerSec)}/s`;
}

export default function ResilioSync() {
    const [overview, setOverview] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState(null);

    const fetchOverview = async (isManual = false) => {
        try {
            if (isManual) setRefreshing(true);
            setError(null);
            const data = await getResilioOverview(isManual);
            setOverview(data);
        } catch (err) {
            console.error("Failed to fetch Resilio Sync overview:", err);
            setError("Unable to connect to Resilio Sync API service.");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchOverview();
        const timer = setInterval(() => fetchOverview(false), 3000);
        return () => clearInterval(timer);
    }, []);

    if (loading && !overview) {
        return (
            <div className="rslsync-container">
                <div className="health-loading">
                    <RefreshCw className="spin-icon" size={32} />
                    <p>Connecting to Resilio Sync engine...</p>
                </div>
            </div>
        );
    }

    const status = overview?.status || {};
    const folders = overview?.folders || [];
    const peers = overview?.peers || [];
    const transfers = overview?.transfers || [];
    const errors = overview?.errors || [];

    const isConnected = status.connected;

    return (
        <div className="rslsync-container">
            {/* Header */}
            <header className="rslsync-header">
                <div>
                    <h1>Resilio Sync Engine</h1>
                    <p className="subtitle">
                        Headless peer-to-peer music library transport layer & mobile device synchronization.
                    </p>
                </div>

                <div className="rslsync-header-actions">
                    <span className="live-pulse-badge">
                        <span className="pulse-dot" /> Live (Auto-refreshes 3s)
                    </span>
                    <button
                        className="btn btn-secondary"
                        onClick={() => fetchOverview(true)}
                        disabled={refreshing}
                    >
                        <RefreshCw className={refreshing ? "spin-icon" : ""} size={15} />
                        {refreshing ? "Refreshing..." : "Refresh"}
                    </button>
                </div>
            </header>

            {/* Resilio Health & Connection Hero Banner */}
            <div className={`rslsync-hero-banner ${isConnected ? "connected" : "disconnected"}`}>
                <div className="rslsync-hero-left">
                    <div className={`rslsync-icon-circle ${isConnected ? "online" : "offline"}`}>
                        {isConnected ? <CheckCircle2 size={28} /> : <AlertCircle size={28} />}
                    </div>
                    <div className="rslsync-title-block">
                        <h2>{isConnected ? "Resilio Sync Operational" : "Resilio Sync Container Unavailable"}</h2>
                        <p>
                            {isConnected
                                ? "P2P mobile synchronization engine is active and connected to host filesystem."
                                : status.error_message || "Cannot communicate with the Resilio Sync container instance."}
                        </p>
                    </div>
                </div>

                <div className="rslsync-hero-right">
                    <span className={`badge-status ${isConnected ? "online" : "offline"}`}>
                        {isConnected ? "CONNECTED" : "DISCONNECTED"}
                    </span>
                </div>
            </div>

            {/* Key Metrics Overview Cards */}
            <div className="rslsync-metrics-grid">
                {/* Sync Progress */}
                <div className="rslsync-card">
                    <div className="rslsync-card-header">
                        <span className="rslsync-card-title">
                            <Zap size={18} style={{ color: "#3b82f6" }} /> Sync Progress
                        </span>
                        <span className="badge-status synced">{status.overall_progress_pct || 100}%</span>
                    </div>
                    <div className="rslsync-card-number">{status.overall_progress_pct || 100}%</div>
                    <div className="rslsync-progress-track">
                        <div
                            className="rslsync-progress-fill"
                            style={{ width: `${status.overall_progress_pct || 100}%` }}
                        />
                    </div>
                </div>

                {/* Transfer Speed */}
                <div className="rslsync-card">
                    <div className="rslsync-card-header">
                        <span className="rslsync-card-title">
                            <Wifi size={18} style={{ color: "#10b981" }} /> Speed & Bandwidth
                        </span>
                        <span className="badge-status syncing">
                            {status.active_transfers_count || 0} Transfers
                        </span>
                    </div>
                    <div className="rslsync-card-number">
                        <span style={{ fontSize: "18px", color: "#10b981" }}>
                            <ArrowDown size={16} /> {formatSpeed(status.download_speed)}
                        </span>
                        {" / "}
                        <span style={{ fontSize: "18px", color: "#3b82f6" }}>
                            <ArrowUp size={16} /> {formatSpeed(status.upload_speed)}
                        </span>
                    </div>
                </div>

                {/* Paired Mobile Devices */}
                <div className="rslsync-card">
                    <div className="rslsync-card-header">
                        <span className="rslsync-card-title">
                            <Smartphone size={18} style={{ color: "#8b5cf6" }} /> Connected Devices
                        </span>
                        <span className="badge-status online">
                            {status.connected_peers_count || 0} Online
                        </span>
                    </div>
                    <div className="rslsync-card-number">{status.connected_peers_count || 0} Devices</div>
                </div>
            </div>

            {/* Split Dashboard Sections */}
            <div className="rslsync-dashboard-grid">
                {/* Monitored Sync Folders */}
                <div className="rslsync-panel">
                    <div className="panel-title-row">
                        <h3><Folder size={18} /> Synchronized Folders</h3>
                        <span className="badge-status online">{folders.length} Folders</span>
                    </div>

                    <div className="rslsync-item-list">
                        {folders.length === 0 ? (
                            <div className="empty-state">
                                <Folder size={32} />
                                <p>No sync folders configured.</p>
                            </div>
                        ) : (
                            folders.map((f) => (
                                <div key={f.id || f.name} className="rslsync-item-row">
                                    <div className="item-left">
                                        <div className="item-icon">
                                            <HardDrive size={18} />
                                        </div>
                                        <div className="item-info">
                                            <span className="item-title">{f.name}</span>
                                            <span className="item-subtitle"><code>{f.path}</code></span>
                                        </div>
                                    </div>
                                    <span className={`badge-status ${f.status}`}>{f.status}</span>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Connected Mobile Devices & Peers */}
                <div className="rslsync-panel">
                    <div className="panel-title-row">
                        <h3><Smartphone size={18} /> Connected Devices</h3>
                        <span className="badge-status online">{peers.length} Devices</span>
                    </div>

                    <div className="rslsync-item-list">
                        {peers.length === 0 ? (
                            <div className="empty-state">
                                <Smartphone size={32} />
                                <p>No mobile devices paired yet.</p>
                            </div>
                        ) : (
                            peers.map((p) => (
                                <div key={p.id || p.name} className="rslsync-item-row">
                                    <div className="item-left">
                                        <div className="item-icon">
                                            {p.name.toLowerCase().includes("laptop") ? <Laptop size={18} /> : <Smartphone size={18} />}
                                        </div>
                                        <div className="item-info">
                                            <span className="item-title">{p.name}</span>
                                            <span className="item-subtitle">{p.connection_state} connection</span>
                                        </div>
                                    </div>
                                    <span className={`badge-status ${p.status}`}>{p.status}</span>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Active Transfers & Errors */}
            <div className="rslsync-dashboard-grid">
                {/* Active Transfers */}
                <div className="rslsync-panel">
                    <div className="panel-title-row">
                        <h3><Download size={18} /> Active File Transfers</h3>
                        <span className="badge-status syncing">{transfers.length} Active</span>
                    </div>

                    {transfers.length === 0 ? (
                        <div className="empty-state">
                            <Clock size={32} />
                            <p>No file transfers currently in progress.</p>
                        </div>
                    ) : (
                        <div className="rslsync-item-list">
                            {transfers.map((t) => (
                                <div key={t.id || t.filename} className="transfer-card">
                                    <div className="transfer-top">
                                        <span className="transfer-filename">{t.filename}</span>
                                        <span className="transfer-speed">{formatSpeed(t.speed_bytes_sec)}</span>
                                    </div>
                                    <div className="rslsync-progress-track">
                                        <div
                                            className="rslsync-progress-fill"
                                            style={{ width: `${t.progress_pct}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Resilio Error Logs */}
                <div className="rslsync-panel">
                    <div className="panel-title-row">
                        <h3><AlertCircle size={18} /> Synchronization Errors</h3>
                        <span className={`badge-status ${errors.length > 0 ? "error" : "online"}`}>
                            {errors.length} Errors
                        </span>
                    </div>

                    {errors.length === 0 ? (
                        <div className="empty-state">
                            <ShieldCheck size={32} style={{ color: "#10b981" }} />
                            <p>No synchronization errors reported.</p>
                        </div>
                    ) : (
                        <div className="rslsync-item-list">
                            {errors.map((err) => (
                                <div key={err.id || err.message} className="rslsync-item-row" style={{ background: "#fef2f2" }}>
                                    <div className="item-left">
                                        <AlertCircle size={18} style={{ color: "#ef4444" }} />
                                        <div className="item-info">
                                            <span className="item-title" style={{ color: "#991b1b" }}>{err.message}</span>
                                            {err.timestamp && <span className="item-subtitle">{err.timestamp}</span>}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
