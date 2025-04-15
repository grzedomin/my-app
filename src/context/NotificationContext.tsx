"use client"
import React, { createContext, useState, useContext, useCallback } from "react";

type NotificationType = "success" | "error" | "info" | "warning";

interface Notification {
    id: string;
    message: string;
    type: NotificationType;
    duration?: number;
}

interface NotificationContextType {
    notifications: Notification[];
    showNotification: (message: string, type?: NotificationType, duration?: number) => void;
    dismissNotification: (id: string) => void;
}

const NotificationContext = createContext<NotificationContextType>({
    notifications: [],
    showNotification: () => { },
    dismissNotification: () => { },
});

export const useNotification = () => useContext(NotificationContext);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({
    children,
}) => {
    const [notifications, setNotifications] = useState<Notification[]>([]);

    // Function to dismiss a notification
    const dismissNotification = useCallback((id: string) => {
        setNotifications((prev) => prev.filter((notification) => notification.id !== id));
    }, []);

    // Function to add a notification
    const showNotification = useCallback(
        (message: string, type: NotificationType = "info", duration = 5000) => {
            // Generate a truly unique ID (timestamp + random string)
            const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            const notification: Notification = {
                id,
                message,
                type,
                duration,
            };

            setNotifications((prev) => [...prev, notification]);

            // Auto-dismiss after duration
            if (duration > 0) {
                setTimeout(() => {
                    dismissNotification(id);
                }, duration);
            }
        },
        [dismissNotification]
    );

    // Value for the context provider
    const contextValue = {
        notifications,
        showNotification,
        dismissNotification,
    };

    return (
        <NotificationContext.Provider value={contextValue}>
            {children}
            <NotificationContainer />
        </NotificationContext.Provider>
    );
};

// Component to render notifications
const NotificationContainer: React.FC = () => {
    const { notifications, dismissNotification } = useContext(NotificationContext);

    if (notifications.length === 0) return null;

    return (
        <div className="fixed top-0 right-0 p-4 z-50 space-y-3 max-w-sm">
            {notifications.map((notification) => (
                <div
                    key={notification.id}
                    className={`rounded-md p-4 shadow-lg transition-all duration-300 animate-fade-in ${getBackgroundColor(
                        notification.type
                    )}`}
                >
                    <div className="flex items-start">
                        <div className="flex-shrink-0">{getIcon(notification.type)}</div>
                        <div className="ml-3 flex-1">
                            <p className={`text-sm font-medium ${getTextColor(notification.type)}`}>
                                {notification.message}
                            </p>
                        </div>
                        <div className="ml-4 flex-shrink-0 flex">
                            <button
                                className={`inline-flex rounded-md ${getTextColor(
                                    notification.type
                                )} focus:outline-none`}
                                onClick={() => dismissNotification(notification.id)}
                            >
                                <span className="sr-only">Close</span>
                                <svg
                                    className="h-5 w-5"
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 20 20"
                                    fill="currentColor"
                                >
                                    <path
                                        fillRule="evenodd"
                                        d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                                        clipRule="evenodd"
                                    />
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};

// Helper functions for styling
function getBackgroundColor(type: NotificationType): string {
    switch (type) {
        case "success":
            return "bg-green-50 border border-green-200";
        case "error":
            return "bg-red-50 border border-red-200";
        case "warning":
            return "bg-yellow-50 border border-yellow-200";
        case "info":
        default:
            return "bg-blue-50 border border-blue-200";
    }
}

function getTextColor(type: NotificationType): string {
    switch (type) {
        case "success":
            return "text-green-800";
        case "error":
            return "text-red-800";
        case "warning":
            return "text-yellow-800";
        case "info":
        default:
            return "text-blue-800";
    }
}

function getIcon(type: NotificationType): React.ReactElement {
    switch (type) {
        case "success":
            return (
                <svg
                    className="h-5 w-5 text-green-400"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                >
                    <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                    />
                </svg>
            );
        case "error":
            return (
                <svg
                    className="h-5 w-5 text-red-400"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                >
                    <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                        clipRule="evenodd"
                    />
                </svg>
            );
        case "warning":
            return (
                <svg
                    className="h-5 w-5 text-yellow-400"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                >
                    <path
                        fillRule="evenodd"
                        d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                        clipRule="evenodd"
                    />
                </svg>
            );
        case "info":
        default:
            return (
                <svg
                    className="h-5 w-5 text-blue-400"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                >
                    <path
                        fillRule="evenodd"
                        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                        clipRule="evenodd"
                    />
                </svg>
            );
    }
} 