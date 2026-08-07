import { NavLink } from "react-router-dom";
import {
    Activity,
    History,
    LayoutDashboard,
    ListMusic,
    Music,
    Settings,
} from "lucide-react";

function Sidebar() {
    const getNavClass = ({ isActive }) =>
        `nav-item ${isActive ? "active" : ""}`;

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

            <div className="sidebar-footer">
                <div className="online-dot" />
                <div>
                    <strong>Music Sync v1.0.0</strong>
                    <span>System Online</span>
                </div>
            </div>
        </aside>
    );
}

export default Sidebar;