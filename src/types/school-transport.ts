/**
 * School Transport Type Definitions
 * 
 * These types extend the FleetOps models to support school-specific functionality
 */

export interface Student {
    id: string;
    uuid: string;
    student_id: string;
    first_name: string;
    last_name: string;
    grade: string;
    photo_url?: string;
    parent_name?: string;
    parent_phone?: string;
    parent_email?: string;
    emergency_contact_name?: string;
    emergency_contact_phone?: string;
    special_needs?: string;
    medical_notes?: string;
    pickup_location?: Location;
    dropoff_location?: Location;
    assigned_seat?: string;
    status: 'active' | 'inactive' | 'transferred';
    created_at: string;
    updated_at: string;
}

export interface Location {
    id: string;
    uuid: string;
    name: string;
    address: string;
    latitude: number;
    longitude: number;
    type: 'school' | 'home' | 'stop';
    notes?: string;
}

export interface SchoolRoute {
    id: string;
    uuid: string;
    route_number: string;
    route_name: string;
    school_id: string;
    school_name: string;
    vehicle_id: string;
    driver_id: string;
    route_type: 'morning' | 'afternoon' | 'midday' | 'special';
    scheduled_start_time: string;
    scheduled_end_time: string;
    estimated_duration: number; // in minutes
    total_distance: number; // in meters
    stops: RouteStop[];
    students: Student[];
    status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface RouteStop {
    id: string;
    uuid: string;
    sequence: number;
    location: Location;
    scheduled_time: string;
    actual_arrival_time?: string;
    actual_departure_time?: string;
    students: Student[];
    stop_type: 'pickup' | 'dropoff' | 'both';
    notes?: string;
    is_completed: boolean;
}

export interface StudentAttendance {
    id: string;
    uuid: string;
    student_id: string;
    student: Student;
    route_id: string;
    stop_id: string;
    attendance_type: 'pickup' | 'dropoff';
    status: 'present' | 'absent' | 'no_show' | 'parent_pickup';
    timestamp: string;
    location?: {
        latitude: number;
        longitude: number;
    };
    photo_url?: string;
    notes?: string;
    recorded_by: string;
    parent_notified: boolean;
    created_at: string;
}

export interface PreTripInspection {
    id: string;
    uuid: string;
    vehicle_id: string;
    driver_id: string;
    inspection_date: string;
    status: 'passed' | 'failed' | 'needs_attention';
    checklist_items: InspectionItem[];
    odometer_reading?: number;
    fuel_level?: number;
    notes?: string;
    signature?: string;
    photos?: string[];
    created_at: string;
    updated_at: string;
}

export interface InspectionItem {
    id: string;
    category: 'safety' | 'mechanical' | 'interior' | 'exterior';
    item_name: string;
    description: string;
    status: 'pass' | 'fail' | 'na';
    notes?: string;
    photo_url?: string;
    is_required: boolean;
}

export interface SchoolZone {
    id: string;
    uuid: string;
    school_id: string;
    name: string;
    center_latitude: number;
    center_longitude: number;
    radius: number; // in meters
    speed_limit: number; // in mph or kph
    active_hours: {
        start: string; // HH:mm format
        end: string;
    }[];
    days_active: number[]; // 0-6, Sunday-Saturday
    is_active: boolean;
}

export interface ParentNotification {
    id: string;
    uuid: string;
    student_id: string;
    parent_contact: string;
    notification_type: 'pickup_approaching' | 'pickup_complete' | 'dropoff_approaching' | 'dropoff_complete' | 'delay' | 'emergency';
    message: string;
    sent_at: string;
    delivery_status: 'pending' | 'sent' | 'delivered' | 'failed';
    read_at?: string;
}

