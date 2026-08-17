import { Link, NavLink, useNavigate } from "react";
import {
    Activity,
    History,
    LayoutDashboard,
    ListMusic,
    LogOut,
    Music,
    Settings,
    Sparkles,
    User,
} from "lucide-react";
import { getUser, logout } from "../services/auth";
import "../styles/sidebar.css";

export default function Sidebar() {
    const navigate = useNavigate();
    const user = getUser();

    const handleLogout = () => {
        logout();
        navigate("/login");
    };

    return (
        <aside className="sidebar" aria-label="Main Navigation">
            {/* Brand Header */}
            <Link to="/" className="sidebar-brand" title="Music Sync Overview">
                <div className="brand-icon-bubble">
                    <Music size={22} color="#ffffff" />
                </div>
                <div className="brand-info">
                    <span className="brand-title">Music Sync</span>
                    <span className="brand-version-badge">v1.3.1 Engine</span>
                </div>
            </Link>

            {/* Structured Navigation Groups */}
            <nav className="sidebar-nav-container">
                <div className="nav-section">
                    <span className="nav-section-label">Library</span>
                    <NavLink
                        to="/"
                        end
                        className={({ isActive }) =>
                            `sidebar-nav-item ${isActive ? "active" : ""}`
                        }
                    >
                        <LayoutDashboard className="nav-icon" size={18} />
                        <span>Dashboard</span>
                    </NavLink>

                    <NavLink
                        to="/playlists"
                        className={({ isActive }) =>
                            `sidebar-nav-item ${isActive ? "active" : ""}`
                        }
                    >
                        <ListMusic className="nav-icon" size={18} />
                        <span>Playlists</span>
                    </NavLink>

                    <NavLink
                        to="/songs"
                        className={({ isActive }) =>
                            `sidebar-nav-item ${isActive ? "active" : ""}`
                        }
                    >
                        <Music className="nav-icon" size={18} />
                        <span>Songs Catalog</span>
                    </NavLink>

                    <NavLink
                        to="/metadata"
                        className={({ isActive }) =>
                            `sidebar-nav-item ${isActive ? "active" : ""}`
                        }
                    >
                        <Sparkles className="nav-icon" size={18} />
                        <span>Metadata</span>
                    </NavLink>
                </div>

                <div className="nav-section">
                    <span className="nav-section-label">System</span>
                    <NavLink
                        to="/history"
                        className={({ isActive }) =>
                            `sidebar-nav-item ${isActive ? "active" : ""}`
                        }
                    >
                        <History className="nav-icon" size={18} />
                        <span>Sync History</span>
                    </NavLink>

                    <NavLink
                        to="/settings"
                        className={({ isActive }) =>
                            `sidebar-nav-item ${isActive ? "active" : ""}`
                        }
                    >
                        <Settings className="nav-icon" size={18} />
                        <span>Settings</span>
                    </NavLink>

                    <NavLink
                        to="/health"
                        className={({ isActive }) =>
                            `sidebar-nav-item ${isActive ? "active" : ""}`
                        }
                    >
                        <Activity className="nav-icon" size={18} />
                        <span>System Health</span>
                    </NavLink>
                </div>
            </nav>

            {/* Footer Profile & Status */}
            <div className="sidebar-footer-card">
                <div className="user-profile-row">
                    <div className="user-avatar-circle" aria-hidden="true">
                        {(user?.username || "A").charAt(0).toUpperCase()}
                    </div>
                    <div className="user-details">
                        <span className="user-name">{user?.username || "administrator"}</span>
                        <span className="user-role">System Admin</span>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="logout-btn"
                        title="Sign Out"
                        aria-label="Sign Out"
                    >
                        <LogOut size={16} />
                    </button>
                </div>

                <div className="system-status-indicator">
                    <div className="status-dot-green" />
                    <span>System Operational</span>
                </div>
            </div>
        </aside>
    );
}