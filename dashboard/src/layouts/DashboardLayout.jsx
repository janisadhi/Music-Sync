import { Outlet } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import MiniPlayer from "../components/MiniPlayer";

function DashboardLayout() {
    return (
        <div className="dashboard-layout">
            <Sidebar />

            <main className="main-content" style={{ paddingBottom: "100px" }}>
                <Outlet />
            </main>

            <MiniPlayer />
        </div>
    );
}

export default DashboardLayout;
