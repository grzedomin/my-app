import React, { useState } from "react";
import { migratePredictionsToSportCollections } from "@/lib/migrate-predictions";
import { useNotification } from "@/context/NotificationContext";

const MigratePredictionsPanel: React.FC = () => {
    const { showNotification } = useNotification();
    const [isMigrating, setIsMigrating] = useState(false);
    const [progressMessage, setProgressMessage] = useState("");
    const [progressPercent, setProgressPercent] = useState(0);

    const handleMigratePredictions = async () => {
        if (isMigrating) return;

        if (!window.confirm(
            "This will migrate all predictions from the 'predictions' collection to sport-specific collections (tennis and table-tennis). " +
            "This process cannot be undone. Are you sure you want to continue?"
        )) {
            return;
        }

        setIsMigrating(true);
        setProgressMessage("Starting migration...");
        setProgressPercent(0);

        try {
            const result = await migratePredictionsToSportCollections((message, percent) => {
                setProgressMessage(message);
                setProgressPercent(percent);
            });

            if (result.success) {
                showNotification(result.message, "success");
            } else {
                showNotification(result.message, "error");
            }
        } catch (error) {
            console.error("Error during migration:", error);
            showNotification(
                `Migration failed: ${error instanceof Error ? error.message : String(error)}`,
                "error"
            );
        } finally {
            setIsMigrating(false);
        }
    };

    return (
        <div className="bg-gray-800 shadow overflow-hidden sm:rounded-lg border border-gray-700 mb-6">
            <div className="px-4 py-5 sm:px-6">
                <h3 className="text-lg leading-6 font-medium text-white">Database Migration</h3>
                <p className="mt-1 max-w-2xl text-sm text-gray-400">
                    Migrate predictions to sport-specific collections for better organization and performance.
                </p>
            </div>

            <div className="border-t border-gray-700 px-4 py-5 sm:p-6">
                <div className="space-y-6">
                    <div>
                        <h4 className="text-md font-medium text-gray-300">Migrate Predictions</h4>
                        <p className="text-sm text-gray-400 mt-1">
                            This will move all predictions from the single "predictions" collection to separate "tennis" and "table-tennis" collections.
                            This improves query performance and makes data management easier.
                        </p>
                    </div>

                    {isMigrating && (
                        <div className="mt-4">
                            <p className="text-sm text-gray-300 mb-2">{progressMessage}</p>
                            <div className="w-full bg-gray-700 rounded-full h-2.5">
                                <div
                                    className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                                    style={{ width: `${progressPercent}%` }}
                                ></div>
                            </div>
                        </div>
                    )}

                    <div>
                        <button
                            type="button"
                            onClick={handleMigratePredictions}
                            disabled={isMigrating}
                            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                            aria-label="Migrate predictions to sport-specific collections"
                        >
                            {isMigrating ? "Migrating..." : "Migrate Predictions"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MigratePredictionsPanel; 