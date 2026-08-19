import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { PlayerProvider } from "./context/PlayerContext";
import { SongSelectionProvider } from "./context/SongSelectionContext";

import DashboardLayout from "./layouts/DashboardLayout";
import ProtectedRoute from "./components/ProtectedRoute";

import Dashboard from "./pages/Dashboard";
import Songs from "./pages/Songs";
import Playlists from "./pages/Playlists";
import PlaylistDetailPage from "./pages/PlaylistDetailPage";
import SyncHistory from "./pages/SyncHistory";
import Settings from "./pages/Settings";
import SystemHealth from "./pages/SystemHealth";
import ResilioSync from "./pages/ResilioSync";
import Metadata from "./pages/Metadata";
import TrackDetail from "./pages/TrackDetail";
import Login from "./pages/Login";
import ChangePassword from "./pages/ChangePassword";
import SongDetailPage from "./pages/SongDetailPage";
import AlbumDetailPage from "./pages/AlbumDetailPage";
import ArtistDetailPage from "./pages/ArtistDetailPage";
import NowPlaying from "./pages/NowPlaying";

function App() {
    return (
        <BrowserRouter>
            <PlayerProvider>
                <SongSelectionProvider>
                    <Routes>
                        {/* Public Auth Routes */}
                        <Route path="/login" element={<Login />} />

                        {/* Protected Routes (requires token + forced password change check) */}
                        <Route element={<ProtectedRoute />}>
                            <Route path="/change-password" element={<ChangePassword />} />
                            <Route path="/now-playing" element={<NowPlaying />} />

                            <Route element={<DashboardLayout />}>
                                <Route path="/" element={<Dashboard />} />
                                <Route path="/songs" element={<Songs />} />
                                <Route path="/songs/:songId/detail" element={<SongDetailPage />} />
                                <Route path="/albums/:albumName" element={<AlbumDetailPage />} />
                                <Route path="/artists/:artistName" element={<ArtistDetailPage />} />
                                <Route path="/playlists" element={<Playlists />} />
                                <Route path="/playlists/:playlistId/detail" element={<PlaylistDetailPage />} />
                                <Route path="/metadata" element={<Metadata />} />
                                <Route path="/metadata/tracks/:id" element={<TrackDetail />} />
                                <Route path="/history" element={<SyncHistory />} />
                                <Route path="/rslsync" element={<ResilioSync />} />
                                <Route path="/settings" element={<Settings />} />
                                <Route path="/health" element={<SystemHealth />} />
                            </Route>
                        </Route>

                        <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                </SongSelectionProvider>
            </PlayerProvider>
        </BrowserRouter>
    );
}

export default App;