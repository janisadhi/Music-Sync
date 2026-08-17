import { useEffect, useState } from "react";
import {
    Activity,
    AlertTriangle,
    Clock,
    Database,
    Layout,
    RefreshCw,
    Server,
    Sparkles,
} from "lucide-react";
import api from "../services/api";
import "../styles/systemHealth.css";

const SERVICE_ICONS = {
    backend: Server,
    frontend: Layout,
    metadata: Sparkles,
    database: Database,
};

export default function SystemHealth() {
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
            setError("Unable to connect to backend service.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchHealth();
        const timer = setInterval(fetchHealth, 5000);
        return () => clearInterval(timer);
    }, []);

    if (loading && !health) {
        return (
            <div className="health-page-container">
                <div className="health-loading">
                    <RefreshCw className="spin-icon" size={32} />
                    <p>Checking service health & uptime...</p>
                </div>
            </div>
        );
    }

    if (error && !health) {
        return (
            <div className="health-page-container">
                <div className="health-error-card">
                    <AlertTriangle size={40} style={{ color: "#ef4444" }} />
                    <h3>Health Check Failed</h3>
                    <p>{error}</p>
                    <button className="btn btn-primary" onClick={fetchHealth}>
                        <RefreshCw size={16} /> Retry
                    </button>
                </div>
            </div>
        );
    }

    const services = health?.services || {};

    return (
        <div className="health-page-container">
            {/* Header */}
            <header className="health-header">
                <div>
                    <h1>System Health & Status</h1>
                    <p className="subtitle">
                        Service status and uptime for Backend, Frontend, Metadata Service, and Database.
                    </p>
                </div>

                <div className="health-header-actions">
                    <button className="btn btn-secondary" onClick={fetchHealth}>
                        <RefreshCw size={15} /> Refresh
                    </button>
                </div>
            </header>

            {/* 4 Service Status Cards Grid */}
            <div className="clean-services-grid">
                {Object.entries(services).map(([key, service]) => {
                    const IconComponent = SERVICE_ICONS[key] || Activity;
                    const isRunning = service.status === "running";

                    return (
                        <div key={key} className={`simple-service-card ${isRunning ? "running" : "stopped"}`}>
                            <div className="card-top">
                                <div className={`icon-bubble ${key}`}>
                                    <IconComponent size={22} />
                                </div>
                                <span className={`status-pill ${isRunning ? "running" : "stopped"}`}>
                                    <span className="status-dot" />
                                    {isRunning ? "Running" : "Stopped"}
                                </span>
                            </div>

                            <div className="card-middle">
                                <h2>{service.name}</h2>
                            </div>

                            <div className="card-bottom">
                                <Clock size={16} className="clock-icon" />
                                <span className="uptime-label">Uptime:</span>
                                <span className="uptime-val">{service.uptime || "N/A"}</span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}