import { useEffect, useState } from "react";
import {
    AlertCircle,
    CheckCircle2,
    Clock,
    Download,
    FileText,
    RefreshCw,
    RotateCcw,
    Save,
    Settings as SettingsIcon,
    Sliders,
    Zap,
} from "lucide-react";
import api from "../services/api";
import "../styles/settings.css";

function Settings() {
    const [settings, setSettings] = useState({
        sync_interval_seconds: 60,
        download_limit: 1,
        lyrics_limit: 1,
        max_download_retries: 3,
        download_retry_delay_seconds: 5,
        auto_start_scheduler: false,
    });

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");

    useEffect(() => {
        loadSettings();
    }, []);

    async function loadSettings() {
        try {
            setLoading(true);
            setError("");
            const response = await api.get("/settings");
            setSettings(response.data);
        } catch (err) {
            console.error("Failed to load settings:", err);
            setError("Unable to load application settings.");
        } finally {
            setLoading(false);
        }
    }

    function handleChange(event) {
        const { name, value } = event.target;
        setSettings((current) => ({
            ...current,
            [name]: Number(value),
        }));
        setMessage("");
        setError("");
    }

    function handleCheckboxChange(event) {
        const { name, checked } = event.target;
        setSettings((current) => ({
            ...current,
            [name]: checked,
        }));
        setMessage("");
        setError("");
    }

    async function handleSubmit(event) {
        event.preventDefault();

        try {
            setSaving(true);
            setMessage("");
            setError("");

            const response = await api.patch("/settings", {
                sync_interval_seconds: settings.sync_interval_seconds,
                download_limit: settings.download_limit,
                lyrics_limit: settings.lyrics_limit,
                max_download_retries: settings.max_download_retries,
                download_retry_delay_seconds: settings.download_retry_delay_seconds,
                auto_start_scheduler: settings.auto_start_scheduler,
            });

            setSettings(response.data);
            setMessage("Settings saved successfully.");
        } catch (err) {
            console.error("Failed to save settings:", err);
            setError(err.response?.data?.detail || "Unable to save settings.");
        } finally {
            setSaving(false);
        }
    }

    if (loading) {
        return (
            <div className="settings-loading-screen">
                <RefreshCw className="spin-icon" size={32} />
                <p>Loading application settings...</p>
            </div>
        );
    }

    return (
        <div className="settings-container">
            {/* Header */}
            <header className="settings-header">
                <div>
                    <h1>System Settings</h1>
                    <p className="subtitle">
                        Configure synchronization frequencies, concurrency limits, and retry policies.
                    </p>
                </div>
                <button className="btn btn-secondary" onClick={loadSettings} disabled={saving}>
                    <RefreshCw size={15} /> Reset
                </button>
            </header>

            {/* Notification Alerts */}
            {message && (
                <div className="settings-alert-banner alert-success">
                    <CheckCircle2 size={18} />
                    <span>{message}</span>
                </div>
            )}

            {error && (
                <div className="settings-alert-banner alert-error">
                    <AlertCircle size={18} />
                    <span>{error}</span>
                </div>
            )}

            <form onSubmit={handleSubmit} className="settings-form-layout">
                {/* Section 1: Automation & Startup */}
                <div className="settings-card">
                    <div className="card-section-header">
                        <Zap size={20} className="section-icon blue" />
                        <div>
                            <h3>Automation & Startup</h3>
                            <p>Control automatic background task execution on system boot.</p>
                        </div>
                    </div>

                    <div className="setting-row toggle-row">
                        <div className="setting-info">
                            <label htmlFor="auto_start_scheduler" className="setting-label">
                                Auto-start Scheduler on Startup
                            </label>
                            <p className="setting-desc">
                                Automatically start background playlist synchronization when the docker container launches. If disabled, synchronization must be started manually using the Start Scheduler button.
                            </p>
                        </div>

                        <label className="toggle-switch">
                            <input
                                id="auto_start_scheduler"
                                name="auto_start_scheduler"
                                type="checkbox"
                                checked={Boolean(settings.auto_start_scheduler)}
                                onChange={handleCheckboxChange}
                            />
                            <span className="slider round"></span>
                        </label>
                    </div>
                </div>

                {/* Section 2: Frequency & Schedule */}
                <div className="settings-card">
                    <div className="card-section-header">
                        <Clock size={20} className="section-icon green" />
                        <div>
                            <h3>Sync Frequency</h3>
                            <p>Set how often Music Sync checks YouTube playlists for new tracks.</p>
                        </div>
                    </div>

                    <div className="setting-row">
                        <div className="setting-info">
                            <label htmlFor="sync_interval_seconds" className="setting-label">
                                Sync Interval (seconds)
                            </label>
                            <p className="setting-desc">
                                Duration in seconds between automated synchronization loops. (Minimum: 10s)
                            </p>
                        </div>
                        <div className="input-with-unit">
                            <input
                                id="sync_interval_seconds"
                                name="sync_interval_seconds"
                                type="number"
                                min="10"
                                value={settings.sync_interval_seconds}
                                onChange={handleChange}
                            />
                            <span className="unit-tag">sec</span>
                        </div>
                    </div>
                </div>

                {/* Section 3: Concurrency & Processing Limits */}
                <div className="settings-card">
                    <div className="card-section-header">
                        <Sliders size={20} className="section-icon purple" />
                        <div>
                            <h3>Concurrency Limits</h3>
                            <p>Limit workload per synchronization cycle to optimize bandwidth and CPU.</p>
                        </div>
                    </div>

                    <div className="setting-row">
                        <div className="setting-info">
                            <label htmlFor="download_limit" className="setting-label">
                                Downloads per Sync Cycle
                            </label>
                            <p className="setting-desc">
                                Maximum number of audio tracks downloaded during a single sync execution.
                            </p>
                        </div>
                        <div className="input-with-unit">
                            <input
                                id="download_limit"
                                name="download_limit"
                                type="number"
                                min="1"
                                value={settings.download_limit}
                                onChange={handleChange}
                            />
                            <span className="unit-tag">tracks</span>
                        </div>
                    </div>

                    <div className="setting-row">
                        <div className="setting-info">
                            <label htmlFor="lyrics_limit" className="setting-label">
                                Lyrics per Sync Cycle
                            </label>
                            <p className="setting-desc">
                                Maximum number of track lyrics processed during a single sync execution.
                            </p>
                        </div>
                        <div className="input-with-unit">
                            <input
                                id="lyrics_limit"
                                name="lyrics_limit"
                                type="number"
                                min="1"
                                value={settings.lyrics_limit}
                                onChange={handleChange}
                            />
                            <span className="unit-tag">lyrics</span>
                        </div>
                    </div>
                </div>

                {/* Section 4: Retry & Recovery Policy */}
                <div className="settings-card">
                    <div className="card-section-header">
                        <RotateCcw size={20} className="section-icon orange" />
                        <div>
                            <h3>Retry Policy</h3>
                            <p>Configure automatic recovery settings for network timeouts or download errors.</p>
                        </div>
                    </div>

                    <div className="setting-row">
                        <div className="setting-info">
                            <label htmlFor="max_download_retries" className="setting-label">
                                Maximum Download Retries
                            </label>
                            <p className="setting-desc">
                                Maximum retry attempts allowed before marking a download as failed.
                            </p>
                        </div>
                        <div className="input-with-unit">
                            <input
                                id="max_download_retries"
                                name="max_download_retries"
                                type="number"
                                min="1"
                                value={settings.max_download_retries}
                                onChange={handleChange}
                            />
                            <span className="unit-tag">attempts</span>
                        </div>
                    </div>

                    <div className="setting-row">
                        <div className="setting-info">
                            <label htmlFor="download_retry_delay_seconds" className="setting-label">
                                Download Retry Delay
                            </label>
                            <p className="setting-desc">
                                Time to wait in seconds before attempting a failed track download again.
                            </p>
                        </div>
                        <div className="input-with-unit">
                            <input
                                id="download_retry_delay_seconds"
                                name="download_retry_delay_seconds"
                                type="number"
                                min="1"
                                value={settings.download_retry_delay_seconds}
                                onChange={handleChange}
                            />
                            <span className="unit-tag">sec</span>
                        </div>
                    </div>
                </div>

                {/* Save Bar */}
                <div className="settings-save-footer">
                    <button type="submit" disabled={saving} className="btn btn-primary btn-lg">
                        <Save size={18} />
                        {saving ? "Saving Changes..." : "Save Settings"}
                    </button>
                </div>
            </form>
        </div>
    );
}

export default Settings;