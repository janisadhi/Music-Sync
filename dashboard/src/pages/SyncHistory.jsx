import { useEffect, useState } from "react";
import { Activity, AlertCircle, CheckCircle2, Clock, History, RefreshCw } from "lucide-react";
import api from "../services/api";
import "../styles/dashboard.css";

function StatusBadge({ status }) {
    if (status === "success") {
        return (
            <span className="status-pill success">
                <CheckCircle2 size={13} /> SUCCESS
            </span>
        );
    }
    if (status === "failed") {
        return (
            <span className="status-pill failed">
                <AlertCircle size={13} /> FAILED
            </span>
        );
    }
    if (status === "running") {
        return (
            <span className="status-pill running">
                <RefreshCw size={13} className="spin-icon" /> RUNNING
            </span>
        );
    }
    return <span className="status-pill idle">{status || "UNKNOWN"}</span>;
}

function formatDate(date) {
    if (!date) return "N/A";
    return new Date(date).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "medium",
    });
}

function calculateDuration(started, completed) {
    if (!started || !completed) return "-";
    const start = new Date(started).getTime();
    const end = new Date(completed).getTime();
    const duration = (end - start) / 1000;
    return `${duration.toFixed(2)}s`;
}

function SyncHistory() {
    const [syncs, setSyncs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const fetchHistory = async () => {
        try {
            setLoading(true);
            setError("");
            const response = await api.get("/dashboard");
            setSyncs(response.data.recent_syncs || []);
        } catch (err) {
            console.error("Failed to fetch sync history:", err);
            setError("Unable to load synchronization history.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchHistory();
        const timer = setInterval(fetchHistory, 5000);
        return () => clearInterval(timer);
    }, []);

    return (
        <div className="dashboard-container">
            <header className="dashboard-header">
                <div className="header-info">
                    <h1>Sync Execution History</h1>
                    <p className="subtitle">Audit log of previous background and manual synchronization cycles.</p>
                </div>
                <div className="header-actions">
                    <button className="btn btn-secondary" onClick={fetchHistory}>
                        <RefreshCw size={15} /> Refresh
                    </button>
                </div>
            </header>

            {error && (
                <div className="dashboard-alert alert-error">
                    <AlertCircle size={18} />
                    <span>{error}</span>
                </div>
            )}

            <div className="dashboard-panel">
                <div className="panel-header">
                    <div className="panel-title">
                        <History size={20} className="panel-icon" />
                        <h2>Recent Synchronizations</h2>
                    </div>
                </div>

                <div className="panel-body" style={{ padding: 0 }}>
                    {loading ? (
                        <div className="dashboard-loading" style={{ minHeight: "200px" }}>
                            <RefreshCw className="spin-icon" size={24} />
                            <p>Loading history...</p>
                        </div>
                    ) : syncs.length === 0 ? (
                        <div className="empty-panel">
                            <Activity size={32} className="text-muted" />
                            <p>No synchronization history available yet.</p>
                        </div>
                    ) : (
                        <div className="table-wrapper">
                            <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                <thead>
                                    <tr style={{ background: "#f8fafc", borderBottom: "1px solid var(--border-light)" }}>
                                        <th style={{ padding: "14px 20px", textAlign: "left", fontSize: "12px", color: "var(--text-muted)", fontWeight: "700" }}>#</th>
                                        <th style={{ padding: "14px 20px", textAlign: "left", fontSize: "12px", color: "var(--text-muted)", fontWeight: "700" }}>STATUS</th>
                                        <th style={{ padding: "14px 20px", textAlign: "left", fontSize: "12px", color: "var(--text-muted)", fontWeight: "700" }}>STARTED AT</th>
                                        <th style={{ padding: "14px 20px", textAlign: "left", fontSize: "12px", color: "var(--text-muted)", fontWeight: "700" }}>COMPLETED AT</th>
                                        <th style={{ padding: "14px 20px", textAlign: "left", fontSize: "12px", color: "var(--text-muted)", fontWeight: "700" }}>DURATION</th>
                                        <th style={{ padding: "14px 20px", textAlign: "left", fontSize: "12px", color: "var(--text-muted)", fontWeight: "700" }}>ERROR DETAILS</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {syncs.map((sync, index) => (
                                        <tr key={sync.id || index} style={{ borderBottom: "1px solid var(--border-light)" }}>
                                            <td style={{ padding: "14px 20px", fontSize: "13px", fontWeight: "600", color: "var(--text-muted)" }}>
                                                {syncs.length - index}
                                            </td>
                                            <td style={{ padding: "14px 20px" }}>
                                                <StatusBadge status={sync.status} />
                                            </td>
                                            <td style={{ padding: "14px 20px", fontSize: "13px", color: "var(--text-primary)" }}>
                                                {formatDate(sync.started_at)}
                                            </td>
                                            <td style={{ padding: "14px 20px", fontSize: "13px", color: "var(--text-primary)" }}>
                                                {formatDate(sync.completed_at)}
                                            </td>
                                            <td style={{ padding: "14px 20px", fontSize: "13px", fontWeight: "600", color: "var(--text-secondary)" }}>
                                                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                                    <Clock size={14} />
                                                    <span>{calculateDuration(sync.started_at, sync.completed_at)}</span>
                                                </div>
                                            </td>
                                            <td style={{ padding: "14px 20px", fontSize: "13px", color: sync.error ? "var(--danger-rose)" : "var(--text-muted)" }}>
                                                {sync.error ? (
                                                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                                        <AlertCircle size={14} />
                                                        <span>{sync.error}</span>
                                                    </div>
                                                ) : (
                                                    "-"
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default SyncHistory;