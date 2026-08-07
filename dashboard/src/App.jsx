import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import DashboardLayout from "./layouts/DashboardLayout";

import Dashboard from "./pages/Dashboard";
import Songs from "./pages/Songs";
import Playlists from "./pages/Playlists";
import PlaylistDetailPage from "./pages/PlaylistDetailPage";
import SyncHistory from "./pages/SyncHistory";
import Settings from "./pages/Settings";
import SystemHealth from "./pages/SystemHealth";

function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route element={<DashboardLayout />}>
                    <Route
                        path="/"
                        element={<Dashboard />}
                    />

                    <Route
                        path="/songs"
                        element={<Songs />}
                    />

                    <Route
                        path="/playlists"
                        element={<Playlists />}
                    />

                    <Route
                        path="/playlists/:playlistId/detail"
                        element={<PlaylistDetailPage />}
                    />

                    <Route
                        path="/history"
                        element={<SyncHistory />}
                    />

                    <Route
                        path="/settings"
                        element={<Settings />}
                    />

                    <Route
                        path="/health"
                        element={<SystemHealth />}
                    />
                </Route>

                <Route
                    path="*"
                    element={
                        <Navigate
                            to="/"
                            replace
                        />
                    }
                />
            </Routes>
        </BrowserRouter>
    );
}

export default App;