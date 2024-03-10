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

    useEffect(() => {
        db.transaction(tx => {
            tx.executeSql(
                'create table if not exists recordings (id integer primary key not null, uri text, buttonIndex integer unique);',
            );
        });
        loadRecordings();
        requestPermissions();
    }, []);

    const requestPermissions = async () => {
        const response = await Audio.requestPermissionsAsync();
        setPermissionsGranted(response.status === 'granted');
    };

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

    const playRecording = async (uri) => {
        try {
            const { sound } = await Audio.Sound.createAsync({ uri });
            await sound.playAsync();
        } catch (error) {
            console.error('Failed to play recording', error);
        }
    };

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

    const playSound = async (soundResource) => {
        try {
            // Load the sound
            const { sound } = await Audio.Sound.createAsync(soundResource);
            // Play the loaded sound
            await sound.playAsync();
            // When playback is done, unload the sound from memory
            sound.setOnPlaybackStatusUpdate(async (playbackStatus) => {
                if (playbackStatus.didJustFinish && !playbackStatus.isLooping) {
                    await sound.unloadAsync();
                }
            });
        } catch (error) {
            console.error('Error playing sound:', error);
        }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>SOUNDBOARD</Text>
            <View style={styles.sectionContainer}>
                <Text style={styles.sectionTitle}>Default Sounds</Text>
                {/* Pre-programmed Sound Buttons */}
                <TouchableOpacity
                    style={styles.button}
                    onPress={() => playSound(require('../assets/sounds/applause.mp3'))}
                >
                    <Text style={styles.buttonText}>APPLAUSE</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={styles.button}
                    onPress={() => playSound(require('../assets/sounds/gameOver.mp3'))}
                >
                    <Text style={styles.buttonText}>GAME OVER</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={styles.button}
                    onPress={() => playSound(require('../assets/sounds/slowTrombone.mp3'))}
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
        color: 'orange',
    },
    button: {
        backgroundColor: 'blue',
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
});
