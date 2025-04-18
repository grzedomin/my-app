export interface BettingPrediction {
    date: string;
    team1: string;
    oddTeam1: number;
    team2: string;
    oddTeam2: number;
    scorePrediction: string;
    confidence: number;
    bettingPredictionTeam1Win: number;
    bettingPredictionTeam2Win: number;
    finalScore: string;
    sportType?: string;
    standardDate?: string;
    fileId?: string;
    sourceFile?: string;
    betType?: string;
    optimalStakePart?: number;
    betOn?: string;
    valuePercent?: number;
    id?: string;
}

export interface FileData {
    id: string;
    fileName: string;
    filePath: string;
    downloadUrl: string;
    contentType: string;
    uploadDate: number;
    userId: string;
    size: number;
    isPublic?: boolean;
    fileDate?: string;
    sportType?: string;
    betType?: string;
}

export type SubscriptionPlan = "monthly" | "yearly" | "none";

export interface Subscription {
    id: string;
    userId: string;
    plan: SubscriptionPlan;
    startDate: string;
    endDate: string;
    isActive: boolean;
    autoRenew: boolean;
} 