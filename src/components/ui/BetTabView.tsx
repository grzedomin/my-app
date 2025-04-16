import React from "react";

// Define bet view type
export type BetViewType = "normal" | "spread" | "kelly";

// Define component props
interface BetTabViewProps {
    selectedView: BetViewType;
    onViewChange: (view: BetViewType) => void;
    sportType: string;
    isLoading: boolean;
}

const BetTabView: React.FC<BetTabViewProps> = ({
    selectedView,
    onViewChange,
    sportType,
    isLoading
}) => {
    // Table tennis only supports normal and kelly views
    const isTableTennis = sportType === "table-tennis";

    return (
        <div className="mb-4 sm:mb-6">
            <h3 className="block text-sm font-medium text-gray-300 mb-2">
                Bet View Type
            </h3>
            <div className="flex space-x-2">
                <button
                    onClick={() => onViewChange("normal")}
                    className={`px-4 py-2 rounded-md flex items-center justify-center ${selectedView === "normal"
                        ? "bg-blue-600 text-white"
                        : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                        }`}
                    disabled={isLoading}
                >
                    <span>Normal Predictions</span>
                    {isLoading && selectedView === "normal" && (
                        <span className="ml-2 inline-block">
                            <div className="animate-spin h-4 w-4 border-2 border-white rounded-full border-t-transparent"></div>
                        </span>
                    )}
                </button>

                {!isTableTennis && (
                    <button
                        onClick={() => onViewChange("spread")}
                        className={`px-4 py-2 rounded-md flex items-center justify-center ${selectedView === "spread"
                            ? "bg-blue-600 text-white"
                            : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                            }`}
                        disabled={isLoading}
                    >
                        <span>Spread Value Bets</span>
                        {isLoading && selectedView === "spread" && (
                            <span className="ml-2 inline-block">
                                <div className="animate-spin h-4 w-4 border-2 border-white rounded-full border-t-transparent"></div>
                            </span>
                        )}
                    </button>
                )}

                <button
                    onClick={() => onViewChange("kelly")}
                    className={`px-4 py-2 rounded-md flex items-center justify-center ${selectedView === "kelly"
                        ? "bg-blue-600 text-white"
                        : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                        }`}
                    disabled={isLoading}
                >
                    <span>Kelly Value Bets</span>
                    {isLoading && selectedView === "kelly" && (
                        <span className="ml-2 inline-block">
                            <div className="animate-spin h-4 w-4 border-2 border-white rounded-full border-t-transparent"></div>
                        </span>
                    )}
                </button>
            </div>
        </div>
    );
};

export default BetTabView; 