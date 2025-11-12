import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import Config from 'react-native-config';

interface SchoolTransportConfig {
    districtName: string;
    districtId: string;
    features: {
        studentAttendance: boolean;
        parentNotifications: boolean;
        schoolZoneAlerts: boolean;
        preTripInspection: boolean;
        emergencyContacts: boolean;
    };
    safety: {
        schoolZoneSpeedLimit: number;
        enableSpeedWarnings: boolean;
    };
    branding: {
        logoUrl?: string;
        primaryColor: string;
        secondaryColor: string;
    };
}

interface SchoolTransportContextType {
    config: SchoolTransportConfig;
    updateConfig: (updates: Partial<SchoolTransportConfig>) => void;
    isFeatureEnabled: (feature: keyof SchoolTransportConfig['features']) => boolean;
}

const defaultConfig: SchoolTransportConfig = {
    districtName: Config.SCHOOL_DISTRICT_NAME || 'School District',
    districtId: Config.SCHOOL_DISTRICT_ID || '',
    features: {
        studentAttendance: Config.ENABLE_STUDENT_ATTENDANCE === 'true',
        parentNotifications: Config.ENABLE_PARENT_NOTIFICATIONS === 'true',
        schoolZoneAlerts: Config.ENABLE_SCHOOL_ZONE_ALERTS === 'true',
        preTripInspection: Config.ENABLE_PRE_TRIP_INSPECTION === 'true',
        emergencyContacts: Config.ENABLE_EMERGENCY_CONTACTS === 'true',
    },
    safety: {
        schoolZoneSpeedLimit: parseInt(Config.SCHOOL_ZONE_SPEED_LIMIT || '25', 10),
        enableSpeedWarnings: Config.ENABLE_SPEED_WARNINGS === 'true',
    },
    branding: {
        logoUrl: Config.SCHOOL_LOGO_URL,
        primaryColor: Config.SCHOOL_PRIMARY_COLOR || '#1E40AF',
        secondaryColor: Config.SCHOOL_SECONDARY_COLOR || '#3B82F6',
    },
};

const SchoolTransportContext = createContext<SchoolTransportContextType | undefined>(undefined);

export const SchoolTransportProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [config, setConfig] = useState<SchoolTransportConfig>(defaultConfig);

    const updateConfig = (updates: Partial<SchoolTransportConfig>) => {
        setConfig((prev) => ({
            ...prev,
            ...updates,
            features: {
                ...prev.features,
                ...(updates.features || {}),
            },
            safety: {
                ...prev.safety,
                ...(updates.safety || {}),
            },
            branding: {
                ...prev.branding,
                ...(updates.branding || {}),
            },
        }));
    };

    const isFeatureEnabled = (feature: keyof SchoolTransportConfig['features']): boolean => {
        return config.features[feature] || false;
    };

    return (
        <SchoolTransportContext.Provider value={{ config, updateConfig, isFeatureEnabled }}>
            {children}
        </SchoolTransportContext.Provider>
    );
};

export const useSchoolTransport = (): SchoolTransportContextType => {
    const context = useContext(SchoolTransportContext);
    if (!context) {
        throw new Error('useSchoolTransport must be used within a SchoolTransportProvider');
    }
    return context;
};

export default SchoolTransportContext;

