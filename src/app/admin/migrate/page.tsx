"use client";

import React, { useState } from "react";
import { migrateExcelFilesToFirestore } from "@/lib/migrate-excel-data";
import { migratePredictionsToBetTypeCollections } from "@/lib/migrate-bet-types";
import AdminOnly from "@/components/AdminOnly";

export default function MigratePage() {
    const [isProcessing, setIsProcessing] = useState(false);
    const [log, setLog] = useState<string[]>([]);
    const [progress, setProgress] = useState(0);

    const handleMigrateExcelFiles = async () => {
        if (isProcessing) return;

        setIsProcessing(true);
        setLog(["Starting Excel file migration..."]);
        setProgress(0);

        try {
            const result = await migrateExcelFilesToFirestore((message, percentage) => {
                setLog(prev => [...prev, message]);
                if (percentage) setProgress(percentage);
            });

            setLog(prev => [...prev, `Migration completed: ${result.message}`]);
            setLog(prev => [...prev, `Processed ${result.processedCount} files.`]);
        } catch (error) {
            setLog(prev => [...prev, `Error: ${error instanceof Error ? error.message : String(error)}`]);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleMigrateBetTypes = async () => {
        if (isProcessing) return;

        setIsProcessing(true);
        setLog(["Starting bet type migration..."]);
        setProgress(0);

        try {
            const result = await migratePredictionsToBetTypeCollections((message, percentage) => {
                setLog(prev => [...prev, message]);
                if (percentage) setProgress(percentage);
            });

            setLog(prev => [...prev, `Migration completed: ${result.message}`]);
        } catch (error) {
            setLog(prev => [...prev, `Error: ${error instanceof Error ? error.message : String(error)}`]);
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <AdminOnly>
            <div className="p-6 bg-gray-900 text-white min-h-screen">
                <h1 className="text-2xl font-semibold mb-6">Data Migration Tools</h1>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-gray-800 p-6 rounded-lg shadow-md">
                        <h2 className="text-xl font-medium mb-4">Excel File Migration</h2>
                        <p className="text-sm text-gray-300 mb-4">
                            This process will scan all uploaded Excel files and populate the appropriate Firestore collections
                            (tennis, tennis-spread, tennis-kelly, table-tennis, table-tennis-kelly) based on file names and content.
                        </p>
                        <button
                            onClick={handleMigrateExcelFiles}
                            disabled={isProcessing}
                            className={`px-4 py-2 rounded-md font-medium ${isProcessing ? "bg-blue-700" : "bg-blue-600 hover:bg-blue-700"
                                } text-white mb-4 w-full`}
                        >
                            {isProcessing ? "Processing..." : "Migrate Excel Files"}
                        </button>
                    </div>

                    <div className="bg-gray-800 p-6 rounded-lg shadow-md">
                        <h2 className="text-xl font-medium mb-4">Bet Type Migration</h2>
                        <p className="text-sm text-gray-300 mb-4">
                            This process will check existing predictions in default collections and migrate any specialized bet types
                            (spread, kelly) to their dedicated collections if needed.
                        </p>
                        <button
                            onClick={handleMigrateBetTypes}
                            disabled={isProcessing}
                            className={`px-4 py-2 rounded-md font-medium ${isProcessing ? "bg-blue-700" : "bg-blue-600 hover:bg-blue-700"
                                } text-white mb-4 w-full`}
                        >
                            {isProcessing ? "Processing..." : "Migrate Bet Types"}
                        </button>
                    </div>
                </div>

                {log.length > 0 && (
                    <div className="mt-6 bg-gray-800 p-4 rounded-lg">
                        <h3 className="text-lg font-medium mb-2">Migration Log</h3>
                        {isProcessing && (
                            <div className="w-full bg-gray-700 rounded-full mb-4">
                                <div
                                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                    style={{ width: `${progress}%` }}
                                ></div>
                            </div>
                        )}
                        <div className="bg-black p-4 rounded max-h-96 overflow-y-auto font-mono text-sm">
                            {log.map((entry, index) => (
                                <div key={index} className="mb-1">
                                    <span className="text-gray-400">[{new Date().toLocaleTimeString()}]</span> {entry}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </AdminOnly>
    );
} 