import { useState } from "react";
import { CheckSquare, FileText, RotateCcw, Sparkles, Square, X, AlertCircle } from "lucide-react";
import { useSongSelection } from "../context/SongSelectionContext";
import { batchRetryDownload, batchRetryLyrics, batchRetryEnrichedLyrics } from "../services/songs";
import "../styles/selectionActionBar.css";

function RetryConfirmModal({ operation, selectedSongs, onClose, onSuccess }) {
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);

    const isEnrichedLyrics = operation === "enriched_lyrics";
    const isLyrics = operation === "lyrics" || isEnrichedLyrics;
    const songCount = selectedSongs.length;
    const previewSongs = selectedSongs.slice(0, 3);
    const remainingCount = songCount - previewSongs.length;

    const handleConfirm = async () => {
        try {
            setSubmitting(true);
            setError(null);
            const songIds = selectedSongs.map((s) => s.id);
            const res = isEnrichedLyrics
                ? await batchRetryEnrichedLyrics(songIds)
                : isLyrics
                ? await batchRetryLyrics(songIds)
                : await batchRetryDownload(songIds);

            onSuccess({
                operation,
                queued: res.queued,
                skipped: res.skipped,
                total: res.total,
            });
            onClose();
        } catch (err) {
            setError(err.response?.data?.detail || `Failed to enqueue ${isLyrics ? "lyrics" : "download"} retry.`);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div
            className="selection-modal-overlay"
            onMouseDown={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div className="selection-confirm-modal">
                <div className="modal-header">
                    <h2>{isEnrichedLyrics ? "Retry Enriched Lyrics?" : isLyrics ? "Retry Lyrics Download?" : "Retry Songs Download?"}</h2>
                    <button type="button" className="modal-close-btn" onClick={onClose}>
                        <X size={18} />
                    </button>
                </div>

                <div className="modal-body">
                    <p className="modal-intro">
                        {isEnrichedLyrics ? (
                            <>
                                You are about to retry lyrics search for <strong>{songCount} selected song(s)</strong> using their updated/enriched Beets metadata (canonical title, artist, album).
                            </>
                        ) : isLyrics ? (
                            <>
                                You are about to retry lyrics lookup for <strong>{songCount} selected song(s)</strong>.
                            </>
                        ) : (
                            <>
                                You are about to retry downloading <strong>{songCount} selected song(s)</strong>.
                            </>
                        )}
                    </p>

                    <div className="selected-preview-box">
                        <strong>Selected Tracks Preview:</strong>
                        <ul>
                            {previewSongs.map((s) => (
                                <li key={s.id}>
                                    <span className="track-title-preview">{s.title || s.raw_title || "Unknown Track"}</span>
                                    {s.artist && <span className="track-artist-preview"> - {s.artist}</span>}
                                </li>
                            ))}
                        </ul>
                        {remainingCount > 0 && <span className="more-count">+ {remainingCount} more song(s)</span>}
                    </div>

                    <div className="modal-bullets">
                        {isLyrics ? (
                            <ul>
                                <li>Lookup uses current enriched metadata (title, artist, album).</li>
                                <li>Processed asynchronously in the background.</li>
                                <li>Replaces or creates .lrc lyrics file next to audio file.</li>
                            </ul>
                        ) : (
                            <ul>
                                <li>Download jobs will be queued for selected songs.</li>
                                <li>Processed asynchronously by downloader workers.</li>
                            </ul>
                        )}
                    </div>

                    {error && (
                        <div className="modal-error-banner">
                            <AlertCircle size={16} />
                            <span>{error}</span>
                        </div>
                    )}
                </div>

                <div className="modal-actions">
                    <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>
                        Cancel
                    </button>
                    <button type="button" className="btn btn-primary" onClick={handleConfirm} disabled={submitting}>
                        {submitting ? "Enqueueing..." : isEnrichedLyrics ? "Confirm & Fetch Enriched Lyrics" : isLyrics ? "Confirm & Retry Lyrics" : "Confirm & Retry Download"}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function SelectionActionBar({ visibleSongs = [], onNotification }) {
    const { selectedSongIds, clearSelection, isAllSelected, toggleSelectAll } = useSongSelection();
    const [confirmModal, setConfirmModal] = useState(null); // null | "lyrics" | "enriched_lyrics" | "download"

    if (!selectedSongIds || selectedSongIds.length === 0) {
        return null;
    }

    // Find song objects for selected IDs
    const selectedSongs = visibleSongs.filter((s) => selectedSongIds.includes(s.id));
    const count = selectedSongIds.length;
    const allSelected = isAllSelected(visibleSongs);

    const handleSuccess = ({ operation, queued, skipped }) => {
        clearSelection();
        const opName = operation === "enriched_lyrics" ? "Enriched lyrics retry" : operation === "lyrics" ? "Retry lyrics" : "Download retry";
        let message = `${opName} queued for ${queued} song(s).`;
        if (skipped > 0) {
            message += ` (${skipped} skipped - already processing or uneligible).`;
        }
        if (onNotification) {
            onNotification({ type: "success", text: message });
        }
    };

    return (
        <>
            <div className="selection-action-bar-floating">
                <div className="action-bar-left">
                    <span className="selection-count-pill">{count} selected</span>
                    {visibleSongs.length > 0 && (
                        <button
                            type="button"
                            className="select-all-btn"
                            onClick={() => toggleSelectAll(visibleSongs)}
                        >
                            {allSelected ? <CheckSquare size={14} /> : <Square size={14} />}
                            <span>{allSelected ? "Deselect All Visible" : "Select All Visible"}</span>
                        </button>
                    )}
                </div>

                <div className="action-bar-right">
                    <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => setConfirmModal("enriched_lyrics")}
                        title="Search and replace lyrics using enriched metadata"
                        style={{ background: "rgba(16, 185, 129, 0.15)", color: "#10b981", borderColor: "rgba(16, 185, 129, 0.3)" }}
                    >
                        <Sparkles size={14} /> Retry Enriched Lyrics
                    </button>
                    <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => setConfirmModal("lyrics")}
                        title="Retry lyrics using metadata"
                    >
                        <FileText size={14} /> Retry Lyrics
                    </button>
                    <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => setConfirmModal("download")}
                        title="Retry downloading selected songs"
                    >
                        <RotateCcw size={14} /> Retry Download
                    </button>
                    <button
                        type="button"
                        className="btn btn-ghost btn-sm clear-btn"
                        onClick={clearSelection}
                        title="Clear selection"
                    >
                        <X size={15} />
                    </button>
                </div>
            </div>

            {confirmModal && (
                <RetryConfirmModal
                    operation={confirmModal}
                    selectedSongs={selectedSongs.length > 0 ? selectedSongs : selectedSongIds.map((id) => ({ id, title: `Song #${id}` }))}
                    onClose={() => setConfirmModal(null)}
                    onSuccess={handleSuccess}
                />
            )}
        </>
    );
}
