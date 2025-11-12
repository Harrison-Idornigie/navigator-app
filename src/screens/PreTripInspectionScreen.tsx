import React, { useState, useEffect } from 'react';
import { Alert, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Text, YStack, XStack, Button, ScrollView, useTheme, Checkbox, TextArea } from 'tamagui';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { 
    faClipboardCheck,
    faExclamationTriangle,
    faCheck,
    faTimes,
    faBus,
    faTools,
    faCamera,
    faFileAlt
} from '@fortawesome/free-solid-svg-icons';
import { useFleetbase } from '../contexts/FleetbaseContext';
import { useLocation } from '../contexts/LocationContext';
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

const InspectionItem = ({ item, onToggle, onAddNote }) => {
    const theme = useTheme();
    const [showNoteInput, setShowNoteInput] = useState(false);
    const [note, setNote] = useState(item.note || '');

    const handleToggle = (status) => {
        onToggle(item.id, status, note);
        if (status === 'fail') {
            setShowNoteInput(true);
        } else {
            setShowNoteInput(false);
        }
    };

    const handleNoteSubmit = () => {
        onAddNote(item.id, note);
        setShowNoteInput(false);
    };

    return (
        <WidgetContainer>
            <YStack space='$3'>
                <XStack justifyContent='space-between' alignItems='flex-start'>
                    <YStack flex={1} marginRight='$3'>
                        <Text fontSize='$4' fontWeight='600' color='$textPrimary'>
                            {item.title}
                        </Text>
                        <Text fontSize='$3' color='$textSecondary'>
                            {item.description}
                        </Text>
                        {item.status === 'fail' && item.note && (
                            <Text fontSize='$3' color='$warningBorder' marginTop='$2'>
                                Issue: {item.note}
                            </Text>
                        )}
                    </YStack>
                    
                    <XStack space='$2'>
                        <Button
                            size='$3'
                            theme={item.status === 'pass' ? 'green' : 'gray'}
                            onPress={() => handleToggle('pass')}
                            variant={item.status === 'pass' ? 'solid' : 'outlined'}
                        >
                            <FontAwesomeIcon 
                                icon={faCheck} 
                                size={16} 
                                color={item.status === 'pass' ? 'white' : theme.successBorder.val} 
                            />
                        </Button>
                        <Button
                            size='$3'
                            theme={item.status === 'fail' ? 'red' : 'gray'}
                            onPress={() => handleToggle('fail')}
                            variant={item.status === 'fail' ? 'solid' : 'outlined'}
                        >
                            <FontAwesomeIcon 
                                icon={faTimes} 
                                size={16} 
                                color={item.status === 'fail' ? 'white' : theme.errorBorder.val} 
                            />
                        </Button>
                    </XStack>
                </XStack>

                {(showNoteInput || (item.status === 'fail' && !item.note)) && (
                    <YStack space='$2'>
                        <Text fontSize='$3' color='$textPrimary'>
                            Describe the issue:
                        </Text>
                        <TextArea
                            placeholder="Enter details about the issue..."
                            value={note}
                            onChangeText={setNote}
                            maxLength={500}
                            numberOfLines={3}
                        />
                        <XStack space='$2'>
                            <Button size='$3' flex={1} theme='blue' onPress={handleNoteSubmit}>
                                Save Note
                            </Button>
                            <Button size='$3' flex={1} theme='gray' onPress={() => setShowNoteInput(false)}>
                                Cancel
                            </Button>
                        </XStack>
                    </YStack>
                )}
            </YStack>
        </WidgetContainer>
    );
};

