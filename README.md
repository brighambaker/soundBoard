# SoundBoard App

## Description
This Soundboard App is a mobile application developed using React Native, allowing users to play pre-installed sounds and record, 
play back, and delete their recordings. It utilizes Expo's AV library for handling audio functionalities and SQLite for local storage of recordings.

## Author
- Brigham Baker

## Date
- 2024-03-09

## Features
- Play 3 pre-installed sound clips.
- Record 3 new sounds with the device's microphone.
- Play back recorded sounds.
- Delete recordings.
- Store recordings locally using SQLite.

## Application Structure
The main logic of the Soundboard App, including audio recording, playback, and database handling, is implemented in the `HomeScreen.js` file.
- **`App.js`**: Sets up the application's root component
- **`HomeScreen.js`**: Contains the core functionality of the Soundboard App, including interfaces 
for recording management, playback of pre-installed sounds, and interaction with the SQLite database.

## Dependencies
This project relies on the following Expo and React Native libraries:

expo: The framework and platform for universal React applications.
expo-av: Provides audio and video playback and recording functionalities.
expo-sqlite: Allows the application to interact with an SQLite database for local storage.
react-native: The library used to develop the mobile application's UI.

Ensure all dependencies are installed using npm

## Usage
The app consists of two main functionalities:

1. Playing Sounds:	
					Tap on any of the pre-installed sound buttons to play a sound.
					Can play multiple sounds at once
					Can play the same sound multiple times at once
					Sounds do overlap

2. Recording Sounds:
					Tap on a "Record" button to start recording.
					Tap "Stop" to end the recording.
					Tap "Play" to playback the recorded sound.
					Long-press the button to delete the recording.