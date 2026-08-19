import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
    Activity,
    AlertCircle,
    ArrowDownRight,
    ArrowUpRight,
    Check,
    CheckCircle2,
    Clock,
    Copy,
    Cpu,
    Download,
    ExternalLink,
    FileText,
    Folder,
    FolderSync,
    HardDrive,
    Key,
    Laptop,
    Lock,
    Plus,
    QrCode,
    RefreshCw,
    Settings,
    Share2,
    ShieldAlert,
    ShieldCheck,
    Smartphone,
    Trash2,
    Wifi,
    WifiOff,
    X,
    Zap,
} from "lucide-react";
import {
    generateShareInfo,
    getPairingStatus,
    getResilioOverview,
    revokePeer,
} from "../services/rslsync";
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
    const [activeTab, setActiveTab] = useState("overview"); // "overview" | "folders" | "transfers"

    // Add Device Wizard State
    const [showModal, setShowModal] = useState(false);
    const [wizardStep, setWizardStep] = useState(1);
    const [selectedFolderId, setSelectedFolderId] = useState("music-downloads");
    const [selectedPermission, setSelectedPermission] = useState("read_write");
    const [shareInfo, setShareInfo] = useState(null);
    const [generatingShare, setGeneratingShare] = useState(false);
    const [copiedSecret, setCopiedSecret] = useState(false);
    const [copiedRoSecret, setCopiedRoSecret] = useState(false);
    const [pairingDetected, setPairingDetected] = useState(false);
    const [pairedDeviceName, setPairedDeviceName] = useState(null);
    const [knownPeerIds, setKnownPeerIds] = useState([]);

    const fetchOverview = async (isManual = false) => {
        try {
            if (isManual) setRefreshing(true);
            setError(null);
            const data = await getResilioOverview(isManual);
            setOverview(data);
        } catch (err) {
            console.error("Failed to fetch Resilio Sync overview:", err);
            setError("Unable to communicate with Resilio Sync API service.");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchOverview();
        const timer = setInterval(() => fetchOverview(false), 2500);
        return () => clearInterval(timer);
    }, []);

    // Polling for new device pairing during Step 2 of wizard
    useEffect(() => {
        let pollTimer = null;
        if (showModal && wizardStep === 2) {
            pollTimer = setInterval(async () => {
                try {
                    const status = await getPairingStatus(selectedFolderId, knownPeerIds);
                    if (status.detected && status.device_name) {
                        setPairingDetected(true);
                        setPairedDeviceName(status.device_name);
                        setWizardStep(3);
                        fetchOverview(true);
                    }
                } catch (err) {
                    console.error("Error polling pairing status:", err);
                }
            }, 2500);
        }
        return () => {
            if (pollTimer) clearInterval(pollTimer);
        };
    }, [showModal, wizardStep, selectedFolderId, knownPeerIds]);

    const handleOpenModal = () => {
        setShowModal(true);
        setWizardStep(1);
        setShareInfo(null);
        setCopiedSecret(false);
        setPairingDetected(false);
        setPairedDeviceName(null);
        // Snapshot existing peer IDs so pairing status ignores old offline peers
        const currentPeers = overview?.peers || [];
        setKnownPeerIds(currentPeers.map((p) => p.id));
    };

    const handleGenerateShare = async () => {
        try {
            setGeneratingShare(true);
            const info = await generateShareInfo(selectedFolderId, selectedPermission);
            setShareInfo(info);
            setWizardStep(2);
        } catch (err) {
            console.error("Failed to generate share info:", err);
            alert("Could not generate Resilio Sync pairing secret.");
        } finally {
            setGeneratingShare(false);
        }
    };

    const handleCopyText = (text, setCopiedFn) => {
        if (!text) return;
        navigator.clipboard.writeText(text);
        setCopiedFn(true);
        setTimeout(() => setCopiedFn(false), 2000);
    };

    const handleRevokePeer = async (peerId, peerName) => {
        if (!window.confirm(`Disconnect and revoke paired device "${peerName}"?`)) return;
        try {
            const folderId = overview?.folders?.[0]?.id || "music-downloads";
            await revokePeer(peerId, folderId);
            await fetchOverview(true);
        } catch (err) {
            console.error("Failed to revoke peer:", err);
            alert(`Failed to revoke device "${peerName}".`);
        }
    };

    if (loading && !overview) {
        return (
            <div className="rslsync-container">
                <div className="rslsync-loading-skeleton">
                    <RefreshCw className="spin-icon text-indigo" size={36} />
                    <p>Initializing P2P Engine Telemetry...</p>
                </div>
            </div>
        );
    }

    const status = overview?.status || {};
    const license = overview?.license || {};
    const folders = overview?.folders || [];
    const peers = overview?.peers || [];
    const transfers = overview?.transfers || [];
    const errors = overview?.errors || [];

    const isConnected = status.connected;

    return (
        <div className="rslsync-container">
            {/* Top Navigation / Title Header */}
            <header className="rslsync-header">
                <div className="rslsync-header-left">
                    <div className="rslsync-brand-badge">
                        <FolderSync size={24} className="text-indigo" />
                    </div>
                    <div>
                        <div className="rslsync-title-row">
                            <h1>Resilio Sync Center</h1>
                            <span className={`engine-pill ${isConnected ? "online" : "offline"}`}>
                                <span className="pulse-dot" />
                                {isConnected ? "ENGINE OPERATIONAL" : "DISCONNECTED"}
                            </span>
                        </div>
                        <p className="subtitle">
                            Headless P2P transport layer & high-speed mobile music file synchronization.
                        </p>
                    </div>
                </div>

                <div className="rslsync-header-actions">
                    <button
                        className="btn btn-glow-primary"
                        onClick={handleOpenModal}
                        disabled={!isConnected}
                    >
                        <Plus size={16} /> Add Device
                    </button>

                    <Link to="/settings" className="btn btn-secondary">
                        <Settings size={15} /> License Config
                    </Link>

                    <button
                        className="btn btn-icon-only"
                        onClick={() => fetchOverview(true)}
                        disabled={refreshing}
                        title="Refresh metrics"
                    >
                        <RefreshCw className={refreshing ? "spin-icon" : ""} size={16} />
                    </button>
                </div>
            </header>

            {/* Glassmorphic Engine Banner */}
            <div className={`rslsync-glass-banner ${isConnected ? "active" : "down"}`}>
                <div className="banner-glow-effect" />
                <div className="banner-content">
                    <div className="banner-left">
                        <div className={`banner-status-icon ${isConnected ? "online" : "offline"}`}>
                            {isConnected ? <Zap size={24} /> : <WifiOff size={24} />}
                        </div>
                        <div>
                            <h2>{isConnected ? "Headless Sync Mesh Active" : "Resilio Sync Container Down"}</h2>
                            <p>
                                {isConnected
                                    ? "Peer-to-peer file synchronization engine is listening on internal port 8888 & UDP 55555."
                                    : status.error_message || "Unable to establish REST/WebUI API handshake with rslsync service."}
                            </p>
                        </div>
                    </div>

                    <div className="banner-tags">
                        <div className="tag-group">
                            <span className="tag-label">P2P Network</span>
                            <span className="tag-val">
                                <Wifi size={13} /> {status.connected_peers_count || 0} Peers Online
                            </span>
                        </div>

                        <div className="tag-group">
                            <span className="tag-label">Engine License</span>
                            <span className={`tag-val ${license?.status === "activated" ? "pro" : "free"}`}>
                                <Key size={13} /> {license?.status?.toUpperCase() || "FREE"} MODE
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* 4 Metric Cards Grid */}
            <div className="rslsync-metrics-grid">
                {/* 1. Sync Progress */}
                <div className="metric-card shadow-card">
                    <div className="card-top">
                        <span className="card-label">
                            <Activity size={16} className="icon-blue" /> Sync Completion
                        </span>
                        <span className={`status-pill ${status.status || "synced"}`}>
                            {status.status === "syncing" ? "Syncing" : status.status === "indexing" ? "Indexing" : "Synced"}
                        </span>
                    </div>
                    <div className="card-big-stat">
                        {status.overall_progress_pct || 100}
                        <span className="unit">%</span>
                    </div>
                    <div className="progress-bar-container">
                        <div
                            className="progress-bar-fill"
                            style={{ width: `${status.overall_progress_pct || 100}%` }}
                        />
                    </div>
                    <div className="card-subtext">
                        <span>Synced: <strong>{status.synced_files || 0}</strong> / {status.total_files || 0} tracks</span>
                        {status.remaining_files > 0 && (
                            <span className="text-amber"><strong>{status.remaining_files}</strong> queued</span>
                        )}
                    </div>
                </div>

                {/* 2. Bandwidth Speeds */}
                <div className="metric-card shadow-card">
                    <div className="card-top">
                        <span className="card-label">
                            <Wifi size={16} className="icon-emerald" /> Live P2P Bandwidth
                        </span>
                        <span className="badge-transfers">
                            {status.active_transfers_count || 0} Active
                        </span>
                    </div>
                    <div className="bandwidth-row">
                        <div className="speed-block down">
                            <ArrowDownRight size={18} />
                            <div>
                                <span className="speed-val">{formatSpeed(status.download_speed)}</span>
                                <span className="speed-lbl">Download</span>
                            </div>
                        </div>
                        <div className="speed-block up">
                            <ArrowUpRight size={18} />
                            <div>
                                <span className="speed-val">{formatSpeed(status.upload_speed)}</span>
                                <span className="speed-lbl">Upload</span>
                            </div>
                        </div>
                    </div>
                    <div className="card-subtext">
                        <span>P2P Direct Connections active</span>
                    </div>
                </div>

                {/* 3. Library Disk Storage */}
                <div className="metric-card shadow-card">
                    <div className="card-top">
                        <span className="card-label">
                            <HardDrive size={16} className="icon-purple" /> Library Payload
                        </span>
                        <span className="status-pill synced">Container FS</span>
                    </div>
                    <div className="card-big-stat" style={{ fontSize: "22px" }}>
                        {formatBytes(status.synced_bytes)}
                    </div>
                    <div className="card-subtext" style={{ marginTop: "12px" }}>
                        <span>Total Library: <strong>{formatBytes(status.total_bytes)}</strong></span>
                    </div>
                </div>

                {/* 4. Connected Devices */}
                <div className="metric-card shadow-card">
                    <div className="card-top">
                        <span className="card-label">
                            <Smartphone size={16} className="icon-indigo" /> Paired Mesh Devices
                        </span>
                        <span className={`status-pill ${peers.length > 0 ? "online" : "offline"}`}>
                            {peers.length} Devices
                        </span>
                    </div>
                    <div className="card-big-stat">
                        {status.connected_peers_count || 0}
                        <span className="unit" style={{ fontSize: "14px", marginLeft: "6px" }}>Online</span>
                    </div>
                    <div className="card-subtext" style={{ marginTop: "12px" }}>
                        <span>{peers.length} registered mobile sync targets</span>
                    </div>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="rslsync-tab-bar">
                <button
                    className={`tab-item ${activeTab === "overview" ? "active" : ""}`}
                    onClick={() => setActiveTab("overview")}
                >
                    <Smartphone size={16} /> Connected Devices ({peers.length})
                </button>

                <button
                    className={`tab-item ${activeTab === "folders" ? "active" : ""}`}
                    onClick={() => setActiveTab("folders")}
                >
                    <Folder size={16} /> Shared Folders ({folders.length})
                </button>

                <button
                    className={`tab-item ${activeTab === "transfers" ? "active" : ""}`}
                    onClick={() => setActiveTab("transfers")}
                >
                    <Download size={16} /> Activity & Logs ({transfers.length + errors.length})
                </button>
            </div>

            {/* Tab 1: Connected Devices View */}
            {activeTab === "overview" && (
                <div className="tab-content-fade">
                    <div className="panel-box">
                        <div className="panel-header-row">
                            <div>
                                <h3>Mobile Devices & Paired Nodes</h3>
                                <p className="panel-sub">Devices connected via Resilio BitTorrent P2P protocols.</p>
                            </div>
                            <button className="btn btn-sm btn-primary" onClick={handleOpenModal} disabled={!isConnected}>
                                <Plus size={14} /> Add Device
                            </button>
                        </div>

                        {peers.length === 0 ? (
                            <div className="empty-state-box">
                                <div className="empty-icon-circle">
                                    <Smartphone size={32} />
                                </div>
                                <h4>No Devices Paired Yet</h4>
                                <p>Pair your Android, iOS, or Desktop Resilio Sync app to start auto-syncing music files.</p>
                                <div className="empty-state-actions" style={{ display: "flex", gap: "12px", marginTop: "12px", flexWrap: "wrap", justifyContent: "center" }}>
                                    <button className="btn btn-primary" onClick={handleOpenModal}>
                                        <QrCode size={16} /> Pair New Device via QR Code
                                    </button>
                                    <a
                                        href="https://play.google.com/store/apps/details?id=com.resilio.sync&pcampaignid=web_share"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="btn btn-secondary"
                                        style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}
                                    >
                                        <Download size={15} /> Download App (Google Play) <ExternalLink size={13} />
                                    </a>
                                </div>
                            </div>
                        ) : (
                            <div className="peers-grid">
                                {peers.map((peer) => (
                                    <div key={peer.id || peer.name} className="peer-card">
                                        <div className="peer-top">
                                            <div className="peer-avatar">
                                                {peer.name.toLowerCase().includes("laptop") || peer.name.toLowerCase().includes("desktop") ? (
                                                    <Laptop size={22} />
                                                ) : (
                                                    <Smartphone size={22} />
                                                )}
                                            </div>

                                            <div className="peer-title-info">
                                                <h4>{peer.name}</h4>
                                                <span className="peer-id">ID: {peer.id ? `${peer.id.substring(0, 12)}...` : "Paired Device"}</span>
                                            </div>

                                            <span className={`status-pill ${peer.status === "online" ? "online" : "offline"}`}>
                                                {peer.status?.toUpperCase()}
                                            </span>
                                        </div>

                                        <div className="peer-details">
                                            <div className="detail-item">
                                                <span className="lbl">Connection:</span>
                                                <span className="val badge-connection">{peer.connection_state}</span>
                                            </div>

                                            <div className="detail-item">
                                                <span className="lbl">Sync State:</span>
                                                <span className="val">{peer.sync_state}</span>
                                            </div>

                                            {peer.last_seen && (
                                                <div className="detail-item">
                                                    <span className="lbl">Last Seen:</span>
                                                    <span className="val">{peer.last_seen}</span>
                                                </div>
                                            )}

                                            {peer.bytes_remaining > 0 && (
                                                <div className="detail-item">
                                                    <span className="lbl">Queue Remaining:</span>
                                                    <span className="val text-amber">{formatBytes(peer.bytes_remaining)}</span>
                                                </div>
                                            )}
                                        </div>

                                        <div className="peer-footer">
                                            <button
                                                className="btn-revoke"
                                                onClick={() => handleRevokePeer(peer.id, peer.name)}
                                            >
                                                <Trash2 size={14} /> Disconnect Device
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Tab 2: Shared Sync Folders */}
            {activeTab === "folders" && (
                <div className="tab-content-fade">
                    <div className="panel-box">
                        <div className="panel-header-row">
                            <div>
                                <h3>Synchronized Filesystem Folders</h3>
                                <p className="panel-sub">Local directories managed by the Resilio Sync engine.</p>
                            </div>
                        </div>

                        <div className="folders-list">
                            {folders.map((folder) => (
                                <div key={folder.id || folder.name} className="folder-detail-card">
                                    <div className="folder-header">
                                        <div className="folder-icon-wrap">
                                            <HardDrive size={22} />
                                        </div>
                                        <div className="folder-title-block">
                                            <h4>{folder.name}</h4>
                                            <code className="folder-path">{folder.path}</code>
                                        </div>
                                        <span className={`status-pill ${folder.status}`}>{folder.status?.toUpperCase()}</span>
                                    </div>

                                    <div className="folder-metrics-row">
                                        <div className="metric-pill">
                                            <span className="lbl">Total Files</span>
                                            <span className="val">{folder.synced_files_count} / {folder.files_count}</span>
                                        </div>

                                        <div className="metric-pill">
                                            <span className="lbl">Disk Storage</span>
                                            <span className="val">{formatBytes(folder.ondisk_size_bytes)} / {formatBytes(folder.size_bytes)}</span>
                                        </div>

                                        <div className="metric-pill">
                                            <span className="lbl">Speed</span>
                                            <span className="val">{formatSpeed(folder.down_speed || folder.up_speed)}</span>
                                        </div>

                                        <div className="metric-pill">
                                            <span className="lbl">Peers</span>
                                            <span className="val">{folder.connected_peers_count} Connected</span>
                                        </div>
                                    </div>

                                    {/* Secret Keys Container */}
                                    <div className="secrets-container">
                                        {folder.secret && (
                                            <div className="secret-row">
                                                <span className="secret-lbl"><Lock size={13} /> Read-Write Key:</span>
                                                <code className="secret-code">{folder.secret_masked || folder.secret}</code>
                                                <button
                                                    className="btn-icon-copy"
                                                    onClick={() => handleCopyText(folder.secret, setCopiedSecret)}
                                                    title="Copy Read-Write Secret"
                                                >
                                                    {copiedSecret ? <Check size={14} className="text-emerald" /> : <Copy size={14} />}
                                                </button>
                                            </div>
                                        )}

                                        {folder.readonlysecret && (
                                            <div className="secret-row">
                                                <span className="secret-lbl"><ShieldCheck size={13} /> Read-Only Key:</span>
                                                <code className="secret-code">{folder.readonlysecret_masked || folder.readonlysecret}</code>
                                                <button
                                                    className="btn-icon-copy"
                                                    onClick={() => handleCopyText(folder.readonlysecret, setCopiedRoSecret)}
                                                    title="Copy Read-Only Secret"
                                                >
                                                    {copiedRoSecret ? <Check size={14} className="text-emerald" /> : <Copy size={14} />}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Tab 3: Activity & Logs */}
            {activeTab === "transfers" && (
                <div className="tab-content-fade">
                    <div className="split-panel-grid">
                        {/* Active File Transfers */}
                        <div className="panel-box">
                            <div className="panel-header-row">
                                <h3><Download size={18} /> Active P2P Transfers</h3>
                                <span className="badge-transfers">{transfers.length} Active</span>
                            </div>

                            {transfers.length === 0 ? (
                                <div className="empty-state-box">
                                    <Clock size={32} style={{ color: "#94a3b8" }} />
                                    <h4>No Active Transfers</h4>
                                    <p>All music files are fully synchronized with paired devices.</p>
                                </div>
                            ) : (
                                <div className="transfers-list">
                                    {transfers.map((t) => (
                                        <div key={t.id || t.filename} className="transfer-item-row">
                                            <div className="transfer-info">
                                                <span className="filename">{t.filename}</span>
                                                <span className="speed">{formatSpeed(t.speed_bytes_sec)}</span>
                                            </div>
                                            <div className="progress-bar-container">
                                                <div className="progress-bar-fill" style={{ width: `${t.progress_pct}%` }} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* System Error Log */}
                        <div className="panel-box">
                            <div className="panel-header-row">
                                <h3><ShieldAlert size={18} /> Engine Error Logs</h3>
                                <span className={`status-pill ${errors.length > 0 ? "offline" : "online"}`}>
                                    {errors.length} Errors
                                </span>
                            </div>

                            {errors.length === 0 ? (
                                <div className="empty-state-box">
                                    <CheckCircle2 size={32} style={{ color: "#10b981" }} />
                                    <h4>Clean Health Status</h4>
                                    <p>No filesystem or peer synchronization errors recorded.</p>
                                </div>
                            ) : (
                                <div className="errors-list">
                                    {errors.map((err) => (
                                        <div key={err.id || err.message} className="error-item-card">
                                            <AlertCircle size={18} className="text-rose" />
                                            <div>
                                                <p className="err-msg">{err.message}</p>
                                                {err.timestamp && <span className="err-time">{err.timestamp}</span>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ==============================================================================
               MODAL: Add New Device Wizard
               ============================================================================== */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal-card-redesign" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header-redesign">
                            <div>
                                <h2><Smartphone size={20} className="text-indigo" /> Pair Mobile Device</h2>
                                <p className="modal-sub">Scan QR code from your phone's Resilio Sync app</p>
                            </div>
                            <button className="btn-close-modal" onClick={() => setShowModal(false)}>
                                <X size={20} />
                            </button>
                        </div>

                        <div className="modal-body-redesign">
                            {/* Wizard Steps Navigation */}
                            <div className="wizard-stepper">
                                <div className={`step-item ${wizardStep === 1 ? "active" : wizardStep > 1 ? "done" : ""}`}>
                                    <span className="step-badge">{wizardStep > 1 ? <Check size={12} /> : "1"}</span>
                                    <span>Folder Access</span>
                                </div>
                                <span className="step-line" />
                                <div className={`step-item ${wizardStep === 2 ? "active" : wizardStep > 2 ? "done" : ""}`}>
                                    <span className="step-badge">{wizardStep > 2 ? <Check size={12} /> : "2"}</span>
                                    <span>Scan QR Code</span>
                                </div>
                                <span className="step-line" />
                                <div className={`step-item ${wizardStep === 3 ? "active" : ""}`}>
                                    <span className="step-badge">3</span>
                                    <span>Paired</span>
                                </div>
                            </div>

                            {/* Step 1: Select Permission */}
                            {wizardStep === 1 && (
                                <div className="wizard-step-content">
                                    <div className="form-group-custom">
                                        <label>1. Music Sync Folder</label>
                                        <select
                                            className="select-custom"
                                            value={selectedFolderId}
                                            onChange={(e) => setSelectedFolderId(e.target.value)}
                                        >
                                            <option value="music-downloads">Music Sync Library (/app/downloads)</option>
                                        </select>
                                    </div>

                                    <div className="form-group-custom">
                                        <label>2. Device Permission Mode</label>
                                        <div className="permission-options-grid">
                                            <div
                                                className={`permission-card ${selectedPermission === "read_write" ? "selected" : ""}`}
                                                onClick={() => setSelectedPermission("read_write")}
                                            >
                                                <div className="perm-header">
                                                    <Lock size={16} /> <strong>Read-Write (Recommended)</strong>
                                                </div>
                                                <p>Allows 2-way sync. Music downloads to phone and changes sync back to server.</p>
                                            </div>

                                            <div
                                                className={`permission-card ${selectedPermission === "read_only" ? "selected" : ""}`}
                                                onClick={() => setSelectedPermission("read_only")}
                                            >
                                                <div className="perm-header">
                                                    <ShieldCheck size={16} /> <strong>Read-Only</strong>
                                                </div>
                                                <p>Phone only receives music files. Changes on phone will not modify server files.</p>
                                            </div>
                                        </div>
                                    </div>

                                    <button
                                        className="btn btn-glow-primary btn-block"
                                        onClick={handleGenerateShare}
                                        disabled={generatingShare}
                                    >
                                        {generatingShare ? "Generating Pairing Key..." : "Generate QR Code →"}
                                    </button>
                                </div>
                            )}

                            {/* Step 2: Display QR Code & Secret */}
                            {wizardStep === 2 && shareInfo && (
                                <div className="wizard-step-content align-center">
                                    <div className="qr-box-container">
                                        {shareInfo.qr_code_svg ? (
                                            <img src={shareInfo.qr_code_svg} alt="Resilio Pairing QR" className="qr-code-rendered" />
                                        ) : (
                                            <QrCode size={140} className="text-indigo" />
                                        )}
                                    </div>

                                    <p className="qr-help-text">
                                        Open <strong>Resilio Sync</strong> on your phone, tap <strong>+</strong>, choose <strong>Scan QR code</strong>, and point your camera here.
                                    </p>

                                    {/* Mobile App Download Prompt */}
                                    <div style={{
                                        background: "#eff6ff",
                                        border: "1px solid #bfdbfe",
                                        borderRadius: "12px",
                                        padding: "10px 14px",
                                        width: "100%",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "space-between",
                                        gap: "10px",
                                        fontSize: "12px"
                                    }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#1e40af", fontWeight: "600" }}>
                                            <Smartphone size={16} className="text-indigo" />
                                            <span>Don't have the mobile app?</span>
                                        </div>
                                        <a
                                            href="https://play.google.com/store/apps/details?id=com.resilio.sync&pcampaignid=web_share"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            style={{
                                                background: "#2563eb",
                                                color: "#ffffff",
                                                padding: "5px 10px",
                                                borderRadius: "8px",
                                                fontWeight: "700",
                                                textDecoration: "none",
                                                display: "inline-flex",
                                                alignItems: "center",
                                                gap: "4px",
                                                whiteSpace: "nowrap"
                                            }}
                                        >
                                            <Download size={12} /> Get on Google Play <ExternalLink size={10} />
                                        </a>
                                    </div>

                                    <div className="manual-secret-box">
                                        <span className="lbl">Or copy manual secret:</span>
                                        <div className="secret-input-row">
                                            <code>{shareInfo.secret_key}</code>
                                            <button
                                                className="btn-copy-sm"
                                                onClick={() => handleCopyText(shareInfo.secret_key, setCopiedSecret)}
                                            >
                                                {copiedSecret ? <Check size={13} /> : <Copy size={13} />}
                                                {copiedSecret ? "Copied" : "Copy"}
                                            </button>
                                        </div>
                                    </div>

                                    <div className="beacon-loader">
                                        <RefreshCw className="spin-icon text-indigo" size={16} />
                                        <span>Listening for incoming P2P connection...</span>
                                    </div>

                                    <button
                                        className="btn btn-primary btn-block"
                                        onClick={() => {
                                            setPairedDeviceName(peers[0]?.name || "Mobile Device");
                                            setWizardStep(3);
                                            fetchOverview(true);
                                        }}
                                    >
                                        I Have Scanned QR Code →
                                    </button>
                                </div>
                            )}

                            {/* Step 3: Success State */}
                            {wizardStep === 3 && (
                                <div className="wizard-step-content align-center">
                                    <div className="success-badge-circle">
                                        <CheckCircle2 size={42} />
                                    </div>

                                    <h3 className="success-title">Device Successfully Paired!</h3>
                                    <p className="success-sub">
                                        Mobile device <strong>"{pairedDeviceName || "Mobile Device"}"</strong> is connected to the Music Sync library mesh.
                                    </p>

                                    <button className="btn btn-glow-primary btn-block" onClick={() => setShowModal(false)}>
                                        Done & Return to Dashboard
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