const PreTripInspectionScreen = () => {
    const theme = useTheme();
    const navigation = useNavigation();
    const { fleetbase } = useFleetbase();
    const { location } = useLocation();
    
    const [vehicle, setVehicle] = useState(null);
    const [inspectionItems, setInspectionItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [inspectionStarted, setInspectionStarted] = useState(false);

    // Default inspection checklist
    const defaultInspectionItems = [
        { id: 'tires', title: 'Tires & Wheels', description: 'Check tire pressure, tread depth, and wheel condition', category: 'exterior' },
        { id: 'lights', title: 'Lights & Signals', description: 'Test headlights, taillights, brake lights, and turn signals', category: 'exterior' },
        { id: 'mirrors', title: 'Mirrors', description: 'Check all mirrors are clean and properly adjusted', category: 'exterior' },
        { id: 'stop_arm', title: 'Stop Sign Arm', description: 'Test stop sign arm extension and lights', category: 'exterior' },
        { id: 'emergency_exits', title: 'Emergency Exits', description: 'Verify emergency exits open and close properly', category: 'safety' },
        { id: 'first_aid', title: 'First Aid Kit', description: 'Check first aid kit is present and stocked', category: 'safety' },
        { id: 'fire_extinguisher', title: 'Fire Extinguisher', description: 'Verify fire extinguisher is present and charged', category: 'safety' },
        { id: 'seats', title: 'Passenger Seats', description: 'Check all seats are secure and in good condition', category: 'interior' },
        { id: 'dashboard', title: 'Dashboard & Controls', description: 'Test all gauges, warning lights, and controls', category: 'interior' },
        { id: 'radio', title: 'Two-Way Radio', description: 'Test communication with dispatch', category: 'interior' },
        { id: 'engine', title: 'Engine', description: 'Check oil level, coolant, and listen for unusual sounds', category: 'mechanical' },
        { id: 'brakes', title: 'Brakes', description: 'Test brake pedal feel and parking brake', category: 'mechanical' }
    ];

    useEffect(() => {
        loadVehicleAndInspection();
    }, []);

    const loadVehicleAndInspection = async () => {
        try {
            setLoading(true);
            
            // Get current assigned vehicle for the driver
            const vehicleResponse = await fleetbase.get('/fleetops/vehicles/assigned', {
                params: { driver_uuid: fleetbase.currentUser?.uuid }
            });

            if (vehicleResponse.data) {
                setVehicle(vehicleResponse.data);
                
                // Check if there's an existing inspection for today
                const today = new Date().toISOString().split('T')[0];
                const inspectionResponse = await fleetbase.get('/school-transport/inspections', {
                    params: {
                        vehicle_uuid: vehicleResponse.data.uuid,
                        date: today,
                        type: 'pre_trip'
                    }
                });

                if (inspectionResponse.data?.length > 0) {
                    // Load existing inspection
                    const existing = inspectionResponse.data[0];
                    setInspectionItems(existing.items || defaultInspectionItems.map(item => ({ ...item, status: 'pending' })));
                    setInspectionStarted(true);
                } else {
                    // Initialize new inspection
                    setInspectionItems(defaultInspectionItems.map(item => ({ ...item, status: 'pending' })));
                }
            }
        } catch (error) {
            console.error('Error loading vehicle data:', error);
            Alert.alert('Error', 'Failed to load vehicle information');
            setInspectionItems(defaultInspectionItems.map(item => ({ ...item, status: 'pending' })));
        } finally {
            setLoading(false);
        }
    };

    const handleItemToggle = (itemId, status, note = '') => {
        setInspectionItems(prev => 
            prev.map(item => 
                item.id === itemId 
                    ? { ...item, status, note, timestamp: new Date().toISOString() }
                    : item
            )
        );
    };

    const handleAddNote = (itemId, note) => {
        setInspectionItems(prev =>
            prev.map(item =>
                item.id === itemId
                    ? { ...item, note }
                    : item
            )
        );
    };

    const startInspection = () => {
        setInspectionStarted(true);
        // Could add analytics or tracking here
    };

    const submitInspection = async () => {
        if (!vehicle) {
            Alert.alert('Error', 'No vehicle assigned');
            return;
        }

        const pendingItems = inspectionItems.filter(item => item.status === 'pending');
        if (pendingItems.length > 0) {
            Alert.alert(
                'Incomplete Inspection',
                `You have ${pendingItems.length} items that haven't been checked. Please complete all items before submitting.`,
                [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Complete Later', onPress: saveDraft },
                    { text: 'Continue Anyway', onPress: forceSubmit }
                ]
            );
            return;
        }

        const failedItems = inspectionItems.filter(item => item.status === 'fail');
        if (failedItems.length > 0) {
            Alert.alert(
                'Failed Items Detected',
                `${failedItems.length} items failed inspection. The vehicle may not be safe to operate. Contact maintenance immediately.`,
                [
                    { text: 'Review Items', style: 'cancel' },
                    { text: 'Submit Anyway', onPress: forceSubmit, style: 'destructive' }
                ]
            );
            return;
        }

        await forceSubmit();
    };

    const forceSubmit = async () => {
        try {
            setSubmitting(true);
            
            const inspectionData = {
                vehicle_uuid: vehicle.uuid,
                driver_uuid: fleetbase.currentUser?.uuid,
                type: 'pre_trip',
                date: new Date().toISOString().split('T')[0],
                status: inspectionItems.every(item => item.status === 'pass') ? 'passed' : 'failed',
                items: inspectionItems,
                location: location ? {
                    latitude: location.coords.latitude,
                    longitude: location.coords.longitude
                } : null,
                completed_at: new Date().toISOString()
            };

            await fleetbase.post('/school-transport/inspections', inspectionData);
            
            Alert.alert(
                'Inspection Complete',
                'Pre-trip inspection has been submitted successfully.',
                [
                    { text: 'OK', onPress: () => navigation.goBack() }
                ]
            );

        } catch (error) {
            console.error('Error submitting inspection:', error);
            Alert.alert('Error', 'Failed to submit inspection');
        } finally {
            setSubmitting(false);
        }
    };

    const saveDraft = async () => {
        try {
            const inspectionData = {
                vehicle_uuid: vehicle.uuid,
                driver_uuid: fleetbase.currentUser?.uuid,
                type: 'pre_trip',
                date: new Date().toISOString().split('T')[0],
                status: 'in_progress',
                items: inspectionItems,
                location: location ? {
                    latitude: location.coords.latitude,
                    longitude: location.coords.longitude
                } : null
            };

            await fleetbase.post('/school-transport/inspections', inspectionData);
            Alert.alert('Draft Saved', 'Inspection progress has been saved');
            
        } catch (error) {
            console.error('Error saving draft:', error);
            Alert.alert('Error', 'Failed to save inspection draft');
        }
    };

    if (loading) {
        return (
            <YStack flex={1} bg='$background' justifyContent='center' alignItems='center'>
                <Text color='$textPrimary'>Loading vehicle information...</Text>
            </YStack>
        );
    }

    if (!vehicle) {
        return (
            <YStack flex={1} bg='$background' justifyContent='center' alignItems='center' padding='$4'>
                <FontAwesomeIcon icon={faBus} size={48} color={theme.textSecondary.val} />
                <Text fontSize='$6' fontWeight='600' color='$textPrimary' textAlign='center' marginTop='$4'>
                    No Vehicle Assigned
                </Text>
                <Text fontSize='$4' color='$textSecondary' textAlign='center' marginTop='$2'>
                    Please contact dispatch for vehicle assignment
                </Text>
                <Button theme='blue' marginTop='$4' onPress={() => navigation.goBack()}>
                    Go Back
                </Button>
            </YStack>
        );
    }

    const completedItems = inspectionItems.filter(item => item.status !== 'pending').length;
    const passedItems = inspectionItems.filter(item => item.status === 'pass').length;
    const failedItems = inspectionItems.filter(item => item.status === 'fail').length;

    return (
        <YStack flex={1} bg='$background'>
            <ScrollView>
                <YStack padding='$4'>
                    {/* Vehicle Header */}
                    <WidgetContainer>
                        <XStack justifyContent='space-between' alignItems='center'>
                            <YStack flex={1}>
                                <Text fontSize='$6' fontWeight='600' color='$textPrimary'>
                                    Bus #{vehicle.vehicle_number || vehicle.vin?.substring(0, 8)}
                                </Text>
                                <Text fontSize='$4' color='$textSecondary'>
                                    {vehicle.year} {vehicle.make} {vehicle.model}
                                </Text>
                            </YStack>
                            <YStack alignItems='flex-end'>
                                <Text fontSize='$3' color='$textSecondary'>
                                    {new Date().toLocaleDateString()}
                                </Text>
                                <Text fontSize='$3' color='$textSecondary'>
                                    Pre-Trip Inspection
                                </Text>
                            </YStack>
                        </XStack>
                    </WidgetContainer>

                    {/* Progress Summary */}
                    {inspectionStarted && (
                        <WidgetContainer>
                            <Text fontSize='$4' fontWeight='600' color='$textPrimary' marginBottom='$3'>
                                Inspection Progress
                            </Text>
                            <XStack justifyContent='space-between' alignItems='center'>
                                <YStack alignItems='center'>
                                    <Text fontSize='$6' fontWeight='600' color='$textPrimary'>{completedItems}</Text>
                                    <Text fontSize='$2' color='$textSecondary'>Completed</Text>
                                </YStack>
                                <YStack alignItems='center'>
                                    <Text fontSize='$6' fontWeight='600' color='$successBorder'>{passedItems}</Text>
                                    <Text fontSize='$2' color='$textSecondary'>Passed</Text>
                                </YStack>
                                <YStack alignItems='center'>
                                    <Text fontSize='$6' fontWeight='600' color='$errorBorder'>{failedItems}</Text>
                                    <Text fontSize='$2' color='$textSecondary'>Failed</Text>
                                </YStack>
                                <YStack alignItems='center'>
                                    <Text fontSize='$6' fontWeight='600' color='$warningBorder'>
                                        {inspectionItems.length - completedItems}
                                    </Text>
                                    <Text fontSize='$2' color='$textSecondary'>Pending</Text>
                                </YStack>
                            </XStack>
                        </WidgetContainer>
                    )}

                    {!inspectionStarted ? (
                        /* Start Inspection */
                        <WidgetContainer>
                            <YStack alignItems='center' space='$4' padding='$6'>
                                <FontAwesomeIcon icon={faClipboardCheck} size={48} color={theme.primaryBorder.val} />
                                <Text fontSize='$6' fontWeight='600' color='$textPrimary' textAlign='center'>
                                    Ready to Start Pre-Trip Inspection
                                </Text>
                                <Text fontSize='$4' color='$textSecondary' textAlign='center'>
                                    Complete the safety checklist before starting your route
                                </Text>
                                <Button size='$5' theme='blue' onPress={startInspection}>
                                    <FontAwesomeIcon icon={faClipboardCheck} size={20} color='white' />
                                    <Text color='white' fontSize='$5' marginLeft='$3'>Start Inspection</Text>
                                </Button>
                            </YStack>
                        </WidgetContainer>
                    ) : (
                        /* Inspection Items */
                        <>
                            <Text fontSize='$5' fontWeight='600' color='$textPrimary' marginBottom='$3'>
                                Safety Checklist ({inspectionItems.length} items)
                            </Text>
                            
                            {inspectionItems.map((item) => (
                                <InspectionItem
                                    key={item.id}
                                    item={item}
                                    onToggle={handleItemToggle}
                                    onAddNote={handleAddNote}
                                />
                            ))}

                            {/* Action Buttons */}
                            <WidgetContainer>
                                <XStack space='$3'>
                                    <Button 
                                        flex={1} 
                                        size='$4' 
                                        theme='gray' 
                                        onPress={saveDraft}
                                        disabled={submitting}
                                    >
                                        <FontAwesomeIcon icon={faFileAlt} size={16} />
                                        <Text marginLeft='$2'>Save Draft</Text>
                                    </Button>
                                    <Button 
                                        flex={2} 
                                        size='$4' 
                                        theme='blue' 
                                        onPress={submitInspection}
                                        disabled={submitting}
                                    >
                                        <FontAwesomeIcon icon={faCheck} size={16} color='white' />
                                        <Text color='white' marginLeft='$2'>
                                            {submitting ? 'Submitting...' : 'Complete Inspection'}
                                        </Text>
                                    </Button>
                                </XStack>
                            </WidgetContainer>
                        </>
                    )}
                </YStack>
            </ScrollView>
        </YStack>
    );
};

export default PreTripInspectionScreen;