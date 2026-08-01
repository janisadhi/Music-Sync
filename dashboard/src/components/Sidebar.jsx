import { NavLink } from "react-router-dom";

function Sidebar() {
    const getNavClass = ({ isActive }) =>
        `nav-item ${isActive ? "active" : ""}`;

    return (
        <aside className="sidebar">

            <div className="brand">

                <div className="brand-icon">
                    ♪
                </div>

                <div>
                    <div className="brand-title">
                        Music Sync
                    </div>

                    <div className="brand-subtitle">
                        Dashboard
                    </div>
                </div>

            </div>

            <nav className="sidebar-nav">

                <NavLink
                    to="/"
                    end
                    className={getNavClass}
                >
                    <span className="nav-icon">
                        ▦
                    </span>

                    Dashboard
                </NavLink>

                <NavLink
                    to="/playlists"
                    className={getNavClass}
                >
                    <span className="nav-icon">
                        ☷
                    </span>

                    Playlists
                </NavLink>

                <NavLink
                    to="/songs"
                    className={getNavClass}
                >
                    <span className="nav-icon">
                        ♫
                    </span>

                    Songs
                </NavLink>

                <NavLink
                    to="/history"
                    className={getNavClass}
                >
                    <span className="nav-icon">
                        ◷
                    </span>

                    Sync History
                </NavLink>

                <NavLink
                    to="/settings"
                    className={getNavClass}
                >
                    <span className="nav-icon">
                        ⚙
                    </span>

                    Settings
                </NavLink>

                <NavLink
                    to="/health"
                    className={getNavClass}
                >
                    <span className="nav-icon">
                        ♡
                    </span>

                    System Health
                </NavLink>

            </nav>

            <div className="sidebar-footer">

                <div className="online-dot" />

                <div>
                    <strong>
                        Music Sync v1.0.0
                    </strong>

                    <span>
                        © 2026
                    </span>
                </div>

            </div>

        </aside>
    );
}

export default Sidebar;