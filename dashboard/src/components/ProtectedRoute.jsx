import { Navigate, Outlet, useLocation } from "react-router-dom";
import { getUser, isAuthenticated } from "../services/auth";

function ProtectedRoute() {
    const location = useLocation();
    const authenticated = isAuthenticated();
    const user = getUser();

    if (!authenticated) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    // Force first-time password change
    if (user?.must_change_password && location.pathname !== "/change-password") {
        return <Navigate to="/change-password" replace />;
    }

    return <Outlet />;
}

export default ProtectedRoute;
