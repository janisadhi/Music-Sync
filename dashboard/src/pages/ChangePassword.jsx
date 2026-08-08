import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, CheckCircle2, KeyRound, Lock, ShieldAlert } from "lucide-react";
import { changePassword } from "../services/auth";
import "../styles/auth.css";

function ChangePassword() {
    const navigate = useNavigate();
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setSuccess("");

        if (!currentPassword || !newPassword || !confirmPassword) {
            setError("All fields are required.");
            return;
        }

        if (newPassword.length < 4) {
            setError("New password must be at least 4 characters long.");
            return;
        }

        if (newPassword !== confirmPassword) {
            setError("New password and confirm password do not match.");
            return;
        }

        if (currentPassword === newPassword) {
            setError("New password must be different from your current default password.");
            return;
        }

        try {
            setLoading(true);
            await changePassword(currentPassword, newPassword);
            setSuccess("Password changed successfully! Redirecting to dashboard...");
            setTimeout(() => {
                navigate("/");
            }, 1500);
        } catch (err) {
            console.error("Failed to change password:", err);
            setError(err.response?.data?.detail || "Failed to update password.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-page-container">
            <div className="auth-card">
                <div className="auth-header">
                    <div className="auth-brand-avatar warning">
                        <ShieldAlert size={28} />
                    </div>
                    <h1>Change Default Password</h1>
                    <p className="subtitle">
                        For security reasons, you must change your default login password before proceeding.
                    </p>
                </div>

                {success && (
                    <div className="auth-alert-banner alert-success">
                        <CheckCircle2 size={18} />
                        <span>{success}</span>
                    </div>
                )}

                {error && (
                    <div className="auth-alert-banner">
                        <AlertCircle size={18} />
                        <span>{error}</span>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="auth-form">
                    <div className="form-group">
                        <label htmlFor="currentPassword">Current Default Password</label>
                        <div className="input-icon-wrapper">
                            <Lock size={18} className="input-left-icon" />
                            <input
                                id="currentPassword"
                                type="password"
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                placeholder="Default password (e.g. admin)"
                                required
                                autoFocus
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label htmlFor="newPassword">New Password</label>
                        <div className="input-icon-wrapper">
                            <KeyRound size={18} className="input-left-icon" />
                            <input
                                id="newPassword"
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                placeholder="Enter secure new password"
                                required
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label htmlFor="confirmPassword">Confirm New Password</label>
                        <div className="input-icon-wrapper">
                            <KeyRound size={18} className="input-left-icon" />
                            <input
                                id="confirmPassword"
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="Re-enter new password"
                                required
                            />
                        </div>
                    </div>

                    <button type="submit" className="btn btn-primary btn-auth-submit" disabled={loading}>
                        {loading ? "Updating Password..." : "Update Password & Continue"}
                    </button>
                </form>
            </div>
        </div>
    );
}

export default ChangePassword;
