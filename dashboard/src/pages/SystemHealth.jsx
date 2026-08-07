import { useEffect, useState } from "react";
import { Activity, AlertTriangle, CheckCircle2, Cpu, Database, RefreshCw, Server, ShieldCheck } from "lucide-react";
import api from "../services/api";
import "../styles/dashboard.css";

function SystemHealth() {
    const [health, setHealth] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchHealth = async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await api.get("/health");
            setHealth(response.data);
        } catch (err) {
            console.error("Failed to fetch health:", err);
            setError("Unable to connect to service backend.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchHealth();
        const timer = setInterval(fetchHealth, 10000);
        return () => clearInterval(timer);
    }, []);

    return (
        <div className="dashboard-container">
            <header className="dashboard-header">
                <div className="header-info">
                    <h1>System Health & Status</h1>
                    <p className="subtitle">Real-time status metrics for backend services, database connections, and environment.</p>
                </div>
                <div className="header-actions">
                    <button className="btn btn-secondary" onClick={fetchHealth}>
                        <RefreshCw size={15} /> Refresh
                    </button>
                </div>
            </header>

            {error && (
                <div className="dashboard-alert alert-error">
                    <AlertTriangle size={18} />
                    <span>{error}</span>
                </div>
            )}

            {loading ? (
                <div className="dashboard-loading">
                    <RefreshCw className="spin-icon" size={32} />
                    <p>Checking system health...</p>
                </div>
            ) : health ? (
                <div className="stats-overview-grid">
                    {/* Service Health Card */}
                    <div className="metric-card">
                        <div className="metric-header">
                            <div className="metric-title">
                                <Server className="metric-icon blue" size={18} />
                                <span>FastAPI Backend</span>
                            </div>
                            <span className={`metric-badge ${health.status === "ok" ? "green" : "red"}`}>
                                {health.status === "ok" ? "ONLINE" : "DEGRADED"}
                            </span>
                        </div>

                        <div className="metric-hero">
                            <span className="hero-number">{health.service || "music-sync"}</span>
                        </div>

                        <div className="metric-subchips">
                            <span className="chip muted">Version: 1.0.0</span>
                            <span className="chip muted">Env: {health.environment || "production"}</span>
                        </div>
                    </div>

                    {/* PostgreSQL Database Health Card */}
                    <div className="metric-card">
                        <div className="metric-header">
                            <div className="metric-title">
                                <Database className="metric-icon green" size={18} />
                                <span>PostgreSQL DB</span>
                            </div>
                            <span className={`metric-badge ${health.database === "ok" ? "green" : "red"}`}>
                                {health.database === "ok" ? "CONNECTED" : "DISCONNECTED"}
                            </span>
                        </div>

                        <div className="metric-hero">
                            <span className="hero-number">{health.database === "ok" ? "Healthy" : "Error"}</span>
                        </div>

                        <div className="metric-subchips">
                            <span className="chip warning">PostgreSQL 17</span>
                            <span className="chip muted">Port 5432</span>
                        </div>
                    </div>

                    {/* Environment Info Card */}
                    <div className="metric-card">
                        <div className="metric-header">
                            <div className="metric-title">
                                <ShieldCheck className="metric-icon purple" size={18} />
                                <span>Security & Environment</span>
                            </div>
                            <span className="metric-badge blue">ACTIVE</span>
                        </div>

                        <div className="config-grid">
                            <div className="config-item">
                                <span className="config-label">Service</span>
                                <span className="config-val">{health.service}</span>
                            </div>
                            <div className="config-item">
                                <span className="config-label">Environment</span>
                                <span className="config-val">{health.environment}</span>
                            </div>
                            <div className="config-item">
                                <span className="config-label">CORS</span>
                                <span className="config-val">Enabled</span>
                            </div>
                            <div className="config-item">
                                <span className="config-label">Status</span>
                                <span className="config-val">{health.status}</span>
                            </div>
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
}

export default SystemHealth;