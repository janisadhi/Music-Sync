
import { useEffect, useState } from "react";
import api from "../services/api";

function Dashboard() {
    const [status, setStatus] = useState(null);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [interval, setIntervalValue] = useState(60);
    const [message, setMessage] = useState(null);

    const fetchStatus = async () => {
        try {
            const response = await api.get("/sync/status");

            setStatus(response.data);

            if (!actionLoading) {
                setIntervalValue(response.data.interval_seconds);
            }
        } catch (error) {
            console.error("Failed to fetch sync status:", error);

            setMessage({
                type: "error",
                text: "Unable to connect to the Music Sync API.",
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStatus();

        const timer = setInterval(fetchStatus, 5000);

        return () => clearInterval(timer);
    }, []);

    const syncNow = async () => {
        try {
            setSyncing(true);
            setMessage(null);

            const response = await api.post("/sync");

            setMessage({
                type: "success",
                text:
                    response.data?.message ||
                    "Synchronization started.",
            });

            await fetchStatus();
        } catch (error) {
            setMessage({
                type: "error",
                text:
                    error.response?.data?.detail ||
                    "Failed to start synchronization.",
            });
        } finally {
            setSyncing(false);
        }
    };

    const startScheduler = async () => {
        try {
            setActionLoading(true);
            setMessage(null);

            const response = await api.post(
                "/sync/scheduler/start"
            );

            setMessage({
                type: "success",
                text:
                    response.data?.message ||
                    "Scheduler started.",
            });

            await fetchStatus();
        } catch (error) {
            setMessage({
                type: "error",
                text:
                    error.response?.data?.detail ||
                    "Failed to start scheduler.",
            });
        } finally {
            setActionLoading(false);
        }
    };

    const stopScheduler = async () => {
        try {
            setActionLoading(true);
            setMessage(null);

            const response = await api.post(
                "/sync/scheduler/stop"
            );

            setMessage({
                type: "success",
                text:
                    response.data?.message ||
                    "Scheduler stopped.",
            });

            await fetchStatus();
        } catch (error) {
            setMessage({
                type: "error",
                text:
                    error.response?.data?.detail ||
                    "Failed to stop scheduler.",
            });
        } finally {
            setActionLoading(false);
        }
    };

    const updateInterval = async () => {
        const seconds = Number(interval);

        if (!Number.isFinite(seconds) || seconds < 10) {
            setMessage({
                type: "error",
                text: "Interval must be at least 10 seconds.",
            });

            return;
        }

        try {
            setActionLoading(true);
            setMessage(null);

            const response = await api.patch(
                "/sync/scheduler",
                {
                    seconds,
                }
            );

            setMessage({
                type: "success",
                text: `Interval updated to ${response.data.interval_minutes} minutes.`,
            });

            await fetchStatus();
        } catch (error) {
            setMessage({
                type: "error",
                text:
                    error.response?.data?.detail ||
                    "Failed to update interval.",
            });
        } finally {
            setActionLoading(false);
        }
    };

    const formatDate = (value) => {
        if (!value) {
            return "N/A";
        }

        return new Date(value).toLocaleString();
    };

    if (loading) {
        return (
            <main style={styles.page}>
                <h1>Music Sync Dashboard</h1>
                <p>Loading dashboard...</p>
            </main>
        );
    }

    return (
        <main style={styles.page}>
            <header style={styles.header}>
                <div>
                    <h1 style={styles.title}>
                        Music Sync Dashboard
                    </h1>

                    <p style={styles.subtitle}>
                        Monitor and control your music
                        synchronization service.
                    </p>
                </div>
            </header>

            {message && (
                <div
                    style={{
                        ...styles.message,
                        ...(message.type === "error"
                            ? styles.error
                            : styles.success),
                    }}
                >
                    {message.text}
                </div>
            )}

            <div style={styles.grid}>
                {/* Scheduler */}
                <section style={styles.card}>
                    <h2 style={styles.cardTitle}>
                        Scheduler
                    </h2>

                    <div style={styles.statusRow}>
                        <span>Status</span>

                        <strong>
                            {status?.scheduler_running
                                ? "Running"
                                : "Stopped"}
                        </strong>
                    </div>

                    <div style={styles.statusRow}>
                        <span>Sync</span>

                        <strong>
                            {status?.sync_running
                                ? "Running"
                                : "Idle"}
                        </strong>
                    </div>

                    <div style={styles.statusRow}>
                        <span>Interval</span>

                        <strong>
                            {status?.interval_minutes} minutes
                        </strong>
                    </div>

                    <div style={styles.actions}>
                        <button
                            onClick={startScheduler}
                            disabled={
                                actionLoading ||
                                status?.scheduler_running
                            }
                            style={styles.primaryButton}
                        >
                            {actionLoading
                                ? "Working..."
                                : "Start Scheduler"}
                        </button>

                        <button
                            onClick={stopScheduler}
                            disabled={
                                actionLoading ||
                                !status?.scheduler_running
                            }
                            style={styles.secondaryButton}
                        >
                            Stop Scheduler
                        </button>
                    </div>
                </section>

                {/* Manual Sync */}
                <section style={styles.card}>
                    <h2 style={styles.cardTitle}>
                        Synchronization
                    </h2>

                    <div style={styles.syncStatus}>
                        <span>Current Status</span>

                        <strong>
                            {status?.sync_running
                                ? "Running"
                                : "Idle"}
                        </strong>
                    </div>

                    <button
                        onClick={syncNow}
                        disabled={
                            syncing ||
                            status?.sync_running
                        }
                        style={styles.primaryButton}
                    >
                        {status?.sync_running
                            ? "Sync Running..."
                            : syncing
                            ? "Starting..."
                            : "Sync Now"}
                    </button>
                </section>

                {/* Interval */}
                <section style={styles.card}>
                    <h2 style={styles.cardTitle}>
                        Sync Interval
                    </h2>

                    <p style={styles.description}>
                        Configure how often the scheduler
                        performs synchronization.
                    </p>

                    <div style={styles.inputGroup}>
                        <input
                            type="number"
                            min="10"
                            value={interval}
                            onChange={(event) =>
                                setIntervalValue(
                                    event.target.value
                                )
                            }
                            style={styles.input}
                            disabled={actionLoading}
                        />

                        <span>seconds</span>
                    </div>

                    <button
                        onClick={updateInterval}
                        disabled={actionLoading}
                        style={styles.primaryButton}
                    >
                        {actionLoading
                            ? "Updating..."
                            : "Update Interval"}
                    </button>
                </section>

                {/* Last Sync */}
                <section style={styles.card}>
                    <h2 style={styles.cardTitle}>
                        Last Sync
                    </h2>

                    <div style={styles.statusRow}>
                        <span>Status</span>

                        <strong>
                            {status?.last_sync_status ||
                                "N/A"}
                        </strong>
                    </div>

                    <div style={styles.statusRow}>
                        <span>Started</span>

                        <span>
                            {formatDate(
                                status?.last_sync_started_at
                            )}
                        </span>
                    </div>

                    <div style={styles.statusRow}>
                        <span>Completed</span>

                        <span>
                            {formatDate(
                                status?.last_sync_completed_at
                            )}
                        </span>
                    </div>

                    {status?.last_sync_error && (
                        <div style={styles.errorBox}>
                            <strong>Error</strong>
                            <p>
                                {status.last_sync_error}
                            </p>
                        </div>
                    )}
                </section>
            </div>
        </main>
    );
}

const styles = {
    page: {
        minHeight: "100vh",
        padding: "40px",
        background: "#f5f5f5",
        fontFamily:
            "Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
    },

    header: {
        marginBottom: "30px",
    },

    title: {
        margin: 0,
        fontSize: "32px",
    },

    subtitle: {
        marginTop: "8px",
        color: "#666",
    },

    grid: {
        display: "grid",
        gridTemplateColumns:
            "repeat(auto-fit, minmax(320px, 1fr))",
        gap: "20px",
    },

    card: {
        background: "#ffffff",
        border: "1px solid #ddd",
        borderRadius: "12px",
        padding: "24px",
        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.05)",
    },

    cardTitle: {
        marginTop: 0,
        marginBottom: "20px",
    },

    statusRow: {
        display: "flex",
        justifyContent: "space-between",
        gap: "20px",
        marginBottom: "14px",
    },

    syncStatus: {
        display: "flex",
        justifyContent: "space-between",
        marginBottom: "24px",
    },

    description: {
        color: "#666",
        lineHeight: "1.5",
    },

    actions: {
        display: "flex",
        gap: "10px",
        marginTop: "20px",
    },

    primaryButton: {
        padding: "10px 16px",
        border: "none",
        borderRadius: "6px",
        cursor: "pointer",
        background: "#111",
        color: "#fff",
    },

    secondaryButton: {
        padding: "10px 16px",
        border: "1px solid #ccc",
        borderRadius: "6px",
        cursor: "pointer",
        background: "#fff",
        color: "#111",
    },

    inputGroup: {
        display: "flex",
        alignItems: "center",
        gap: "8px",
        marginBottom: "16px",
    },

    input: {
        width: "120px",
        padding: "10px",
        border: "1px solid #ccc",
        borderRadius: "6px",
    },

    message: {
        padding: "12px 16px",
        marginBottom: "20px",
        borderRadius: "6px",
    },

    success: {
        background: "#e8f5e9",
        border: "1px solid #a5d6a7",
    },

    error: {
        background: "#ffebee",
        border: "1px solid #ef9a9a",
    },

    errorBox: {
        marginTop: "20px",
        padding: "12px",
        borderRadius: "6px",
        background: "#ffebee",
    },
};

export default Dashboard;
