import React, { useState, useEffect } from 'react';
import { Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Text, YStack, XStack, Button, ScrollView, useTheme, Image } from 'tamagui';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { 
    faQrcode, 
    faCamera, 
    faMapMarkerAlt, 
    faCheck, 
    faExclamationTriangle,
    faUser,
    faSchool,
    faClock
} from '@fortawesome/free-solid-svg-icons';
import { useLocation } from '../contexts/LocationContext';
import { useFleetbase } from '../contexts/FleetbaseContext';
import { config, toBoolean } from '../utils/config';
import useAppTheme from '../hooks/use-app-theme';

const WidgetContainer = ({ children, ...props }) => {
    const { isDarkMode } = useAppTheme();
    return (
        <YStack 
            borderRadius='$6' 
            bg='$surface' 
            padding='$4' 
            borderWidth={1} 
            borderColor={isDarkMode ? '$transparent' : '$gray-300'} 
            marginBottom='$4'
            {...props}
        >
            {children}
        </YStack>
    );
};

const StudentCard = ({ student, onCheckIn, onCheckOut, attendanceStatus }) => {
    const theme = useTheme();
    const isCheckedIn = attendanceStatus?.type === 'boarding';

    return (
        <WidgetContainer>
            <XStack space='$3' alignItems='center'>
                <YStack width={60} height={60} borderRadius='$4' bg='$gray-200' alignItems='center' justifyContent='center'>
                    {student.photo ? (
                        <Image source={{ uri: student.photo }} width={60} height={60} borderRadius='$4' />
                    ) : (
                        <FontAwesomeIcon icon={faUser} size={24} color={theme.textSecondary.val} />
                    )}
                </YStack>
                
                <YStack flex={1}>
                    <Text fontSize='$5' fontWeight='600' color='$textPrimary'>
                        {student.name}
                    </Text>
                    <XStack alignItems='center' space='$2'>
                        <FontAwesomeIcon icon={faSchool} size={12} color={theme.textSecondary.val} />
                        <Text fontSize='$3' color='$textSecondary'>
                            Grade {student.grade} • Stop #{student.stop_sequence}
                        </Text>
                    </XStack>
                    {attendanceStatus && (
                        <XStack alignItems='center' space='$2' marginTop='$1'>
                            <FontAwesomeIcon 
                                icon={isCheckedIn ? faCheck : faClock} 
                                size={12} 
                                color={isCheckedIn ? theme.successBorder.val : theme.warningBorder.val} 
                            />
                            <Text fontSize='$2' color={isCheckedIn ? '$successBorder' : '$warningBorder'}>
                                {isCheckedIn ? 'Checked In' : 'Pending Check-out'}
                            </Text>
                        </XStack>
                    )}
                </YStack>

                <YStack space='$2'>
                    {!isCheckedIn ? (
                        <Button 
                            size='$3' 
                            theme='blue' 
                            onPress={() => onCheckIn(student)}
                            disabled={attendanceStatus?.type === 'boarding'}
                        >
                            <FontAwesomeIcon icon={faCheck} size={16} color='white' />
                            <Text color='white' marginLeft='$2'>Check In</Text>
                        </Button>
                    ) : (
                        <Button 
                            size='$3' 
                            theme='orange' 
                            onPress={() => onCheckOut(student)}
                        >
                            <FontAwesomeIcon icon={faMapMarkerAlt} size={16} color='white' />
                            <Text color='white' marginLeft='$2'>Check Out</Text>
                        </Button>
                    )}
                </YStack>
            </XStack>
        </WidgetContainer>
    );
};

