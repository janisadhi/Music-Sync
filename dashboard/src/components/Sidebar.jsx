import { NavLink, useNavigate } from "react-router-dom";
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

function Sidebar() {
    const navigate = useNavigate();
    const user = getUser();

    const getNavClass = ({ isActive }) =>
        `nav-item ${isActive ? "active" : ""}`;

    const handleLogout = () => {
        logout();
        navigate("/login");
    };

    return (
        <aside className="sidebar">
            <div className="brand">
                <div className="brand-icon">
                    <Music size={22} color="#ffffff" />
                </div>
                <div>
                    <div className="brand-title">Music Sync</div>
                    <div className="brand-subtitle">Dashboard Engine</div>
                </div>
            </div>

            <nav className="sidebar-nav">
                <NavLink to="/" end className={getNavClass}>
                    <LayoutDashboard className="nav-icon" size={18} />
                    <span>Dashboard</span>
                </NavLink>

                <NavLink to="/playlists" className={getNavClass}>
                    <ListMusic className="nav-icon" size={18} />
                    <span>Playlists</span>
                </NavLink>

                <NavLink to="/songs" className={getNavClass}>
                    <Music className="nav-icon" size={18} />
                    <span>Songs Catalog</span>
                </NavLink>

                <NavLink to="/metadata" className={getNavClass}>
                    <Sparkles className="nav-icon" size={18} />
                    <span>Metadata</span>
                </NavLink>

                <NavLink to="/history" className={getNavClass}>
                    <History className="nav-icon" size={18} />
                    <span>Sync History</span>
                </NavLink>

                <NavLink to="/settings" className={getNavClass}>
                    <Settings className="nav-icon" size={18} />
                    <span>Settings</span>
                </NavLink>

                <NavLink to="/health" className={getNavClass}>
                    <Activity className="nav-icon" size={18} />
                    <span>System Health</span>
                </NavLink>
            </nav>

            <div className="sidebar-footer" style={{ flexDirection: "column", gap: "12px", alignItems: "stretch" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <div style={{
                            width: "28px",
                            height: "28px",
                            borderRadius: "50%",
                            backgroundColor: "rgba(255,255,255,0.15)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "#ffffff"
                        }}>
                            <User size={15} />
                        </div>
                        <div style={{ display: "flex", flexDirection: "column" }}>
                            <strong style={{ fontSize: "13px", color: "#ffffff", lineHeight: "1.2" }}>{user?.username || "admin"}</strong>
                            <span style={{ fontSize: "11px", color: "#94a3b8" }}>Administrator</span>
                        </div>
                    </div>

                    <button
                        onClick={handleLogout}
                        title="Sign Out"
                        style={{
                            background: "transparent",
                            border: "none",
                            color: "#94a3b8",
                            cursor: "pointer",
                            padding: "6px",
                            borderRadius: "6px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center"
                        }}
                    >
                        <LogOut size={16} />
                    </button>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "8px", paddingTop: "8px", borderTop: "1px solid rgba(255,255,255,0.1)" }}>
                    <div className="online-dot" />
                    <div>
                        <strong style={{ fontSize: "12px", display: "block", color: "#e2e8f0" }}>Music Sync v1.0.0</strong>
                        <span style={{ fontSize: "11px", color: "#94a3b8" }}>System Online</span>
                    </div>
                </div>
            </div>
        </aside>
    );
}

export default Sidebar;