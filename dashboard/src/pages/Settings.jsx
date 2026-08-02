import { useEffect, useState } from "react";
import "../styles/settings.css";
import api from "../services/api";

function Settings() {
    const [settings, setSettings] = useState({
        sync_interval_seconds: 60,
        download_limit: 1,
        lyrics_limit: 1,
        youtube_playlist_url: "",
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
            [name]:
                name === "youtube_playlist_url"
                    ? value
                    : Number(value),
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

                    youtube_playlist_url:
                        settings.youtube_playlist_url,
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
                </div>

                <div className="settings-section">
                    <h3>YouTube</h3>

                    <div className="form-group">
                        <label htmlFor="youtube_playlist_url">
                            Playlist URL
                        </label>

                        <input
                            id="youtube_playlist_url"
                            name="youtube_playlist_url"
                            type="url"
                            value={
                                settings.youtube_playlist_url ||
                                ""
                            }
                            onChange={handleChange}
                            placeholder="https://youtube.com/playlist?list=..."
                        />

                        <p className="text-muted">
                            YouTube playlist used by the
                            synchronization service.
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
