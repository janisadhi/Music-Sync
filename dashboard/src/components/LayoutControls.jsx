import { Grid2X2, Grid3X3, LayoutGrid, List, Menu } from "lucide-react";
import "../styles/layoutControls.css";

export const LAYOUT_MODES = {
    LARGE_GRID: "large_grid",
    MEDIUM_GRID: "medium_grid",
    SMALL_GRID: "small_grid",
    LIST: "list",
    COMPACT: "compact",
};

export default function LayoutControls({ activeLayout, onChangeLayout }) {
    return (
        <div className="layout-controls-bar">
            <button
                type="button"
                className={`layout-btn ${activeLayout === LAYOUT_MODES.LARGE_GRID ? "active" : ""}`}
                onClick={() => onChangeLayout(LAYOUT_MODES.LARGE_GRID)}
                title="Large Grid"
            >
                <Grid2X2 size={16} />
                <span>Large</span>
            </button>
            <button
                type="button"
                className={`layout-btn ${activeLayout === LAYOUT_MODES.MEDIUM_GRID ? "active" : ""}`}
                onClick={() => onChangeLayout(LAYOUT_MODES.MEDIUM_GRID)}
                title="Medium Grid"
            >
                <LayoutGrid size={16} />
                <span>Grid</span>
            </button>
            <button
                type="button"
                className={`layout-btn ${activeLayout === LAYOUT_MODES.SMALL_GRID ? "active" : ""}`}
                onClick={() => onChangeLayout(LAYOUT_MODES.SMALL_GRID)}
                title="Small Grid"
            >
                <Grid3X3 size={16} />
                <span>Small</span>
            </button>
            <button
                type="button"
                className={`layout-btn ${activeLayout === LAYOUT_MODES.LIST ? "active" : ""}`}
                onClick={() => onChangeLayout(LAYOUT_MODES.LIST)}
                title="List View"
            >
                <List size={16} />
                <span>List</span>
            </button>
            <button
                type="button"
                className={`layout-btn ${activeLayout === LAYOUT_MODES.COMPACT ? "active" : ""}`}
                onClick={() => onChangeLayout(LAYOUT_MODES.COMPACT)}
                title="Compact List View"
            >
                <Menu size={16} />
                <span>Compact</span>
            </button>
        </div>
    );
}
