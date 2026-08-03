import { useEffect, useState } from "react";
import "../styles/settings.css";
import api from "../services/api";

function Settings() {
    const [settings, setSettings] = useState({
        sync_interval_seconds: 60,
        download_limit: 1,
        lyrics_limit: 1,
        max_download_retries: 3,
        download_retry_delay_seconds: 5,
        download_directory: "",
    });

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [openingDirectory, setOpeningDirectory] =
        useState(false);

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
            console.error(
                "Failed to load settings:",
                err
            );

            setError(
                "Unable to load application settings."
            );
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

    async function handleSubmit(event) {
        event.preventDefault();

        try {
            setSaving(true);
            setMessage("");
            setError("");

            const response = await api.patch(
                "/settings",
                {
                    sync_interval_seconds:
                        settings.sync_interval_seconds,

                    download_limit:
                        settings.download_limit,

                    lyrics_limit:
                        settings.lyrics_limit,

                    max_download_retries:
                        settings.max_download_retries,

                    download_retry_delay_seconds:
                        settings.download_retry_delay_seconds,
                }
            );

            setSettings(response.data);

            setMessage(
                "Settings saved successfully."
            );
        } catch (err) {
            console.error(
                "Failed to save settings:",
                err
            );

            setError(
                err.response?.data?.detail ||
                    "Unable to save settings."
            );
        } finally {
            setSaving(false);
        }
    }

    async function handleOpenDownloadDirectory() {
        try {
            setOpeningDirectory(true);
            setMessage("");
            setError("");

            await api.post(
                "/settings/open-download-directory"
            );

            setMessage(
                "Download directory opened."
            );
        } catch (err) {
            console.error(
                "Failed to open download directory:",
                err
            );

            setError(
                err.response?.data?.detail ||
                    "Unable to open download directory."
            );
        } finally {
            setOpeningDirectory(false);
        }
    }

    if (loading) {
        return (
            <section className="card">
                <div className="card-header">
                    <div className="card-icon blue">
                        ⚙
                    </div>

                    <h2>Settings</h2>
                </div>

                <p className="text-muted">
                    Loading settings...
                </p>
            </section>
        );
    }

    return (
        <section className="card">
            <div className="card-header">
                <div className="card-icon blue">
                    ⚙
                </div>

                <h2>Settings</h2>
            </div>

            <form onSubmit={handleSubmit}>
                {/* Synchronization */}
                <div className="settings-section">
                    <h3>Synchronization</h3>

                    <div className="form-group">
                        <label htmlFor="sync_interval_seconds">
                            Sync interval
                        </label>

                        <input
                            id="sync_interval_seconds"
                            name="sync_interval_seconds"
                            type="number"
                            min="10"
                            value={
                                settings.sync_interval_seconds
                            }
                            onChange={handleChange}
                        />

                        <p className="text-muted">
                            How often the application checks
                            the YouTube playlist.
                        </p>
                    </div>

                    <div className="form-group">
                        <label htmlFor="download_limit">
                            Downloads per sync
                        </label>

                        <input
                            id="download_limit"
                            name="download_limit"
                            type="number"
                            min="1"
                            value={
                                settings.download_limit
                            }
                            onChange={handleChange}
                        />

                        <p className="text-muted">
                            Maximum number of songs downloaded
                            during one synchronization cycle.
                        </p>
                    </div>

                    <div className="form-group">
                        <label htmlFor="lyrics_limit">
                            Lyrics per sync
                        </label>

                        <input
                            id="lyrics_limit"
                            name="lyrics_limit"
                            type="number"
                            min="1"
                            value={
                                settings.lyrics_limit
                            }
                            onChange={handleChange}
                        />

                        <p className="text-muted">
                            Maximum number of songs processed
                            for lyrics during one synchronization
                            cycle.
                        </p>
                    </div>

                    <div className="form-group">
                        <label htmlFor="max_download_retries">
                            Maximum download retries
                        </label>

                        <input
                            id="max_download_retries"
                            name="max_download_retries"
                            type="number"
                            min="1"
                            value={
                                settings.max_download_retries
                            }
                            onChange={handleChange}
                        />

                        <p className="text-muted">
                            Maximum number of times a failed
                            download will be retried.
                        </p>
                    </div>

                    <div className="form-group">
                        <label htmlFor="download_retry_delay_seconds">
                            Download retry delay
                        </label>

                        <input
                            id="download_retry_delay_seconds"
                            name="download_retry_delay_seconds"
                            type="number"
                            min="1"
                            value={
                                settings.download_retry_delay_seconds
                            }
                            onChange={handleChange}
                        />

                        <p className="text-muted">
                            Number of seconds to wait before
                            retrying a failed download.
                        </p>
                    </div>
                </div>

                {/* Download Directory */}
                <div className="settings-section">
                    <h3>Downloads</h3>

                    <div className="form-group">
                        <label>
                            Download directory
                        </label>

                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "12px",
                            }}
                        >
                            <input
                                type="text"
                                value={
                                    settings.download_directory ||
                                    "~/MusicSync"
                                }
                                readOnly
                                style={{
                                    flex: 1,
                                }}
                            />

                            <button
                                type="button"
                                className="button secondary"
                                onClick={
                                    handleOpenDownloadDirectory
                                }
                                disabled={
                                    openingDirectory
                                }
                            >
                                {openingDirectory
                                    ? "Opening..."
                                    : "Open Directory"}
                            </button>
                        </div>

                        <p className="text-muted">
                            Location where downloaded music
                            files are stored. This directory
                            is managed by Docker and cannot be
                            changed from the dashboard.
                        </p>
                    </div>
                </div>

                {message && (
                    <p className="settings-success">
                        {message}
                    </p>
                )}

                {error && (
                    <p className="settings-error">
                        {error}
                    </p>
                )}

                <button
                    type="submit"
                    disabled={saving}
                    className="button primary"
                >
                    {saving
                        ? "Saving..."
                        : "Save Settings"}
                </button>
            </form>
        </section>
    );
}

export default Settings;