const StudentAttendanceScreen = () => {
    const theme = useTheme();
    const navigation = useNavigation();
    const { location } = useLocation();
    const { fleetbase } = useFleetbase();
    
    const [students, setStudents] = useState([]);
    const [attendanceRecords, setAttendanceRecords] = useState({});
    const [currentTrip, setCurrentTrip] = useState(null);
    const [loading, setLoading] = useState(true);

    // Feature flags from environment
    const photoVerificationEnabled = toBoolean(config('ENABLE_PHOTO_VERIFICATION', true));
    const geofenceEnabled = toBoolean(config('ENABLE_GEOFENCE_VERIFICATION', true));
    const parentNotificationsEnabled = toBoolean(config('ENABLE_PARENT_NOTIFICATIONS', true));

    useEffect(() => {
        loadTripAndStudents();
    }, []);

    const loadTripAndStudents = async () => {
        try {
            setLoading(true);
            
            // Get current active trip for the driver
            const tripsResponse = await fleetbase.get('/school-transport/trips', {
                params: {
                    status: 'active',
                    driver_uuid: fleetbase.currentUser?.uuid
                }
            });

            if (tripsResponse.data?.length > 0) {
                const trip = tripsResponse.data[0];
                setCurrentTrip(trip);

                // Load students for this trip/route
                const studentsResponse = await fleetbase.get(`/school-transport/trips/${trip.uuid}/students`);
                setStudents(studentsResponse.data || []);

                // Load existing attendance records for today
                const attendanceResponse = await fleetbase.get('/school-transport/attendance', {
                    params: {
                        trip_uuid: trip.uuid,
                        date: new Date().toISOString().split('T')[0]
                    }
                });

                // Create lookup for attendance records
                const attendanceLookup = {};
                attendanceResponse.data?.forEach(record => {
                    attendanceLookup[record.student_uuid] = record;
                });
                setAttendanceRecords(attendanceLookup);
            }
        } catch (error) {
            console.error('Error loading trip data:', error);
            Alert.alert('Error', 'Failed to load student information');
        } finally {
            setLoading(false);
        }
    };

    const handleCheckIn = async (student) => {
        if (!location) {
            Alert.alert('Location Required', 'GPS location is required for check-in');
            return;
        }

        try {
            const attendanceData = {
                student_uuid: student.uuid,
                trip_uuid: currentTrip?.uuid,
                type: 'boarding',
                timestamp: new Date().toISOString(),
                latitude: location.coords.latitude,
                longitude: location.coords.longitude
            };

            // If photo verification is enabled, we would capture photo here
            if (photoVerificationEnabled) {
                // TODO: Implement camera capture
                // For now, we'll skip photo requirement
            }

            const response = await fleetbase.post('/school-transport/attendance/record', attendanceData);
            
            // Update local state
            setAttendanceRecords(prev => ({
                ...prev,
                [student.uuid]: response.data
            }));

            Alert.alert('Success', `${student.name} checked in successfully`);

            // Send parent notification if enabled
            if (parentNotificationsEnabled && student.parent_contact) {
                await sendParentNotification(student, 'boarding');
            }

        } catch (error) {
            console.error('Error checking in student:', error);
            Alert.alert('Error', 'Failed to check in student');
        }
    };

    const handleCheckOut = async (student) => {
        if (!location) {
            Alert.alert('Location Required', 'GPS location is required for check-out');
            return;
        }

        try {
            const attendanceData = {
                student_uuid: student.uuid,
                trip_uuid: currentTrip?.uuid,
                type: 'exit',
                timestamp: new Date().toISOString(),
                latitude: location.coords.latitude,
                longitude: location.coords.longitude
            };

            const response = await fleetbase.post('/school-transport/attendance/record', attendanceData);
            
            // Update local state
            setAttendanceRecords(prev => ({
                ...prev,
                [student.uuid]: response.data
            }));

            Alert.alert('Success', `${student.name} checked out successfully`);

            // Send parent notification if enabled
            if (parentNotificationsEnabled && student.parent_contact) {
                await sendParentNotification(student, 'exit');
            }

        } catch (error) {
            console.error('Error checking out student:', error);
            Alert.alert('Error', 'Failed to check out student');
        }
    };

    const sendParentNotification = async (student, type) => {
        try {
            await fleetbase.post('/school-transport/communications/send-notification', {
                type: type === 'boarding' ? 'parent_pickup' : 'parent_dropoff',
                recipients: [student.parent_contact],
                message: `${student.name} has been ${type === 'boarding' ? 'picked up' : 'dropped off'} at ${new Date().toLocaleTimeString()}`,
                priority: 'normal'
            });
        } catch (error) {
            console.warn('Failed to send parent notification:', error);
        }
    };

    if (loading) {
        return (
            <YStack flex={1} bg='$background' justifyContent='center' alignItems='center'>
                <Text color='$textPrimary'>Loading students...</Text>
            </YStack>
        );
    }

    if (!currentTrip) {
        return (
            <YStack flex={1} bg='$background' justifyContent='center' alignItems='center' padding='$4'>
                <FontAwesomeIcon icon={faExclamationTriangle} size={48} color={theme.warningBorder.val} />
                <Text fontSize='$6' fontWeight='600' color='$textPrimary' textAlign='center' marginTop='$4'>
                    No Active Trip
                </Text>
                <Text fontSize='$4' color='$textSecondary' textAlign='center' marginTop='$2'>
                    Please start a trip to manage student attendance
                </Text>
                <Button theme='blue' marginTop='$4' onPress={() => navigation.navigate('DriverDashboard')}>
                    Go to Dashboard
                </Button>
            </YStack>
        );
    }

    return (
        <YStack flex={1} bg='$background'>
            <ScrollView>
                <YStack padding='$4'>
                    {/* Trip Header */}
                    <WidgetContainer>
                        <Text fontSize='$6' fontWeight='600' color='$textPrimary' marginBottom='$2'>
                            Route: {currentTrip.route?.name || 'Unknown'}
                        </Text>
                        <XStack justifyContent='space-between' alignItems='center'>
                            <XStack space='$2' alignItems='center'>
                                <FontAwesomeIcon icon={faSchool} size={16} color={theme.textSecondary.val} />
                                <Text color='$textSecondary'>
                                    {students.length} students • {Object.keys(attendanceRecords).length} checked in
                                </Text>
                            </XStack>
                            <Text fontSize='$3' color='$textSecondary'>
                                {new Date().toLocaleDateString()}
                            </Text>
                        </XStack>
                    </WidgetContainer>

                    {/* Students List */}
                    <Text fontSize='$5' fontWeight='600' color='$textPrimary' marginBottom='$3'>
                        Students ({students.length})
                    </Text>
                    
                    {students.length === 0 ? (
                        <WidgetContainer>
                            <YStack alignItems='center' justifyContent='center' padding='$6'>
                                <FontAwesomeIcon icon={faUser} size={32} color={theme.textSecondary.val} />
                                <Text fontSize='$4' color='$textSecondary' textAlign='center' marginTop='$3'>
                                    No students assigned to this route
                                </Text>
                            </YStack>
                        </WidgetContainer>
                    ) : (
                        students.map((student) => (
                            <StudentCard
                                key={student.uuid}
                                student={student}
                                attendanceStatus={attendanceRecords[student.uuid]}
                                onCheckIn={handleCheckIn}
                                onCheckOut={handleCheckOut}
                            />
                        ))
                    )}

                    {/* Quick Actions */}
                    <WidgetContainer>
                        <Text fontSize='$4' fontWeight='600' color='$textPrimary' marginBottom='$3'>
                            Quick Actions
                        </Text>
                        <XStack space='$3'>
                            <Button flex={1} size='$4' theme='gray' disabled>
                                <FontAwesomeIcon icon={faQrcode} size={16} />
                                <Text marginLeft='$2'>QR Scan</Text>
                            </Button>
                            <Button flex={1} size='$4' theme='gray' disabled>
                                <FontAwesomeIcon icon={faCamera} size={16} />
                                <Text marginLeft='$2'>Photo ID</Text>
                            </Button>
                        </XStack>
                    </WidgetContainer>
                </YStack>
            </ScrollView>
        </YStack>
    );
};

export default StudentAttendanceScreen;