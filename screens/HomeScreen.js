/**
 *  \author Brigham Baker
 *  \file   HomeScreen.js
 *  \date   2024-03-09
 *  \brief  logic for HomeScreen and database handling
 * **/

import React, { useState, useEffect } from 'react';
import {
    Button,
    StyleSheet,
    View,
    Text,
    TouchableOpacity
} from 'react-native';
import { Audio } from 'expo-av';
import * as SQLite from 'expo-sqlite';

const db = SQLite.openDatabase('recordings.db');

export default function HomeScreen() {
    const [recordingUris, setRecordingUris] = useState([null, null, null]);
    const [isRecording, setIsRecording] = useState([false, false, false]);
    const [recordings, setRecordings] = useState([null, null, null]);
    const [permissionsGranted, setPermissionsGranted] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [flash, setFlash] = useState(false);
    const [soundStatus, setSoundStatus] = useState({
        applause: { isPlaying: false, isFlashing: false },
        gameOver: { isPlaying: false, isFlashing: false },
        slowTrombone: { isPlaying: false, isFlashing: false },
    });

    // creates the database table if it does not exist
    useEffect(() => {
        db.transaction(tx => {
            tx.executeSql(
                'create table if not exists recordings (id integer primary key not null, uri text, buttonIndex integer unique);',
            );
        });
        loadRecordings();
        requestPermissions();
    }, []);

    // function that requests permission for app to use devices microphone
    const requestPermissions = async () => {
        const response = await Audio.requestPermissionsAsync();
        setPermissionsGranted(response.status === 'granted');
    };

    // function that loads recordings from the database
    const loadRecordings = () => {
        db.transaction(tx => {
            tx.executeSql(
                'select * from recordings',
                [],
                (_, { rows: { _array } }) => {
                    let newUris = [null, null, null];
                    _array.forEach(item => {
                        newUris[item.buttonIndex] = item.uri;
                    });
                    setRecordingUris(newUris);
                },
                (_, error) => console.log(error)
            );
        });
    };

    // function to start a recording
    const startRecording = async (index) => {
        if (!permissionsGranted) return;
        try {
            // Set audio mode to allow recording (also ensures playback is configured correctly)
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true, // Allows playback to continue when the screen is locked or silent mode is turned on
                staysActiveInBackground: false, // If you want recording to continue even when the app goes into the background
                shouldDuckAndroid: true, // Lower the volume of other applications while recording (Android)
            });

            const recording = new Audio.Recording();
            await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
            await recording.startAsync();

            // Update the recordings array with the new recording instance
            const updatedRecordings = recordings.map((rec, idx) => idx === index ? recording : rec);
            setRecordings(updatedRecordings);
            setIsRecording(isRecording.map((item, idx) => idx === index ? true : item));
        } catch (error) {
            console.error('Failed to start recording', error);
        }
    };

    // function to stop the recording
   const stopRecording = async (index) => {
        try {
            const recording = recordings[index];
            if (recording) {
                await recording.stopAndUnloadAsync();
                const uri = recording.getURI();

                saveRecording(uri, index);
                // Reset the state for this recording slot
                const updatedRecordings = recordings.map((rec, idx) => idx === index ? null : rec);
                setRecordings(updatedRecordings);
                setIsRecording(isRecording.map((item, idx) => idx === index ? false : item));
            }
        } catch (error) {
            console.error('Failed to stop recording', error);
        }
    };

    // function that stores the recording in the database
    const saveRecording = (uri, index) => {
        db.transaction(tx => {
            tx.executeSql(
                'insert or replace into recordings (uri, buttonIndex) values (?, ?)',
                [uri, index],
                () => {
                    loadRecordings();
                },
                (_, error) => console.log(error)
            );
        });
    };

    // function to play the recorded recording
    const playRecording = async (uri) => {
        try {
            const { sound } = await Audio.Sound.createAsync({ uri });
            await sound.playAsync();
        } catch (error) {
            console.error('Failed to play recording', error);
        }
    };


    // function to delete the recording stored in the database
    const deleteRecording = (index) => {
        db.transaction(tx => {
            tx.executeSql(
                'delete from recordings where buttonIndex = ?',
                [index],
                () => {
                    loadRecordings();
                    setRecordingUris(recordingUris.map((uri, idx) => idx === index ? null : uri));
                },
                (_, error) => console.log(error)
            );
        });
    };

    // function that handles the press of the recording button, calling on functions
    const handlePress = (index) => {
        if (isRecording[index]) {
            stopRecording(index);
        } else if (recordingUris[index]) {
            playRecording(recordingUris[index]);
        } else {
            startRecording(index);
        }
    };

    const getTitle = (index) => {
        if (isRecording[index]) return 'Stop';
        if (recordingUris[index]) return 'Play';
        return 'Record';
    };

    // Object to keep track of intervals for each sound
    const flashIntervals = {};

    // function that plays the preinstalled sounds
    const playSound = async (soundResource, soundName) => {
        try {
            // Indicate that a sound is playing and should start flashing
            setSoundStatus(prev => ({ ...prev, [soundName]: { isPlaying: true, isFlashing: true } }));

            const { sound } = await Audio.Sound.createAsync(soundResource);
            await sound.playAsync();

            // Initialize flashing effect for this sound
            if (!flashIntervals[soundName]) {
                flashIntervals[soundName] = setInterval(() => {
                    setSoundStatus(prev => ({
                        ...prev,
                        [soundName]: { ...prev[soundName], isFlashing: !prev[soundName].isFlashing },
                    }));
                }, 75);
            }

            sound.setOnPlaybackStatusUpdate(async (playbackStatus) => {
                if (playbackStatus.didJustFinish && !playbackStatus.isLooping) {
                    await sound.unloadAsync();
                    clearInterval(flashIntervals[soundName]);
                    flashIntervals[soundName] = null; // Clear interval reference

                    // Reset playing and flashing state
                    setSoundStatus(prev => ({ ...prev, [soundName]: { isPlaying: false, isFlashing: false } }));
                }
            });
        } catch (error) {
            console.error(`Error playing sound (${soundName}):`, error);
            clearInterval(flashIntervals[soundName]);
            flashIntervals[soundName] = null; // Ensure interval is cleared in case of an error
            // Reset playing and flashing state in case of an error
            setSoundStatus(prev => ({ ...prev, [soundName]: { isPlaying: false, isFlashing: false } }));
        }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>SOUNDBOARD</Text>
            <View style={styles.sectionContainer}>
                <Text style={styles.sectionTitle}>Default Sounds</Text>
                {/* Pre-programmed Sound Buttons */}
                <TouchableOpacity
                    style={[styles.button, soundStatus.applause.isFlashing ? styles.flashing : {}]}
                    onPress={() => playSound(require('../assets/sounds/applause.mp3'), 'applause')}
                >
                    <Text style={styles.buttonText}>APPLAUSE</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.button, soundStatus.gameOver.isFlashing ? styles.flashing : {}]}
                    onPress={() => playSound(require('../assets/sounds/gameOver.mp3'), 'gameOver')}
                >
                    <Text style={styles.buttonText}>GAME OVER</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.button, soundStatus.slowTrombone.isFlashing ? styles.flashing : {}]}
                    onPress={() => playSound(require('../assets/sounds/slowTrombone.mp3'), 'slowTrombone')}
                >
                    <Text style={styles.buttonText}>SAD TROMBONE</Text>
                </TouchableOpacity>
            </View>
            <View style={styles.sectionContainer}>
                <Text style={styles.sectionTitle}>Record Your Sounds Here</Text>
                {/* Dynamic buttons for recording, playing, and deleting recordings */}
                {[0, 1, 2].map((index) => (
                    <TouchableOpacity
                        key={index}
                        style={[styles.button, isRecording[index] ? styles.buttonRecording : styles.buttonNotRecording]}
                        onPress={() => handlePress(index)}
                        onLongPress={() => deleteRecording(index)}
                    >
                        <Text style={styles.buttonText}>{getTitle(index)}</Text>
                    </TouchableOpacity>
                ))}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
    },
    title: {
        fontSize: 36,
        fontWeight: 'bold',
        marginBottom: 20,
        color: 'purple',
    },
    sectionContainer: {
        width: '100%',
        alignItems: 'center',
        marginVertical: 10,
    },
    sectionTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: 'red',
    },
    button: {
        backgroundColor: 'lightblue',
        paddingHorizontal: 20,
        paddingVertical: 10,
        margin: 5,
        borderRadius: 5,
    },
    buttonRecording: {
        backgroundColor: 'red',
    },
    buttonNotRecording: {
        backgroundColor: 'green',
    },
    buttonText: {
        color: 'white',
        fontSize: 16,
    },
    flashing: {
        backgroundColor: 'orange',
    }
});
