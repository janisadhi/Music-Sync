import { useEffect, useState } from "react";
import api from "../services/api";
import "../styles/dashboard.css";

function StatusBadge({ status }) {
    let className = "badge";

    if (status === "success") {
        className += " badge-success";
    } else if (status === "failed") {
        className += " badge-danger";
    } else if (status === "running") {
        className += " badge-info";
    } else {
        className += " badge-neutral";
    }

    return (
        <span className={className}>
            {status || "N/A"}
        </span>
    );
}

function formatDate(date) {
    if (!date) {
        return "N/A";
    }

    return new Date(date).toLocaleString();
}

function calculateDuration(started, completed) {
    if (!started || !completed) {
        return "-";
    }

    const start =
        new Date(started).getTime();

    const end =
        new Date(completed).getTime();

    const duration =
        (end - start) / 1000;

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

            const response =
                await api.get("/dashboard");

            setSyncs(
                response.data.recent_syncs || []
            );
        } catch (err) {
            console.error(
                "Failed to fetch sync history:",
                err
            );

            setError(
                "Unable to load synchronization history."
            );
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchHistory();

        const timer = setInterval(
            fetchHistory,
            5000
        );

        return () => clearInterval(timer);
    }, []);

    return (
        <section className="card history-card">
            <div className="card-header">
                <div className="card-icon blue">
                    ◷
                </div>

                <div>
                    <h2>Sync History</h2>

                    <p className="card-subtitle">
                        Recent synchronization activity
                    </p>
                </div>
            </div>

            {loading ? (
                <div className="empty-state">
                    Loading synchronization history...
                </div>
            ) : error ? (
                <div className="alert alert-error">
                    {error}
                </div>
            ) : syncs.length === 0 ? (
                <div className="empty-state">
                    No synchronization history available.
                </div>
            ) : (
                <div className="table-wrapper">
                    <table>
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Status</th>
                                <th>Started At</th>
                                <th>Completed At</th>
                                <th>Duration</th>
                                <th>Error</th>
                            </tr>
                        </thead>

                        <tbody>
                            {syncs.map(
                                (sync, index) => (
                                    <tr
                                        key={
                                            sync.id ||
                                            index
                                        }
                                    >
                                        <td>
                                            {index + 1}
                                        </td>

                                        <td>
                                            <StatusBadge
                                                status={
                                                    sync.status
                                                }
                                            />
                                        </td>

                                        <td>
                                            {formatDate(
                                                sync.started_at
                                            )}
                                        </td>

                                        <td>
                                            {formatDate(
                                                sync.completed_at
                                            )}
                                        </td>

                                        <td>
                                            {calculateDuration(
                                                sync.started_at,
                                                sync.completed_at
                                            )}
                                        </td>

                                        <td className="error-cell">
                                            {sync.error ||
                                                "-"}
                                        </td>
                                    </tr>
                                )
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {!loading && !error && (
                <div className="table-footer">
                    Showing {syncs.length} sync
                    {syncs.length !== 1
                        ? "s"
                        : ""}
                </div>
            )}
        </section>
    );
}

export default SyncHistory;